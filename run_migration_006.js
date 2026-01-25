import { Client } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const localSettingsPath = path.join(__dirname, 'api', 'local.settings.json');
let connectionString = process.env.DATABASE_URL;

if (fs.existsSync(localSettingsPath)) {
    const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
    connectionString = settings.Values.DATABASE_URL;
}

if (!connectionString) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

const client = new Client(connectionString);

async function runMigration() {
    console.log('Checking migration 006 (tried history)...');

    const migrationPath = path.join(__dirname, 'db', 'migrations', '006_tried_history.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    try {
        await client.connect();
        console.log('Running migration 006...');
        await client.query(migrationSql);
        console.log('Migration 006 applied successfully.');
    } catch (error) {
        if (error.code === '42P07') { // duplicate_table
            console.log('Table menu_item_tried_history already exists. Migration assumed applied.');
        } else if (error.message && error.message.includes('already exists')) {
            console.log('Object already exists. Migration assumed applied.');
        } else {
            console.error('Error applying migration:', error);
        }
    } finally {
        await client.end();
    }
}

runMigration();
