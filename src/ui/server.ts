/**
 * `dim ui` — local web dashboard (zero extra dependencies, node:http only).
 *
 * Serves a single-page UI: memory list with trust badges, proposal review
 * queue, verify buttons, and a force-directed graph of memories ↔ scope paths
 * (D3 from CDN). Works alongside any IDE; later IDE extensions can embed this
 * same dashboard in a webview.
 */

import { createServer } from "node:http";
import { watch, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { verifyAll } from "../verify/engine.js";
import { mineCommits } from "../capture/commit-miner.js";
import { hybridSearch, indexMemory, reindexAll } from "../embeddings/search.js";
import { readCloudConfig, writeCloudConfig, getToken, sync as cloudSync, configPath } from "../sync/client.js";
import { resolveKnowledgeConfig, readConfig, writeConfig, type ContextFormat } from "../config.js";
import { ingestAll, knowledgeStatus } from "../knowledge/ingest.js";
import { isAllowedSyncServerUrl } from "../security/url.js";
import { checkDiff } from "../verify/check.js";
import { buildSessionBriefing, renderBriefing } from "../capture/session-briefing.js";
import { bootstrapRepo } from "../capture/bootstrap.js";
import { harvestClaudeSessions } from "../capture/harvest.js";
import { generateContext } from "../context/generate.js";
import { getEmbeddingProvider, resetEmbeddingProviderCache } from "../embeddings/provider.js";
import {
  readTicketsConfig,
  writeTicketsConfig,
  saveTicketCredential,
  getTicketCredential,
  ticketProviderFor,
  DEFAULT_TICKET_PATTERN,
  type TicketsConfig,
} from "../tickets/provider.js";
import type { MemoryStore } from "../db/store.js";
import type { MemoryKind, GuardrailLevel } from "../types.js";
import { PAGE_HTML } from "./page.js";

function json(res: import("node:http").ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MiB — bound memory use on POST bodies
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (d: Buffer) => {
      size += d.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      body += d;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/** Extract durable claims from a ticket using the connected LLM, then write memories directly. */
async function extractTicketProposals(
  store: MemoryStore,
  ticket: { id: string; url?: string; title: string; body?: string; type?: string; status?: string; labels?: string[]; parent?: { id: string; title: string } },
  source: string,
): Promise<{ created: number; duplicates: number; provider: string | null }> {
  const result = { created: 0, duplicates: 0, provider: null as string | null };

  const { getTextProvider } = await import("../knowledge/llm.js");
  const { parseClaims } = await import("../knowledge/extract.js");
  const provider = await getTextProvider();
  if (!provider) {
    // Fallback: single TODO_CONTEXT memory without LLM
    const claim = `Ticket ${ticket.id}: ${ticket.title}`;
    const rationaleParts = [`Type: ${ticket.type ?? "other"}`, `Status: ${ticket.status ?? "open"}`];
    if (ticket.labels?.length) rationaleParts.push(`Labels: ${ticket.labels.join(", ")}`);
    if (ticket.parent) rationaleParts.push(`Parent: ${ticket.parent.id} — ${ticket.parent.title}`);
    if (ticket.body) rationaleParts.push(`Description: ${ticket.body.slice(0, 800)}`);
    const evidence: Array<{ type: import("../types.js").EvidenceType; payload: string }> = [
      { type: "TICKET_REF", payload: ticket.id },
    ];
    if (ticket.url) evidence.push({ type: "TICKET_REF", payload: ticket.url });
    const existing = store.list(1000).find(m => m.claim === claim);
    if (existing) { result.duplicates++; return result; }
    const entry = store.write({ kind: "TODO_CONTEXT", claim, evidence, createdBy: source });
    await indexMemory(store, entry).catch(() => false);
    result.created++;
    return result;
  }

  result.provider = `${provider.name}/${provider.model}`;

  const instructions = `You are extracting durable, project-specific knowledge from a ticket (Jira/GitHub/Linear/etc.) that a developer is about to work on.

Turn the ticket details into a set of FALSIFIABLE claims. Rules:

1. Use ALL available ticket fields (title, description, type, status, labels, parent) to extract maximum context.
2. Pick the SINGLE BEST kind for each concept — never create multiple claims that say the same thing with different kinds.
3. Kinds:
   - TODO_CONTEXT: the work to be done, with enough context to resume it (use for bugs/defects/features)
   - CONVENTION: a coding convention or pattern the ticket mentions
   - GUARDRAIL: a hard constraint the agent must follow (set guardrail_level: never|ask-first|always)
   - INVARIANT: a condition that must always hold
   - GOTCHA: a pitfall or surprising behavior
   - ARCHITECTURE: architectural context relevant to the ticket
   - DECISION: a decision already made with the rejected alternative
4. Write each claim as a checkable statement about the codebase.
5. In "rationale", note which part of the ticket the claim came from.
6. For simple tickets (a single bug, a small feature), create 1–2 claims only. For complex tickets (epics, multi-part features), create up to 5. Consolidate related details into fewer, richer claims.
7. Do NOT invent rules the ticket doesn't support. Do NOT rephrase the same idea as different kinds.
8. Leave "paths" and "symbols" as empty arrays [] unless the ticket explicitly mentions file paths or symbol names.

Respond with ONLY a JSON object of this exact shape:
{"claims":[{"kind":"TODO_CONTEXT","claim":"...","paths":[],"symbols":[],"guardrail_level":null,"rationale":"from ticket description: ..."}]}`;

  const ticketContent = [
    `Ticket: ${ticket.id}`,
    `Title: ${ticket.title}`,
    `Type: ${ticket.type ?? "other"}`,
    `Status: ${ticket.status ?? "open"}`,
    ticket.labels?.length ? `Labels: ${ticket.labels.join(", ")}` : null,
    ticket.parent ? `Parent: ${ticket.parent.id} — ${ticket.parent.title}` : null,
    ticket.url ? `URL: ${ticket.url}` : null,
    ticket.body ? `\nDescription:\n${ticket.body}` : null,
  ].filter(Boolean).join("\n");

  let claims;
  try {
    const raw = await provider.generate(instructions, ticketContent.slice(0, 8000));
    claims = parseClaims(raw);
  } catch {
    // LLM failed — fallback to single memory
    const claim = `Ticket ${ticket.id}: ${ticket.title}`;
    const evidence: Array<{ type: import("../types.js").EvidenceType; payload: string }> = [
      { type: "TICKET_REF", payload: ticket.id },
    ];
    if (ticket.url) evidence.push({ type: "TICKET_REF", payload: ticket.url });
    const existing = store.list(1000).find(m => m.claim === claim);
    if (existing) { result.duplicates++; return result; }
    const entry = store.write({ kind: "TODO_CONTEXT", claim, evidence, createdBy: source });
    await indexMemory(store, entry).catch(() => false);
    result.created++;
    return result;
  }

  const evidence: Array<{ type: import("../types.js").EvidenceType; payload: string }> = [
    { type: "TICKET_REF", payload: ticket.id },
  ];
  if (ticket.url) evidence.push({ type: "TICKET_REF", payload: ticket.url });

  const existingClaims = new Set(store.list(1000).map(m => m.claim));

  for (const c of claims) {
    if (existingClaims.has(c.claim)) { result.duplicates++; continue; }
    const entry = store.write({
      kind: c.kind,
      claim: c.claim,
      paths: c.paths,
      symbols: c.symbols,
      evidence,
      createdBy: source,
      guardrailLevel: c.guardrailLevel,
      appliesWhen: c.appliesWhen,
    });
    await indexMemory(store, entry).catch(() => false);
    existingClaims.add(c.claim);
    result.created++;
  }

  return result;
}


export function startUiServer(store: MemoryStore, repoRoot: string, port = 4517): Promise<string> {
  process.env.AIDIMAG_REPO_ROOT = repoRoot;
  const csrfToken = randomBytes(32).toString("base64url");

  const isMutation = (method: string | undefined) =>
    method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";

  const requireCsrf = (req: import("node:http").IncomingMessage): boolean => {
    const header = req.headers["x-aidimag-csrf-token"];
    const got = (Array.isArray(header) ? header[0] : header) ?? "";
    const a = Buffer.from(String(got));
    const b = Buffer.from(csrfToken);
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  };

  // Auto-sync with the linked team server every N minutes while the dashboard
  // runs (AIDIMAG_AUTOSYNC_MINUTES, default 10, 0 disables). Failures are
  // silent — the next manual sync or dashboard action surfaces them.
  const autoSyncMinutes = Number(process.env.AIDIMAG_AUTOSYNC_MINUTES ?? "10");
  if (autoSyncMinutes > 0) {
    const timer = setInterval(() => {
      const cloud = readCloudConfig(repoRoot);
      if (!cloud || !getToken(cloud.server, repoRoot)) return;
      cloudSync(store, repoRoot).catch(() => undefined);
    }, autoSyncMinutes * 60 * 1000);
    timer.unref(); // never keep the process alive on its own
  }

  // Knowledge inbox watcher: auto-summarize docs dropped while the dashboard is up
  // (the design's "automatic on drop while a long-running host is running" trigger).
  // Best-effort and debounced; failures are silent, the next `dim knowledge sync` retries.
  {
    const cfg = resolveKnowledgeConfig(repoRoot);
    const inbox = path.join(repoRoot, cfg.folder);
    try {
      mkdirSync(inbox, { recursive: true });
      let running = false;
      let queued = false;
      let debounce: NodeJS.Timeout | undefined;
      const drain = async (): Promise<void> => {
        if (running) { queued = true; return; }
        running = true;
        try {
          const report = await ingestAll(store, repoRoot, cfg);
          if (report.processed.length) {
            console.log(`dim ui: ingested ${report.processed.length} knowledge doc(s) → review queue`);
          }
        } catch { /* best-effort */ } finally {
          running = false;
          if (queued) { queued = false; void drain(); }
        }
      };
      const watcher = watch(inbox, { persistent: false }, () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => void drain(), 750);
      });
      watcher.unref?.();
      void drain(); // catch up on anything already waiting
    } catch { /* watch unsupported on this platform — CLI sync still works */ }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    try {
      if (isMutation(req.method) && !requireCsrf(req)) {
        json(res, 403, { error: "forbidden" });
        return;
      }

      if (req.method === "GET" && pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(PAGE_HTML);
        return;
      }

      if (req.method === "GET" && pathname === "/api/state") {
        const cloud = readCloudConfig(repoRoot);
        const tcfg = readTicketsConfig(repoRoot);
        let gapCount = 0;
        try { gapCount = store.searchGaps({ sinceDays: 30, limit: 100 }).length; } catch { /* pre-migration DB */ }
        let scratchCount = 0;
        try { scratchCount = store.scratchpadRead(undefined, 100).length; } catch { /* pre-migration DB */ }
        // Detect LLM + embedding providers for status display
        let llmProvider: { name: string; model: string } | null = null;
        let embeddingProvider: { name: string; model: string } | null = null;
        try {
          const { getTextProvider } = await import("../knowledge/llm.js");
          const lp = await getTextProvider();
          if (lp) llmProvider = { name: lp.name, model: lp.model };
        } catch { /* ignore */ }
        try {
          const ep = await getEmbeddingProvider();
          if (ep) embeddingProvider = { name: ep.name, model: ep.model };
        } catch { /* ignore */ }
        let teamTickets: { provider?: string; baseUrl?: string; hasCredential?: boolean; pattern?: string | null } | null = null;
        if ((!tcfg.provider || tcfg.provider === "remote") && cloud) {
          const token = getToken(cloud.server, repoRoot);
          if (token) {
            try {
              const r = await fetch(`${cloud.server}/v1/ticket-config?brain=${encodeURIComponent(cloud.brain)}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (r.ok) {
                const body = (await r.json()) as { config?: { provider?: string; baseUrl?: string; hasCredential?: boolean; pattern?: string | null } | null };
                teamTickets = body.config ?? null;
              }
            } catch { /* ignore */ }
          }
        }
        json(res, 200, {
          repoRoot,
          csrfToken,
          memories: store.list(1000),
          proposals: store.listProposals("PENDING", 200),
          summary: store.statusSummary(),
          gapCount,
          scratchCount,
          cloud: cloud
            ? { server: cloud.server, brain: cloud.brain, hasToken: !!getToken(cloud.server, repoRoot) }
            : null,
          tickets: tcfg.provider
            ? {
                provider: tcfg.provider,
                baseUrl: tcfg.baseUrl ?? null,
                pattern: tcfg.pattern ?? DEFAULT_TICKET_PATTERN,
                hasCredential:
                  tcfg.provider === "remote"
                    ? !!(cloud && getToken(cloud.server, repoRoot))
                    : !!getTicketCredential(tcfg.baseUrl ?? "linear"),
                branch: tcfg.branch ?? null,
              }
            : null,
          teamTickets,
          vecAvailable: store.vecAvailable,
          onboarded: !!readConfig(repoRoot).onboarded,
          llmProvider,
          embeddingProvider,
        });
        return;
      }

      // ---- search (hybrid when embeddings configured) ----
      if (req.method === "GET" && pathname === "/api/search") {
        const { results, semantic } = await hybridSearch(store, {
          query: url.searchParams.get("q") ?? "",
          kind: (url.searchParams.get("kind") as MemoryKind) || undefined,
          paths: url.searchParams.get("path") ? [url.searchParams.get("path")!] : undefined,
          limit: 50,
          includeRefuted: url.searchParams.get("all") === "1",
        });
        json(res, 200, { results, semantic });
        return;
      }

      // ---- create memory (dim remember) ----
      if (req.method === "POST" && pathname === "/api/memories") {
        const b = await readBody(req);
        if (!b.kind || !b.claim) {
          json(res, 400, { error: "kind and claim are required" });
          return;
        }
        const entry = store.write({
          kind: b.kind as MemoryKind,
          claim: String(b.claim),
          paths: (b.paths as string[]) ?? [],
          symbols: (b.symbols as string[]) ?? [],
          evidence: (b.evidence as Array<{ type: never; payload: string }>) ?? [],
          createdBy: "human:dashboard",
          pinned: Boolean(b.pinned),
          guardrailLevel: b.guardrailLevel as GuardrailLevel | undefined,
        });
        await indexMemory(store, entry).catch(() => false);
        json(res, 201, { memory: entry });
        return;
      }

      if (req.method === "POST" && pathname === "/api/verify") {
        const deep = url.searchParams.get("deep") === "1";
        json(res, 200, verifyAll(store, repoRoot, { deep }));
        return;
      }

      // ---- mine git history ----
      if (req.method === "POST" && pathname === "/api/mine") {
        const full = url.searchParams.get("full") === "1";
        const r = mineCommits(store, repoRoot, { full });
        json(res, 200, {
          scanned: r.scanned,
          proposed: r.proposed.length,
          skipped: r.skippedDuplicates,
          noCommits: r.noCommits ?? false,
          noNewCommits: r.noNewCommits ?? false,
          cursor: r.lastSha,
        });
        return;
      }

      // ---- embeddings reindex ----
      if (req.method === "POST" && pathname === "/api/reindex") {
        const r = await reindexAll(store);
        json(res, 200, {
          indexed: r.indexed,
          provider: r.provider ? `${r.provider.name}/${r.provider.model}` : null,
        });
        return;
      }

      // ---- Ollama setup: status check ----
      if (req.method === "GET" && pathname === "/api/ollama/status") {
        const { execSync } = await import("node:child_process");
        const os = await import("node:os");
        const bin = os.platform() === "win32" ? "ollama.exe" : "ollama";
        let installed = false;
        try {
          execSync(`${bin} --version`, { stdio: "pipe", timeout: 5000 });
          installed = true;
        } catch {
          const paths = ["/usr/local/bin/ollama", "/opt/homebrew/bin/ollama", "/usr/bin/ollama"];
          installed = paths.some((p) => existsSync(p));
        }
        let running = false;
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 2000);
          const r2 = await fetch("http://localhost:11434/api/tags", { signal: ctl.signal });
          clearTimeout(t);
          running = r2.ok;
        } catch { /* not running */ }
        let pulledModels: string[] = [];
        if (installed) {
          try {
            const out = execSync(`${bin} list`, { encoding: "utf8", timeout: 5000 });
            pulledModels = out.split("\n").slice(1).map((l) => l.split(/\s+/)[0]).filter(Boolean).map((m) => m.split(":")[0]);
          } catch { /* ignore */ }
        }
        const embeddingModels = [
          { name: "all-minilm", size: "~45MB", dim: 384, desc: "Lightest option. Fast, good for small repos." },
          { name: "nomic-embed-text", size: "~274MB", dim: 768, desc: "Best balance of size and quality. Recommended." },
          { name: "mxbai-embed-large", size: "~670MB", dim: 1024, desc: "Higher quality, larger. Good for large repos." },
          { name: "snowflake-arctic-embed", size: "~1.2GB", dim: 1024, desc: "Top-tier quality, largest. For demanding search." },
        ];
        const llmModels = [
          { name: "llama3.2", size: "~2.0GB", desc: "Latest, fast, good balance. Recommended." },
          { name: "llama3.1", size: "~4.9GB", desc: "Capable, larger. Good for complex repos." },
          { name: "qwen2.5", size: "~4.7GB", desc: "Strong code understanding." },
          { name: "phi3", size: "~2.2GB", desc: "Compact, efficient for simple tasks." },
        ];
        const pulledEmbedding = pulledModels.filter((m) => embeddingModels.some((em) => em.name === m) || /embed/i.test(m));
        const pulledLlm = pulledModels.filter((m) => llmModels.some((lm) => lm.name === m) || (!/embed/i.test(m) && !embeddingModels.some((em) => em.name === m)));
        const cfg = readConfig(repoRoot);
        json(res, 200, {
          installed, running, pulledModels, pulledEmbedding, pulledLlm,
          embeddingModels, llmModels,
          currentLlmModel: cfg.ollama?.llmModel ?? "llama3.1",
        });
        return;
      }

      // ---- Ollama setup: install ----
      if (req.method === "POST" && pathname === "/api/ollama/install") {
        const { execSync } = await import("node:child_process");
        const os = await import("node:os");
        const plat = os.platform();
        try {
          if (plat === "darwin") {
            try {
              execSync("command -v brew", { stdio: "pipe" });
              execSync("brew install ollama", { stdio: "pipe", timeout: 120000 });
              json(res, 200, { ok: true, method: "homebrew" });
              return;
            } catch { /* fall through to install script */ }
          }
          if (plat === "darwin" || plat === "linux") {
            execSync("curl -fsSL https://ollama.com/install.sh | sh", { stdio: "pipe", timeout: 120000 });
            json(res, 200, { ok: true, method: "script" });
            return;
          }
          json(res, 200, { ok: false, message: "Windows: install Ollama from https://ollama.com/download" });
          return;
        } catch (e) {
          json(res, 200, { ok: false, message: (e as Error).message });
          return;
        }
      }

      // ---- Ollama setup: start server ----
      if (req.method === "POST" && pathname === "/api/ollama/start") {
        const { spawn } = await import("node:child_process");
        const os = await import("node:os");
        const bin = os.platform() === "win32" ? "ollama.exe" : "ollama";
        try {
          const child = spawn(bin, ["serve"], { stdio: "ignore", detached: true });
          child.unref();
          // Wait for server to come up
          let ready = false;
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            try {
              const ctl = new AbortController();
              const t = setTimeout(() => ctl.abort(), 2000);
              const r2 = await fetch("http://localhost:11434/api/tags", { signal: ctl.signal });
              clearTimeout(t);
              if (r2.ok) { ready = true; break; }
            } catch { /* not ready yet */ }
          }
          json(res, 200, { ok: ready });
          return;
        } catch (e) {
          json(res, 200, { ok: false, message: (e as Error).message });
          return;
        }
      }

      // ---- Ollama setup: pull model ----
      if (req.method === "POST" && pathname === "/api/ollama/pull") {
        const model = url.searchParams.get("model");
        if (!model) { json(res, 400, { error: "model required" }); return; }
        const { execSync } = await import("node:child_process");
        const os = await import("node:os");
        const bin = os.platform() === "win32" ? "ollama.exe" : "ollama";
        try {
          execSync(`${bin} pull ${model}`, { stdio: "pipe", timeout: 600000 });
          json(res, 200, { ok: true });
          return;
        } catch (e) {
          json(res, 200, { ok: false, message: (e as Error).message });
          return;
        }
      }

      // ---- Ollama setup: verify embedding ----
      if (req.method === "POST" && pathname === "/api/ollama/verify") {
        const model = url.searchParams.get("model");
        if (!model) { json(res, 400, { error: "model required" }); return; }
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 10000);
          const r2 = await fetch("http://localhost:11434/api/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, prompt: "probe" }),
            signal: ctl.signal,
          });
          clearTimeout(t);
          if (!r2.ok) { json(res, 200, { ok: false, message: `HTTP ${r2.status}` }); return; }
          const body = (await r2.json()) as { embedding?: number[] };
          const ok = Boolean(body.embedding?.length);
          if (ok) {
            // Save the embedding model to config and reset caches so state refresh detects it
            const cfg = readConfig(repoRoot);
            const ollama = { ...cfg.ollama, embeddingModel: model };
            writeConfig(repoRoot, { ollama });
            resetEmbeddingProviderCache();
            const { resetTextProviderCache } = await import("../knowledge/llm.js");
            resetTextProviderCache();
          }
          json(res, 200, { ok });
          return;
        } catch (e) {
          json(res, 200, { ok: false, message: (e as Error).message });
          return;
        }
      }

      // ---- Ollama setup: list all pulled models (for LLM model selection) ----
      if (req.method === "GET" && pathname === "/api/ollama/models") {
        const { execSync } = await import("node:child_process");
        const os = await import("node:os");
        const bin = os.platform() === "win32" ? "ollama.exe" : "ollama";
        let models: string[] = [];
        try {
          const out = execSync(`${bin} list`, { encoding: "utf8", timeout: 5000 });
          models = out.split("\n").slice(1).map((l) => l.split(/\s+/)[0]).filter(Boolean).map((m) => m.split(":")[0]);
        } catch { /* not installed or not running */ }
        const cfg = readConfig(repoRoot);
        json(res, 200, {
          models,
          currentEmbeddingModel: cfg.ollama?.embeddingModel ?? "nomic-embed-text",
          currentLlmModel: cfg.ollama?.llmModel ?? "llama3.1",
        });
        return;
      }

      // ---- Ollama setup: save model selection to config ----
      if (req.method === "POST" && pathname === "/api/ollama/config") {
        const b = await readBody(req);
        const cfg = readConfig(repoRoot);
        const ollama = { ...cfg.ollama };
        if (b.embeddingModel) ollama.embeddingModel = String(b.embeddingModel);
        if (b.llmModel) ollama.llmModel = String(b.llmModel);
        writeConfig(repoRoot, { ollama });
        // Reset caches so the new model takes effect
        resetEmbeddingProviderCache();
        const { resetTextProviderCache } = await import("../knowledge/llm.js");
        resetTextProviderCache();
        json(res, 200, { ok: true, ollama });
        return;
      }

      // ---- knowledge gaps (dim gaps) ----
      if (req.method === "GET" && pathname === "/api/gaps") {
        const days = Number(url.searchParams.get("days") ?? "30") || 30;
        let gaps: ReturnType<MemoryStore["searchGaps"]> = [];
        try { gaps = store.searchGaps({ sinceDays: days, limit: 50 }); } catch { /* pre-migration DB */ }
        json(res, 200, { gaps, days });
        return;
      }
      if (req.method === "POST" && pathname === "/api/gaps/clear") {
        json(res, 200, { cleared: store.clearSearchGaps() });
        return;
      }

      // ---- scratchpad (dim scratch) ----
      if (req.method === "GET" && pathname === "/api/scratchpad") {
        json(res, 200, { notes: store.scratchpadRead(undefined, 100) });
        return;
      }
      if (req.method === "POST" && pathname === "/api/scratchpad") {
        const b = await readBody(req);
        const content = String(b.content ?? "").trim();
        if (!content) {
          json(res, 400, { error: "content is required" });
          return;
        }
        const ttlHours = Number(b.ttlHours) || 24;
        json(res, 201, { note: store.scratchpadWrite(content, { ttlHours, createdBy: "human:dashboard" }) });
        return;
      }
      if (req.method === "POST" && pathname === "/api/scratchpad/clear") {
        json(res, 200, { cleared: store.scratchpadClear() });
        return;
      }

      // ---- provenance audit (dim audit) ----
      if (req.method === "GET" && pathname === "/api/audit") {
        json(res, 200, { findings: store.auditMemories({ limit: 50 }) });
        return;
      }

      // ---- health dashboard (risk metrics, coverage heatmap) ----
      if (req.method === "GET" && pathname === "/api/health") {
        const { computeHealth } = await import("../health.js");
        json(res, 200, computeHealth(store));
        return;
      }

      // ---- analytics (trend charts, token usage, verify history) ----
      if (req.method === "GET" && pathname === "/api/analytics") {
        const { computeAnalytics } = await import("../analytics.js");
        const days = Number(url.searchParams.get("days") ?? "30") || 30;
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        json(res, 200, computeAnalytics(store, { since }));
        return;
      }

      // ---- session briefing (dim brief) ----
      if (req.method === "GET" && pathname === "/api/brief") {
        const b = buildSessionBriefing(store, repoRoot);
        json(res, 200, { briefing: b, rendered: renderBriefing(b) });
        return;
      }

      // ---- staged-diff contradiction check (dim check) ----
      if (req.method === "POST" && pathname === "/api/check") {
        json(res, 200, checkDiff(store, repoRoot));
        return;
      }

      // ---- proposals gc (dim proposals gc) ----
      if (req.method === "POST" && pathname === "/api/proposals/gc") {
        const dryRun = url.searchParams.get("dryRun") === "1";
        json(res, 200, { ...store.gcResolvedProposals({ dryRun }), dryRun });
        return;
      }

      // ---- knowledge inbox (dim knowledge sync/status) ----
      if (req.method === "GET" && pathname === "/api/knowledge/status") {
        const cfg = resolveKnowledgeConfig(repoRoot);
        const s = await knowledgeStatus(repoRoot, cfg);
        json(res, 200, {
          folder: s.folder,
          pending: s.pending.map((d) => d.file),
          unsupported: s.unsupported.length,
          skipped: s.skippedOnDisk.length,
          processed: s.processed.length,
        });
        return;
      }
      if (req.method === "POST" && pathname === "/api/knowledge/sync") {
        const cfg = resolveKnowledgeConfig(repoRoot);
        const report = await ingestAll(store, repoRoot, cfg);
        json(res, 200, {
          processed: report.processed.length,
          duplicates: report.duplicates.length,
          pendingNoSummarizer: report.pendingNoSummarizer.length,
        });
        return;
      }

      // ---- bootstrap (dim bootstrap) — long-running, needs an LLM ----
      if (req.method === "POST" && pathname === "/api/bootstrap") {
        const force = url.searchParams.get("force") === "1";
        const r = await bootstrapRepo(store, repoRoot, { force });
        json(res, 200, r);
        return;
      }

      // ---- harvest AI chats (dim harvest) — needs an LLM ----
      if (req.method === "POST" && pathname === "/api/harvest") {
        const all = url.searchParams.get("all") === "1";
        const r = await harvestClaudeSessions(store, repoRoot, { all });
        json(res, 200, r);
        return;
      }

      // ---- generate context files (dim generate-context) ----
      if (req.method === "POST" && pathname === "/api/generate-context") {
        const b = await readBody(req);
        const format = String(b.format ?? "claude") as ContextFormat;
        if (!["claude", "cursorrules", "copilot", "windsurfrules", "agents", "all"].includes(format)) {
          json(res, 400, { error: "invalid format" });
          return;
        }
        const r = generateContext(store, repoRoot, format);
        json(res, 200, { files: r.files, total: r.total, pinned: r.pinned });
        return;
      }

      // ---- team sync ----
      if (req.method === "POST" && pathname === "/api/sync") {
        const r = await cloudSync(store, repoRoot);
        json(res, 200, r);
        return;
      }

      // ---- cloud link/unlink ----
      if (req.method === "POST" && pathname === "/api/cloud/link") {
        const b = await readBody(req);
        if (!b.server || !b.brain) {
          json(res, 400, { error: "server and brain are required" });
          return;
        }
        const serverUrl = String(b.server).replace(/\/$/, "");
        if (!isAllowedSyncServerUrl(serverUrl)) {
          json(res, 400, { error: "invalid server URL" });
          return;
        }
        // Save to project config with token
        const p = configPath(repoRoot);
        let existing: Record<string, unknown> = {};
        try {
          existing = JSON.parse(readFileSync(p, "utf8"));
        } catch {
          // fresh file
        }
        
        const newConfig: Record<string, unknown> = { ...existing, server: serverUrl, brain: String(b.brain) };
        if (b.token) {
          newConfig.token = String(b.token);
        }
        
        writeFileSync(p, JSON.stringify(newConfig, null, 2) + "\n");
        json(res, 200, { ok: true, hasToken: !!getToken(serverUrl, repoRoot) });
        return;
      }
      if (req.method === "POST" && pathname === "/api/cloud/unlink") {
        writeCloudConfig(repoRoot, { server: "", brain: "" } as never);
        json(res, 200, { ok: true });
        return;
      }

      // ---- tickets (T2 connect + T3 team share) ----
      if (req.method === "POST" && pathname === "/api/tickets/connect") {
        const b = await readBody(req);
        const provider = String(b.provider ?? "");
        if (!["jira", "github", "linear", "http", "remote", "gitlab", "azuredevops", "clickup", "shortcut", "youtrack", "asana", "trello", "notion", "pivotal"].includes(provider)) {
          json(res, 400, { error: "provider must be jira | github | linear | http | remote | gitlab | azuredevops | clickup | shortcut | youtrack | asana | trello | notion | pivotal" });
          return;
        }
        const baseUrl = b.baseUrl ? String(b.baseUrl).replace(/\/$/, "") : undefined;
        if (!baseUrl && !["linear", "clickup", "shortcut", "asana", "trello", "notion", "remote"].includes(provider)) {
          json(res, 400, { error: `baseUrl is required for ${provider}` });
          return;
        }
        const existing = readTicketsConfig(repoRoot);
        writeTicketsConfig(repoRoot, {
          ...existing,
          provider: provider as TicketsConfig["provider"],
          baseUrl,
          pattern:
            (b.pattern as string | undefined) ??
            existing.pattern ??
            (provider === "github" ? "#\\d+" : DEFAULT_TICKET_PATTERN),
        });
        if (b.token) saveTicketCredential(baseUrl ?? "linear", String(b.token));
        // trust-building: optional live validation round-trip
        let validated: { id: string; title: string } | null = null;
        if (b.testId) {
          const p = ticketProviderFor(repoRoot);
          const t = p ? await p.getTicket(String(b.testId)).catch(() => null) : null;
          if (t) validated = { id: t.id, title: t.title };
        }
        json(res, 200, { ok: true, validated });
        return;
      }
      if (req.method === "POST" && pathname === "/api/tickets/validate") {
        const b = await readBody(req);
        const testId = String(b.testId ?? "");
        if (!testId) { json(res, 400, { error: "missing testId" }); return; }
        const p = ticketProviderFor(repoRoot);
        if (!p) { json(res, 400, { error: "no ticket provider connected (or credential missing)" }); return; }
        try {
          const t = await p.getTicket(testId);
          if (!t) json(res, 404, { error: `ticket ${testId} not found` });
          else json(res, 200, { ticket: { id: t.id, title: t.title, status: t.status, url: t.url } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "internal error";
          if (msg.includes("no ticket provider configured")) json(res, 404, { error: "team ticket credentials were removed from the server" });
          else json(res, 502, { error: msg });
        }
        return;
      }
      if (req.method === "POST" && pathname === "/api/tickets/disconnect") {
        const existing = readTicketsConfig(repoRoot);
        writeTicketsConfig(repoRoot, { branch: existing.branch }); // keep branch rules
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === "GET" && pathname === "/api/tickets/show") {
        const ticketId = url.searchParams.get("id");
        if (!ticketId) {
          json(res, 400, { error: "missing ?id=" });
          return;
        }
        const p = ticketProviderFor(repoRoot);
        if (!p) {
          json(res, 400, { error: "no ticket provider connected (or credential missing)" });
          return;
        }
        const t = await p.getTicket(ticketId);
        if (!t) json(res, 404, { error: `ticket ${ticketId} not found` });
        else json(res, 200, { ticket: t });
        return;
      }
      // admin: push/remove team-shared credentials on the sync server
      // (proxied like /api/keys — the admin token is per-request, never stored)
      if (req.method === "POST" && pathname === "/api/tickets/share") {
        const b = await readBody(req);
        const cloud = readCloudConfig(repoRoot);
        if (!cloud) {
          json(res, 400, { error: "repo is not cloud-linked — link a team server first" });
          return;
        }
        const admin = String(b.adminToken ?? "") || getToken(cloud.server, repoRoot) || "";
        if (!admin) {
          json(res, 400, { error: "adminToken is required (or link your cloud server with an API key)" });
          return;
        }
        const endpoint = `${cloud.server}/v1/ticket-config?brain=${encodeURIComponent(cloud.brain)}`;
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${admin}` };
        const upstream = b.remove
          ? await fetch(endpoint, { method: "DELETE", headers })
          : await fetch(endpoint, {
              method: "PUT",
              headers,
              body: JSON.stringify({ provider: b.provider, baseUrl: b.baseUrl ?? "", credential: b.credential, pattern: b.pattern ?? undefined }),
            });
        json(res, upstream.status, await upstream.json());
        return;
      }

      // ---- API key management (proxies to the sync server; admin token is
      //      passed per-request from the UI and never stored) ----
      if (pathname === "/api/keys") {
        const b = req.method === "GET" ? {} : await readBody(req);
        const cloud = readCloudConfig(repoRoot);
        // Admin token is sent in a header (or POST body) — never the query
        // string — so it can't leak into browser history, proxy/access logs.
        const headerToken = req.headers["x-aidimag-admin-token"];
        const target = String((b.server as string) ?? url.searchParams.get("server") ?? cloud?.server ?? "");
        if (cloud && target && target.replace(/\/$/, "") !== cloud.server.replace(/\/$/, "")) {
          json(res, 400, { error: "server must match linked cloud config" });
          return;
        }
        const admin = String(
          (b.adminToken as string) ??
            (Array.isArray(headerToken) ? headerToken[0] : headerToken) ??
            ""
        );
        if (!target || !admin) {
          json(res, 400, { error: "server and adminToken are required" });
          return;
        }
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${admin}` };
        let upstream: Response;
        if (req.method === "POST" && !b.revoke) {
          upstream = await fetch(`${target}/v1/keys`, {
            method: "POST",
            headers,
            body: JSON.stringify({ brain: b.brain, label: b.label }),
          });
        } else if (req.method === "POST" && b.revoke) {
          upstream = await fetch(`${target}/v1/keys?key=${encodeURIComponent(String(b.revoke))}`, {
            method: "DELETE",
            headers,
          });
        } else {
          upstream = await fetch(`${target}/v1/keys`, { headers });
        }
        json(res, upstream.status, await upstream.json());
        return;
      }

      // ---- critical areas (protected code boundaries) ----
      if (req.method === "GET" && pathname === "/api/critical-areas") {
        const { readCriticalAreas } = await import("../verify/critical-areas.js");
        json(res, 200, readCriticalAreas(repoRoot));
        return;
      }
      if (req.method === "PUT" && pathname === "/api/critical-areas") {
        const { writeCriticalAreas } = await import("../verify/critical-areas.js");
        const b = await readBody(req);
        if (!b || !Array.isArray(b.areas)) {
          json(res, 400, { error: "expected { areas: [...] }" });
          return;
        }
        writeCriticalAreas(repoRoot, { areas: b.areas });
        json(res, 200, { ok: true });
        return;
      }

      // ---- onboarding ----
      if (req.method === "POST" && pathname === "/api/onboard") {
        writeConfig(repoRoot, { onboarded: true });
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && pathname === "/api/onboard/reset") {
        writeConfig(repoRoot, { onboarded: false });
        json(res, 200, { ok: true });
        return;
      }

      // ---- MCP / integration status ----
      if (req.method === "GET" && pathname === "/api/mcp/status") {
        const mcpCommand = `npx -y aidimag mcp`;
        const envVar = `AIDIMAG_REPO=${repoRoot}`;
        const snippet = JSON.stringify({
          mcpServers: {
            aidimag: {
              command: "npx",
              args: ["-y", "aidimag", "mcp"],
              env: { AIDIMAG_REPO: repoRoot },
            },
          },
        }, null, 2);

        // Agent config files that agents read at startup
        const agentConfigs = [
          { name: "Claude Code", file: ".mcp.json", path: path.join(repoRoot, ".mcp.json"), exists: false, mtime: null as string | null },
          { name: "Cursor", file: ".cursorrules", path: path.join(repoRoot, ".cursorrules"), exists: false, mtime: null as string | null },
          { name: "GitHub Copilot", file: ".github/copilot-instructions.md", path: path.join(repoRoot, ".github", "copilot-instructions.md"), exists: false, mtime: null as string | null },
          { name: "Windsurf", file: ".windsurfrules", path: path.join(repoRoot, ".windsurfrules"), exists: false, mtime: null as string | null },
          { name: "Generic (AGENTS.md)", file: "AGENTS.md", path: path.join(repoRoot, "AGENTS.md"), exists: false, mtime: null as string | null },
          { name: "Claude (CLAUDE.md)", file: "CLAUDE.md", path: path.join(repoRoot, "CLAUDE.md"), exists: false, mtime: null as string | null },
        ];
        for (const ac of agentConfigs) {
          try {
            const stat = await import("node:fs/promises").then((fs) => fs.stat(ac.path));
            ac.exists = true;
            ac.mtime = stat.mtime.toISOString();
          } catch { /* not present */ }
        }

        // Hermes install status
        let hermes: { installed: boolean; path: string | null } = { installed: false, path: null };
        try {
          const hermesHome = process.env.HERMES_HOME ?? path.join(process.env.HOME ?? "~", ".hermes");
          const hermesPluginDir = path.join(hermesHome, "plugins", "aidimag");
          const initPy = path.join(hermesPluginDir, "__init__.py");
          if (existsSync(initPy)) {
            hermes = { installed: true, path: hermesPluginDir };
          }
        } catch { /* best-effort */ }

        // MCP registry info
        const registry = {
          name: "io.github.AiDimag/aidimag",
          mcpRegistry: "https://registry.modelcontextprotocol.io/?q=aidimag",
          glama: "https://glama.ai/mcp/servers/AiDimag/aidimag",
          serverJson: "https://github.com/AiDimag/aidimag/blob/main/server.json",
        };

        json(res, 200, {
          mcpCommand,
          envVar,
          snippet,
          agentConfigs,
          hermes,
          registry,
          docsUrl: "https://aidimag.com/mcp",
        });
        return;
      }

      // POST /api/proposals/:id/(approve|reject)
      const propMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/(approve|reject)$/);
      if (req.method === "POST" && propMatch) {
        const [, id, action] = propMatch;
        if (action === "approve") {
          const memory = store.approveProposal(id);
          await indexMemory(store, memory).catch(() => false);
          json(res, 200, { memory });
        } else json(res, 200, { proposal: store.rejectProposal(id) });
        return;
      }

      // POST /api/memories/:id/(refute|forget|pin|unpin)
      const memMatch = pathname.match(/^\/api\/memories\/([^/]+)\/(refute|forget|pin|unpin)$/);
      if (req.method === "POST" && memMatch) {
        const [, id, action] = memMatch;
        const full = store.list(1000).find((m) => m.id === id || m.id.startsWith(id));
        if (!full) {
          json(res, 404, { error: `no memory ${id}` });
          return;
        }
        if (action === "refute") store.refute(full.id);
        else if (action === "forget") store.forget(full.id);
        else store.setPinned(full.id, action === "pin");
        json(res, 200, { ok: true });
        return;
      }

      // ---- auth: device-code login (dim login) ----
      if (req.method === "POST" && pathname === "/api/auth/login") {
        const cloud = readCloudConfig(repoRoot);
        const server = cloud?.server;
        if (!server) { json(res, 400, { error: "no cloud server linked — use Connect Cloud first" }); return; }
        const { startDeviceLogin } = await import("../sync/client.js");
        try {
          const start = await startDeviceLogin(server, cloud.brain);
          json(res, 200, {
            userCode: start.user_code,
            deviceCode: start.device_code,
            verifyUrl: `${start.verification_uri}?code=${encodeURIComponent(start.user_code)}`,
            expiresIn: start.expires_in,
            interval: start.interval,
            server,
          });
        } catch (e) {
          json(res, 500, { error: (e as Error).message });
        }
        return;
      }
      if (req.method === "POST" && pathname === "/api/auth/login/poll") {
        const b = await readBody(req);
        const server = String(b.server ?? "");
        const deviceCode = String(b.deviceCode ?? "");
        if (!server || !deviceCode) { json(res, 400, { error: "server and deviceCode required" }); return; }
        try {
          const res2 = await fetch(`${server}/v1/auth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_code: deviceCode }),
          });
          if (res2.status === 428) { json(res, 200, { pending: true }); return; }
          if (!res2.ok) { json(res, 400, { error: `login failed: HTTP ${res2.status}` }); return; }
          const out = (await res2.json()) as { token: string; brain: string | null };
          // Save token to config
          const p = configPath(repoRoot);
          let existing: Record<string, unknown> = {};
          try { existing = JSON.parse(readFileSync(p, "utf8")); } catch { /* fresh */ }
          existing.token = out.token;
          writeFileSync(p, JSON.stringify(existing, null, 2) + "\n");
          json(res, 200, { ok: true, brain: out.brain });
        } catch (e) {
          json(res, 500, { error: (e as Error).message });
        }
        return;
      }
      if (req.method === "POST" && pathname === "/api/auth/logout") {
        const p = configPath(repoRoot);
        let existing: Record<string, unknown> = {};
        try { existing = JSON.parse(readFileSync(p, "utf8")); } catch { /* no config */ }
        if (!existing.token) { json(res, 200, { ok: true, message: "no token stored" }); return; }
        delete existing.token;
        writeFileSync(p, JSON.stringify(existing, null, 2) + "\n");
        json(res, 200, { ok: true });
        return;
      }

      // ---- create ticket branch (dim branch) ----
      if (req.method === "POST" && pathname === "/api/branch") {
        const b = await readBody(req);
        const ticketId = String(b.ticketId ?? "").trim();
        if (!ticketId) { json(res, 400, { error: "ticketId required" }); return; }
        const prefix = b.prefix !== undefined ? String(b.prefix) : "feature";
        const { ticketProviderFor, buildBranchName } = await import("../tickets/provider.js");
        const provider = ticketProviderFor(repoRoot);
        let ticket: { id: string; title: string; body?: string; status?: string; url?: string; labels?: string[] } | null = null;
        if (provider) {
          ticket = await provider.getTicket(ticketId).catch(() => null);
        }
        const name = buildBranchName(ticketId, undefined, prefix);
        const { execFileSync } = await import("node:child_process");
        try {
          execFileSync("git", ["checkout", "-b", name], { cwd: repoRoot, stdio: "pipe" });
        } catch (e) {
          json(res, 400, { error: (e as Error).message, branch: name });
          return;
        }

        // Extract claims from ticket and create memories
        let memoriesCreated = false;
        let memoriesCount = 0;
        if (ticket) {
          try {
            const r = await extractTicketProposals(store, ticket, "ticket-branch");
            memoriesCount = r.created;
            memoriesCreated = r.created > 0;
          } catch { /* ignore errors */ }
        }

        json(res, 200, { ok: true, branch: name, ticketTitle: ticket?.title, memoriesCreated, memoriesCount });
        return;
      }

      // ---- resync current branch ticket ----
      if (req.method === "POST" && pathname === "/api/branch/resync") {
        const { execFileSync } = await import("node:child_process");
        let branch: string;
        try {
          branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
        } catch {
          json(res, 400, { error: "Not in a git repo" });
          return;
        }
        // Extract ticket ID from branch name
        const { readTicketsConfig, ticketProviderFor } = await import("../tickets/provider.js");
        const tcfg = readTicketsConfig(repoRoot);
        const pattern = tcfg.pattern || DEFAULT_TICKET_PATTERN;
        const match = branch.match(new RegExp(pattern));
        if (!match) {
          json(res, 400, { error: `No ticket ID found in branch "${branch}" (pattern: ${pattern})` });
          return;
        }
        const ticketId = match[0];
        const provider = ticketProviderFor(repoRoot);
        if (!provider) {
          json(res, 400, { error: "No ticket provider connected" });
          return;
        }
        const ticket = await provider.getTicket(ticketId).catch(() => null);
        if (!ticket) {
          json(res, 400, { error: `Could not fetch ticket ${ticketId}` });
          return;
        }

        // Check if memories from this ticket already exist
        const existingMemories = store.list(1000).filter(m => m.claim.includes(ticketId));
        if (existingMemories.length) {
          json(res, 200, { ok: true, ticketId, branch, ticketTitle: ticket.title, message: "Memory already up to date" });
          return;
        }

        // Extract claims from updated ticket and create memories
        const r = await extractTicketProposals(store, ticket, "ticket-resync");

        json(res, 200, { ok: true, ticketId, branch, ticketTitle: ticket.title, memoriesCreated: r.created > 0, memoriesCount: r.created });
        return;
      }

      // ---- Hermes plugin install (dim hermes install) ----
      if (req.method === "POST" && pathname === "/api/hermes/install") {
        const { copyFileSync, mkdirSync, existsSync: exists } = await import("node:fs");
        const { homedir } = await import("node:os");
        const { fileURLToPath } = await import("node:url");
        const hermesHome = process.env.HERMES_HOME ?? path.join(homedir() ?? "~", ".hermes");
        if (!exists(hermesHome)) {
          json(res, 400, { error: `Hermes home not found at ${hermesHome}. Install Hermes Agent first.` });
          return;
        }
        const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
        const pluginDir = path.join(hermesHome, "plugins", "aidimag");
        const template = path.join(pkgRoot, "integrations", "hermes", "aidimag_hermes_provider.py");
        if (!exists(template)) {
          json(res, 400, { error: "provider template missing from this install — reinstall aidimag" });
          return;
        }
        mkdirSync(pluginDir, { recursive: true });
        copyFileSync(template, path.join(pluginDir, "__init__.py"));
        const serverJs = path.join(pkgRoot, "dist", "mcp", "server.js");
        const config: Record<string, unknown> = exists(serverJs)
          ? { command: process.execPath, args: [serverJs] }
          : {};
        config.repo = repoRoot;
        writeFileSync(path.join(pluginDir, "config.json"), JSON.stringify(config, null, 2) + "\n");
        json(res, 200, { ok: true, path: pluginDir, repo: repoRoot });
        return;
      }

      // ---- verify --trust: list untrusted evidence ----
      if (req.method === "GET" && pathname === "/api/verify/trust") {
        const pending = store.untrustedEvidence();
        json(res, 200, { pending, count: pending.length });
        return;
      }
      // ---- verify --trust: approve all untrusted evidence ----
      if (req.method === "POST" && pathname === "/api/verify/trust/approve") {
        const b = await readBody(req);
        const approveAll = b.all !== false;
        let approved = 0;
        if (approveAll) {
          approved = store.trustAllEvidence();
        } else if (b.payload) {
          store.trustEvidencePayload(String(b.payload));
          approved = 1;
        }
        json(res, 200, { approved });
        return;
      }

      json(res, 404, { error: "not found" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "internal error";
      console.error(`[dim ui] ${req.method} ${req.url}:`, msg);
      json(res, 500, { error: msg });
    }
  });

  return new Promise((resolve, reject) => {
    const tryPort = (currentPort: number, maxAttempts = 10): void => {
      if (maxAttempts === 0) {
        reject(new Error(`Could not find an available port after trying ${port}-${currentPort - 1}`));
        return;
      }

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.log(`⚠ Port ${currentPort} is already in use, trying ${currentPort + 1}...`);
          server.removeAllListeners("error");
          tryPort(currentPort + 1, maxAttempts - 1);
        } else {
          reject(err);
        }
      });

      server.listen(currentPort, "127.0.0.1", () => {
        if (currentPort !== port) {
          console.log(`ℹ Started on port ${currentPort} (requested port ${port} was in use)`);
        }
        resolve(`http://localhost:${currentPort}`);
      });
    };

    tryPort(port);
  });
}

