# Cloud Server Requirements - Quick Reference

## What You Need to Implement on cloud.aidimag.com

### 1. Database Tables

```sql
-- User subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('free', 'starter', 'developer', 'team')),
  memory_limit INTEGER,  -- 100 for free, NULL for unlimited
  api_key_limit INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

-- Link brains to users
ALTER TABLE brains ADD COLUMN user_id UUID REFERENCES users(id);
```

### 2. New API Endpoint

**GET /v1/account/plan**

Returns user's plan and current usage:

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

### 3. Enhanced POST /v1/push

**Key Changes:**
1. Process tombstones (deletions) FIRST to free space
2. Count current memories per brain
3. Enforce limit only for NEW memories (updates always work)
4. Return partial success with warnings

**Response when at limit:**
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

**Response for partial sync:**
```json
{
  "accepted": 20,
  "memoriesAccepted": 20,
  "seq": 12366,
  "warning": "Memory limit reached. Only 20 of 50 memories synced.",
  "quota": {
    "current": 100,
    "limit": 100,
    "tier": "free"
  }
}
```

### 4. Quota Enforcement Logic

```typescript
// Pseudocode
async function handlePush(brain, items, apiKey) {
  const plan = await getUserPlan(apiKey.user_id);
  
  // 1. Process deletions first
  const deletions = items.filter(it => it.deleted);
  await processDeletes(brain, deletions);
  
  // 2. Count current memories AFTER deletions
  const currentCount = await countMemories(brain);
  
  // 3. Separate updates from new additions
  const additions = items.filter(it => !it.deleted);
  const updates = await filterExisting(brain, additions);
  const newItems = additions.filter(it => !updates.includes(it));
  
  // 4. Check quota for NEW items only
  if (plan.memoryLimit !== null) {
    const newMemories = newItems.filter(it => it.tbl === 'memories');
    const available = plan.memoryLimit - currentCount;
    
    if (available <= 0 && newMemories.length > 0) {
      return error429("Memory limit reached");
    }
    
    if (newMemories.length > available) {
      // Partial acceptance
      newItems = newItems.slice(0, available);
      return partialSuccess(newItems, "warning message");
    }
  }
  
  // 5. Process all updates + accepted new items
  await processItems(brain, [...updates, ...newItems]);
  
  return success();
}
```

### 5. Plan Tiers

```javascript
const PLANS = {
  free: {
    memoryLimit: 100,
    apiKeyLimit: 1,
    syncRateLimit: "1/minute",
    price: 0
  },
  starter: {
    memoryLimit: null,  // unlimited
    apiKeyLimit: 1,
    syncRateLimit: null,  // unlimited
    price: 500  // $5/mo
  },
  developer: {
    memoryLimit: null,
    apiKeyLimit: 3,
    syncRateLimit: null,
    price: 1500  // $15/mo
  },
  team: {
    memoryLimit: null,
    apiKeyLimit: 10,
    syncRateLimit: null,
    price: 5000  // $50/mo
  }
};
```

### 6. Critical Rules

✅ **Updates bypass quota** - Modifications to existing memories always work
✅ **Deletions first** - Process tombstones before additions (frees space)
✅ **Atomic operations** - All or nothing for each push
✅ **Clear errors** - Include quota info and upgrade URL in responses
✅ **Only enforce for cloud.aidimag.com** - Custom servers ignore limits

---

## Full Details

See `design/CLOUD_QUOTA_API_REQUIREMENTS.md` for:
- Complete database schema
- Full API specifications
- Stripe webhook handling
- Testing scenarios
- Migration scripts

---

## Client-Side Implementation Status

✅ **COMPLETE:**
- Database schema v10 with `cloud_synced` tracking
- Store methods for sync status management
- Quota detection module
- Per-item sync tracking

⏳ **IN PROGRESS:**
- CLI enhancements (selection UI, JSON output)
- Sync client quota integration

📋 **DOCUMENTED:**
- VSCode extension changes
- IntelliJ plugin changes

---

## Quick Start for Server Implementation

1. Add `subscriptions` table
2. Implement `GET /v1/account/plan`
3. Modify `POST /v1/push` to:
   - Process deletions first
   - Count memories after deletions
   - Enforce limit only for new memories
   - Return quota info in responses
4. Set up Stripe webhooks
5. Test with free tier limits

**Priority:** Implement steps 1-3 first for MVP.
