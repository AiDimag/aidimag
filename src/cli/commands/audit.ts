/**
 * dim audit — audit trail, compliance export, provenance audit, and evidence signing.
 *
 * Subcommands:
 *   dim audit findings  — provenance audit (memories on the least ground)
 *   dim audit export    — export tamper-evident event log (JSON/CSV/summary)
 *   dim audit verify    — verify a previously exported audit trail file
 *   dim audit sign      — cryptographically sign an evidence row
 */

import type { Command } from "commander";
import { MemoryStore, findRepoRoot } from "../../db/store.js";
import { fail } from "../shared.js";

export function registerAuditCommands(program: Command): void {
  const audit = program
    .command("audit")
    .description("Audit trail, compliance export, and provenance audit");

  // dim audit findings — provenance audit
  audit
    .command("findings")
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
          const m = f.memory;
          console.log(`  [${m.status}] ${m.kind} (conf ${m.confidence.toFixed(2)}) ${m.id.slice(0, 8)}`);
          console.log(`    "${m.claim}"`);
          for (const r of f.reasons) console.log(`    ⚠ ${r}`);
        }
        console.log(
          `\nFix-ups: \`dim update <id> -e TYPE:proof\` adds evidence · \`dim verify\` re-checks · ` +
            `\`dim refute <id>\` / \`dim forget <id>\` removes.`
        );
      }
      store.close();
    });

  // dim audit export — tamper-evident event log export
  audit
    .command("export")
    .description("Export the tamper-evident audit trail (all memory-lifecycle events)")
    .option("-f, --format <fmt>", "Output format: json, csv, or summary (default)", "summary")
    .option("-o, --output <file>", "Write to a file instead of stdout")
    .option("--limit <n>", "Maximum number of events to export", parseInt)
    .option("--since <seq>", "Export only events after this sequence number", parseInt)
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      const store = MemoryStore.open(root);
      try {
        const { exportAuditTrail, renderCsv, renderAuditSummary } = await import("../../verify/audit-export.js");
        const exportData = await exportAuditTrail(store, {
          limit: opts.limit,
          sinceSeq: opts.since,
        });

        let output: string;
        switch (opts.format) {
          case "json":
            output = JSON.stringify(exportData, null, 2);
            break;
          case "csv":
            output = renderCsv(exportData);
            break;
          case "summary":
          default:
            output = renderAuditSummary(exportData);
            break;
        }

        if (opts.output) {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(opts.output, output + "\n");
          console.log(`Audit trail exported to ${opts.output} (${exportData.totalEvents} events, chain: ${exportData.chainHash.slice(0, 16)}...)`);
        } else {
          console.log(output);
        }
      } finally {
        store.close();
      }
    });

  // dim audit verify — verify a previously exported audit trail
  audit
    .command("verify")
    .description("Verify the integrity of a previously exported audit trail file")
    .argument("<file>", "Path to the exported JSON audit trail file")
    .action(async (file) => {
      const { readFileSync } = await import("node:fs");
      const raw = readFileSync(file, "utf8");
      const exportData = JSON.parse(raw);
      const { verifyAuditTrail } = await import("../../verify/audit-export.js");
      const valid = await verifyAuditTrail(exportData);
      if (valid) {
        console.log("✓ Audit trail verified — no tampering detected.");
        console.log(`  Events: ${exportData.totalEvents}`);
        console.log(`  Chain:  ${exportData.chainHash.slice(0, 16)}...`);
      } else {
        console.error("✗ Audit trail verification FAILED — tampering detected!");
        process.exit(1);
      }
    });

  // dim audit sign — cryptographically sign an evidence row
  audit
    .command("sign")
    .description("Sign an evidence row with an Ed25519 private key (cryptographic provenance)")
    .argument("<evidence-id>", "Evidence ID (or 8-char prefix) to sign")
    .option("-k, --key <file>", "Path to PEM private key file (Ed25519)")
    .option("-b, --key-bytes <hex>", "Ed25519 private key as hex string (32 bytes)")
    .option("--signed-by <name>", "Signer identity (e.g. email or key fingerprint)")
    .action(async (evidenceId, opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      const store = MemoryStore.open(root);
      try {
        const { createPrivateKey, sign } = await import("node:crypto");
        const { readFileSync } = await import("node:fs");

        let keyObj;
        if (opts.key) {
          keyObj = createPrivateKey(readFileSync(opts.key, "utf8"));
        } else if (opts.keyBytes) {
          const keyDer = Buffer.from(opts.keyBytes, "hex");
          keyObj = createPrivateKey({
            key: keyDer,
            format: "der",
            type: "pkcs8",
          });
        } else {
          fail("--key <file> or --key-bytes <hex> is required");
        }

        // Resolve short ID prefix
        const fullId = store.resolveEvidenceId?.(evidenceId) ?? evidenceId;
        const evidence = store.getEvidence?.(fullId);
        if (!evidence) {
          fail(`No evidence found with id "${evidenceId}"`);
        }

        // Sign over the evidence content: type|payload|memoryId
        const content = `${evidence.type}|${evidence.payload}|${evidence.memoryId}`;
        const signature = sign(null, Buffer.from(content), keyObj).toString("base64");
        const signedBy = opts.signedBy || "unknown";

        store.signEvidence(fullId, signature, signedBy);
        console.log(`✓ Evidence ${fullId.slice(0, 8)} signed by ${signedBy}`);
        console.log(`  Signature: ${signature.slice(0, 32)}...`);
      } finally {
        store.close();
      }
    });
}
