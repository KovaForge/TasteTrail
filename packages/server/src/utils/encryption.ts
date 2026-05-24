import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;

function getMasterKey() {
  const rawKey = process.env.ENCRYPTION_MASTER_KEY?.trim();
  if (!rawKey) {
    throw new Error("ENCRYPTION_MASTER_KEY is not configured");
  }
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_MASTER_KEY must decode to ${KEY_LENGTH} bytes`);
  }
  return key;
}

export function encryptSecret(plaintext: string) {
  const key = getMasterKey();
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]),
    nonce,
  };
}

export function decryptSecret(ciphertext: Buffer, nonce: Buffer) {
  const key = getMasterKey();
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const payload = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
}

export function coercePgBytes(value: unknown) {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === "string") {
    if (value.startsWith("\\x")) {
      return Buffer.from(value.slice(2), "hex");
    }
    return Buffer.from(value, "base64");
  }
  throw new Error("Unable to coerce database bytea value");
}
