# Security policy

## BYOK provider credentials

Groq keys are user secrets. Never put them in browser code, Vite environment variables, `localStorage`, cloud workspace snapshots, logs, source control, backups, or support tickets.

`supabase/functions/byok-credentials` is the only approved path to save or remove a user key. It verifies the current Supabase user, validates the provider key, rate-limits key changes, encrypts with AES-256-GCM, binds ciphertext to that user through authenticated encryption data, and writes no key to logs.

`supabase/functions/groq-proxy` is the only approved path to Groq. It verifies the current Supabase user, checks an atomic per-user request quota, reads ciphertext with service-role access, decrypts only in function memory, then calls Groq. No browser or database query can read plaintext keys. Deploy both functions with JWT verification enabled.

Set these Edge Function secrets outside source control:

- `ALLOWED_ORIGIN` — exactly one HTTPS production origin
- `ACTIVE_BYOK_KEY_VERSION=1`
- `BYOK_ENCRYPTION_KEY_V1` — 32 cryptographically random bytes, base64 encoded
- `GROQ_MODEL` — optional approved model identifier

Never set a server-wide `GROQ_API_KEY`. Every request uses the authenticated user's BYOK key. Rotate the encryption key by adding `BYOK_ENCRYPTION_KEY_V2`, setting `ACTIVE_BYOK_KEY_VERSION=2`, and retaining V1 until every saved credential has been used once and re-encrypted. Configure provider spend limits and alerts. The migration removes legacy plaintext `groqApiKey` values from workspace snapshots; browser startup removes legacy `momentum_groq_api_key` storage.

## Required production controls

- Enforce HTTPS and redirect HTTP to HTTPS.
- Set a strict CSP as an HTTP response header. Avoid `unsafe-inline`; use nonces or hashes for required inline code.
- Set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, and clickjacking protection.
- Restrict Supabase Auth redirect URLs and enable MFA for privileged accounts.
- Monitor Edge Function errors, auth anomalies, quota denials, provider spend, and secret access. Never log prompts, authorization headers, sessions, or provider keys.
- Test authorization and rate-limit controls after every deployment.
