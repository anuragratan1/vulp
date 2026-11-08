import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

let cachedMasterKey: Buffer | null = null;

/**
 * Determine the file path for data/master.key.
 */
export function getMasterKeyFilePath(): string {
  // Check relative to cwd
  const directPath = path.resolve(process.cwd(), 'data');
  if (fs.existsSync(directPath)) {
    return path.join(directPath, 'master.key');
  }

  // Check parent directories if cwd is apps/server
  const parentPath = path.resolve(process.cwd(), '..', '..', 'data');
  if (fs.existsSync(parentPath)) {
    return path.join(parentPath, 'master.key');
  }

  // Default to creating in cwd/data
  return path.join(directPath, 'master.key');
}

/**
 * Retrieve or automatically generate the 32-byte master key.
 * 1. Checks WF_MASTER_KEY environment variable.
 * 2. Reads data/master.key file.
 * 3. If file does not exist, generates 32 random bytes, writes to data/master.key, and returns key.
 */
export function getMasterKey(): Buffer {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  const envKey = process.env.WF_MASTER_KEY?.trim();
  if (envKey) {
    // If 64 hex characters, parse as hex; otherwise if 32 chars, parse as utf8
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      cachedMasterKey = Buffer.from(envKey, 'hex');
    } else {
      cachedMasterKey = crypto.createHash('sha256').update(envKey).digest();
    }
    return cachedMasterKey;
  }

  const keyFilePath = getMasterKeyFilePath();

  if (fs.existsSync(keyFilePath)) {
    const fileContent = fs.readFileSync(keyFilePath, 'utf8').trim();
    if (fileContent.length === 64 && /^[0-9a-fA-F]+$/.test(fileContent)) {
      cachedMasterKey = Buffer.from(fileContent, 'hex');
    } else {
      cachedMasterKey = crypto.createHash('sha256').update(fileContent).digest();
    }
    return cachedMasterKey;
  }

  // Generate a new 32-byte cryptographically random master key
  const newKey = crypto.randomBytes(32);
  const dir = path.dirname(keyFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(keyFilePath, newKey.toString('hex') + '\n', {
    encoding: 'utf8',
    mode: 0o600, // Read/write only by owner
  });

  cachedMasterKey = newKey;
  return cachedMasterKey;
}

/**
 * Reset cached master key (useful for unit testing).
 */
export function resetCachedMasterKey(): void {
  cachedMasterKey = null;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: ivHex:authTagHex:encryptedHex
 */
export function encrypt(plainText: string, customKey?: Buffer): string {
  const key = customKey ?? getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Input format: ivHex:authTagHex:encryptedHex
 */
export function decrypt(cipherText: string, customKey?: Buffer): string {
  const key = customKey ?? getMasterKey();

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:encrypted');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
    throw new Error('Invalid ciphertext metadata: corrupted IV or auth tag length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    throw new Error(`Decryption failed: authentication verification failed`);
  }
}

