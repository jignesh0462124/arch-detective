import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const env = (await Promise.all(['.env', 'threatlens/.env'].map(path => readFile(path, 'utf8').catch(() => '')))).join('\n');
const secrets = env.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\s*(?:VITE_)?(?:(?:OMEGAPLUS|GROQ)_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$/);
  return match?.[1] ? [match[1].replace(/^['"]|['"]$/g, '')] : [];
}).filter(value => value.length > 10);
let checked = 0;
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (/\.(?:js|map|html)$/.test(path)) {
      const source = await readFile(path, 'utf8');
      assert.ok(!secrets.some(secret => source.includes(secret)), `Server secret found in client asset: ${path}`);
      checked++;
    }
  }
}
await check('.vercel/output/static');
console.log(`PASS: ${checked} public assets checked; no configured provider or service-role keys found. Credential values were not printed.`);
