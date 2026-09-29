import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptByokCredential, encryptByokCredential, getActiveByokKeyVersion } from '../_shared/byok-crypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 12000;
const MAX_TOTAL_CHARS = 24000;
const MAX_TOKENS = 4096;

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function response(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function validMessages(value: unknown): value is Array<{ role: string; content: string }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const message of value) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return false;
    if (!message.content.trim() || message.content.length > MAX_MESSAGE_CHARS) return false;
    total += message.content.length;
  }
  return total <= MAX_TOTAL_CHARS;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (!ALLOWED_ORIGIN || origin !== ALLOWED_ORIGIN) return response({ error: 'Origin denied.' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405, origin);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return response({ error: 'AI service unavailable.' }, 503, origin);

  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer\s+[^\s]+$/i.test(authorization)) return response({ error: 'Authentication required.' }, 401, origin);

  let payload: { messages?: unknown; temperature?: unknown; maxTokens?: unknown; jsonMode?: unknown };
  try {
    payload = await request.json();
  } catch {
    return response({ error: 'Invalid request.' }, 400, origin);
  }
  if (!validMessages(payload.messages)) return response({ error: 'Invalid AI request.' }, 400, origin);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return response({ error: 'Authentication required.' }, 401, origin);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: credential, error: credentialError } = await admin
    .from('ai_byok_credentials')
    .select('encrypted_key, key_version')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (credentialError) return response({ error: 'AI credential unavailable.' }, 503, origin);
  if (!credential) return response({ error: 'No BYOK key configured.' }, 428, origin);

  let apiKey = '';
  try {
    apiKey = await decryptByokCredential(credential.encrypted_key, userData.user.id, credential.key_version);
    const activeVersion = getActiveByokKeyVersion();
    if (credential.key_version !== activeVersion) {
      const rotated = await encryptByokCredential(apiKey, userData.user.id);
      const { error } = await admin.from('ai_byok_credentials').update({
        encrypted_key: rotated.encryptedKey,
        key_version: rotated.keyVersion
      }).eq('user_id', userData.user.id);
      if (error) return response({ error: 'AI credential unavailable.' }, 503, origin);
      await admin.from('ai_byok_audit_events').insert({ user_id: userData.user.id, event_type: 'credential_rotated' });
    }
  } catch (error) {
    console.error('BYOK credential decrypt failed', error instanceof Error ? error.name : 'unknown');
    return response({ error: 'AI credential unavailable.' }, 503, origin);
  }

  const { data: allowed, error: limitError } = await supabase.rpc('consume_ai_request');
  if (limitError || allowed !== true) return response({ error: 'AI request limit reached. Try again later.' }, 429, origin);

  const maxTokens = typeof payload.maxTokens === 'number'
    ? Math.min(Math.max(Math.floor(payload.maxTokens), 1), MAX_TOKENS)
    : 800;
  const temperature = typeof payload.temperature === 'number'
    ? Math.min(Math.max(payload.temperature, 0), 1)
    : 0.2;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: payload.messages,
        response_format: payload.jsonMode === false ? undefined : { type: 'json_object' },
        temperature,
        max_tokens: maxTokens
      })
    });
    if (!groqResponse.ok) {
      console.error('Groq request failed', groqResponse.status);
      return response({ error: 'AI provider request failed.' }, 502, origin);
    }
    const result = await groqResponse.json();
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length > 100000) return response({ error: 'Invalid AI provider response.' }, 502, origin);
    return response({ content, model: GROQ_MODEL }, 200, origin);
  } catch (error) {
    console.error('Groq proxy failure', error instanceof Error ? error.name : 'unknown');
    return response({ error: 'AI provider unavailable.' }, 502, origin);
  } finally {
    clearTimeout(timeout);
  }
});
