"""Construct clients without credentials or network calls to catch SDK pin conflicts."""
import asyncio

from groq import AsyncGroq, Groq
from langchain_groq import ChatGroq


def test_provider_clients_support_declared_httpx():
    with Groq(api_key="fixture-not-a-real-secret") as client:
        assert client.chat.completions is not None

    async def check_async():
        async with AsyncGroq(api_key="fixture-not-a-real-secret") as client:
            assert client.chat.completions is not None

    asyncio.run(check_async())


def test_legacy_agent_client_constructs_without_network():
    model = ChatGroq(api_key="fixture-not-a-real-secret", model="fixture-model")
    assert model.client is not None
    assert model.async_client is not None
    model.client._client.close()
    asyncio.run(model.async_client._client.close())
