import type { SearchResult, StatsResponse } from "@tastetrail/shared";
import { query } from "../db/pool";

export async function searchWorkspace(userId: string, workspaceId: string, filters: { query: string; tried?: boolean; minRating?: number }): Promise<SearchResult> {
  const searchTerm = `%${filters.query.trim().toLowerCase()}%`;
  const restaurants = await query<{
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
     from restaurants
     where workspace_id = $1
       and (lower(name) like $2 or lower(cuisine) like $2)
     order by name asc
     limit 20`,
    [workspaceId, searchTerm],
  );

  const params: unknown[] = [userId, workspaceId, searchTerm];
  const conditions = [`mi.workspace_id = $2`, `lower(mi.name) like $3`];
  if (filters.tried === true) {
    conditions.push(`us.tried = true`);
  } else if (filters.tried === false) {
    conditions.push(`(us.tried is null or us.tried = false)`);
  }
  if (filters.minRating) {
    params.push(filters.minRating);
    conditions.push(`us.rating >= $${params.length}`);
  }

  const menuItems = await query<{
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
    tags: string[];
  }>(
    `select
      mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
      coalesce(us.tried, false) as tried, us.last_tried_date, us.rating, us.notes,
      coalesce(us.tags, '[]'::jsonb) as tags
     from menu_items mi
     left join user_menu_item_state us on us.menu_item_id = mi.id and us.user_id = $1
     where ${conditions.join(" and ")}
     order by mi.name asc
     limit 50`,
    params,
  );

  return {
    restaurants: restaurants.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      cuisine: row.cuisine,
      addressSuburb: row.address_suburb,
      notes: row.notes,
      lastVisitedDate: row.last_visited_date,
      createdAt: row.created_at,
      isShared: false,
    })),
    menuItems: menuItems.rows.map((row) => ({
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
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
    })),
  };
}

export async function getCuisineStats(userId: string, workspaceId: string, scope: "tried" | "all", countBy: "restaurants" | "items"): Promise<StatsResponse> {
  let rows: Array<{ cuisine: string; count: string }> = [];
  if (countBy === "restaurants") {
    if (scope === "tried") {
      rows = (
        await query<{ cuisine: string; count: string }>(
          `select r.cuisine, count(distinct r.id)::text as count
           from restaurants r
           inner join menu_items mi on mi.restaurant_id = r.id
           inner join user_menu_item_state us on us.menu_item_id = mi.id and us.user_id = $1
           where r.workspace_id = $2 and us.tried = true
           group by r.cuisine
           order by count desc`,
          [userId, workspaceId],
        )
      ).rows;
    } else {
      rows = (
        await query<{ cuisine: string; count: string }>(
          `select cuisine, count(*)::text as count
           from restaurants
           where workspace_id = $1
           group by cuisine
           order by count desc`,
          [workspaceId],
        )
      ).rows;
    }
  } else if (scope === "tried") {
    rows = (
      await query<{ cuisine: string; count: string }>(
        `select r.cuisine, count(mi.id)::text as count
         from menu_items mi
         inner join restaurants r on r.id = mi.restaurant_id
         inner join user_menu_item_state us on us.menu_item_id = mi.id and us.user_id = $1
         where mi.workspace_id = $2 and us.tried = true
         group by r.cuisine
         order by count desc`,
        [userId, workspaceId],
      )
    ).rows;
  } else {
    rows = (
      await query<{ cuisine: string; count: string }>(
        `select r.cuisine, count(mi.id)::text as count
         from menu_items mi
         inner join restaurants r on r.id = mi.restaurant_id
         where mi.workspace_id = $1
         group by r.cuisine
         order by count desc`,
        [workspaceId],
      )
    ).rows;
  }

  const totalCount = rows.reduce((sum, row) => sum + Number(row.count), 0);
  return {
    totalCount,
    rows: rows.map((row) => ({
      cuisine: row.cuisine,
      count: Number(row.count),
      percent: totalCount > 0 ? (Number(row.count) / totalCount) * 100 : 0,
    })),
  };
}
