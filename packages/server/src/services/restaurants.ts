import type { Restaurant, RestaurantFormData } from "@tastetrail/shared";
import { query } from "../db/pool";
import { ApiRouteError, assert } from "../utils/errors";
import { generateId } from "../utils/ids";
import { nowIso } from "../utils/time";

export async function listRestaurants(userId: string, workspaceId?: string | null): Promise<Restaurant[]> {
  const result = await query<{
    id: string;
    workspace_id: string;
    name: string;
    cuisine: string;
    address_suburb: string | null;
    notes: string | null;
    last_visited_date: string | null;
    created_at: string;
    owner_name: string | null;
    is_shared: boolean;
    is_direct_share: boolean;
    menu_item_count: string;
    tried_count: string;
  }>(
    `select
      r.id,
      r.workspace_id,
      r.name,
      r.cuisine,
      r.address_suburb,
      r.notes,
      r.last_visited_date,
      r.created_at,
      w.name as owner_name,
      case
        when sr.user_id is not null then true
        when $2::uuid is null or r.workspace_id = $2::uuid then false
        else true
      end as is_shared,
      case when sr.user_id is not null then true else false end as is_direct_share,
      count(mi.id)::text as menu_item_count,
      count(case when us.tried = true then 1 end)::text as tried_count
    from restaurants r
    join workspaces w on w.id = r.workspace_id
    left join workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = $1
    left join shared_restaurants sr on sr.restaurant_id = r.id and sr.user_id = $1
    left join menu_items mi on mi.restaurant_id = r.id
    left join user_menu_item_state us on us.menu_item_id = mi.id and us.user_id = $1
    where wm.user_id is not null or sr.user_id is not null
    group by r.id, w.name, r.workspace_id, sr.user_id
    order by r.name asc`,
    [userId, workspaceId ?? null],
  );

  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    cuisine: row.cuisine,
    addressSuburb: row.address_suburb,
    notes: row.notes,
    lastVisitedDate: row.last_visited_date,
    createdAt: row.created_at,
    ownerName: row.owner_name,
    isShared: row.is_shared,
    isDirectShare: row.is_direct_share,
    menuItemCount: Number(row.menu_item_count),
    triedCount: Number(row.tried_count),
  }));
}

export async function createRestaurant(workspaceId: string, data: RestaurantFormData): Promise<Restaurant> {
  assert(data.name?.trim(), 400, "Restaurant name is required");
  assert(data.cuisine?.trim(), 400, "Cuisine is required");
  const id = generateId();
  const createdAt = nowIso();
  await query(
    `insert into restaurants (id, workspace_id, name, cuisine, address_suburb, notes, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, workspaceId, data.name.trim(), data.cuisine.trim(), data.addressSuburb?.trim() || null, data.notes?.trim() || null, createdAt],
  );
  return {
    id,
    workspaceId,
    name: data.name.trim(),
    cuisine: data.cuisine.trim(),
    addressSuburb: data.addressSuburb?.trim() || null,
    notes: data.notes?.trim() || null,
    createdAt,
    isShared: false,
  };
}

export async function getRestaurant(id: string) {
  const result = await query<{
    id: string;
    workspace_id: string;
    name: string;
    cuisine: string;
    address_suburb: string | null;
    notes: string | null;
    last_visited_date: string | null;
    created_at: string;
  }>(
    `select id, workspace_id, name, cuisine, address_suburb, notes, last_visited_date, created_at
     from restaurants where id = $1`,
    [id],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new ApiRouteError(404, "Restaurant not found");
  }
  const row = result.rows[0];
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    cuisine: row.cuisine,
    addressSuburb: row.address_suburb,
    notes: row.notes,
    lastVisitedDate: row.last_visited_date,
    createdAt: row.created_at,
    isShared: false,
  } satisfies Restaurant;
}

export async function updateRestaurant(id: string, data: Partial<RestaurantFormData & { lastVisitedDate?: string | null }>) {
  const existing = await getRestaurant(id);
  const name = data.name?.trim() ?? existing.name;
  const cuisine = data.cuisine?.trim() ?? existing.cuisine;
  await query(
    `update restaurants
     set name = $2, cuisine = $3, address_suburb = $4, notes = $5, last_visited_date = $6
     where id = $1`,
    [
      id,
      name,
      cuisine,
      data.addressSuburb !== undefined ? data.addressSuburb.trim() || null : existing.addressSuburb ?? null,
      data.notes !== undefined ? data.notes.trim() || null : existing.notes ?? null,
      data.lastVisitedDate !== undefined ? data.lastVisitedDate : existing.lastVisitedDate ?? null,
    ],
  );
  return getRestaurant(id);
}

export async function deleteRestaurant(id: string) {
  await query(`delete from restaurants where id = $1`, [id]);
}
