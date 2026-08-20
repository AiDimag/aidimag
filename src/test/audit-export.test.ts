import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { MemoryStore } from "../db/store.js";
import { exportAuditTrail, verifyAuditTrail, renderCsv, renderAuditSummary } from "../verify/audit-export.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-audit-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  execFileSync("node", [CLI, "init"], { cwd: dir, encoding: "utf8" });
  return dir;
}

test("exportAuditTrail produces chained events", async () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    // Create a memory to generate events
    store.write({
      kind: "GOTCHA",
      claim: "Test claim for audit",
      createdBy: "human",
      trustExecutableEvidence: true,
    });
    store.close();

    const store2 = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    const exportData = await exportAuditTrail(store2);
    store2.close();

    assert.ok(exportData.totalEvents > 0);
    assert.ok(exportData.chainHash.length === 64);
    // Verify chain: each event's prevHash matches the previous event's hash
    let prevHash = "0".repeat(64);
    for (const e of exportData.events) {
      assert.equal(e.prevHash, prevHash);
      assert.equal(e.hash.length, 64);
      prevHash = e.hash;
    }
    assert.equal(exportData.chainHash, prevHash);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyAuditTrail confirms integrity of a valid export", async () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "Test claim", createdBy: "human", trustExecutableEvidence: true });
    store.write({ kind: "CONVENTION", claim: "Another claim", createdBy: "human", trustExecutableEvidence: true });
    const exportData = await exportAuditTrail(store);
    store.close();

    const valid = await verifyAuditTrail(exportData);
    assert.equal(valid, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyAuditTrail detects tampering", async () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "Original claim", createdBy: "human", trustExecutableEvidence: true });
    const exportData = await exportAuditTrail(store);
    store.close();

    // Tamper with an event payload
    exportData.events[0].payload = { tampered: true };
    const valid = await verifyAuditTrail(exportData);
    assert.equal(valid, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderCsv produces valid CSV", async () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "CSV test claim", createdBy: "human", trustExecutableEvidence: true });
    const exportData = await exportAuditTrail(store);
    store.close();

    const csv = renderCsv(exportData);
    const lines = csv.split("\n");
    assert.ok(lines[0].startsWith("seq,id,type,memory_id,machine"));
    assert.ok(lines.length > 1);
    // Each data line should have 10 comma-separated fields
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(",");
      assert.ok(fields.length >= 10, `line ${i} has ${fields.length} fields`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderAuditSummary shows event breakdown", async () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "Summary test", createdBy: "human", trustExecutableEvidence: true });
    const exportData = await exportAuditTrail(store);
    store.close();

    const summary = renderAuditSummary(exportData);
    assert.match(summary, /Audit Trail Export/);
    assert.match(summary, /Events:/);
    assert.match(summary, /memory_created/);
    assert.match(summary, /Chain:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("exportAuditTrail respects limit option", async () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "Claim 1", createdBy: "human", trustExecutableEvidence: true });
    store.write({ kind: "GOTCHA", claim: "Claim 2", createdBy: "human", trustExecutableEvidence: true });
    store.write({ kind: "GOTCHA", claim: "Claim 3", createdBy: "human", trustExecutableEvidence: true });
    const exportData = await exportAuditTrail(store, { limit: 2 });
    store.close();

    assert.equal(exportData.totalEvents, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim audit export CLI outputs summary", () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "CLI audit test", createdBy: "human", trustExecutableEvidence: true });
    store.close();

    const out = execFileSync("node", [CLI, "audit", "export"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /Audit Trail Export/);
    assert.match(out, /memory_created/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim audit export --format json outputs valid JSON", () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "JSON audit test", createdBy: "human", trustExecutableEvidence: true });
    store.close();

    const out = execFileSync("node", [CLI, "audit", "export", "--format", "json"], { cwd: dir, encoding: "utf8" });
    const parsed = JSON.parse(out);
    assert.ok(parsed.totalEvents > 0);
    assert.ok(parsed.chainHash.length === 64);
    assert.ok(Array.isArray(parsed.events));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim audit export --output writes to file", () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "File output test", createdBy: "human", trustExecutableEvidence: true });
    store.close();

    const outFile = path.join(dir, "audit-export.json");
    execFileSync("node", [CLI, "audit", "export", "--format", "json", "--output", outFile], {
      cwd: dir,
      encoding: "utf8",
    });
    const raw = readFileSync(outFile, "utf8");
    const parsed = JSON.parse(raw);
    assert.ok(parsed.totalEvents > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim audit verify confirms a valid export file", () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "Verify test", createdBy: "human", trustExecutableEvidence: true });
    store.close();

    const outFile = path.join(dir, "audit-export.json");
    execFileSync("node", [CLI, "audit", "export", "--format", "json", "--output", outFile], {
      cwd: dir,
      encoding: "utf8",
    });
    const out = execFileSync("node", [CLI, "audit", "verify", outFile], { cwd: dir, encoding: "utf8" });
    assert.match(out, /verified/);
    assert.match(out, /no tampering/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim audit sign cryptographically signs an evidence row", async () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    const memId = store.write({
      kind: "INVARIANT",
      claim: "The sky is blue",
      evidence: [{ type: "HUMAN_ATTESTED", payload: "observed at noon" }],
      trustExecutableEvidence: true,
      createdBy: "human",
    });
    store.close();

    // Generate an Ed25519 key pair
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const keyPem = privateKey.export({ format: "pem", type: "pkcs8" });
    const keyFile = path.join(dir, "test-key.pem");
    writeFileSync(keyFile, keyPem);

    // Get the evidence ID
    const store2 = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    const mem = store2.get(memId.id);
    const evidenceId = mem!.grounding[0].id;
    store2.close();

    // Sign the evidence
    const out = execFileSync(
      "node",
      [CLI, "audit", "sign", evidenceId, "--key", keyFile, "--signed-by", "alice@example.com"],
      { cwd: dir, encoding: "utf8" }
    );
    assert.match(out, /signed by alice@example.com/);

    // Verify the signature is stored
    const store3 = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    const mem2 = store3.get(memId.id);
    const ev = mem2!.grounding[0];
    assert.ok(ev.signature, "evidence should have a signature");
    assert.equal(ev.signedBy, "alice@example.com");

    // Verify the signature with the public key
    const { verify } = await import("node:crypto");
    const content = `${ev.type}|${ev.payload}|${ev.memoryId}`;
    const sigValid = verify(null, Buffer.from(content), publicKey, Buffer.from(ev.signature!, "base64"));
    assert.ok(sigValid, "signature should be valid");

    store3.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("immutable history: events table rejects UPDATE and DELETE", () => {
  const dir = tempRepo();
  try {
    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({ kind: "GOTCHA", claim: "Immutable test", createdBy: "human", trustExecutableEvidence: true });

    // Attempting to UPDATE an event should fail
    assert.throws(
      () => (store as any).db.prepare("UPDATE events SET type = 'forgotten' WHERE seq = 1").run(),
      /immutable/
    );

    // Attempting to DELETE an event should fail
    assert.throws(
      () => (store as any).db.prepare("DELETE FROM events WHERE seq = 1").run(),
      /immutable/
    );

    // But updating the synced column should work (for dim sync)
    (store as any).db.prepare("UPDATE events SET synced = 1 WHERE seq = 1").run();

    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
