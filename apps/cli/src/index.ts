#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type CliConfig = {
  baseUrl: string;
  token?: string;
};

const CONFIG_PATH = path.join(os.homedir(), ".tastetrail", "config.json");

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function readConfig(): Promise<CliConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return {
      baseUrl: process.env.TASTETRAIL_BASE_URL || "http://localhost:3000",
      token: process.env.TASTETRAIL_TOKEN,
    };
  }
}

async function writeConfig(config: CliConfig) {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, true);
      continue;
    }
    flags.set(key, next);
    i += 1;
  }
  return { positionals, flags };
}

async function request<T>(config: CliConfig, pathname: string, init: RequestInit = {}, workspaceId?: string) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (config.token) {
    headers.set("Authorization", `Bearer ${config.token}`);
  }
  if (workspaceId) {
    headers.set("x-workspace-id", workspaceId);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(new URL(pathname, config.baseUrl), {
    ...init,
    headers,
  });
  const data = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

function getRequired(flags: Map<string, string | boolean>, name: string) {
  const value = flags.get(name);
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const [group = "help", command] = positionals;
  const config = await readConfig();

  if (group === "auth" && command === "login") {
    const token = getRequired(flags, "token");
    const baseUrl = (flags.get("base-url") as string | undefined) || config.baseUrl;
    await writeConfig({ baseUrl, token });
    printJson({ success: true, baseUrl });
    return;
  }

  if (group === "auth" && command === "whoami") {
    printJson(await request(config, "/api/auth/status"));
    return;
  }

  if (group === "workspaces" && command === "list") {
    printJson(await request(config, "/api/workspaces"));
    return;
  }

  if (group === "workspaces" && command === "create") {
    const name = getRequired(flags, "name");
    printJson(await request(config, "/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }));
    return;
  }

  if (group === "workspaces" && command === "members") {
    const workspaceId = getRequired(flags, "workspace-id");
    printJson(await request(config, `/api/workspaces/${workspaceId}/members`));
    return;
  }

  if (group === "restaurants" && command === "list") {
    const workspaceId = (flags.get("workspace-id") as string | undefined) || undefined;
    printJson(await request(config, "/api/restaurants", {}, workspaceId));
    return;
  }

  if (group === "restaurants" && command === "create") {
    const workspaceId = getRequired(flags, "workspace-id");
    const name = getRequired(flags, "name");
    const cuisine = getRequired(flags, "cuisine");
    const addressSuburb = flags.get("address-suburb");
    const notes = flags.get("notes");
    printJson(
      await request(
        config,
        "/api/restaurants",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            cuisine,
            addressSuburb: typeof addressSuburb === "string" ? addressSuburb : undefined,
            notes: typeof notes === "string" ? notes : undefined,
          }),
        },
        workspaceId,
      ),
    );
    return;
  }

  if (group === "menu-items" && command === "list") {
    const restaurantId = getRequired(flags, "restaurant-id");
    printJson(await request(config, `/api/restaurants/${restaurantId}/menu-items`));
    return;
  }

  if (group === "menu-items" && command === "create") {
    const restaurantId = getRequired(flags, "restaurant-id");
    const name = getRequired(flags, "name");
    const category = flags.get("category");
    const description = flags.get("description");
    const price = flags.get("price");
    printJson(
      await request(config, `/api/restaurants/${restaurantId}/menu-items`, {
        method: "POST",
        body: JSON.stringify({
          name,
          category: typeof category === "string" ? category : undefined,
          description: typeof description === "string" ? description : undefined,
          price: typeof price === "string" ? Number(price) : undefined,
        }),
      }),
    );
    return;
  }

  if (group === "imports" && command === "parse") {
    const workspaceId = getRequired(flags, "workspace-id");
    const sourceType = getRequired(flags, "source-type");
    const sourceValue = getRequired(flags, "source-value");
    printJson(
      await request(
        config,
        "/api/imports/parse",
        {
          method: "POST",
          body: JSON.stringify({
            sourceType,
            sourceValue,
            restaurantHint: typeof flags.get("restaurant-hint") === "string" ? flags.get("restaurant-hint") : undefined,
            provider: typeof flags.get("provider") === "string" ? flags.get("provider") : undefined,
          }),
        },
        workspaceId,
      ),
    );
    return;
  }

  if (group === "imports" && command === "commit") {
    const workspaceId = getRequired(flags, "workspace-id");
    const importId = getRequired(flags, "import-id");
    const draftFile = getRequired(flags, "draft-file");
    const draft = JSON.parse(await fs.readFile(draftFile, "utf8"));
    printJson(
      await request(
        config,
        `/api/imports/${importId}/commit`,
        {
          method: "POST",
          body: JSON.stringify(draft),
        },
        workspaceId,
      ),
    );
    return;
  }

  if (group === "search" && command === "query") {
    const workspaceId = getRequired(flags, "workspace-id");
    const queryText = getRequired(flags, "q");
    printJson(await request(config, `/api/search?q=${encodeURIComponent(queryText)}`, {}, workspaceId));
    return;
  }

  if (group === "stats" && command === "cuisines") {
    const workspaceId = getRequired(flags, "workspace-id");
    const scope = (flags.get("scope") as string | undefined) || "tried";
    const countBy = (flags.get("count-by") as string | undefined) || "restaurants";
    printJson(await request(config, `/api/stats/cuisines?scope=${encodeURIComponent(scope)}&countBy=${encodeURIComponent(countBy)}`, {}, workspaceId));
    return;
  }

  if (group === "debug" && command === "logs") {
    const workspaceId = (flags.get("workspace-id") as string | undefined) || undefined;
    printJson(await request(config, "/api/debug-logs", {}, workspaceId));
    return;
  }

  if (group === "cli-tokens" && command === "create") {
    const label = getRequired(flags, "label");
    printJson(await request(config, "/api/cli-tokens", { method: "POST", body: JSON.stringify({ label }) }));
    return;
  }

  printJson({
    usage: [
      "tastetrail auth login --token <token> [--base-url <url>]",
      "tastetrail auth whoami",
      "tastetrail workspaces list",
      "tastetrail workspaces create --name <name>",
      "tastetrail workspaces members --workspace-id <id>",
      "tastetrail restaurants list [--workspace-id <id>]",
      "tastetrail restaurants create --workspace-id <id> --name <name> --cuisine <cuisine>",
      "tastetrail menu-items list --restaurant-id <id>",
      "tastetrail menu-items create --restaurant-id <id> --name <name>",
      "tastetrail imports parse --workspace-id <id> --source-type <text|url|image> --source-value <value>",
      "tastetrail imports commit --workspace-id <id> --import-id <id> --draft-file <path>",
      "tastetrail search query --workspace-id <id> --q <term>",
      "tastetrail stats cuisines --workspace-id <id> [--scope tried|all] [--count-by restaurants|items]",
      "tastetrail debug logs [--workspace-id <id>]",
      "tastetrail cli-tokens create --label <label>"
    ]
  });
}

main().catch((error) => {
  printJson({
    error: true,
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
