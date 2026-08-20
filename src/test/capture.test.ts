/**
 * Capture-pipeline unit tests: triage scoring (incl. the correction loop),
 * transcript harvesting helpers, claim extraction, and commit classification.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MemoryStore } from "../db/store.js";
import { scoreProposal, claimSimilarity, triagePending } from "../capture/triage.js";
import { userMessagesFromTranscript, redactSecrets } from "../capture/harvest.js";
import { codexTranscript, copilotUserMessages } from "../capture/transcript-sources.js";
import { parseClaims, dedupeClaims } from "../knowledge/extract.js";
import { classifyCommit, scopeFromFiles, detectRevert, mineCommits } from "../capture/commit-miner.js";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { buildPrPrompt } from "../capture/pr-miner.js";
import type { Proposal } from "../types.js";

function fakeProposal(over: Partial<Proposal>): Proposal {
  return {
    id: "p1",
    kind: "CONVENTION",
    claim: "All network calls go through src/services",
    paths: [],
    symbols: [],
    evidence: [],
    source: "commit-miner",
    createdAt: new Date().toISOString(),
    status: "PENDING",
    memoryId: null,
    ...over,
  };
}

// ---------------------------------------------------------------- triage

test("triage: machine evidence + trusted source outrank bare miner output", () => {
  const rich = scoreProposal(
    fakeProposal({
      source: "context:claude-code",
      paths: ["src/services"],
      evidence: [
        { type: "STATIC_CHECK", payload: "grep -q fetch src/services" },
        { type: "HUMAN_ATTESTED", payload: "user said so" },
      ],
    }),
    [],
    []
  );
  const bare = scoreProposal(fakeProposal({ source: "commit-miner" }), [], []);
  assert.ok(rich.score > bare.score, `${rich.score} should beat ${bare.score}`);
  assert.ok(rich.reasons.includes("machine-checkable evidence"));
  assert.ok(rich.reasons.includes("user-stated in chat"));
});

test("triage correction loop: similarity to rejected claims sinks the score", () => {
  const rejected = ["All network calls go through src/services layer only"];
  const withPenalty = scoreProposal(fakeProposal({}), rejected, []);
  const without = scoreProposal(fakeProposal({}), [], []);
  assert.ok(withPenalty.score < without.score);
  assert.ok(withPenalty.reasons.some((r) => r.includes("rejected")));
});

test("claimSimilarity: near-duplicates high, unrelated low", () => {
  assert.ok(claimSimilarity("Retries are handled in src/queue only", "retries handled in src/queue") > 0.5);
  assert.ok(claimSimilarity("Retries are handled in src/queue", "The dashboard uses Vue components") < 0.2);
});

test("triagePending orders the real queue best-first", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-triage-"));
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.propose({ kind: "GOTCHA", claim: "Weak unscoped claim from mining", source: "commit-miner" });
    store.propose({
      kind: "CONVENTION",
      claim: "User-stated: payments retries live in src/queue",
      source: "context:agent",
      paths: ["src/queue"],
      evidence: [{ type: "HUMAN_ATTESTED", payload: "user said" }],
    });
    const triaged = triagePending(store);
    assert.equal(triaged.length, 2);
    assert.equal(triaged[0].proposal.source, "context:agent");
    assert.ok(triaged[0].score > triaged[1].score);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- harvest helpers

test("userMessagesFromTranscript keeps real human turns only", () => {
  const jsonl = [
    JSON.stringify({ type: "user", message: { role: "user", content: "We never touch src/billing without approval — it is legacy and fragile." } }),
    JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Understood, avoiding it." }] } }),
    JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "file contents..." }] } }),
    JSON.stringify({ type: "user", isMeta: true, message: { role: "user", content: "<command-name>/clear</command-name>" } }),
    JSON.stringify({ type: "user", message: { role: "user", content: "ok" } }), // too short
    "not json at all",
  ].join("\n");
  const msgs = userMessagesFromTranscript(jsonl);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /billing/);
});

test("redactSecrets strips secret-looking lines, keeps the rest", () => {
  const out = redactSecrets("safe line\nAPI_KEY=sk-abcdefghijklmnopqrstuvwx\nBearer ya29_longtokenvalue1234567\nanother safe line");
  const lines = out.split("\n");
  assert.equal(lines[0], "safe line");
  assert.equal(lines[1], "[REDACTED — possible secret]");
  assert.equal(lines[2], "[REDACTED — possible secret]");
  assert.equal(lines[3], "another safe line");
});

test("codexTranscript extracts cwd and human turns, skips scaffolding", () => {
  const jsonl = [
    JSON.stringify({ type: "session_meta", payload: { cwd: "/repo/my-project", id: "abc" } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>stuff</environment_context>" }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Our deploys always go through deploy/fly.toml — never push straight to prod." }] } }),
    JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Got it." }] } }),
    JSON.stringify({ type: "message", role: "user", content: "ok" }), // flat format, too short
    "garbage line",
  ].join("\n");
  const { cwd, messages } = codexTranscript(jsonl);
  assert.equal(cwd, "/repo/my-project");
  assert.equal(messages.length, 1);
  assert.match(messages[0], /fly\.toml/);
});

test("copilotUserMessages extracts request turns, skips short/malformed", () => {
  const json = JSON.stringify({
    requests: [
      { message: { text: "We use better-sqlite3 for all persistence — do not introduce an ORM here." } },
      { message: { text: "yes" } },
      { message: { parts: [{ text: "Migrations live in src/db/schema.ts and " }, { text: "must bump SCHEMA_VERSION." }] } },
      {},
    ],
  });
  const msgs = copilotUserMessages(json);
  assert.equal(msgs.length, 2);
  assert.match(msgs[0], /better-sqlite3/);
  assert.match(msgs[1], /SCHEMA_VERSION/);
  assert.deepEqual(copilotUserMessages("not json"), []);
});

// ---------------------------------------------------------------- extraction

test("parseClaims: tolerant parsing, static_check, kind validation, dedupe", () => {
  const raw = `Sure! Here you go:
{"claims":[
  {"kind":"convention","claim":"Retries live in src/queue","paths":["src/queue"],"static_check":"test -d src/queue"},
  {"kind":"GUARDRAIL","claim":"Never edit generated files","guardrail_level":"never"},
  {"kind":"NOT_A_KIND","claim":"should be dropped"},
  {"kind":"CONVENTION","claim":"retries   live in src/queue"}
]}`;
  const claims = parseClaims(raw);
  assert.equal(claims.length, 2); // invalid kind dropped, near-duplicate deduped
  assert.equal(claims[0].staticCheck, "test -d src/queue");
  assert.equal(claims[1].guardrailLevel, "never");
  assert.equal(parseClaims("garbage with no json").length, 0);
  assert.equal(dedupeClaims([]).length, 0);
});

// ---------------------------------------------------------------- commit miner

test("classifyCommit: signals map to kinds; routine commits yield null", () => {
  assert.equal(
    classifyCommit({ sha: "a", subject: "Revert the streaming parser", body: "", files: [] })?.kind,
    "FAILED_APPROACH"
  );
  assert.equal(
    classifyCommit({ sha: "b", subject: "Add workaround for safari cookies", body: "", files: [] })?.kind,
    "GOTCHA"
  );
  assert.equal(
    classifyCommit({ sha: "c", subject: "Migrated from REST to gRPC", body: "", files: [] })?.kind,
    "DECISION"
  );
  assert.equal(classifyCommit({ sha: "d", subject: "Bump deps", body: "", files: [] }), null);
  // long explanatory body with why-markers → DECISION even without keywords
  const long = "x".repeat(100) + " because the previous behaviour caused data loss on retry " + "y".repeat(30);
  assert.equal(classifyCommit({ sha: "e", subject: "Update pipeline", body: long, files: [] })?.kind, "DECISION");
});

test("scopeFromFiles: filters noise, collapses to top directories", () => {
  assert.deepEqual(scopeFromFiles([".DS_Store", "node_modules/x.js"]), []);
  assert.deepEqual(scopeFromFiles(["src/a.ts", "src/b.ts"]), ["src/a.ts", "src/b.ts"]);
  const many = ["src/db/a.ts", "src/db/b.ts", "src/db/c.ts", "src/ui/d.ts", "docs/e.md", "src/db/f.ts", "src/ui/g.ts"];
  const scoped = scopeFromFiles(many, 2);
  assert.deepEqual(scoped, ["src/db", "src/ui"]);
});

test("detectRevert: parses git-style revert commit and links to original", () => {
  const info = detectRevert(
    {
      sha: "badcafe1234567890",
      subject: "Revert 'Add automatic retry on declined payments'",
      body: "This approach caused duplicate ledger entries when idempotency keys are missing.\n\nThis reverts commit abc1234def5678901234567890abcdef12345678.",
      files: ["src/payments/retry.ts"],
    },
    "/tmp/nonexistent"
  );
  assert.ok(info);
  assert.equal(info!.originalSubject, "Add automatic retry on declined payments");
  assert.equal(info!.originalSha, "abc1234def5678901234567890abcdef12345678");
  assert.match(info!.reason!, /duplicate ledger entries/);
});

test("mineCommits: creates FAILED_APPROACH proposal from a real revert", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-revert-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });

    mkdirSync(path.join(dir, "src", "payments"), { recursive: true });
    writeFileSync(path.join(dir, "src", "payments", "retry.ts"), "export function retry() {}");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "Add automatic retry on declined payments", "-m", "This adds naive immediate retries in src/payments/retry.ts."], { cwd: dir });
    const original = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();
    assert.ok(original);

    execFileSync("git", ["revert", "--no-edit", original!], { cwd: dir });

    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    try {
      const result = mineCommits(store, dir, { full: true });
      assert.equal(result.proposed.length, 1);
      assert.equal(result.proposed[0].kind, "FAILED_APPROACH");
      assert.match(result.proposed[0].claim, /automatic retry/i);
      assert.match(result.proposed[0].claim, /reverted/i);
      assert.ok(result.proposed[0].evidence.some((e) => e.type === "COMMIT_REF" && e.payload === original));
      assert.ok(result.proposed[0].appliesWhen?.some((c) => c.startsWith("original_commit:")));
    } finally {
      store.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- PR miner

test("buildPrPrompt: includes description, review comments with paths, and caps size", () => {
  const prompt = buildPrPrompt({
    number: 42,
    title: "Add retry queue",
    body: "Moves retries into src/queue so handlers stay idempotent.",
    mergedAt: "2026-07-01T00:00:00Z",
    mergeCommitSha: "abc123",
    headRefName: "feature/PROJ-7-retries",
    files: ["src/queue/index.ts"],
    comments: [
      { author: "alice", path: "src/queue/index.ts", body: "We never retry non-idempotent handlers — this caused the March outage." },
      { author: "bob", path: null, body: "LGTM" },
    ],
  });
  assert.match(prompt, /PR #42: Add retry queue/);
  assert.match(prompt, /@alice on src\/queue\/index\.ts: We never retry/);
  assert.match(prompt, /@bob: LGTM/);
  assert.match(prompt, /feature\/PROJ-7-retries/);
  assert.ok(prompt.length <= 12_000);
});

