"use client";

import { useMemo, useState } from "react";
import type { Restaurant, Workspace } from "@tastetrail/shared";

type Props = {
  initialWorkspaces: Workspace[];
  initialRestaurants: Restaurant[];
};

export function RestaurantsScreen({ initialWorkspaces, initialRestaurants }: Props) {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaces[0]?.id ?? "");
  const [workspaceName, setWorkspaceName] = useState("My Family");
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisine, setCuisine] = useState("Other");
  const [status, setStatus] = useState<string | null>(null);

  const canCreateRestaurant = useMemo(() => Boolean(workspaceId && restaurantName.trim() && cuisine.trim()), [workspaceId, restaurantName, cuisine]);

  async function createWorkspace() {
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to create workspace");
      return;
    }
    const workspace = data as Workspace;
    setWorkspaces((current) => [workspace, ...current]);
    setWorkspaceId(workspace.id);
    setStatus(`Created workspace ${workspace.name}`);
  }

  async function createRestaurant() {
    const response = await fetch("/api/restaurants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({
        name: restaurantName,
        cuisine,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to create restaurant");
      return;
    }
    setRestaurants((current) => [data as Restaurant, ...current]);
    setRestaurantName("");
    setStatus(`Added ${data.name}`);
  }

  return (
    <div className="stack-xl">
      <section className="grid-two">
        <div className="card stack-md">
          <h2>Workspace</h2>
          <label className="stack-xs">
            <span>Current workspace</span>
            <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-xs">
            <span>Create workspace</span>
            <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
          </label>
          <button onClick={createWorkspace}>Create Workspace</button>
        </div>

        <div className="card stack-md">
          <h2>Add restaurant</h2>
          <label className="stack-xs">
            <span>Name</span>
            <input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="The Dumpling Bench" />
          </label>
          <label className="stack-xs">
            <span>Cuisine</span>
            <input value={cuisine} onChange={(event) => setCuisine(event.target.value)} placeholder="Chinese" />
          </label>
          <button onClick={createRestaurant} disabled={!canCreateRestaurant}>
            Add Restaurant
          </button>
        </div>
      </section>

      <section className="card stack-md">
        <div className="row-between">
          <h2>Unified restaurant list</h2>
          <span className="muted">{restaurants.length} total</span>
        </div>
        <div className="stack-sm">
          {restaurants.map((restaurant) => (
            <article key={restaurant.id} className="list-item">
              <div>
                <h3>{restaurant.name}</h3>
                <p className="muted">
                  {restaurant.cuisine} · {restaurant.menuItemCount ?? 0} items · {restaurant.triedCount ?? 0} tried
                </p>
              </div>
              <div className="pill-group">
                <span className="pill">{restaurant.isShared ? "Shared" : "Owned"}</span>
                {restaurant.ownerName ? <span className="pill subtle">{restaurant.ownerName}</span> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      {status ? <p className="status status-neutral">{status}</p> : null}
    </div>
  );
}
