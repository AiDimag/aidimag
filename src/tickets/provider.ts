/**
 * Ticket-aware capture (TICKETS_DESIGN.md, phases T1–T2).
 *
 * Architecture principle: contract + adapters, not a mandatory service.
 * aidimag core only ever knows `TicketProvider.getTicket(id)`. All API
 * parsing, auth, and rate-limit handling lives behind that boundary:
 *
 *   JiraProvider    direct API, local creds
 *   GitHubProvider  direct API (issues), local creds
 *   HttpProvider    any URL implementing the contract (BYO middleware)
 *   (RemoteProvider via the sync server lands with T3)
 *
 * Hard rule: ticket FETCH is lazy and non-blocking — the post-commit hook
 * only extracts the ticket id (regex, offline); getTicket runs at review
 * time or on demand (`dim ticket show`).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { isAllowedTicketBaseUrl } from "../security/url.js";

// ---------------------------------------------------------------- contract

export interface Ticket {
  id: string;
  url: string;
  title: string;
  /** description, truncated (~2KB) */
  body: string;
  type: "bug" | "story" | "task" | "epic" | "other";
  status: "open" | "in_progress" | "done" | "other";
  labels: string[];
  parent?: { id: string; title: string };
}

export interface TicketProvider {
  readonly name: string;
  getTicket(id: string): Promise<Ticket | null>;
}

// ---------------------------------------------------------------- config

export interface BranchRules {
  pattern?: string;
  exempt?: string[];
  enforce?: "push" | "warn" | "off";
}

export interface TicketsConfig {
  provider?: "jira" | "github" | "linear" | "http" | "remote" | "gitlab" | "azuredevops" | "clickup" | "shortcut" | "youtrack" | "asana" | "trello" | "notion" | "pivotal";
  /** ticket-id regex for branch/commit-message extraction */
  pattern?: string;
  /** Jira site / GitHub repo URL / HttpProvider endpoint (unused for remote) */
  baseUrl?: string;
  branch?: BranchRules;
}

/** Where each provider's API token lives — used by the interactive connect flow. */
export const TOKEN_PAGES: Record<string, string> = {
  jira: "https://id.atlassian.com/manage-profile/security/api-tokens",
  github: "https://github.com/settings/tokens",
  linear: "https://linear.app/settings/account/security",
  gitlab: "https://gitlab.com/-/user_settings/personal_access_tokens",
  azuredevops: "https://dev.azure.com/_usersSettings/tokens",
  clickup: "https://app.clickup.com/settings/apps",
  shortcut: "https://app.shortcut.com/settings/account/api-tokens",
  youtrack: "https://www.jetbrains.com/help/youtrack/standalone/Manage-Permanent-Token.html",
  asana: "https://asana.com/guide/help/api/api",
  trello: "https://trello.com/power-ups/admin",
  notion: "https://www.notion.so/my-integrations",
  pivotal: "https://www.pivotaltracker.com/profile",
};

export const DEFAULT_TICKET_PATTERN = "[A-Z][A-Z0-9]+-\\d+";

function configPath(repoRoot: string): string {
  return path.join(repoRoot, ".aidimag", "config.json");
}

export function readTicketsConfig(repoRoot: string): TicketsConfig {
  try {
    const cfg = JSON.parse(readFileSync(configPath(repoRoot), "utf8"));
    return (cfg.tickets as TicketsConfig) ?? {};
  } catch {
    return {};
  }
}

export function writeTicketsConfig(repoRoot: string, tickets: TicketsConfig): void {
  const p = configPath(repoRoot);
  mkdirSync(path.dirname(p), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    // fresh file
  }
  writeFileSync(p, JSON.stringify({ ...existing, tickets }, null, 2) + "\n");
}

// ---------------------------------------------------------------- credentials (never the repo)

function credentialsPath(): string {
  return path.join(homedir(), ".aidimag", "credentials.json");
}

/** Ticket credentials live alongside sync tokens, keyed `ticket:<baseUrl>`. */
export function getTicketCredential(baseUrl: string): string | null {
  if (process.env.AIDIMAG_TICKET_TOKEN) return process.env.AIDIMAG_TICKET_TOKEN;
  try {
    return JSON.parse(readFileSync(credentialsPath(), "utf8"))[`ticket:${baseUrl}`] ?? null;
  } catch {
    return null;
  }
}

export function saveTicketCredential(baseUrl: string, credential: string): void {
  const p = credentialsPath();
  mkdirSync(path.dirname(p), { recursive: true });
  const creds = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  creds[`ticket:${baseUrl}`] = credential;
  writeFileSync(p, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });
  try { chmodSync(p, 0o600); } catch { /* best-effort */ }
}

// ---------------------------------------------------------------- ticket-id extraction (T1 — offline)

/** Extract the first ticket id from text (branch name, commit subject/body). */
export function extractTicketId(text: string, pattern: string = DEFAULT_TICKET_PATTERN): string | null {
  try {
    const m = text.match(new RegExp(pattern));
    return m ? m[0] : null;
  } catch {
    return null; // bad user regex — never break capture
  }
}

/**
 * Ticket id implied by the CURRENT branch (offline, instant). The best prompt
 * is the one the branch name already answered — used by the MCP session-end
 * flow and the VSCode extension.
 */
export function detectBranchTicket(repoRoot: string): string | null {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return extractTicketId(branch, readTicketsConfig(repoRoot).pattern ?? DEFAULT_TICKET_PATTERN);
  } catch {
    return null; // detached HEAD / not a repo
  }
}

// ---------------------------------------------------------------- providers

const FETCH_TIMEOUT_MS = 5_000;
const BODY_LIMIT = 2_048;

async function fetchJson(url: string, headers: Record<string, string>): Promise<Record<string, unknown> | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctl.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(t);
  }
}

function truncate(s: string): string {
  return s.length > BODY_LIMIT ? s.slice(0, BODY_LIMIT) + "…" : s;
}

/** Jira Cloud/Server: GET /rest/api/2/issue/<id>. Credential: "email:apiToken" (Basic) or a PAT (Bearer). */
class JiraProvider implements TicketProvider {
  readonly name = "jira";
  constructor(private baseUrl: string, private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const auth = this.credential.includes(":")
      ? `Basic ${Buffer.from(this.credential).toString("base64")}`
      : `Bearer ${this.credential}`;
    const raw = await fetchJson(`${this.baseUrl}/rest/api/2/issue/${encodeURIComponent(id)}`, {
      Authorization: auth,
      Accept: "application/json",
    });
    if (!raw) return null;
    const f = (raw.fields ?? {}) as Record<string, unknown>;
    const issueType = String((f.issuetype as Record<string, unknown>)?.name ?? "").toLowerCase();
    const statusCat = String(
      ((f.status as Record<string, unknown>)?.statusCategory as Record<string, unknown>)?.key ?? ""
    );
    const parent = f.parent as Record<string, unknown> | undefined;
    return {
      id: String(raw.key ?? id),
      url: `${this.baseUrl}/browse/${raw.key ?? id}`,
      title: String(f.summary ?? ""),
      body: truncate(String(f.description ?? "")),
      type: issueType.includes("bug")
        ? "bug"
        : issueType.includes("story")
          ? "story"
          : issueType.includes("epic")
            ? "epic"
            : issueType.includes("task")
              ? "task"
              : "other",
      status: statusCat === "done" ? "done" : statusCat === "indeterminate" ? "in_progress" : statusCat === "new" ? "open" : "other",
      labels: Array.isArray(f.labels) ? (f.labels as string[]).map(String) : [],
      parent: parent
        ? { id: String(parent.key), title: String(((parent.fields ?? {}) as Record<string, unknown>).summary ?? "") }
        : undefined,
    };
  }
}

/** GitHub Issues: baseUrl is the repo URL (https://github.com/owner/repo); ids are issue numbers ("123" or "#123"). */
class GitHubProvider implements TicketProvider {
  readonly name = "github";
  constructor(private baseUrl: string, private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const m = this.baseUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!m) throw new Error(`tickets.baseUrl must look like https://github.com/owner/repo (got ${this.baseUrl})`);
    const num = id.replace(/^#/, "");
    const raw = await fetchJson(`https://api.github.com/repos/${m[1]}/${m[2].replace(/\.git$/, "")}/issues/${num}`, {
      Authorization: `Bearer ${this.credential}`,
      Accept: "application/vnd.github+json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.labels)
      ? (raw.labels as Array<Record<string, unknown>>).map((l) => String(l.name ?? l))
      : [];
    const lower = labels.map((l) => l.toLowerCase());
    return {
      id: `#${raw.number}`,
      url: String(raw.html_url ?? ""),
      title: String(raw.title ?? ""),
      body: truncate(String(raw.body ?? "")),
      type: lower.some((l) => l.includes("bug")) ? "bug" : lower.some((l) => l.includes("enhancement") || l.includes("feature")) ? "story" : "other",
      status: raw.state === "closed" ? "done" : "open",
      labels,
    };
  }
}

/** Bring-your-own middleware: GET <baseUrl>/ticket/<id> returning the normalized Ticket JSON. */
class HttpProvider implements TicketProvider {
  readonly name = "http";
  constructor(private baseUrl: string, private credential: string | null) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const raw = await fetchJson(`${this.baseUrl.replace(/\/$/, "")}/ticket/${encodeURIComponent(id)}`, {
      ...(this.credential ? { Authorization: `Bearer ${this.credential}` } : {}),
      Accept: "application/json",
    });
    return raw ? (raw as unknown as Ticket) : null;
  }
}

/** Linear: GraphQL API, ids like ENG-123. Credential: a Linear API key. */
class LinearProvider implements TicketProvider {
  readonly name = "linear";
  constructor(private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: { Authorization: this.credential, "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          query: `query($id: String!) { issue(id: $id) {
            identifier url title description
            state { type } labels { nodes { name } }
            parent { identifier title }
          } }`,
          variables: { id },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from api.linear.app`);
      const json = (await res.json()) as { data?: { issue?: Record<string, unknown> | null } };
      const issue = json.data?.issue;
      if (!issue) return null;
      const stateType = String((issue.state as Record<string, unknown>)?.type ?? "");
      const labels = (((issue.labels as Record<string, unknown>)?.nodes ?? []) as Array<{ name: string }>).map(
        (l) => l.name
      );
      const parent = issue.parent as Record<string, unknown> | undefined;
      return {
        id: String(issue.identifier ?? id),
        url: String(issue.url ?? ""),
        title: String(issue.title ?? ""),
        body: truncate(String(issue.description ?? "")),
        type: labels.some((l) => l.toLowerCase().includes("bug")) ? "bug" : "story",
        status: stateType === "completed" || stateType === "canceled" ? "done" : stateType === "started" ? "in_progress" : "open",
        labels,
        parent: parent ? { id: String(parent.identifier), title: String(parent.title ?? "") } : undefined,
      };
    } finally {
      clearTimeout(t);
    }
  }
}

/** GitLab Issues: baseUrl is the project URL; ids are issue numbers. Credential: personal access token. */
class GitLabProvider implements TicketProvider {
  readonly name = "gitlab";
  constructor(private baseUrl: string, private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const m = this.baseUrl.match(/gitlab\.com\/(.+)/);
    const project = m ? encodeURIComponent(m[1].replace(/\.git$/, "").replace(/\/$/, "")) : encodeURIComponent(this.baseUrl.replace(/^https?:\/\//, "").replace(/\.git$/, "").replace(/\/$/, ""));
    const num = id.replace(/^#/, "");
    const raw = await fetchJson(`${this.baseUrl.replace(/\/$/, "")}/api/v4/projects/${project}/issues/${num}`, {
      "PRIVATE-TOKEN": this.credential,
      Accept: "application/json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.labels) ? (raw.labels as string[]).map(String) : [];
    const lower = labels.map((l) => l.toLowerCase());
    return {
      id: `#${raw.iid ?? num}`,
      url: String(raw.web_url ?? ""),
      title: String(raw.title ?? ""),
      body: truncate(String(raw.description ?? "")),
      type: lower.some((l) => l.includes("bug")) ? "bug" : lower.some((l) => l.includes("feature") || l.includes("enhancement")) ? "story" : "other",
      status: raw.state === "closed" ? "done" : "open",
      labels,
    };
  }
}

/** Azure DevOps Boards: baseUrl is https://dev.azure.com/{org}/{project}. Credential: PAT. */
class AzureDevOpsProvider implements TicketProvider {
  readonly name = "azuredevops";
  constructor(private baseUrl: string, private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const auth = Buffer.from(`:${this.credential}`).toString("base64");
    const m = this.baseUrl.match(/dev\.azure\.com\/([^/]+)\/([^/]+)/);
    if (!m) throw new Error(`tickets.baseUrl must look like https://dev.azure.com/{org}/{project} (got ${this.baseUrl})`);
    const org = m[1];
    const project = m[2];
    const raw = await fetchJson(`https://dev.azure.com/${org}/${project}/_apis/wit/workitems/${encodeURIComponent(id)}?api-version=7.1`, {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    });
    if (!raw) return null;
    const fields = (raw.fields ?? {}) as Record<string, unknown>;
    const labels = String(fields["System.Tags"] ?? "").split("; ").filter(Boolean);
    const lower = labels.map((l) => l.toLowerCase());
    const state = String(fields["System.State"] ?? "").toLowerCase();
    return {
      id: String(raw.id ?? id),
      url: String(raw.url ?? `${this.baseUrl}/_workitems/edit/${raw.id ?? id}`),
      title: String(fields["System.Title"] ?? ""),
      body: truncate(String(fields["System.Description"] ?? "")),
      type: lower.some((l) => l.includes("bug")) ? "bug" : lower.some((l) => l.includes("feature") || l.includes("story")) ? "story" : "other",
      status: state === "done" || state === "closed" ? "done" : state === "active" || state === "in progress" ? "in_progress" : "open",
      labels,
    };
  }
}

/** ClickUp: baseUrl is the team/workspace URL. Credential: API token. */
class ClickUpProvider implements TicketProvider {
  readonly name = "clickup";
  constructor(private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const raw = await fetchJson(`https://api.clickup.com/api/v2/task/${encodeURIComponent(id)}`, {
      Authorization: this.credential,
      Accept: "application/json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.tags) ? (raw.tags as Array<Record<string, unknown>>).map((t) => String(t.name ?? t)) : [];
    const lower = labels.map((l) => l.toLowerCase());
    const status = String((raw.status as Record<string, unknown>)?.status ?? "").toLowerCase();
    return {
      id: String(raw.id ?? id),
      url: String(raw.url ?? ""),
      title: String(raw.name ?? ""),
      body: truncate(String(raw.description ?? "")),
      type: lower.some((l) => l.includes("bug")) ? "bug" : "other",
      status: status === "complete" || status === "closed" ? "done" : status === "in progress" ? "in_progress" : "open",
      labels,
    };
  }
}

/** Shortcut (formerly Clubhouse): REST API. Credential: API token. */
class ShortcutProvider implements TicketProvider {
  readonly name = "shortcut";
  constructor(private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const raw = await fetchJson(`https://api.app.shortcut.com/api/v3/stories/${encodeURIComponent(id)}`, {
      "Shortcut-Token": this.credential,
      Accept: "application/json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.labels) ? (raw.labels as Array<Record<string, unknown>>).map((l) => String(l.name ?? l)) : [];
    const lower = labels.map((l) => l.toLowerCase());
    const state = String((raw.workflow_state as Record<string, unknown>)?.name ?? "").toLowerCase();
    return {
      id: String(raw.id ?? id),
      url: String(raw.app_url ?? ""),
      title: String(raw.name ?? ""),
      body: truncate(String(raw.description ?? "")),
      type: lower.some((l) => l.includes("bug")) ? "bug" : lower.some((l) => l.includes("feature")) ? "story" : "other",
      status: state.includes("done") || state.includes("complete") ? "done" : state.includes("progress") ? "in_progress" : "open",
      labels,
    };
  }
}

/** YouTrack (JetBrains): baseUrl is the YouTrack instance URL. Credential: permanent token. */
class YouTrackProvider implements TicketProvider {
  readonly name = "youtrack";
  constructor(private baseUrl: string, private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const raw = await fetchJson(`${this.baseUrl.replace(/\/$/, "")}/api/issues/${encodeURIComponent(id)}?fields=id,summary,description,type(name),state(name),tags(name),url`, {
      Authorization: `Bearer ${this.credential}`,
      Accept: "application/json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.tags) ? (raw.tags as Array<Record<string, unknown>>).map((t) => String(t.name ?? t)) : [];
    const lower = labels.map((l) => l.toLowerCase());
    const typeName = String((raw.type as Record<string, unknown>)?.name ?? "").toLowerCase();
    const stateName = String((raw.state as Record<string, unknown>)?.name ?? "").toLowerCase();
    return {
      id: String(raw.id ?? id),
      url: String(raw.url ?? `${this.baseUrl}/issue/${raw.id ?? id}`),
      title: String(raw.summary ?? ""),
      body: truncate(String(raw.description ?? "")),
      type: typeName.includes("bug") ? "bug" : typeName.includes("feature") || typeName.includes("story") ? "story" : "other",
      status: stateName.includes("done") || stateName.includes("fixed") || stateName.includes("closed") ? "done" : stateName.includes("progress") ? "in_progress" : "open",
      labels,
    };
  }
}

/** Asana: REST API. Credential: PAT. baseUrl is unused (uses global API). */
class AsanaProvider implements TicketProvider {
  readonly name = "asana";
  constructor(private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const raw = await fetchJson(`https://app.asana.com/api/1.0/tasks/${encodeURIComponent(id)}`, {
      Authorization: `Bearer ${this.credential}`,
      Accept: "application/json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.tags) ? (raw.tags as Array<Record<string, unknown>>).map((t) => String(t.name ?? t)) : [];
    const lower = labels.map((l) => l.toLowerCase());
    const completed = Boolean(raw.completed);
    return {
      id: String(raw.gid ?? id),
      url: String(raw.permalink_url ?? ""),
      title: String(raw.name ?? ""),
      body: truncate(String(raw.notes ?? "")),
      type: lower.some((l) => l.includes("bug")) ? "bug" : "other",
      status: completed ? "done" : "open",
      labels,
    };
  }
}

/** Trello: REST API. Credential: API key + token (format: "apiKey:token"). baseUrl is the board URL. */
class TrelloProvider implements TicketProvider {
  readonly name = "trello";
  constructor(private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const [apiKey, token] = this.credential.includes(":") ? this.credential.split(":", 2) : [this.credential, this.credential];
    const raw = await fetchJson(`https://api.trello.com/1/cards/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`, {
      Accept: "application/json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.labels) ? (raw.labels as Array<Record<string, unknown>>).map((l) => String(l.name ?? l)) : [];
    const lower = labels.map((l) => l.toLowerCase());
    const closed = Boolean(raw.closed);
    return {
      id: String(raw.id ?? id),
      url: String(raw.url ?? ""),
      title: String(raw.name ?? ""),
      body: truncate(String(raw.desc ?? "")),
      type: lower.some((l) => l.includes("bug")) ? "bug" : "other",
      status: closed ? "done" : "open",
      labels,
    };
  }
}

/** Notion: uses database query API. Credential: integration token. baseUrl is the database URL. */
class NotionProvider implements TicketProvider {
  readonly name = "notion";
  constructor(private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${this.credential}`,
          "Notion-Version": "2022-06-28",
          Accept: "application/json",
        },
        signal: ctl.signal,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} from api.notion.com`);
      const raw = (await res.json()) as Record<string, unknown>;
      const props = (raw.properties ?? {}) as Record<string, Record<string, unknown>>;
      const titleProp = Object.values(props).find((p) => p.type === "title");
      const titleArr = (titleProp?.title ?? []) as Array<{ plain_text: string }>;
      const title = titleArr.map((t) => t.plain_text).join("");
      const status = String((props["Status"]?.status as Record<string, unknown>)?.name ?? (props["status"]?.status as Record<string, unknown>)?.name ?? "").toLowerCase();
      return {
        id: String(raw.id ?? id),
        url: String(raw.url ?? ""),
        title,
        body: "",
        type: "other",
        status: status.includes("done") || status.includes("complete") || status.includes("closed") ? "done" : status.includes("progress") ? "in_progress" : "open",
        labels: [],
      };
    } finally {
      clearTimeout(t);
    }
  }
}

/** Pivotal Tracker: REST API v5. Credential: API token. baseUrl is the project URL. */
class PivotalProvider implements TicketProvider {
  readonly name = "pivotal";
  constructor(private baseUrl: string, private credential: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const m = this.baseUrl.match(/pivotaltracker\.com\/n\/projects\/(\d+)/);
    const projectId = m ? m[1] : "";
    if (!projectId) throw new Error(`tickets.baseUrl must look like https://www.pivotaltracker.com/n/projects/{id} (got ${this.baseUrl})`);
    const raw = await fetchJson(`https://www.pivotaltracker.com/services/v5/projects/${projectId}/stories/${encodeURIComponent(id)}`, {
      "X-TrackerToken": this.credential,
      Accept: "application/json",
    });
    if (!raw) return null;
    const labels = Array.isArray(raw.labels) ? (raw.labels as Array<Record<string, unknown>>).map((l) => String(l.name ?? l)) : [];
    const lower = labels.map((l) => l.toLowerCase());
    const state = String(raw.current_state ?? "").toLowerCase();
    const storyType = String(raw.story_type ?? "").toLowerCase();
    return {
      id: String(raw.id ?? id),
      url: String(raw.url ?? ""),
      title: String(raw.name ?? ""),
      body: truncate(String(raw.description ?? "")),
      type: storyType === "bug" ? "bug" : storyType === "feature" ? "story" : storyType === "epic" ? "epic" : "other",
      status: state === "accepted" || state === "delivered" ? "done" : state === "started" ? "in_progress" : "open",
      labels,
    };
  }
}

/** T3: asks the team sync server — credentials live server-side, members reuse their sync token. */
class RemoteProvider implements TicketProvider {
  readonly name = "remote";
  constructor(private server: string, private brain: string, private token: string) {}

  async getTicket(id: string): Promise<Ticket | null> {
    const raw = await fetchJson(
      `${this.server}/v1/ticket?brain=${encodeURIComponent(this.brain)}&id=${encodeURIComponent(id)}`,
      { Authorization: `Bearer ${this.token}`, Accept: "application/json" }
    );
    return raw ? (raw as unknown as Ticket) : null;
  }
}

/**
 * Build a direct (non-remote) provider from raw parts — used locally AND by
 * the sync server's /v1/ticket proxy (T3), so adapter logic lives in one place.
 */
export function buildDirectProvider(
  provider: string,
  baseUrl: string,
  credential: string | null
): TicketProvider | null {
  switch (provider) {
    case "jira":
      return credential ? new JiraProvider(baseUrl.replace(/\/$/, ""), credential) : null;
    case "github":
      return credential ? new GitHubProvider(baseUrl, credential) : null;
    case "linear":
      return credential ? new LinearProvider(credential) : null;
    case "http":
      if (!isAllowedTicketBaseUrl(baseUrl)) return null;
      return new HttpProvider(baseUrl, credential); // credential optional for internal services
    case "gitlab":
      return credential ? new GitLabProvider(baseUrl, credential) : null;
    case "azuredevops":
      return credential ? new AzureDevOpsProvider(baseUrl, credential) : null;
    case "clickup":
      return credential ? new ClickUpProvider(credential) : null;
    case "shortcut":
      return credential ? new ShortcutProvider(credential) : null;
    case "youtrack":
      return credential ? new YouTrackProvider(baseUrl, credential) : null;
    case "asana":
      return credential ? new AsanaProvider(credential) : null;
    case "trello":
      return credential ? new TrelloProvider(credential) : null;
    case "notion":
      return credential ? new NotionProvider(credential) : null;
    case "pivotal":
      return credential ? new PivotalProvider(baseUrl, credential) : null;
    default:
      return null;
  }
}

/** Build the configured provider, or null when tickets aren't set up / no credential. */
export function ticketProviderFor(repoRoot: string): TicketProvider | null {
  const cfg = readTicketsConfig(repoRoot);
  if (!cfg.provider) return null;
  if (cfg.provider === "remote") {
    // lazy import avoids a cycle: sync/client imports nothing from tickets
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    try {
      const p = path.join(repoRoot, ".aidimag", "config.json");
      const raw = JSON.parse(readFileSync(p, "utf8")) as { server?: string; brain?: string; token?: string };
      if (!raw.server || !raw.brain) return null;
      const token = process.env.AIDIMAG_API_KEY ?? raw.token ?? null;
      return token ? new RemoteProvider(raw.server, raw.brain, token) : null;
    } catch {
      return null;
    }
  }
  if (!cfg.baseUrl && !["linear", "clickup", "shortcut", "asana", "trello", "notion", "remote"].includes(cfg.provider)) return null;
  const credKey = cfg.baseUrl ?? cfg.provider ?? "linear";
  return buildDirectProvider(cfg.provider, cfg.baseUrl ?? "", getTicketCredential(credKey));
}

// ---------------------------------------------------------------- branch convention (T1.5)

export interface BranchCheckResult {
  branch: string;
  ok: boolean;
  exempt: boolean;
  enforce: "push" | "warn" | "off";
  pattern: string | null;
}

export function checkBranchName(repoRoot: string, branch: string): BranchCheckResult {
  const rules = readTicketsConfig(repoRoot).branch ?? {};
  const enforce = rules.enforce ?? "off";
  const pattern = rules.pattern ?? null;
  if (!pattern || enforce === "off") return { branch, ok: true, exempt: false, enforce, pattern };
  const exemptList = rules.exempt ?? ["main", "master", "develop", "release/.*", "HEAD"];
  const isExempt = exemptList.some((e) => {
    try {
      return new RegExp(`^(${e})$`).test(branch);
    } catch {
      return e === branch;
    }
  });
  if (isExempt) return { branch, ok: true, exempt: true, enforce, pattern };
  let ok = false;
  try {
    ok = new RegExp(pattern).test(branch);
  } catch {
    ok = true; // bad admin regex must not lock everyone out
  }
  return { branch, ok, exempt: false, enforce, pattern };
}

/** Build a conforming branch name: feature/XXX-2100-serialize-token-refresh */
export function buildBranchName(ticketId: string, title?: string, prefix = "feature"): string {
  const slug = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");
  return slug ? `${prefix}/${ticketId}-${slug}` : `${prefix}/${ticketId}`;
}

