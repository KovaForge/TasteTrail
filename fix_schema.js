
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fixSchema() {
  const settingsPath = path.join(__dirname, 'api', 'local.settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const databaseUrl = settings.Values.DATABASE_URL;

  const sql = neon(databaseUrl);

  console.log('Fixing workspace_members table schema for Azure SWA compatibility...');
  
  try {
    // We change the columns to VARCHAR(255) to support Azure SWA's user IDs
    // We drop the primary key first, change types, then re-add it
    await sql.query('ALTER TABLE workspace_members DROP CONSTRAINT workspace_members_pkey');
    await sql.query('ALTER TABLE workspace_members ALTER COLUMN user_id TYPE VARCHAR(255)');
    await sql.query('ALTER TABLE workspace_members ALTER COLUMN added_by_user_id TYPE VARCHAR(255)');
    await sql.query('ALTER TABLE workspace_members ADD PRIMARY KEY (user_id, workspace_id)');

    console.log('Schema fix completed successfully!');
  } catch (error) {
    console.error('Schema fix failed:', error);
    // If it failed because columns are already VARCHAR, that's fine
  }
}

fixSchema();
