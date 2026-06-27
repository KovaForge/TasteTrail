"use client";

import { useMemo, useState } from "react";
import type { MenuItem, Restaurant, Workspace } from "@tastetrail/shared";

type Props = {
  initialWorkspaces: Workspace[];
  initialRestaurants: Restaurant[];
};

type RestaurantMenuState = {
  loading: boolean;
  items: MenuItem[];
  showAddForm: boolean;
  editingItemId: string | null;
};

export function RestaurantsScreen({ initialWorkspaces, initialRestaurants }: Props) {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaces[0]?.id ?? "");
  const [workspaceName, setWorkspaceName] = useState("My Family");
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisine, setCuisine] = useState("Other");
  const [status, setStatus] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuStates, setMenuStates] = useState<Record<string, RestaurantMenuState>>({});

  const canCreateRestaurant = useMemo(
    () => Boolean(workspaceId && restaurantName.trim() && cuisine.trim()),
    [workspaceId, restaurantName, cuisine],
  );

  // ── workspace & restaurant CRUD ──────────────────────────────────────

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
      headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
      body: JSON.stringify({ name: restaurantName, cuisine }),
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

  // ── menu items ───────────────────────────────────────────────────────

  async function loadMenuItems(restaurantId: string) {
    setMenuStates((prev) => ({ ...prev, [restaurantId]: { ...prev[restaurantId], loading: true, items: [] } }));
    const response = await fetch(`/api/restaurants/${restaurantId}/menu-items`);
    const data = await response.json();
    setMenuStates((prev) => ({
      ...prev,
      [restaurantId]: { ...prev[restaurantId], loading: false, items: data.items ?? [] },
    }));
  }

  function toggleExpand(restaurantId: string) {
    if (expandedId === restaurantId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(restaurantId);
    if (!menuStates[restaurantId]) {
      loadMenuItems(restaurantId);
    }
  }

  async function addMenuItem(restaurantId: string, formData: { name: string; category: string; price: string; description: string }) {
    const body: Record<string, unknown> = { name: formData.name };
    if (formData.category) body.category = formData.category;
    if (formData.price) body.price = parseFloat(formData.price);
    if (formData.description) body.description = formData.description;

    const response = await fetch(`/api/restaurants/${restaurantId}/menu-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to add item");
      return;
    }
    setMenuStates((prev) => ({
      ...prev,
      [restaurantId]: { ...prev[restaurantId], items: [...(prev[restaurantId]?.items ?? []), data as MenuItem], showAddForm: false },
    }));
    setStatus(`Added ${data.name}`);
  }

  async function updateMenuItem(restaurantId: string, itemId: string, formData: { name: string; category: string; price: string; description: string }) {
    const body: Record<string, unknown> = {};
    if (formData.name) body.name = formData.name;
    if (formData.category) body.category = formData.category;
    body.price = formData.price ? parseFloat(formData.price) : null;
    if (formData.description) body.description = formData.description;

    const response = await fetch(`/api/menu-items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.message || "Failed to update item");
      return;
    }
    setMenuStates((prev) => ({
      ...prev,
      [restaurantId]: {
        ...prev[restaurantId],
        items: prev[restaurantId].items.map((i) => (i.id === itemId ? (data as MenuItem) : i)),
        editingItemId: null,
      },
    }));
    setStatus(`Updated ${data.name}`);
  }

  async function deleteMenuItem(restaurantId: string, itemId: string) {
    const response = await fetch(`/api/menu-items/${itemId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setStatus(data.message || "Failed to delete item");
      return;
    }
    setMenuStates((prev) => ({
      ...prev,
      [restaurantId]: { ...prev[restaurantId], items: prev[restaurantId].items.filter((i) => i.id !== itemId) },
    }));
    setStatus("Item deleted");
  }

  // ── render ───────────────────────────────────────────────────────────

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
          {restaurants.map((restaurant) => {
            const menu = menuStates[restaurant.id];
            const isExpanded = expandedId === restaurant.id;
            return (
              <article key={restaurant.id}>
                <div className="list-item" style={{ cursor: "pointer" }} onClick={() => toggleExpand(restaurant.id)}>
                  <div>
                    <h3>{restaurant.name}</h3>
                    <p className="muted">
                      {restaurant.cuisine} · {restaurant.menuItemCount ?? 0} items · {restaurant.triedCount ?? 0} tried
                    </p>
                  </div>
                  <div className="pill-group">
                    <span className="pill">{isExpanded ? "▲" : "▼"}</span>
                    <span className="pill subtle">{restaurant.isShared ? "Shared" : "Owned"}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="menu-section stack-sm" style={{ padding: "0.75rem 0 0.5rem" }}>
                    {menu?.loading ? (
                      <p className="muted">Loading items…</p>
                    ) : (
                      <>
                        {menu?.items.map((item) => (
                          <MenuItemRow
                            key={item.id}
                            item={item}
                            restaurantId={restaurant.id}
                            isEditing={menu.editingItemId === item.id}
                            onStartEdit={() => setMenuStates((prev) => ({ ...prev, [restaurant.id]: { ...prev[restaurant.id], editingItemId: item.id } }))}
                            onCancelEdit={() => setMenuStates((prev) => ({ ...prev, [restaurant.id]: { ...prev[restaurant.id], editingItemId: null } }))}
                            onSave={(formData) => updateMenuItem(restaurant.id, item.id, formData)}
                            onDelete={() => deleteMenuItem(restaurant.id, item.id)}
                          />
                        ))}

                        {!menu?.showAddForm ? (
                          <button
                            className="secondary"
                            style={{ marginTop: "0.25rem", width: "fit-content" }}
                            onClick={() => setMenuStates((prev) => ({ ...prev, [restaurant.id]: { ...prev[restaurant.id], showAddForm: true } }))}
                          >
                            + Add item
                          </button>
                        ) : (
                          <AddItemForm
                            onSubmit={(formData) => addMenuItem(restaurant.id, formData)}
                            onCancel={() => setMenuStates((prev) => ({ ...prev, [restaurant.id]: { ...prev[restaurant.id], showAddForm: false } }))}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {status ? <p className="status status-neutral">{status}</p> : null}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `$${price.toFixed(2)}`;
}

type MenuItemRowProps = {
  item: MenuItem;
  restaurantId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: { name: string; category: string; price: string; description: string }) => void;
  onDelete: () => void;
};

function MenuItemRow({ item, isEditing, onStartEdit, onCancelEdit, onSave, onDelete }: MenuItemRowProps) {
  const [form, setForm] = useState({
    name: item.name,
    category: item.category ?? "",
    price: item.price != null ? String(item.price) : "",
    description: item.description ?? "",
  });

  if (isEditing) {
    return (
      <div className="card stack-xs" style={{ padding: "0.85rem" }}>
        <div className="inline-form-row">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
          <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category" />
          <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="$0.00" style={{ maxWidth: 100 }} />
        </div>
        <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
        <div className="button-row" style={{ gap: "0.5rem" }}>
          <button style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} disabled={!form.name.trim()} onClick={() => onSave(form)}>
            Save
          </button>
          <button className="secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={onCancelEdit}>
            Cancel
          </button>
          <button className="secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", color: "var(--danger)" }} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-item" style={{ cursor: "default" }} onClick={(e) => e.stopPropagation()}>
      <div>
        <span style={{ fontWeight: 600 }}>{item.name}</span>
        {item.category ? <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>{item.category}</span> : null}
        {item.price != null ? (
          <span className="pill" style={{ marginLeft: "0.5rem", fontSize: "0.78rem", padding: "0.2rem 0.5rem" }}>
            {formatPrice(item.price)}
          </span>
        ) : null}
        {item.description ? <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{item.description}</p> : null}
        {item.tried ? (
          <span className="pill subtle" style={{ fontSize: "0.75rem", marginTop: "0.25rem", display: "inline-block" }}>✓ Tried</span>
        ) : null}
      </div>
      <button className="secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", flexShrink: 0 }} onClick={onStartEdit}>
        Edit
      </button>
    </div>
  );
}

type AddItemFormProps = {
  onSubmit: (data: { name: string; category: string; price: string; description: string }) => void;
  onCancel: () => void;
};

function AddItemForm({ onSubmit, onCancel }: AddItemFormProps) {
  const [form, setForm] = useState({ name: "", category: "", price: "", description: "" });

  return (
    <div className="card stack-xs" style={{ padding: "0.85rem" }}>
      <div className="inline-form-row">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Item name (required)" />
        <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category" />
        <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="$0.00" style={{ maxWidth: 100 }} />
      </div>
      <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
      <div className="button-row" style={{ gap: "0.5rem" }}>
        <button style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} disabled={!form.name.trim()} onClick={() => onSubmit(form)}>
          Add Item
        </button>
        <button className="secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
