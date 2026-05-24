import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { emailOTP } from "better-auth/plugins";

const socialProviders = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  ? {
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: process.env.MICROSOFT_TENANT_ID || "common",
        mapProfileToUser: () => ({ image: undefined }),
      },
    }
  : undefined;

function getBaseUrl() {
  return process.env.BETTER_AUTH_URL || process.env.APP_BASE_URL || "http://localhost:3000";
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  database: pool,
  baseURL: getBaseUrl(),
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || "dev-only-secret-change-me",
  emailAndPassword: {
    enabled: false,
  },
  socialProviders,
  plugins: [
    passkey({
      rpID: process.env.PASSKEY_RP_ID || "localhost",
      rpName: "TasteTrail",
      origin: getBaseUrl(),
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[tastetrail][email-otp] ${type} for ${email}: ${otp}`);
      },
      disableSignUp: false,
      sendVerificationOnSignUp: true,
      changeEmail: {
        enabled: true,
      },
    }),
    nextCookies(),
  ],
});
