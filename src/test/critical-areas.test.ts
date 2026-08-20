import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readCriticalAreas, checkCriticalAreas } from "../verify/critical-areas.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-critical-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  return dir;
}

function writeJsonConfig(dir: string, areas: unknown[]): void {
  mkdirSync(path.join(dir, ".aidimag"), { recursive: true });
  writeFileSync(path.join(dir, ".aidimag", "critical-areas.json"), JSON.stringify({ areas }));
}

function writeYamlConfig(dir: string): void {
  mkdirSync(path.join(dir, ".aidimag"), { recursive: true });
  writeFileSync(
    path.join(dir, ".aidimag", "critical-areas.yml"),
    `areas:
  - label: Authentication
    paths:
      - src/auth
    owners:
      - alice@example.com
    block: true
    approvalToken: "[AUTH-OK]"
    requiredTests:
      - npm test -- auth
  - label: Payments
    paths:
      - src/payments
    block: false
`
  );
}

test("readCriticalAreas reads JSON config", () => {
  const dir = tempRepo();
  try {
    writeJsonConfig(dir, [
      {
        label: "Auth",
        paths: ["src/auth"],
        owners: ["alice@example.com"],
        block: true,
        approvalToken: "[AUTH-OK]",
      },
    ]);
    const config = readCriticalAreas(dir);
    assert.equal(config.areas.length, 1);
    assert.equal(config.areas[0].label, "Auth");
    assert.deepEqual(config.areas[0].paths, ["src/auth"]);
    assert.deepEqual(config.areas[0].owners, ["alice@example.com"]);
    assert.equal(config.areas[0].block, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readCriticalAreas reads YAML config", () => {
  const dir = tempRepo();
  try {
    writeYamlConfig(dir);
    const config = readCriticalAreas(dir);
    assert.equal(config.areas.length, 2);
    assert.equal(config.areas[0].label, "Authentication");
    assert.deepEqual(config.areas[0].paths, ["src/auth"]);
    assert.deepEqual(config.areas[0].owners, ["alice@example.com"]);
    assert.equal(config.areas[0].block, true);
    assert.equal(config.areas[0].approvalToken, "[AUTH-OK]");
    assert.deepEqual(config.areas[0].requiredTests, ["npm test -- auth"]);
    assert.equal(config.areas[1].label, "Payments");
    assert.equal(config.areas[1].block, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readCriticalAreas returns empty when no config exists", () => {
  const dir = tempRepo();
  try {
    const config = readCriticalAreas(dir);
    assert.equal(config.areas.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkCriticalAreas flags changes to protected paths", () => {
  const config = {
    areas: [
      {
        label: "Auth",
        paths: ["src/auth"],
        owners: ["alice@example.com"],
        block: true,
        approvalToken: "[AUTH-OK]",
      },
    ],
  };
  const violations = checkCriticalAreas(config, ["src/auth/login.ts", "README.md"]);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].severity, "fail");
  assert.deepEqual(violations[0].changedFiles, ["src/auth/login.ts"]);
  assert.match(violations[0].detail, /Auth/);
  assert.match(violations[0].detail, /alice@example.com/);
});

test("checkCriticalAreas passes when approval token is in commit message", () => {
  const config = {
    areas: [
      {
        label: "Auth",
        paths: ["src/auth"],
        block: true,
        approvalToken: "[AUTH-OK]",
      },
    ],
  };
  const violations = checkCriticalAreas(config, ["src/auth/login.ts"], {
    commitMessage: "fix: update login flow [AUTH-OK]",
  });
  assert.equal(violations.length, 0);
});

test("checkCriticalAreas warns when block is false", () => {
  const config = {
    areas: [
      {
        label: "Payments",
        paths: ["src/payments"],
        block: false,
      },
    ],
  };
  const violations = checkCriticalAreas(config, ["src/payments/charge.ts"]);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].severity, "warn");
});

test("checkCriticalAreas ignores files outside critical areas", () => {
  const config = {
    areas: [
      {
        label: "Auth",
        paths: ["src/auth"],
        block: true,
      },
    ],
  };
  const violations = checkCriticalAreas(config, ["src/utils/helper.ts", "README.md"]);
  assert.equal(violations.length, 0);
});

test("dim check --block exits 1 on critical area violation", () => {
  const dir = tempRepo();
  try {
    writeJsonConfig(dir, [
      { label: "Auth", paths: ["src/auth"], block: true, approvalToken: "[AUTH-OK]" },
    ]);
    mkdirSync(path.join(dir, "src", "auth"), { recursive: true });
    writeFileSync(path.join(dir, "src", "auth", "login.ts"), "export function login() {}\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: dir });

    // Modify the file and stage it
    writeFileSync(path.join(dir, "src", "auth", "login.ts"), "export function login(v: string) {}\n");
    execFileSync("git", ["add", "."], { cwd: dir });

    let exitCode = 0;
    try {
      execFileSync("node", [CLI, "check", "--block"], { cwd: dir, encoding: "utf8", stdio: "pipe" });
    } catch (err) {
      exitCode = (err as { status?: number }).status ?? 1;
    }
    assert.equal(exitCode, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim check passes when critical area has approval token", () => {
  const dir = tempRepo();
  try {
    writeJsonConfig(dir, [
      { label: "Auth", paths: ["src/auth"], block: true, approvalToken: "[AUTH-OK]" },
    ]);
    execFileSync("node", [CLI, "init"], { cwd: dir, encoding: "utf8" });
    mkdirSync(path.join(dir, "src", "auth"), { recursive: true });
    writeFileSync(path.join(dir, "src", "auth", "login.ts"), "export function login() {}\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: dir });

    writeFileSync(path.join(dir, "src", "auth", "login.ts"), "export function login(v: string) {}\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "update login [AUTH-OK]"], { cwd: dir });

    // Check against the previous commit (which has the approval token)
    const out = execFileSync("node", [CLI, "check", "--block", "-r", "HEAD~1"], {
      cwd: dir,
      encoding: "utf8",
    });
    // Should not contain CRITICAL violation
    assert.doesNotMatch(out, /CRITICAL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
