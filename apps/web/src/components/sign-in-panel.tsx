"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Status = { tone: "neutral" | "good" | "bad"; message: string } | null;

export function SignInPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const microsoftEnabled = useMemo(() => Boolean(process.env.NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED === "true"), []);

  async function sendOtp() {
    setBusy("otp");
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setBusy(null);
    if (result.error) {
      setStatus({ tone: "bad", message: result.error.message ?? "Failed to send email OTP" });
      return;
    }
    setStatus({ tone: "good", message: "OTP sent. In local development, check the server log output." });
  }

  async function signInWithOtp() {
    setBusy("otp-login");
    const result = await authClient.signIn.emailOtp({
      email,
      otp,
      name: name || undefined,
    });
    setBusy(null);
    if (result.error) {
      setStatus({ tone: "bad", message: result.error.message ?? "Failed to sign in with email OTP" });
      return;
    }
    router.push("/restaurants");
    router.refresh();
  }

  async function signInWithPasskey() {
    setBusy("passkey");
    const result = await authClient.signIn.passkey({
      autoFill: true,
    });
    setBusy(null);
    if (result.error) {
      setStatus({ tone: "bad", message: result.error.message ?? "Failed to sign in with passkey" });
      return;
    }
    router.push("/restaurants");
    router.refresh();
  }

  async function signInWithMicrosoft() {
    setBusy("microsoft");
    await authClient.signIn.social({
      provider: "microsoft",
      callbackURL: "/migrate-account",
    });
  }

  return (
    <div className="card stack-lg">
      <div className="stack-sm">
        <p className="eyebrow">TasteTrail 2.0</p>
        <h1>Passkey-first sign-in with Microsoft migration support</h1>
        <p className="muted">
          Use email OTP to bootstrap a new account, sign in with a passkey, or temporarily use Microsoft to migrate existing data before switching to passkeys.
        </p>
      </div>

      <div className="stack-md">
        <label className="stack-xs">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>
        <label className="stack-xs">
          <span>Name for first sign-in</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="TasteTrail User" />
        </label>
        <div className="button-row">
          <button onClick={sendOtp} disabled={!email || busy !== null}>
            {busy === "otp" ? "Sending..." : "Send Email OTP"}
          </button>
          <button onClick={signInWithPasskey} disabled={busy !== null}>
            {busy === "passkey" ? "Checking..." : "Use Passkey"}
          </button>
          {microsoftEnabled ? (
            <button className="secondary" onClick={signInWithMicrosoft} disabled={busy !== null}>
              {busy === "microsoft" ? "Redirecting..." : "Microsoft Migration Sign-In"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="stack-md">
        <label className="stack-xs">
          <span>One-time code</span>
          <input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" />
        </label>
        <button onClick={signInWithOtp} disabled={!email || !otp || busy !== null}>
          {busy === "otp-login" ? "Signing in..." : "Complete OTP Sign-In"}
        </button>
      </div>

      {status ? <p className={`status status-${status.tone}`}>{status.message}</p> : null}
    </div>
  );
}
