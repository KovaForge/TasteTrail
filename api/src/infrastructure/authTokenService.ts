import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_VERSION = 1;
const DEFAULT_TOKEN_LIFETIME_HOURS = 720; // 30 days

export interface TokenPayload {
  userId: string;
  email: string;
  issuedAt: number;
  mfaSatisfied: boolean;
}

export interface ValidatedToken {
  userId: string;
  email: string;
  mfaSatisfied: boolean;
}

export class AuthTokenService {
  private readonly key: Buffer | null;
  private readonly tokenLifetimeMs: number;

  constructor() {
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (secret) {
      this.key = Buffer.from(secret, 'utf8');
    } else {
      this.key = null;
      console.warn('AUTH_TOKEN_SECRET not set — CLI token issuance will be unavailable');
    }

    const lifetimeHours = parseFloat(process.env.AUTH_TOKEN_LIFETIME_HOURS || '');
    this.tokenLifetimeMs = lifetimeHours > 0
      ? lifetimeHours * 60 * 60 * 1000
      : DEFAULT_TOKEN_LIFETIME_HOURS * 60 * 60 * 1000;
  }

  issueToken(userId: string, email: string, mfaSatisfied = true): string | null {
    if (!this.key) return null;

    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = `${TOKEN_VERSION}|${userId}|${email}|${issuedAt}|${mfaSatisfied ? '1' : '0'}`;
    const payloadBytes = Buffer.from(payload, 'utf8');
    const signature = createHmac('sha256', this.key).update(payloadBytes).digest();
    return `${base64UrlEncode(payloadBytes)}.${base64UrlEncode(signature)}`;
  }

  tryValidate(token: string): ValidatedToken | null {
    if (!this.key) return null;

    const parts = token.split('.', 2);
    if (parts.length !== 2) return null;

    let payloadBytes: Buffer;
    let signatureBytes: Buffer;
    try {
      payloadBytes = base64UrlDecode(parts[0]);
      signatureBytes = base64UrlDecode(parts[1]);
    } catch {
      return null;
    }

    const expected = createHmac('sha256', this.key).update(payloadBytes).digest();
    if (!timingSafeEqual(expected, signatureBytes)) return null;

    const payload = payloadBytes.toString('utf8');
    const fields = payload.split('|');
    if (fields.length !== 5) return null;

    const version = parseInt(fields[0], 10);
    if (version !== TOKEN_VERSION) return null;

    const userId = fields[1];
    if (!userId) return null;

    const email = fields[2];
    if (!email) return null;

    const issuedAt = parseInt(fields[3], 10);
    const mfaSatisfied = fields[4] === '1';

    const ageMs = Date.now() - issuedAt * 1000;
    if (ageMs > this.tokenLifetimeMs) return null;

    return { userId, email, mfaSatisfied };
  }
}

// ─── Base64url utilities ────────────────────────────────────────────────────────

function base64UrlEncode(bytes: Buffer): string {
  return bytes.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string): Buffer {
  let padded = value.replace(/-/g, '+').replace(/_/g, '/');
  switch (padded.length % 4) {
    case 2: padded += '=='; break;
    case 3: padded += '='; break;
  }
  return Buffer.from(padded, 'base64');
}

// Singleton instance
export const authTokenService = new AuthTokenService();