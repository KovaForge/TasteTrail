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

const allowedHosts = [
  "tastetrail.delpach.com",
  "*.vercel.app",
  "localhost:3000",
  "localhost:5173",
];

function getBaseUrlFallback() {
  return process.env.BETTER_AUTH_URL || process.env.APP_BASE_URL || "https://tastetrail.delpach.com";
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  database: pool,
  baseURL: {
    allowedHosts,
    protocol: "auto",
    fallback: getBaseUrlFallback(),
  },
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || "dev-only-secret-change-me",
  emailAndPassword: {
    enabled: false,
  },
  socialProviders,
  plugins: [
    passkey({
      rpName: "TasteTrail",
      // Better Auth can derive the effective origin and RP ID from the request host.
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
