/**
 * Generic reader/writer for the committed, secret-free repo config at
 * <repo>/.aidimag/config.json. Ticket + sync sections have their own typed
 * helpers; this covers the rest (generateContext, preCommitCheck, ...).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { GuardrailLevel } from "./types.js";

export type ContextFormat = "claude" | "cursorrules" | "copilot" | "windsurfrules" | "agents" | "all";

export interface GenerateContextConfig {
  /** which file(s) to write — defaults to "claude" */
  format?: ContextFormat;
  /** regenerate automatically after verify/sync/review */
  auto?: boolean;
}

/** "block" → exit 1 on violations; true → warn (exit 0); falsy → hook is a no-op. */
export type PreCommitCheckConfig = boolean | "warn" | "block";

/**
 * MCP pre-edit enforcement mode:
 *  - "warn" — return STOP/ASK_FIRST decision but don't prevent the edit (default)
 *  - "enforce" — return a structured error that the agent must respect
 *  - "off" — no pre-edit checks
 */
export type McpEnforceConfig = "warn" | "enforce" | "off";

/** Who summarizes dropped knowledge docs: auto (agent→llm), agent-only, llm-only, or off. */
export type KnowledgeSummarizer = "auto" | "agent" | "llm" | "off";

export interface KnowledgeConfig {
  /** inbox folder (repo-relative) where docs are dropped — default "knowledge" */
  folder?: string;
  /** summarizer strategy — default "auto" */
  summarizer?: KnowledgeSummarizer;
  /** require `dim review` approval before pinning — default true */
  requireReview?: boolean;
  /** keep a backup of the original in .aidimag/knowledge/processed/ — default true */
  backup?: boolean;
  /** text extensions we will summarize — default DEFAULT_KNOWLEDGE_EXTENSIONS */
  extensions?: string[];
  /** hard cap; larger files are skipped — default 1 MiB */
  maxBytes?: number;
  /** soft threshold; larger text docs are chunked — default 16 KiB */
  chunkBytes?: number;
}

export interface RetentionConfig {
  /** memories older than this many days with no evidence are eligible for auto-forget — 0 = disabled */
  maxAgeDays?: number;
  /** also forget STALE memories older than this many days regardless of evidence — 0 = disabled */
  staleAgeDays?: number;
  /** never auto-forget pinned memories — default true */
  preservePinned?: boolean;
  /** never auto-forget memories created by these sources (e.g. "human", "knowledge:") */
  preserveSources?: string[];
  /** dry-run: report what would be forgotten without deleting — default false */
  dryRun?: boolean;
}

export interface OllamaConfig {
  /** embedding model for semantic search — default "nomic-embed-text" */
  embeddingModel?: string;
  /** chat/LLM model for mining/harvest/bootstrap — default "llama3.1" */
  llmModel?: string;
}

export interface AidimagConfig {
  generateContext?: GenerateContextConfig;
  preCommitCheck?: PreCommitCheckConfig;
  mcpEnforce?: McpEnforceConfig;
  knowledge?: KnowledgeConfig;
  retention?: RetentionConfig;
  onboarded?: boolean;
  ollama?: OllamaConfig;
  [k: string]: unknown;
}

export const DEFAULT_KNOWLEDGE_EXTENSIONS = [
  ".md", ".markdown", ".txt", ".rst", ".adoc", ".org",
  ".json", ".yaml", ".yml", ".toml", ".csv", ".html",
  ".pdf", ".docx", // binary docs — text is extracted before summarization
];

export interface ResolvedKnowledgeConfig {
  folder: string;
  summarizer: KnowledgeSummarizer;
  requireReview: boolean;
  backup: boolean;
  extensions: string[];
  maxBytes: number;
  chunkBytes: number;
}

/** Reject repo-relative knowledge inbox paths that escape or touch sensitive dirs. */
function safeKnowledgeFolder(folder: string): string {
  const normalized = folder.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!normalized || normalized.includes("..") || normalized.startsWith(".aidimag")) return "knowledge";
  return normalized;
}

/** Knowledge config with every field filled in from defaults. */
export function resolveKnowledgeConfig(repoRoot: string): ResolvedKnowledgeConfig {
  const k = readConfig(repoRoot).knowledge ?? {};
  return {
    folder: safeKnowledgeFolder(k.folder ?? "knowledge"),
    summarizer: k.summarizer ?? "auto",
    requireReview: k.requireReview ?? true,
    backup: k.backup ?? true,
    extensions: (k.extensions ?? DEFAULT_KNOWLEDGE_EXTENSIONS).map((e) =>
      e.startsWith(".") ? e.toLowerCase() : "." + e.toLowerCase()
    ),
    maxBytes: k.maxBytes ?? 1024 * 1024,
    chunkBytes: k.chunkBytes ?? 16 * 1024,
  };
}

export interface ResolvedRetentionConfig {
  maxAgeDays: number;
  staleAgeDays: number;
  preservePinned: boolean;
  preserveSources: string[];
  dryRun: boolean;
}

/** Retention config with defaults filled in. maxAgeDays=0 means disabled. */
export function resolveRetentionConfig(repoRoot: string): ResolvedRetentionConfig {
  const r = readConfig(repoRoot).retention ?? {};
  return {
    maxAgeDays: r.maxAgeDays ?? 0,
    staleAgeDays: r.staleAgeDays ?? 0,
    preservePinned: r.preservePinned ?? true,
    preserveSources: r.preserveSources ?? ["human", "knowledge:"],
    dryRun: r.dryRun ?? false,
  };
}

function configPath(repoRoot: string): string {
  return path.join(repoRoot, ".aidimag", "config.json");
}

export function readConfig(repoRoot: string): AidimagConfig {
  try {
    return JSON.parse(readFileSync(configPath(repoRoot), "utf8")) as AidimagConfig;
  } catch {
    return {};
  }
}

/** Shallow-merge a patch into config.json, never clobbering sibling sections. */
export function writeConfig(repoRoot: string, patch: Partial<AidimagConfig>): void {
  const p = configPath(repoRoot);
  mkdirSync(path.dirname(p), { recursive: true });
  const existing = readConfig(repoRoot);
  writeFileSync(p, JSON.stringify({ ...existing, ...patch }, null, 2) + "\n");
}

export type { GuardrailLevel };

export function resolveMcpEnforceConfig(repoRoot: string): McpEnforceConfig {
  const cfg = readConfig(repoRoot).mcpEnforce;
  if (cfg === "enforce" || cfg === "off" || cfg === "warn") return cfg;
  return "warn";
}

