/**
 * Token budget utilities for recall/context commands.
 *
 * AIDimag does not require a specific tokenizer. The default estimator uses the
 * rough heuristic that one token is ~4 characters of English text. If a more
 * accurate tokenizer is installed (e.g. `gpt-tokenizer`), it is used instead.
 */

export interface Tokenizer {
  estimate(text: string): number;
}

const charHeuristic: Tokenizer = {
  estimate(text: string): number {
    // Conservative English average; falls back when no tokenizer is installed.
    return Math.max(1, Math.ceil(text.length / 4));
  },
};

let cached: Tokenizer | undefined;
let cachedModel: string | undefined;

/** Approximate characters-per-token ratios for different model families. */
const MODEL_RATIOS: Record<string, number> = {
  // OpenAI GPT-4/GPT-3.5: ~4 chars/token for English, slightly less for code
  openai: 4,
  gpt: 4,
  // Claude: ~3.5 chars/token — Anthropic's tokenizer is slightly more granular
  claude: 3.5,
  anthropic: 3.5,
  // Gemini: ~4 chars/token, similar to GPT for English text
  gemini: 4,
  google: 4,
  // Llama / Mistral: ~3.8 chars/token — SentencePiece-based tokenizers
  llama: 3.8,
  mistral: 3.8,
  // Default heuristic
  default: 4,
};

/**
 * Get a tokenizer for the configured model. Uses `AIDIMAG_TOKENIZER` env var
 * or `AIDIMAG_MODEL` to select the tokenizer. Supports:
 *  - `openai` / `gpt` — uses gpt-tokenizer if installed (exact counts)
 *  - `claude` / `anthropic` — heuristic ratio tuned to Claude's tokenizer
 *  - `gemini` / `google` — heuristic ratio tuned to Gemini's tokenizer
 *  - `llama` / `mistral` — heuristic ratio tuned to SentencePiece tokenizers
 * Falls back to the default ~4-char heuristic.
 */
export async function getTokenizer(): Promise<Tokenizer> {
  const preferred = process.env.AIDIMAG_TOKENIZER;
  const model = process.env.AIDIMAG_MODEL ?? preferred ?? "";
  const cacheKey = `${preferred ?? ""}|${model}`;

  if (cached && cachedModel === cacheKey) return cached;

  // Try exact tokenizer for OpenAI
  if (preferred === "openai" || preferred === "gpt" || /^gpt/i.test(model)) {
    try {
      // @ts-ignore - optional dependency, not always installed
      const mod = await import("gpt-tokenizer");
      cached = {
        estimate(text: string): number {
          return mod.encode(text).length;
        },
      };
      cachedModel = cacheKey;
      return cached;
    } catch {
      // fall through to heuristic
    }
  }

  // Determine ratio based on model family
  const family = resolveModelFamily(preferred, model);
  const ratio = MODEL_RATIOS[family] ?? MODEL_RATIOS.default;

  cached = {
    estimate(text: string): number {
      return Math.max(1, Math.ceil(text.length / ratio));
    },
  };
  cachedModel = cacheKey;
  return cached;
}

/** Resolve the model family from tokenizer preference or model name. */
function resolveModelFamily(preferred?: string, model?: string): string {
  const p = (preferred ?? "").toLowerCase();
  const m = (model ?? "").toLowerCase();

  if (p === "openai" || p === "gpt" || /^gpt/i.test(m) || /o1|o3|o4/i.test(m)) return "openai";
  if (p === "claude" || p === "anthropic" || /claude|anthropic/i.test(m)) return "claude";
  if (p === "gemini" || p === "google" || /gemini|bard/i.test(m)) return "gemini";
  if (p === "llama" || p === "mistral" || /llama|mistral|mixtral/i.test(m)) return "llama";

  // Try to detect from model name patterns
  if (/sonnet|haiku|opus/i.test(m)) return "claude";
  if (/pro|ultra|flash/i.test(m) && /gemini/i.test(m)) return "gemini";

  return "default";
}

export function estimateMemoryTokens(tokenizer: Tokenizer, m: { claim: string; detail?: string | null }): number {
  return tokenizer.estimate(m.claim) + tokenizer.estimate(m.detail ?? "");
}

export interface RankedMemory {
  memory: { id: string; claim: string; detail?: string | null; kind: string; status: string };
  relevance: number;
}

export interface BudgetResult<T> {
  included: T[];
  totalTokens: number;
  remainingTokens: number;
  dropped: number;
}

/**
 * Greedily include highest-relevance memories until the token budget is exhausted.
 * Simplest useful policy; more advanced policies can prefer GUARDRAIL/INVARIANT first.
 */
export async function applyBudget<T extends RankedMemory>(
  items: T[],
  budgetTokens: number
): Promise<BudgetResult<T>> {
  const tokenizer = await getTokenizer();
  let total = 0;
  const included: T[] = [];
  const preamble = tokenizer.estimate(
    "You are a helpful coding assistant. Use the following verified project memories when answering.\n"
  );
  let remaining = Math.max(0, budgetTokens - preamble);

  for (const item of items) {
    const cost = estimateMemoryTokens(tokenizer, item.memory);
    if (cost <= remaining) {
      included.push(item);
      total += cost;
      remaining -= cost;
    }
  }

  return {
    included,
    totalTokens: total + preamble,
    remainingTokens: remaining,
    dropped: items.length - included.length,
  };
}

/**
 * Character-budget variant: greedily include highest-relevance memories
 * until the character budget is exhausted. Useful when exact token counts
 * are not available and the caller prefers a character-based limit.
 */
export async function applyCharBudget<T extends RankedMemory>(
  items: T[],
  maxChars: number
): Promise<{ included: T[]; totalChars: number; remainingChars: number; dropped: number; totalTokens: number; remainingTokens: number }> {
  const tokenizer = await getTokenizer();
  let totalChars = 0;
  const included: T[] = [];
  const preamble = "You are a helpful coding assistant. Use the following verified project memories when answering.\n";
  let remaining = Math.max(0, maxChars - preamble.length);

  for (const item of items) {
    const text = `${item.memory.claim} ${item.memory.detail ?? ""}`;
    const cost = text.length + 4; // +4 for "- " prefix + newline overhead
    if (cost <= remaining) {
      included.push(item);
      totalChars += cost;
      remaining -= cost;
    }
  }

  const totalTokens = tokenizer.estimate(preamble) + included.reduce((sum, item) => sum + estimateMemoryTokens(tokenizer, item.memory), 0);
  return {
    included,
    totalChars: totalChars + preamble.length,
    remainingChars: remaining,
    dropped: items.length - included.length,
    totalTokens,
    remainingTokens: 0,
  };
}
