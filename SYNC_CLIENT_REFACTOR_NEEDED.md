# Sync Client Refactor - Critical Changes Needed

## Status: Foundation Complete, Core Refactor Needed

### ✅ What's Done

1. **Database Schema v10** - `cloud_synced` and `cloud_seq` columns added
2. **Store Methods** - Per-item sync tracking methods implemented
3. **Quota Module** - `src/sync/quota.ts` with plan detection
4. **Selection Module** - `src/sync/selection.ts` with preset strategies
5. **Type Definitions** - `SyncResult` and `SyncOptions` enhanced with quota fields

### ❌ What's Needed in `src/sync/client.ts`

The current `sync()` function (lines 309-504) uses **timestamp-based tracking** which is incompatible with per-item quota management. It needs to be refactored to:

1. **Use per-item tracking instead of timestamps**
2. **Check quota before push**
3. **Handle selection when quota exceeded**
4. **Mark items as synced individually**
5. **Support atomic replacement syncs**

---

## Required Changes to `sync()` Function

### Current Flow (Broken for Quota)

```typescript
// CURRENT (lines 319-390)
const lastPush = opts.full ? null : store.getMeta(lastPushKey);
const changes = store.changedSince(lastPush);  // ❌ Timestamp-based
const items = [...changes.memories, ...changes.proposals, ...changes.tombstones];

// Push all items
const r = await api<{ accepted: number }>(...);

// ❌ PROBLEM: Marks ALL items as synced based on timestamp
store.setMeta(lastPushKey, latestItemAt);
```

**Problem:** If server accepts 20/100 items due to quota, client marks all 100 as synced and never retries the remaining 80.

### Required Flow (Per-Item Tracking)

```typescript
// 1. CHECK QUOTA FIRST
const quotaInfo = await checkQuotaAndPlan(cfg, token, store);

if (quotaInfo && !opts.skipQuotaCheck) {
  const { quota, upgraded } = quotaInfo;
  
  // Handle upgrade detection
  if (upgraded) {
    const unsyncedCount = store.getUnsyncedMemories().length;
    // Return early to let CLI prompt user
    return {
      ...baseResult,
      quotaExceeded: false,
      unsyncedCount,
      quota,
      warning: `You upgraded to ${quota.plan.tier}! ${unsyncedCount} memories ready to sync.`
    };
  }
}

// 2. GET ITEMS TO PUSH (per-item tracking)
const syncedMemories = store.getSyncedMemories();
const unsyncedMemories = store.getUnsyncedMemories();

// Separate updates (synced items that changed) from new items
const updates = changes.memories.filter(m => 
  syncedMemories.some(s => s.id === m.id)
);
const newMemories = changes.memories.filter(m => 
  !syncedMemories.some(s => s.id === m.id)
);

// 3. CHECK QUOTA FOR NEW ITEMS
if (quotaInfo && quota.exceeded && newMemories.length > 0) {
  if (opts.selectionStrategy || opts.selectedIds) {
    // User provided selection
    const selected = opts.selectedIds 
      ? newMemories.filter(m => opts.selectedIds!.includes(m.id))
      : selectMemories(newMemories, quota.limit, opts.selectionStrategy!).selected;
    
    // Build items with selected memories
    items = buildSyncItems(selected, updates, tombstones);
  } else {
    // Return early - need user selection
    return {
      ...baseResult,
      quotaExceeded: true,
      quota,
      unsyncedCount: newMemories.length
    };
  }
} else {
  // Normal push (all changes or only updates if at limit)
  const memoriesToPush = quotaInfo?.quota.exceeded ? updates : changes.memories;
  items = buildSyncItems(memoriesToPush, changes.proposals, changes.tombstones);
}

// 4. PUSH ITEMS
const pushRes = await api<PushResponse>(...);

// 5. ✅ MARK ONLY ACCEPTED ITEMS AS SYNCED
const acceptedItems = items.slice(0, pushRes.accepted);
for (const item of acceptedItems) {
  if (item.tbl === "memories" && !item.deleted) {
    store.markMemorySynced(item.id, pushRes.seq);
  } else if (item.tbl === "proposals" && !item.deleted) {
    store.markProposalSynced(item.id, pushRes.seq);
  }
}

// 6. HANDLE SERVER WARNINGS
if (pushRes.warning) {
  result.warning = pushRes.warning;
  result.quota = pushRes.quota;
}
```

---

## Enhanced Push Response Type

The server now returns:

```typescript
interface PushResponse {
  accepted: number;
  memoriesAccepted?: number;
  seq: number;
  warning?: string;  // "Memory limit reached. Only 20 of 50 synced."
  quota?: {
    current: number;
    limit: number;
    tier: string;
  };
}
```

Update the `api()` call to handle this:

```typescript
const r = await api<PushResponse>(
  cfg,
  token,
  `/v1/push?brain=${encodeURIComponent(cfg.brain)}`,
  {
    method: "POST",
    body: JSON.stringify({ items }),
  }
);
```

---

## Migration Strategy

### Phase 1: Backward Compatible (Recommended)

Keep timestamp-based tracking as fallback, add per-item tracking alongside:

```typescript
// Try per-item tracking first
let itemsToPush: SyncItem[];

if (store.getSyncStatusSummary().synced > 0) {
  // v10 database with per-item tracking
  itemsToPush = getItemsWithPerItemTracking(store, opts);
} else {
  // Fallback to timestamp-based for v9 databases
  const lastPush = opts.full ? null : store.getMeta(lastPushKey);
  const changes = store.changedSince(lastPush);
  itemsToPush = buildSyncItems(changes);
}
```

### Phase 2: Full Migration (After Testing)

Remove timestamp-based tracking entirely, require v10 database.

---

## Helper Functions Needed

Add these before the `sync()` function:

```typescript
/**
 * Build sync items from memories, proposals, and tombstones.
 */
function buildSyncItems(
  memories: MemoryEntry[],
  proposals: Proposal[],
  tombstones: Array<{ id: string; tbl: string; deletedAt: string }>
): SyncItem[] {
  return [
    ...memories.map((m) => ({
      tbl: "memories" as const,
      id: m.id,
      updatedAt: m.updatedAt ?? m.createdAt,
      deleted: false,
      payload: m,
    })),
    ...proposals.map((p) => ({
      tbl: "proposals" as const,
      id: p.id,
      updatedAt: p.updatedAt ?? p.createdAt,
      deleted: false,
      payload: p,
    })),
    ...tombstones.map((t) => ({
      tbl: t.tbl as SyncItem["tbl"],
      id: t.id,
      updatedAt: t.deletedAt,
      deleted: true,
      payload: null,
    })),
  ];
}

/**
 * Get items to push using per-item tracking.
 */
function getItemsWithPerItemTracking(
  store: MemoryStore,
  opts: SyncOptions,
  quotaInfo: { quota: QuotaStatus } | null
): { items: SyncItem[]; needsSelection: boolean } {
  // Get all changed items since last push (timestamp-based)
  const lastPush = opts.full ? null : store.getMeta("sync_last_push_at");
  const changes = store.changedSince(lastPush);
  
  // Separate synced (updates) from unsynced (new)
  const updates: MemoryEntry[] = [];
  const newMemories: MemoryEntry[] = [];
  
  for (const m of changes.memories) {
    if (store.isMemorySynced(m.id)) {
      updates.push(m);
    } else {
      newMemories.push(m);
    }
  }
  
  // Check quota for new items
  if (quotaInfo && quotaInfo.quota.exceeded && newMemories.length > 0) {
    if (opts.selectionStrategy || opts.selectedIds) {
      // Apply selection
      const selected = opts.selectedIds
        ? newMemories.filter(m => opts.selectedIds!.includes(m.id))
        : selectMemories(newMemories, quotaInfo.quota.limit!, opts.selectionStrategy!).selected;
      
      return {
        items: buildSyncItems([...updates, ...selected], changes.proposals, changes.tombstones),
        needsSelection: false
      };
    } else {
      // Need user selection
      return {
        items: [],
        needsSelection: true
      };
    }
  }
  
  // No quota issues - push everything
  return {
    items: buildSyncItems(changes.memories, changes.proposals, changes.tombstones),
    needsSelection: false
  };
}
```

---

## Testing Checklist

After refactoring:

- [ ] Sync with v9 database (no cloud_synced column) - should fallback gracefully
- [ ] Sync with v10 database - should use per-item tracking
- [ ] First sync with 1000 memories to free tier - should detect quota and return `quotaExceeded: true`
- [ ] Sync with selection strategy - should only push selected items
- [ ] Sync with custom selection IDs - should only push specified items
- [ ] Incremental sync with updates - should push updates even if at quota
- [ ] Incremental sync with new items at quota - should return `quotaExceeded: true`
- [ ] Upgrade detection - should detect plan change and notify
- [ ] Partial push (server accepts 20/50) - should only mark 20 as synced
- [ ] Full push success - should mark all items as synced

---

## Priority

**CRITICAL** - This refactor is the blocker for all quota features. Without it:
- Partial sync doesn't work (marks all as synced even if rejected)
- Selection UI can't function (no way to track which items are synced)
- Quota enforcement is ineffective (client retries already-synced items)

**Recommendation:** Implement Phase 1 (backward compatible) first, test thoroughly, then move to Phase 2.

---

## Estimated Effort

- **Phase 1 (Backward Compatible):** 4-6 hours
  - Add helper functions
  - Refactor sync() to use per-item tracking when available
  - Keep timestamp fallback
  - Test both code paths

- **Phase 2 (Full Migration):** 2-3 hours
  - Remove timestamp-based code
  - Simplify logic
  - Update tests

**Total:** 6-9 hours of focused development + testing

---

## Next Steps

1. Implement helper functions (`buildSyncItems`, `getItemsWithPerItemTracking`)
2. Refactor `sync()` function to check quota and use per-item tracking
3. Update `api()` call to handle enhanced `PushResponse`
4. Add per-item sync status updates after successful push
5. Test with both v9 and v10 databases
6. Update CLI commands to handle `quotaExceeded` response

---

**Status:** Ready for implementation. All dependencies (schema, store methods, quota module, selection module) are in place.
