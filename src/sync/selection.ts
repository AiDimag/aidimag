/**
 * Memory selection logic for quota management.
 * Provides preset selection strategies and scoring for smart auto-selection.
 */

import type { MemoryEntry } from "../types.js";

export type SelectionStrategy = "newest" | "verified" | "pinned" | "smart";

export interface SelectionResult {
  selected: MemoryEntry[];
  unselected: MemoryEntry[];
  strategy: SelectionStrategy;
}

/**
 * Score a memory for auto-selection priority.
 * Higher score = more important to keep synced.
 */
function scoreMemory(m: MemoryEntry): number {
  let score = 0;
  
  if (m.status === "VERIFIED") score += 100;
  else if (m.status === "UNVERIFIED") score += 50;
  else if (m.status === "STALE") score += 10;
  
  if (m.pinned) score += 200;
  
  score += m.grounding.length * 20;
  
  const age = Date.now() - new Date(m.createdAt).getTime();
  const daysSinceCreated = age / (1000 * 60 * 60 * 24);
  score -= daysSinceCreated * 0.1;
  
  return score;
}

/**
 * Select memories using a preset strategy.
 */
export function selectMemories(
  memories: MemoryEntry[],
  limit: number,
  strategy: SelectionStrategy
): SelectionResult {
  let sorted: MemoryEntry[];
  
  switch (strategy) {
    case "newest":
      sorted = [...memories].sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt;
        const bTime = b.updatedAt || b.createdAt;
        return bTime.localeCompare(aTime);
      });
      break;
      
    case "verified":
      const verified = memories.filter(m => m.status === "VERIFIED");
      sorted = [...verified].sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt;
        const bTime = b.updatedAt || b.createdAt;
        return bTime.localeCompare(aTime);
      });
      break;
      
    case "pinned":
      const pinned = memories.filter(m => m.pinned);
      sorted = [...pinned].sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt;
        const bTime = b.updatedAt || b.createdAt;
        return bTime.localeCompare(aTime);
      });
      break;
      
    case "smart":
      sorted = [...memories].sort((a, b) => scoreMemory(b) - scoreMemory(a));
      break;
      
    default:
      sorted = memories;
  }
  
  const selected = sorted.slice(0, limit);
  const unselected = sorted.slice(limit);
  
  return {
    selected,
    unselected,
    strategy
  };
}

/**
 * Get a summary of what would be selected.
 */
export function getSelectionSummary(
  memories: MemoryEntry[],
  limit: number,
  strategy: SelectionStrategy
): {
  total: number;
  willSelect: number;
  willSkip: number;
  byStatus: Record<string, number>;
} {
  const result = selectMemories(memories, limit, strategy);
  
  const byStatus: Record<string, number> = {};
  for (const m of result.selected) {
    byStatus[m.status] = (byStatus[m.status] || 0) + 1;
  }
  
  return {
    total: memories.length,
    willSelect: result.selected.length,
    willSkip: result.unselected.length,
    byStatus
  };
}
