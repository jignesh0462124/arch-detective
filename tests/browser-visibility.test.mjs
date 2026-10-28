import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { isPageVisible, visiblePageInterval } from "../src/lib/browserVisibility.ts";

test("SSR polling is disabled when document does not exist", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(isPageVisible(), false);
  assert.equal(visiblePageInterval(15000), false);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function DisabledPolling() {
    const query = useQuery({
      queryKey: ["ssr-disabled-polling"],
      queryFn: async () => "unused",
      enabled: false,
      refetchInterval: () => visiblePageInterval(15000),
    });
    return React.createElement("span", null, query.status);
  }
  // QueryObserver evaluates the interval callback during SSR even when disabled.
  assert.match(
    renderToString(
      React.createElement(QueryClientProvider, { client }, React.createElement(DisabledPolling)),
    ),
    /pending/,
  );
  client.clear();
});

test("polling runs only while the browser page is visible", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { visibilityState: "hidden" },
    });
    assert.equal(visiblePageInterval(15000), false);
    globalThis.document.visibilityState = "visible";
    assert.equal(visiblePageInterval(15000), 15000);
    globalThis.document.visibilityState = "prerender";
    assert.equal(isPageVisible(), false);
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else delete globalThis.document;
  }
});
