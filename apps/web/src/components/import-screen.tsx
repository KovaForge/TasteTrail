"use client";

import { useState } from "react";

type Props = {
  workspaceId: string;
};

export function ImportScreen({ workspaceId }: Props) {
  const [sourceType, setSourceType] = useState<"text" | "url" | "image">("text");
  const [sourceValue, setSourceValue] = useState("");
  const [draft, setDraft] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function parseDraft() {
    const response = await fetch("/api/imports/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({
        sourceType,
        sourceValue,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to parse import");
      return;
    }
    setDraft(data);
    setStatus("Draft created. Review before commit.");
  }

  async function commitDraft() {
    if (!draft) return;
    const response = await fetch(`/api/imports/${draft.id}/commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({
        restaurantName: draft.restaurant.name,
        cuisine: draft.restaurant.cuisine,
        items: draft.items.map((item: any) => ({ ...item, selected: true })),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to commit import");
      return;
    }
    setStatus(`Committed ${data.items.length} menu items`);
  }

  return (
    <div className="stack-xl">
      <section className="card stack-md">
        <h1>Draft-first imports</h1>
        <p className="muted">Parse menus through the Vercel backend, review the draft, then commit selected items.</p>
        <label className="stack-xs">
          <span>Source type</span>
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value as "text" | "url" | "image")}>
            <option value="text">Pasted text</option>
            <option value="url">URL</option>
            <option value="image">Base64 screenshot image</option>
          </select>
        </label>
        <label className="stack-xs">
          <span>Source value</span>
          <textarea rows={10} value={sourceValue} onChange={(event) => setSourceValue(event.target.value)} />
        </label>
        <div className="button-row">
          <button onClick={parseDraft}>Parse Draft</button>
          <button className="secondary" onClick={commitDraft} disabled={!draft}>
            Commit Draft
          </button>
        </div>
      </section>

      {draft ? (
        <section className="card stack-md">
          <div className="row-between">
            <h2>{draft.restaurant.name}</h2>
            <span className="pill">{draft.restaurant.cuisine}</span>
          </div>
          <ul className="plain-list">
            {draft.items.map((item: any) => (
              <li key={item.name} className="list-item">
                <div>
                  <strong>{item.name}</strong>
                  <p className="muted">{item.description || item.category || "No description"}</p>
                </div>
                {item.price ? <span className="pill subtle">${item.price}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {status ? <p className="status status-neutral">{status}</p> : null}
    </div>
  );
}
