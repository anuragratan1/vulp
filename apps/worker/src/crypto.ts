import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV
const TAG_LENGTH = 16; // 128-bit tag

export function getMasterKeyBuffer(secretKey?: string): Buffer {
  if (secretKey && secretKey.trim().length === 64) {
    return Buffer.from(secretKey.trim(), 'hex');
  }
  if (secretKey && secretKey.trim().length >= 32) {
    return crypto.createHash('sha256').update(secretKey.trim()).digest();
  }
  // Default fallback derived key
  return crypto.createHash('sha256').update('vulp_production_cloudflare_default_master_key_seed').digest();
}

export function encrypt(plainText: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(cipherText: string, key: Buffer): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:encrypted');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

