from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.api import ai_chat
from app.auth.dependencies import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=UUID('10000000-0000-4000-8000-000000000001'), email='test@example.com', session_id=None)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_chat_requires_auth():
    assert TestClient(app).post('/api/v1/ai/chat', json={'messages': [{'role': 'user', 'content': 'hello'}]}).status_code == 401
    assert TestClient(app).get('/api/v1/ai/capabilities').status_code == 401


def test_chat_requires_provider(client, monkeypatch):
    monkeypatch.setattr(ai_chat.settings, 'OMEGAPLUS_API_KEY', '')
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', '')
    assert client.post('/api/v1/ai/chat', json={'messages': [{'role': 'user', 'content': 'hello'}]}).status_code == 503


def test_capabilities_reflect_backend_provider_state(client, monkeypatch):
    monkeypatch.setattr(ai_chat.settings, 'OMEGAPLUS_API_KEY', '')
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', '')
    assert client.get('/api/v1/ai/capabilities').json() == {'available': False}
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', 'test-key')
    assert client.get('/api/v1/ai/capabilities').json() == {'available': True}


@pytest.mark.asyncio
async def test_finding_context_requires_authorized_scan_and_redacts_secret(monkeypatch):
    ids = [uuid4() for _ in range(3)]
    calls = []
    class Store:
        async def authorize(self, scan_id, token, workspace_id):
            calls.append((scan_id, token, workspace_id))
        async def rest(self, method, table, *, params, token):
            assert method == 'GET' and table == 'findings' and token == 'user-token'
            assert params['scan_id'] == f'eq.{ids[1]}'
            return [{'id': str(ids[2]), 'title': 'Exposed key', 'description': 'api_key=secret-value',
                     'code_snippet': 'api_key=secret-value', 'severity': 'high', 'private_column': 'never-send'}]
    monkeypatch.setattr(ai_chat, 'WorkbenchStore', Store)
    message = await ai_chat.verified_finding_context(ai_chat.FindingContext(
        workspace_id=ids[0], scan_id=ids[1], finding_id=ids[2]), 'user-token')
    assert calls == [(str(ids[1]), 'user-token', str(ids[0]))]
    assert 'secret-value' not in message.content and 'never-send' not in message.content
    assert 'Exposed key' in message.content

    class DeniedStore(Store):
        async def authorize(self, scan_id, token, workspace_id):
            raise HTTPException(404, 'Scan not found')
    monkeypatch.setattr(ai_chat, 'WorkbenchStore', DeniedStore)
    with pytest.raises(HTTPException) as denied:
        await ai_chat.verified_finding_context(ai_chat.FindingContext(
            workspace_id=ids[0], scan_id=ids[1], finding_id=ids[2]), 'user-token')
    assert denied.value.status_code == 404


@pytest.mark.parametrize('payload', [
    {'messages': []},
    {'messages': [{'role': 'tool', 'content': 'hello'}]},
    {'model': 'unapproved-model', 'messages': [{'role': 'user', 'content': 'hello'}]},
    {'messages': [{'role': 'user', 'content': 'x' * 32769}]},
    {'messages': [{'role': 'user', 'content': 'x' * 30000}] * 4},
])
def test_chat_rejects_invalid_payload(client, payload):
    assert client.post('/api/v1/ai/chat', json=payload).status_code == 422


def test_chat_streams_only_content_and_keeps_key_server_side(client, monkeypatch):
    monkeypatch.setattr(ai_chat.settings, 'OMEGAPLUS_API_KEY', 'test-secret-not-for-client')
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', '')
    original = httpx.AsyncClient
    def handle(request):
        assert request.headers['Authorization'] == 'Bearer test-secret-not-for-client'
        return httpx.Response(200, text='data: {"choices":[{"delta":{"content":"Hello"}}],"provider_metadata":"private"}\n\ndata: [DONE]\n\n')
    monkeypatch.setattr(ai_chat.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    response = client.post('/api/v1/ai/chat', json={'messages': [{'role': 'user', 'content': 'hello'}]})
    assert response.status_code == 200
    assert 'Hello' in response.text and '[DONE]' in response.text
    assert 'test-secret' not in response.text and 'provider_metadata' not in response.text


def test_chat_falls_back_without_exposing_upstream_errors(client, monkeypatch):
    monkeypatch.setattr(ai_chat.settings, 'OMEGAPLUS_API_KEY', 'first-secret')
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', 'second-secret')
    original = httpx.AsyncClient
    calls = []
    def handle(request):
        calls.append(request.url.host)
        if len(calls) == 1:
            return httpx.Response(503, text='sensitive-upstream-error')
        return httpx.Response(200, text='data: {"choices":[{"delta":{"content":"Fallback"}}]}\n\ndata: [DONE]\n\n')
    monkeypatch.setattr(ai_chat.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    response = client.post('/api/v1/ai/chat', json={'messages': [{'role': 'user', 'content': 'hello'}]})
    assert len(calls) == 2 and 'Fallback' in response.text
    assert 'secret' not in response.text and 'sensitive-upstream-error' not in response.text
