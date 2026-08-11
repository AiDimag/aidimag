/**
 * Transcript harvester — out-of-band capture of the context humans type into
 * AI chats. The USER messages in those transcripts are the highest-signal
 * capture source aidimag has: they're the facts a human already decided were
 * worth teaching an AI ("we use X because Y", "never touch Z").
 *
 * Sources (see transcript-sources.ts): Claude Code, Codex CLI, GitHub Copilot
 * (VS Code) and Cursor. `dim harvest` extracts durable, falsifiable claims
 * from those messages with the configured LLM provider (OpenAI/Ollama, same
 * fallback as knowledge ingestion) and queues them as proposals (source
 * `harvest:<tool>`) — nothing becomes active memory without `dim review`.
 *
 * Privacy: opt-in by invocation, local-only (transcripts never leave the
 * machine except to the LLM provider you configured), and secret-looking lines
 * are redacted before extraction. `--install-hook` wires a Claude Code
 * SessionEnd hook so harvesting runs automatically when a session closes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MemoryStore } from "../db/store.js";
import { getTextProvider } from "../knowledge/llm.js";
import { parseClaims, type ExtractedClaim } from "../knowledge/extract.js";
import { debugLog } from "../debug.js";
import { TRANSCRIPT_SOURCES, type TranscriptSource } from "./transcript-sources.js";

// re-export for back-compat (tests, external callers)
export { claudeProjectDir, userMessagesFromTranscript } from "./transcript-sources.js";

/** Cap what we send to the LLM per session (chars). */
const MAX_SESSION_CHARS = 24_000;

export interface SourceHarvestResult {
  source: string;
  label: string;
  sessionsScanned: number;
  messagesConsidered: number;
  proposed: number;
  duplicates: number;
  transcriptDir: string | null;
}

export interface HarvestResult {
  sessionsScanned: number;
  messagesConsidered: number;
  proposed: number;
  duplicates: number;
  provider: string | null;
  /** First detected source's transcript dir (back-compat; prefer `sources`). */
  transcriptDir: string | null;
  /** Per-source breakdown — only sources whose tool/transcripts were found. */
  sources: SourceHarvestResult[];
}

/** Very conservative redaction: drop lines that look like secrets before they reach any LLM. */
export function redactSecrets(text: string): string {
  const SECRET_LINE =
    /(api[-_]?key|secret|token|password|passwd|authorization|bearer\s+[a-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY|aws_access_key_id|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-)/i;
  return text
    .split("\n")
    .map((line) => (SECRET_LINE.test(line) ? "[REDACTED — possible secret]" : line))
    .join("\n");
}

export const HARVEST_EXTRACT_INSTRUCTIONS = `You are reviewing messages a DEVELOPER typed into an AI coding assistant while working on their project. These messages often contain durable project knowledge the developer was teaching the AI: decisions, conventions, gotchas, failed approaches, architecture facts, rules.

Extract that durable knowledge as FALSIFIABLE claims. Rules:

1. Only durable, project-specific facts the HUMAN stated — not the task of the day, not questions, not generic programming advice.
2. Write each claim as a checkable statement about the codebase.
3. kinds: DECISION, CONVENTION, GOTCHA, FAILED_APPROACH, ARCHITECTURE, INVARIANT, GUARDRAIL (set guardrail_level: never|ask-first|always), SKILL, TODO_CONTEXT.
4. Scope with paths/symbols when the messages name them; else leave empty.
5. In "rationale", QUOTE the fragment of the developer's message the claim came from.
6. Extract 0–8 claims. Zero is fine — most sessions contain none. Do NOT invent.

Respond with ONLY a JSON object of this exact shape:
{"claims":[{"kind":"CONVENTION","claim":"...","paths":["src/x"],"symbols":[],"guardrail_level":null,"rationale":"user said: \\"...\\""}]}`;

function cursorMetaKey(source: TranscriptSource): string {
  // claude-code keeps its historical key so existing installs don't rescan
  return source.name === "claude-code"
    ? "harvest_claude_last_mtime"
    : `harvest_${source.name.replace(/-/g, "_")}_last_mtime`;
}

/**
 * Harvest new/updated AI-chat sessions for this repo — across every detected
 * source — into the proposal queue. Cursor-tracked by transcript mtime per
 * source; `all` rescans everything (the proposal dedupe index absorbs repeats).
 */
export async function harvestSessions(
  store: MemoryStore,
  repoRoot: string,
  opts: { all?: boolean; sources?: string[] } = {}
): Promise<HarvestResult> {
  const result: HarvestResult = {
    sessionsScanned: 0,
    messagesConsidered: 0,
    proposed: 0,
    duplicates: 0,
    provider: null,
    transcriptDir: null,
    sources: [],
  };

  const wanted = opts.sources?.length
    ? TRANSCRIPT_SOURCES.filter((s) => opts.sources!.includes(s.name))
    : TRANSCRIPT_SOURCES;

  // detect sources first so we can report "no transcripts anywhere" without an LLM
  const detected: Array<{
    source: TranscriptSource;
    sessions: NonNullable<ReturnType<TranscriptSource["sessions"]>>;
  }> = [];
  for (const source of wanted) {
    let sessions;
    try {
      sessions = source.sessions(repoRoot);
    } catch (err) {
      debugLog(`harvest source ${source.name} discovery (skipped)`, err);
      continue;
    }
    if (sessions === null) continue;
    detected.push({ source, sessions });
  }
  if (!detected.length) return result;
  result.transcriptDir = detected[0].source.transcriptDir(repoRoot);

  const provider = await getTextProvider();
  if (!provider) return result;
  result.provider = `${provider.name}/${provider.model}`;

  for (const { source, sessions } of detected) {
    const sourceResult: SourceHarvestResult = {
      source: source.name,
      label: source.label,
      sessionsScanned: 0,
      messagesConsidered: 0,
      proposed: 0,
      duplicates: 0,
      transcriptDir: source.transcriptDir(repoRoot),
    };
    result.sources.push(sourceResult);

    const metaKey = cursorMetaKey(source);
    const cursor = opts.all ? 0 : parseFloat(store.getMeta(metaKey) ?? "0") || 0;
    const pending = sessions
      .filter((s) => opts.all || s.mtimeMs > cursor)
      .sort((a, b) => a.mtimeMs - b.mtimeMs);
    let maxMtime = cursor;

    for (const s of pending) {
      sourceResult.sessionsScanned++;
      maxMtime = Math.max(maxMtime, s.mtimeMs);
      let messages: string[];
      try {
        messages = s.messages();
      } catch (err) {
        debugLog(`harvest transcript ${source.name}/${s.id} (skipped)`, err);
        continue; // unreadable/partial file — retry next --all run (cursor still advances past it)
      }
      if (!messages.length) continue;
      sourceResult.messagesConsidered += messages.length;

      const corpus = redactSecrets(messages.join("\n\n---\n\n")).slice(0, MAX_SESSION_CHARS);
      let claims: ExtractedClaim[];
      try {
        const raw = await provider.generate(
          HARVEST_EXTRACT_INSTRUCTIONS,
          `Developer messages from one coding session on this project:\n\n----- BEGIN MESSAGES -----\n${corpus}\n----- END MESSAGES -----`
        );
        claims = parseClaims(raw);
      } catch (err) {
        debugLog(`harvest llm extraction ${source.name}/${s.id} (skipped)`, err);
        continue; // provider hiccup — this session retries on the next --all run
      }

      for (const c of claims) {
        const p = store.propose({
          kind: c.kind,
          claim: c.claim,
          paths: c.paths,
          symbols: c.symbols,
          guardrailLevel: c.guardrailLevel,
          rationale: c.rationale ?? `Stated by the user in a ${source.label} session.`,
          evidence: [
            { type: "HUMAN_ATTESTED", payload: `stated by user in ${source.label} session ${s.id.slice(0, 8)}` },
          ],
          source: `harvest:${source.name}`,
          sourceRef: s.id,
        });
        if (p) sourceResult.proposed++;
        else sourceResult.duplicates++;
      }
    }

    if (maxMtime > cursor) store.setMeta(metaKey, String(maxMtime));
    result.sessionsScanned += sourceResult.sessionsScanned;
    result.messagesConsidered += sourceResult.messagesConsidered;
    result.proposed += sourceResult.proposed;
    result.duplicates += sourceResult.duplicates;
  }

  return result;
}

/** Back-compat alias — harvests all detected sources, not just Claude Code. */
export const harvestClaudeSessions = harvestSessions;

// ---------------------------------------------------------------- hook install

const HOOK_COMMAND = "dim harvest -q";

/**
 * Wire `dim harvest -q` into the repo's Claude Code SessionEnd hook
 * (.claude/settings.json) so every session is harvested when it closes.
 * Additive: merges with existing settings, never clobbers other hooks.
 * (Codex/Copilot/Cursor have no session-end hook — those sources are swept
 * whenever `dim harvest` runs.)
 */
export function installClaudeSessionEndHook(repoRoot: string): { installed: boolean; settingsPath: string } {
  const settingsPath = path.join(repoRoot, ".claude", "settings.json");
  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    } catch {
      throw new Error(`${settingsPath} exists but is not valid JSON — fix it before installing the hook.`);
    }
  }
  const hooks = (settings.hooks ??= {}) as Record<string, unknown>;
  const sessionEnd = (hooks.SessionEnd ??= []) as Array<{ hooks?: Array<{ type?: string; command?: string }> }>;
  const already = sessionEnd.some((m) => m.hooks?.some((h) => h.command?.includes("dim harvest")));
  if (already) return { installed: false, settingsPath };

  sessionEnd.push({ hooks: [{ type: "command", command: HOOK_COMMAND }] });
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return { installed: true, settingsPath };
}

