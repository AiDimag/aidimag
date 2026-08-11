/**
 * Transcript source adapters — each AI coding tool persists chat transcripts
 * somewhere different; this module knows where, and how to pull out the
 * genuine human-typed messages. The harvest orchestrator (harvest.ts) treats
 * every source identically: discover sessions → extract user messages →
 * redact → LLM claim extraction → proposal queue.
 *
 * Supported:
 *  - claude-code      ~/.claude/projects/<path-slug>/*.jsonl
 *  - codex            ~/.codex/sessions/(**)/*.jsonl (rollout files, matched by cwd)
 *  - copilot-vscode   VS Code workspaceStorage/<hash>/chatSessions/*.json
 *  - cursor           Cursor workspaceStorage/<hash>/state.vscdb (SQLite)
 *
 * Not supported: Devin (cloud-hosted, no local transcripts).
 */

import Database from "better-sqlite3";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { debugLog } from "../debug.js";

/** Ignore short/noisy user turns ("yes", "continue", slash commands…). */
const MIN_MESSAGE_CHARS = 40;

/** One harvestable chat session (a transcript file / workspace DB). */
export interface TranscriptSession {
  /** Stable id used for dedupe + evidence (file basename or workspace hash). */
  id: string;
  mtimeMs: number;
  /** Lazily read + parse the human-typed messages. May throw on unreadable input. */
  messages(): string[];
}

export interface TranscriptSource {
  /** Stable slug: proposals get source `harvest:<name>`, cursor meta `harvest_<name>_last_mtime`. */
  name: string;
  /** Human-readable tool name for CLI output and evidence text. */
  label: string;
  /** Where transcripts live (for CLI hints); null if the tool isn't installed. */
  transcriptDir(repoRoot: string): string | null;
  /** All sessions for this repo, or null when the tool/transcripts are absent. */
  sessions(repoRoot: string): TranscriptSession[] | null;
}

/** Shared turn filter: drop scaffolding (`<system>…`, slash commands) and trivial turns. */
function keepHumanTurn(text: string): boolean {
  return Boolean(text) && !text.startsWith("<") && !text.startsWith("/") && text.length >= MIN_MESSAGE_CHARS;
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

// ================================================================ Claude Code

/** Claude Code stores transcripts under a slug of the project's absolute path. */
export function claudeProjectDir(repoRoot: string): string | null {
  const slug = path.resolve(repoRoot).replace(/[^a-zA-Z0-9]/g, "-");
  const dir = path.join(homedir(), ".claude", "projects", slug);
  return existsSync(dir) ? dir : null;
}

/** Extract genuine human-typed messages from one Claude Code session JSONL. */
export function userMessagesFromTranscript(jsonl: string): string[] {
  const out: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (entry.type !== "user" || entry.isMeta) continue;
    const message = entry.message as { role?: string; content?: unknown } | undefined;
    if (!message || message.role !== "user") continue;

    let text = "";
    if (typeof message.content === "string") {
      text = message.content;
    } else if (Array.isArray(message.content)) {
      // tool_result blocks are machine output, not the human — skip them
      text = (message.content as Array<{ type?: string; text?: string }>)
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("\n");
    }
    text = text.trim();
    if (keepHumanTurn(text)) out.push(text);
  }
  return out;
}

const claudeCodeSource: TranscriptSource = {
  name: "claude-code",
  label: "Claude Code",
  transcriptDir: (repoRoot) => claudeProjectDir(repoRoot),
  sessions(repoRoot) {
    const dir = claudeProjectDir(repoRoot);
    if (!dir) return null;
    return readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const abs = path.join(dir, f);
        return {
          id: f.replace(/\.jsonl$/, ""),
          mtimeMs: statSync(abs).mtimeMs,
          messages: () => userMessagesFromTranscript(readFileSync(abs, "utf8")),
        };
      });
  },
};

// ================================================================ Codex CLI

function codexSessionsDir(): string | null {
  const dir = path.join(homedir(), ".codex", "sessions");
  return existsSync(dir) ? dir : null;
}

function walkJsonl(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonl(abs, out);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(abs);
  }
  return out;
}

/**
 * Parse one Codex rollout JSONL: find the session's cwd (session_meta /
 * turn_context) and the human-typed user messages. Handles both the wrapped
 * (`{type:"response_item",payload:{…}}`) and older flat line formats.
 */
export function codexTranscript(jsonl: string): { cwd: string | null; messages: string[] } {
  let cwd: string | null = null;
  const messages: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const payload = (entry.payload && typeof entry.payload === "object" ? entry.payload : entry) as Record<
      string,
      unknown
    >;
    if (!cwd && typeof payload.cwd === "string") cwd = payload.cwd;

    if (payload.type !== "message" || payload.role !== "user") continue;
    let text = "";
    if (typeof payload.content === "string") {
      text = payload.content;
    } else if (Array.isArray(payload.content)) {
      text = (payload.content as Array<{ type?: string; text?: string }>)
        .filter((c) => (c.type === "input_text" || c.type === "text") && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("\n");
    }
    text = text.trim();
    // Codex injects <environment_context>/<user_instructions> as user turns — startsWith("<") drops them
    if (keepHumanTurn(text)) messages.push(text);
  }
  return { cwd, messages };
}

const codexSource: TranscriptSource = {
  name: "codex",
  label: "Codex CLI",
  transcriptDir: () => codexSessionsDir(),
  sessions(repoRoot) {
    const dir = codexSessionsDir();
    if (!dir) return null;
    const sessions: TranscriptSession[] = [];
    for (const abs of walkJsonl(dir)) {
      sessions.push({
        id: path.basename(abs, ".jsonl"),
        mtimeMs: statSync(abs).mtimeMs,
        messages: () => {
          const { cwd, messages } = codexTranscript(readFileSync(abs, "utf8"));
          // only harvest sessions that ran inside this repo
          if (!cwd || !(samePath(cwd, repoRoot) || path.resolve(cwd).startsWith(path.resolve(repoRoot) + path.sep))) {
            return [];
          }
          return messages;
        },
      });
    }
    return sessions;
  },
};

// ================================================================ VS Code workspace storage (Copilot + Cursor)

/** Per-platform user-data roots for a VS Code-family app ("Code", "Cursor", …). */
function appStorageRoots(app: string): string[] {
  const home = homedir();
  const roots: string[] = [];
  if (process.platform === "darwin") {
    roots.push(path.join(home, "Library", "Application Support", app));
  } else if (process.platform === "win32") {
    if (process.env.APPDATA) roots.push(path.join(process.env.APPDATA, app));
  } else {
    roots.push(path.join(home, ".config", app));
  }
  return roots.map((r) => path.join(r, "User", "workspaceStorage")).filter((r) => existsSync(r));
}

/** Find the workspaceStorage dirs whose workspace.json points at this repo. */
function workspaceStorageDirsFor(apps: string[], repoRoot: string): string[] {
  const matches: string[] = [];
  for (const app of apps) {
    for (const storageRoot of appStorageRoots(app)) {
      for (const hash of readdirSync(storageRoot)) {
        const wsFile = path.join(storageRoot, hash, "workspace.json");
        if (!existsSync(wsFile)) continue;
        try {
          const ws = JSON.parse(readFileSync(wsFile, "utf8")) as { folder?: string; workspace?: string };
          const uri = ws.folder ?? ws.workspace;
          if (!uri || !uri.startsWith("file://")) continue;
          if (samePath(fileURLToPath(uri), repoRoot)) matches.push(path.join(storageRoot, hash));
        } catch {
          // malformed workspace.json — ignore this workspace
        }
      }
    }
  }
  return matches;
}

// ---------------------------------------------------------------- Copilot (VS Code)

/** Extract human-typed turns from one VS Code Copilot chatSessions/*.json file. */
export function copilotUserMessages(json: string): string[] {
  const out: string[] = [];
  let data: { requests?: Array<{ message?: { text?: string; parts?: Array<{ text?: string }> } }> };
  try {
    data = JSON.parse(json) as typeof data;
  } catch {
    return out;
  }
  for (const req of data.requests ?? []) {
    let text = req.message?.text ?? "";
    if (!text && Array.isArray(req.message?.parts)) {
      text = req.message.parts
        .filter((p) => typeof p.text === "string")
        .map((p) => p.text as string)
        .join("");
    }
    text = text.trim();
    if (keepHumanTurn(text)) out.push(text);
  }
  return out;
}

const copilotSource: TranscriptSource = {
  name: "copilot-vscode",
  label: "GitHub Copilot (VS Code)",
  transcriptDir(repoRoot) {
    const dirs = workspaceStorageDirsFor(["Code", "Code - Insiders", "VSCodium"], repoRoot);
    for (const d of dirs) {
      const chatDir = path.join(d, "chatSessions");
      if (existsSync(chatDir)) return chatDir;
    }
    return null;
  },
  sessions(repoRoot) {
    const dirs = workspaceStorageDirsFor(["Code", "Code - Insiders", "VSCodium"], repoRoot);
    const sessions: TranscriptSession[] = [];
    let found = false;
    for (const d of dirs) {
      const chatDir = path.join(d, "chatSessions");
      if (!existsSync(chatDir)) continue;
      found = true;
      for (const f of readdirSync(chatDir).filter((f) => f.endsWith(".json"))) {
        const abs = path.join(chatDir, f);
        sessions.push({
          id: f.replace(/\.json$/, ""),
          mtimeMs: statSync(abs).mtimeMs,
          messages: () => copilotUserMessages(readFileSync(abs, "utf8")),
        });
      }
    }
    return found ? sessions : null;
  },
};

// ---------------------------------------------------------------- Cursor

/**
 * Cursor keeps chat state in a per-workspace SQLite DB (state.vscdb,
 * ItemTable). Schema is undocumented and drifts between versions, so every
 * read is defensive — a miss just means zero messages.
 */
export function cursorUserMessages(dbPath: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (text: unknown) => {
    if (typeof text !== "string") return;
    const t = text.trim();
    if (!keepHumanTurn(t) || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const rows = db
        .prepare(`SELECT key, value FROM ItemTable WHERE key IN (?, ?)`)
        .all("aiService.prompts", "workbench.panel.aichat.view.aichat.chatdata") as Array<{
        key: string;
        value: string;
      }>;
      for (const row of rows) {
        let value: unknown;
        try {
          value = JSON.parse(row.value);
        } catch {
          continue;
        }
        if (row.key === "aiService.prompts" && Array.isArray(value)) {
          for (const p of value as Array<{ text?: string }>) push(p?.text);
        } else if (row.key.endsWith("chatdata") && value && typeof value === "object") {
          const tabs = (value as { tabs?: Array<{ bubbles?: Array<{ type?: string; text?: string }> }> }).tabs ?? [];
          for (const tab of tabs) {
            for (const b of tab.bubbles ?? []) {
              if (b?.type === "user") push(b.text);
            }
          }
        }
      }
    } finally {
      db.close();
    }
  } catch (err) {
    debugLog(`cursor transcript ${dbPath} (skipped)`, err);
  }
  return out;
}

const cursorSource: TranscriptSource = {
  name: "cursor",
  label: "Cursor",
  transcriptDir(repoRoot) {
    const dirs = workspaceStorageDirsFor(["Cursor"], repoRoot);
    return dirs.find((d) => existsSync(path.join(d, "state.vscdb"))) ?? null;
  },
  sessions(repoRoot) {
    const dirs = workspaceStorageDirsFor(["Cursor"], repoRoot);
    const sessions: TranscriptSession[] = [];
    let found = false;
    for (const d of dirs) {
      const dbPath = path.join(d, "state.vscdb");
      if (!existsSync(dbPath)) continue;
      found = true;
      sessions.push({
        id: path.basename(d), // workspace hash — one rolling "session" per workspace DB
        mtimeMs: statSync(dbPath).mtimeMs,
        messages: () => cursorUserMessages(dbPath),
      });
    }
    return found ? sessions : null;
  },
};

// ================================================================ registry

/** All known transcript sources, in harvest order. */
export const TRANSCRIPT_SOURCES: TranscriptSource[] = [claudeCodeSource, codexSource, copilotSource, cursorSource];



