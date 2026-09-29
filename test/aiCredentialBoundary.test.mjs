import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../src/lib/groqClient.js', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../supabase/functions/groq-proxy/index.ts', import.meta.url), 'utf8');
const byokCredentials = readFileSync(new URL('../supabase/functions/byok-credentials/index.ts', import.meta.url), 'utf8');
const byokCrypto = readFileSync(new URL('../supabase/functions/_shared/byok-crypto.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/202609290001_secure_ai_proxy.sql', import.meta.url), 'utf8');

test('browser AI client cannot retain or call with a provider secret', () => {
  assert.doesNotMatch(client, /api\.groq\.com/);
  assert.doesNotMatch(client, /localStorage\?\.setItem\(['"]momentum_groq_api_key/);
  assert.doesNotMatch(client, /Authorization:\s*`Bearer/);
});

test('AI proxy requires authenticated, bounded, rate-limited requests', () => {
  assert.match(proxy, /auth\.getUser\(\)/);
  assert.match(proxy, /consume_ai_request/);
  assert.match(proxy, /MAX_TOTAL_CHARS/);
  assert.match(proxy, /ALLOWED_ORIGIN/);
  assert.match(proxy, /decryptByokCredential/);
  assert.doesNotMatch(proxy, /GROQ_API_KEY/);
  assert.match(migration, /groqApiKey/);
  assert.match(migration, /request_count < 20/);
});

test('BYOK service encrypts and isolates provider credentials', () => {
  assert.match(byokCredentials, /auth\.getUser\(\)/);
  assert.match(byokCredentials, /consume_byok_credential_change/);
  assert.match(byokCredentials, /encryptByokCredential/);
  assert.match(byokCredentials, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(byokCrypto, /AES-GCM/);
  assert.match(byokCrypto, /additionalData/);
  assert.match(byokCrypto, /BYOK_ENCRYPTION_KEY_V/);
  assert.match(migration, /ai_byok_credentials/);
  assert.match(migration, /request_count < 5/);
});
