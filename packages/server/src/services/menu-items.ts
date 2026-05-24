import type { MenuItem, MenuItemFormData } from "@tastetrail/shared";
import { query } from "../db/pool";
import { ApiRouteError, assert } from "../utils/errors";
import { generateId } from "../utils/ids";
import { nowIso } from "../utils/time";

function normalizeTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function listMenuItems(userId: string, restaurantId: string): Promise<MenuItem[]> {
  const result = await query<{
    id: string;
    restaurant_id: string;
    workspace_id: string;
    name: string;
    category: string | null;
    price: string | null;
    description: string | null;
    created_at: string;
    tried: boolean;
    last_tried_date: string | null;
    rating: number | null;
    notes: string | null;
    tags: unknown;
  }>(
    `select
      mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
      coalesce(us.tried, false) as tried,
      us.last_tried_date,
      us.rating,
      us.notes,
      coalesce(us.tags, '[]'::jsonb) as tags
     from menu_items mi
     left join user_menu_item_state us on us.menu_item_id = mi.id and us.user_id = $1
     where mi.restaurant_id = $2
     order by mi.category nulls last, mi.name asc`,
    [userId, restaurantId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    restaurantId: row.restaurant_id,
    workspaceId: row.workspace_id,
    name: row.name,
    category: row.category,
    price: row.price ? Number(row.price) : null,
    description: row.description,
    tried: row.tried,
    lastTriedDate: row.last_tried_date,
    rating: row.rating,
    notes: row.notes,
    tags: normalizeTags(row.tags),
    createdAt: row.created_at,
  }));
}

export async function createMenuItem(userId: string, restaurantId: string, data: MenuItemFormData): Promise<MenuItem> {
  assert(data.name?.trim(), 400, "Item name is required");
  const restaurant = await query<{ workspace_id: string }>(`select workspace_id from restaurants where id = $1`, [restaurantId]);
  if ((restaurant.rowCount ?? 0) === 0) {
    throw new ApiRouteError(404, "Restaurant not found");
  }
  const workspaceId = restaurant.rows[0].workspace_id;
  const membership = await query(`select role from workspace_members where user_id = $1 and workspace_id = $2`, [userId, workspaceId]);
  if ((membership.rowCount ?? 0) === 0) {
    throw new ApiRouteError(403, "You do not have permission to add items to this restaurant");
  }

  const id = generateId();
  const createdAt = nowIso();
  await query(
    `insert into menu_items (id, restaurant_id, workspace_id, name, category, price, description, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, restaurantId, workspaceId, data.name.trim(), data.category?.trim() || null, data.price ?? null, data.description?.trim() || null, createdAt],
  );
  if (data.tried) {
    await query(
      `insert into menu_item_tried_history (id, user_id, menu_item_id, tried_date, notes, created_at)
       values ($1,$2,$3,$4,$5,$4)`,
      [generateId(), userId, id, createdAt, data.notes?.trim() || null],
    );
    await query(
      `insert into user_menu_item_state (user_id, menu_item_id, tried, last_tried_date, rating, notes, tags, updated_at)
       values ($1,$2,true,$3,$4,$5,$6::jsonb,$3)
       on conflict (user_id, menu_item_id) do update set
         tried = true,
         last_tried_date = $3,
         rating = $4,
         notes = $5,
         tags = $6::jsonb,
         updated_at = $3`,
      [userId, id, createdAt, data.rating ?? null, data.notes?.trim() || null, JSON.stringify(data.tags ?? [])],
    );
  }
  return {
    id,
    restaurantId,
    workspaceId,
    name: data.name.trim(),
    category: data.category?.trim() || null,
    price: data.price ?? null,
    description: data.description?.trim() || null,
    tried: data.tried ?? false,
    rating: data.rating ?? null,
    notes: data.notes?.trim() || null,
    tags: data.tags ?? [],
    createdAt,
  };
}

export async function getMenuItem(userId: string, id: string): Promise<MenuItem> {
  const result = await query<{
    id: string;
    restaurant_id: string;
    workspace_id: string;
    name: string;
    category: string | null;
    price: string | null;
    description: string | null;
    created_at: string;
    tried: boolean;
    last_tried_date: string | null;
    rating: number | null;
    notes: string | null;
    tags: unknown;
  }>(
    `select
      mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
      coalesce(us.tried, false) as tried,
      us.last_tried_date,
      us.rating,
      us.notes,
      coalesce(us.tags, '[]'::jsonb) as tags
     from menu_items mi
     left join user_menu_item_state us on us.menu_item_id = mi.id and us.user_id = $1
     where mi.id = $2`,
    [userId, id],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new ApiRouteError(404, "Menu item not found");
  }
  const history = await query<{ id: string; tried_date: string; notes: string | null }>(
    `select id, tried_date, notes
     from menu_item_tried_history
     where user_id = $1 and menu_item_id = $2
     order by tried_date desc`,
    [userId, id],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    workspaceId: row.workspace_id,
    name: row.name,
    category: row.category,
    price: row.price ? Number(row.price) : null,
    description: row.description,
    tried: row.tried,
    lastTriedDate: row.last_tried_date,
    rating: row.rating,
    notes: row.notes,
    tags: normalizeTags(row.tags),
    history: history.rows.map((entry) => ({
      id: entry.id,
      triedDate: entry.tried_date,
      notes: entry.notes,
    })),
    createdAt: row.created_at,
  };
}

export async function updateMenuItem(userId: string, id: string, data: Partial<MenuItemFormData & { lastTriedDate?: string | null }>) {
  const existing = await query<{ workspace_id: string; restaurant_id: string }>(
    `select workspace_id, restaurant_id from menu_items where id = $1`,
    [id],
  );
  if ((existing.rowCount ?? 0) === 0) {
    throw new ApiRouteError(404, "Menu item not found");
  }
  const workspaceId = existing.rows[0].workspace_id;
  const restaurantId = existing.rows[0].restaurant_id;
  const membership = await query<{ role: string }>(`select role from workspace_members where user_id = $1 and workspace_id = $2`, [userId, workspaceId]);
  let canEditDefinition = false;
  if ((membership.rowCount ?? 0) === 0) {
    const share = await query(`select 1 from shared_restaurants where restaurant_id = $1 and user_id = $2`, [restaurantId, userId]);
    if ((share.rowCount ?? 0) === 0) {
      throw new ApiRouteError(403, "No access to this menu item");
    }
  } else {
    canEditDefinition = membership.rows[0].role === "Owner" || membership.rows[0].role === "Editor";
  }

  if (canEditDefinition && (data.name !== undefined || data.category !== undefined || data.price !== undefined || data.description !== undefined)) {
    await query(
      `update menu_items
       set name = coalesce($2, name),
           category = coalesce($3, category),
           price = coalesce($4, price),
           description = coalesce($5, description)
       where id = $1`,
      [id, data.name?.trim() ?? null, data.category?.trim() ?? null, data.price ?? null, data.description?.trim() ?? null],
    );
  }

  if (data.tried !== undefined || data.lastTriedDate !== undefined || data.rating !== undefined || data.notes !== undefined || data.tags !== undefined) {
    const updatedAt = nowIso();
    await query(
      `insert into user_menu_item_state (user_id, menu_item_id, tried, last_tried_date, rating, notes, tags, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       on conflict (user_id, menu_item_id) do update set
         tried = coalesce(excluded.tried, user_menu_item_state.tried),
         last_tried_date = coalesce(excluded.last_tried_date, user_menu_item_state.last_tried_date),
         rating = coalesce(excluded.rating, user_menu_item_state.rating),
         notes = coalesce(excluded.notes, user_menu_item_state.notes),
         tags = coalesce(excluded.tags, user_menu_item_state.tags),
         updated_at = excluded.updated_at`,
      [
        userId,
        id,
        data.tried ?? false,
        data.lastTriedDate ?? null,
        data.rating ?? null,
        data.notes?.trim() ?? null,
        JSON.stringify(data.tags ?? []),
        updatedAt,
      ],
    );
    if (data.tried === true) {
      await query(
        `insert into menu_item_tried_history (id, user_id, menu_item_id, tried_date, created_at)
         values ($1,$2,$3,$4,$4)`,
        [generateId(), userId, id, data.lastTriedDate ?? updatedAt],
      );
    }
  }

  return getMenuItem(userId, id);
}

export async function deleteMenuItem(userId: string, id: string) {
  const result = await query<{ workspace_id: string }>(`select workspace_id from menu_items where id = $1`, [id]);
  if ((result.rowCount ?? 0) === 0) {
    return;
  }
  const membership = await query<{ role: string }>(`select role from workspace_members where user_id = $1 and workspace_id = $2`, [userId, result.rows[0].workspace_id]);
  if ((membership.rowCount ?? 0) === 0 || !["Owner", "Editor"].includes(membership.rows[0].role)) {
    throw new ApiRouteError(403, "Only Owners and Editors can delete menu items");
  }
  await query(`delete from menu_items where id = $1`, [id]);
}

export async function addTriedHistory(userId: string, id: string, notes?: string | null) {
  const existing = await query<{ workspace_id: string; restaurant_id: string }>(`select workspace_id, restaurant_id from menu_items where id = $1`, [id]);
  if ((existing.rowCount ?? 0) === 0) {
    throw new ApiRouteError(404, "Menu item not found");
  }
  const historyId = generateId();
  const triedDate = nowIso();
  await query(
    `insert into menu_item_tried_history (id, user_id, menu_item_id, tried_date, notes, created_at)
     values ($1,$2,$3,$4,$5,$4)`,
    [historyId, userId, id, triedDate, notes?.trim() || null],
  );
  await query(
    `insert into user_menu_item_state (user_id, menu_item_id, tried, last_tried_date, updated_at)
     values ($1,$2,true,$3,$3)
     on conflict (user_id, menu_item_id) do update set
       tried = true,
       last_tried_date = $3,
       updated_at = $3`,
    [userId, id, triedDate],
  );
  return { id: historyId, triedDate, notes: notes?.trim() || null };
}

export async function getTriedHistory(userId: string, id: string) {
  const result = await query<{ id: string; tried_date: string; notes: string | null; created_at: string }>(
    `select id, tried_date, notes, created_at
     from menu_item_tried_history
     where user_id = $1 and menu_item_id = $2
     order by tried_date desc`,
    [userId, id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    triedDate: row.tried_date,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}
