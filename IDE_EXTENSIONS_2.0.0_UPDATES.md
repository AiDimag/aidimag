# IDE Extension Updates for v2.0.0

Analysis of new menus, actions, and changes needed in both `aidimag-vscode` and `aidimag-intellij` to align with the aiDimag 2.0.0 release.

---

## VS Code Extension (`aidimag-vscode`)

### New Commands Needed

#### 1. `aidimag.shareTickets` — Share Ticket Credentials (Admin)
- **Command ID:** `aidimag.shareTickets`
- **Title:** `aidimag: Share Ticket Credentials with Team`
- **CLI:** `dim ticket share`
- **Implementation:** Run in terminal (interactive — prompts for confirmation)
- **Menu placement:** Brain menu → "Team & tickets" section, after "Connect Ticketing App"
- **IntelliJ parity:** New action `ShareTicketsAction` under Tools → aidimag

#### 2. `aidimag.ticketStatus` — Ticket Connection Status
- **Command ID:** `aidimag.ticketStatus`
- **Title:** `aidimag: Ticket Status`
- **CLI:** `dim ticket status`
- **Implementation:** Run on background thread, show output in an output channel
- **Menu placement:** Brain menu → "Team & tickets" section, after "Connect Ticketing App"
- **IntelliJ parity:** New action `TicketStatusAction` under Tools → aidimag

#### 3. `aidimag.ticketBranchRule` — Manage Branch Naming Convention
- **Command ID:** `aidimag.ticketBranchRule`
- **Title:** `aidimag: Manage Branch Naming Rule`
- **CLI:** `dim ticket branch-rule`
- **Implementation:** Run in terminal (interactive)
- **Menu placement:** Brain menu → "Team & tickets" section, after "Create Ticket Branch"
- **IntelliJ parity:** New action `TicketBranchRuleAction` under Tools → aidimag

#### 4. `aidimag.cloudLink` — Link Cloud Server
- **Command ID:** `aidimag.cloudLink`
- **Title:** `aidimag: Link Cloud Server`
- **CLI:** `dim cloud link`
- **Implementation:** Run in terminal (interactive — prompts for server URL, brain ID, token)
- **Menu placement:** Brain menu → "Team & tickets" section, before "Sync Team Memory"
- **IntelliJ parity:** New action `CloudLinkAction` under Tools → aidimag

#### 5. `aidimag.cloudStatus` — Cloud Sync Status
- **Command ID:** `aidimag.cloudStatus`
- **Title:** `aidimag: Cloud Sync Status`
- **CLI:** `dim cloud status`
- **Implementation:** Run on background thread, show in output channel
- **Menu placement:** Brain menu → "Team & tickets" section, after "Sync Team Memory"
- **IntelliJ parity:** New action `CloudStatusAction` under Tools → aidimag

### Changes to Existing Commands

#### 6. `aidimag.connectTickets` — Update Description
- **Current title:** `aidimag: Connect Ticketing App (Jira, GitHub, Linear…)`
- **New title:** `aidimag: Connect Ticketing App (Jira, GitHub, Linear, GitLab, Azure DevOps, ClickUp, Shortcut, YouTrack, Asana, Trello, Notion, Pivotal Tracker…)`
- **Reason:** 9 new providers added in 2.0.0
- **Also:** The `connectTickets()` function currently opens a terminal. Consider adding a post-connect notification that mentions per-repo credential storage and the `AIDIMAG_TICKET_TOKEN` env var.

#### 7. `aidimag.showTicket` — Add "Show Ticket" to Brain Menu
- **Current:** Registered as a command but NOT in the brain menu quick-pick
- **Change:** Add to brain menu → "Team & tickets" section
- **IntelliJ parity:** Already has `ShowTicket` action in the status bar popup menu but NOT in the Tools menu group. Add it there too.

### Brain Menu Restructure

The "Team & tickets" section should be restructured to reflect the full ticketing workflow:

```
Team & tickets
  ☁ Link Cloud Server          (NEW — dim cloud link)
  ☁ Cloud Sync Status          (NEW — dim cloud status)
  ☁ Sync Team Memory           (existing — dim sync)
  🔑 Login (approve device)    (existing)
  🔌 Connect Ticketing App     (existing — updated description)
  📋 Ticket Status             (NEW — dim ticket status)
  🎫 Show Ticket               (MOVED — already a command, add to menu)
  🌿 Create Ticket Branch      (existing)
  📏 Manage Branch Naming Rule (NEW — dim ticket branch-rule)
  🔗 Share Ticket Credentials  (NEW — dim ticket share)
```

### Configuration Changes

#### 8. New Setting: `aidimag.ticketTokenEnvHint`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** "Show a hint after connecting tickets that the `AIDIMAG_TICKET_TOKEN` environment variable can override the stored credential"
- **Reason:** 2.0.0 introduces `AIDIMAG_TICKET_TOKEN` env var support

### package.json Changes Summary

Add to `contributes.commands`:
```json
{ "command": "aidimag.shareTickets", "title": "aidimag: Share Ticket Credentials with Team" },
{ "command": "aidimag.ticketStatus", "title": "aidimag: Ticket Status" },
{ "command": "aidimag.ticketBranchRule", "title": "aidimag: Manage Branch Naming Rule" },
{ "command": "aidimag.cloudLink", "title": "aidimag: Link Cloud Server" },
{ "command": "aidimag.cloudStatus", "title": "aidimag: Cloud Sync Status" }
```

Add to `contributes.configuration.properties`:
```json
"aidimag.ticketTokenEnvHint": {
  "type": "boolean",
  "default": true,
  "description": "Show a hint after connecting tickets that the AIDIMAG_TICKET_TOKEN environment variable can override the stored credential"
}
```

Update `showBrainMenu()` items array — "Team & tickets" section.

Register new commands in `activate()`.

### Version Bump
- Current: `1.1.1`
- New: `2.0.0`

---

## IntelliJ Plugin (`aidimag-intellij`)

### New Actions Needed

#### 1. `ShareTicketsAction` — Share Ticket Credentials
- **Action ID:** `Aidimag.ShareTickets`
- **Class:** `com.aidimag.intellij.actions.ShareTicketsAction`
- **Text:** `Share Ticket Credentials with Team`
- **Description:** `Share your ticket credential via the sync server so teammates can connect via Remote mode with zero local credentials`
- **CLI:** `dim ticket share`
- **Implementation:** Run in terminal (interactive)
- **Menu placement:** Tools → aidimag, after "Connect Ticketing App"

#### 2. `TicketStatusAction` — Ticket Connection Status
- **Action ID:** `Aidimag.TicketStatus`
- **Class:** `com.aidimag.intellij.actions.TicketStatusAction`
- **Text:** `Ticket Status`
- **Description:** `Show the currently connected ticketing provider, base URL, and pattern`
- **CLI:** `dim ticket status`
- **Implementation:** Run on background thread, show in dialog
- **Menu placement:** Tools → aidimag, after "Connect Ticketing App"

#### 3. `TicketBranchRuleAction` — Manage Branch Naming Convention
- **Action ID:** `Aidimag.TicketBranchRule`
- **Class:** `com.aidimag.intellij.actions.TicketBranchRuleAction`
- **Text:** `Manage Branch Naming Rule`
- **Description:** `Set or update the branch-naming convention (pattern + enforcement level: off / warn / push)`
- **CLI:** `dim ticket branch-rule`
- **Implementation:** Run in terminal (interactive)
- **Menu placement:** Tools → aidimag, after "Create Ticket Branch"

#### 4. `CloudLinkAction` — Link Cloud Server
- **Action ID:** `Aidimag.CloudLink`
- **Class:** `com.aidimag.intellij.actions.CloudLinkAction`
- **Text:** `Link Cloud Server`
- **Description:** `Connect to a self-hosted or cloud.aidimag.com sync server (enter server URL, brain ID, and token)`
- **CLI:** `dim cloud link`
- **Implementation:** Run in terminal (interactive)
- **Menu placement:** Tools → aidimag, before "Sync Team Memory"

#### 5. `CloudStatusAction` — Cloud Sync Status
- **Action ID:** `Aidimag.CloudStatus`
- **Class:** `com.aidimag.intellij.actions.CloudStatusAction`
- **Text:** `Cloud Sync Status`
- **Description:** `Show the linked server, brain ID, and token status`
- **CLI:** `dim cloud status`
- **Implementation:** Run on background thread, show in dialog
- **Menu placement:** Tools → aidimag, after "Sync Team Memory"

### Changes to Existing Actions

#### 6. `ConnectTicketsAction` — Update Description
- **Current text:** `Connect Ticketing App`
- **New text:** `Connect Ticketing App (12+ Providers)`
- **New description:** `Connect Jira, GitHub Issues, Linear, GitLab Issues, Azure DevOps, ClickUp, Shortcut, YouTrack, Asana, Trello, Notion, Pivotal Tracker, a custom HTTP provider, or the team sync server (Remote). Credentials are stored per-repo.`
- **Reason:** 9 new providers + per-repo credential storage in 2.0.0

#### 7. `ShowTicketAction` — Add to Tools Menu
- **Current:** Registered in `plugin.xml` actions group AND in the status bar popup menu
- **Status:** Already present in Tools → aidimag. No change needed.

### plugin.xml Changes

Add to `<actions>` → `<group id="Aidimag.Group">`:

```xml
<!-- Cloud section (new separator + actions before Sync) -->
<separator/>
<action id="Aidimag.CloudLink" class="com.aidimag.intellij.actions.CloudLinkAction" text="Link Cloud Server"
        description="Connect to a self-hosted or cloud.aidimag.com sync server"/>
<action id="Aidimag.CloudStatus" class="com.aidimag.intellij.actions.CloudStatusAction" text="Cloud Sync Status"
        description="Show the linked server, brain ID, and token status"/>

<!-- Ticket section additions (after existing ticket actions) -->
<action id="Aidimag.TicketStatus" class="com.aidimag.intellij.actions.TicketStatusAction" text="Ticket Status"
        description="Show the currently connected ticketing provider, base URL, and pattern"/>
<action id="Aidimag.ShareTickets" class="com.aidimag.intellij.actions.ShareTicketsAction" text="Share Ticket Credentials"
        description="Share your ticket credential via the sync server so teammates connect via Remote with zero local credentials"/>
<action id="Aidimag.TicketBranchRule" class="com.aidimag.intellij.actions.TicketBranchRuleAction" text="Manage Branch Naming Rule"
        description="Set or update the branch-naming convention (pattern + enforcement: off / warn / push)"/>
```

### Status Bar Popup Menu (`MemoryStatusWidget.kt`)

Update `buildMenu()` — the "Team & Tickets" section:

```kotlin
group.add(Separator.create("Team & Tickets"))
add("Aidimag.CloudLink", AllIcons.General.Settings)          // NEW
add("Aidimag.CloudStatus", AllIcons.Nodes.Cloud)             // NEW
add("Aidimag.Sync", AllIcons.Actions.Refresh)
add("Aidimag.Login", AllIcons.General.User)
add("Aidimag.ConnectTickets", AllIcons.Vcs.Vendors.Github)
add("Aidimag.TicketStatus", AllIcons.Actions.Info)           // NEW
add("Aidimag.ShowTicket", AllIcons.Actions.Find)             // NEW — already registered, just add to popup
add("Aidimag.TicketBranch", AllIcons.Vcs.Branch)
add("Aidimag.TicketBranchRule", AllIcons.Actions.Edit)       // NEW
add("Aidimag.ShareTickets", AllIcons.Actions.Share)          // NEW
```

### New Kotlin Files to Create

1. `src/main/kotlin/com/aidimag/intellij/actions/ShareTicketsAction.kt`
2. `src/main/kotlin/com/aidimag/intellij/actions/TicketStatusAction.kt`
3. `src/main/kotlin/com/aidimag/intellij/actions/TicketBranchRuleAction.kt`
4. `src/main/kotlin/com/aidimag/intellij/actions/CloudLinkAction.kt`
5. `src/main/kotlin/com/aidimag/intellij/actions/CloudStatusAction.kt`

### Version Bump
- Current: check `build.gradle.kts` or `gradle.properties`
- New: `2.0.0`

---

## Shared Concerns (Both Extensions)

### Per-Repo Credential Storage Messaging

Both extensions should surface a notification after `dim ticket connect` succeeds:
- "Ticket credentials stored per-repo in `.aidimag/config.json`. Set `AIDIMAG_TICKET_TOKEN` env var to override."

### Remote Provider Awareness

When a cloud server is linked and team tickets are shared, the dashboard already shows a "Connect now" button. The IDE extensions should consider:
- Showing a notification when team tickets are detected: "Team is using Jira (remote) — click to connect"
- Adding a "Connect via Remote" quick action in the brain menu / Tools menu

### Updated Provider List

Both extensions should update any UI text, descriptions, or quick-pick options that reference ticket providers to include the full 2.0.0 list:
Jira, GitHub Issues, Linear, GitLab Issues, Azure DevOps, ClickUp, Shortcut, YouTrack, Asana, Trello, Notion, Pivotal Tracker, HTTP, Remote.

### `AIDIMAG_TICKET_TOKEN` Environment Variable

Both extensions should document or hint at the `AIDIMAG_TICKET_TOKEN` environment variable in their settings/configuration descriptions, since it takes precedence over `tickets.token` in config.

---

## Summary Table

| Change | VS Code | IntelliJ | Priority |
|---|---|---|---|
| Share Ticket Credentials command | NEW | NEW | High |
| Ticket Status command | NEW | NEW | High |
| Branch Naming Rule command | NEW | NEW | Medium |
| Cloud Link command | NEW | NEW | High |
| Cloud Status command | NEW | NEW | Medium |
| Update Connect Tickets description | UPDATE | UPDATE | Medium |
| Add Show Ticket to brain menu | ADD TO MENU | Already present | Low |
| Restructure Team & Tickets menu section | RESTRUCTURE | RESTRUCTURE | Medium |
| Per-repo credential storage notification | NEW | NEW | Low |
| Remote provider auto-discovery notification | FUTURE | FUTURE | Low |
| Version bump to 2.0.0 | YES | YES | Required |
