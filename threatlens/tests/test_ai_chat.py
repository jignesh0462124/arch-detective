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
    monkeypatch.setattr(ai_chat.settings, 'ADVISOR_HISTORY_ENABLED', False)
    assert client.get('/api/v1/ai/capabilities').json() == {'available': False, 'history_available': False}
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', 'test-key')
    assert client.get('/api/v1/ai/capabilities').json() == {'available': True, 'history_available': False}


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


def test_incomplete_provider_stream_never_appears_completed(client, monkeypatch):
    monkeypatch.setattr(ai_chat.settings, 'OMEGAPLUS_API_KEY', 'isolated-key')
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', '')
    original = httpx.AsyncClient
    monkeypatch.setattr(ai_chat.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(lambda request: httpx.Response(200, text='data: {"choices":[{"delta":{"content":"Partial suggestion"}}]}\n\n')), **kwargs))
    response = client.post('/api/v1/ai/chat', json={'messages':[{'role':'user','content':'Question'}]})
    assert 'Partial suggestion' in response.text
    assert 'stream_interrupted' in response.text and '[DONE]' not in response.text


@pytest.mark.parametrize('reason', ['length', 'content_filter', 'tool_calls'])
def test_provider_finish_reason_never_becomes_success(client, monkeypatch, reason):
    import json
    monkeypatch.setattr(ai_chat.settings, 'OMEGAPLUS_API_KEY', 'fixture')
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', '')
    original = httpx.AsyncClient
    frames = [
        {'choices': [{'delta': {'content': 'Partial code'}, 'finish_reason': None}]},
        {'choices': [{'delta': {}, 'finish_reason': reason}]},
    ]
    body = ''.join('data: ' + json.dumps(frame) + '\n\n' for frame in frames) + 'data: [DONE]\n\n'
    monkeypatch.setattr(ai_chat.httpx, 'AsyncClient', lambda **kw: original(transport=httpx.MockTransport(lambda req: httpx.Response(200, text=body)), **kw))
    response = client.post('/api/v1/ai/chat', json={'messages': [{'role': 'user', 'content': 'hello'}]})
    assert 'Partial code' in response.text
    assert 'response_truncated' in response.text and '[DONE]' not in response.text


@pytest.mark.parametrize('solution,content', [(False, 'Hello'), (True, '```js\nconst x = 1;\n```'), (True, '```js\nconst x = 1;')])
def test_code_solution_budget_prompt_and_fence_completion(client, monkeypatch, solution, content):
    import json
    monkeypatch.setattr(ai_chat.settings, 'OMEGAPLUS_API_KEY', 'fixture')
    monkeypatch.setattr(ai_chat.settings, 'GROQ_API_KEY', '')
    async def evidence(*args):
        return ai_chat.ChatMessage(role='user', content='Static trusted SVG strings; exploit not established.')
    monkeypatch.setattr(ai_chat, 'verified_finding_context', evidence)
    original = httpx.AsyncClient
    def handle(request):
        data = json.loads(request.content)
        assert data['max_tokens'] == (2048 if solution else 1024)
        assert data['messages'][-1]['content'] == 'Review finding'
        if solution:
            instruction = data['messages'][0]['content']
            assert 'do not demonstrate' not in instruction  # instruction must distinguish, not pre-judge evidence
            assert 'Static trusted SVG' in instruction and 'DOMParser is not a sanitizer' in instruction
            assert 'How to verify' in instruction
        return httpx.Response(200, text='data: ' + json.dumps({'choices': [{'delta': {'content': content}, 'finish_reason': 'stop'}]}) + '\n\ndata: [DONE]\n\n')
    monkeypatch.setattr(ai_chat.httpx, 'AsyncClient', lambda **kw: original(transport=httpx.MockTransport(handle), **kw))
    payload = {'messages': [{'role': 'user', 'content': 'Review finding'}], 'code_solution': solution}
    if solution:
        payload['context'] = {'workspace_id': str(uuid4()), 'scan_id': str(uuid4()), 'finding_id': str(uuid4())}
    response = client.post('/api/v1/ai/chat', json=payload, headers={'Authorization': 'Bearer isolated-fixture-token'})
    assert response.status_code == 200
    if solution and ai_chat.has_unclosed_code_fence(content):
        assert 'response_truncated' in response.text and '[DONE]' not in response.text
    else:
        assert '[DONE]' in response.text
