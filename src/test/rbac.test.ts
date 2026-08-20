import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { startSyncServer, type SyncServerHandle } from "../sync/server.js";

const ADMIN_TOKEN = "test-admin-token-12345";

async function startTestServer(): Promise<{ handle: SyncServerHandle; cleanup: () => Promise<void> }> {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-rbac-"));
  const dbPath = path.join(dir, "test-sync.db");
  const handle = await startSyncServer({
    dbPath,
    token: ADMIN_TOKEN,
    port: 0,
    host: "127.0.0.1",
  });
  const cleanup = async () => {
    await handle.close();
    rmSync(dir, { recursive: true, force: true });
  };
  return { handle, cleanup };
}

async function api(url: string, method: string, pathq: string, body?: unknown, token?: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${url}${pathq}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

test("RBAC: admin can create and list users", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const createRes = await api(handle.url, "POST", "/v1/users", {
      username: "alice",
      role: "member",
    }, ADMIN_TOKEN);
    assert.equal(createRes.status, 201);
    assert.equal((createRes.data as { username: string }).username, "alice");
    assert.equal((createRes.data as { role: string }).role, "member");

    const listRes = await api(handle.url, "GET", "/v1/users", undefined, ADMIN_TOKEN);
    assert.equal(listRes.status, 200);
    const users = (listRes.data as { users: Array<{ username: string }> }).users;
    assert.equal(users.length, 1);
    assert.equal(users[0].username, "alice");
  } finally {
    await cleanup();
  }
});

test("RBAC: non-admin cannot access user management", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const res = await api(handle.url, "GET", "/v1/users", undefined, "wrong-token");
    assert.equal(res.status, 403);
  } finally {
    await cleanup();
  }
});

test("RBAC: admin can revoke a user", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const createRes = await api(handle.url, "POST", "/v1/users", {
      username: "bob",
      role: "viewer",
    }, ADMIN_TOKEN);
    const userId = (createRes.data as { id: string }).id;

    const revokeRes = await api(handle.url, "DELETE", `/v1/users?id=${encodeURIComponent(userId)}`, undefined, ADMIN_TOKEN);
    assert.equal(revokeRes.status, 200);

    const listRes = await api(handle.url, "GET", "/v1/users", undefined, ADMIN_TOKEN);
    const users = (listRes.data as { users: Array<{ revokedAt: string | null }> }).users;
    assert.notEqual(users[0].revokedAt, null);
  } finally {
    await cleanup();
  }
});

test("RBAC: admin can set per-brain role overrides", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const createRes = await api(handle.url, "POST", "/v1/users", {
      username: "carol",
      role: "member",
    }, ADMIN_TOKEN);
    const userId = (createRes.data as { id: string }).id;

    const roleRes = await api(handle.url, "POST", "/v1/user-brain-roles", {
      userId,
      brain: "myrepo",
      role: "viewer",
    }, ADMIN_TOKEN);
    assert.equal(roleRes.status, 200);

    const listRes = await api(handle.url, "GET", "/v1/user-brain-roles", undefined, ADMIN_TOKEN);
    assert.equal(listRes.status, 200);
    const roles = (listRes.data as { roles: Array<{ username: string; brain: string; brain_role: string }> }).roles;
    assert.equal(roles.length, 1);
    assert.equal(roles[0].username, "carol");
    assert.equal(roles[0].brain, "myrepo");
    assert.equal(roles[0].brain_role, "viewer");
  } finally {
    await cleanup();
  }
});

test("RBAC: default role is member when not specified", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const createRes = await api(handle.url, "POST", "/v1/users", {
      username: "dave",
    }, ADMIN_TOKEN);
    assert.equal(createRes.status, 201);
    assert.equal((createRes.data as { role: string }).role, "member");
  } finally {
    await cleanup();
  }
});

test("RBAC: invalid role falls back to member", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const createRes = await api(handle.url, "POST", "/v1/users", {
      username: "eve",
      role: "superuser",
    }, ADMIN_TOKEN);
    assert.equal(createRes.status, 201);
    assert.equal((createRes.data as { role: string }).role, "member");
  } finally {
    await cleanup();
  }
});

test("OIDC: returns 503 when not configured", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const res = await api(handle.url, "GET", "/v1/auth/oidc/login");
    assert.equal(res.status, 503);
  } finally {
    await cleanup();
  }
});

test("OIDC: admin can configure and retrieve provider config", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const setRes = await api(handle.url, "PUT", "/v1/oidc/config", {
      issuer: "https://accounts.google.com",
      clientId: "test-client-id",
      clientSecret: "test-secret",
      redirectUri: "http://localhost:8787/v1/auth/oidc/callback",
    }, ADMIN_TOKEN);
    assert.equal(setRes.status, 200);
    assert.equal((setRes.data as { ok: boolean }).ok, true);

    const getRes = await api(handle.url, "GET", "/v1/oidc/config", undefined, ADMIN_TOKEN);
    assert.equal(getRes.status, 200);
    assert.equal((getRes.data as { issuer: string }).issuer, "https://accounts.google.com");
    assert.equal((getRes.data as { clientId: string }).clientId, "test-client-id");
  } finally {
    await cleanup();
  }
});

test("OIDC: non-admin cannot configure provider", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    const res = await api(handle.url, "PUT", "/v1/oidc/config", {
      issuer: "https://evil.com",
      clientId: "evil",
      redirectUri: "http://evil.com/callback",
    }, "wrong-token");
    assert.equal(res.status, 403);
  } finally {
    await cleanup();
  }
});

test("OIDC: admin can remove provider config", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    await api(handle.url, "PUT", "/v1/oidc/config", {
      issuer: "https://accounts.google.com",
      clientId: "test-client-id",
      redirectUri: "http://localhost:8787/v1/auth/oidc/callback",
    }, ADMIN_TOKEN);

    const delRes = await api(handle.url, "DELETE", "/v1/oidc/config", undefined, ADMIN_TOKEN);
    assert.equal(delRes.status, 200);

    const getRes = await api(handle.url, "GET", "/v1/oidc/config", undefined, ADMIN_TOKEN);
    assert.equal(getRes.status, 404);
  } finally {
    await cleanup();
  }
});

test("OIDC: login redirects to IdP when configured", async () => {
  const { handle, cleanup } = await startTestServer();
  try {
    await api(handle.url, "PUT", "/v1/oidc/config", {
      issuer: "https://accounts.google.com",
      clientId: "test-client-id",
      redirectUri: "http://localhost:8787/v1/auth/oidc/callback",
    }, ADMIN_TOKEN);

    const res = await fetch(`${handle.url}/v1/auth/oidc/login`, { redirect: "manual" });
    assert.equal(res.status, 302);
    const data = await res.json() as { redirect: string };
    assert.match(data.redirect, /accounts\.google\.com\/authorize/);
    assert.match(data.redirect, /client_id=test-client-id/);
    assert.match(data.redirect, /response_type=code/);
  } finally {
    await cleanup();
  }
});
