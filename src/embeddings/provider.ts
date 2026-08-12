/**
 * Embedding providers — pluggable, zero-config auto-detection.
 *
 *   AIDIMAG_EMBEDDINGS = auto (default) | openai | ollama | bedrock | off
 *
 * auto: OpenAI if OPENAI_API_KEY is set, else Ollama if reachable, else off
 * (search degrades gracefully to FTS-only — aidimag never *requires* embeddings).
 *
 * Bedrock is explicit-only (AIDIMAG_EMBEDDINGS=bedrock, never auto-detected —
 * probing would make a billable AWS call). Credentials come from the standard
 * AWS chain (env vars, ~/.aws profiles, SSO, instance roles).
 *   AIDIMAG_BEDROCK_EMBED_MODEL (default amazon.titan-embed-text-v2:0, dim 1024)
 *   AIDIMAG_BEDROCK_REGION      (default: AWS SDK resolution)
 */

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

const OLLAMA_URL = process.env.AIDIMAG_OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.AIDIMAG_OLLAMA_MODEL ?? "nomic-embed-text";
const OPENAI_MODEL = process.env.AIDIMAG_OPENAI_MODEL ?? "text-embedding-3-small";

class OpenAiProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly model = OPENAI_MODEL;
  readonly dim = 1536;

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings: HTTP ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return body.data.map((d) => d.embedding);
  }
}

class OllamaProvider implements EmbeddingProvider {
  readonly name = "ollama";
  readonly model = OLLAMA_MODEL;
  readonly dim: number;

  constructor(dim: number) {
    this.dim = dim;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      if (!res.ok) throw new Error(`Ollama embeddings: HTTP ${res.status}`);
      const body = (await res.json()) as { embedding: number[] };
      out.push(body.embedding);
    }
    return out;
  }

  static async detect(): Promise<OllamaProvider | null> {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt: "probe" }),
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const body = (await res.json()) as { embedding?: number[] };
      if (!body.embedding?.length) return null;
      return new OllamaProvider(body.embedding.length);
    } catch {
      return null;
    }
  }
}

let cached: EmbeddingProvider | null | undefined;

const BEDROCK_EMBED_MODEL = process.env.AIDIMAG_BEDROCK_EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";

/**
 * AWS Bedrock embeddings (Titan Embed v2 by default, 1024-dim). Explicit
 * opt-in only — see module header. SDK imported lazily to keep CLI cold-start
 * unaffected for non-Bedrock users. Titan's API is single-text, so embed()
 * issues one InvokeModel per text (reindex batches are small: 16).
 */
class BedrockEmbeddingProvider implements EmbeddingProvider {
  readonly name = "bedrock";
  readonly model = BEDROCK_EMBED_MODEL;
  readonly dim = parseInt(process.env.AIDIMAG_BEDROCK_EMBED_DIM ?? "1024", 10);
  private client: import("@aws-sdk/client-bedrock-runtime").BedrockRuntimeClient | null = null;

  async embed(texts: string[]): Promise<number[][]> {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
    if (!this.client) {
      this.client = new BedrockRuntimeClient(
        process.env.AIDIMAG_BEDROCK_REGION ? { region: process.env.AIDIMAG_BEDROCK_REGION } : {}
      );
    }
    const out: number[][] = [];
    for (const text of texts) {
      const res = await this.client.send(
        new InvokeModelCommand({
          modelId: this.model,
          contentType: "application/json",
          body: JSON.stringify({ inputText: text, dimensions: this.dim }),
        })
      );
      const body = JSON.parse(new TextDecoder().decode(res.body)) as { embedding?: number[] };
      if (!body.embedding?.length) throw new Error(`Bedrock embeddings: empty response from ${this.model}`);
      out.push(body.embedding);
    }
    return out;
  }
}

/** Resolve the configured/auto-detected provider (cached per process). */
export async function getEmbeddingProvider(): Promise<EmbeddingProvider | null> {
  if (cached !== undefined) return cached;
  const mode = (process.env.AIDIMAG_EMBEDDINGS ?? "auto").toLowerCase();

  if (mode === "off") return (cached = null);
  if (mode === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("AIDIMAG_EMBEDDINGS=openai but OPENAI_API_KEY is not set");
    return (cached = new OpenAiProvider());
  }
  if (mode === "bedrock") {
    return (cached = new BedrockEmbeddingProvider());
  }
  if (mode === "ollama") {
    const p = await OllamaProvider.detect();
    if (!p) throw new Error(`AIDIMAG_EMBEDDINGS=ollama but Ollama is not reachable at ${OLLAMA_URL} (model: ${OLLAMA_MODEL})`);
    return (cached = p);
  }
  // auto
  if (process.env.OPENAI_API_KEY) return (cached = new OpenAiProvider());
  return (cached = await OllamaProvider.detect());
}

