# Cloud Server API Requirements for Quota Management

This document specifies the cloud.aidimag.com server-side changes needed to support tiered pricing with memory limits.

## Overview

The aidimag client now supports per-item sync tracking and quota management. The cloud server must implement:
1. User plan/subscription management
2. Memory quota enforcement
3. Plan detection API
4. Atomic sync operations with tombstones
5. Upgrade detection

---

## 1. Database Schema Changes

### New Tables

```sql
-- User subscriptions and plans
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_tier     TEXT NOT NULL CHECK (plan_tier IN ('free', 'starter', 'developer', 'team')),
  status        TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  memory_limit  INTEGER,  -- NULL = unlimited
  api_key_limit INTEGER NOT NULL,
  sync_rate_limit TEXT,  -- e.g., '1/minute' or NULL for unlimited
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  canceled_at   TIMESTAMP,
  UNIQUE(user_id)  -- One active subscription per user
);

-- Plan definitions (can be seeded)
CREATE TABLE plans (
  tier          TEXT PRIMARY KEY CHECK (tier IN ('free', 'starter', 'developer', 'team')),
  name          TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,  -- $0 for free, $500 for $5/mo
  memory_limit  INTEGER,  -- 100 for free, NULL for unlimited
  api_key_limit INTEGER NOT NULL,
  sync_rate_limit TEXT,
  features      JSONB NOT NULL DEFAULT '{}'
);

-- Seed default plans
INSERT INTO plans (tier, name, price_cents, memory_limit, api_key_limit, sync_rate_limit) VALUES
  ('free', 'Free', 0, 100, 1, '1/minute'),
  ('starter', 'Starter', 500, NULL, 1, NULL),
  ('developer', 'Developer', 1500, NULL, 3, NULL),
  ('team', 'Team', 5000, NULL, 10, NULL);
```

### Modify Existing Tables

```sql
-- Link brains to users for quota enforcement
ALTER TABLE brains ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_brains_user_id ON brains(user_id);

-- Add index for memory counting
CREATE INDEX idx_sync_latest_brain_memories ON sync_latest(brain, tbl) WHERE tbl = 'memories' AND deleted = 0;
```

---

## 2. New API Endpoints

### GET /v1/account/plan

Get the authenticated user's current plan.

**Request:**
```http
GET /v1/account/plan
Authorization: Bearer <api_key>
```

**Response (200 OK):**
```json
{
  "tier": "free",
  "memoryLimit": 100,
  "apiKeyLimit": 1,
  "syncRateLimit": "1/minute",
  "currentMemories": 85,
  "currentApiKeys": 1
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid or expired API key"
}
```

**Implementation:**
```typescript
async function handleGetPlan(req: Request, apiKey: ApiKey): Promise<Response> {
  const subscription = await db.query(
    `SELECT s.*, 
            (SELECT COUNT(*) FROM sync_latest 
             WHERE brain IN (SELECT id FROM brains WHERE user_id = $1) 
             AND tbl = 'memories' AND deleted = 0) as current_memories,
            (SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL) as current_api_keys
     FROM subscriptions s
     WHERE s.user_id = $1 AND s.status = 'active'`,
    [apiKey.user_id]
  );
  
  if (!subscription) {
    // No subscription = free tier
    return json({
      tier: "free",
      memoryLimit: 100,
      apiKeyLimit: 1,
      syncRateLimit: "1/minute",
      currentMemories: 0,
      currentApiKeys: 1
    });
  }
  
  return json({
    tier: subscription.plan_tier,
    memoryLimit: subscription.memory_limit,
    apiKeyLimit: subscription.api_key_limit,
    syncRateLimit: subscription.sync_rate_limit,
    currentMemories: subscription.current_memories,
    currentApiKeys: subscription.current_api_keys
  });
}
```

---

## 3. Modified Endpoints

### POST /v1/push (Enhanced with Quota Enforcement)

**Current Behavior:**
Accepts all memories without limit checks.

**New Behavior:**
1. Check user's plan and quota
2. Process tombstones first (frees up space)
3. Enforce memory limit for new memories
4. Return partial success with warnings

**Request:**
```json
{
  "items": [
    {
      "tbl": "memories",
      "id": "uuid-1",
      "updatedAt": "2026-07-23T10:00:00Z",
      "deleted": true,
      "payload": null
    },
    {
      "tbl": "memories",
      "id": "uuid-2",
      "updatedAt": "2026-07-23T10:01:00Z",
      "deleted": false,
      "payload": { "claim": "...", "kind": "DECISION", ... }
    }
  ]
}
```

**Response (200 OK - Full Success):**
```json
{
  "accepted": 50,
  "memoriesAccepted": 45,
  "seq": 12345
}
```

**Response (200 OK - Partial Success with Warning):**
```json
{
  "accepted": 20,
  "memoriesAccepted": 20,
  "seq": 12366,
  "warning": "Memory limit reached. Only 20 of 50 memories synced. Upgrade to sync all memories.",
  "quota": {
    "current": 100,
    "limit": 100,
    "tier": "free"
  }
}
```

**Response (429 Too Many Requests - At Limit):**
```json
{
  "error": "Free tier is limited to 100 memories. Upgrade to continue syncing.",
  "quota": {
    "current": 100,
    "limit": 100,
    "tier": "free"
  },
  "upgradeUrl": "https://cloud.aidimag.com/pricing"
}
```

**Implementation:**
```typescript
async function handlePush(req: Request, brain: string, apiKey: ApiKey): Promise<Response> {
  const body = await req.json();
  const items = body.items as SyncItem[];
  
  // Get user's plan
  const plan = await getUserPlan(apiKey.user_id);
  
  // Start transaction
  return await db.transaction(async (tx) => {
    // 1. Process deletions first (frees up space)
    const deletions = items.filter(it => it.deleted);
    for (const del of deletions) {
      await tx.query(
        `DELETE FROM sync_latest WHERE brain = $1 AND tbl = $2 AND id = $3`,
        [brain, del.tbl, del.id]
      );
    }
    
    // 2. Check current memory count after deletions
    const currentCount = await tx.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_latest 
       WHERE brain = $1 AND tbl = 'memories' AND deleted = 0`,
      [brain]
    );
    
    // 3. Separate updates from new additions
    const additions = items.filter(it => !it.deleted);
    const updates: SyncItem[] = [];
    const newItems: SyncItem[] = [];
    
    for (const item of additions) {
      const exists = await tx.queryOne(
        `SELECT 1 FROM sync_latest WHERE brain = $1 AND tbl = $2 AND id = $3`,
        [brain, item.tbl, item.id]
      );
      if (exists) {
        updates.push(item);
      } else {
        newItems.push(item);
      }
    }
    
    // 4. Enforce quota for new memories only
    let acceptedNew = newItems.length;
    let warning: string | undefined;
    
    if (plan.memoryLimit !== null) {
      const newMemories = newItems.filter(it => it.tbl === 'memories');
      const available = plan.memoryLimit - currentCount.count;
      
      if (available <= 0 && newMemories.length > 0) {
        // At limit, reject all new memories
        return json({
          error: `${plan.tier === 'free' ? 'Free tier' : 'Your plan'} is limited to ${plan.memoryLimit} memories. Upgrade to continue syncing.`,
          quota: {
            current: currentCount.count,
            limit: plan.memoryLimit,
            tier: plan.tier
          },
          upgradeUrl: "https://cloud.aidimag.com/pricing"
        }, 429);
      }
      
      if (newMemories.length > available) {
        // Partial acceptance
        acceptedNew = available;
        warning = `Memory limit reached. Only ${available} of ${newMemories.length} memories synced. Upgrade to sync all memories.`;
      }
    }
    
    // 5. Process updates (always accepted, bypass quota)
    let accepted = 0;
    let memoriesAccepted = 0;
    
    for (const item of updates) {
      await upsertSyncItem(tx, brain, item);
      accepted++;
      if (item.tbl === 'memories') memoriesAccepted++;
    }
    
    // 6. Process new items (up to quota)
    const itemsToAccept = newItems.slice(0, acceptedNew);
    for (const item of itemsToAccept) {
      await upsertSyncItem(tx, brain, item);
      accepted++;
      if (item.tbl === 'memories') memoriesAccepted++;
    }
    
    // 7. Get latest seq
    const seq = await tx.queryOne<{ seq: number }>(
      `SELECT COALESCE(MAX(seq), 0) as seq FROM sync_items WHERE brain = $1`,
      [brain]
    );
    
    const response: any = {
      accepted,
      memoriesAccepted,
      seq: seq.seq
    };
    
    if (warning) {
      response.warning = warning;
      response.quota = {
        current: currentCount.count + memoriesAccepted,
        limit: plan.memoryLimit,
        tier: plan.tier
      };
    }
    
    return json(response);
  });
}
```

---

## 4. Upgrade Detection

When a user upgrades their plan, the client should detect it automatically.

**Mechanism:**
1. Client stores last known plan tier in local meta: `last_known_plan`
2. On each sync, client calls `GET /v1/account/plan`
3. If tier changed from `free` to paid, prompt user to sync remaining memories

**Client-side logic:**
```typescript
const lastKnownPlan = store.getMeta("last_known_plan") || "free";
const currentPlan = await getUserPlan(cfg.server, token);

if (lastKnownPlan === "free" && currentPlan.tier !== "free") {
  // User upgraded!
  const unsyncedCount = store.getUnsyncedMemories().length;
  if (unsyncedCount > 0) {
    console.log(`🎉 You upgraded to ${currentPlan.tier}!`);
    console.log(`You have ${unsyncedCount} memories waiting to sync.`);
    // Prompt or auto-sync
  }
}

store.setMeta("last_known_plan", currentPlan.tier);
```

---

## 5. Rate Limiting (Existing, Enhanced)

**Current:**
```typescript
const syncLimiter = makeRateLimiter(120, 60_000); // 120 req/min/IP
```

**Enhanced for Free Tier:**
```typescript
// Per-user rate limiting based on plan
async function checkRateLimit(apiKey: ApiKey): Promise<boolean> {
  const plan = await getUserPlan(apiKey.user_id);
  
  if (plan.syncRateLimit === null) {
    return true; // Unlimited for paid plans
  }
  
  // Parse "1/minute" -> 1 request per 60 seconds
  const [count, period] = plan.syncRateLimit.split('/');
  const windowMs = period === 'minute' ? 60_000 : 3600_000;
  
  const key = `ratelimit:${apiKey.user_id}:sync`;
  const current = await redis.get(key);
  
  if (!current) {
    await redis.setex(key, Math.floor(windowMs / 1000), '1');
    return true;
  }
  
  if (parseInt(current) >= parseInt(count)) {
    return false; // Rate limited
  }
  
  await redis.incr(key);
  return true;
}
```

**Response when rate limited:**
```json
{
  "error": "Rate limit exceeded. Free tier allows 1 sync per minute.",
  "retryAfter": 45,
  "quota": {
    "tier": "free",
    "syncRateLimit": "1/minute"
  },
  "upgradeUrl": "https://cloud.aidimag.com/pricing"
}
```

---

## 6. Webhook for Stripe Subscription Events

Handle subscription changes from Stripe.

**Endpoint:** `POST /webhooks/stripe`

**Events to handle:**
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Plan change/upgrade
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment

**Implementation:**
```typescript
async function handleStripeWebhook(req: Request): Promise<Response> {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  
  const event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  
  switch (event.type) {
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      const userId = subscription.metadata.user_id;
      
      // Update user's plan
      await db.query(
        `UPDATE subscriptions 
         SET plan_tier = $1, 
             memory_limit = $2, 
             api_key_limit = $3,
             sync_rate_limit = $4,
             updated_at = NOW()
         WHERE user_id = $5`,
        [
          subscription.items.data[0].price.metadata.tier,
          subscription.items.data[0].price.metadata.memory_limit,
          subscription.items.data[0].price.metadata.api_key_limit,
          subscription.items.data[0].price.metadata.sync_rate_limit,
          userId
        ]
      );
      break;
      
    // ... handle other events
  }
  
  return new Response('OK', { status: 200 });
}
```

---

## 7. Testing Scenarios

### Test Case 1: Free Tier First Sync (1000 local → 100 limit)
```
1. User has 1000 local memories
2. Client calls GET /v1/account/plan → returns free tier (limit: 100)
3. Client shows selection UI
4. User selects newest 100
5. Client sends POST /v1/push with 100 items
6. Server accepts all 100
7. Response: { accepted: 100, memoriesAccepted: 100, seq: 100 }
```

### Test Case 2: At Limit, Try to Add More
```
1. Cloud has 100 memories (at limit)
2. User adds 10 new memories locally
3. Client sends POST /v1/push with 10 new items
4. Server rejects with 429
5. Response: { error: "Free tier is limited to 100 memories...", quota: {...} }
```

### Test Case 3: Replacement Sync
```
1. Cloud has 100 memories (A1-A100)
2. User selects 100 different memories (30 overlap + 70 new)
3. Client sends POST /v1/push with:
   - 70 tombstones (A31-A100)
   - 100 memories (A1-A30 updates + B1-B70 new)
4. Server processes atomically:
   a. Deletes 70 (frees space)
   b. Updates 30
   c. Adds 70 new
5. Response: { accepted: 170, memoriesAccepted: 70, seq: 270 }
```

### Test Case 4: Upgrade Detection
```
1. User on free tier, synced 100 memories
2. User upgrades to starter plan
3. Next sync: Client calls GET /v1/account/plan
4. Detects upgrade (free → starter)
5. Prompts: "You upgraded! Sync remaining 900 memories?"
6. User confirms
7. Client sends all 900 unsynced memories
8. Server accepts all (no limit)
```

---

## 8. Summary of Required Changes

### Database
- [ ] Add `subscriptions` table
- [ ] Add `plans` table with seed data
- [ ] Add `user_id` to `brains` table
- [ ] Add indexes for quota queries

### API Endpoints
- [ ] Implement `GET /v1/account/plan`
- [ ] Enhance `POST /v1/push` with quota enforcement
- [ ] Implement `POST /webhooks/stripe`

### Business Logic
- [ ] User plan lookup function
- [ ] Memory count queries per brain/user
- [ ] Atomic transaction handling (deletions → additions)
- [ ] Rate limiting per plan tier
- [ ] Partial sync response with warnings

### Stripe Integration
- [ ] Create products and prices in Stripe
- [ ] Add metadata to prices (tier, limits)
- [ ] Configure webhook endpoint
- [ ] Handle subscription lifecycle events

### Testing
- [ ] Unit tests for quota enforcement
- [ ] Integration tests for sync scenarios
- [ ] Load tests for rate limiting
- [ ] E2E tests with Stripe test mode

---

## 9. Migration Path

For existing users:

```sql
-- Assign all existing users to free tier
INSERT INTO subscriptions (user_id, plan_tier, memory_limit, api_key_limit, sync_rate_limit, status)
SELECT id, 'free', 100, 1, '1/minute', 'active'
FROM users
WHERE id NOT IN (SELECT user_id FROM subscriptions);

-- Link existing brains to users (if not already linked)
-- This depends on your current auth model
UPDATE brains b
SET user_id = (
  SELECT user_id FROM api_keys 
  WHERE brain_id = b.id 
  LIMIT 1
)
WHERE user_id IS NULL;
```

---

## 10. Client-Server Contract

### Client Responsibilities
1. Track per-item sync status locally (`cloud_synced` column)
2. Call `GET /v1/account/plan` before sync
3. Show quota UI when needed
4. Send tombstones before additions in replacement scenarios
5. Handle partial success responses
6. Detect upgrades and prompt user

### Server Responsibilities
1. Enforce memory limits per plan
2. Process tombstones before additions (atomic)
3. Allow updates to bypass quota
4. Return clear error messages with quota info
5. Provide upgrade URLs
6. Handle Stripe webhooks for plan changes

---

This completes the cloud server API requirements for quota management.
