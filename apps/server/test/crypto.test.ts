import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getMasterKey,
  encrypt,
  decrypt,
  resetCachedMasterKey,
  getMasterKeyFilePath,
} from '../src/security/crypto.js';

describe('Security & AES-256-GCM Crypto', () => {
  const originalEnvKey = process.env.WF_MASTER_KEY;

  beforeEach(() => {
    resetCachedMasterKey();
    delete process.env.WF_MASTER_KEY;
  });

  afterEach(() => {
    resetCachedMasterKey();
    if (originalEnvKey !== undefined) {
      process.env.WF_MASTER_KEY = originalEnvKey;
    } else {
      delete process.env.WF_MASTER_KEY;
    }
  });

  it('automatically generates and persists data/master.key if missing', () => {
    const key = getMasterKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);

    const keyPath = getMasterKeyFilePath();
    expect(fs.existsSync(keyPath)).toBe(true);
    const content = fs.readFileSync(keyPath, 'utf8').trim();
    expect(content.length).toBe(64); // 64 hex characters
    expect(Buffer.from(content, 'hex')).toEqual(key);
  });

  it('loads custom key from WF_MASTER_KEY environment variable', () => {
    const customKeyHex = crypto.randomBytes(32).toString('hex');
    process.env.WF_MASTER_KEY = customKeyHex;
    resetCachedMasterKey();

    const key = getMasterKey();
    expect(key.toString('hex')).toBe(customKeyHex);
  });

  it('encrypts and decrypts secret strings correctly', () => {
    const secret = JSON.stringify({
      apiKey: 'sk-ant-live-992147104918231',
      token: 'bearer_token_xyz_secret',
    });

    const encrypted = encrypt(secret);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('sk-ant');
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secret);
    expect(JSON.parse(decrypted)).toEqual({
      apiKey: 'sk-ant-live-992147104918231',
      token: 'bearer_token_xyz_secret',
    });
  });

  it('detects tampering and throws on corrupted ciphertext or auth tag', () => {
    const plaintext = 'super-secret-password-123';
    const encrypted = encrypt(plaintext);
    const [ivHex, tagHex, cipherHex] = encrypted.split(':');

    // 1. Tamper with ciphertext
    const tamperedCipher =
      cipherHex.slice(0, -2) + (cipherHex.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(() => decrypt(`${ivHex}:${tagHex}:${tamperedCipher}`)).toThrow();

    // 2. Tamper with auth tag
    const tamperedTag =
      tagHex.slice(0, -2) + (tagHex.slice(-2) === '11' ? '22' : '11');
    expect(() => decrypt(`${ivHex}:${tamperedTag}:${cipherHex}`)).toThrow();

    // 3. Malformed format
    expect(() => decrypt('invalid-format')).toThrow();
  });
});

