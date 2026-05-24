import { query } from "../db/pool";
import { nowIso } from "../utils/time";

export async function claimLegacyMicrosoftData(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const oldIdsResult = await query<{ user_id: string }>(
    `select distinct user_id
     from workspace_members
     where lower(email) = $1 and user_id <> $2`,
    [normalizedEmail, userId],
  );

  const oldUserIds = oldIdsResult.rows.map((row) => row.user_id);
  if (oldUserIds.length === 0) {
    return { migrated: false, oldUserIds: [] as string[] };
  }

  for (const oldUserId of oldUserIds) {
    await query(
      `insert into workspace_members (user_id, workspace_id, role, email, pending, added_at, added_by_user_id)
       select $2, workspace_id, role, email, pending, added_at, case when added_by_user_id = $1 then $2 else added_by_user_id end
       from workspace_members
       where user_id = $1
       on conflict (user_id, workspace_id) do nothing`,
      [oldUserId, userId],
    );
    await query(`delete from workspace_members where user_id = $1`, [oldUserId]);

    await query(
      `insert into user_ai_settings (user_id, workspace_id, provider, encrypted_api_key, nonce, model, created_at, updated_at)
       select $2, workspace_id, provider, encrypted_api_key, nonce, model, created_at, updated_at
       from user_ai_settings
       where user_id = $1
       on conflict (user_id, provider) do nothing`,
      [oldUserId, userId],
    );
    await query(`delete from user_ai_settings where user_id = $1`, [oldUserId]);

    await query(
      `insert into user_menu_item_state (user_id, menu_item_id, tried, last_tried_date, rating, notes, tags, updated_at)
       select $2, menu_item_id, tried, last_tried_date, rating, notes, tags, updated_at
       from user_menu_item_state
       where user_id = $1
       on conflict (user_id, menu_item_id) do nothing`,
      [oldUserId, userId],
    );
    await query(`delete from user_menu_item_state where user_id = $1`, [oldUserId]);

    await query(
      `insert into menu_item_tried_history (id, user_id, menu_item_id, tried_date, notes, created_at)
       select id, $2, menu_item_id, tried_date, notes, created_at
       from menu_item_tried_history
       where user_id = $1`,
      [oldUserId, userId],
    );
    await query(`delete from menu_item_tried_history where user_id = $1`, [oldUserId]);

    await query(`update share_tokens set created_by = $2 where created_by = $1`, [oldUserId, userId]);
    await query(`update shared_restaurants set shared_by = $2 where shared_by = $1`, [oldUserId, userId]);
    await query(`update shared_restaurants set user_id = $2 where user_id = $1`, [oldUserId, userId]);

    await query(
      `insert into legacy_identity_links (id, legacy_provider, legacy_subject, legacy_email, user_id, migrated_at)
       values (gen_random_uuid(), 'microsoft', $1, $2, $3, $4)`,
      [oldUserId, normalizedEmail, userId, nowIso()],
    );
  }

  return {
    migrated: true,
    oldUserIds,
  };
}
