import test from "node:test";
import assert from "node:assert/strict";
import {
  sidebarCollapsed,
  sidebarPreferenceKey,
  readSidebarPreference,
  setSidebarPreference,
} from "../src/lib/sidebar.ts";

test("sidebar defaults, explicit preferences and unavailable storage stay safe", () => {
  assert.equal(sidebarCollapsed(null, "/dashboard"), false);
  assert.equal(sidebarCollapsed(null, "/advisor"), true);
  assert.equal(sidebarCollapsed("expanded", "/advisor"), false);
  assert.equal(sidebarCollapsed("collapsed", "/workspace"), true);
  const original = globalThis.window;
  const events = new EventTarget();
  const data = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => data.get(key),
      setItem: (key, value) => data.set(key, value),
    },
    dispatchEvent: (event) => events.dispatchEvent(event),
  };
  try {
    assert.equal(readSidebarPreference(), null);
    setSidebarPreference("collapsed");
    assert.equal(readSidebarPreference(), "collapsed");
    assert.equal(data.get(sidebarPreferenceKey), "collapsed");
    globalThis.window.localStorage.setItem = () => {
      throw Error("Storage denied");
    };
    setSidebarPreference("expanded");
    assert.equal(readSidebarPreference(), "expanded");
  } finally {
    globalThis.window = original;
  }
});
