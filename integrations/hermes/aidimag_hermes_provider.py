# aidimag — Hermes Agent memory provider (single-file, stdlib-only).
#
# Design (deliberately NOT a pip package):
#   - This one file is the whole plugin. `dim hermes install` copies it to
#     $HERMES_HOME/plugins/aidimag/__init__.py. No pip, no venv, no compiled
#     deps — it runs on any Python >= 3.8, including whatever interpreter the
#     Hermes gateway happens to use. Upgrading aidimag upgrades the engine
#     (Node side); re-running `dim hermes install` refreshes this bridge.
#   - All memory logic lives in the aidimag MCP server (Node). This file is a
#     supervised JSON-RPC stdio client: lazy spawn, bounded restarts, request
#     timeouts, and graceful degradation — a failure here returns empty
#     context or an error string, never crashes the agent.
#   - Philosophy preserved: Hermes turns are NEVER auto-written into memory.
#     User messages buffer per session; at session end (or pre-compression)
#     they are harvested into *proposals* that a human approves via
#     `dim review`. Live recall is read-only.
#
# Config: $HERMES_HOME/plugins/aidimag/config.json (written by the installer)
#   { "command": "/abs/path/to/node", "args": ["/abs/path/to/dist/mcp/server.js"],
#     "repo": "/abs/path/to/repo-or-null" }

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:  # inside Hermes
    from agent.memory_provider import MemoryProvider
except Exception:  # standalone import (tests, py_compile, tooling)
    from abc import ABC

    class MemoryProvider(ABC):  # type: ignore[no-redef]
        pass


_PLUGIN_DIR = Path(__file__).resolve().parent
_REQUEST_TIMEOUT = 15.0
_PREFETCH_TIMEOUT = 2.5
_BRIEFING_TTL = 300.0
_MAX_RESTARTS = 3
_RESTART_WINDOW = 300.0
_MAX_BUFFERED_TURNS = 200
_MAX_MSG_CHARS = 2000


def _load_config() -> Dict[str, Any]:
    try:
        with open(_PLUGIN_DIR / "config.json", "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        return {}


def _find_repo(start: Optional[str] = None) -> Optional[str]:
    """Walk up from `start` (or cwd) looking for a .aidimag directory."""
    try:
        d = Path(start or os.getcwd()).resolve()
    except Exception:
        return None
    for p in [d, *d.parents]:
        if (p / ".aidimag").is_dir():
            return str(p)
    return None


class _McpClient:
    """Supervised MCP (JSON-RPC over stdio) client for the aidimag server.

    Newline-delimited JSON, per the MCP stdio transport. One long-lived
    subprocess; crash detection with bounded restarts; every public method is
    exception-safe for callers (raises only _McpError with a readable message).
    """

    def __init__(self, command: str, args: List[str], repo: Optional[str]):
        self._command = command
        self._args = args
        self._repo = repo
        self._proc: Optional[subprocess.Popen] = None
        self._lock = threading.Lock()  # spawn/write serialization
        self._pending: Dict[int, Any] = {}
        self._cond = threading.Condition()
        self._next_id = 0
        self._restarts: List[float] = []

    # -- lifecycle ----------------------------------------------------------

    def _alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def _may_restart(self) -> bool:
        now = time.time()
        self._restarts = [t for t in self._restarts if now - t < _RESTART_WINDOW]
        return len(self._restarts) < _MAX_RESTARTS

    def _spawn(self) -> None:
        if not self._may_restart():
            raise _McpError(
                "aidimag MCP server crashed repeatedly; backing off. "
                "Check `dim status` in the repo and Hermes logs."
            )
        self._restarts.append(time.time())
        env = dict(os.environ)
        if self._repo:
            env["AIDIMAG_REPO"] = self._repo
        self._proc = subprocess.Popen(
            [self._command, *self._args],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            cwd=self._repo or None,
            env=env,
            text=True,
            bufsize=1,  # line-buffered
        )
        t = threading.Thread(target=self._reader, args=(self._proc,), daemon=True)
        t.start()
        # MCP handshake
        self._request(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "aidimag-hermes", "version": "1"},
            },
            timeout=_REQUEST_TIMEOUT,
            _no_ensure=True,
        )
        self._notify("notifications/initialized")

    def _ensure(self) -> None:
        with self._lock:
            if not self._alive():
                self._spawn()

    def _reader(self, proc: subprocess.Popen) -> None:
        try:
            assert proc.stdout is not None
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except Exception:
                    continue
                if "id" in msg and ("result" in msg or "error" in msg):
                    with self._cond:
                        self._pending[msg["id"]] = msg
                        self._cond.notify_all()
        except Exception:
            pass
        finally:
            # wake all waiters so they fail fast instead of timing out
            with self._cond:
                self._cond.notify_all()

    # -- protocol -----------------------------------------------------------

    def _write(self, obj: Dict[str, Any]) -> None:
        proc = self._proc
        if proc is None or proc.stdin is None:
            raise _McpError("aidimag MCP server is not running")
        try:
            proc.stdin.write(json.dumps(obj) + "\n")
            proc.stdin.flush()
        except Exception as e:
            raise _McpError(f"write to aidimag MCP server failed: {e}")

    def _notify(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        msg: Dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params:
            msg["params"] = params
        self._write(msg)

    def _request(
        self,
        method: str,
        params: Dict[str, Any],
        timeout: float = _REQUEST_TIMEOUT,
        _no_ensure: bool = False,
    ) -> Dict[str, Any]:
        if not _no_ensure:
            self._ensure()
        with self._cond:
            self._next_id += 1
            req_id = self._next_id
        self._write({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params})
        deadline = time.time() + timeout
        with self._cond:
            while req_id not in self._pending:
                remaining = deadline - time.time()
                if remaining <= 0 or not self._alive():
                    self._pending.pop(req_id, None)
                    raise _McpError(f"aidimag MCP request '{method}' timed out or server exited")
                self._cond.wait(min(remaining, 0.25))
            msg = self._pending.pop(req_id)
        if "error" in msg:
            err = msg["error"] or {}
            raise _McpError(str(err.get("message") or err))
        return msg.get("result") or {}

    # -- public surface -----------------------------------------------------

    def call_tool(self, name: str, arguments: Dict[str, Any], timeout: float = _REQUEST_TIMEOUT) -> str:
        result = self._request("tools/call", {"name": name, "arguments": arguments}, timeout)
        parts = [c.get("text", "") for c in result.get("content", []) if c.get("type") == "text"]
        return "\n".join(p for p in parts if p)

    def read_resource(self, uri: str, timeout: float = _REQUEST_TIMEOUT) -> str:
        result = self._request("resources/read", {"uri": uri}, timeout)
        return "\n".join(c.get("text", "") for c in result.get("contents", []) if c.get("text"))

    def shutdown(self) -> None:
        proc = self._proc
        self._proc = None
        if proc is not None and proc.poll() is None:
            try:
                if proc.stdin:
                    proc.stdin.close()
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass


class _McpError(RuntimeError):
    pass


class AidimagMemoryProvider(MemoryProvider):
    """Verified, repo-scoped memory for Hermes sessions.

    Recall is live (MCP), writes are human-gated (proposals -> `dim review`).
    """

    def __init__(self) -> None:
        self._config = _load_config()
        self._repo: Optional[str] = None
        self._client: Optional[_McpClient] = None
        self._read_only = False
        self._session_msgs: Dict[str, List[str]] = {}
        self._session_id = ""
        self._prefetch_cache: Dict[str, str] = {}
        self._briefing: str = ""
        self._briefing_at = 0.0

    # -- identity / availability --------------------------------------------

    @property
    def name(self) -> str:
        return "aidimag"

    def is_available(self) -> bool:
        # No network, no spawn: config + binary existence only.
        command = self._config.get("command")
        if command and Path(command).exists():
            return True
        # fallback path: npx must exist on PATH
        from shutil import which

        return which("npx") is not None

    # -- lifecycle ------------------------------------------------------------

    def initialize(self, session_id: str, **kwargs: Any) -> None:
        self._session_id = session_id or "default"
        # cron/subagent contexts must not shape the review queue
        self._read_only = kwargs.get("agent_context", "primary") not in ("primary", "")
        self._repo = (
            self._config.get("repo")
            or os.environ.get("AIDIMAG_REPO")
            or _find_repo()
        )
        command = self._config.get("command")
        args = self._config.get("args") or []
        if not (command and Path(command).exists()):
            command, args = "npx", ["-y", "aidimag", "mcp"]
        self._client = _McpClient(command, list(args), self._repo)
        # Warm the briefing in the background so system_prompt_block() is instant.
        threading.Thread(target=self._refresh_briefing, daemon=True).start()

    def shutdown(self) -> None:
        if self._client:
            self._client.shutdown()
            self._client = None

    # -- context injection ----------------------------------------------------

    def _refresh_briefing(self) -> None:
        if not self._client or not self._repo:
            return
        try:
            text = self._client.read_resource("aidimag://session-briefing")
            self._briefing = text.strip()
            self._briefing_at = time.time()
        except Exception:
            pass  # keep previous briefing (or empty)

    def system_prompt_block(self) -> str:
        if not self._repo:
            return (
                "[aidimag] No initialized repo detected (no .aidimag/ found). "
                "Run `dim init` in the project, or set the provider's repo config."
            )
        if time.time() - self._briefing_at > _BRIEFING_TTL:
            threading.Thread(target=self._refresh_briefing, daemon=True).start()
        if not self._briefing:
            return ""
        return (
            "## Verified repo memory (aidimag)\n"
            "The following comes from this repository's verified memory. VERIFIED "
            "claims are machine-checked against the current code; treat STALE ones "
            "as warnings. Guardrails are binding.\n\n" + self._briefing
        )

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        cached = self._prefetch_cache.pop(session_id or self._session_id, None)
        if cached is not None:
            return cached
        return self._recall(query, timeout=_PREFETCH_TIMEOUT)

    def queue_prefetch(self, query: str, *, session_id: str = "") -> None:
        sid = session_id or self._session_id

        def work() -> None:
            self._prefetch_cache[sid] = self._recall(query, timeout=_REQUEST_TIMEOUT)

        threading.Thread(target=work, daemon=True).start()

    def _recall(self, query: str, timeout: float) -> str:
        if not self._client or not self._repo or not query or len(query.strip()) < 4:
            return ""
        try:
            text = self._client.call_tool(
                "memory_search", {"query": query.strip()[:400], "limit": 5}, timeout=timeout
            )
            # A miss must inject NOTHING — "No matching memories" boilerplate
            # (and its coverage-gap note) is agent guidance, not turn context.
            if not text or "no matching memories" in text.lower() or text.startswith("(no memories"):
                return ""
            return "[aidimag recall — verified repo memory]\n" + text
        except Exception:
            return ""  # degraded, never blocking

    # -- human-gated capture ----------------------------------------------------

    def sync_turn(
        self,
        user_content: str,
        assistant_content: str,
        *,
        session_id: str = "",
        messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """Buffer only — nothing is written to memory mid-session."""
        if self._read_only or not user_content:
            return
        sid = session_id or self._session_id
        buf = self._session_msgs.setdefault(sid, [])
        if len(buf) < _MAX_BUFFERED_TURNS:
            buf.append(user_content.strip()[:_MAX_MSG_CHARS])

    def _harvest(self, sid: str, reason: str) -> str:
        """Send buffered user messages to chat_harvest -> review-queue proposals."""
        msgs = [m for m in self._session_msgs.pop(sid, []) if len(m) >= 20]
        if self._read_only or not msgs or not self._client or not self._repo:
            return ""
        try:
            return self._client.call_tool(
                "chat_harvest",
                {"user_messages": msgs, "agent_id": "hermes", "session_id": f"{sid}:{reason}"},
                timeout=60.0,
            )
        except Exception:
            return ""

    def on_session_end(self, messages: List[Dict[str, Any]]) -> None:
        self._harvest(self._session_id, "session-end")

    def on_pre_compress(self, messages: List[Dict[str, Any]]) -> str:
        # Extract before Hermes discards context; proposals survive compression.
        result = self._harvest(self._session_id, "pre-compress")
        if result:
            return (
                "Durable facts from the discarded messages were queued for human "
                "review in the repo's aidimag memory (`dim review`)."
            )
        return ""

    def on_session_switch(
        self,
        new_session_id: str,
        *,
        parent_session_id: str = "",
        reset: bool = False,
        rewound: bool = False,
        **kwargs: Any,
    ) -> None:
        old = self._session_id
        if reset:
            # genuinely new conversation: harvest the old one, drop buffers
            self._harvest(old, "reset")
        elif old in self._session_msgs:
            # logical continuation: carry the buffer to the new id
            self._session_msgs[new_session_id] = self._session_msgs.pop(old)
        if rewound:
            self._session_msgs.pop(new_session_id, None)
        self._prefetch_cache.pop(old, None)
        self._session_id = new_session_id

    def on_delegation(self, task: str, result: str, *, child_session_id: str = "", **kwargs: Any) -> None:
        # Record delegated work as a short-term scratchpad note (TTL-expiring,
        # never durable memory) so the parent session can recall what came back.
        if self._read_only or not self._client or not self._repo:
            return
        note = f"[delegated] task: {task.strip()[:400]} -> result: {result.strip()[:800]}"

        def work() -> None:
            try:
                self._client.call_tool(
                    "scratchpad_write",
                    {"content": note, "session_id": self._session_id, "created_by": "hermes"},
                    timeout=10.0,
                )
            except Exception:
                pass

        threading.Thread(target=work, daemon=True).start()

    # -- tools -------------------------------------------------------------------

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        kinds = [
            "DECISION", "CONVENTION", "GOTCHA", "FAILED_APPROACH",
            "ARCHITECTURE", "INVARIANT", "TODO_CONTEXT", "GUARDRAIL", "SKILL",
        ]
        return [
            {
                "name": "aidimag_recall",
                "description": (
                    "Search this repository's VERIFIED memory (decisions, conventions, "
                    "gotchas, invariants, guardrails). Use BEFORE exploring the code — "
                    "past sessions may already know the answer, with evidence."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Keywords, e.g. 'auth token refresh'"},
                        "paths": {"type": "array", "items": {"type": "string"}, "description": "Restrict to these repo paths"},
                        "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "aidimag_files_context",
                "description": "Get conventions, gotchas, and invariants scoped to specific files before reading or editing them.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "paths": {"type": "array", "items": {"type": "string"}, "description": "Repo-relative file paths"},
                    },
                    "required": ["paths"],
                },
            },
            {
                "name": "aidimag_note",
                "description": (
                    "Capture a durable fact the USER just stated about the codebase "
                    "('we use X because Y', 'never do X', 'we tried X, it failed'). "
                    "Queued for human review — call immediately, don't wait for session end."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "statement": {"type": "string", "description": "The fact as a falsifiable claim about the codebase"},
                        "kind": {"type": "string", "enum": kinds},
                        "quote": {"type": "string", "description": "User's own words, verbatim"},
                        "paths": {"type": "array", "items": {"type": "string"}},
                        "guardrail_level": {"type": "string", "enum": ["never", "always", "ask-first"]},
                    },
                    "required": ["statement", "kind"],
                },
            },
            {
                "name": "aidimag_propose",
                "description": (
                    "Propose an INFERRED learning about the codebase for the human review "
                    "queue (`dim review`). Use for knowledge you derived (not user-stated)."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "claim": {"type": "string", "description": "Falsifiable statement about the codebase"},
                        "kind": {"type": "string", "enum": kinds},
                        "paths": {"type": "array", "items": {"type": "string"}},
                        "rationale": {"type": "string", "description": "Why this is worth remembering"},
                        "guardrail_level": {"type": "string", "enum": ["never", "always", "ask-first"]},
                    },
                    "required": ["claim", "kind"],
                },
            },
            {
                "name": "aidimag_status",
                "description": "Summary of the repo's memory store: counts by verification status and kind, pending review items.",
                "parameters": {"type": "object", "properties": {}},
            },
        ]

    def handle_tool_call(self, tool_name: str, args: Dict[str, Any], **kwargs: Any) -> str:
        if not self._client:
            return json.dumps({"error": "aidimag provider not initialized"})
        if not self._repo:
            return json.dumps({"error": "no aidimag repo found — run `dim init` in the project"})
        try:
            if tool_name == "aidimag_recall":
                text = self._client.call_tool(
                    "memory_search",
                    {k: v for k, v in {
                        "query": args.get("query", ""),
                        "paths": args.get("paths"),
                        "limit": args.get("limit"),
                    }.items() if v is not None},
                )
            elif tool_name == "aidimag_files_context":
                text = self._client.call_tool("memory_get_for_files", {"paths": args.get("paths", [])})
            elif tool_name == "aidimag_note":
                if self._read_only:
                    return json.dumps({"error": "read-only context (cron/subagent) — note not captured"})
                text = self._client.call_tool(
                    "context_note",
                    {k: v for k, v in {
                        "statement": args.get("statement", ""),
                        "kind": args.get("kind", "DECISION"),
                        "quote": args.get("quote"),
                        "paths": args.get("paths"),
                        "guardrail_level": args.get("guardrail_level"),
                        "agent_id": "hermes",
                    }.items() if v is not None},
                )
            elif tool_name == "aidimag_propose":
                if self._read_only:
                    return json.dumps({"error": "read-only context (cron/subagent) — proposal not queued"})
                text = self._client.call_tool(
                    "memory_propose",
                    {k: v for k, v in {
                        "claim": args.get("claim", ""),
                        "kind": args.get("kind", "DECISION"),
                        "paths": args.get("paths"),
                        "rationale": args.get("rationale"),
                        "guardrail_level": args.get("guardrail_level"),
                        "agent_id": "hermes",
                    }.items() if v is not None},
                )
            elif tool_name == "aidimag_status":
                text = self._client.call_tool("memory_status", {})
            else:
                return json.dumps({"error": f"unknown tool {tool_name}"})
            return json.dumps({"result": text})
        except Exception as e:
            return json.dumps({"error": f"aidimag call failed: {e}"})

    # -- setup / ops ---------------------------------------------------------------

    def get_config_schema(self) -> List[Dict[str, Any]]:
        return [
            {
                "key": "repo",
                "description": "Absolute path of the repo whose .aidimag/ brain to use (empty = auto-detect from cwd)",
                "required": False,
            },
            {
                "key": "command",
                "description": "Command used to launch the aidimag MCP server (empty = installer-pinned node, then npx fallback)",
                "required": False,
            },
        ]

    def save_config(self, values: Dict[str, Any], hermes_home: str) -> None:
        cfg = _load_config()
        for key in ("repo", "command"):
            if key in values and values[key]:
                cfg[key] = values[key]
        try:
            with open(_PLUGIN_DIR / "config.json", "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
        except Exception:
            pass

    def backup_paths(self) -> List[str]:
        # The brain itself lives INSIDE each repo (.aidimag/) — versioned with the
        # code, deliberately not part of a Hermes backup. Only the stable
        # machine identity lives outside HERMES_HOME.
        p = Path.home() / ".aidimag"
        return [str(p)] if p.exists() else []


def register(ctx: Any) -> None:
    """Hermes plugin entry point."""
    ctx.register_memory_provider(AidimagMemoryProvider())

