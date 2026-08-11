/**
 * Cloud quota management for tiered pricing.
 * Only enforced for cloud.aidimag.com, not custom self-hosted servers.
 */

export interface UserPlan {
  tier: "free" | "starter" | "developer" | "team" | "custom";
  memoryLimit: number | null; // null = unlimited
  apiKeyLimit: number;
  syncRateLimit: string | null; // e.g., "1/minute" or null for unlimited
}

export interface QuotaStatus {
  currentMemories: number;
  limit: number | null;
  available: number;
  exceeded: boolean;
  plan: UserPlan;
}

export interface SelectionChoice {
  action: "update-only" | "select" | "replace" | "upgrade" | "cancel";
  selectedIds?: string[];
}

/**
 * Check if quota enforcement should apply for this server.
 * Only enforces for official cloud.aidimag.com, not custom servers.
 */
export function shouldEnforceQuota(serverUrl: string): boolean {
  try {
    const url = new URL(serverUrl);
    return url.hostname === "cloud.aidimag.com" || 
           url.hostname === "www.cloud.aidimag.com";
  } catch {
    return false;
  }
}

/**
 * Get user's current plan from the cloud server.
 * Returns null if server doesn't support plan API or user is on custom server.
 */
export async function getUserPlan(
  serverUrl: string,
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<UserPlan | null> {
  if (!shouldEnforceQuota(serverUrl)) {
    return null;
  }

  try {
    const res = await fetchFn(`${serverUrl}/v1/account/plan`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json() as {
      tier: string;
      memoryLimit: number | null;
      apiKeyLimit: number;
      syncRateLimit: string | null;
    };

    return {
      tier: data.tier as UserPlan["tier"],
      memoryLimit: data.memoryLimit,
      apiKeyLimit: data.apiKeyLimit,
      syncRateLimit: data.syncRateLimit,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate quota status based on current cloud state and user plan.
 */
export function calculateQuotaStatus(
  cloudMemoryCount: number,
  plan: UserPlan
): QuotaStatus {
  const limit = plan.memoryLimit;
  const available = limit === null ? Infinity : Math.max(0, limit - cloudMemoryCount);
  const exceeded = limit !== null && cloudMemoryCount >= limit;

  return {
    currentMemories: cloudMemoryCount,
    limit,
    available: available === Infinity ? Number.MAX_SAFE_INTEGER : available,
    exceeded,
    plan,
  };
}

/**
 * Format quota status for display.
 */
export function formatQuotaMessage(status: QuotaStatus): string {
  if (status.limit === null) {
    return `${status.currentMemories} memories synced (unlimited)`;
  }
  return `${status.currentMemories}/${status.limit} memories synced`;
}

/**
 * Get upgrade URL for the cloud service.
 */
export function getUpgradeUrl(serverUrl: string): string {
  try {
    const url = new URL(serverUrl);
    if (url.hostname === "cloud.aidimag.com" || url.hostname === "www.cloud.aidimag.com") {
      return "https://cloud.aidimag.com/pricing";
    }
  } catch {
    // Invalid URL
  }
  return `${serverUrl}/pricing`;
}
