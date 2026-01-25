
import { Client } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  try {
      // Read local.settings.json
      const settingsPath = path.join(__dirname, 'api', 'local.settings.json');
      if (!fs.existsSync(settingsPath)) {
          throw new Error('api/local.settings.json not found');
      }
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const databaseUrl = settings.Values.DATABASE_URL;
      if (!databaseUrl) {
          throw new Error('DATABASE_URL not found in local.settings.json');
      }

      // Read migration file
      const migrationPath = path.join(__dirname, 'db', 'migrations', '006_tried_history.sql');
      if (!fs.existsSync(migrationPath)) {
          throw new Error('Migration file 006 not found');
      }
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      // Connect and execute
      console.log('Connecting to database...');
      const client = new Client(databaseUrl);
      await client.connect();
      
      try {
        console.log('Running migration 004...');
        await client.query(migrationSql);
        console.log('Migration successful!');
      } catch (err) {
        console.error('Migration failed:', err.message);
      } finally {
        await client.end();
      }
  } catch (err) {
      console.error('Setup failed:', err.message);
  }
}

runMigration();
