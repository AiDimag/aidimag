/**
 * Audit trail and compliance export.
 *
 * Exports all memory-lifecycle events from the local store in a
 * tamper-evident format. Each export includes a chain hash: every event
 * record includes a `prevHash` field linking it to the previous event,
 * making any after-the-fact modification detectable.
 *
 * Output formats: JSON (default) or CSV.
 */

import type { MemoryStore, MemoryEvent } from "../db/store.js";

export interface AuditExportRow {
  seq: number;
  id: string;
  type: string;
  memoryId: string | null;
  payload: Record<string, unknown>;
  machine: string;
  schemaVersion: number;
  createdAt: string;
  hash: string;
  prevHash: string;
}

export interface AuditExport {
  exportedAt: string;
  machine: string;
  totalEvents: number;
  chainHash: string;
  events: AuditExportRow[];
}

/**
 * Simple SHA-256 hash using Node's crypto module.
 */
async function sha256(data: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Export all events from the store as a tamper-evident audit trail.
 * Each event is chained to the previous one via a SHA-256 hash.
 */
export async function exportAuditTrail(
  store: MemoryStore,
  opts: { limit?: number; sinceSeq?: number } = {}
): Promise<AuditExport> {
  const allEvents = queryAllEvents(store, opts.limit, opts.sinceSeq);

  const rows: AuditExportRow[] = [];
  let prevHash = "0".repeat(64); // genesis hash

  for (const ev of allEvents) {
    const record = `${ev.seq}|${ev.id}|${ev.type}|${ev.memoryId ?? ""}|${JSON.stringify(ev.payload)}|${ev.machine}|${ev.schemaVersion}|${ev.createdAt}|${prevHash}`;
    const hash = await sha256(record);
    rows.push({
      seq: ev.seq,
      id: ev.id,
      type: ev.type,
      memoryId: ev.memoryId,
      payload: ev.payload,
      machine: ev.machine,
      schemaVersion: ev.schemaVersion,
      createdAt: ev.createdAt,
      hash,
      prevHash,
    });
    prevHash = hash;
  }

  const chainHash = prevHash;

  return {
    exportedAt: new Date().toISOString(),
    machine: getMachineId(store),
    totalEvents: rows.length,
    chainHash,
    events: rows,
  };
}

/**
 * Query all events from the store (not just unsynced ones).
 */
function queryAllEvents(store: MemoryStore, limit?: number, sinceSeq?: number): MemoryEvent[] {
  // Access the internal db through the store's public dbPath to reconstruct
  // We need to use the store's internal db, but it's private. So we expose
  // a method on the store via a cast.
  const s = store as unknown as {
    db: {
      prepare: (sql: string) => { all: (...args: unknown[]) => Record<string, unknown>[] };
    };
  };
  let sql = "SELECT * FROM events";
  const args: unknown[] = [];
  const conditions: string[] = [];
  if (sinceSeq !== undefined) {
    conditions.push("seq > ?");
    args.push(sinceSeq);
  }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY seq ASC";
  if (limit) {
    sql += " LIMIT ?";
    args.push(limit);
  }
  const rows = s.db.prepare(sql).all(...args);
  return rows.map((r) => ({
    seq: r.seq as number,
    id: r.id as string,
    type: r.type as MemoryEvent["type"],
    memoryId: (r.memory_id as string | null) ?? null,
    payload: JSON.parse((r.payload as string) || "{}"),
    machine: r.machine as string,
    schemaVersion: r.schema_version as number,
    createdAt: r.created_at as string,
  }));
}

function getMachineId(store: MemoryStore): string {
  const s = store as unknown as { machine: string };
  return s.machine;
}

/**
 * Verify the integrity of an audit export by recomputing the chain hashes.
 * Returns true if all hashes match (no tampering detected).
 */
export async function verifyAuditTrail(exportData: AuditExport): Promise<boolean> {
  let prevHash = "0".repeat(64);
  for (const row of exportData.events) {
    if (row.prevHash !== prevHash) return false;
    const record = `${row.seq}|${row.id}|${row.type}|${row.memoryId ?? ""}|${JSON.stringify(row.payload)}|${row.machine}|${row.schemaVersion}|${row.createdAt}|${row.prevHash}`;
    const computedHash = await sha256(record);
    if (row.hash !== computedHash) return false;
    prevHash = row.hash;
  }
  return exportData.chainHash === prevHash;
}

/**
 * Render an audit export as CSV.
 */
export function renderCsv(exportData: AuditExport): string {
  const header = "seq,id,type,memory_id,machine,schema_version,created_at,hash,prev_hash,payload";
  const lines = [header];
  for (const e of exportData.events) {
    const payload = JSON.stringify(e.payload).replace(/"/g, '""');
    lines.push(
      [
        e.seq,
        e.id,
        e.type,
        e.memoryId ?? "",
        e.machine,
        e.schemaVersion,
        e.createdAt,
        e.hash,
        e.prevHash,
        `"${payload}"`,
      ].join(",")
    );
  }
  return lines.join("\n");
}

/**
 * Render a summary of the audit export for CLI display.
 */
export function renderAuditSummary(exportData: AuditExport): string {
  const typeCounts: Record<string, number> = {};
  for (const e of exportData.events) {
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  }
  const lines = [
    `Audit Trail Export`,
    `  Exported: ${exportData.exportedAt}`,
    `  Machine:  ${exportData.machine}`,
    `  Events:   ${exportData.totalEvents}`,
    `  Chain:    ${exportData.chainHash.slice(0, 16)}...`,
    "",
    "  Event breakdown:",
  ];
  for (const [type, count] of Object.entries(typeCounts).sort()) {
    lines.push(`    ${type}: ${count}`);
  }
  if (exportData.events.length > 0) {
    lines.push(
      "",
      `  First event: ${exportData.events[0].createdAt} (#${exportData.events[0].seq})`,
      `  Last event:  ${exportData.events[exportData.events.length - 1].createdAt} (#${exportData.events[exportData.events.length - 1].seq})`,
    );
  }
  return lines.join("\n");
}
