/* Hand-built vector identity. Run with the Codex bundled Node runtime. */
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("C:/Users/jigne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const OUT = path.resolve(__dirname, "../docs/brand/archon-refined-v1");
const C = {
  ink: "#111111",
  cream: "#F5F1EC",
  orange: "#FF5600",
  line: "#D3CEC6",
  muted: "#626260",
  white: "#FFFFFF",
};

// One architectural arch, two open feet, one counter and one inspection point.
// The counter and opening are real negative space, not background-colored fills.
const arch =
  "M8 56V30C8 16.7452 18.7452 6 32 6S56 16.7452 56 30V56H44V44H20V56Z M20 34H44V30C44 23.3726 38.6274 18 32 18S20 23.3726 20 30Z";
function mark(ink = C.ink, accent = C.orange) {
  return `<path d="${arch}" fill="${ink}" fill-rule="evenodd"/><rect x="28" y="48" width="8" height="8" fill="${accent}"/>`;
}

// Custom wordmark: six drawn glyphs, no external fonts or text substitution.
// Broad round bowls echo the arch; open counters preserve small-size legibility.
const glyphs = [
  {
    w: 35,
    p: "M0 44L14.5 0H20.5L35 44H28.7L24.6 31H10.3L6.2 44Z M12 25.5H22.9L17.5 7.5Z",
    rule: true,
  },
  {
    w: 34,
    p: "M0 44V0H16C26.5 0 32.5 5.2 32.5 13.5C32.5 19.9 29 24.2 22.7 26L34 44H26.6L16.2 27H6V44Z M6 5.5V21.5H15.4C22.9 21.5 26.3 18.9 26.3 13.5S22.9 5.5 15.4 5.5Z",
    rule: true,
  },
  {
    w: 36,
    p: "M35.5 9L30.5 12C28.1 7.3 24.1 4.9 18.8 4.9C10.5 4.9 5.9 11.3 5.9 22S10.5 39.1 18.8 39.1C24.1 39.1 28.1 36.7 30.5 32L35.5 35C32.2 41.3 26.5 44.8 18.8 44.8C6.9 44.8 0 36.2 0 22S6.9 -.8 18.8 -.8C26.5 -.8 32.2 2.7 35.5 9Z",
  },
  { w: 33, p: "M0 0H6V18.7H27V0H33V44H27V24.3H6V44H0Z" },
  {
    w: 39,
    p: "M19.5 -.8C32 -.8 39 7.8 39 22S32 44.8 19.5 44.8S0 36.2 0 22S7 -.8 19.5 -.8Z M19.5 4.8C10.7 4.8 6 10.8 6 22S10.7 39.2 19.5 39.2S33 33.2 33 22S28.3 4.8 19.5 4.8Z",
    rule: true,
  },
  { w: 34, p: "M0 44V0H6.2L28 33V0H34V44H27.8L6 11V44Z" },
];
function lettering(color = C.ink) {
  let x = 0;
  return glyphs
    .map((g) => {
      const result = `<path transform="translate(${x} 0)" d="${g.p}" fill="${color}"${g.rule ? ' fill-rule="evenodd"' : ""}/>`;
      x += g.w + 6.8;
      return result;
    })
    .join("");
}
function lockup(ink = C.ink, accent = C.orange) {
  return `<g transform="translate(0 0)">${mark(ink, accent)}</g><g transform="translate(80 9.1)">${lettering(ink)}</g>`;
}
function svg(w, h, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${label}</title>${body}</svg>`;
}
function txt(x, y, text, size = 14, color = C.ink, weight = 400, extra = "") {
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${text}</text>`;
}
function placedMark(x, y, s, ink = C.ink, accent = C.orange) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${mark(ink, accent)}</g>`;
}
function placedLogo(x, y, s, ink = C.ink, accent = C.orange) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${lockup(ink, accent)}</g>`;
}

async function main() {
  if (process.argv.includes("--social-only")) {
    const social = svg(
      1200,
      630,
      `<rect width="1200" height="630" fill="${C.cream}"/>${placedLogo(180, 180, 2.5)}${txt(600, 430, "Security audits and threat modeling", 27, C.muted, 400, 'text-anchor="middle"')}`,
      "Archon security audit workspace",
    );
    await sharp(Buffer.from(social))
      .png()
      .toFile(path.resolve(__dirname, "../public/og-image.png"));
    console.log("Updated social preview only.");
    return;
  }
  await fs.mkdir(OUT, { recursive: true });
  const assets = {
    "archon-mark.svg": svg(64, 64, mark(), "Archon architectural inspection mark"),
    "archon-mark-inverse.svg": svg(64, 64, mark(C.cream), "Archon mark for dark backgrounds"),
    "archon-mark-mono.svg": svg(64, 64, mark(C.ink, C.ink), "Archon single-color mark"),
    "archon-wordmark.svg": svg(336, 64, lockup(), "Archon logo"),
    "archon-wordmark-inverse.svg": svg(
      336,
      64,
      lockup(C.cream),
      "Archon logo for dark backgrounds",
    ),
    "archon-wordmark-mono.svg": svg(336, 64, lockup(C.ink, C.ink), "Archon single-color logo"),
    "archon-app-icon.svg": svg(
      128,
      128,
      `<rect width="128" height="128" rx="27" fill="${C.ink}"/>${placedMark(16, 16, 1.5, C.cream)}`,
      "Archon application icon",
    ),
  };

  const preview = [
    `<rect width="1600" height="1120" fill="${C.cream}"/>`,
    txt(80, 65, "ARCHON / IDENTITY STUDY", 12, C.muted, 600, 'letter-spacing="2"'),
    txt(1520, 65, "01", 12, C.muted, 400, 'text-anchor="end"'),
    `<path d="M80 88H1520" stroke="${C.line}"/>`,
    placedLogo(264, 168, 3.2),
    txt(800, 441, "Architecture. Inspection. Assurance.", 20, C.muted, 400, 'text-anchor="middle"'),
    `<path d="M80 500H1520" stroke="${C.line}"/>`,
    `<rect x="80" y="544" width="700" height="280" rx="12" fill="${C.white}"/>`,
    `<rect x="804" y="544" width="716" height="280" rx="12" fill="${C.ink}"/>`,
    txt(112, 580, "LIGHT SURFACES", 11, C.muted, 600, 'letter-spacing="1.5"'),
    txt(836, 580, "DARK SURFACES", 11, "#AAAAA5", 600, 'letter-spacing="1.5"'),
    placedLogo(181, 648, 1.45),
    placedLogo(913, 648, 1.45, C.cream),
    `<rect x="80" y="856" width="216" height="188" rx="12" fill="${C.ink}"/>`,
    placedMark(140, 888, 1.5, C.cream),
    txt(188, 1020, "APP MARK", 10, "#BBBBB6", 500, 'text-anchor="middle" letter-spacing="1.2"'),
    txt(344, 884, "ONE COLOR", 11, C.muted, 600, 'letter-spacing="1.5"'),
    placedMark(350, 911, 1.6, C.ink, C.ink),
    placedMark(470, 932, 1, C.ink, C.ink),
    placedMark(552, 947, 0.625, C.ink, C.ink),
    txt(680, 884, "PRODUCT PALETTE", 11, C.muted, 600, 'letter-spacing="1.5"'),
    ...[
      [C.ink, "INK"],
      [C.orange, "SIGNAL"],
      [C.cream, "CANVAS"],
      [C.white, "SURFACE"],
    ].map(
      ([color, name], i) =>
        `<rect x="${680 + i * 142}" y="908" width="122" height="70" rx="4" fill="${color}" stroke="${color === C.white || color === C.cream ? C.line : color}"/>${txt(680 + i * 142, 1002, name, 10, C.muted, 600)}${txt(680 + i * 142, 1023, color, 12, C.ink)}`,
    ),
    txt(
      80,
      1085,
      "Custom vector geometry / Open counters / Flat color / Font-independent wordmark",
      12,
      C.muted,
    ),
  ].join("");
  assets["archon-identity-preview.svg"] = svg(
    1600,
    1120,
    preview,
    "Archon refined identity with light, dark and monochrome applications",
  );
  for (const [name, body] of Object.entries(assets)) {
    await fs.writeFile(path.join(OUT, name), body + "\n");
    const exportWidth = name.includes("preview") ? 2400 : name.includes("wordmark") ? 2688 : 1024;
    await sharp(Buffer.from(body))
      .resize({ width: exportWidth })
      .png()
      .toFile(path.join(OUT, name.replace(".svg", ".png")));
  }
  // Pixel-size specimens verify the mark at normal interface dimensions.
  const specimens = svg(
    900,
    180,
    `<rect width="900" height="180" fill="${C.cream}"/>${[16, 20, 24, 32, 48, 64].map((s, i) => `<g transform="translate(${50 + i * 140} ${92 - s / 2}) scale(${s / 64})">${mark()}</g>${txt(50 + i * 140, 145, s + " px", 12, C.muted)}`).join("")}`,
    "Archon mark size specimens",
  );
  await sharp(Buffer.from(specimens)).png().toFile(path.join(OUT, "archon-size-check.png"));
  if (process.argv.includes("--install")) {
    const publicDir = path.resolve(__dirname, "../public");
    const brandDir = path.join(publicDir, "brand");
    await fs.mkdir(brandDir, { recursive: true });
    for (const [name, body] of Object.entries(assets)) {
      if (name.includes("preview")) continue;
      await fs.writeFile(path.join(brandDir, name), body + "\n");
    }
    for (const [name, source] of [
      ["logo.svg", "archon-mark.svg"],
      ["archon-mark.svg", "archon-mark.svg"],
      ["archon-wordmark.svg", "archon-wordmark.svg"],
      ["favicon.svg", "archon-app-icon.svg"],
    ]) {
      await fs.writeFile(path.join(publicDir, name), assets[source] + "\n");
    }
    const icon = Buffer.from(assets["archon-app-icon.svg"]);
    for (const [name, size] of [
      ["favicon.png", 32],
      ["apple-touch-icon.png", 180],
      ["icon-192.png", 192],
      ["icon-512.png", 512],
    ]) {
      await sharp(icon).resize(size, size).png().toFile(path.join(publicDir, name));
    }
    const social = svg(
      1200,
      630,
      `<rect width="1200" height="630" fill="${C.cream}"/>${placedLogo(180, 180, 2.5)}${txt(600, 430, "Security audits and threat modeling", 27, C.muted, 400, 'text-anchor="middle"')}`,
      "Archon security audit workspace",
    );
    await sharp(Buffer.from(social)).png().toFile(path.join(publicDir, "og-image.png"));
    console.log("Installed public logo assets, browser/app icons and social preview.");
  }
  console.log(`Exported ${Object.keys(assets).length} SVGs and PNG companions to ${OUT}`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
