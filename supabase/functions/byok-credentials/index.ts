import { createClient } from 'npm:@supabase/supabase-js@2';
import { encryptByokCredential } from '../_shared/byok-crypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '';

function headers(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function reply(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(origin), 'Content-Type': 'application/json' } });
}

async function audit(admin: ReturnType<typeof createClient>, userId: string, eventType: string) {
  const { error } = await admin.from('ai_byok_audit_events').insert({ user_id: userId, event_type: eventType });
  if (error) console.error('BYOK audit write failed', error.code);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (!ALLOWED_ORIGIN || origin !== ALLOWED_ORIGIN) return reply({ error: 'Origin denied.' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return reply({ error: 'BYOK service unavailable.' }, 503, origin);

  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer\s+[^\s]+$/i.test(authorization)) return reply({ error: 'Authentication required.' }, 401, origin);

  let payload: { action?: unknown; key?: unknown };
  try { payload = await request.json(); } catch { return reply({ error: 'Invalid request.' }, 400, origin); }
  if (!['status', 'save', 'delete'].includes(String(payload.action))) return reply({ error: 'Invalid action.' }, 400, origin);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return reply({ error: 'Authentication required.' }, 401, origin);
  const userId = userData.user.id;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  if (payload.action === 'status') {
    const { data, error } = await admin.from('ai_byok_credentials').select('updated_at').eq('user_id', userId).maybeSingle();
    if (error) return reply({ error: 'BYOK status unavailable.' }, 503, origin);
    return reply({ configured: Boolean(data), updatedAt: data?.updated_at ?? null }, 200, origin);
  }

  const { data: allowed, error: limitError } = await userClient.rpc('consume_byok_credential_change');
  if (limitError || allowed !== true) return reply({ error: 'Credential change limit reached. Try again later.' }, 429, origin);

  if (payload.action === 'delete') {
    const { error } = await admin.from('ai_byok_credentials').delete().eq('user_id', userId);
    if (error) return reply({ error: 'Credential removal failed.' }, 503, origin);
    await audit(admin, userId, 'credential_deleted');
    return reply({ configured: false }, 200, origin);
  }

  const credential = typeof payload.key === 'string' ? payload.key.trim() : '';
  if (!/^gsk_[A-Za-z0-9_-]{20,}$/.test(credential) || credential.length > 512) {
    return reply({ error: 'Invalid provider key.' }, 400, origin);
  }

  const validation = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${credential}` }, signal: AbortSignal.timeout(10_000)
  }).catch(() => null);
  if (!validation?.ok) return reply({ error: 'Provider key validation failed.' }, 400, origin);

  try {
    const encrypted = await encryptByokCredential(credential, userId);
    const { error } = await admin.from('ai_byok_credentials').upsert({
      user_id: userId,
      encrypted_key: encrypted.encryptedKey,
      key_version: encrypted.keyVersion
    });
    if (error) return reply({ error: 'Credential storage failed.' }, 503, origin);
    await audit(admin, userId, 'credential_saved');
    return reply({ configured: true }, 200, origin);
  } catch (error) {
    console.error('BYOK credential save failed', error instanceof Error ? error.name : 'unknown');
    return reply({ error: 'Credential storage failed.' }, 503, origin);
  }
});
