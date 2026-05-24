"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function MigrateAccountScreen() {
  const [status, setStatus] = useState<string | null>(null);

  async function claimLegacyData() {
    const response = await fetch("/api/migrations/claim-legacy-account", {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Migration failed");
      return;
    }
    const migrated = data.migrated ? `Migrated legacy identities: ${data.oldUserIds.join(", ")}` : "No legacy data needed migration";
    setStatus(migrated);
  }

  async function addPasskey() {
    const result = await authClient.passkey.addPasskey({
      name: "TasteTrail Migrated Account Passkey",
      authenticatorAttachment: "platform",
    });
    if (result.error) {
      setStatus(result.error.message ?? "Failed to add passkey");
      return;
    }
    setStatus("Passkey added. You can stop relying on Microsoft sign-in once your migration is complete.");
  }

  return (
    <div className="card stack-lg">
      <div className="stack-sm">
        <p className="eyebrow">Legacy migration</p>
        <h1>Claim Microsoft-era TasteTrail data, then attach a passkey</h1>
        <p className="muted">
          This flow is the bridge from the old Microsoft-account identity model to the new passkey-first account model on Vercel + Neon.
        </p>
      </div>
      <div className="button-row">
        <button onClick={claimLegacyData}>Claim Legacy Data</button>
        <button className="secondary" onClick={addPasskey}>
          Add Passkey
        </button>
      </div>
      {status ? <p className="status status-neutral">{status}</p> : null}
    </div>
  );
}
