#!/usr/bin/env bash
set -euo pipefail

# Build a downloadable sample repo with pre-seeded AIDimag memories.
# Output: dist/aidimag-sample-repo.tar.gz

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$ROOT/dist/aidimag-sample-repo"
TARBALL="$ROOT/dist/aidimag-sample-repo.tar.gz"

echo "Building sample repo..."

# Clean and create output directory
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Initialize git repo
cd "$OUT_DIR"
git init -q
git config user.email "demo@aidimag.com"
git config user.name "AIDimag Demo"

# Create project structure
mkdir -p src/db src/api src/payments src/auth

# --- src/db/store.ts ---
cat > src/db/store.ts << 'TS'
import Database from "better-sqlite3";

const db = new Database("./app.db");

export function query<T>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(sql: string, ...params: unknown[]): void {
  db.prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}
TS

# --- src/api/handler.ts ---
cat > src/api/handler.ts << 'TS'
import { query } from "../db/store.js";

interface User {
  id: number;
  email: string;
}

export function getUser(id: number): User | null {
  const rows = query<User>("SELECT id, email FROM users WHERE id = ?", id);
  return rows[0] ?? null;
}

export function createUser(email: string): void {
  // Always validate input before touching the DB
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email");
  }
  // Error responses use { error: { code, message } } format
  query("INSERT INTO users (email) VALUES (?)", email);
}
TS

# --- src/payments/processor.ts ---
cat > src/payments/processor.ts << 'TS'
// Payment processing uses an idempotency-key-based queue.
// The payments table uses cents, not dollars — don't divide by 100.

import { query, run } from "../db/store.js";

interface Payment {
  id: number;
  amount_cents: number;
  idempotency_key: string;
  status: string;
}

export function processPayment(amountCents: number, idempotencyKey: string): Payment {
  // Check idempotency
  const existing = query<Payment>(
    "SELECT * FROM payments WHERE idempotency_key = ?",
    idempotencyKey
  );
  if (existing.length > 0) {
    return existing[0];
  }

  // Insert new payment
  run(
    "INSERT INTO payments (amount_cents, idempotency_key, status) VALUES (?, ?, 'pending')",
    amountCents,
    idempotencyKey
  );

  const rows = query<Payment>(
    "SELECT * FROM payments WHERE idempotency_key = ?",
    idempotencyKey
  );
  return rows[0];
}
TS

# --- src/auth/middleware.ts ---
cat > src/auth/middleware.ts << 'TS'
// Critical area: authentication middleware
// Changes here require owner approval

export function authenticate(token: string): boolean {
  // TODO: implement proper JWT validation
  return token.length > 0;
}
TS

# --- package.json ---
cat > package.json << 'JSON'
{
  "name": "aidimag-sample-repo",
  "version": "1.0.0",
  "description": "Sample repo for AIDimag demo — explore verified memory hands-on",
  "scripts": {
    "test": "echo \"No tests yet\" && exit 0"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  }
}
JSON

# --- .aidimag/critical-areas.yml ---
mkdir -p .aidimag
cat > .aidimag/critical-areas.yml << 'YAML'
areas:
  - label: "Authentication"
    paths:
      - "src/auth"
    owners:
      - "@security-team"
    block: true
    approvalToken: "[AUTH-OK]"
  - label: "Payments"
    paths:
      - "src/payments"
    owners:
      - "@payments-team"
    requiredTests:
      - "npm test -- --grep payments"
    block: true
    approvalToken: "[PAYMENTS-OK]"
YAML

# Initial commit
git add -A
git commit -q -m "Initial commit: project structure with db, api, payments, auth"

# Create a bad commit that will be reverted (for FAILED_APPROACH mining)
cat > src/payments/retry.ts << 'TS'
// Automatic retry on declined payments
export function retryDeclinedPayments() {
  // This caused duplicate ledger entries when idempotency keys are missing
  return fetch("/retry");
}
TS
git add -A
git commit -q -m "Add automatic retry on declined payments"

# Revert the bad commit (this is what dim mine detects)
git revert --no-edit HEAD 2>/dev/null || true
# Revert already creates a commit; only commit if there are staged changes
git add -A
git diff --cached --quiet || git commit -q -m "Revert: automatic retry caused duplicate ledger entries"

# Build the AIDimag memory store using the CLI
echo "Seeding memories..."

# Build and use the local CLI
cd "$ROOT"
npm run build 2>/dev/null

DIM="node $ROOT/dist/cli/index.js"
export AIDIMAG_REPO="$OUT_DIR"
export AIDIMAG_NO_UPDATE_CHECK=1

# Seed memories
$DIM init 2>/dev/null

$DIM remember "All DB access goes through src/db/store.ts; nothing else imports better-sqlite3" \
  -k CONVENTION -p src \
  -e "STATIC_CHECK:! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts | grep -v node_modules" 2>/dev/null || true

$DIM remember "Never call the production API from a test" \
  -k GUARDRAIL -p src --guardrail-level never 2>/dev/null || true

$DIM remember "Automatic retry on declined payments caused duplicate ledger entries when idempotency keys are missing" \
  -k FAILED_APPROACH -p src/payments \
  --applies-when "keyword:retry keyword:idempotency" 2>/dev/null || true

$DIM remember "Payment processing uses an idempotency-key-based queue for deduplication" \
  -k ARCHITECTURE -p src/payments 2>/dev/null || true

$DIM remember "We use better-sqlite3 instead of Prisma for performance and control over prepared statements" \
  -k DECISION -p src/db 2>/dev/null || true

$DIM remember "All API handlers must validate input before touching the DB" \
  -k INVARIANT -p src/api 2>/dev/null || true

$DIM remember "Error responses use { error: { code, message } } format for consistent API contracts" \
  -k CONVENTION -p src/api 2>/dev/null || true

$DIM remember "The payments table uses cents not dollars — do not divide by 100" \
  -k GOTCHA -p src/payments 2>/dev/null || true

# Verify all memories
$DIM verify 2>/dev/null || true

# Generate context files
$DIM generate-context --format claude 2>/dev/null || true

# Mine commits for the FAILED_APPROACH
$DIM mine 2>/dev/null || true

# Create tarball
cd "$ROOT/dist"
tar czf aidimag-sample-repo.tar.gz aidimag-sample-repo

echo ""
echo "✓ Sample repo built: dist/aidimag-sample-repo.tar.gz"
echo "  Contains: $(find "$OUT_DIR" -type f | wc -l | tr -d ' ') files"
echo "  Memories: $($DIM status 2>/dev/null | grep 'total memories' | awk '{print $3}' || echo '8+')"
