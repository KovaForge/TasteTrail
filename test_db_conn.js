import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testConnection() {
  console.log('Reading local.settings.json...');
  try {
    const settingsPath = path.join(__dirname, 'api', 'local.settings.json');
    if (!fs.existsSync(settingsPath)) {
        console.error('ERROR: local.settings.json not found at', settingsPath);
        return;
    }
    
    // Manually parse local.settings.json
    const fileContent = fs.readFileSync(settingsPath, 'utf8');
    // Simple json parse might fail if there are comments but local.settings.json is usually pure json
    const settings = JSON.parse(fileContent);

    const connectionString = settings.Values.DATABASE_URL;

    if (!connectionString) {
      console.error('ERROR: DATABASE_URL not found in local.settings.json');
      return;
    }

    console.log('Length of connection string:', connectionString.length);
    console.log('Connecting to Neon...');
    
    const sql = neon(connectionString);
    const result = await sql`SELECT version(), now()`;
    
    console.log('✅ Connection Successful!');
    console.log('Database Version:', result[0].version);
    console.log('Server Time:', result[0].now);
    
  } catch (error) {
    console.error('❌ Connection Failed:', error);
    if (error.cause) console.error('Cause:', error.cause);
  }
}

testConnection();
