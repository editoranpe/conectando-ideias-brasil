/**
 * Provisions the CIB D1 database and persistently configures its binding.
 * Run only from the trusted GitHub workflow. Never log the Cloudflare API token.
 */
import { readFile, writeFile } from 'node:fs/promises';

const DB_NAME = 'conectando-ideias-brasil-db';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT_RE = /^[a-f0-9]{32}$/i;

async function cloudflareRequest({ accountId, token, method = 'GET', pathname, body, fetcher = fetch }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${pathname}`;
  const response = await fetcher(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const reason = payload?.errors?.map((e) => e.message).filter(Boolean).join('; ') || `HTTP ${response.status}`;
    throw new Error(`Cloudflare API rejected ${method} ${pathname}: ${reason}`);
  }
  return payload;
}

export async function provisionD1({ accountId, token, configPath = 'wrangler.jsonc', fetcher = fetch }) {
  if (!ACCOUNT_RE.test(accountId || '')) throw new Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid.');
  if (!token || token.length < 20) throw new Error('CLOUDFLARE_API_TOKEN is missing or invalid.');

  const request = (params) => cloudflareRequest({ accountId, token, fetcher, ...params });
  const query = new URLSearchParams({ name: DB_NAME, per_page: '100' });
  const listed = await request({ pathname: `/d1/database?${query}` });
  const matched = (listed.result || []).filter((db) => db.name === DB_NAME);
  if (matched.length > 1) throw new Error(`Multiple databases named ${DB_NAME}. Resolve this before proceeding.`);
  let db = matched[0];
  let created = false;
  if (!db) {
    const result = await request({ method: 'POST', pathname: '/d1/database', body: { name: DB_NAME } });
    db = result.result;
    created = true;
  }
  if (!UUID_RE.test(db?.uuid || '')) throw new Error('Cloudflare returned an invalid D1 database UUID.');

  const text = await readFile(configPath, 'utf8');
  // The project uses a JSONC extension, but currently contains ordinary JSON.
  const config = JSON.parse(text);
  if (config.name !== 'conectando-ideias-brasil') throw new Error('Unexpected Worker name; refusing to change the binding.');
  const current = config.d1_databases || [];
  const alreadyBound = current.find((item) => item.binding === 'DB');
  if (alreadyBound && alreadyBound.database_id !== db.uuid) {
    throw new Error('Existing DB binding points to a different database. Review manually before changing financial storage.');
  }
  if (!alreadyBound) {
    config.d1_databases = [...current, { binding: 'DB', database_name: DB_NAME, database_id: db.uuid }];
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  }
  return { database_name: DB_NAME, uuid: db.uuid, created, bindingChanged: !alreadyBound };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  provisionD1({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN })
    .then(({ database_name, uuid, created, bindingChanged }) => {
      console.log(`D1 ${database_name}: ${created ? 'created' : 'found'} (${uuid}). Binding ${bindingChanged ? 'added' : 'already configured'}.`);
    })
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}