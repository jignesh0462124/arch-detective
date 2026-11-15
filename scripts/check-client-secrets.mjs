import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const privateName =
  /^(?:VITE_)?(?:(?:OMEGAPLUS|GROQ|NVD|QDRANT)_API_KEY|SUPABASE_SERVICE_ROLE_KEY|GITHUB_(?:CLIENT_SECRET|PRIVATE_KEY|WEBHOOK_SECRET|TOKEN_ENCRYPTION_KEY|USER_TOKEN|REFRESH_TOKEN)|DATABASE_URL|REDIS_URL)$/;

export function configuredSecrets(text, runtime = {}) {
  const values = [];
  // Support quoted multiline PEMs and escaped newlines; never evaluate values.
  const assignments =
    /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*("(?:\\.|[^"\\])*"|'[^']*'|[^\r\n]*)/gm;
  for (const match of text.matchAll(assignments)) {
    if (!privateName.test(match[1])) continue;
    let value = match[2].trim();
    if (/^["']/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "").trim();
    values.push(value);
  }
  for (const [key, value] of Object.entries(runtime))
    if (privateName.test(key) && typeof value === "string") values.push(value);
  return [
    ...new Set(
      values
        .filter((value) => value.length > 10)
        .flatMap((value) => {
          const decoded = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
          return [value, decoded, JSON.stringify(decoded).slice(1, -1)];
        }),
    ),
  ];
}

export function containsPrivateMaterial(source, secrets) {
  return (
    secrets.some((secret) => source.includes(secret)) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source) ||
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sb_secret_[A-Za-z0-9_-]{20,})\b/.test(
      source,
    )
  );
}

export async function checkClientAssets(root, secrets) {
  let checked = 0;
  async function check(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = dir + "/" + entry.name;
      if (entry.isDirectory()) await check(path);
      else if (/\.(?:js|mjs|map|html|json|css)$/.test(path)) {
        const source = await readFile(path, "utf8");
        // Errors identify only the public asset path, never secret values or payloads.
        assert.ok(
          !containsPrivateMaterial(source, secrets),
          "Server secret found in client asset: " + path,
        );
        checked++;
      }
    }
  }
  await check(root);
  assert.ok(checked > 0, "No public assets found; build before checking secrets.");
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = (
    await Promise.all(
      [".env", "threatlens/.env"].map((path) => readFile(path, "utf8").catch(() => "")),
    )
  ).join("\n");
  const count = await checkClientAssets(
    process.argv[2] || ".output/public",
    configuredSecrets(env, process.env),
  );
  console.log(
    "PASS: " +
      count +
      " public assets checked for configured server credentials and private-key/token signatures. Values were not printed.",
  );
}
