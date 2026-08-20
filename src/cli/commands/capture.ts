/**
 * Capture & review commands: mine (commits/PRs), bootstrap, harvest, review.
 */

import type { Command } from "commander";
import { existsSync } from "node:fs";
import path from "node:path";
import { MemoryStore, findRepoRoot } from "../../db/store.js";
import { mineCommits, describeMineResult } from "../../capture/commit-miner.js";
import { fail, autoSync, maybeRegenerateContext, printProposal, createPrompter, promptOllamaSetup } from "../shared.js";

/**
 * Conversational review: walk the queue one proposal at a time —
 * keep / reword / drop / skip. The human gate, made friendly.
 */
async function interactiveReview(store: MemoryStore): Promise<{ kept: number; rejected: number }> {
  const { triagePending } = await import("../../capture/triage.js");
  const triaged = triagePending(store, 1000);
  const pending = triaged.map((t) => t.proposal);
  const scoreOf = new Map(triaged.map((t) => [t.proposal.id, t] as const));
  if (pending.length === 0) {
    console.log("✨ Nothing waiting on you — the review queue is empty.");
    return { kept: 0, rejected: 0 };
  }
  const { ask, close } = await createPrompter("q"); // closed stdin = quit
  let kept = 0;
  let rejected = 0;
  let skipped = 0;
  // T2: lazy ticket enrichment — fetched at review time, never at capture time
  const reviewRoot = findRepoRoot();
  const { ticketProviderFor } = await import("../../tickets/provider.js");
  const provider = reviewRoot ? ticketProviderFor(reviewRoot) : null;
  const plural = pending.length === 1 ? "proposal is" : "proposals are";
  console.log(`🧠 ${pending.length} memory ${plural} waiting for your review (best first).\n`);
  try {
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const src = p.source === "commit-miner" ? `mined from commit ${p.sourceRef?.slice(0, 8) ?? "?"}` : `proposed by ${p.source}`;
      const tri = scoreOf.get(p.id);
      console.log(`── ${i + 1} of ${pending.length} ── ${p.kind} · ${src}${tri ? ` · score ${tri.score.toFixed(2)}` : ""}`);
      if (tri?.reasons.length) console.log(`   (${tri.reasons.join(", ")})`);
      console.log(`\n   “${p.claim}”\n`);
      if (p.paths.length || p.symbols.length) console.log(`   applies to: ${[...p.paths, ...p.symbols].join(", ")}`);
      if (p.evidence.length)
        console.log(`   evidence:   ${p.evidence.map((e) => `${e.type}:${e.payload.slice(0, 60)}`).join("  ")}`);
      if (p.ticketRef) {
        let ticketLine = p.ticketRef;
        if (provider) {
          const t = await provider.getTicket(p.ticketRef).catch(() => null);
          if (t) {
            ticketLine = `${t.id} “${t.title}” (${t.type}, ${t.status}) — ${t.url}`;
            if (t.body) console.log(`   ticket:     ${ticketLine}\n               ${t.body.slice(0, 200).replace(/\s+/g, " ")}${t.body.length > 200 ? "…" : ""}`);
            else console.log(`   ticket:     ${ticketLine}`);
          } else {
            console.log(`   ticket:     ${ticketLine} (couldn't fetch — provider offline or ticket missing)`);
          }
        } else {
          console.log(`   ticket:     ${ticketLine}`);
        }
      }
      if (p.rationale) console.log(`   why:        ${p.rationale}`);

      const ans = (
        await ask("\n   Keep this? [y]es · [e]dit wording · [n]o, drop it · [s]kip · [q]uit  ")
      )
        .trim()
        .toLowerCase();

      if (ans === "q" || ans === "quit") {
        skipped += pending.length - i;
        break;
      } else if (ans === "y" || ans === "yes") {
        const m = store.approveProposal(p.id);
        kept++;
        console.log(`   ✓ Remembered (${m.id.slice(0, 8)}).\n`);
      } else if (ans === "e" || ans === "edit") {
        const claim = (await ask("   Your wording (enter keeps the original):\n   › ")).trim();
        const m = store.approveProposal(p.id, claim ? { claim } : undefined);
        kept++;
        console.log(claim ? `   ✓ Remembered with your wording (${m.id.slice(0, 8)}).\n` : `   ✓ Remembered as-is (${m.id.slice(0, 8)}).\n`);
      } else if (ans === "n" || ans === "no") {
        store.rejectProposal(p.id);
        rejected++;
        console.log("   ✗ Dropped — it won't be proposed again.\n");
      } else {
        skipped++;
        console.log("   ↷ Skipped — it'll be here next time.\n");
      }
    }
  } finally {
    close();
  }
  const bits = [
    kept ? `${kept} remembered` : null,
    rejected ? `${rejected} dropped` : null,
    skipped ? `${skipped} left for later` : null,
  ].filter(Boolean);
  console.log(`Done — ${bits.length ? bits.join(", ") : "no changes"}.${kept ? " Run `dim verify` to put the new memories to the test." : ""}`);
  return { kept, rejected };
}

export function registerCaptureCommands(program: Command): void {
  program
    .command("mine")
    .description("Mine git history for memory candidates (queued for review, never auto-saved)")
    .option("-n, --max <n>", "Max commits to scan", "500")
    .option("--full", "Rescan from the beginning of history (ignore cursor)")
    .option("--llm", "Deep mining: LLM reads each commit's message AND diff, synthesizes claims + suggested checks (needs Ollama/OPENAI_API_KEY; slower, much higher quality)")
    .option("--prs", "Mine merged GitHub PRs + review comments instead of commits (needs the `gh` CLI and an LLM provider; review threads carry the unwritten rules)")
    .option("-q, --quiet", "Only speak up when candidates are found (for the post-commit hook)")
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      if (!existsSync(path.join(root, ".git"))) fail("commit mining requires a git repo");
      const store = MemoryStore.open(root, { create: true });

      if (opts.prs) {
        const { minePrs, ghAvailable } = await import("../../capture/pr-miner.js");
        if (!ghAvailable(root)) {
          store.close();
          fail("PR mining needs the GitHub CLI — install `gh` and run `gh auth login`");
        }
        const r = await minePrs(store, root, { max: opts.max ? parseInt(opts.max, 10) : undefined, all: Boolean(opts.full) });
        if (!r.provider) {
          store.close();
          const ok = await promptOllamaSetup("llm");
          if (!ok) fail("no LLM provider available — run `dim setup-ollama` or set OPENAI_API_KEY (see AIDIMAG_LLM)");
          store.close();
          return;
        }
        console.log(
          `Scanned ${r.scanned} merged PR(s) with ${r.provider}: ${r.proposed.length} proposal(s) queued` +
            (r.skippedDuplicates ? `, ${r.skippedDuplicates} duplicate(s) skipped` : "")
        );
        for (const p of r.proposed) printProposal(p);
        if (r.proposed.length) console.log(`\nReview with \`dim review\`.`);
        else if (r.scanned === 0) console.log("No newly merged PRs since the last run (use --full to rescan).");
        store.close();
        return;
      }

      let res;
      let llmProvider: string | null = null;
      if (opts.llm) {
        const { mineCommitsLlm } = await import("../../capture/commit-miner.js");
        const r = await mineCommitsLlm(store, root, {
          maxCommits: parseInt(opts.max, 10),
          full: Boolean(opts.full),
        });
        res = r;
        llmProvider = r.provider;
        if (!llmProvider && !opts.quiet) {
          console.log("(no LLM provider available — fell back to keyword mining)");
          const ok = await promptOllamaSetup("llm");
          if (ok) console.log("(re-run with --llm to use the LLM provider)");
        }
      } else {
        res = mineCommits(store, root, {
          maxCommits: parseInt(opts.max, 10),
          full: Boolean(opts.full),
        });
      }
      if (opts.quiet) {
        // post-commit hook mode: a single gentle nudge, nothing else
        if (res.proposed.length > 0) {
          const total = store.listProposals("PENDING", 1000).length;
          console.log(
            `🧠 aidimag: this commit looks memory-worthy — ${res.proposed.length} proposal(s) queued` +
              ` (${total} pending). Review with \`dim review\`.`
          );
        }
        store.close();
        return;
      }
      if (res.noCommits || res.noNewCommits) {
        console.log(describeMineResult(res, { llmProvider, llmRequested: Boolean(opts.llm) }));
        store.close();
        return;
      }
      console.log(describeMineResult(res, { llmProvider, llmRequested: Boolean(opts.llm) }));
      for (const p of res.proposed) printProposal(p);
      store.close();
    });

  program
    .command("bootstrap")
    .description("Give a fresh repo an instant brain: survey README/docs/manifests/structure/churn and LLM-extract an initial memory set (queued for review)")
    .option("--force", "Re-run even if this repo was already bootstrapped")
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      const store = MemoryStore.open(root, { create: true });
      const { bootstrapRepo } = await import("../../capture/bootstrap.js");
      console.log("Surveying the repo (docs, manifests, structure, churn)…");
      const res = await bootstrapRepo(store, root, { force: Boolean(opts.force) });
      if (res.alreadyBootstrapped) {
        console.log("Already bootstrapped — use --force to re-run (dedupe absorbs repeats).");
      } else if (!res.provider) {
        const ok = await promptOllamaSetup("llm");
        if (!ok) fail("no LLM provider available — run `dim setup-ollama` or set OPENAI_API_KEY (see AIDIMAG_LLM)");
      } else {
        console.log(
          `Surveyed ${res.surveyedFiles.length} file(s) with ${res.provider}: ` +
            `${res.proposed} proposal(s) queued${res.duplicates ? `, ${res.duplicates} duplicate(s) skipped` : ""}.`
        );
        if (res.proposed) {
          console.log(`\nYour repo's starter brain is ready for review: \`dim review\``);
          console.log(`(then \`dim verify\` to put the suggested checks to the test)`);
        } else {
          console.log("No durable claims extracted — the survey found little written-down knowledge. Feed docs into knowledge/ or use `dim mine --llm`.");
        }
      }
      store.close();
    });

  program
    .command("harvest")
    .description("Harvest durable facts YOU typed into AI chats (Claude Code, Codex CLI, Copilot/VS Code, Cursor) into the review queue — local-only, secrets redacted")
    .option("--all", "Rescan every session (ignore cursor; dedupe absorbs repeats)")
    .option("--source <names>", "Comma-separated sources to harvest: claude-code,codex,copilot-vscode,cursor (default: all detected)")
    .option("--install-hook", "Wire `dim harvest -q` into this repo's Claude Code SessionEnd hook (.claude/settings.json)")
    .option("-q, --quiet", "Only speak up when proposals are queued (for the SessionEnd hook)")
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      const { harvestSessions, installClaudeSessionEndHook } = await import("../../capture/harvest.js");
      if (opts.installHook) {
        const { installed, settingsPath } = installClaudeSessionEndHook(root);
        console.log(
          installed
            ? `✓ SessionEnd hook installed in ${settingsPath} — every Claude Code session is now harvested on close.`
            : `Hook already present in ${settingsPath} — nothing to do.`
        );
        return;
      }
      const sources = typeof opts.source === "string"
        ? opts.source.split(",").map((s: string) => s.trim()).filter(Boolean)
        : undefined;
      const store = MemoryStore.open(root, { create: true });
      const res = await harvestSessions(store, root, { all: Boolean(opts.all), sources });
      if (opts.quiet) {
        if (res.proposed > 0) {
          console.log(
            `🧠 aidimag: harvested ${res.proposed} memory candidate(s) from your AI chat — review with \`dim review\`.`
          );
        }
        store.close();
        return;
      }
      if (!res.sources.length) {
        console.log("No AI-chat transcripts found for this repo (checked Claude Code, Codex CLI, Copilot/VS Code, Cursor).");
        console.log("Transcripts appear after your first chat session in this repo. Devin is cloud-hosted and can't be harvested locally.");
      } else if (!res.provider) {
        const ok = await promptOllamaSetup("llm");
        if (!ok) fail("no LLM provider available — run `dim setup-ollama` or set OPENAI_API_KEY (see AIDIMAG_LLM)");
      } else if (res.sessionsScanned === 0) {
        const names = res.sources.map((s) => s.label).join(", ");
        console.log(`No new sessions since the last harvest (sources: ${names}). Use --all to rescan everything.`);
      } else {
        console.log(
          `Scanned ${res.sessionsScanned} session(s), ${res.messagesConsidered} user message(s) via ${res.provider}: ` +
            `${res.proposed} proposal(s) queued` +
            (res.duplicates ? `, ${res.duplicates} duplicate(s) skipped` : "") +
            "."
        );
        for (const s of res.sources) {
          if (s.sessionsScanned === 0) continue;
          console.log(`  ${s.label}: ${s.sessionsScanned} session(s), ${s.proposed} proposal(s)`);
        }
        if (res.proposed) console.log(`Review with \`dim review\`.`);
      }
      if (res.sources.some((s) => s.source === "claude-code")) {
        console.log(`(tip: \`dim harvest --install-hook\` runs this automatically when each Claude Code session ends)`);
      }
      store.close();
    });

  program
    .command("review")
    .description("Review pending memory proposals — interactive walkthrough by default (list | approve | reject for scripting)")
    .argument("[action]", "interactive (default in a terminal) | list | approve | reject")
    .argument("[id]", "Proposal id (8-char prefix ok); 'all' with approve/reject applies to every pending proposal")
    .option("-n, --limit <n>", "Max proposals to list", "50")
    .option("--min-score <s>", "With 'approve all': only approve proposals triaged at or above this score (0–1)")
    .action(async (action: string | undefined, id: string | undefined, opts) => {
      const store = MemoryStore.open();
      const effective = action ?? (process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "list");
      switch (effective) {
        case "interactive": {
          const { kept, rejected } = await interactiveReview(store);
          if (kept + rejected > 0) await autoSync(store);
          break;
        }
        case "list": {
          const { triagePending } = await import("../../capture/triage.js");
          const triaged = triagePending(store, parseInt(opts.limit, 10));
          if (triaged.length === 0) console.log("No pending proposals.");
          for (const t of triaged) {
            console.log(`  score ${t.score.toFixed(2)}${t.reasons.length ? ` (${t.reasons.join(", ")})` : ""}`);
            printProposal(t.proposal);
          }
          if (triaged.length) {
            console.log(`\nApprove: dim review approve <id> | Reject: dim review reject <id> | Walkthrough: dim review`);
            console.log(`Batch: dim review approve all --min-score 0.7`);
          }
          break;
        }
        case "approve": {
          if (!id) fail("usage: dim review approve <id|all> [--min-score <s>]");
          let targets: string[];
          if (id === "all") {
            const { triagePending } = await import("../../capture/triage.js");
            const minScore = opts.minScore !== undefined ? parseFloat(opts.minScore) : null;
            const triaged = triagePending(store, 1000);
            const chosen = minScore === null ? triaged : triaged.filter((t) => t.score >= minScore);
            targets = chosen.map((t) => t.proposal.id);
            if (minScore !== null) {
              console.log(`${chosen.length} of ${triaged.length} pending proposal(s) scored ≥ ${minScore}.`);
            }
          } else {
            targets = [id];
          }
          for (const t of targets) {
            const entry = store.approveProposal(t);
            console.log(`✓ approved → memory ${entry.id.slice(0, 8)}: ${entry.claim}`);
          }
          break;
        }
        case "reject": {
          if (!id) fail("usage: dim review reject <id|all>");
          const targets =
            id === "all" ? store.listProposals("PENDING", 1000).map((p) => p.id) : [id];
          for (const t of targets) {
            const p = store.rejectProposal(t);
            console.log(`✗ rejected ${p.id.slice(0, 8)}: ${p.claim}`);
          }
          break;
        }
        default:
          fail(`unknown action '${action}'. Use: list | approve | reject (or no action for the walkthrough)`);
      }
      if (effective === "approve" || effective === "reject") await autoSync(store);
      await maybeRegenerateContext(store);
      store.close();
    });

  const proposalsCmd = program.command("proposals").description("Proposal housekeeping");
  proposalsCmd
    .command("gc")
    .description("Remove resolved (approved/rejected) proposal rows and tombstone for team sync")
    .option("--dry-run", "Report how many rows would be removed without deleting")
    .action(async (opts) => {
      const store = MemoryStore.open();
      try {
        const { removed } = store.gcResolvedProposals({ dryRun: Boolean(opts.dryRun) });
        if (removed === 0) {
          console.log("No resolved proposals to remove.");
        } else if (opts.dryRun) {
          console.log(`${removed} resolved proposal row(s) would be removed. Run without --dry-run to apply.`);
        } else {
          console.log(`Removed ${removed} resolved proposal row(s). Run \`dim sync\` to propagate deletions.`);
          await autoSync(store);
        }
      } finally {
        store.close();
      }
    });

  program
    .command("capture")
    .description("Capture from external sources (incident reports, CI failures)")
    .argument("<type>", "Source type: incident | ci-log")
    .argument("[file]", "Path to the incident report (JSON, markdown) or CI log (.log, .txt). Use '-' for stdin. Omit when using --github or --batch.")
    .option("--llm", "Use an LLM provider to synthesize a richer claim (needs Ollama/OPENAI_API_KEY)")
    .option("--github [run-id]", "Fetch failed GitHub Actions run logs via `gh` CLI. Use 'latest' or a numeric run ID. Requires gh CLI authenticated.")
    .option("--batch <dir>", "Bulk ingest all incident reports from a directory (JSON, markdown, .log, .txt files)")
    .action(async (type, file, opts) => {
      const root = findRepoRoot() ?? fail("not inside a repo");
      const store = MemoryStore.open(root, { create: true });
      try {
        const { parseReport, parseCiLog, mineIncident } = await import("../../capture/incident-miner.js");

        // --github: fetch failed run logs from GitHub Actions
        if (opts.github) {
          if (type !== "ci-log") fail("--github is only valid with 'ci-log' type");
          const { execFileSync: exec } = await import("node:child_process");
          const runId = typeof opts.github === "string" ? opts.github : "latest";

          let rawLog: string;
          try {
            if (runId === "latest") {
              // Find the most recent failed run
              const runsJson = exec("gh", ["run", "list", "--status", "failure", "--limit", "1", "--json", "databaseId,databaseId"], { cwd: root, encoding: "utf8" });
              const runs = JSON.parse(runsJson);
              if (!runs.length) {
                console.log("No failed GitHub Actions runs found.");
                return;
              }
              const id = runs[0].databaseId;
              rawLog = exec("gh", ["run", "view", String(id), "--log-failed"], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
            } else {
              rawLog = exec("gh", ["run", "view", runId, "--log-failed"], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
            }
          } catch (e) {
            fail(`Failed to fetch GitHub Actions logs via gh CLI: ${(e as Error).message}\nEnsure gh is installed and authenticated (gh auth login).`);
          }

          const report = parseCiLog(rawLog);
          const result = await mineIncident(store, report, { llm: Boolean(opts.llm) });

          if (result.proposed.length === 0) {
            console.log("No new proposal — a duplicate of this CI failure was already queued.");
          } else {
            console.log("📋 Captured 1 FAILED_APPROACH proposal from GitHub Actions CI log.");
            for (const p of result.proposed) printProposal(p);
            console.log("\nReview with `dim review`.");
          }
          return;
        }

        // --batch: bulk ingest from a directory
        if (opts.batch) {
          if (type !== "incident") fail("--batch is only valid with 'incident' type");
          const { readdirSync } = await import("node:fs");
          const dir = opts.batch;
          let files: string[];
          try {
            files = readdirSync(dir).filter((f) => /\.(json|md|log|txt)$/i.test(f)).map((f) => path.join(dir, f));
          } catch {
            fail(`Cannot read directory: ${dir}`);
          }
          if (files.length === 0) {
            console.log(`No report files found in ${dir}`);
            return;
          }

          let proposed = 0;
          let skipped = 0;
          for (const f of files) {
            try {
              const report = parseReport(f);
              const result = await mineIncident(store, report, { llm: Boolean(opts.llm) });
              proposed += result.proposed.length;
              skipped += result.skippedDuplicates;
            } catch (e) {
              console.error(`  ⚠ Failed to parse ${path.basename(f)}: ${(e as Error).message}`);
            }
          }
          console.log(`📋 Batch capture: ${proposed} proposal(s) queued, ${skipped} duplicate(s) skipped from ${files.length} file(s).`);
          console.log("Review with `dim review`.");
          return;
        }

        // Normal single-file mode
        if (!file) fail("provide a file path, or use --github / --batch");
        let report;
        if (type === "ci-log") {
          const { readFileSync: readFileSyncSync } = await import("node:fs");
          const raw = file === "-"
            ? await new Promise<string>((resolve) => {
                let data = "";
                process.stdin.setEncoding("utf8");
                process.stdin.on("data", (chunk) => (data += chunk));
                process.stdin.on("end", () => resolve(data));
              })
            : readFileSyncSync(file, "utf8");
          report = parseCiLog(raw);
        } else if (type === "incident") {
          report = parseReport(file);
        } else {
          fail(`unknown capture type '${type}'. Use: incident | ci-log`);
        }

        const result = await mineIncident(store, report, { llm: Boolean(opts.llm) });

        if (result.proposed.length === 0) {
          console.log(`No new proposal — a duplicate of this incident was already queued.`);
        } else {
          console.log(`📋 Captured 1 FAILED_APPROACH proposal from ${type === "ci-log" ? "CI log" : "incident report"}.`);
          for (const p of result.proposed) printProposal(p);
          console.log(`\nReview with \`dim review\`.`);
        }
      } finally {
        store.close();
      }
    });
}

