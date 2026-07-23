# Quota Management Implementation Summary

This document summarizes all changes implemented for cloud quota management with tiered pricing.

---

## ✅ Completed Client-Side Changes

### 1. Database Schema (v10)

**Files Modified:**
- `src/db/schema.ts`

**Changes:**
- Bumped `SCHEMA_VERSION` to 10
- Added migrations for:
  - `memories.cloud_synced` (INTEGER, default 0)
  - `memories.cloud_seq` (INTEGER, nullable)
  - `proposals.cloud_synced` (INTEGER, default 0)
  - `proposals.cloud_seq` (INTEGER, nullable)
- Added indexes:
  - `idx_memories_cloud_synced`
  - `idx_proposals_cloud_synced`
- Updated table definitions in `SCHEMA_SQL`

**Purpose:**
Track which memories/proposals are synced to cloud for per-item quota management.

---

### 2. Store Methods

**Files Modified:**
- `src/db/store.ts`

**New Methods:**
```typescript
// Mark items as synced/unsynced
markMemorySynced(id: string, seq: number): void
markMemoryUnsynced(id: string): void
markProposalSynced(id: string, seq: number): void
markProposalUnsynced(id: string): void

// Query sync status
getUnsyncedMemories(limit?: number): MemoryEntry[]
getSyncedMemories(): MemoryEntry[]
getSyncStatusSummary(): { synced: number; unsynced: number; total: number }
isMemorySynced(id: string): boolean
```

**Updated Interface:**
```typescript
interface MemoryRow {
  // ... existing fields
  cloud_synced?: number;
  cloud_seq?: number | null;
}
```

**Purpose:**
Provide API for managing per-item sync status in the local database.

---

### 3. Quota Management Module

**Files Created:**
- `src/sync/quota.ts`

**Exports:**
```typescript
interface UserPlan {
  tier: "free" | "starter" | "developer" | "team" | "custom";
  memoryLimit: number | null;
  apiKeyLimit: number;
  syncRateLimit: string | null;
}

interface QuotaStatus {
  currentMemories: number;
  limit: number | null;
  available: number;
  exceeded: boolean;
  plan: UserPlan;
}

// Functions
shouldEnforceQuota(serverUrl: string): boolean
getUserPlan(serverUrl: string, token: string): Promise<UserPlan | null>
calculateQuotaStatus(cloudMemoryCount: number, plan: UserPlan): QuotaStatus
formatQuotaMessage(status: QuotaStatus): string
getUpgradeUrl(serverUrl: string): string
```

**Purpose:**
Centralized quota logic for determining when to enforce limits and how to display them.

---

## 📋 Required Server-Side Changes

**Documentation:** `design/CLOUD_QUOTA_API_REQUIREMENTS.md`

### Database Changes

```sql
-- New tables
CREATE TABLE subscriptions (...)
CREATE TABLE plans (...)

-- Modified tables
ALTER TABLE brains ADD COLUMN user_id UUID;
```

### New API Endpoints

1. **GET /v1/account/plan**
   - Returns user's current plan and quota status
   - Response includes: tier, limits, current usage

2. **Enhanced POST /v1/push**
   - Enforces memory limits
   - Processes tombstones first (frees space)
   - Returns partial success with warnings
   - Handles atomic replacement operations

3. **POST /webhooks/stripe**
   - Handles subscription lifecycle events
   - Updates user plans on upgrade/downgrade

### Key Server Logic

- **Quota Enforcement:** Only for cloud.aidimag.com
- **Updates Bypass Quota:** Modifications to existing memories always allowed
- **Atomic Operations:** Deletions processed before additions
- **Rate Limiting:** Per-plan rate limits (free: 1/min, paid: unlimited)

---

## 🔌 Plugin Changes Required

**Documentation:** `design/PLUGIN_QUOTA_IMPLEMENTATION.md`

### VSCode Extension

**New Features:**
- Enhanced status bar: `☁ 95/100` with quota display
- Warning notifications when quota exceeded
- Memory selection command with presets
- Upgrade command (opens browser)
- JSON output parsing

**New Commands:**
```javascript
aidimag.selectMemoriesToSync
aidimag.upgradeplan
aidimag.openMemorySelector
```

### IntelliJ Plugin

**New Features:**
- Enhanced sync action with quota handling
- Memory selector dialog
- Status bar widget with quota display
- Upgrade action
- Notification system integration

**New Actions:**
```xml
<action id="aidimag.SelectMemories" .../>
<action id="aidimag.UpgradePlan" .../>
```

---

## 🚀 Next Steps: CLI Implementation

The following CLI changes are still needed to complete the implementation:

### 1. Enhanced Sync Command

**File:** `src/cli/commands/sync.ts`

**Required Changes:**

```typescript
// Add --json flag for machine-readable output
dim sync --json

// Add --select flag for memory selection
dim sync --select newest      // Sync newest 100
dim sync --select verified    // Sync verified only
dim sync --select pinned      // Sync pinned only
dim sync --select custom      // Interactive selector

// Add --force-full flag to sync all unsynced after upgrade
dim sync --force-full
```

**Implementation Outline:**

```typescript
export async function syncCommand(opts: {
  full?: boolean;
  json?: boolean;
  select?: "newest" | "verified" | "pinned" | "custom";
  forceFull?: boolean;
}) {
  const store = MemoryStore.open();
  const repoRoot = findRepoRoot();
  const cfg = readCloudConfig(repoRoot);
  
  // 1. Check if quota enforcement applies
  if (shouldEnforceQuota(cfg.server)) {
    const plan = await getUserPlan(cfg.server, getToken(cfg.server, repoRoot));
    
    if (plan) {
      // 2. Check for upgrade
      const lastKnownPlan = store.getMeta("last_known_plan") || "free";
      if (lastKnownPlan === "free" && plan.tier !== "free") {
        await handleUpgradeDetected(store, plan);
      }
      store.setMeta("last_known_plan", plan.tier);
      
      // 3. Check quota status
      const snapshot = await getRemoteSnapshot(cfg, token);
      const quotaStatus = calculateQuotaStatus(snapshot.counts.memories, plan);
      
      if (quotaStatus.exceeded && !opts.forceFull) {
        // 4. Show selection UI
        if (opts.select) {
          await syncWithSelection(store, repoRoot, opts.select, quotaStatus);
        } else {
          await showQuotaDialog(store, quotaStatus);
        }
        return;
      }
    }
  }
  
  // 5. Normal sync
  const result = await sync(store, repoRoot, opts);
  
  // 6. Output result
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displaySyncResult(result);
  }
}
```

### 2. Memory Selection UI

**Interactive Selector:**

```typescript
async function showMemorySelector(
  store: MemoryStore,
  limit: number
): Promise<string[]> {
  const unsynced = store.getUnsyncedMemories();
  
  console.log(`\nYou have ${unsynced.length} unsynced memories.`);
  console.log(`Free tier allows ${limit} memories.\n`);
  
  const choice = await prompter.select({
    message: "How would you like to select memories to sync?",
    choices: [
      { name: "Sync newest 100", value: "newest" },
      { name: "Sync verified only", value: "verified" },
      { name: "Sync pinned only", value: "pinned" },
      { name: "Custom selection (interactive)", value: "custom" },
      { name: "Cancel", value: "cancel" }
    ]
  });
  
  switch (choice) {
    case "newest":
      return unsynced
        .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
        .slice(0, limit)
        .map(m => m.id);
    
    case "verified":
      const verified = unsynced.filter(m => m.status === "VERIFIED");
      if (verified.length > limit) {
        console.log(`⚠️  You have ${verified.length} verified memories, but limit is ${limit}.`);
        return verified.slice(0, limit).map(m => m.id);
      }
      return verified.map(m => m.id);
    
    case "pinned":
      const pinned = unsynced.filter(m => m.pinned);
      return pinned.slice(0, limit).map(m => m.id);
    
    case "custom":
      return await showCustomSelector(unsynced, limit);
    
    default:
      return [];
  }
}
```

### 3. Replacement Preview Dialog

**When user selects memories that require replacing cloud memories:**

```typescript
async function showReplacementPreview(
  toKeep: MemoryEntry[],
  toAdd: MemoryEntry[],
  toRemove: MemoryEntry[]
): Promise<boolean> {
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│  ⚠️  Sync Selection Requires Replacing Cloud Memories   │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log("│                                                          │");
  console.log(`│  Your selection includes ${toAdd.length} new memories, but cloud     │`);
  console.log("│  is at limit (100/100).                                 │");
  console.log("│                                                          │");
  console.log("│  To sync your selection:                                │");
  console.log(`│  ✅ Keep: ${toKeep.length} memories already in cloud                 │`);
  console.log(`│  ➕ Add: ${toAdd.length} new memories                                │`);
  console.log(`│  ❌ Remove: ${toRemove.length} memories from cloud                   │`);
  console.log("│                                                          │");
  console.log("│  ⚠️  Removed memories will be DELETED from cloud        │");
  console.log("│     (but remain in your local database)                 │");
  console.log("│                                                          │");
  console.log("└─────────────────────────────────────────────────────────┘\n");
  
  // Show memories to be removed
  if (toRemove.length > 0 && toRemove.length <= 10) {
    console.log("Memories to be removed from cloud:");
    for (const m of toRemove) {
      console.log(`  - ${m.claim.slice(0, 60)}...`);
    }
    console.log();
  }
  
  const confirmed = await prompter.confirm({
    message: "Proceed with replacement?",
    default: false
  });
  
  return confirmed;
}
```

### 4. Upgrade Detection

```typescript
async function handleUpgradeDetected(
  store: MemoryStore,
  newPlan: UserPlan
): Promise<void> {
  const unsyncedCount = store.getUnsyncedMemories().length;
  
  if (unsyncedCount === 0) {
    console.log(`🎉 You upgraded to ${newPlan.tier}!`);
    return;
  }
  
  console.log(`\n🎉 You upgraded to ${newPlan.tier}!\n`);
  console.log(`You have ${unsyncedCount} memories that weren't synced due to the free tier limit.`);
  
  const shouldSync = await prompter.confirm({
    message: "Sync all remaining memories now?",
    default: true
  });
  
  if (shouldSync) {
    console.log("\nSyncing all unsynced memories...");
    // Will be handled by the main sync flow
  }
}
```

### 5. Enhanced Sync Client

**File:** `src/sync/client.ts`

**Key Modifications:**

```typescript
export async function sync(
  store: MemoryStore,
  repoRoot: string,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  const cfg = readCloudConfig(repoRoot);
  const token = getToken(cfg.server, repoRoot);
  
  // 1. PULL FIRST (always)
  const pullRes = await pullFromCloud(cfg, token, store);
  
  // 2. CHECK QUOTA (only for cloud.aidimag.com)
  let quotaStatus: QuotaStatus | null = null;
  if (shouldEnforceQuota(cfg.server)) {
    const plan = await getUserPlan(cfg.server, token);
    if (plan) {
      const snapshot = await getRemoteSnapshot(cfg, token);
      quotaStatus = calculateQuotaStatus(snapshot.counts.memories, plan);
    }
  }
  
  // 3. DETERMINE WHAT TO PUSH
  const changes = store.changedSince(lastPush);
  
  // Separate synced (updates) from unsynced (new)
  const updates = changes.memories.filter(m => store.isMemorySynced(m.id));
  const newMemories = changes.memories.filter(m => !store.isMemorySynced(m.id));
  
  let itemsToPush: SyncItem[] = [];
  
  if (quotaStatus && quotaStatus.exceeded && newMemories.length > 0) {
    // Quota exceeded - need selection
    if (opts.selectedIds) {
      // User provided selection
      itemsToPush = buildSyncItems(
        changes.memories.filter(m => opts.selectedIds!.includes(m.id)),
        changes.proposals,
        changes.tombstones
      );
    } else {
      // Return early, let caller handle selection
      return {
        ...pullRes,
        quotaExceeded: true,
        quota: quotaStatus,
        unsyncedCount: newMemories.length,
        pushed: 0,
        memoriesPushed: 0
      };
    }
  } else {
    // Normal push (all changes or only updates if at limit)
    const memoriesToPush = quotaStatus?.exceeded ? updates : changes.memories;
    itemsToPush = buildSyncItems(memoriesToPush, changes.proposals, changes.tombstones);
  }
  
  // 4. PUSH
  const pushRes = await pushToCloud(cfg, token, itemsToPush);
  
  // 5. UPDATE SYNC STATUS
  for (const item of itemsToPush.slice(0, pushRes.accepted)) {
    if (item.tbl === "memories" && !item.deleted) {
      store.markMemorySynced(item.id, pushRes.seq);
    }
  }
  
  // 6. RETURN RESULT
  return {
    ...pullRes,
    pushed: pushRes.accepted,
    memoriesPushed: pushRes.memoriesAccepted,
    quota: quotaStatus,
    message: formatSyncMessage(pullRes, pushRes, quotaStatus)
  };
}
```

---

## 📊 Implementation Status

| Component | Status | Files |
|-----------|--------|-------|
| **Database Schema** | ✅ Complete | `src/db/schema.ts` |
| **Store Methods** | ✅ Complete | `src/db/store.ts` |
| **Quota Module** | ✅ Complete | `src/sync/quota.ts` |
| **Sync Client** | ⏳ Needs Enhancement | `src/sync/client.ts` |
| **CLI Commands** | ⏳ Needs Implementation | `src/cli/commands/sync.ts` |
| **VSCode Extension** | 📋 Documented | `design/PLUGIN_QUOTA_IMPLEMENTATION.md` |
| **IntelliJ Plugin** | 📋 Documented | `design/PLUGIN_QUOTA_IMPLEMENTATION.md` |
| **Cloud Server** | 📋 Documented | `design/CLOUD_QUOTA_API_REQUIREMENTS.md` |

---

## 🎯 Testing Checklist

### Client-Side Tests

- [ ] Schema migration from v9 to v10
- [ ] Per-item sync status tracking
- [ ] Quota detection for cloud.aidimag.com
- [ ] Quota bypass for custom servers
- [ ] Memory selection (newest, verified, pinned)
- [ ] Replacement preview and confirmation
- [ ] Upgrade detection
- [ ] Partial sync with warnings
- [ ] JSON output format

### Server-Side Tests

- [ ] Plan API returns correct limits
- [ ] Memory counting per brain
- [ ] Quota enforcement on push
- [ ] Tombstone processing before additions
- [ ] Atomic replacement operations
- [ ] Rate limiting per plan
- [ ] Stripe webhook handling
- [ ] Upgrade flow

### Integration Tests

- [ ] First-time sync with 1000 local → 100 limit
- [ ] Incremental sync with quota
- [ ] Replacement sync (30 overlap + 70 new)
- [ ] Upgrade detection and auto-sync
- [ ] Plugin quota display
- [ ] CLI interactive selection

---

## 🚀 Deployment Plan

### Phase 1: Client Foundation (Complete)
- ✅ Database schema v10
- ✅ Store methods
- ✅ Quota module

### Phase 2: CLI Enhancement (Next)
- ⏳ Enhanced sync command
- ⏳ Memory selection UI
- ⏳ Replacement preview
- ⏳ JSON output

### Phase 3: Server Implementation
- ⏳ Database schema
- ⏳ Plan API
- ⏳ Enhanced push endpoint
- ⏳ Stripe integration

### Phase 4: Plugin Updates
- ⏳ VSCode extension
- ⏳ IntelliJ plugin

### Phase 5: Testing & Launch
- ⏳ Integration tests
- ⏳ Beta testing
- ⏳ Documentation
- ⏳ Production deployment

---

## 📚 Documentation

All design documents are in `design/`:
- `CLOUD_QUOTA_API_REQUIREMENTS.md` - Server-side requirements
- `PLUGIN_QUOTA_IMPLEMENTATION.md` - Plugin changes
- `QUOTA_IMPLEMENTATION_SUMMARY.md` - This document

---

## 🤝 Contributing

When implementing remaining features:
1. Follow the patterns established in completed code
2. Maintain backward compatibility with v9 databases
3. Test quota enforcement only applies to cloud.aidimag.com
4. Ensure atomic operations for replacement syncs
5. Provide clear user feedback for quota limits

---

**Last Updated:** 2026-07-23
**Schema Version:** 10
**Status:** Foundation Complete, CLI Enhancement In Progress
