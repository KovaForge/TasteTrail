import type { ImportDraft, ImportSourceType, ParsedImportMenu } from "@tastetrail/shared";
import { query } from "../db/pool";
import { ApiRouteError, assert } from "../utils/errors";
import { generateId } from "../utils/ids";
import { nowIso } from "../utils/time";
import { getProviderCredentials } from "./ai-settings";
import { parseMenuWithProvider } from "../imports/ai-providers";
import { extractFromImage, extractFromText, extractFromUrl } from "../imports/content";

function tryParseJsonImport(content: string): ParsedImportMenu | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed.restaurant?.name || !parsed.restaurant?.cuisine || !Array.isArray(parsed.items)) {
      return null;
    }
    return {
      restaurant: parsed.restaurant,
      items: parsed.items.map((item: any) => ({
        name: item.name || "Unknown Item",
        category: item.category,
        price: typeof item.price === "number" ? item.price : undefined,
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags : [],
        tried: false,
        notes: "",
      })),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  } catch {
    return null;
  }
}

export async function parseImportDraft(userId: string, workspaceId: string, payload: {
  sourceType: ImportSourceType;
  sourceValue: string;
  restaurantHint?: string;
  provider?: string;
}) {
  let extracted: string;
  if (payload.sourceType === "url") {
    extracted = await extractFromUrl(payload.sourceValue);
  } else if (payload.sourceType === "image") {
    extracted = await extractFromImage(payload.sourceValue);
  } else {
    extracted = extractFromText(payload.sourceValue);
  }

  const importId = generateId();
  await query(
    `insert into menu_imports (id, workspace_id, source_type, source_value, imported_at, status)
     values ($1,$2,$3,$4,$5,'draft')`,
    [importId, workspaceId, payload.sourceType, payload.sourceValue, nowIso()],
  );

  const directParsed = tryParseJsonImport(extracted);
  if (directParsed) {
    return {
      id: importId,
      restaurant: directParsed.restaurant,
      items: directParsed.items,
      warnings: directParsed.warnings,
      meta: {
        provider: "direct",
        model: "json-import",
        sourceType: payload.sourceType,
        itemCount: directParsed.items.length,
      },
    };
  }

  const providerConfig = await getProviderCredentials(userId, payload.provider);
  if (!providerConfig) {
    throw new ApiRouteError(400, "AI provider not configured. Add your key in Settings.");
  }
  const parsed = await parseMenuWithProvider(
    providerConfig.provider,
    providerConfig.apiKey,
    providerConfig.model,
    extracted,
    payload.restaurantHint,
  );

  return {
    id: importId,
    restaurant: parsed.restaurant,
    items: parsed.items,
    warnings: parsed.warnings,
    meta: {
      provider: providerConfig.provider,
      model: providerConfig.model,
      sourceType: payload.sourceType,
      itemCount: parsed.items.length,
    },
  };
}

export async function commitImportDraft(workspaceId: string, userId: string, importId: string, draft: ImportDraft) {
  assert(draft.restaurantName?.trim(), 400, "Restaurant name is required");
  assert(draft.cuisine?.trim(), 400, "Cuisine is required");
  const selectedItems = draft.items.filter((item) => item.selected);
  assert(selectedItems.length > 0, 400, "At least one item must be selected");

  const existingRestaurant = await query<{ id: string }>(
    `select id from restaurants where workspace_id = $1 and lower(name) = lower($2) limit 1`,
    [workspaceId, draft.restaurantName.trim()],
  );

  const restaurantId = existingRestaurant.rows[0]?.id ?? generateId();
  if ((existingRestaurant.rowCount ?? 0) === 0) {
    await query(
      `insert into restaurants (id, workspace_id, name, cuisine, created_at)
       values ($1,$2,$3,$4,$5)`,
      [restaurantId, workspaceId, draft.restaurantName.trim(), draft.cuisine.trim(), nowIso()],
    );
  }

  const items = [];
  for (const item of selectedItems) {
    const itemId = generateId();
    await query(
      `insert into menu_items (id, restaurant_id, workspace_id, name, category, price, description, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [itemId, restaurantId, workspaceId, item.name.trim(), item.category?.trim() || null, item.price ?? null, item.description?.trim() || null, nowIso()],
    );
    items.push({
      id: itemId,
      restaurantId,
      workspaceId,
      name: item.name.trim(),
      category: item.category?.trim() || null,
      price: item.price ?? null,
      description: item.description?.trim() || null,
      tried: false,
      tags: [],
      createdAt: nowIso(),
    });
  }

  await query(`update menu_imports set status = 'committed' where id = $1`, [importId]);

  return {
    restaurantId,
    items,
  };
}
