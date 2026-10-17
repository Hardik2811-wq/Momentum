import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAiProvider,
  getAiProviderLabel,
  maskApiKey,
  parseKeyInput
} from '../src/lib/groqClient.js';

test('parseKeyInput handles comma, newline, and space separated keys', () => {
  const input = `
    gsk_keyOne12345678901234567890,
    gsk_keyTwo12345678901234567890
    gsk_keyThree12345678901234567890; gsk_keyFour12345678901234567890
  `;
  const keys = parseKeyInput(input);
  assert.equal(keys.length, 4);
  assert.equal(keys[0], 'gsk_keyOne12345678901234567890');
  assert.equal(keys[1], 'gsk_keyTwo12345678901234567890');
  assert.equal(keys[2], 'gsk_keyThree12345678901234567890');
  assert.equal(keys[3], 'gsk_keyFour12345678901234567890');
});

test('maskApiKey masks keys securely for display', () => {
  const key = 'gsk_abcdef1234567890xyz';
  const masked = maskApiKey(key);
  assert.ok(masked.startsWith('gsk_abc'));
  assert.ok(masked.endsWith('0xyz'));
  assert.ok(masked.includes('...'));
  assert.ok(!masked.includes('123456789'));
});

test('detectAiProvider recognizes multiple groq keys and other providers', () => {
  assert.equal(detectAiProvider('gsk_12345678901234567890'), 'groq');
  assert.equal(detectAiProvider('gsk_abcdefghijklmnopqrstuvwxyz'), 'groq');
  assert.equal(detectAiProvider('AIzaSyD-1234567890123456789012345'), 'gemini');
  assert.equal(detectAiProvider('sk-or-12345678901234567890'), 'openrouter');
  assert.equal(detectAiProvider('invalid-key'), null);
});

test('Multiple Groq keys array simulation verifies rotation and deduplication', () => {
  const k1 = 'gsk_keyA12345678901234567890';
  const k2 = 'gsk_keyB12345678901234567890';
  const k3 = 'gsk_keyC12345678901234567890';

  const mockStorage = new Map();
  mockStorage.set('momentum_groq_api_keys', JSON.stringify([k1, k2, k1, k3]));

  const raw = JSON.parse(mockStorage.get('momentum_groq_api_keys'));
  const unique = Array.from(new Set(raw.filter(k => detectAiProvider(k) === 'groq')));

  assert.equal(unique.length, 3);
  assert.deepEqual(unique, [k1, k2, k3]);

  // Round-robin index progression
  let idx = 0;
  const pick = () => {
    const key = unique[idx % unique.length];
    idx = (idx + 1) % unique.length;
    return key;
  };

  assert.equal(pick(), k1);
  assert.equal(pick(), k2);
  assert.equal(pick(), k3);
  assert.equal(pick(), k1);
});

test('Multi-key failover prioritizes unblocked keys when one hits 429', () => {
  const keys = [
    'gsk_primary1234567890123456789',
    'gsk_backup12345678901234567890'
  ];
  const cooldowns = new Map();

  // Simulate 429 on primary key
  const now = Date.now();
  cooldowns.set(keys[0], now + 60000);

  // Sort by cooldown
  const available = [...keys].sort((a, b) => {
    const coolA = (cooldowns.get(a) || 0) > now ? 1 : 0;
    const coolB = (cooldowns.get(b) || 0) > now ? 1 : 0;
    return coolA - coolB;
  });

  assert.equal(available[0], keys[1]);
  assert.equal(available[1], keys[0]);
});
