import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MemoryStore } from "../db/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function tempRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "aidimag-ret-"));
}

function makeStore(dir: string): MemoryStore {
  return new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
}

type StoreDB = { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } };

function setCreatedAt(store: MemoryStore, id: string, date: string): void {
  (store as unknown as StoreDB).db
    .prepare("UPDATE memories SET created_at = ? WHERE id = ?")
    .run(date, id);
}

function setStatus(store: MemoryStore, id: string, status: string): void {
  (store as unknown as StoreDB).db
    .prepare("UPDATE memories SET status = ? WHERE id = ?")
    .run(status, id);
}

test("applyRetention forgets old memories with no evidence", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const recentDate = new Date().toISOString();

    const old1 = store.write({
      kind: "GOTCHA",
      claim: "old no evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
    });
    setCreatedAt(store, old1.id, oldDate);

    const recent1 = store.write({
      kind: "GOTCHA",
      claim: "recent no evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
    });
    setCreatedAt(store, recent1.id, recentDate);

    const oldWithEvidence = store.write({
      kind: "GOTCHA",
      claim: "old with evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
      evidence: [{ type: "STATIC_CHECK", payload: "true" }],
    });
    setCreatedAt(store, oldWithEvidence.id, oldDate);

    const eligible = store.applyRetention({ maxAgeDays: 30, dryRun: false });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, old1.id);

    const remaining = store.list(100);
    assert.equal(remaining.length, 2);
    assert(!remaining.find((m) => m.id === old1.id));

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyRetention dry-run does not delete", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const old1 = store.write({
      kind: "GOTCHA",
      claim: "old no evidence dry run",
      createdBy: "agent",
      trustExecutableEvidence: true,
    });
    setCreatedAt(store, old1.id, oldDate);

    const eligible = store.applyRetention({ maxAgeDays: 30, dryRun: true });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, old1.id);

    const remaining = store.list(100);
    assert.equal(remaining.length, 1);

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyRetention preserves pinned memories", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const oldPinned = store.write({
      kind: "GOTCHA",
      claim: "old pinned no evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
      pinned: true,
    });
    setCreatedAt(store, oldPinned.id, oldDate);

    const eligible = store.applyRetention({ maxAgeDays: 30, preservePinned: true, dryRun: true });
    assert.equal(eligible.length, 0);

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyRetention preserves human-authored memories", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const oldHuman = store.write({
      kind: "GOTCHA",
      claim: "old human no evidence",
      createdBy: "human",
      trustExecutableEvidence: true,
    });
    setCreatedAt(store, oldHuman.id, oldDate);

    const eligible = store.applyRetention({ maxAgeDays: 30, preserveSources: ["human", "knowledge:"], dryRun: true });
    assert.equal(eligible.length, 0);

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyRetention forgets STALE memories older than staleAgeDays", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const recentDate = new Date().toISOString();

    const oldStale = store.write({
      kind: "GOTCHA",
      claim: "old stale with evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
      evidence: [{ type: "STATIC_CHECK", payload: "false" }],
    });
    setCreatedAt(store, oldStale.id, oldDate);
    setStatus(store, oldStale.id, "STALE");

    const recentStale = store.write({
      kind: "GOTCHA",
      claim: "recent stale with evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
      evidence: [{ type: "STATIC_CHECK", payload: "false" }],
    });
    setCreatedAt(store, recentStale.id, recentDate);
    setStatus(store, recentStale.id, "STALE");

    const eligible = store.applyRetention({ maxAgeDays: 0, staleAgeDays: 30, dryRun: true });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, oldStale.id);

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyRetention never forgets REFUTED memories", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const oldRefuted = store.write({
      kind: "GOTCHA",
      claim: "old refuted no evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
    });
    setCreatedAt(store, oldRefuted.id, oldDate);
    setStatus(store, oldRefuted.id, "REFUTED");

    const eligible = store.applyRetention({ maxAgeDays: 30, dryRun: true });
    assert.equal(eligible.length, 0);

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyRetention with maxAgeDays=0 and staleAgeDays=0 does nothing", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 365 * 86_400_000).toISOString();

    const old1 = store.write({
      kind: "GOTCHA",
      claim: "very old no evidence",
      createdBy: "agent",
      trustExecutableEvidence: true,
    });
    setCreatedAt(store, old1.id, oldDate);

    const eligible = store.applyRetention({ maxAgeDays: 0, staleAgeDays: 0, dryRun: true });
    assert.equal(eligible.length, 0);

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim retention CLI reports eligible memories in dry-run", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    const oldDate = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const old1 = store.write({
      kind: "GOTCHA",
      claim: "old no evidence cli test",
      createdBy: "agent",
      trustExecutableEvidence: true,
    });
    setCreatedAt(store, old1.id, oldDate);
    store.close();

    const CLI = path.join(__dirname, "..", "cli", "index.js");
    const out = execFileSync("node", [CLI, "retention", "--dry-run", "--max-age-days", "30"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.match(out, /Would forget 1 memor/);
    assert.match(out, /old no evidence cli test/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim retention CLI reports not configured when no policy set", () => {
  const dir = tempRepo();
  try {
    const store = makeStore(dir);
    store.write({
      kind: "GOTCHA",
      claim: "test memory",
      createdBy: "agent",
      trustExecutableEvidence: true,
    });
    store.close();

    const CLI = path.join(__dirname, "..", "cli", "index.js");
    const out = execFileSync("node", [CLI, "retention"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.match(out, /Retention policy is not configured/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
