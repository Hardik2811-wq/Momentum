const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array) {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function activeKeyVersion() {
  const value = Number(Deno.env.get('ACTIVE_BYOK_KEY_VERSION') ?? '1');
  if (!Number.isInteger(value) || value < 1 || value > 99) throw new Error('Invalid active encryption key version.');
  return value;
}

async function encryptionKey(version: number) {
  const secret = Deno.env.get(`BYOK_ENCRYPTION_KEY_V${version}`) ?? '';
  const raw = base64ToBytes(secret);
  if (raw.length !== 32) throw new Error('Invalid encryption key.');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function aad(userId: string, version: number) {
  return encoder.encode(`momentum-byok:v${version}:${userId}`);
}

export async function encryptByokCredential(credential: string, userId: string) {
  const keyVersion = activeKeyVersion();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(userId, keyVersion) },
    await encryptionKey(keyVersion),
    encoder.encode(credential)
  );
  return { encryptedKey: `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`, keyVersion };
}

export async function decryptByokCredential(encryptedKey: string, userId: string, keyVersion: number) {
  const [ivText, ciphertextText, extra] = encryptedKey.split('.');
  if (!ivText || !ciphertextText || extra) throw new Error('Invalid encrypted credential.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivText), additionalData: aad(userId, keyVersion) },
    await encryptionKey(keyVersion),
    base64ToBytes(ciphertextText)
  );
  return decoder.decode(plaintext);
}

export function getActiveByokKeyVersion() {
  return activeKeyVersion();
}
