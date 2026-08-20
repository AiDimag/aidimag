# Release v2.0.0

## Overview

A major release focused on team collaboration, ticketing integration, UI polish, and icon modernization. This version introduces remote ticket proxying, a redesigned dashboard with Iconify-based icons, and significant improvements to the ticket configuration modal.

---

## Features

### Ticketing Integration

- **Remote ticket provider**: Team members can now connect to a shared ticket provider (Jira, GitHub, Linear, etc.) via the cloud server without holding any credentials locally. The admin stores credentials on the server; teammates simply select "Remote (team server)" and connect.
- **Team ticket auto-discovery**: When a cloud server is linked and the admin has shared ticket credentials, the dashboard automatically detects and displays the team's ticket provider with a "Connect now" button.
- **Ticket config sync**: `teamTickets` is now fetched from the server when connected via remote, so the UI shows the actual team provider (e.g., Jira) instead of a generic cloud icon.
- **Separate Validate button**: The "Validate with a real ticket id" feature is now a standalone button with inline success/error feedback, decoupled from the Connect button.
- **New `/api/tickets/validate` endpoint**: Tests a ticket ID against the current provider config without requiring a full connect cycle.
- **Graceful error handling**: When team ticket credentials are removed from the server, users see a clear message: "Team ticket credentials were removed from the server — ask your admin to reconfigure."
- **Additional ticket providers**: Added support for GitLab, Azure DevOps, ClickUp, Shortcut, YouTrack, Asana, Trello, Notion, and Pivotal Tracker.

### UI & Dashboard

- **Iconify icon migration**: Replaced all custom inline SVG icons for providers and agents with Iconify icons managed centrally in `icons.config.json`. Added 67+ icons including Jira, GitHub, Linear, Claude, Cursor, Copilot, Windsurf, MCP, Ollama, and more.
- **Folder icon on memory cards**: Replaced the folder emoji with an Iconify `fluent-emoji-flat:open-file-folder` icon on individual memory cards in the overview.
- **Health page icons**: Added icons to each widget in the Memory Summary section (Total Memories, Verified, Unverified, Stale, Refuted, Failed Approaches, Pending Proposals, Pinned, Coverage Paths).
- **Tickets stat card simplified**: Now shows just the provider logo + "linked" or "off" text, matching the clean style of other stat cards.
- **Team sync stat card**: Shows the proprietary aidimag logo when connected to `cloud.aidimag.com`, and `IC_BRAIN` for other servers.
- **Dropdown overflow fix**: The provider dropdown menu in the ticket modal now uses `position: fixed` and is rendered at the body level, preventing modal scrollbar issues.
- **Modal close button**: Added an X close button to the top-right corner of the Tickets modal.
- **Disabled fields for remote**: When connected via remote, the provider dropdown, sample ticket IDs, ticket ID pattern, infer pattern button, validate button, and validate ticket ID field are all disabled.
- **Remote provider display**: When connected via remote, the modal and stat card show the actual team provider's logo and name (e.g., "Jira (remote)") instead of a generic cloud icon.

### Cloud & Sync

- **AWS Bedrock support**: Added AWS Bedrock as a text and embedding provider.
- **Hermes Agent integration**: Native Hermes Agent memory-provider integration.
- **Integration panel**: New panel in the Actions tab showing MCP status, agent config detection, Hermes status, and registry links.
- **Auto-sync**: Server-side auto-sync every 10 minutes (configurable via `AIDIMAG_AUTOSYNC_MINUTES`).

### Capture & Mining

- **Chat transcript harvesting**: Multi-source harvesting from Claude Code, Codex, Copilot, and Cursor transcripts.
- **PR miner**: New pull request mining capability.
- **Bootstrap survey**: LLM-powered repo survey for initial memory proposals.
- **Commit miner improvements**: Enhanced commit mining with better extraction logic.

### MCP

- **`chat_harvest` tool**: New MCP tool for harvesting chat transcripts.
- **Schema descriptions**: Added missing schema descriptions on MCP tool parameters.
- **Glama listing**: Claimed MCP server listing on Glama with Dockerfile for introspection.

### Documentation

- **Comprehensive docs update**: Rewritten homepage with hero, problem/solution framing, staleness demo, benchmarks, and CLI examples.
- **New pages**: `why-aidimag.md`, `use-cases.md`, `dim-check` guide.
- **Modernized homepage**: Animated hero, Lucide icons, official integration logos, badge strip, quick links.
- **Updated CLI reference**: Expanded with 405+ lines of new documentation.

---

## Breaking Changes

- Version bumped to 2.0.0 to reflect the significant feature additions and UI overhaul.
- No breaking API changes — all existing CLI commands and MCP tools remain backward compatible.

---

## Technical Details

- **Icon management**: All provider/agent icons are now centralized in `src/ui/icons.config.json` with `IC_` constants, auto-generated via `npm run build`.
- **Ticket config proxying**: `GET /v1/ticket-config` and `GET /v1/ticket` endpoints on the cloud server enable remote ticket access.
- **Credential security**: Team credentials are encrypted (AES-256-GCM) and stored on the cloud server; team members never hold ticket credentials locally.
- **Dropdown positioning**: Uses `getBoundingClientRect()` for fixed positioning, with click-outside detection updated for the new DOM structure.

---

## Files Changed

- `src/ui/page.ts` — Major UI overhaul (1833+ lines changed)
- `src/ui/server.ts` — New endpoints, team ticket fetching, auto-sync
- `src/ui/icons.config.json` — 67 Iconify icon definitions
- `src/tickets/provider.ts` — Remote provider, 9 new provider adapters
- `src/cli/commands/tickets.ts` — CLI ticket command updates
- `src/sync/server.ts` — Cloud sync server enhancements
- `src/mcp/server.ts` — New MCP tools
- `src/db/schema.ts` / `src/db/store.ts` — Schema and store updates
- `package.json` — Version 2.0.0
- 58 files changed, 5357 insertions(+), 385 deletions(-)

---

## Upgrade Guide

1. `npm install -g aidimag@2.0.0`
2. Run `dim` — existing memories and config are preserved
3. If using cloud sync, link your server with `dim cloud link`
4. Admin can share ticket credentials via the dashboard or `dim ticket share`
5. Team members select "Remote (team server)" in the ticket modal to connect
