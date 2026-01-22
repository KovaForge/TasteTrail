import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 12; // 96 bits (recommended for GCM)

/**
 * Get the master encryption key from environment variables
 */
function getMasterKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  
  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is not set. Cannot encrypt/decrypt API keys.');
  }
  
  // Expect base64-encoded 32-byte key
  const keyBuffer = Buffer.from(masterKey, 'base64');
  
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Invalid ENCRYPTION_MASTER_KEY length. Expected ${KEY_LENGTH} bytes, got ${keyBuffer.length}.`);
  }
  
  return keyBuffer;
}

/**
 * Encrypt plaintext using AES-256-GCM
 */
export function encrypt(plaintext: string): { ciphertext: Buffer; nonce: Buffer } {
  const key = getMasterKey();
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  
  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Append auth tag to ciphertext for verification during decryption
  const encryptedData = Buffer.concat([ciphertext, authTag]);
  
  return {
    ciphertext: encryptedData,
    nonce,
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 */
export function decrypt(ciphertext: Buffer, nonce: Buffer): string {
  const key = getMasterKey();
  
  // Extract auth tag (last 16 bytes)
  const authTagLength = 16;
  const authTag = ciphertext.slice(-authTagLength);
  const encryptedText = ciphertext.slice(0, -authTagLength);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Generate a new master encryption key (for setup)
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}
