import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 12; // 96 bits (recommended for GCM)

/**
 * Convert database BYTEA result to Buffer
 * Handles: Buffer, Uint8Array, hex string (\x...), ArrayBuffer, or base64
 */
export function toBuffer(data: unknown): Buffer {
  // Extensive logging for debugging
  const dataType = data === null ? 'null' 
    : data === undefined ? 'undefined'
    : Buffer.isBuffer(data) ? 'Buffer'
    : data instanceof Uint8Array ? 'Uint8Array'
    : ArrayBuffer.isView(data) ? 'ArrayBufferView'
    : data instanceof ArrayBuffer ? 'ArrayBuffer'
    : typeof data === 'string' ? `string(len=${(data as string).length}, start=${(data as string).substring(0, 20)})`
    : typeof data === 'object' ? `object(keys=${Object.keys(data as object).slice(0, 5).join(',')})`
    : typeof data;
  console.log(`[toBuffer] Input type: ${dataType}`);
  
  if (Buffer.isBuffer(data)) {
    return data;
  }
  
  // Handle Uint8Array and other TypedArrays
  if (ArrayBuffer.isView(data)) {
    return Buffer.from((data as Uint8Array).buffer, (data as Uint8Array).byteOffset, (data as Uint8Array).byteLength);
  }
  
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  
  if (typeof data === 'string') {
    // PostgreSQL hex format: \x followed by hex characters
    // Check for both \x and \\x (escaped version)
    if (data.startsWith('\\x')) {
      const hexPart = data.slice(2);
      console.log(`[toBuffer] Parsing hex string (\\x), hex part length: ${hexPart.length}`);
      return Buffer.from(hexPart, 'hex');
    }
    // Try base64 as fallback
    console.log(`[toBuffer] Parsing as base64`);
    return Buffer.from(data, 'base64');
  }
  
  // Handle object with numeric indices (sometimes returned by drivers)
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, number>;
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
      console.log(`[toBuffer] Converting numeric-keyed object to buffer`);
      const arr = new Uint8Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        arr[i] = obj[String(i)];
      }
      return Buffer.from(arr);
    }
  }
  
  // Last resort: try to convert whatever it is
  console.warn('[toBuffer] Unknown data type, attempting raw conversion:', typeof data);
  return Buffer.from(data as any);
}

/**
 * Get the master encryption key from environment variables
 */
function getMasterKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY?.trim();
  
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
