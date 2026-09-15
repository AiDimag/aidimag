#!/usr/bin/env node
/**
 * Build-time icon fetcher.
 *
 * Reads src/ui/icons.config.json, loads SVGs from the committed .icon-cache/
 * directory, and generates src/ui/icons-generated.ts with inline SVG constants.
 *
 * The .icon-cache/ directory is committed to git so CI never needs network access.
 * To add or update icons, run with --force to re-fetch from the Iconify API.
 *
 * Usage:
 *   node scripts/fetch-icons.mjs          # use committed cache, generate if missing
 *   node scripts/fetch-icons.mjs --force  # re-fetch all icons from Iconify API
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(ROOT, "src", "ui", "icons.config.json");
const CACHE_DIR = path.join(ROOT, ".icon-cache");
const OUTPUT_PATH = path.join(ROOT, "src", "ui", "icons-generated.ts");

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");

function fetchSvg(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchSvgWithRetry(url, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchSvg(url);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = 2000 * Math.pow(2, attempt);
      process.stderr.write(`retry in ${delay}ms ... `);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

function cacheFile(iconId, color) {
  const colorSuffix = color ? "--" + color.replace(/[^a-zA-Z0-9]/g, "") : "";
  return path.join(CACHE_DIR, iconId.replace(/[:/]/g, "--") + colorSuffix + ".svg");
}

async function getSvg(iconId, color) {
  const cfile = cacheFile(iconId, color);
  if (!FORCE && fs.existsSync(cfile)) {
    return fs.readFileSync(cfile, "utf8");
  }
  if (!FORCE) {
    throw new Error(`Icon "${iconId}" not in cache. Run with --force to fetch from the Iconify API.`);
  }
  let url = `https://api.iconify.design/${iconId}.svg`;
  if (color) url += `?color=${encodeURIComponent(color)}`;
  process.stderr.write(`  fetching ${iconId}${color ? " (" + color + ")" : ""} ... `);
  const svg = await fetchSvgWithRetry(url);
  process.stderr.write("ok\n");
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cfile, svg);
  await new Promise((r) => setTimeout(r, 500));
  return svg;
}

function parseSvg(svg) {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!innerMatch) throw new Error("Could not parse SVG inner content");
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";
  const inner = innerMatch[1].trim();
  return { viewBox, inner };
}

function escapeForTemplateLiteral(str) {
  return str.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

async function main() {
  // Skip if generated file exists and not forced — the generated file is committed.
  if (!FORCE && fs.existsSync(OUTPUT_PATH)) {
    console.log(`Icons up to date (skipping). Use --force to re-fetch from API.`);
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const entries = Object.entries(config);

  // Normalize specs: string "iconId" or object { icon, color }
  const specs = {};
  for (const [name, spec] of entries) {
    if (typeof spec === "string") {
      if (spec.startsWith("=")) continue; // alias
      specs[name] = { icon: spec, color: null };
    } else {
      if (!spec.icon) {
        console.error(`Error: icon "${name}" is missing "icon" property. Got: ${JSON.stringify(spec)}`);
        process.exit(1);
      }
      specs[name] = { icon: spec.icon, color: spec.color || null };
    }
  }

  // Collect all SVGs (dedup by icon+color)
  const svgCache = {};
  for (const [name, { icon, color }] of Object.entries(specs)) {
    const key = icon + (color ? "|" + color : "");
    if (!svgCache[key]) {
      svgCache[key] = await getSvg(icon, color);
    }
  }

  // Build the generated JS code string
  const lines = [];
  lines.push("// Helper function for SVG icons (viewBox auto-detected per icon)");
  lines.push("function _fc(vb, inner, sz) {");
  lines.push("  sz = sz || 20;");
  lines.push("  return '<svg viewBox=\"' + vb + '\" width=\"' + sz + '\" height=\"' + sz + '\" xmlns=\"http://www.w3.org/2000/svg\">' + inner + '</svg>';");
  lines.push("}");

  for (const [name, spec] of entries) {
    if (typeof spec === "string" && spec.startsWith("=")) {
      const alias = spec.slice(1);
      lines.push(`const ${name} = ${alias};`);
    } else {
      const { icon, color } = specs[name];
      const key = icon + (color ? "|" + color : "");
      const svg = svgCache[key];
      const { viewBox, inner } = parseSvg(svg);
      const escaped = escapeForTemplateLiteral(inner);
      lines.push(`const ${name} = _fc("${viewBox}", \`${escaped}\`);`);
    }
  }

  const jsCode = lines.join("\n");

  const output = `// AUTO-GENERATED by scripts/fetch-icons.mjs — do not edit manually.
// To change icons, edit src/ui/icons.config.json and run: npm run build
export const ICONS_JS = ${JSON.stringify(jsCode)};
`;

  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`Generated ${path.relative(ROOT, OUTPUT_PATH)} (${entries.length} icons)`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
