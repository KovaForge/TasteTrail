
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function checkUser() {
  const settingsPath = path.join(__dirname, 'api', 'local.settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const databaseUrl = settings.Values.DATABASE_URL;

  const sql = neon(databaseUrl);
  const email = 'live.ungodly500@passmail.net';

  console.log(`Checking if user ${email} exists in workspace_members...`);
  
  try {
    const members = await sql`
      SELECT * FROM workspace_members 
      WHERE email = ${email.toLowerCase()}
    `;

    if (members.length > 0) {
      console.log('User found!');
      console.log(JSON.stringify(members, null, 2));
      
      // Also check workspace details
      const workspaceIds = members.map(m => m.workspace_id);
      const workspaces = await sql`
        SELECT * FROM workspaces 
        WHERE id = ANY(${workspaceIds})
      `;
      console.log('Workspaces associated with user:');
      console.log(JSON.stringify(workspaces, null, 2));
    } else {
      console.log('User not found in the database.');
    }
  } catch (error) {
    console.error('Query failed:', error);
  }
}

checkUser();
