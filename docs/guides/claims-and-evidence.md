# Writing claims & evidence

The quality of your memory comes down to two things: writing **falsifiable claims** and
attaching **evidence**. This guide shows how to do both well.

## What makes a good claim

A claim should be a statement that could, in principle, be **checked against the code** and
found true or false.

| ❌ Vague (avoid) | ✅ Falsifiable (good) |
|---|---|
| "The auth code is tricky." | "JWT refresh in `src/auth/refresh.ts` must run before the middleware chain; reordering breaks session renewal." |
| "We use a service layer." | "All HTTP handlers call a `*Service` class; handlers never touch the DB directly." |
| "Don't break the API." | "Every response from `src/api/` is validated against the Zod schema in `src/api/schemas.ts`." |

Tips:

- **Be specific and scoped.** Name files, symbols, and conditions.
- **State the consequence.** "…reordering breaks session renewal" tells the reader *why*.
- **One idea per memory.** Split compound rules so each can be verified independently.

## Scope it

Use `-p` (paths) and `-s` (symbols) to say where a memory applies. Scoped memories surface
exactly when an agent touches those files:

```sh
dim remember "Money amounts are integer cents, never floats" \
  -k INVARIANT -p src/billing -s Money
```

Leave scope off only for genuinely repo-wide rules.

## Attach evidence

Evidence is what lets a memory **verify itself** over time. Pick the cheapest type that
proves the claim.

### STATIC_CHECK — a shell command

The most useful type. The command should exit `0` **only if the claim holds**.

```sh
# "Nothing outside src/db imports better-sqlite3"
dim remember "All DB access goes through src/db/store.ts" -k CONVENTION -p src \
  -e "STATIC_CHECK:! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts"

# "The routes directory exists"
-e "STATIC_CHECK:test -d src/routes"

# "No TODO markers left in the payments module"
-e "STATIC_CHECK:! grep -rq TODO src/payments"
```

### COMMIT_REF — anchor to a commit

Proves a decision was made at a known commit. Add `:path1,path2` to also fail if those files
change later.

```sh
-e "COMMIT_REF:abc1234"
-e "COMMIT_REF:abc1234:src/auth/refresh.ts"
```

### TEST_RESULT — a test command (deep tier)

Runs only with `dim verify --deep`. Exit 0 = pass.

```sh
-e "TEST_RESULT:npm test -- auth/refresh.test.ts"
```

### EXEC_TRACE — command output must match (deep tier)

Format is `command :: expected-output-regex`.

```sh
-e "EXEC_TRACE:node -e 'console.log(typeof config.port)' :: number"
```

### HUMAN_ATTESTED — last resort

"A human said so." It verifies once, then decays fastest, because nobody is re-checking it.
Use it only when no machine check is possible.

## Multiple pieces of evidence

You can attach several. A memory goes **stale** if *any* piece fails, and **verified** when
all the machine-checkable ones pass:

```sh
dim remember "Public API responses are schema-validated" -k INVARIANT -p src/api \
  -e "STATIC_CHECK:grep -rq schema.parse src/api" \
  -e "TEST_RESULT:npm test -- api/contract.test.ts"
```

## Failed approaches

`FAILED_APPROACH` memories capture something that was tried and reverted, so agents don't
repeat it. Write the claim as the abandoned approach and its consequence, and use
`-a, --applies-when` (or `applies_when` via MCP) to list the conditions under which the failure
is still relevant. This prevents the memory from blocking the approach forever after the
underlying cause has been fixed.

```sh
# The reverted retry logic only applies while idempotency keys are absent
dim remember "Retrying declined payments caused duplicate ledger entries" \
  -k FAILED_APPROACH -p src/payments \
  -a idempotency_not_enabled pre_feature_flag_v2 \
  -e COMMIT_REF:abc1234
```

`dim mine` detects git revert commits and automatically proposes `FAILED_APPROACH` memories
with the original commit as evidence and an `applies_when` condition pointing back to the
reverted approach. Refine the conditions during review — they are opaque condition strings
that future checks can evaluate against the repo state.

## Verify your work

After adding evidence, confirm it actually checks what you think:

```sh
dim verify -i <id>
```

If it flips to **verified**, your evidence works. If it's unexpectedly **stale**, your
command is wrong (or the claim is already false) — fix one of them.

## Why bother with evidence?

A claim without evidence can only ever be *unverified* and will slowly **decay** until it's
demoted. A claim *with* evidence re-confirms itself automatically as the code evolves — and
loudly goes stale the moment reality diverges. That self-correction is the entire point of
aidimag.

Next: **[Verifying memories](/guides/verifying)**.

