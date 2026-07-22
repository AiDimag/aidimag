# Fix: Device Login Brain Selection

## Problem

When a user runs `dim login` from project B, the device approval page on cloud.aidimag.com shows project A in the dropdown with no way to select project B. The token gets scoped to the wrong brain.

## Required Changes

### 1. Backend: Device Login Endpoint

**File:** Likely `src/routes/auth.ts` or similar

**Current behavior:**
- `/v1/auth/device` (POST) - Creates device code
- `/v1/auth/token` (POST) - Returns token after approval
- Token is scoped to whatever brain the user has selected in the UI at approval time

**Fix needed:**

```typescript
// When starting device login, accept optional brain parameter
POST /v1/auth/device
Body: { brain?: string }  // NEW: optional brain hint

// Store the requested brain with the device_code in the database
// So the approval page can show: "Project B is requesting access"
```

**Changes:**
1. Accept `brain` parameter in device login request
2. Store it with the `device_code` in your database/session
3. Pass it to the approval page UI

### 2. Frontend: Approval Page UI

**File:** Likely `pages/device-approve.tsx` or `components/DeviceApproval.tsx`

**Current UI:**
```
Approve device login
Code: KQRD-6RB3
[Dropdown showing Project A]  ← User can't change this
[Approve] [Deny]
```

**Fixed UI:**
```
Approve device login
Code: KQRD-6RB3
Requesting access to: Project B (demo-project-e521)

Select scope:
○ This brain only (demo-project-e521)
○ All my brains

[Approve] [Deny]
```

**Changes needed:**
1. Fetch the requested `brain` from the device_code session
2. Show which brain is requesting access
3. Add radio buttons to let user choose:
   - Scope token to the requested brain only
   - Scope token to all brains (brain: null)
4. If no brain was requested, default to "all brains"

### 3. CLI: Pass Brain to Device Login

**File:** `src/sync/client.ts` in aidimag repo

**Current code:**
```typescript
export async function startDeviceLogin(server: string): Promise<DeviceStart> {
  const res = await cloudFetch(server, `${server}/v1/auth/device`, { method: "POST" });
  // ...
}
```

**Fix needed:**
```typescript
export async function startDeviceLogin(server: string, brain?: string): Promise<DeviceStart> {
  const res = await cloudFetch(server, `${server}/v1/auth/device`, { 
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: brain ? JSON.stringify({ brain }) : undefined
  });
  // ...
}
```

**And update the caller in `src/cli/commands/sync.ts`:**
```typescript
// In dim login command
const cfg = readCloudConfig(root);
const brain = cfg?.brain; // Get the brain from project config
const start = await startDeviceLogin(server, brain); // Pass it!
```

## Implementation Steps

### Backend Changes

1. Modify `/v1/auth/device` endpoint:
   - Accept optional `brain` parameter in request body
   - Store `requested_brain` with the device code in database/session
   
2. Modify device approval page API:
   - Return the `requested_brain` when fetching device code details
   
3. Modify `/v1/auth/token` endpoint:
   - Accept scope selection from approval page
   - Generate token with appropriate brain scope

### Frontend Changes

1. Update approval page component:
   - Fetch and display the requested brain name
   - Add radio button group for scope selection:
     - "This brain only (brain-name)"
     - "All my brains"
   - Default to requested brain if provided, otherwise "all brains"
   
2. Update approval submission:
   - Send selected scope to token endpoint
   - Show confirmation with scope information

### CLI Changes (aidimag repo)

1. Update `src/sync/client.ts`:
   - Modify `startDeviceLogin()` signature to accept optional `brain` parameter
   - Send brain in request body if provided
   
2. Update `src/cli/commands/sync.ts`:
   - In `dim login` command, read brain from project config
   - Pass brain to `startDeviceLogin()`

## Database Schema Change

Add column to store requested brain with device code:

```sql
-- Option 1: Add column to device_codes table
ALTER TABLE device_codes ADD COLUMN requested_brain TEXT;

-- Option 2: If using JSON storage
-- Just add "requested_brain" field to the session object
```

## Example Flow After Fix

```bash
# User in project B
cd /path/to/project-b
dim cloud link --server https://cloud.aidimag.com --brain demo-project-e521
dim login

# Browser opens, shows:
# "Project B (demo-project-e521) is requesting access"
# ○ This brain only (demo-project-e521)
# ○ All my brains
# User selects "This brain only" → Approve

# Token is saved to project-b/.aidimag/config.json
# Scoped to demo-project-e521 only
```

## API Contract

### POST /v1/auth/device

**Request:**
```json
{
  "brain": "demo-project-e521"  // optional
}
```

**Response:**
```json
{
  "device_code": "abc123...",
  "user_code": "KQRD-6RB3",
  "verification_uri": "https://cloud.aidimag.com/device",
  "interval": 5,
  "expires_in": 600
}
```

### GET /v1/auth/device/:user_code (or similar)

**Response:**
```json
{
  "user_code": "KQRD-6RB3",
  "requested_brain": "demo-project-e521",  // NEW
  "status": "pending"
}
```

### POST /v1/auth/token

**Request:**
```json
{
  "device_code": "abc123...",
  "scope": "demo-project-e521"  // or null for all brains
}
```

**Response:**
```json
{
  "token": "eyJ...",
  "brain": "demo-project-e521"  // or null
}
```

## Testing

1. **Test case 1: Login from linked project**
   - Link project to brain A
   - Run `dim login`
   - Approval page should show brain A
   - Token should be scoped to brain A

2. **Test case 2: Login without linked project**
   - Don't link project (no brain in config)
   - Run `dim login --server URL`
   - Approval page should default to "all brains"
   - Token should work for all brains

3. **Test case 3: User overrides scope**
   - Link project to brain A
   - Run `dim login`
   - User selects "all brains" instead
   - Token should work for all brains

## Backward Compatibility

- If CLI doesn't send `brain` parameter, backend should work as before (all brains)
- Old CLI versions will still work, just won't benefit from brain hint
- New CLI with old backend will fail gracefully (brain parameter ignored)
