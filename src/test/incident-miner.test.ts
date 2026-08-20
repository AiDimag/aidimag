import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { MemoryStore } from "../db/store.js";
import { parseJsonReport, parseMarkdownReport, parseCiLog, mineIncident } from "../capture/incident-miner.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-incident-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  return dir;
}

test("parseJsonReport parses a JSON incident report", () => {
  const raw = JSON.stringify({
    title: "Payment retry storm",
    description: "Automatic retries caused duplicate charges",
    files: ["src/payments.ts"],
    failedCommand: "npm test -- payments",
    ticketRef: "INC-100",
    commitSha: "abc1234",
  });
  const report = parseJsonReport(raw);
  assert.equal(report.title, "Payment retry storm");
  assert.equal(report.files?.[0], "src/payments.ts");
  assert.equal(report.failedCommand, "npm test -- payments");
  assert.equal(report.ticketRef, "INC-100");
  assert.equal(report.commitSha, "abc1234");
});

test("parseMarkdownReport extracts heading and body", () => {
  const raw = `# Deploy rollback due to missing migration

The deploy was rolled back because migration 0042 was not applied.

\`\`\`sh
npm run migrate
\`\`\`
`;
  const report = parseMarkdownReport(raw);
  assert.equal(report.title, "Deploy rollback due to missing migration");
  assert.match(report.description, /rolled back/);
  assert.equal(report.failedCommand, "npm run migrate");
});

test("mineIncident creates a FAILED_APPROACH proposal", async () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    const result = await mineIncident(store, {
      title: "Payment retry storm",
      description: "Automatic retries caused duplicate charges",
      files: ["src/payments.ts"],
      failedCommand: "npm test -- payments",
      ticketRef: "INC-100",
      commitSha: "abc1234",
    });
    assert.equal(result.proposed.length, 1);
    assert.equal(result.skippedDuplicates, 0);
    const p = result.proposed[0];
    assert.equal(p.kind, "FAILED_APPROACH");
    assert.match(p.claim, /Payment retry storm/);
    assert.equal(p.source, "incident-miner");
    assert.equal(p.ticketRef, "INC-100");
    assert.ok(p.evidence.some((e) => e.type === "COMMIT_REF" && e.payload === "abc1234"));
    assert.ok(p.evidence.some((e) => e.type === "TICKET_REF" && e.payload === "INC-100"));
    assert.ok(p.evidence.some((e) => e.type === "EXEC_TRACE"));
    assert.ok(p.appliesWhen?.some((a) => a.startsWith("original_commit:")));
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mineIncident dedupes on repeated reports", async () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    const report = {
      title: "Deploy rollback",
      description: "Missing migration caused rollback",
    };
    const first = await mineIncident(store, report);
    const second = await mineIncident(store, report);
    assert.equal(first.proposed.length, 1);
    assert.equal(second.proposed.length, 0);
    assert.equal(second.skippedDuplicates, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim capture incident CLI queues a proposal", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    const reportPath = path.join(dir, "incident.json");
    writeFileSync(
      reportPath,
      JSON.stringify({
        title: "CI failure on auth tests",
        description: "Auth token refresh broke due to clock skew",
        files: ["src/auth.ts"],
        ticketRef: "INC-201",
      })
    );
    const out = execFileSync("node", [CLI, "capture", "incident", reportPath], { cwd: dir, encoding: "utf8" });
    assert.match(out, /FAILED_APPROACH/);
    assert.match(out, /CI failure on auth tests/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseCiLog extracts errors, files, and command from CI log output", () => {
  const raw = [
    "Running tests...",
    "$ npm test",
    "",
    "FAIL  src/auth.test.ts",
    "  ● Authentication › token refresh › should handle clock skew",
    "",
    "TypeError: Cannot read property 'token' of undefined",
    "    at Object.<anonymous> (src/auth.ts:42:15)",
    "    at processTicksAndRejections (node:internal/process:96:5)",
    "",
    "Tests: 1 failed, 23 passed",
    "commit: abc1234def56789",
    "https://github.com/myorg/myrepo/runs/12345",
  ].join("\n");

  const report = parseCiLog(raw);
  assert.ok(report.title.length > 0);
  assert.ok(report.description.length > 0);
  assert.ok(report.files?.includes("src/auth.ts") ?? false);
  assert.ok(report.failedCommand?.includes("npm test") ?? false);
  assert.equal(report.commitSha, "abc1234def56789");
  assert.ok(report.ciUrl?.includes("github.com") ?? false);
});

test("parseCiLog handles empty or minimal log", () => {
  const report = parseCiLog("");
  assert.equal(report.title, "CI failure");
  assert.match(report.description, /CI build failed/);
});

test("dim capture ci-log CLI queues a proposal from raw log", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    const logPath = path.join(dir, "ci.log");
    writeFileSync(
      logPath,
      [
        "$ npm run build",
        "",
        "Error: Cannot find module './missing'",
        "    at Object.<anonymous> (src/index.ts:10:1)",
        "FAILED src/index.ts",
        "",
      ].join("\n")
    );

    const out = execFileSync("node", [CLI, "capture", "ci-log", logPath], {
      cwd: dir,
      encoding: "utf8",
    });

    assert.match(out, /FAILED_APPROACH/);
    assert.match(out, /CI log/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim capture ci-log CLI supports stdin", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    const logContent = [
      "$ npm test",
      "",
      "FAIL  src/utils.test.ts",
      "Error: expected true to be false",
      "    at Object.<anonymous> (src/utils.ts:25:3)",
    ].join("\n");

    const out = execFileSync(
      "node",
      [CLI, "capture", "ci-log", "-"],
      {
        cwd: dir,
        encoding: "utf8",
        input: logContent,
      }
    );

    assert.match(out, /FAILED_APPROACH/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
