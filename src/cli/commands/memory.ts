/**
 * Core memory commands: init, remember, recall, reindex, status, log, gaps,
 * refute, pin, unpin, forget.
 */

import type { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { MemoryStore, findRepoRoot, dbPathFor, AIDIMAG_DIR } from "../../db/store.js";
import { installGitHooks } from "../../verify/hooks.js";
import { hybridSearch, indexMemory, reindexAll } from "../../embeddings/search.js";
import { resolveKnowledgeConfig } from "../../config.js";
import { KINDS, GUARDRAIL_LEVELS, fail, autoSync, printMemory } from "../shared.js";
import { debugLog } from "../../debug.js";
import type { EvidenceType, GuardrailLevel, MemoryKind } from "../../types.js";
import { applyBudget, applyCharBudget, getTokenizer } from "../../llm/tokens.js";
import type { MemoryEntry } from "../../types.js";

const PRESETS: Record<string, number> = {
  minimal: 400,
  standard: 1200,
  deep: 4000,
};

function resolveBudget(budget: string, preset?: string): number {
  if (preset && PRESETS[preset.toLowerCase()]) return PRESETS[preset.toLowerCase()];
  const n = parseInt(budget, 10);
  return Number.isNaN(n) ? PRESETS.standard : n;
}

function rankForContext(m: MemoryEntry): number {
  let score = m.status === "VERIFIED" ? 100 : m.status === "UNVERIFIED" ? 50 : 10;
  if (m.kind === "GUARDRAIL") score += 1000;
  if (m.kind === "INVARIANT") score += 800;
  if (m.kind === "CONVENTION") score += 500;
  if (m.kind === "FAILED_APPROACH") score += 700;
  if (m.pinned) score += 200;
  return score;
}

export function registerMemoryCommands(program: Command): void {
  program
    .command("init")
    .description("Initialize aidimag in the current repo")
    .action(async () => {
      const root = findRepoRoot() ?? process.cwd();
      const dir = path.join(root, AIDIMAG_DIR);
      const fresh = !existsSync(dbPathFor(root));
      mkdirSync(dir, { recursive: true });
      const store = new MemoryStore(dbPathFor(root));
      store.close();
      // keep the DB out of git by default (team-sync mode comes later)
      const gitignore = path.join(dir, ".gitignore");
      if (!existsSync(gitignore)) {
        writeFileSync(gitignore, "memory.db\nmemory.db-wal\nmemory.db-shm\nknowledge/\nconfig.json\n");
      } else {
        const content = readFileSync(gitignore, "utf8");
        if (!content.includes("knowledge/")) {
          appendFileSync(gitignore, "knowledge/\n");
        }
        if (!content.includes("config.json")) {
          appendFileSync(gitignore, "config.json\n");
        }
      }
      // knowledge inbox: a drop folder for project docs (summaries/backups live in .aidimag/)
      const knowledgeInbox = path.join(root, resolveKnowledgeConfig(root).folder);
      mkdirSync(knowledgeInbox, { recursive: true });
      const gitkeep = path.join(knowledgeInbox, ".gitkeep");
      if (!existsSync(gitkeep)) {
        writeFileSync(
          gitkeep,
          "# Drop project docs here (design docs, ADRs, style guides, runbooks).\n" +
            "# aidimag summarizes them into reviewed, pinned memories — see `dim knowledge`.\n"
        );
      }
      // create .cursorrules for automatic MCP integration
      const cursorrules = path.join(root, ".cursorrules");
      if (!existsSync(cursorrules)) {
        writeFileSync(
          cursorrules,
          `# Project Memory Integration

At the start of EVERY new chat session, you MUST:
1. Read the \`aidimag://session-briefing\` resource to load project memory, conventions, and guardrails
2. Review all GUARDRAILS before making any code changes
3. Search project memory using \`memory_search\` when working on specific features

Before making any changes to code:
- Check if there are relevant memories using \`memory_search\`
- Respect all GUARDRAIL rules (ALWAYS = block, ASK-FIRST = confirm, NEVER = refuse)
- Use \`context_note\` to capture any new conventions or decisions the user mentions

This project uses aiDimag for persistent memory. Always consult memory before proceeding.
`
        );
        console.log(`Created ${cursorrules} (tells Cursor/Claude to auto-load memory)`);
      }
      // suggest MCP wiring
      console.log(fresh ? `Initialized aidimag in ${dir}` : `aidimag already initialized in ${dir}`);
      const hooks = installGitHooks(root);
      if (hooks.installed.length) {
        console.log(`Installed git hooks: ${hooks.installed.join(", ")} (re-verify on pull/checkout)`);
      } else if (hooks.alreadyPresent.length) {
        console.log(`Git hooks already installed: ${hooks.alreadyPresent.join(", ")}`);
      }
      console.log(`\nAdd the MCP server to your agent config, e.g. for Claude Code (.mcp.json):`);
      console.log(
        JSON.stringify(
          { mcpServers: { aidimag: { command: "npx", args: ["-y", "aidimag", "mcp"], env: { AIDIMAG_REPO: root } } } },
          null,
          2
        )
      );
      // append .aidimag DB files to repo .gitignore if a git repo
      const rootIgnore = path.join(root, ".gitignore");
      if (existsSync(path.join(root, ".git"))) {
        const current = existsSync(rootIgnore) ? readFileSync(rootIgnore, "utf8") : "";
        const folder = resolveKnowledgeConfig(root).folder;
        const additions: string[] = [];
        // Ignore sensitive .aidimag files, but allow critical-areas.* to be committed for team sharing
        const aidimagIgnores = [
          ".aidimag/memory.db",
          ".aidimag/memory.db-wal",
          ".aidimag/memory.db-shm",
          ".aidimag/config.json",
        ];
        for (const entry of aidimagIgnores) {
          if (!current.includes(entry)) additions.push(entry);
        }
        // Negation: if .aidimag/ is already ignored, un-ignore the critical-areas config so it can be committed
        if (current.includes(".aidimag/") || current.includes(".aidimag")) {
          if (!current.includes("!.aidimag/")) additions.push("!.aidimag/");
          if (!current.includes("!.aidimag/critical-areas.yml")) additions.push("!.aidimag/critical-areas.yml");
          if (!current.includes("!.aidimag/critical-areas.yaml")) additions.push("!.aidimag/critical-areas.yaml");
          if (!current.includes("!.aidimag/critical-areas.json")) additions.push("!.aidimag/critical-areas.json");
        }
        if (!current.includes(folder)) additions.push(folder);
        // generated context files (users can commit them if they want, but default is gitignored)
        if (!current.includes("CLAUDE.md")) additions.push("CLAUDE.md");
        if (!current.includes(".cursorrules")) additions.push(".cursorrules");
        if (!current.includes(".windsurfrules")) additions.push(".windsurfrules");
        if (!current.includes("AGENTS.md")) additions.push("AGENTS.md");
        if (!current.includes(".github/copilot-instructions.md")) additions.push(".github/copilot-instructions.md");
        if (additions.length) {
          appendFileSync(rootIgnore, `${current.endsWith("\n") || current === "" ? "" : "\n"}${additions.join("\n")}\n`);
          console.log(`\nUpdated ${rootIgnore} (ignored .aidimag/memory.db + config.json + ${folder}/ drops + generated context files; critical-areas.* is committable)`);
        }
      }
      console.log(`\nNext: \`dim bootstrap\` gives this repo an instant starter brain (surveys docs/structure/history, queues reviewable memories).`);
      
      // Ask if user wants to generate context files for non-MCP tools
      const { createPrompter } = await import("../shared.js");
      const prompter = await createPrompter();
      console.log(`\n📝 Generate context files for non-MCP AI tools?`);
      console.log(`   This creates CLAUDE.md, .cursorrules, .windsurfrules, AGENTS.md, and copilot-instructions.md`);
      console.log(`   (useful for Copilot, Cursor, Windsurf, and other tools that read static files)`);
      console.log(`   Options: y (all) | n (skip) | claude | cursorrules | copilot | windsurfrules | agents\n`);
      const choice = (await prompter.ask("Generate now? ")).trim().toLowerCase();
      prompter.close();
      
      if (choice === "y" || choice === "all" || ["claude", "cursorrules", "copilot", "windsurfrules", "agents"].includes(choice)) {
        const { generateContext } = await import("../../context/generate.js");
        const { writeConfig } = await import("../../config.js");
        const format = choice === "y" || choice === "all" ? "all" : choice;
        const store = MemoryStore.open(root);
        const r = generateContext(store, root, format as never);
        store.close();
        writeConfig(root, { generateContext: { auto: true, format: format as never } });
        console.log(`\n✅ Generated ${r.files.join(", ")} with auto-regeneration enabled.`);
        if (r.total === 0) {
          console.log(`   (no memories yet — files will populate after \`dim bootstrap\` or \`dim remember\`)`);
        }
      } else {
        console.log(`\n   Skipped. Run \`dim generate-context --auto --format all\` later if needed.`);
      }

      // Offer to set up Ollama for semantic search + LLM (only if no provider detected)
      if (fresh) {
        const { getEmbeddingProvider } = await import("../../embeddings/provider.js");
        const { getTextProvider } = await import("../../knowledge/llm.js");
        const embProvider = await getEmbeddingProvider();
        const llmProvider = await getTextProvider();
        if (!embProvider && !llmProvider && !process.env.OPENAI_API_KEY) {
          console.log(`\n🧮 Semantic search and LLM features need Ollama models.`);
          console.log(`   Ollama (free, local) provides both — I'll install it and pull an embedding + LLM model.\n`);
          const prompter2 = await createPrompter("n");
          const ollamaChoice = (await prompter2.ask("Set up Ollama now? [y/N] ")).trim().toLowerCase();
          prompter2.close();
          if (ollamaChoice === "y" || ollamaChoice === "yes") {
            const { setupOllamaInteractive } = await import("./setup.js");
            await setupOllamaInteractive();
          } else {
            console.log(`   Skipped. Run \`dim setup-ollama\` anytime to enable semantic search + LLM features.`);
          }
        }
      }
    });

  program
    .command("remember")
    .description("Store a memory (write the claim as a falsifiable statement)")
    .argument("<claim>", "The claim to remember")
    .option("-k, --kind <kind>", `Memory kind: ${KINDS.join("|")}`, "GOTCHA")
    .option("-p, --path <paths...>", "Paths this memory applies to")
    .option("-s, --symbol <symbols...>", "Symbols this memory applies to")
    .option(
      "-e, --evidence <spec...>",
      "Evidence as TYPE:payload, e.g. COMMIT_REF:abc123 or STATIC_CHECK:'grep ...'"
    )
    .option("-g, --guardrail-level <level>", `For kind=GUARDRAIL: ${GUARDRAIL_LEVELS.join("|")}`)
    .option("-a, --applies-when <conditions...>", "For kind=FAILED_APPROACH: conditions under which the failure applies (e.g. idempotency_not_enabled)")
    .option("--pin", "Pin the memory: it never decays with age (evidence failure can still mark it stale)")
    .action(async (claim: string, opts) => {
      const kind = String(opts.kind).toUpperCase() as MemoryKind;
      if (!KINDS.includes(kind)) fail(`invalid kind '${opts.kind}'. Use one of: ${KINDS.join(", ")}`);
      let guardrailLevel: GuardrailLevel | undefined;
      if (kind === "GUARDRAIL") {
        guardrailLevel = (opts.guardrailLevel ?? "ask-first") as GuardrailLevel;
        if (!GUARDRAIL_LEVELS.includes(guardrailLevel)) {
          fail(`invalid --guardrail-level '${opts.guardrailLevel}'. Use one of: ${GUARDRAIL_LEVELS.join(", ")}`);
        }
      } else if (opts.guardrailLevel) {
        fail("--guardrail-level only applies to --kind GUARDRAIL");
      }
      const evidence = (opts.evidence as string[] | undefined)?.map((spec) => {
        const idx = spec.indexOf(":");
        if (idx < 1) fail(`invalid evidence '${spec}'. Format: TYPE:payload`);
        const type = spec.slice(0, idx).toUpperCase() as EvidenceType;
        return { type, payload: spec.slice(idx + 1) };
      });
      const appliesWhen =
        kind === "FAILED_APPROACH" && Array.isArray(opts.appliesWhen) && opts.appliesWhen.length > 0
          ? (opts.appliesWhen as string[])
          : undefined;
      if (opts.appliesWhen && kind !== "FAILED_APPROACH") {
        fail("--applies-when is only meaningful for kind=FAILED_APPROACH");
      }
      const store = MemoryStore.open(process.cwd(), { create: true });
      const entry = store.write({
        kind, claim, paths: opts.path, symbols: opts.symbol, evidence,
        createdBy: "human", pinned: Boolean(opts.pin), guardrailLevel, appliesWhen,
        trustExecutableEvidence: true,
      });
      console.log("🧠 Got it — I'll remember:");
      printMemory(entry, true);
      if (!evidence?.length) {
        console.log(
          `\nTip: claims with evidence re-verify themselves as the code evolves —\n` +
            `     e.g. -e "STATIC_CHECK:grep -q something src/file.ts"`
        );
      }
      await indexMemory(store, entry).catch(() => false);
      await autoSync(store);
      store.close();
    });

  program
    .command("recall")
    .description("Search memories — hybrid keyword + semantic when embeddings are configured")
    .argument("[query...]", "Keywords to search")
    .option("-p, --path <paths...>", "Restrict to memories scoped to these paths")
    .option("-k, --kind <kind>", "Filter by kind")
    .option("-n, --limit <n>", "Max results", "10")
    .option("--all", "Include refuted memories")
    .option("--max-tokens <n>", "Maximum tokens worth of results to display")
    .option("--budget <n>", "Alias for --max-tokens")
    .action(async (query: string[], opts) => {
      const store = MemoryStore.open();
      const { results, semantic } = await hybridSearch(store, {
        query: query.join(" "),
        paths: opts.path,
        kind: opts.kind ? (String(opts.kind).toUpperCase() as MemoryKind) : undefined,
        limit: parseInt(opts.limit, 10),
        includeRefuted: Boolean(opts.all),
      });

      let displayed = results;
      let tokensUsed = 0;
      let dropped = 0;
      const budget = opts.maxTokens || opts.budget;
      if (budget) {
        const budgeted = await applyBudget(
          results.map((m) => ({ memory: m, relevance: 1 })),
          parseInt(budget, 10)
        );
        displayed = budgeted.included.map((x) => x.memory);
        tokensUsed = budgeted.totalTokens;
        dropped = budgeted.dropped;
      }

      if (query.length) {
        try {
          store.logSearch(query.join(" "), opts.path ?? [], displayed.length, "cli");
        } catch (err) {
          // gap logging is best-effort; never break recall
          debugLog("cli search-gap logging", err);
        }
      }
      if (displayed.length === 0) console.log("No matching memories.");
      for (const m of displayed) printMemory(m, true);
      if (budget) {
        const tokenizer = await getTokenizer();
        const fmt = new Intl.NumberFormat("en").format;
        console.log(`\n[token budget: ${fmt(tokensUsed)} / ${fmt(parseInt(budget, 10))} tokens${dropped > 0 ? `, ${fmt(dropped)} dropped` : ""}]`);
      }
      if (query.length && !semantic) {
        console.log("\n(keyword search only — run `dim setup-ollama` for semantic recall, then `dim reindex`)");
      }
      if (budget) {
        try {
          const { recordTokenUsage } = await import("../../analytics.js");
          recordTokenUsage(store, {
            tokensRequested: parseInt(budget, 10),
            tokensDelivered: tokensUsed,
            memoriesUsed: displayed.length,
          });
        } catch { /* best-effort analytics */ }
      }
      store.close();
    });

  program
    .command("context")
    .description("Build a task-scoped context block from the most relevant memories")
    .option("-t, --task <task>", "Description of the coding task")
    .option("--diff", "Scope context to files changed in the working tree")
    .option("--staged", "When used with --diff, only consider staged changes")
    .option("-p, --path <paths...>", "Restrict to memories scoped to these paths")
    .option("-b, --budget <n>", "Token budget for the context block (default: 1200)", "1200")
    .option("--max-chars <n>", "Character budget for the context block (alternative to token budget)", parseInt)
    .option("--preset <name>", "Use a preset budget: minimal (400), standard (1200), deep (4000)")
    .option("-f, --format <fmt>", "Output format: markdown or json", "markdown")
    .action(async (opts) => {
      if (!opts.task && !opts.diff) fail("provide --task or --diff");
      const root = findRepoRoot();
      if (opts.diff && !root) fail("--diff requires a git repo");

      let diffPaths: string[] = [];
      let diffSymbols: string[] = [];
      if (opts.diff) {
        const { gitWorkingTreeFiles } = await import("../../verify/impact.js");
        diffPaths = gitWorkingTreeFiles(root!, Boolean(opts.staged));
        const { gitDiffSymbols } = await import("../../verify/diff-symbols.js");
        diffSymbols = gitDiffSymbols(root!, undefined, Boolean(opts.staged));
      }
      const paths = Array.from(new Set([...(opts.path ?? []), ...diffPaths]));
      const symbols = diffSymbols.length ? diffSymbols : undefined;
      const query = opts.task ?? "";

      const budget = resolveBudget(opts.budget, opts.preset);
      const store = MemoryStore.open();
      const { results } = await hybridSearch(store, { query, paths: paths.length ? paths : undefined, symbols, limit: 50 });

      // Prefer guardrails and invariants first when building context for a coding task.
      const ranked = results
        .map((m) => ({ memory: m, relevance: rankForContext(m) }))
        .sort((a, b) => b.relevance - a.relevance);

      let budgeted: any;
      if (opts.maxChars) {
        budgeted = await applyCharBudget(ranked, opts.maxChars);
      } else {
        budgeted = await applyBudget(ranked, budget);
      }
      const included = budgeted.included.map((x: any) => x.memory);
      try {
        const { recordTokenUsage } = await import("../../analytics.js");
        recordTokenUsage(store, {
          tokensRequested: budget,
          tokensDelivered: budgeted.totalTokens,
          memoriesUsed: included.length,
        });
      } catch { /* best-effort analytics */ }
      store.close();

      if (opts.format === "json") {
        console.log(
          JSON.stringify(
            {
              task: opts.task,
              budget,
              usedTokens: budgeted.totalTokens,
              remainingTokens: budgeted.remainingTokens,
              dropped: budgeted.dropped,
              diffSymbols: diffSymbols.length ? diffSymbols : undefined,
              memories: included.map((m: MemoryEntry) => ({
                id: m.id.slice(0, 8),
                kind: m.kind,
                status: m.status,
                claim: m.claim,
                paths: m.scope.paths,
                symbols: m.scope.symbols,
              })),
            },
            null,
            2
          )
        );
      } else {
        const header = opts.task ? `Context for: ${opts.task}` : `Context for changes in ${paths.join(", ") || "working tree"}`;
        const ruleBlock = included
          .filter((m: MemoryEntry) => m.kind === "GUARDRAIL" || m.kind === "INVARIANT" || m.kind === "CONVENTION")
          .map((m: MemoryEntry) => `- **[${m.kind}]** ${m.claim}`)
          .join("\n");
        const otherBlock = included
          .filter((m: MemoryEntry) => m.kind !== "GUARDRAIL" && m.kind !== "INVARIANT" && m.kind !== "CONVENTION")
          .map((m: MemoryEntry) => `- **[${m.kind}]** ${m.claim}`)
          .join("\n");

        const lines: string[] = [header, ""];
        if (diffSymbols.length) {
          lines.push(`_Symbols detected in diff: ${diffSymbols.slice(0, 10).join(", ")}${diffSymbols.length > 10 ? "…" : ""}_`);
          lines.push("");
        }
        lines.push("### Rules and guardrails", ruleBlock || "_none_", "");
        if (otherBlock) {
          lines.push("### Other relevant memories");
          lines.push(otherBlock);
          lines.push("");
        }
        lines.push(`---`);
        const budgetLabel = opts.maxChars
          ? `Char budget: ${budgeted.totalChars} / ${opts.maxChars} used, ${budgeted.remainingChars} remaining, ${budgeted.dropped} dropped.`
          : `Token budget: ${budgeted.totalTokens} / ${budget} used, ${budgeted.remainingTokens} remaining, ${budgeted.dropped} dropped.`;
        lines.push(budgetLabel);
        console.log(lines.join("\n"));
      }
    });

  program
    .command("reindex")
    .description("Build/refresh semantic embeddings for all memories")
    .action(async () => {
      const store = MemoryStore.open();
      if (!store.vecAvailable) fail("sqlite-vec extension failed to load on this platform");
      const { indexed, provider } = await reindexAll(store);
      if (!provider) {
        const { promptOllamaSetup } = await import("../shared.js");
        const ok = await promptOllamaSetup("embedding");
        if (!ok) fail("no embedding provider available — run `dim setup-ollama` or set OPENAI_API_KEY (see AIDIMAG_EMBEDDINGS)");
        // Retry after setup
        const { indexed: idx2, provider: p2 } = await reindexAll(store);
        if (!p2) fail("embedding provider still not available — run `dim setup-ollama` manually");
        console.log(`Indexed ${idx2} memorie(s) with ${p2.name}/${p2.model} (${p2.dim}d).`);
      } else {
        console.log(`Indexed ${indexed} memorie(s) with ${provider.name}/${provider.model} (${provider.dim}d).`);
      }
      store.close();
    });

  program
    .command("status")
    .description("Memory store summary")
    .action(() => {
      const store = MemoryStore.open();
      const s = store.statusSummary();
      console.log(`aidimag @ ${s.dbPath}`);
      console.log(`total memories: ${s.total}`);
      console.log(`  by status: ${Object.entries(s.byStatus).map(([k, v]) => `${k}=${v}`).join("  ")}`);
      if (Object.keys(s.byKind).length) {
        console.log(`  by kind:   ${Object.entries(s.byKind).map(([k, v]) => `${k}=${v}`).join("  ")}`);
      }
      if (s.pinned) {
        console.log(`  pinned:    ${s.pinned} (exempt from time decay)`);
      }
      if (s.pendingProposals) {
        console.log(`\n${s.pendingProposals} proposal(s) awaiting review — run \`dim review\``);
      }
      store.close();
    });

  program
    .command("log")
    .description("Show recent memories")
    .option("-n, --limit <n>", "Max entries", "20")
    .action((opts) => {
      const store = MemoryStore.open();
      const memories = store.list(parseInt(opts.limit, 10));
      if (memories.length === 0) console.log("No memories yet. Try `dim remember \"...\"`.");
      for (const m of memories) printMemory(m);
      store.close();
    });

  program
    .command("gaps")
    .description("Knowledge gaps: searches agents/you ran that returned NOTHING — the facts your brain is missing")
    .option("-d, --days <n>", "Look-back window in days", "30")
    .option("-n, --limit <n>", "Max entries", "20")
    .option("--clear", "Clear the search log after showing")
    .action((opts) => {
      const store = MemoryStore.open();
      const gaps = store.searchGaps({ sinceDays: parseInt(opts.days, 10), limit: parseInt(opts.limit, 10) });
      if (gaps.length === 0) {
        console.log(`No knowledge gaps in the last ${opts.days} day(s) — every search found something.`);
      } else {
        console.log(`${gaps.length} knowledge gap(s) in the last ${opts.days} day(s) — most-asked first:\n`);
        for (const g of gaps) {
          const scope = g.paths.length ? `  [scope: ${g.paths.join(", ")}]` : "";
          console.log(`  ${String(g.misses).padStart(3)}× "${g.query}"${scope}  (last: ${g.lastAsked.slice(0, 10)})`);
        }
        console.log(`\nFill a gap: dim remember "<the answer>" -k <kind> [-e TYPE:proof]`);
      }
      if (opts.clear) {
        const n = store.clearSearchGaps();
        console.log(`\nCleared ${n} logged search(es).`);
      }
      store.close();
    });

  program
    .command("scratch")
    .description("Short-term scratchpad (session working memory): TTL-expiring notes, never synced, never durable memory")
    .argument("[note...]", "Note to jot down; omit to list current notes")
    .option("--session <id>", "Session/topic key", "default")
    .option("--ttl <hours>", "Hours until the note expires", "24")
    .option("--clear", "Clear notes (this --session, or --all)")
    .option("--all", "With --clear: clear every session; when listing: show all sessions")
    .action((note: string[], opts) => {
      const store = MemoryStore.open();
      try {
        if (opts.clear) {
          const n = store.scratchpadClear(opts.all ? undefined : opts.session);
          console.log(`Cleared ${n} scratchpad note(s)${opts.all ? "" : ` in session '${opts.session}'`}.`);
        } else if (note.length) {
          const ttl = parseFloat(opts.ttl);
          if (!Number.isFinite(ttl) || ttl <= 0) fail(`invalid --ttl '${opts.ttl}'`);
          const entry = store.scratchpadWrite(note.join(" "), {
            sessionId: opts.session,
            ttlHours: ttl,
            createdBy: "human",
          });
          console.log(`📝 jotted (session=${entry.sessionId}, expires ${entry.expiresAt.slice(0, 16)})`);
          console.log(`   Scratch notes are short-term. Keep it forever with \`dim remember\`.`);
        } else {
          const notes = store.scratchpadRead(opts.all ? undefined : opts.session);
          if (notes.length === 0) {
            console.log("Scratchpad is empty.");
          } else {
            for (const n of notes) {
              console.log(`- [${n.sessionId} · ${n.createdAt.slice(0, 16)} · by ${n.createdBy}] ${n.content}`);
            }
            console.log(`\n${notes.length} note(s). They expire automatically; \`dim scratch --clear\` wipes them now.`);
          }
        }
      } finally {
        store.close();
      }
    });

  program
    .command("audit-findings")
    .description("Provenance audit: memories resting on the least ground — agent-authored, evidence-free, stale, or long-unverified")
    .option("-n, --limit <n>", "Max entries", "20")
    .action((opts) => {
      const store = MemoryStore.open();
      const findings = store.auditMemories({ limit: parseInt(opts.limit, 10) });
      if (findings.length === 0) {
        console.log("✓ Nothing suspicious — every memory is human/knowledge-authored, evidenced, and recently verified.");
      } else {
        console.log(`${findings.length} memorie(s) worth a look — highest risk first:\n`);
        for (const f of findings) {
          printMemory(f.memory);
          for (const r of f.reasons) console.log(`    ⚠ ${r}`);
        }
        console.log(
          `\nFix-ups: \`dim update <id> -e TYPE:proof\` adds evidence · \`dim verify\` re-checks · ` +
            `\`dim refute <id>\` / \`dim forget <id>\` removes.`
        );
      }
      store.close();
    });

  program
    .command("refute")
    .description("Mark a memory REFUTED (kept as negative knowledge, unlike forget)")
    .argument("<id>", "Memory id (full or 8-char prefix)")
    .option("-s, --superseded-by <id>", "Id of a newer memory replacing it")
    .action(async (id: string, opts) => {
      const store = MemoryStore.open();
      const match = store.list(1000).find((m) => m.id === id || m.id.startsWith(id));
      if (!match) fail(`no memory matching id '${id}'`);
      store.refute(match.id, opts.supersededBy);
      console.log(`✗ refuted ${match.id.slice(0, 8)}: "${match.claim}"`);
      await autoSync(store);
      store.close();
    });

  program
    .command("pin")
    .description("Pin a memory: it stays with the project forever — never decays with age (evidence failure can still mark it stale)")
    .argument("<id>", "Memory id (full or 8-char prefix)")
    .action(async (id: string) => {
      const store = MemoryStore.open();
      const match = store.list(1000).find((m) => m.id === id || m.id.startsWith(id));
      if (!match) fail(`no memory matching id '${id}'`);
      store.setPinned(match.id, true);
      console.log(`📌 pinned ${match.id.slice(0, 8)}: "${match.claim}"`);
      console.log(`   It won't decay with age. Evidence checks still apply — a failing check marks it stale.`);
      await autoSync(store);
      store.close();
    });

  program
    .command("unpin")
    .description("Unpin a memory — normal confidence decay resumes")
    .argument("<id>", "Memory id (full or 8-char prefix)")
    .action(async (id: string) => {
      const store = MemoryStore.open();
      const match = store.list(1000).find((m) => m.id === id || m.id.startsWith(id));
      if (!match) fail(`no memory matching id '${id}'`);
      store.setPinned(match.id, false);
      console.log(`unpinned ${match.id.slice(0, 8)}: "${match.claim}" — normal decay resumes.`);
      await autoSync(store);
      store.close();
    });

  program
    .command("update")
    .description("Update a memory's claim, kind, or add/remove evidence")
    .argument("<id>", "Memory id (full or 8-char prefix)")
    .option("-c, --claim <text>", "Update the claim text")
    .option("-k, --kind <kind>", `Change memory kind: ${KINDS.join("|")}`)
    .option("-g, --guardrail-level <level>", `For kind=GUARDRAIL: ${GUARDRAIL_LEVELS.join("|")}`)
    .option("-e, --evidence <ev...>", "Add evidence (format: TYPE:payload)")
    .option("--remove-evidence <id>", "Remove evidence by id prefix")
    .action(async (id: string, opts) => {
      const store = MemoryStore.open();
      const match = store.list(1000).find((m) => m.id === id || m.id.startsWith(id));
      if (!match) fail(`no memory matching id '${id}'`);

      const updates: any = {};
      if (opts.claim) updates.claim = opts.claim.trim();
      if (opts.kind) {
        if (!KINDS.includes(opts.kind as any)) fail(`invalid kind '${opts.kind}' — must be one of: ${KINDS.join(", ")}`);
        updates.kind = opts.kind;
      }
      if (opts.guardrailLevel) {
        if (updates.kind !== "GUARDRAIL" && match.kind !== "GUARDRAIL") {
          fail("--guardrail-level only applies to GUARDRAIL memories");
        }
        if (!GUARDRAIL_LEVELS.includes(opts.guardrailLevel as any)) {
          fail(`invalid --guardrail-level '${opts.guardrailLevel}' — must be one of: ${GUARDRAIL_LEVELS.join(", ")}`);
        }
        updates.guardrailLevel = opts.guardrailLevel;
      }

      if (Object.keys(updates).length > 0) {
        store.update(match.id, updates);
        console.log(`✓ Updated memory ${match.id.slice(0, 8)}`);
      }

      // Add evidence
      for (const ev of opts.evidence || []) {
        const [type, ...payloadParts] = ev.split(":");
        const payload = payloadParts.join(":");
        if (!payload) fail(`evidence format: TYPE:payload (e.g. STATIC_CHECK:grep -r "foo" src/)`);
        store.addEvidence(match.id, { type: type as any, payload });
        console.log(`✓ Added evidence: ${type}`);
      }

      // Remove evidence
      if (opts.removeEvidence) {
        const evidence = match.grounding.find((e) => e.id === opts.removeEvidence || e.id.startsWith(opts.removeEvidence));
        if (!evidence) fail(`no evidence matching id '${opts.removeEvidence}'`);
        store.removeEvidence(evidence.id);
        console.log(`✓ Removed evidence ${evidence.id.slice(0, 8)}`);
      }

      await autoSync(store);
      store.close();
    });

  program
    .command("forget")
    .description("Delete a memory permanently (prefer refuting via agents)")
    .argument("<id>", "Memory id (full or 8-char prefix)")
    .action(async (id: string) => {
      const store = MemoryStore.open();
      // allow prefix match
      const match = store.list(1000).find((m) => m.id === id || m.id.startsWith(id));
      if (!match) fail(`no memory matching id '${id}'`);
      store.forget(match.id);
      console.log(`Forgot memory ${match.id}: "${match.claim}"`);
      await autoSync(store);
      store.close();
    });

  program
    .command("retention")
    .description("Apply retention policy: auto-forget old, evidence-free memories (configured in .aidimag/config.json)")
    .option("--dry-run", "Report what would be forgotten without deleting")
    .option("--max-age-days <n>", "Override maxAgeDays from config", parseInt)
    .option("--stale-age-days <n>", "Override staleAgeDays from config", parseInt)
    .action(async (opts) => {
      const root = findRepoRoot();
      if (!root) fail("not inside a git repo");
      const { resolveRetentionConfig } = await import("../../config.js");
      const cfg = resolveRetentionConfig(root);
      const maxAgeDays = opts.maxAgeDays ?? cfg.maxAgeDays;
      const staleAgeDays = opts.staleAgeDays ?? cfg.staleAgeDays;
      const dryRun = opts.dryRun ?? cfg.dryRun;

      if (maxAgeDays === 0 && staleAgeDays === 0) {
        console.log("Retention policy is not configured. Set retention.maxAgeDays in .aidimag/config.json, or pass --max-age-days.");
        return;
      }

      const store = MemoryStore.open();
      const eligible = store.applyRetention({
        maxAgeDays,
        staleAgeDays,
        preservePinned: cfg.preservePinned,
        preserveSources: cfg.preserveSources,
        dryRun,
      });

      if (eligible.length === 0) {
        console.log("✓ No memories eligible for retention cleanup.");
      } else {
        const action = dryRun ? "Would forget" : "Forgot";
        console.log(`${action} ${eligible.length} memorie(s):\n`);
        for (const m of eligible) {
          const ageDays = Math.floor((Date.now() - Date.parse(m.createdAt)) / 86_400_000);
          const reasons: string[] = [];
          if (m.grounding.length === 0) reasons.push("no evidence");
          if (m.status === "STALE") reasons.push("STALE");
          reasons.push(`${ageDays}d old`);
          console.log(`  ${m.id.slice(0, 8)} [${m.kind}] "${m.claim.slice(0, 80)}" — ${reasons.join(", ")}`);
        }
        if (!dryRun) await autoSync(store);
      }
      store.close();
    });
}

