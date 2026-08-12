#!/usr/bin/env node
/**
 * Sync server.json (MCP Registry manifest) with package.json.
 * Keeps `version` (top-level + npm package entry) and `mcpName` consistent so
 * `npm version` / `npm publish` / `mcp-publisher publish` never drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const manifestPath = path.join(root, "server.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!pkg.mcpName) {
  console.error("package.json is missing `mcpName` — required for MCP Registry npm ownership validation.");
  process.exit(1);
}

manifest.name = pkg.mcpName;
manifest.version = pkg.version;
for (const p of manifest.packages ?? []) {
  if (p.registryType === "npm" && p.identifier === pkg.name) p.version = pkg.version;
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`server.json synced: ${manifest.name}@${manifest.version}`);

