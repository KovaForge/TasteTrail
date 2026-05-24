"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { DebugLogEntry } from "@tastetrail/shared";

type Props = {
  initialLogs: DebugLogEntry[];
};

export function SettingsScreen({ initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [label, setLabel] = useState("OpenClaw CLI");
  const [token, setToken] = useState<string | null>(null);
  const [debugView, setDebugView] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function addPasskey() {
    const result = await authClient.passkey.addPasskey({
      name: "TasteTrail Passkey",
      authenticatorAttachment: "platform",
    });
    if (result.error) {
      setStatus(result.error.message ?? "Failed to add passkey");
      return;
    }
    setStatus("Passkey added");
  }

  async function createCliToken() {
    const response = await fetch("/api/cli-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to create CLI token");
      return;
    }
    setToken(data.token);
    setStatus("CLI token created. Copy it now; it will not be shown again.");
  }

  async function refreshLogs() {
    const response = await fetch("/api/debug-logs");
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to load debug logs");
      return;
    }
    setLogs(data.logs);
  }

  return (
    <div className="stack-xl">
      <section className="grid-two">
        <div className="card stack-md">
          <h2>Authentication</h2>
          <p className="muted">Passkeys are the target steady-state sign-in model.</p>
          <button onClick={addPasskey}>Add Passkey</button>
        </div>

        <div className="card stack-md">
          <h2>OpenClaw CLI token</h2>
          <label className="stack-xs">
            <span>Label</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <button onClick={createCliToken}>Create CLI Token</button>
          {token ? <code className="code-block">{token}</code> : null}
        </div>
      </section>

      <section className="card stack-md">
        <div className="row-between">
          <h2>Debug View</h2>
          <label className="toggle">
            <input type="checkbox" checked={debugView} onChange={(event) => setDebugView(event.target.checked)} />
            <span>EnableDebugView</span>
          </label>
        </div>
        <p className="muted">Logs are always collected. This toggle only controls whether the in-app panel is visible.</p>
        <div className="button-row">
          <button onClick={refreshLogs}>Refresh logs</button>
          <button
            className="secondary"
            onClick={() => navigator.clipboard.writeText(JSON.stringify(logs, null, 2))}
            disabled={!debugView}
          >
            Copy Debug Report
          </button>
        </div>
        {debugView ? (
          <div className="stack-sm">
            {logs.map((entry) => (
              <article key={entry.id} className="list-item">
                <div>
                  <strong>{entry.routeName}</strong>
                  <p className="muted">
                    {entry.severity} · {entry.timestamp}
                  </p>
                </div>
                <p>{entry.message}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {status ? <p className="status status-neutral">{status}</p> : null}
    </div>
  );
}
