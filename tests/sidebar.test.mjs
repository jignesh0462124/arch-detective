import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("desktop toggle is circular, directional and anchored outside the scrollable navigation", async () => {
  const shell = await readFile("src/components/brutal/AppShell.tsx", "utf8");
  const toggle = shell.slice(
    shell.indexOf('data-testid="desktop-sidebar-toggle"'),
    shell.indexOf("{/* Main */}"),
  );
  assert.match(toggle, /top-1\/2/);
  assert.match(toggle, /translate-x-1\/2/);
  assert.match(toggle, /size-11/);
  assert.match(toggle, /rounded-full/);
  assert.match(toggle, /<CaretRight/);
  assert.match(toggle, /<CaretLeft/);
  assert.match(toggle, /aria-expanded=\{!collapsed\}/);
  assert.match(toggle, /aria-controls=\{sidebarId\}/);
  assert.equal((shell.match(/data-testid="desktop-sidebar-toggle"/g) || []).length, 1);
  assert.doesNotMatch(shell.slice(shell.indexOf("{/* Header */}")), /<SidebarSimple/);
  assert.match(shell, /aria-label="Open navigation"/);
});

test("Findings and Fix verification have distinct purpose-specific icons in shared navigation", async () => {
  const shell = await readFile("src/components/brutal/AppShell.tsx", "utf8");
  assert.match(shell, /to: "\/findings", label: "Findings", icon: BugBeetle/);
  assert.match(shell, /to: "\/fix-verification", label: "Fix verification", icon: ListChecks/);
  assert.match(shell, /const MOBILE_NAV = NAV\.slice\(0, 5\)/);
});

test("Security Advisor uses the same mark in shared navigation and the toolbar", async () => {
  const shell = await readFile("src/components/brutal/AppShell.tsx", "utf8");
  assert.match(shell, /to: "\/advisor", label: "Security Advisor", icon: AdvisorIcon/);
  assert.match(shell, /<AdvisorIcon/);
  assert.doesNotMatch(shell, /ChatCircleText|ShieldCheck/);
});
