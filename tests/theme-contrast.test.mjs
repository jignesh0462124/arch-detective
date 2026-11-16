import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const luminance = (hex) => {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const ratio = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const theme of ["light", "dark"]) {
  test(`${theme} content, status text and active buttons meet contrast thresholds`, () => {
    const block = css.match(
      theme === "light" ? /:root\[data-theme="light"\]\s*\{([^}]+)\}/ : /\.dark\s*\{([^}]+)\}/,
    )[1];
    const tokens = Object.fromEntries(
      [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
    );
    for (const background of ["card", "background", "secondary"]) {
      for (const foreground of [
        "foreground",
        "muted-foreground",
        "accent",
        "destructive",
        "success",
        "severity-critical",
        "severity-high",
        "severity-medium",
        "severity-low",
      ]) {
        assert.ok(
          ratio(tokens[foreground], tokens[background]) >= 4.5,
          `${foreground} on ${background}: ${ratio(tokens[foreground], tokens[background]).toFixed(2)}`,
        );
      }
    }
    for (const surface of ["primary", "accent", "destructive", "success"]) {
      assert.ok(
        ratio(tokens[surface], tokens[`${surface}-foreground`]) >= 4.5,
        `${surface} control text`,
      );
    }
    const fill =
      "#" +
      tokens.foreground
        .slice(1)
        .match(/../g)
        .map((value, index) => {
          const track = parseInt(tokens.muted.slice(1).match(/../g)[index], 16);
          return Math.round(parseInt(value, 16) * 0.75 + track * 0.25)
            .toString(16)
            .padStart(2, "0");
        })
        .join("");
    assert.ok(ratio(fill, tokens.muted) >= 3, `${theme} assessment bar is distinct from its track`);
    for (const severity of ["critical", "high", "medium", "low"]) {
      const rgba = block
        .match(new RegExp(`--severity-${severity}-bg:\\s*rgba\\(([^)]+)\\)`))[1]
        .split(",")
        .map(Number);
      const base = tokens.card
        .slice(1)
        .match(/../g)
        .map((value) => parseInt(value, 16));
      const mixed =
        "#" +
        base
          .map((value, index) =>
            Math.round(value * (1 - rgba[3]) + rgba[index] * rgba[3])
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
      assert.ok(
        ratio(tokens[`severity-${severity}`], mixed) >= 4.5,
        `${severity} badge: ${ratio(tokens[`severity-${severity}`], mixed).toFixed(2)}`,
      );
    }
  });
}
