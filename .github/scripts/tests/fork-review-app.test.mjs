import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { generateJWT, reviewAppConfig } from '../get-bot-token.mjs';
import { findExistingComment } from '../run-quality-gates.mjs';
test('JWT uses configured app ID', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const payload = JSON.parse(Buffer.from(generateJWT(privateKey, '5935379').split('.')[1], 'base64url'));
  assert.equal(payload.iss, '5935379');
});
test('finds only comments authored by the configured bot', async () => {
  const comments = [
    { id: 1, user: { login: 'commitperclip[bot]' }, body: 'old\n— commitperclip' },
    { id: 2, user: { login: 'atarim-paperclip-review[bot]' }, body: 'current\n— commitperclip' },
  ];
  const found = await findExistingComment(async () => comments, 'token', 'atarim-info/paperclip', 28, 'atarim-paperclip-review[bot]');
  assert.equal(found.id, 2);
});

test('selects the fork app only for the fork', () => {
  assert.deepEqual(reviewAppConfig('atarim-info/paperclip'), { appId: '5935379', botLogin: 'atarim-paperclip-review[bot]' });
  assert.deepEqual(reviewAppConfig('paperclipai/paperclip'), { appId: '3718661', botLogin: 'commitperclip[bot]' });
});
