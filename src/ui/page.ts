/**
 * Dashboard HTML — embedded as a template string so `tsc` is the whole build
 * (no asset pipeline). D3 v7 from CDN renders the memory graph.
 */
import { ICONS_JS } from "./icons-generated.js";

export const PAGE_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>aiDimag — repo brain</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64' fill='none'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='8' y1='8' x2='56' y2='56' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0%25' stop-color='%232563eb'/%3E%3Cstop offset='55%25' stop-color='%230ea5e9'/%3E%3Cstop offset='100%25' stop-color='%2306b6d4'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='2' y='2' width='60' height='60' rx='16' fill='%232563eb' fill-opacity='0.12'/%3E%3Cg transform='translate(8 8) scale(2)' stroke='url(%23g)' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 18V5'/%3E%3Cpath d='M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4'/%3E%3Cpath d='M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5'/%3E%3Cpath d='M17.997 5.125a4 4 0 0 1 2.526 5.77'/%3E%3Cpath d='M18 18a4 4 0 0 0 2-7.464'/%3E%3Cpath d='M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517'/%3E%3Cpath d='M6 18a4 4 0 0 1-2-7.464'/%3E%3Cpath d='M6.003 5.125a4 4 0 0 0-2.526 5.77'/%3E%3C/g%3E%3Ccircle cx='49' cy='49' r='11' fill='%2310b981'/%3E%3Cpath d='M44 49.2l3.4 3.4L54.5 45' stroke='%23ffffff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<meta name="color-scheme" content="light dark">
<style>
  :root {
    --background: 210 40% 98%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --muted: 214 32% 94%;
    --muted-foreground: 215 16% 47%;
    --primary: 217 91% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 214 32% 94%;
    --border: 214 32% 91%;
    --ring: 199 89% 48%;
    --radius: 0.75rem;
    --surface-glow: 0 0 0 1px rgba(37, 99, 235, 0.08), 0 8px 32px rgba(37, 99, 235, 0.08);
    --verified: #22c55e;
    --unverified: #64748b;
    --stale: #eab308;
    --refuted: #ef4444;
    --path: #2563eb;
    --icon-stroke: #1e293b;
    --grad-highlight: #f8fafc;
  }
  .dark {
    --background: 222 47% 6%;
    --foreground: 210 40% 98%;
    --card: 222 47% 8%;
    --muted: 217 33% 14%;
    --muted-foreground: 215 20% 65%;
    --primary: 213 94% 68%;
    --primary-foreground: 222 47% 6%;
    --secondary: 217 33% 14%;
    --border: 217 33% 16%;
    --surface-glow: 0 0 0 1px rgba(96, 165, 250, 0.12), 0 8px 32px rgba(0, 0, 0, 0.35);
    --path: #60a5fa;
    --unverified: #94a3b8;
    --verified: #22c55e;
    --stale: #eab308;
    --refuted: #ef4444;
    --icon-stroke: #fff;
    --grad-highlight: #fff;
  }
  * { box-sizing: border-box; margin: 0; }
  html { color-scheme: light dark; }
  body {
    background-color: hsl(var(--background));
    background-image:
      radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.12) 0, transparent 50%),
      radial-gradient(at 100% 0%, rgba(14, 165, 233, 0.1) 0, transparent 50%),
      radial-gradient(at 50% 100%, rgba(6, 182, 212, 0.08) 0, transparent 50%);
    color: hsl(var(--foreground));
    font: 500 14px/1.5 "Space Grotesk", "Inter", ui-sans-serif, system-ui, sans-serif;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }
  html.dark body {
    background-image:
      radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.18) 0, transparent 50%),
      radial-gradient(at 100% 0%, rgba(14, 165, 233, 0.12) 0, transparent 50%),
      radial-gradient(at 50% 100%, rgba(6, 182, 212, 0.1) 0, transparent 50%);
  }
  header {
    display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap;
    padding: 10px 16px;
    border-bottom: 1px solid hsl(var(--border) / 0.6);
    background: hsl(var(--card) / 0.82);
    backdrop-filter: blur(16px);
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .logo { width: 32px; height: 32px; flex-shrink: 0; border-radius: 10px; }
  .brand-text { min-width: 0; }
  header h1 { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
  header .subtitle {
    display: block; font-size: 11px; font-weight: 500; color: hsl(var(--muted-foreground));
    white-space: normal; word-break: break-all; line-height: 1.3; max-width: 320px;
  }
  .pill {
    padding: 3px 10px; border-radius: 999px; font-size: 12px;
    border: 1px solid hsl(var(--border)); white-space: nowrap;
    background: hsl(var(--muted) / 0.6); color: hsl(var(--muted-foreground));
  }
  .pill b { font-weight: 600; color: hsl(var(--foreground)); }
  .spacer { flex: 1; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  button {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap;
    background: hsl(var(--secondary)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) - 2px);
    padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }
  button svg { width: 14px; height: 14px; flex: 0 0 auto; }
  button:hover:not(.primary) { background: hsl(var(--muted)); border-color: hsl(var(--primary) / 0.35); }
  button:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
  button.primary {
    background: hsl(var(--primary)); border-color: transparent;
    color: hsl(var(--primary-foreground));
  }
  button.primary:hover { opacity: 0.9; background: hsl(var(--primary)); border-color: transparent; }
  button.icon { padding: 8px; width: 36px; height: 36px; }
  button.danger:hover { background: color-mix(in srgb, var(--refuted) 12%, transparent); border-color: var(--refuted); }
  main { flex: 1; display: flex; min-height: 0; }
  #graph { flex: 1; min-width: 0; background: hsl(var(--background) / 0.35); position: relative; overflow: hidden; }
  #graph svg { display: block; }
  @keyframes dash-flow { to { stroke-dashoffset: -20; } }
  #graph-tip {
    position: absolute; pointer-events: none; display: none; z-index: 10;
    background: hsl(var(--card)); border: 1px solid hsl(var(--border) / 0.6);
    padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;
    color: hsl(var(--foreground)); max-width: 260px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  #graph-stats {
    position: absolute; top: 8px; right: 12px; z-index: 5;
    font-size: 11px; font-weight: 500; color: hsl(var(--muted-foreground));
    background: hsl(var(--card) / 0.7); backdrop-filter: blur(8px);
    padding: 4px 10px; border-radius: 6px; border: 1px solid hsl(var(--border) / 0.4);
    pointer-events: none;
  }
  aside {
    width: 460px; border-left: 1px solid hsl(var(--border) / 0.6);
    overflow-y: auto; padding: 16px;
    background: hsl(var(--card) / 0.55); backdrop-filter: blur(12px);
  }
  h2 { font-size: 14px; font-weight: 600; color: hsl(var(--foreground)); margin: 16px 0 10px; letter-spacing: -0.01em; }
  .card {
    background: hsl(var(--card) / 0.9);
    border: 1px solid hsl(var(--border) / 0.6);
    border-radius: var(--radius); padding: 12px 14px; margin-bottom: 10px;
    box-shadow: var(--surface-glow);
    transition: border-color 0.15s, transform 0.15s;
  }
  .card:hover { border-color: hsl(var(--primary) / 0.3); }
  .card .claim { font-size: 13px; margin-bottom: 6px; line-height: 1.5; }
  .card .meta { font-size: 11px; color: hsl(var(--muted-foreground)); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .card .meta span { display: inline-flex; align-items: center; gap: 4px; }
  .card .meta svg, .card .meta img { width: 14px; height: 14px; flex-shrink: 0; vertical-align: middle; }
  .badge { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; border: 1px solid transparent; }
  .badge.VERIFIED { background: color-mix(in srgb, var(--verified) 15%, transparent); color: var(--verified); }
  .badge.UNVERIFIED { background: color-mix(in srgb, var(--unverified) 15%, transparent); color: var(--unverified); }
  .badge.STALE { background: color-mix(in srgb, var(--stale) 15%, transparent); color: var(--stale); }
  .badge.REFUTED { background: color-mix(in srgb, var(--refuted) 15%, transparent); color: var(--refuted); }
  .kind { font-weight: 500; }
  .actions { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
  .actions button { display: inline-flex; align-items: center; gap: 4px; }
  .actions button svg, .actions button img { width: 14px; height: 14px; flex-shrink: 0; }
  .evidence { font-size: 11px; color: hsl(var(--muted-foreground)); font-family: ui-monospace, monospace; margin-top: 4px; word-break: break-all; }
  .legend {
    display: flex; gap: 14px; flex-wrap: wrap; padding: 8px 16px; font-size: 11px;
    color: hsl(var(--muted-foreground)); border-top: 1px solid hsl(var(--border) / 0.6);
    background: hsl(var(--card) / 0.65); backdrop-filter: blur(12px);
  }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }
  .licn { width: 14px; height: 14px; margin-right: 4px; vertical-align: -2px; flex-shrink: 0; }
  #toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    padding: 10px 18px;
    border-radius: var(--radius); display: none; font-size: 13px; font-weight: 500; z-index: 99999;
    box-shadow: var(--surface-glow); max-width: 80vw;
    border-left: 4px solid hsl(var(--border));
    background: hsl(var(--card)); color: hsl(var(--foreground));
    pointer-events: none;
  }
  #toast.toast-success { background: hsl(142 69% 35% / 0.95); color: #fff; border-left-color: hsl(142 69% 25%); }
  #toast.toast-error   { background: hsl(0 72% 42% / 0.95); color: #fff; border-left-color: hsl(0 72% 30%); }
  #toast.toast-warning { background: hsl(38 92% 45% / 0.95); color: #1a1a1a; border-left-color: hsl(38 92% 35%); }
  #toast.toast-info    { background: hsl(217 91% 50% / 0.95); color: #fff; border-left-color: hsl(217 91% 38%); }
  #toast.toast-loading { background: hsl(var(--card)); color: hsl(var(--foreground)); border-left-color: hsl(var(--primary)); }
  .empty { color: hsl(var(--muted-foreground)); font-size: 12px; padding: 8px 0; display: flex; align-items: center; gap: 6px; }
  * { scrollbar-width: thin; scrollbar-color: hsl(var(--border)) transparent; }
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
  *::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); background-clip: padding-box; }
  svg text { fill: hsl(var(--muted-foreground)); font-size: 10px; pointer-events: none; }
  dialog {
    background: hsl(var(--card)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border) / 0.6);
    border-radius: calc(var(--radius) + 2px); padding: 20px; width: 480px; max-width: 92vw;
    box-shadow: var(--surface-glow); margin: auto; max-height: 90vh; overflow-y: auto;
  }
  dialog::backdrop { background: rgba(0,0,0,.55); backdrop-filter: blur(4px); }
  dialog h3 { font-size: 15px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.02em; display: flex; align-items: center; gap: 6px; }
  dialog h3 svg { width: 20px; height: 20px; flex-shrink: 0; }
  dialog h3 img { width: 20px; height: 20px; flex-shrink: 0; }
  dialog label {
    display: block; font-size: 12px; color: hsl(var(--muted-foreground));
    margin: 12px 0 4px; font-weight: 500;
  }
  dialog label.checkbox { display: flex; align-items: center; gap: 6px; font-weight: 400; }
  dialog label.checkbox input { width: auto; margin: 0; }
  dialog input, dialog select, dialog textarea {
    width: 100%; background: hsl(var(--background)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) - 2px);
    padding: 8px 10px; font-size: 13px; font-family: inherit;
  }
  dialog input:focus, dialog select:focus, dialog textarea:focus {
    outline: 2px solid hsl(var(--ring)); outline-offset: 1px; border-color: transparent;
  }
  dialog textarea { min-height: 64px; resize: vertical; }
  .tk-dropdown { position: relative; }
  .tk-dropdown-trigger {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: hsl(var(--background)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) - 2px);
    padding: 8px 10px; font-size: 13px; font-family: inherit; cursor: pointer; text-align: left;
  }
  .tk-dropdown-trigger:focus { outline: 2px solid hsl(var(--ring)); outline-offset: 1px; border-color: transparent; }
  .tk-dropdown-trigger:disabled { opacity: 0.6; cursor: not-allowed; }
  .tk-dropdown-trigger svg { flex-shrink: 0; opacity: 0.6; }
  .tk-dropdown-menu {
    position: absolute; top: 100%; left: 0; width: 100%; z-index: 10001;
    background: hsl(var(--card)); border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) - 2px); box-shadow: var(--surface-glow);
    overflow: hidden; max-height: 280px; overflow-y: auto;
  }
  .tk-dropdown-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 13px;
    cursor: pointer; transition: background 0.1s;
  }
  .tk-dropdown-item:hover { background: hsl(var(--primary) / 0.1); }
  .tk-dropdown-item svg { flex-shrink: 0; }
  .dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .ev-row { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .ev-row select { width: 160px; }
  .searchbar { display: flex; gap: 6px; margin-bottom: 10px; }
  .searchbar input {
    flex: 1; background: hsl(var(--background)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) - 2px);
    padding: 8px 10px; font-size: 13px;
  }
  .searchbar input:focus { outline: 2px solid hsl(var(--ring)); outline-offset: 1px; border-color: transparent; }
  .searchbar select {
    background: hsl(var(--background)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) - 2px);
    font-size: 12px; padding: 6px 8px;
  }
  /* Custom kind dropdown */
  .kind-dropdown { position: relative; display: inline-block; }
  .kind-dropdown-trigger {
    display: flex; align-items: center; gap: 6px;
    background: hsl(var(--background)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) - 2px);
    font-size: 12px; padding: 6px 10px; cursor: pointer; min-width: 160px;
    user-select: none;
  }
  .kind-dropdown-trigger svg, .kind-dropdown-trigger img { width: 16px; height: 16px; flex-shrink: 0; }
  .kind-dropdown-trigger .kind-caret { margin-left: auto; font-size: 10px; color: hsl(var(--muted-foreground)); }
  .kind-dropdown-menu {
    position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
    background: hsl(var(--card)); border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) - 2px); box-shadow: var(--surface-glow);
    max-height: 280px; overflow-y: auto; display: none; margin-top: 2px;
  }
  .kind-dropdown-menu.open { display: block; }
  .kind-dropdown-item {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 10px; cursor: pointer; font-size: 12px;
    border-bottom: 1px solid hsl(var(--border) / 0.4);
  }
  .kind-dropdown-item:last-child { border-bottom: none; }
  .kind-dropdown-item:hover { background: hsl(var(--primary) / 0.08); }
  .kind-dropdown-item.selected { background: hsl(var(--primary) / 0.12); }
  .kind-dropdown-item svg, .kind-dropdown-item img { width: 16px; height: 16px; flex-shrink: 0; }
  .kind-dropdown-item .kind-label { font-weight: 500; }
  .keyrow {
    font-size: 11px; font-family: ui-monospace, monospace;
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0; border-bottom: 1px solid hsl(var(--border));
  }
  .keyrow svg { width: 14px; height: 14px; flex-shrink: 0; }
  .hint { font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 6px; line-height: 1.5; }
  .theme-icon-sun { display: none; }
  html:not(.dark) .theme-icon-sun { display: block; }
  html:not(.dark) .theme-icon-moon { display: none; }
  html.dark .theme-icon-sun { display: none; }
  html.dark .theme-icon-moon { display: block; }

  /* ---------------------------------------------------------- tabs */
  .tabs {
    display: flex; gap: 4px; padding: 4px;
    background: hsl(var(--muted) / 0.55);
    border: 1px solid hsl(var(--border) / 0.7);
    border-radius: 999px;
  }
  .tab {
    border: none; background: transparent; color: hsl(var(--muted-foreground));
    padding: 6px 16px; border-radius: 999px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .tab:hover { background: hsl(var(--card) / 0.7); color: hsl(var(--foreground)); border-color: transparent; }
  .tab.active {
    background: hsl(var(--card)); color: hsl(var(--foreground));
    box-shadow: 0 1px 4px rgba(0,0,0,0.12), 0 0 0 1px hsl(var(--border) / 0.8);
  }
  .tab .tab-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 17px; height: 17px; padding: 0 5px; margin-left: 6px;
    border-radius: 999px; font-size: 10px; font-weight: 700;
    background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
  }
  body.tab-actions #view-overview, body.tab-actions .legend, body.tab-actions #toolbar-overview { display: none; }
  body:not(.tab-actions) #view-actions { display: none; }
  body.tab-health #view-overview, body.tab-health .legend, body.tab-health #toolbar-overview { display: none; }
  body:not(.tab-health) #view-health { display: none; }
  body.tab-health #view-actions { display: none; }
  body.tab-areas #view-overview, body.tab-areas .legend, body.tab-areas #toolbar-overview { display: none; }
  body.tab-areas #view-actions { display: none; }
  body.tab-areas #view-health { display: none; }
  body:not(.tab-areas) #view-areas { display: none; }

  /* ---------------------------------------------------------- health view */
  #view-health { flex: 1; overflow-y: auto; padding: 24px clamp(16px, 5vw, 56px) 56px; }
  .health-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .health-card { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: var(--radius); padding: 16px; }
  .health-card .label { font-size: 12px; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .health-card .label svg, .health-card .label img { width: 16px; height: 16px; flex-shrink: 0; }
  .health-card .value { font-size: 28px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
  .health-card .detail { font-size: 12px; color: hsl(var(--muted-foreground)); margin-top: 4px; }
  .health-card.warning .value { color: var(--stale); }
  .health-card.danger .value { color: var(--refuted); }
  .health-card.good .value { color: var(--verified); }
  .risk-bar { height: 8px; border-radius: 4px; background: hsl(var(--muted)); overflow: hidden; margin-top: 8px; }
  .risk-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .heatmap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-top: 12px; }
  .heatmap-cell { border-radius: 6px; padding: 10px; font-size: 12px; border: 1px solid hsl(var(--border)); }
  .heatmap-cell .path { font-weight: 600; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
  .heatmap-cell .stats { display: flex; gap: 8px; color: hsl(var(--muted-foreground)); }
  .heatmap-cell .stats span { font-size: 10px; }
  .trend-chart { display: flex; align-items: flex-end; gap: 3px; height: 80px; padding: 8px 0; margin-top: 8px; }
  .trend-bar { flex: 1; min-width: 4px; border-radius: 3px 3px 0 0; transition: height 0.3s ease; position: relative; cursor: pointer; }
  .trend-bar:hover { opacity: 0.8; }
  .trend-bar .tooltip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: hsl(var(--foreground)); color: hsl(var(--background)); padding: 4px 8px; border-radius: 4px; font-size: 10px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 10; }
  .trend-bar:hover .tooltip { opacity: 1; }
  .health-section { margin-bottom: 32px; }
  .health-section h3 { font-size: 16px; margin-bottom: 8px; }
  .health-suggestions { list-style: none; padding: 0; }
  .health-suggestions li { padding: 8px 12px; border-radius: 6px; background: hsl(var(--muted)); margin-bottom: 6px; font-size: 13px; }
  .suggestion-icon { margin-right: 6px; }

  /* ---------------------------------------------------------- actions view */
  #view-actions { flex: 1; overflow-y: auto; padding: 24px clamp(16px, 5vw, 56px) 56px; }
  .actions-hero { max-width: 1160px; margin: 0 auto 20px; }
  .actions-hero h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; letter-spacing: -0.03em; }
  .actions-hero p { font-size: 13px; color: hsl(var(--muted-foreground)); max-width: 640px; }

  /* ---------------------------------------------------------- areas view */
  #view-areas { flex: 1; overflow-y: auto; padding: 24px clamp(16px, 5vw, 56px) 56px; max-width: 900px; margin: 0 auto; }
  .status-strip {
    max-width: 1160px; margin: 0 auto 28px;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;
  }
  .stat {
    background: hsl(var(--card) / 0.9); border: 1px solid hsl(var(--border) / 0.6);
    border-radius: var(--radius); padding: 12px 14px; box-shadow: var(--surface-glow);
    position: relative;
  }
  .stat-connected-badge {
    position: absolute; top: 8px; right: 8px;
    display: flex; align-items: center; justify-content: center;
    z-index: 1;
  }
  .stat-connected-badge svg { width: 16px; height: 16px; }
  .stat .stat-icon { display: inline-flex; vertical-align: middle; margin-right: 5px; }
  .stat .stat-icon svg { width: 12px; height: 12px; }
  .stat .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: hsl(var(--muted-foreground)); display: flex; align-items: center; }
  .stat .stat-value { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-top: 2px; }
  .stat .stat-sub { font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stat.attention .stat-value { color: hsl(var(--primary)); }
  .stat-clickable { cursor: pointer; transition: border-color 0.15s; }
  .stat-clickable:hover { border-color: hsl(var(--primary) / 0.5); }

  .action-groups { max-width: 1160px; margin: 0 auto; display: flex; flex-direction: column; gap: 30px; }

  /* integration panel */
  #integration-panel { max-width: 100%; margin: 0; }
  .ip-card { background: hsl(var(--card) / 0.9); border: 1px solid hsl(var(--border) / 0.6); border-radius: var(--radius); padding: 18px 20px; box-shadow: var(--surface-glow); }
  .ip-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; }
  .ip-head .ip-icon { font-size: 18px; }
  .ip-head h3 { margin: 0; font-size: 15px; font-weight: 700; }
  .ip-head .ip-sub { font-size: 12px; color: hsl(var(--muted-foreground)); }
  .ip-section { margin-bottom: 14px; }
  .ip-section:last-child { margin-bottom: 0; }
  .ip-label { font-size: 12px; font-weight: 600; color: hsl(var(--muted-foreground)); margin-bottom: 4px; }
  .ip-hint { font-size: 11px; color: hsl(var(--muted-foreground)); font-weight: 400; }
  .ip-cmd-row { display: flex; align-items: center; gap: 8px; }
  .ip-cmd-row code { font-size: 12px; background: hsl(var(--muted) / 0.4); padding: 3px 8px; border-radius: 4px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ip-snippet { font-size: 12px; background: hsl(var(--muted) / 0.4); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 4px 0 6px; line-height: 1.5; }
  .ip-copy { font-size: 11px; padding: 3px 10px; border: 1px solid hsl(var(--border) / 0.6); border-radius: 4px; background: hsl(var(--card)); color: hsl(var(--foreground)); cursor: pointer; white-space: nowrap; }
  .ip-copy:hover { border-color: hsl(var(--primary) / 0.5); }
  .ip-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
  .ip-table th { text-align: left; padding: 4px 8px; font-weight: 600; color: hsl(var(--muted-foreground)); border-bottom: 1px solid hsl(var(--border) / 0.4); }
  .ip-table td { padding: 4px 8px; border-bottom: 1px solid hsl(var(--border) / 0.2); }
  .ip-table code { font-size: 11px; }
  .ip-ok { color: hsl(142 71% 45%); font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
  .ip-ok svg { width: 16px; height: 16px; flex-shrink: 0; }
  .ip-off { color: hsl(var(--muted-foreground)); font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
  .ip-off svg { width: 16px; height: 16px; flex-shrink: 0; }
  .ip-registry { font-size: 12px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .ip-reg-name { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: hsl(var(--muted) / 0.4); padding: 2px 8px; border-radius: 4px; }
  .ip-registry a { color: hsl(var(--primary)); text-decoration: none; font-size: 12px; }
  .ip-registry a:hover { text-decoration: underline; }
  .action-group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .action-group-head .g-icon { display: flex; align-items: center; }
  .action-group-head .g-icon svg { width: 20px; height: 20px; }
  .action-group-head h3 { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
  .action-group-head .g-sub { font-size: 12px; color: hsl(var(--muted-foreground)); }
  .action-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
  .action-card {
    position: relative; text-align: left; display: flex; flex-direction: column; align-items: stretch; gap: 6px;
    background: hsl(var(--card) / 0.9); border: 1px solid hsl(var(--border) / 0.6);
    border-radius: var(--radius); padding: 14px 15px 13px; cursor: pointer;
    box-shadow: var(--surface-glow); white-space: normal; font: inherit; color: hsl(var(--foreground));
    transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  }
  .action-card:hover {
    border-color: hsl(var(--primary) / 0.45); transform: translateY(-1px); background: hsl(var(--card));
    box-shadow: 0 0 0 1px hsl(var(--primary) / 0.15), 0 12px 32px rgba(37, 99, 235, 0.14);
  }
  .action-card:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
  .action-card[aria-disabled="true"] { opacity: 0.55; cursor: not-allowed; transform: none; }
  .action-card .ac-top { display: flex; align-items: center; gap: 9px; }
  .action-card .ac-icon {
    width: 30px; height: 30px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
    border-radius: 9px; font-size: 15px;
    background: linear-gradient(135deg, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.05));
    border: 1px solid hsl(var(--primary) / 0.18);
  }
  .action-card.danger .ac-icon { background: color-mix(in srgb, var(--refuted) 12%, transparent); border-color: color-mix(in srgb, var(--refuted) 25%, transparent); }
  .action-card .ac-icon svg { width: 18px; height: 18px; }
  .action-card .ac-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; flex: 1; min-width: 0; }
  .action-card .ac-desc { font-size: 11.5px; line-height: 1.45; color: hsl(var(--muted-foreground)); }
  .action-card .ac-badge {
    min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
    background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
  }
  .action-card .ac-cli {
    font-size: 10px; font-family: ui-monospace, monospace; color: hsl(var(--muted-foreground) / 0.85);
    background: hsl(var(--muted) / 0.55); border-radius: 6px; padding: 2px 7px; align-self: flex-start;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .action-card .ac-copy {
    cursor: pointer; opacity: 0.5; font-size: 11px; line-height: 1; padding: 1px;
    transition: opacity 0.15s;
  }
  .action-card .ac-copy:hover { opacity: 1; }
  .action-card .ac-term {
    font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--stale); border: 1px solid color-mix(in srgb, var(--stale) 40%, transparent);
    border-radius: 5px; padding: 1px 5px;
  }
  .action-card.busy { pointer-events: none; }
  .action-card.busy .ac-icon { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.4; } }
  .spinner {
    display: inline-block; width: 16px; height: 16px;
    border: 2px solid hsl(var(--muted-foreground) / 0.3);
    border-top-color: hsl(var(--primary));
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
  }
  .spinner-lg { width: 28px; height: 28px; border-width: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-overlay {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 24px; text-align: center;
  }

  /* ---------------------------------------------------------- help tooltip */
  .help {
    flex: 0 0 auto; width: 17px; height: 17px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; cursor: help; position: relative;
    color: hsl(var(--muted-foreground)); border: 1px solid hsl(var(--border));
    background: hsl(var(--muted) / 0.5);
  }
  .help:hover, .help:focus-visible { color: hsl(var(--primary)); border-color: hsl(var(--primary) / 0.5); }
  .help::after {
    content: attr(data-tip);
    position: absolute; bottom: calc(100% + 8px); right: -8px; z-index: 60;
    width: 280px; padding: 9px 11px;
    background: hsl(var(--card)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: 10px;
    font-size: 11.5px; font-weight: 400; line-height: 1.5; text-align: left; white-space: normal;
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
    opacity: 0; pointer-events: none; transform: translateY(4px);
    transition: opacity 0.12s, transform 0.12s;
  }
  .help:hover::after, .help:focus-visible::after { opacity: 1; transform: translateY(0); }

  /* ---------------------------------------------------------- output panel */
  #dlg-output { width: 640px; max-height: 80vh; display: none; flex-direction: column; }
  #dlg-output[open] { display: flex; }
  #dlg-output .out-body {
    flex: 1; overflow-y: auto; margin-top: 10px;
    background: hsl(var(--background) / 0.6); border: 1px solid hsl(var(--border) / 0.7);
    border-radius: calc(var(--radius) - 2px); padding: 12px 14px;
    font-size: 12.5px; line-height: 1.6;
  }
  #dlg-output .out-body pre { white-space: pre-wrap; word-break: break-word; font: 12px/1.6 ui-monospace, monospace; }
  #dlg-output .out-row { padding: 8px 0; border-bottom: 1px solid hsl(var(--border) / 0.5); display: flex; align-items: flex-start; gap: 6px; }
  #dlg-output .out-row svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
  #dlg-output .out-row .out-content { flex: 1; min-width: 0; }
  #dlg-output .out-row:last-child { border-bottom: none; }
  #dlg-output .out-body .empty svg, #dlg-output .out-body .empty img { width: 16px; height: 16px; flex-shrink: 0; }

  /* ---------------------------------------------------------- onboarding tour */
  #tour-backdrop {
    position: fixed; inset: 0; z-index: 100; pointer-events: none;
  }
  #tour-spotlight {
    position: absolute; border-radius: 8px;
    box-shadow: 0 0 0 9999px hsl(var(--background) / 0.82);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }
  #tour-spotlight::after {
    content: ""; position: absolute; inset: -4px;
    border: 2px solid hsl(var(--primary) / 0.6); border-radius: 10px;
    pointer-events: none;
  }
  #tour-tooltip {
    position: absolute; z-index: 101; max-width: 420px;
    background: hsl(var(--card)); border: 1px solid hsl(var(--border) / 0.6);
    border-radius: var(--radius); padding: 16px 18px;
    box-shadow: var(--surface-glow);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;
  }
  #tour-tooltip .tour-step-num {
    font-size: 11px; font-weight: 600; color: hsl(var(--primary));
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;
  }
  #tour-tooltip h3 { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
  #tour-tooltip p { font-size: 12.5px; color: hsl(var(--muted-foreground)); line-height: 1.55; margin: 0 0 14px; }
  #tour-tooltip .tour-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: nowrap; }
  #tour-tooltip .tour-dots { display: flex; gap: 3px; margin-right: auto; flex-shrink: 1; overflow: hidden; }
  #tour-tooltip .tour-dot { width: 6px; height: 6px; border-radius: 50%; background: hsl(var(--border)); transition: background 0.2s; flex-shrink: 0; }
  #tour-tooltip .tour-dot.active { background: hsl(var(--primary)); }
  #tour-tooltip .tour-actions button { padding: 6px 16px; font-size: 12px; }
  #tour-tooltip .tour-skip { background: transparent; border-color: transparent; color: hsl(var(--muted-foreground)); }
  #tour-tooltip .tour-skip:hover { color: hsl(var(--foreground)); }

</style>
<script>
(function () {
  var k = "aidimag-ui-theme";
  var saved = localStorage.getItem(k);
  if (saved === "dark") document.documentElement.classList.add("dark");
  else if (saved === "light") document.documentElement.classList.remove("dark");
  else if (window.matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.classList.add("dark");
})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
<header>
  <div class="brand">
    <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="dimGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2563eb"/><stop offset="55%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
        <linearGradient id="dimGradSoft" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2563eb" stop-opacity="0.18"/><stop offset="100%" stop-color="#06b6d4" stop-opacity="0.18"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#dimGradSoft)"/>
      <g transform="translate(8 8) scale(2)" stroke="url(#dimGrad)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/>
        <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/>
        <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/>
        <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/>
        <path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>
      </g>
      <circle cx="49" cy="49" r="11" fill="#10b981"/>
      <path d="M44 49.2l3.4 3.4L54.5 45" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
    <div class="brand-text">
      <h1>aiDimag</h1>
      <span class="subtitle" id="repo">Repo brain</span>
    </div>
  </div>
  <span class="pill" id="counts"></span>
  <nav class="tabs" role="tablist" aria-label="Dashboard views">
    <button class="tab active" id="tab-overview" role="tab" aria-selected="true" onclick="switchTab('overview')">Overview</button>
    <button class="tab" id="tab-health" role="tab" aria-selected="false" onclick="switchTab('health')">Health</button>
    <button class="tab" id="tab-actions" role="tab" aria-selected="false" onclick="switchTab('actions')">Actions<span class="tab-badge" id="tab-actions-badge" style="display:none"></span></button>
    <button class="tab" id="tab-areas" role="tab" aria-selected="false" onclick="switchTab('areas')">Areas</button>
  </nav>
  <div class="spacer"></div>
  <div class="toolbar" id="toolbar-overview">
  <button class="primary" onclick="document.getElementById('dlg-new').showModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>New Memory</button>
  <button onclick="runMine()" title="Mine new commits since the last run (Shift+click: rescan all history)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 18 9"/><path d="M2 22l8-8"/><path d="M20.5 7.5 22 6a2.83 2.83 0 0 0-4-4l-1.5 1.5"/><path d="m9 11 4 4"/><path d="M16 2 8.5 9.5"/></svg>Mine Commits</button>
  <button class="primary" onclick="runVerify(false)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>Verify</button>
  <button onclick="runSync()" id="btn-sync"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>Sync</button>
  </div>
  <button class="icon" type="button" onclick="toggleTheme()" id="btn-theme" aria-label="Toggle light/dark theme">
    <svg class="theme-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
    <svg class="theme-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
  </button>
</header>
<main id="view-overview">
  <div id="graph"><div id="graph-stats"></div><div id="graph-tip"></div></div>
  <aside>
    <h2 id="proposals-h">Pending proposals</h2>
    <div id="proposals"></div>
    <h2>Memories</h2>
    <div class="searchbar">
      <input id="q" placeholder="Search memories… (semantic when embeddings configured)" oninput="debouncedSearch()">
      <div class="kind-dropdown" id="q-kind-dd">
        <div class="kind-dropdown-trigger" onclick="kindDropdownToggle('q-kind-dd')">
          <span class="kind-trigger-icon"></span><span class="kind-trigger-label">all kinds</span><span class="kind-caret">▼</span>
        </div>
        <div class="kind-dropdown-menu"></div>
      </div>
      <input type="hidden" id="q-kind" value="">
    </div>
    <div id="memories"></div>
  </aside>
</main>

<!-- ============================================================ Health view -->
<div id="view-health" role="tabpanel" aria-labelledby="tab-health">
  <div class="actions-hero">
    <h2>Knowledge Health</h2>
    <p>Risk metrics, coverage heatmap, and trend charts for your project's AI memory.</p>
  </div>
  <div id="health-content"><div class="empty">Loading health data…</div></div>
</div>

<!-- ============================================================ Actions view -->
<div id="view-actions" role="tabpanel" aria-labelledby="tab-actions">
  <div class="actions-hero">
    <h2>Actions</h2>
    <p>Manage, review, verify, and sync your project's AI memory. Hover any <b>?</b> to learn what an action does before running it.</p>
  </div>
  <div class="status-strip" id="status-strip"></div>
  <div class="action-groups" id="action-groups"></div>
</div>

<!-- ============================================================ Critical Areas view -->
<div id="view-areas" role="tabpanel" aria-labelledby="tab-areas">
  <div class="actions-hero">
    <h2>Protected Code Areas</h2>
    <p>Define critical code boundaries that require owner approval, passing tests, or explicit approval tokens before changes are allowed.</p>
  </div>
  <div style="margin:16px 0;display:flex;gap:8px">
    <button class="primary" onclick="addAreaRow()">+ Add Area</button>
    <button onclick="saveAreas()" id="btn-save-areas">Save Changes</button>
    <span id="areas-status" style="color:var(--muted);align-self:center"></span>
  </div>
  <div id="areas-list"></div>
</div>

<!-- New memory dialog (dim remember) -->
<dialog id="dlg-new">
  <h3>＋ New memory</h3>
  <label>Claim (write it falsifiable — something a check could verify)</label>
  <textarea id="nm-claim" placeholder="All DB access goes through src/db/store.ts; nothing else imports better-sqlite3"></textarea>
  <label>Kind</label>
  <div class="kind-dropdown" id="nm-kind-dd">
    <div class="kind-dropdown-trigger" onclick="kindDropdownToggle('nm-kind-dd')">
      <span class="kind-trigger-icon"></span><span class="kind-trigger-label">DECISION</span><span class="kind-caret">▼</span>
    </div>
    <div class="kind-dropdown-menu"></div>
  </div>
  <input type="hidden" id="nm-kind" value="DECISION">
  <div id="guardrail-section" style="display:none;">
    <label>Guardrail Level</label>
    <select id="nm-guardrail-level">
      <option value="ask-first">Ask First - Confirm before doing it</option>
      <option value="always">Always - Block completely, refuse to proceed</option>
      <option value="never">Never - Just a suggestion</option>
    </select>
  </div>
  <label>Scope paths (comma-separated, empty = repo-wide)</label>
  <input id="nm-paths" placeholder="src/db, src/api/auth.ts">
  <label>Symbols (comma-separated, optional)</label>
  <input id="nm-symbols" placeholder="UserService, authenticate()">
  <label class="checkbox">
    <input type="checkbox" id="nm-pinned">
    Pin this memory (exempt from time decay)
  </label>
  <label>Evidence (optional but recommended)</label>
  <div id="nm-evidence"></div>
  <button style="margin-top:6px" onclick="addEvidenceRow()">＋ add evidence</button>
  <div class="hint">STATIC_CHECK: shell command, exit 0 = claim holds · COMMIT_REF: sha · EXEC_TRACE: cmd :: regex · TEST_RESULT: test cmd</div>
  <div class="dialog-actions">
    <button type="button" onclick="document.getElementById('dlg-new').close()">Cancel</button>
    <button type="button" class="primary" onclick="saveMemory()">Save memory</button>
  </div>
</dialog>

<!-- Cloud settings dialog (dim cloud link / dim keys) -->
<dialog id="dlg-cloud">
 <form>
  <h3>☁ Team sync</h3>
  <div id="cloud-status" class="hint"></div>
  <label>Server URL</label>
  <input id="cl-server" placeholder="http://localhost:3000">
  <label>Brain (team memory name)</label>
  <input id="cl-brain" placeholder="myrepo">
  <label>Access token (stored on this machine only, never in the repo)</label>
  <input id="cl-token" type="password" autocomplete="off" placeholder="aidimag_sk_…">
  <div class="dialog-actions">
    <button type="button" onclick="cloudUnlink()">Unlink</button>
    <button type="button" class="primary" onclick="cloudLink()">Link</button>
  </div>
 </form>
 <form>
  <h3 style="margin-top:18px">🔑 API keys (admin)</h3>
  <label>Admin token (used for this request only — not stored)</label>
  <input id="k-admin" type="password" autocomplete="off" placeholder="server admin token">
  <div class="ev-row">
    <input id="k-brain" placeholder="brain">
    <input id="k-label" placeholder="label (alice-laptop)">
    <button type="button" class="primary" onclick="keyCreate()">Create</button>
    <button type="button" onclick="keyList()">List</button>
  </div>
  <div id="keys-out"></div>
  <div class="dialog-actions">
    <button type="button" onclick="document.getElementById('dlg-cloud').close()">Close</button>
  </div>
 </form>
</dialog>

<!-- Tickets dialog (dim ticket connect / share) -->
<dialog id="dlg-tickets">
 <form>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <h3 style="margin:0">🎫 Tickets</h3>
    <button type="button" class="icon" onclick="document.getElementById('dlg-tickets').close()" style="padding:4px 8px" aria-label="Close">✕</button>
  </div>
  <div id="tk-status" class="hint"></div>
  <label>Provider</label>
  <div class="tk-dropdown" id="tk-provider-wrap">
    <button type="button" class="tk-dropdown-trigger" id="tk-provider-btn" onclick="tkDropdownToggle()">
      <span id="tk-provider-label">Jira</span>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
  <div class="tk-dropdown-menu" id="tk-provider-menu" style="display:none">
    <div class="tk-dropdown-item" data-value="jira" onclick="tkDropdownSelect('jira','Jira')">Jira</div>
    <div class="tk-dropdown-item" data-value="github" onclick="tkDropdownSelect('github','GitHub Issues')">GitHub Issues</div>
    <div class="tk-dropdown-item" data-value="linear" onclick="tkDropdownSelect('linear','Linear')">Linear</div>
    <div class="tk-dropdown-item" data-value="gitlab" onclick="tkDropdownSelect('gitlab','GitLab Issues')">GitLab Issues</div>
    <div class="tk-dropdown-item" data-value="azuredevops" onclick="tkDropdownSelect('azuredevops','Azure DevOps')">Azure DevOps</div>
    <div class="tk-dropdown-item" data-value="clickup" onclick="tkDropdownSelect('clickup','ClickUp')">ClickUp</div>
    <div class="tk-dropdown-item" data-value="shortcut" onclick="tkDropdownSelect('shortcut','Shortcut')">Shortcut</div>
    <div class="tk-dropdown-item" data-value="youtrack" onclick="tkDropdownSelect('youtrack','YouTrack')">YouTrack</div>
    <div class="tk-dropdown-item" data-value="asana" onclick="tkDropdownSelect('asana','Asana')">Asana</div>
    <div class="tk-dropdown-item" data-value="trello" onclick="tkDropdownSelect('trello','Trello')">Trello</div>
    <div class="tk-dropdown-item" data-value="notion" onclick="tkDropdownSelect('notion','Notion')">Notion</div>
    <div class="tk-dropdown-item" data-value="pivotal" onclick="tkDropdownSelect('pivotal','Pivotal Tracker')">Pivotal Tracker</div>
    <div class="tk-dropdown-item" data-value="http" onclick="tkDropdownSelect('http','HTTP middleware')">HTTP middleware (your own)</div>
    <div class="tk-dropdown-item" data-value="remote" onclick="tkDropdownSelect('remote','Remote')">Remote (team sync server — zero local credentials)</div>
  </div>
  </div>
  <input type="hidden" id="tk-provider" value="jira">
  <div id="tk-url-row">
    <label id="tk-url-label">Base URL</label>
    <input id="tk-url" placeholder="https://acme.atlassian.net">
  </div>
  <div id="tk-token-row">
    <label id="tk-token-label">Credential (stored on this machine only, never in the repo)</label>
    <input id="tk-token" type="text" autocomplete="off" placeholder="email:apiToken" style="-webkit-text-security:disc;text-security:disc">
  </div>
  <div id="tk-email-row" style="display:none">
    <label id="tk-email-label">Email</label>
    <input id="tk-email" type="text" autocomplete="off" placeholder="you@acme.com">
  </div>
  <div id="tk-apitoken-row" style="display:none">
    <label id="tk-apitoken-label">API Token <span style="font-weight:400">(or paste a PAT to skip email)</span></label>
    <input id="tk-apitoken" type="password" autocomplete="off" placeholder="ATATT3xFfGF0..." style="-webkit-text-security:disc;text-security:disc">
  </div>
  <label>Sample ticket IDs</label>
  <div style="display:flex;gap:6px;align-items:center">
    <input id="tk-samples" placeholder="PROJ-123, PROJ-124, …" style="flex:1">
    <button type="button" onclick="inferTicketPattern()" style="white-space:nowrap">Infer pattern</button>
  </div>
  <label>Ticket-id pattern (extracted from branch names &amp; commit messages)</label>
  <input id="tk-pattern" placeholder="[A-Z][A-Z0-9]+-\\d+">
  <label>Validate with a real ticket id (optional)</label>
  <div style="display:flex;gap:6px;align-items:center">
    <input id="tk-test" placeholder="XXX-2100" style="flex:1">
    <button type="button" id="tk-validate-btn" onclick="ticketsValidate()" style="white-space:nowrap">Validate</button>
  </div>
  <div id="tk-validate-result" class="hint" style="display:none"></div>
  <div class="dialog-actions">
    <button type="button" onclick="ticketsDisconnect()">Disconnect</button>
    <button type="button" class="primary" onclick="ticketsConnect()">Connect</button>
  </div>
 </form>
 <form id="tk-admin-section">
  <h3 style="margin-top:18px">👥 Team credentials (admin)</h3>
  <div class="hint">Stores the provider + token on the linked sync server — teammates connect with provider “remote” and never hold a ticket credential. <b>If you’re cloud-linked, your API key is used automatically.</b></div>
  <label>Admin token <span style="font-weight:400">(only needed for self-hosted servers — not stored)</span></label>
  <input id="tk-admin" type="password" autocomplete="off" placeholder="server admin token">
  <div class="ev-row">
    <button type="button" class="primary" onclick="ticketsShare()">Share current config</button>
    <button type="button" class="danger" onclick="ticketsShare(true)">Remove from server</button>
  </div>
  <div class="dialog-actions">
    <button type="button" onclick="document.getElementById('dlg-tickets').close()">Close</button>
  </div>
 </form>
</dialog>

<!-- Scratchpad jot dialog (dim scratch) -->
<dialog id="dlg-note">
  <h3>✏️ Jot a scratchpad note</h3>
  <div class="hint">Session-only working memory. Expires automatically (default 24 h), never synced, never becomes durable memory.</div>
  <label>Note</label>
  <textarea id="note-content" placeholder="Hypothesis: the flaky test is the retry timing in src/net/retry.ts"></textarea>
  <label>Expires after (hours)</label>
  <input id="note-ttl" type="number" min="1" max="168" value="24">
  <div class="dialog-actions">
    <button type="button" onclick="document.getElementById('dlg-note').close()">Cancel</button>
    <button type="button" class="primary" onclick="saveNote()">Save note</button>
  </div>
</dialog>

<!-- Generate context files dialog (dim generate-context) -->
<dialog id="dlg-context">
  <h3>🧭 Generate context files</h3>
  <div class="hint">Renders your trustworthy (verified/unverified, non-refuted) memory into static context files that AI agents read automatically.</div>
  <label>Format</label>
  <select id="ctx-format">
    <option value="claude">CLAUDE.md (Claude Code)</option>
    <option value="cursorrules">.cursorrules (Cursor)</option>
    <option value="copilot">.github/copilot-instructions.md (GitHub Copilot)</option>
    <option value="windsurfrules">.windsurfrules (Windsurf)</option>
    <option value="agents">AGENTS.md (generic agents)</option>
    <option value="all">All formats</option>
  </select>
  <div class="dialog-actions">
    <button type="button" onclick="document.getElementById('dlg-context').close()">Cancel</button>
    <button type="button" class="primary" onclick="runGenerateContext()">Generate</button>
  </div>
</dialog>

<!-- Show ticket dialog (dim ticket show) -->
<dialog id="dlg-ticket-show">
  <h3>👁 Show ticket</h3>
  <div class="hint">Fetches the ticket from your connected provider (Jira / GitHub / Linear / …).</div>
  <label>Ticket id</label>
  <input id="ticket-show-id" placeholder="PROJ-123 or #42">
  <div class="dialog-actions">
    <button type="button" onclick="document.getElementById('dlg-ticket-show').close()">Cancel</button>
    <button type="button" class="primary" onclick="runShowTicket()">Fetch</button>
  </div>
</dialog>

<!-- Create ticket branch dialog (dim branch) -->
<dialog id="dlg-branch">
  <h3>🌿 Create ticket branch</h3>
  <div class="hint">Fetches the ticket title and creates a convention-conforming branch.</div>
  <label>Branch prefix</label>
  <select id="branch-prefix">
    <option value="feature">feature</option>
    <option value="bugfix">bugfix</option>
    <option value="hotfix">hotfix</option>
    <option value="chore">chore</option>
    <option value="docs">docs</option>
    <option value="refactor">refactor</option>
    <option value="test">test</option>
    <option value="">(none — just ticket id)</option>
  </select>
  <label>Ticket id</label>
  <input id="branch-ticket-id" placeholder="PROJ-123">
  <div class="dialog-actions">
    <button type="button" onclick="document.getElementById('dlg-branch').close()">Cancel</button>
    <button type="button" class="primary" onclick="runBranchFromDialog()">Create branch</button>
  </div>
</dialog>

<!-- Generic output panel for action results -->
<dialog id="dlg-output">
  <h3 id="out-title"></h3>
  <div class="out-body" id="out-body"></div>
  <div class="dialog-actions" id="out-actions">
    <button type="button" onclick="document.getElementById('dlg-output').close()">Close</button>
  </div>
</dialog>

<!-- Generic confirm dialog -->
<dialog id="dlg-confirm">
  <h3 id="confirm-title">Confirm</h3>
  <p id="confirm-body" style="font-size:13px;line-height:1.6;color:hsl(var(--muted-foreground));margin-bottom:4px"></p>
  <div class="dialog-actions">
    <button type="button" id="confirm-cancel" onclick="document.getElementById('dlg-confirm').close()">Cancel</button>
    <button type="button" class="primary" id="confirm-ok">Confirm</button>
  </div>
</dialog>

<!-- Ollama setup dialog (step-by-step) -->
<dialog id="dlg-ollama" style="min-width:520px;max-width:600px">
  <h3 id="ollama-title">Setup Ollama for Semantic Search</h3>
  <style>#dlg-ollama h3 svg { fill: currentColor; }</style>
  <div id="ollama-content" style="font-size:13px;line-height:1.7"></div>
  <div class="dialog-actions" id="ollama-actions">
    <button type="button" onclick="document.getElementById('dlg-ollama').close()">Close</button>
  </div>
</dialog>

<!-- Model management dialog (change embedding/LLM model) -->
<dialog id="dlg-models" style="min-width:480px;max-width:560px">
  <h3>🧮 Model Settings</h3>
  <div id="models-content" style="font-size:13px;line-height:1.7"></div>
  <div class="dialog-actions" id="models-actions">
    <button type="button" onclick="document.getElementById('dlg-models').close()">Close</button>
  </div>
</dialog>

<div class="legend">
  <span><svg class="licn" viewBox="0 0 24 24" fill="none" stroke="var(--verified)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>Verified</span>
  <span><svg class="licn" viewBox="0 0 24 24" fill="none" stroke="var(--unverified)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3"><circle cx="12" cy="12" r="10"/></svg>Unverified</span>
  <span><svg class="licn" viewBox="0 0 24 24" fill="none" stroke="var(--stale)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Stale</span>
  <span><svg class="licn" viewBox="0 0 24 24" fill="none" stroke="var(--refuted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>Refuted</span>
  <span><svg class="licn" viewBox="0 0 24 24" fill="none" stroke="var(--verified)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>Memory</span>
  <span><svg class="licn" viewBox="0 0 24 24" fill="none" stroke="var(--path)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="m9 18 3-3-3-3"/><path d="m5 12-3 3 3 3"/></svg>Scope</span>
  <span style="margin-left:auto">node size = confidence · click a memory to fire a signal · drag to rearrange · scroll to zoom</span>
</div>
<div id="toast"></div>

<!-- Onboarding tour (first-time only, interactive spotlight) -->
<div id="tour-backdrop">
  <div id="tour-spotlight" style="display:none"></div>
  <div id="tour-tooltip" style="display:none"></div>
</div>

<script>
const COLORS = { VERIFIED: "#22c55e", UNVERIFIED: "#94a3b8", STALE: "#eab308", REFUTED: "#ef4444" };
let state = null;
let csrfToken = null;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function graphPalette() {
  const dark = document.documentElement.classList.contains("dark");
  return {
    VERIFIED: cssVar("--verified", COLORS.VERIFIED),
    UNVERIFIED: cssVar("--unverified", COLORS.UNVERIFIED),
    STALE: cssVar("--stale", COLORS.STALE),
    REFUTED: cssVar("--refuted", COLORS.REFUTED),
    path: cssVar("--path", "#60a5fa"),
    link: "hsl(" + cssVar("--border", "217 33% 16%") + ")",
    primary: "hsl(" + cssVar("--primary", "217 91% 53%") + ")",
    iconStroke: dark ? "#fff" : "#1e293b",
  };
}

function toggleTheme() {
  const root = document.documentElement;
  const dark = !root.classList.contains("dark");
  root.classList.toggle("dark", dark);
  localStorage.setItem("aidimag-ui-theme", dark ? "dark" : "light");
  if (state) renderGraph();
}

let _toastTimer = null;
function _setToastClass(cls) {
  const t = document.getElementById("toast");
  t.classList.remove("toast-success", "toast-error", "toast-warning", "toast-info", "toast-loading");
  if (cls) t.classList.add(cls);
}
function _showToast() {
  const t = document.getElementById("toast");
  // Move toast into the open modal dialog so it renders in the top layer
  const openDlg = document.querySelector("dialog[open]");
  if (openDlg && openDlg.id !== "toast") {
    openDlg.appendChild(t);
  } else {
    document.body.appendChild(t);
  }
  t.style.display = "block";
}
function _hideToast() {
  const t = document.getElementById("toast");
  t.style.display = "none";
  document.body.appendChild(t);
}
function toast(msg, type) {
  const t = document.getElementById("toast");
  t.innerHTML = esc(msg);
  if (!type) {
    if (/^Error:/i.test(msg) || /^Could not/i.test(msg)) type = "error";
    else if (/^Enter /i.test(msg) || /configure/i.test(msg) || /keyword match only/i.test(msg)) type = "warning";
    else if (/saved|connected|disconnected|linked|unlinked|copied|cleared|purged|removed|stored|inferred/i.test(msg)) type = "success";
    else type = "info";
  }
  _setToastClass(type === "error" ? "toast-error" : type === "warning" ? "toast-warning" : type === "success" ? "toast-success" : "toast-info");
  _showToast();
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  _toastTimer = setTimeout(() => { _hideToast(); _toastTimer = null; }, 3000);
}

function toastLoading(msg) {
  const t = document.getElementById("toast");
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  t.innerHTML = '<span class="spinner" style="margin-right:8px"></span>' + esc(msg);
  _setToastClass("toast-loading");
  _showToast();
}

function toastDone(msg) {
  const t = document.getElementById("toast");
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  t.innerHTML = esc(msg);
  _setToastClass("toast-success");
  _showToast();
  _toastTimer = setTimeout(() => { _hideToast(); _toastTimer = null; }, 2500);
}

async function api(path, opts) {
  opts = opts || {};
  const method = (opts.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    if (!csrfToken) throw new Error("missing CSRF token — reload the page");
    opts.headers = { ...(opts.headers || {}), "X-Aidimag-Csrf-Token": csrfToken, "Content-Type": "application/json" };
  }
  const r = await fetch(path, opts);
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || r.status);
  return body;
}

async function load() {
  state = await api("/api/state");
  csrfToken = state.csrfToken;
  document.getElementById("repo").textContent = state.repoRoot;
  const s = state.summary.byStatus;
  document.getElementById("counts").innerHTML =
    \`<b>\${state.summary.total}</b> memories · ✓\${s.VERIFIED} verified · ?\${s.UNVERIFIED} unverified · ~\${s.STALE} stale · ✗\${s.REFUTED} refuted\`;
  renderProposals(); renderMemories(); renderGraph();
  renderActionsView();
  refreshKnowledgeStatus();
  refreshMcpStatus();
  if (!state.onboarded) startTour();
}

// ── Interactive onboarding tour ──────────────────────────────────────────────

const TOUR_STEPS = [
  {
    selector: "#graph",
    title: "Memory Graph",
    desc: "Welcome! This graph shows memories (circles) linked to scope paths (squares). Node size = confidence, color = trust status. Click a memory to trace its connections.",
    onShow: () => switchTab("overview"),
  },
  {
    selector: ".searchbar",
    title: "Search Memories",
    desc: "Search across all memories — semantic when embeddings are configured, keyword-only otherwise. Filter by kind using the dropdown.",
    onShow: () => switchTab("overview"),
  },
  {
    selector: "#proposals-h",
    title: "Pending Proposals",
    desc: "Everything captured — mined commits, harvested chats, knowledge docs — lands here first. Nothing becomes memory until you approve it.",
    onShow: () => switchTab("overview"),
  },
  {
    selector: "#tab-actions",
    title: "Actions Tab",
    desc: "This is your command center. Let's walk through the recommended first-time setup workflow.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#act-bootstrap",
    title: "1. Build Initial Memory",
    desc: "Start here after dim setup. Bootstrap surveys your README, docs, and repo structure, then asks your LLM to draft 5–30 initial memories for review.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#act-mine",
    title: "2. Mine Git History",
    desc: "Scan your commit history for memory-worthy decisions, gotchas, and reverts. Each match becomes a proposal for your review. Shift-click to rescan all history.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#act-knowledge",
    title: "3. Import Knowledge",
    desc: "Drop markdown, PDF, or docx files into the knowledge/ folder and they're LLM-summarized into reviewable proposals. Auto-ingests while the dashboard is running.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#act-harvest",
    title: "4. Harvest AI Chats",
    desc: "Extract durable facts from your Claude Code, Codex, Copilot, and Cursor sessions. Redacts secrets and queues findings for review — local only.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#stat-models",
    title: "Embeddings & LLM",
    desc: "These status cards show your LLM and embedding model providers. Click either card to set up Ollama for free local models — an embedding model for semantic search and an LLM for bootstrap, harvest, and knowledge sync. No API key needed.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#integration-panel .ip-head",
    title: "Agent Integration",
    desc: "Connect aidimag to your coding agents — Claude Code, Cursor, Copilot, Windsurf. The MCP server feeds verified memory into agent context automatically.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#btn-sync",
    title: "Verify & Sync",
    desc: "Back on Overview: use Verify to re-check evidence and update trust. New Memory writes a falsifiable claim. Sync pushes and pulls memory with your team.",
    onShow: () => switchTab("overview"),
  },
  {
    selector: "#tab-health",
    title: "Health Dashboard",
    desc: "Track risk metrics, coverage heatmap, and trend charts. See which parts of your codebase have memory coverage and where gaps exist.",
    onShow: () => switchTab("health"),
  },
  {
    selector: "#tab-areas",
    title: "Protected Areas",
    desc: "Define critical code boundaries that require owner approval, passing tests, or explicit approval tokens before changes are allowed.",
    onShow: () => switchTab("areas"),
  },
  {
    selector: "#btn-theme",
    title: "You're All Set!",
    desc: "Toggle light/dark theme here. Recommended workflow: Bootstrap → Mine → Import Knowledge → Harvest → Review proposals → Verify. Replay this tour anytime via Actions → Reset Onboarding.",
    onShow: () => switchTab("overview"),
  },
];

let tourStep = 0;

function startTour() {
  tourStep = 0;
  document.body.style.overflow = "hidden";
  window.addEventListener("resize", onTourResize);
  showTourStep();
}

function showTourStep() {
  const step = TOUR_STEPS[tourStep];
  if (!step) { endTour(); return; }
  if (step.onShow) step.onShow();

  // Wait for any tab switch DOM updates before measuring position
  requestAnimationFrame(() => {
    const el = document.querySelector(step.selector);
    const spotlight = document.getElementById("tour-spotlight");
    const tooltip = document.getElementById("tour-tooltip");

    if (!el) {
      // Element not found (e.g. no proposals header) — skip to next step
      tourStep++;
      showTourStep();
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 6;
    // Scroll the target into view so the spotlight is always visible
    el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    // Re-measure after scroll
    requestAnimationFrame(() => {
      const rect2 = el.getBoundingClientRect();
      spotlight.style.display = "block";
      spotlight.style.left = (rect2.left - pad) + "px";
      spotlight.style.top = (rect2.top - pad) + "px";
      spotlight.style.width = (rect2.width + pad * 2) + "px";
      spotlight.style.height = (rect2.height + pad * 2) + "px";

      // Position tooltip — clamp within viewport at all times
      const ttW = 420, ttH = 200;
      const vw = window.innerWidth, vh = window.innerHeight;
      let ttLeft, ttTop;

      // If element is on the right side (aside), try placing tooltip to the left
      if (rect2.left > vw * 0.55 && rect2.left - 14 - ttW >= 8) {
        ttLeft = rect2.left - ttW - 14;
        ttTop = Math.max(8, Math.min(rect2.top, vh - ttH - 8));
      } else if (rect2.right + 14 + ttW <= vw - 8) {
        // Fits to the right
        ttLeft = rect2.right + 14;
        ttTop = Math.max(8, Math.min(rect2.top, vh - ttH - 8));
      } else {
        // Center below or above
        ttLeft = rect2.left + (rect2.width / 2) - (ttW / 2);
        if (rect2.bottom + 14 + ttH <= vh) {
          ttTop = rect2.bottom + 14;
        } else if (rect2.top - 14 - ttH >= 0) {
          ttTop = rect2.top - ttH - 14;
        } else {
          ttTop = Math.max(8, rect2.top + 14);
        }
      }

      ttLeft = Math.max(8, Math.min(ttLeft, vw - ttW - 8));
      ttTop = Math.max(8, Math.min(ttTop, vh - ttH - 8));

      tooltip.innerHTML =
        '<div class="tour-step-num">Step ' + (tourStep + 1) + ' of ' + TOUR_STEPS.length + '</div>' +
        '<h3>' + esc(step.title) + '</h3>' +
        '<p>' + esc(step.desc) + '</p>' +
        '<div class="tour-actions">' +
          '<div class="tour-dots">' +
            TOUR_STEPS.map((_, i) => '<div class="tour-dot' + (i === tourStep ? " active" : "") + '"></div>').join("") +
          '</div>' +
          (tourStep < TOUR_STEPS.length - 1
            ? '<button class="tour-skip" onclick="skipTour()">Skip</button>' +
              (tourStep > 0 ? '<button onclick="prevTourStep()">Back</button>' : '') +
              '<button class="primary" onclick="nextTourStep()">Next</button>'
            : '<button class="primary" onclick="endTour()">Done</button>') +
        '</div>';
      tooltip.style.display = "block";
      tooltip.style.left = ttLeft + "px";
      tooltip.style.top = ttTop + "px";
    });
  });
}

function nextTourStep() {
  tourStep++;
  if (tourStep >= TOUR_STEPS.length) { endTour(); return; }
  showTourStep();
}

function prevTourStep() {
  if (tourStep > 0) { tourStep--; showTourStep(); }
}

function skipTour() { endTour(); }

function onTourResize() {
  const spotlight = document.getElementById("tour-spotlight");
  const tooltip = document.getElementById("tour-tooltip");
  if (spotlight.style.display === "none") return;
  showTourStep();
}

async function endTour() {
  document.body.style.overflow = "";
  window.removeEventListener("resize", onTourResize);
  document.getElementById("tour-spotlight").style.display = "none";
  document.getElementById("tour-tooltip").style.display = "none";
  try { await api("/api/onboard", { method: "POST" }); }
  catch (e) { /* non-critical */ }
  toast("Welcome! Explore the dashboard and check the Actions tab to get started.");
}

function esc(s) { return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

function renderProposals() {
  const el = document.getElementById("proposals");
  document.getElementById("proposals-h").textContent = \`Pending proposals (\${state.proposals.length})\`;
  if (!state.proposals.length) { el.innerHTML = '<div class="empty">Queue is empty.</div>'; return; }
  el.innerHTML = state.proposals.map(p => \`
    <div class="card">
      <div class="claim">\${esc(p.claim)}</div>
      <div class="meta"><span class="kind" style="color:\${KIND_COLORS[p.kind] || 'hsl(var(--primary))'}">\${p.kind}</span><span>via \${esc(p.source)}</span>\${p.ticketRef ? \`<span>\${IC_TICKET} \${esc(p.ticketRef)}</span>\` : ""}</div>
      <div class="actions">
        <button class="primary" onclick="act('/api/proposals/\${p.id}/approve','approved')">Approve</button>
        <button class="danger" onclick="act('/api/proposals/\${p.id}/reject','rejected')">Reject</button>
      </div>
    </div>\`).join("");
}

function renderMemories(list) {
  const el = document.getElementById("memories");
  const items = list ?? state.memories;
  if (!items.length) { el.innerHTML = '<div class="empty">No matching memories.</div>'; return; }
  el.innerHTML = items.map(m => \`
    <div class="card" id="mem-\${m.id}">
      <div class="claim">\${esc(m.claim)}</div>
      <div class="meta">
        <span class="badge \${m.status}">\${m.status}</span>
        \${m.pinned ? '<span class="badge" title="Pinned: never decays with age (evidence failure can still mark it stale)">PINNED</span>' : ""}
        <span class="kind" style="color:\${KIND_COLORS[m.kind] || 'hsl(var(--primary))'}">\${m.kind}</span>
        <span>conf \${m.confidence.toFixed(2)}</span>
        \${m.scope.paths.length ? "<span>" + IC_FOLDER + " " + esc(m.scope.paths.join(", ")) + "</span>" : "<span>repo-wide</span>"}
      </div>
      \${m.grounding.map(e => \`<div class="evidence">\${e.type}(\${e.result}) \${esc(e.payload)}</div>\`).join("")}
      <div class="actions">
        \${m.pinned
          ? \`<button onclick="act('/api/memories/\${m.id}/unpin','unpinned')">\${IC_UNPIN} Unpin</button>\`
          : \`<button onclick="act('/api/memories/\${m.id}/pin','pinned')">\${IC_PIN_BTN} Pin</button>\`}
        \${m.status !== "REFUTED" ? \`<button class="danger" onclick="act('/api/memories/\${m.id}/refute','refuted')">\${IC_REFUTE} Refute</button>\` : ""}
        <button class="danger" onclick="confirmForget('\${m.id}')">\${IC_FORGET} Forget</button>
      </div>
    </div>\`).join("");
}

async function act(path, verb) {
  try { await api(path, { method: "POST" }); toast("Memory " + verb); load(); }
  catch (e) { toast("Error: " + e.message); }
}

async function confirmForget(id) {
  const ok = await showConfirm("Forget memory", "Delete this memory permanently? This cannot be undone.");
  if (!ok) return;
  try { await api("/api/memories/" + id + "/forget", { method: "POST" }); toast("Memory forgotten"); load(); }
  catch (e) { toast("Error: " + e.message); }
}

async function runVerify(deep) {
  toastLoading(deep ? "Running deep verification…" : "Verifying…");
  try {
    const r = await api("/api/verify" + (deep ? "?deep=1" : ""), { method: "POST" });
    toastDone(\`Checked \${r.checked}: \${r.verified} verified, \${r.stale} stale, \${r.decayed} decayed\`);
    load();
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- new memory

function addEvidenceRow() {
  const row = document.createElement("div");
  row.className = "ev-row";
  row.innerHTML = \`
    <select>
      <option>STATIC_CHECK</option><option>COMMIT_REF</option>
      <option>TEST_RESULT</option><option>EXEC_TRACE</option><option>HUMAN_ATTESTED</option>
    </select>
    <input placeholder="payload">
    <button onclick="this.parentElement.remove()">✕</button>\`;
  document.getElementById("nm-evidence").appendChild(row);
}

function toggleGuardrailLevel() {
  const kind = document.getElementById("nm-kind").value;
  const section = document.getElementById("guardrail-section");
  section.style.display = kind === "GUARDRAIL" ? "block" : "none";
}

async function saveMemory() {
  const claim = document.getElementById("nm-claim").value.trim();
  if (claim.length < 10) { toast("Claim is too short"); return; }
  const kind = document.getElementById("nm-kind").value;
  const evidence = [...document.querySelectorAll("#nm-evidence .ev-row")]
    .map(r => ({ type: r.querySelector("select").value, payload: r.querySelector("input").value.trim() }))
    .filter(e => e.payload);
  const paths = document.getElementById("nm-paths").value.split(",").map(s => s.trim()).filter(Boolean);
  const symbols = document.getElementById("nm-symbols").value.split(",").map(s => s.trim()).filter(Boolean);
  const pinned = document.getElementById("nm-pinned").checked;
  const guardrailLevel = kind === "GUARDRAIL" ? document.getElementById("nm-guardrail-level").value : undefined;
  
  try {
    await api("/api/memories", {
      method: "POST",
      body: JSON.stringify({ kind, claim, paths, symbols, evidence, pinned, guardrailLevel }),
    });
    document.getElementById("dlg-new").close();
    document.getElementById("nm-claim").value = "";
    document.getElementById("nm-paths").value = "";
    document.getElementById("nm-symbols").value = "";
    document.getElementById("nm-pinned").checked = false;
    document.getElementById("nm-evidence").innerHTML = "";
    toast("Memory saved");
    load();
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- search

let searchTimer = null;
function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 300);
}

async function doSearch() {
  const q = document.getElementById("q").value.trim();
  const kind = document.getElementById("q-kind").value;
  if (!q && !kind) { renderMemories(); return; }
  try {
    const r = await api(\`/api/search?q=\${encodeURIComponent(q)}&kind=\${encodeURIComponent(kind)}\`);
    renderMemories(r.results);
    if (q && !r.semantic) toast("Keyword match only — configure embeddings for semantic search");
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- mine / sync / reindex

async function runMine(ev) {
  const full = ev && ev.shiftKey;
  toastLoading(full ? "Rescanning full git history…" : "Mining git history…");
  try {
    const r = await api("/api/mine" + (full ? "?full=1" : ""), { method: "POST" });
    if (r.noCommits) {
      toast("No git commits yet — make an initial commit, then try again.");
      return;
    }
    if (r.noNewCommits) {
      toast("No new commits since the last mine — Shift+click Mine commits to rescan all history.");
      return;
    }
    if (r.scanned > 0 && r.proposed === 0) {
      toast("Scanned " + r.scanned + " commit(s): none matched memory-worthy signals (try descriptive messages or dim mine --llm)");
      return;
    }
    toastDone(\`Scanned \${r.scanned} commit(s): \${r.proposed} proposal(s) queued\`);
    load();
  } catch (e) { toast("Error: " + e.message); }
}

async function runSync() {
  toastLoading("Syncing with team server…");
  try {
    const r = await api("/api/sync", { method: "POST" });
    const mem = (n) => n + (n === 1 ? " memory" : " memories");
    let msg;
    if (r.autoRecovered) {
      msg = "Auto-recovery: restored memories from cloud";
      if (r.applied) msg += " (" + r.applied + " recovered)";
    } else if (r.memoriesPushed) msg = "Sent " + mem(r.memoriesPushed);
    else if (r.memoriesQueued) msg = "Already on server (" + mem(r.memoriesQueued) + " unchanged)";
    else msg = "Nothing to send";
    if (!r.autoRecovered) {
      if (r.applied) msg += ", received " + r.applied + " update" + (r.applied === 1 ? "" : "s");
      else if (r.pulled) msg += ", pulled " + r.pulled + " (already up to date locally)";
      else msg += ", nothing new from team";
    }
    if (r.needsFullUploadConfirm) {
      msg += " — run dim sync in terminal to confirm upload";
    }
    toastDone(msg);
    load();
  } catch (e) { toast("Sync: " + e.message); }
}

async function runReindex() {
  toastLoading("Reindexing embeddings…");
  try {
    const r = await api("/api/reindex", { method: "POST" });
    if (r.provider) toastDone(\`Indexed \${r.indexed} with \${r.provider}\`);
    else await promptOllamaSetupUI("No embedding provider found. Set up Ollama for semantic search?");
  } catch (e) { toast("Error: " + e.message); }
}

async function promptOllamaSetupUI(msg) {
  const ok = await showConfirm("Setup Ollama?", msg + " It's free, local, and takes about a minute.");
  if (ok) runSetupOllama();
}

async function openModelSettings() {
  const content = document.getElementById("models-content");
  const actions = document.getElementById("models-actions");
  document.getElementById("dlg-models").showModal();
  content.innerHTML = '<div class="loading-overlay"><div class="spinner spinner-lg"></div><div>Loading model info…</div></div>';
  actions.innerHTML = '<button onclick="document.getElementById(\\'dlg-models\\').close()">Close</button>';

  let info;
  try {
    info = await api("/api/ollama/models");
  } catch (e) {
    content.innerHTML = '<div style="color:hsl(var(--destructive))">Error: ' + esc(e.message) + '</div>';
    return;
  }

  const models = info.models || [];
  const embModels = [
    { name: "all-minilm", size: "~45MB", dim: 384, desc: "Lightest, fast, small repos" },
    { name: "nomic-embed-text", size: "~274MB", dim: 768, desc: "Recommended balance" },
    { name: "mxbai-embed-large", size: "~670MB", dim: 1024, desc: "Higher quality, large repos" },
    { name: "snowflake-arctic-embed", size: "~1.2GB", dim: 1024, desc: "Top-tier, demanding search" },
  ];
  // Also include any pulled models that aren't in the catalog
  for (const m of models) {
    if (!embModels.find(em => em.name === m) && /embed/i.test(m)) {
      embModels.push({ name: m, size: "", dim: 0, desc: "pulled" });
    }
  }

  const llmModels = ["llama3.1", "llama3.2", "qwen2.5", "mistral", "gemma2", "phi3"];
  for (const m of models) {
    if (!llmModels.includes(m) && !/embed/i.test(m)) {
      llmModels.push(m);
    }
  }

  let html = '<div style="margin-bottom:12px"><label style="font-weight:600;display:block;margin-bottom:4px">Embedding Model (semantic search)</label>';
  html += '<div style="display:flex;gap:8px;align-items:center">';
  html += '<select id="cfg-emb-model" style="flex:1">';
  for (const m of embModels) {
    const pulled = models.includes(m.name);
    const selected = m.name === info.currentEmbeddingModel;
    html += '<option value="' + esc(m.name) + '"' + (selected ? ' selected' : '') + '>' + esc(m.name) + (m.size ? ' (' + esc(m.size) + ')' : '') + ' — ' + esc(m.desc) + (pulled ? ' ✓' : ' (not pulled)') + '</option>';
  }
  html += '</select>';
  html += '<button id="emb-pull-btn" style="flex-shrink:0;white-space:nowrap">Pull</button>';
  html += '</div></div>';

  html += '<div style="margin-bottom:12px"><label style="font-weight:600;display:block;margin-bottom:4px">LLM Model (mining, harvest, bootstrap)</label>';
  html += '<div style="display:flex;gap:8px;align-items:center">';
  html += '<select id="cfg-llm-model" style="flex:1">';
  for (const m of llmModels) {
    const pulled = models.includes(m);
    const selected = m === info.currentLlmModel;
    html += '<option value="' + esc(m) + '"' + (selected ? ' selected' : '') + '>' + esc(m) + (pulled ? ' ✓ pulled' : ' (not pulled)') + '</option>';
  }
  html += '</select>';
  html += '<button id="llm-pull-btn" style="flex-shrink:0;white-space:nowrap">Pull</button>';
  html += '</div></div>';

  html += '<div id="pull-status" style="color:hsl(var(--muted-foreground));font-size:12px;margin-bottom:8px">Models marked "not pulled" will be downloaded on first use. Click Pull to download now.</div>';

  content.innerHTML = html;
  actions.innerHTML = '<button onclick="document.getElementById(\\'dlg-models\\').close()">Close</button><button class="primary" id="models-save-btn">Save</button>';

  const pullStatus = document.getElementById("pull-status");
  const pullModel = async (model, btn) => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:1.5px"></span> Pulling…';
    pullStatus.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:1.5px"></span> Pulling <b>' + esc(model) + '</b>… (this may take a few minutes)';
    try {
      const r = await api("/api/ollama/pull?model=" + encodeURIComponent(model), { method: "POST" });
      if (r.ok) {
        pullStatus.innerHTML = IC_CHECK_C + ' <b>' + esc(model) + '</b> pulled successfully!';
        toastDone('Model ' + model + ' pulled');
        btn.innerHTML = 'Pulled';
        btn.disabled = true;
        // Refresh the dropdown to show ✓ pulled
        openModelSettings();
      } else {
        pullStatus.innerHTML = 'Pull failed: ' + esc(r.message || 'error') + ' — try <code>ollama pull ' + esc(model) + '</code> in terminal';
        btn.disabled = false;
        btn.innerHTML = 'Pull';
      }
    } catch (e) {
      pullStatus.innerHTML = 'Error: ' + esc(e.message);
      btn.disabled = false;
      btn.innerHTML = 'Pull';
    }
  };

  document.getElementById("emb-pull-btn").onclick = () => pullModel(document.getElementById("cfg-emb-model").value, document.getElementById("emb-pull-btn"));
  document.getElementById("llm-pull-btn").onclick = () => pullModel(document.getElementById("cfg-llm-model").value, document.getElementById("llm-pull-btn"));

  document.getElementById("models-save-btn").onclick = async () => {
    const embModel = document.getElementById("cfg-emb-model").value;
    const llmModel = document.getElementById("cfg-llm-model").value;
    try {
      await api("/api/ollama/config", { method: "POST", body: JSON.stringify({ embeddingModel: embModel, llmModel }) });
      toast("Model settings saved — " + embModel + " / " + llmModel);
      document.getElementById("dlg-models").close();
      load();
    } catch (e) { toast("Error: " + e.message); }
  };
}

// ---------------------------------------------------------------- cloud + keys

function openCloud() {
  const c = state && state.cloud;
  document.getElementById("cloud-status").textContent = c
    ? \`Linked: \${c.server} → brain '\${c.brain}' (\${c.hasToken ? "token stored" : "NO TOKEN — paste API key and Link"})\`
    : "Not linked to a team server yet. For local aidimag-cloud dev use http://localhost:3000";
  if (c) {
    document.getElementById("cl-server").value = c.server;
    document.getElementById("cl-brain").value = c.brain;
  } else {
    document.getElementById("cl-server").value = "";
    document.getElementById("cl-brain").value = "";
  }
  document.getElementById("cl-token").value = "";
  document.getElementById("dlg-cloud").showModal();
}

async function cloudLink() {
  try {
    await api("/api/cloud/link", {
      method: "POST",
      body: JSON.stringify({
        server: document.getElementById("cl-server").value.trim(),
        brain: document.getElementById("cl-brain").value.trim(),
        token: document.getElementById("cl-token").value.trim() || undefined,
      }),
    });
    document.getElementById("cl-token").value = "";
    toast("Linked — use Sync to exchange memory");
    load(); openCloud();
  } catch (e) { toast("Error: " + e.message); }
}

async function cloudUnlink() {
  try { await api("/api/cloud/unlink", { method: "POST" }); toast("Unlinked"); load(); openCloud(); }
  catch (e) { toast("Error: " + e.message); }
}

function keyParams() {
  return {
    server: document.getElementById("cl-server").value.trim(),
    adminToken: document.getElementById("k-admin").value.trim(),
  };
}

async function keyCreate() {
  const p = keyParams();
  if (!p.adminToken) { toast("Admin token required"); return; }
  try {
    const r = await api("/api/keys", {
      method: "POST",
      body: JSON.stringify({ ...p, brain: document.getElementById("k-brain").value.trim(), label: document.getElementById("k-label").value.trim() || undefined }),
    });
    document.getElementById("keys-out").innerHTML =
      \`<div class="hint">New key (shown once — copy now):</div><div class="keyrow"><span>\${esc(r.key)}</span><button onclick="navigator.clipboard.writeText('\${esc(r.key)}').then(()=>toast('Copied'))">Copy</button></div>\`;
  } catch (e) { toast("Error: " + e.message); }
}

async function keyList() {
  const p = keyParams();
  if (!p.adminToken) { toast("Admin token required"); return; }
  try {
    const r = await api(\`/api/keys?server=\${encodeURIComponent(p.server)}\`, {
      headers: { "X-Aidimag-Admin-Token": p.adminToken },
    });
    document.getElementById("keys-out").innerHTML = r.keys.length
      ? r.keys.map(k => \`<div class="keyrow"><span>\${k.revoked_at ? IC_WARN : IC_CHECK} \${esc(k.key)} → \${esc(k.brain)}\${k.label ? " (" + esc(k.label) + ")" : ""}</span></div>\`).join("")
      : '<div class="hint">No keys yet.</div>';
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- tickets

${ICONS_JS}

const KIND_ICONS = {
  DECISION: IC_DECISION,
  CONVENTION: IC_CONVENTION,
  GOTCHA: IC_GOTCHA,
  FAILED_APPROACH: IC_FAILED,
  ARCHITECTURE: IC_ARCH,
  INVARIANT: IC_INVARIANT,
  TODO_CONTEXT: IC_TODO,
  GUARDRAIL: IC_GUARDRAIL,
  SKILL: IC_SKILL,
};
const KIND_LIST = ["DECISION", "CONVENTION", "GOTCHA", "FAILED_APPROACH", "ARCHITECTURE", "INVARIANT", "TODO_CONTEXT", "GUARDRAIL", "SKILL"];
const KIND_COLORS = {
  DECISION: "#2563eb",
  CONVENTION: "#0284c7",
  GOTCHA: "#a16207",
  FAILED_APPROACH: "#dc2626",
  ARCHITECTURE: "#7c3aed",
  INVARIANT: "#d97706",
  TODO_CONTEXT: "#0891b2",
  GUARDRAIL: "#059669",
  SKILL: "#db2777",
};

function initKindDropdown(ddId, hiddenId, includeAll, onChange) {
  const dd = document.getElementById(ddId);
  if (!dd) return;
  const menu = dd.querySelector(".kind-dropdown-menu");
  const triggerIcon = dd.querySelector(".kind-trigger-icon");
  const triggerLabel = dd.querySelector(".kind-trigger-label");
  const hidden = document.getElementById(hiddenId);
  const items = [];
  if (includeAll) {
    items.push({ value: "", icon: "", label: "all kinds" });
  }
  for (const k of KIND_LIST) {
    items.push({ value: k, icon: KIND_ICONS[k], label: k });
  }
  menu.innerHTML = items.map(it =>
    '<div class="kind-dropdown-item" data-value="' + it.value + '">' +
    (it.icon ? it.icon : "") +
    '<span class="kind-label" style="color:' + (it.value ? (KIND_COLORS[it.value] || 'hsl(var(--foreground))') : "hsl(var(--muted-foreground))") + '">' + it.label + '</span></div>'
  ).join("");
  const selectItem = (value) => {
    const item = items.find(it => it.value === value);
    if (!item) return;
    hidden.value = value;
    triggerIcon.innerHTML = item.icon || "";
    triggerLabel.textContent = item.label;
    triggerLabel.style.color = value ? (KIND_COLORS[value] || 'hsl(var(--foreground))') : 'hsl(var(--muted-foreground))';
    menu.querySelectorAll(".kind-dropdown-item").forEach(el => {
      el.classList.toggle("selected", el.dataset.value === value);
    });
    if (onChange) onChange(value);
  };
  menu.querySelectorAll(".kind-dropdown-item").forEach(el => {
    el.onclick = () => {
      selectItem(el.dataset.value);
      kindDropdownCloseAll();
    };
  });
  selectItem(hidden.value || (includeAll ? "" : "DECISION"));
}

function kindDropdownToggle(ddId) {
  const dd = document.getElementById(ddId);
  if (!dd) return;
  const menu = dd.querySelector(".kind-dropdown-menu");
  const isOpen = menu.classList.contains("open");
  kindDropdownCloseAll();
  if (!isOpen) menu.classList.add("open");
}

function kindDropdownCloseAll() {
  document.querySelectorAll(".kind-dropdown-menu.open").forEach(m => m.classList.remove("open"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".kind-dropdown")) kindDropdownCloseAll();
});

const _DIALOG_ICON_MAP = { '＋': IC_PLUS, '☁': IC_CLOUD, '🎫': IC_TICKET, '✏️': IC_PENCIL, '🧭': IC_COMPASS, '👁': IC_EYE, '🦙': IC_LLAMA, '🧮': IC_ABACUS, '👥': IC_PEOPLE, '🔑': IC_KEY };
function replaceDialogIcons() {
  document.querySelectorAll('dialog h3').forEach(function(h) {
    var txt = h.textContent;
    for (var emoji in _DIALOG_ICON_MAP) {
      if (txt.indexOf(emoji) === 0) {
        h.innerHTML = _DIALOG_ICON_MAP[emoji] + ' ' + txt.slice(emoji.length).trim();
        return;
      }
    }
  });
}


const AGENT_LOGOS = {
  "Claude Code": IC_CLAUDE,
  "Claude (CLAUDE.md)": IC_CLAUDE,
  "Cursor": IC_CURSOR,
  "GitHub Copilot": IC_COPILOT,
  "Windsurf": IC_WINDSURF,
  "Generic (AGENTS.md)": '<svg role="img" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px"><path fill="#6B7280" d="M12 2 2 7v10l10 5 10-5V7z"/></svg>',
};

const SVG_AIDIMAG = '<svg role="img" viewBox="0 0 64 64" width="20" height="20" style="vertical-align:-5px" fill="none"><defs><linearGradient id="aidimagGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#2563eb"/><stop offset="55%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="16" fill="#2563eb" fill-opacity="0.12"/><g transform="translate(8 8) scale(2)" stroke="url(#aidimagGrad)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></g><circle cx="49" cy="49" r="11" fill="#10b981"/><path d="M44 49.2l3.4 3.4L54.5 45" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

const PROVIDER_LOGOS = {
  jira: IC_JIRA,
  github: IC_GITHUB,
  linear: IC_LINEAR,
  http: IC_HTTP,
  remote: IC_REMOTE,
  gitlab: IC_GITLAB,
  azuredevops: IC_AZUREDEVOPS,
  clickup: IC_CLICKUP,
  shortcut: IC_SHORTCUT,
  youtrack: IC_YOUTRACK,
  asana: IC_ASANA,
  trello: IC_TRELLO,
  notion: IC_NOTION,
  pivotal: IC_PIVOTAL,
};

var _TK_PROVIDER_ICONS = PROVIDER_LOGOS;
function initTkDropdownIcons() {
  document.querySelectorAll('.tk-dropdown-item').forEach(function(item) {
    var val = item.getAttribute('data-value');
    var icon = _TK_PROVIDER_ICONS[val];
    if (icon && item.querySelector('svg') === null) {
      item.innerHTML = icon + ' ' + item.textContent;
    }
  });
}
function tkDropdownToggle() {
  var menu = document.getElementById('tk-provider-menu');
  var dialog = document.getElementById('dlg-tickets');
  if (menu.style.display === 'none') {
    menu.style.display = '';
    dialog.style.overflow = 'visible';
  } else {
    menu.style.display = 'none';
    dialog.style.overflow = 'auto';
  }
}
function tkDropdownSelect(val, label) {
  document.getElementById('tk-provider').value = val;
  var icon = _TK_PROVIDER_ICONS[val] || '';
  document.getElementById('tk-provider-label').innerHTML = icon + ' ' + label;
  document.getElementById('tk-provider-menu').style.display = 'none';
  document.getElementById('dlg-tickets').style.overflow = 'auto';
  ticketsProviderHint();
}
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('tk-provider-wrap');
  var menu = document.getElementById('tk-provider-menu');
  var btn = document.getElementById('tk-provider-btn');
  if (menu && menu.style.display !== 'none' && !wrap.contains(e.target) && !menu.contains(e.target) && e.target !== btn) {
    menu.style.display = 'none';
    document.getElementById('dlg-tickets').style.overflow = 'auto';
  }
});

const TK_HINTS = {
  jira:       { url: "Jira site URL", urlPh: "https://acme.atlassian.net", token: "email:apiToken (or a PAT)", needUrl: true,  needToken: true,  splitFields: true },
  github:     { url: "Repo URL", urlPh: "https://github.com/acme/api", token: "GitHub token (repo read)", needUrl: true,  needToken: true,  splitFields: false },
  linear:     { url: "", urlPh: "", token: "Linear API key", needUrl: false, needToken: true,  splitFields: false },
  gitlab:     { url: "GitLab project URL", urlPh: "https://gitlab.com/acme/api", token: "GitLab personal access token", needUrl: true,  needToken: true,  splitFields: false },
  azuredevops:{ url: "Azure DevOps project URL", urlPh: "https://dev.azure.com/acme/Project", token: "Azure DevOps PAT", needUrl: true,  needToken: true,  splitFields: false },
  clickup:    { url: "", urlPh: "", token: "ClickUp API token", needUrl: false, needToken: true,  splitFields: false },
  shortcut:   { url: "", urlPh: "", token: "Shortcut API token", needUrl: false, needToken: true,  splitFields: false },
  youtrack:   { url: "YouTrack instance URL", urlPh: "https://acme.youtrack.cloud", token: "YouTrack permanent token", needUrl: true,  needToken: true,  splitFields: false },
  asana:      { url: "", urlPh: "", token: "Asana PAT", needUrl: false, needToken: true,  splitFields: false },
  trello:     { url: "", urlPh: "", token: "Trello API key:token", needUrl: false, needToken: true,  splitFields: false },
  notion:     { url: "", urlPh: "", token: "Notion integration token", needUrl: false, needToken: true,  splitFields: false },
  pivotal:    { url: "Pivotal Tracker project URL", urlPh: "https://www.pivotaltracker.com/n/projects/123", token: "Pivotal Tracker API token", needUrl: true,  needToken: true,  splitFields: false },
  http:       { url: "Middleware endpoint (GET /ticket/:id)", urlPh: "https://tickets.internal.acme.com", token: "Bearer token (optional)", needUrl: true, needToken: true,  splitFields: false },
  remote:     { url: "", urlPh: "", token: "", needUrl: false, needToken: false, splitFields: false },
};

function ticketsProviderHint() {
  const h = TK_HINTS[document.getElementById("tk-provider").value];
  document.getElementById("tk-url-row").style.display = h.needUrl ? "" : "none";
  document.getElementById("tk-token-row").style.display = (h.needToken && !h.splitFields) ? "" : "none";
  document.getElementById("tk-email-row").style.display = h.splitFields ? "" : "none";
  document.getElementById("tk-apitoken-row").style.display = h.splitFields ? "" : "none";
  if (h.needUrl) {
    document.getElementById("tk-url-label").textContent = h.url;
    document.getElementById("tk-url").placeholder = h.urlPh;
  }
  if (h.needToken) document.getElementById("tk-token-label").textContent = h.token + " — stored on this machine only, never in the repo";
}

function getTkCredential() {
  const h = TK_HINTS[document.getElementById("tk-provider").value];
  if (h.splitFields) {
    const email = document.getElementById("tk-email").value.trim();
    const apiToken = document.getElementById("tk-apitoken").value.trim();
    if (email && apiToken) return email + ":" + apiToken;
    if (apiToken) return apiToken;
    return email || undefined;
  }
  return document.getElementById("tk-token").value.trim() || undefined;
}

function inferTicketPattern() {
  const samples = document.getElementById("tk-samples").value.trim();
  if (!samples) { toast("Enter sample ticket IDs first", "warning"); return; }
  const ids = samples.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  if (!ids.length) { toast("Enter sample ticket IDs first", "warning"); return; }
  // Try to find a common pattern: PREFIX-NUMBER (case-insensitive)
  const match = ids.every(id => /^[A-Za-z][A-Za-z0-9]+-\d+$/.test(id));
  if (match) {
    const prefix = ids[0].match(/^([A-Za-z][A-Za-z0-9]+)-/)[1].toUpperCase();
    document.getElementById("tk-pattern").value = prefix + "-\\d+";
    toast("Inferred pattern: " + prefix + "-\\d+", "success");
    return;
  }
  // Try GitHub-style #NNN
  if (ids.every(id => /^#?\d+$/.test(id.replace(/^#/, "")))) {
    document.getElementById("tk-pattern").value = "#?\\d+";
    toast("Inferred pattern: #?\\d+", "success");
    return;
  }
  // Fallback: try to infer from first id with any prefix
  const m = ids[0].match(/^([A-Za-z]+)-(\d+)$/);
  if (m) {
    document.getElementById("tk-pattern").value = m[1].toUpperCase() + "-\\d+";
    toast("Inferred pattern: " + m[1].toUpperCase() + "-\\d+", "success");
  } else {
    toast("Could not infer pattern from samples — enter manually", "error");
  }
}

function openTickets() {
  const t = state && state.tickets;
  const team = state && state.teamTickets;
  const cloud = state && state.cloud;
  const isRemote = t && t.provider === "remote";
  const displayProvider = isRemote && team ? team.provider : (t ? t.provider : null);
  const logo = displayProvider ? (PROVIDER_LOGOS[displayProvider] || IC_TICKET) : team ? (PROVIDER_LOGOS[team.provider] || IC_TICKET) : IC_TICKET;
  document.getElementById("tk-status").innerHTML = t
    ? \`<div style="display:flex;align-items:center;gap:6px">\${logo} Connected: \${esc(displayProvider)}\${t.baseUrl ? " at " + esc(t.baseUrl) : ""} (\${isRemote ? "team credentials on server" : t.hasCredential ? "credential stored" : IC_WARN + " NO CREDENTIAL"})</div>\`
    : team
    ? \`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\${logo} Your team has <b>\${esc(team.provider)}</b> tickets on the server. <button type="button" class="primary" style="padding:2px 10px;font-size:12px" onclick="ticketsConnectRemote()">Connect now</button></div>\`
    : "No ticketing app connected — proposals will miss the why from your tickets.";
  var adminSection = document.getElementById('tk-admin-section');
  if (adminSection) adminSection.style.display = (cloud && cloud.hasToken) ? 'none' : '';
  if (t) {
    document.getElementById("tk-provider").value = t.provider;
    var provLabel = isRemote && team ? team.provider.charAt(0).toUpperCase() + team.provider.slice(1) : t.provider.charAt(0).toUpperCase() + t.provider.slice(1);
    if ((isRemote && team ? team.provider : t.provider) === 'github') provLabel = 'GitHub Issues';
    if ((isRemote && team ? team.provider : t.provider) === 'gitlab') provLabel = 'GitLab Issues';
    if ((isRemote && team ? team.provider : t.provider) === 'azuredevops') provLabel = 'Azure DevOps';
    if ((isRemote && team ? team.provider : t.provider) === 'http') provLabel = 'HTTP middleware';
    if (isRemote) provLabel = provLabel + ' (remote)';
    var provIcon = isRemote && team ? (PROVIDER_LOGOS[team.provider] || IC_REMOTE) : (PROVIDER_LOGOS[t.provider] || '');
    document.getElementById('tk-provider-label').innerHTML = provIcon + ' ' + provLabel;
    if (t.baseUrl) document.getElementById("tk-url").value = t.baseUrl;
    document.getElementById("tk-pattern").value = (isRemote && team && team.pattern) ? team.pattern : (t.pattern || "");
    document.getElementById('tk-provider-btn').disabled = isRemote;
    document.getElementById('tk-samples').disabled = isRemote;
    document.getElementById('tk-pattern').disabled = isRemote;
    document.getElementById('tk-test').disabled = isRemote;
    document.getElementById('tk-validate-btn').disabled = isRemote;
    document.querySelector('button[onclick="inferTicketPattern()"]').disabled = isRemote;
  } else if (team) {
    document.getElementById("tk-provider").value = "remote";
    var teamIcon = PROVIDER_LOGOS["remote"] || '';
    document.getElementById('tk-provider-label').innerHTML = teamIcon + ' Remote (team server)';
    if (team.pattern) document.getElementById("tk-pattern").value = team.pattern;
    document.getElementById('tk-provider-btn').disabled = false;
    document.getElementById('tk-samples').disabled = false;
    document.getElementById('tk-pattern').disabled = false;
    document.getElementById('tk-test').disabled = false;
    ticketsProviderHint();
  }
  ticketsProviderHint();
  document.getElementById("dlg-tickets").showModal();
}

async function ticketsValidate() {
  const id = document.getElementById("tk-test").value.trim();
  if (!id) { toast("Enter a ticket id to validate"); return; }
  const btn = document.getElementById("tk-validate-btn");
  const resultEl = document.getElementById("tk-validate-result");
  btn.disabled = true; btn.textContent = "Validating…";
  resultEl.style.display = "none";
  try {
    const r = await api("/api/tickets/validate", { method: "POST", body: JSON.stringify({ testId: id }) });
    const t = r.ticket;
    resultEl.style.display = "";
    resultEl.innerHTML = '<span style="color:var(--verified)">' + IC_CHECK_C + ' Validated: ' + esc(t.id) + ' — ' + esc(t.title) + '</span>';
  } catch (e) {
    resultEl.style.display = "";
    resultEl.innerHTML = '<span style="color:var(--refuted)">' + IC_WARN + ' ' + esc(e.message) + '</span>';
  } finally {
    btn.disabled = false; btn.textContent = "Validate";
  }
}

async function ticketsConnect() {
  try {
    const r = await api("/api/tickets/connect", {
      method: "POST",
      body: JSON.stringify({
        provider: document.getElementById("tk-provider").value,
        baseUrl: document.getElementById("tk-url").value.trim() || undefined,
        token: getTkCredential(),
        pattern: document.getElementById("tk-pattern").value.trim() || undefined,
      }),
    });
    document.getElementById("tk-token").value = "";
    document.getElementById("tk-email").value = "";
    document.getElementById("tk-apitoken").value = "";
    document.getElementById("dlg-tickets").close();
    toast("Tickets connected");
    await load();
  } catch (e) { document.getElementById("dlg-tickets").close(); toast("Error: " + e.message); }
}

async function ticketsConnectRemote() {
  try {
    await api("/api/tickets/connect", {
      method: "POST",
      body: JSON.stringify({ provider: "remote", pattern: document.getElementById("tk-pattern").value.trim() || undefined }),
    });
    document.getElementById("dlg-tickets").close();
    toast("Connected to team tickets via remote server");
    await load();
  } catch (e) { toast("Error: " + e.message); }
}

async function ticketsDisconnect() {
  try { await api("/api/tickets/disconnect", { method: "POST" }); document.getElementById("dlg-tickets").close(); toast("Tickets disconnected"); await load(); }
  catch (e) { document.getElementById("dlg-tickets").close(); toast("Error: " + e.message); }
}

async function ticketsShare(remove) {
  const cloud = state && state.cloud;
  const adminToken = document.getElementById("tk-admin").value.trim();
  if (!adminToken && !(cloud && cloud.hasToken)) { toast("Admin token required (or link a cloud server first)"); return; }
  try {
    await api("/api/tickets/share", {
      method: "POST",
      body: JSON.stringify(remove ? { adminToken: adminToken || undefined, remove: true } : {
        adminToken: adminToken || undefined,
        provider: document.getElementById("tk-provider").value,
        baseUrl: document.getElementById("tk-url").value.trim() || undefined,
        credential: getTkCredential(),
        pattern: document.getElementById("tk-pattern").value.trim() || undefined,
      }),
    });
    document.getElementById("tk-token").value = "";
    document.getElementById("tk-email").value = "";
    document.getElementById("tk-apitoken").value = "";
    toast(remove ? "Team ticket config removed" : "Team credentials stored on the server — teammates use provider 'remote'");
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- actions tab

let knowledgeInfo = null;

let healthData = null;
let analyticsData = null;

async function loadHealth() {
  const el = document.getElementById("health-content");
  if (!el) return;
  el.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const [h, a] = await Promise.all([
      api("/api/health"),
      api("/api/analytics?days=30"),
    ]);
    healthData = h;
    analyticsData = a;
    renderHealth();
  } catch (e) {
    el.innerHTML = '<div class="empty">Failed to load health data: ' + esc(e.message) + '</div>';
  }
}

function riskColor(score) {
  if (score >= 80) return COLORS.REFUTED;
  if (score >= 60) return "#f97316";
  if (score >= 30) return COLORS.STALE;
  return COLORS.VERIFIED;
}

function riskLevel(score) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function renderHealth() {
  const el = document.getElementById("health-content");
  if (!el || !healthData) return;
  const h = healthData;
  const a = analyticsData;
  const s = h.summary;
  let html = "";

  // Risk score banner
  const rc = riskColor(s.riskScore);
  const rl = riskLevel(s.riskScore);
  html += '<div class="health-section">';
  html += '<h3>Overall Risk Score</h3>';
  html += '<div class="health-card" style="display:flex;align-items:center;gap:16px">';
  html += '<div class="value" style="color:' + rc + '">' + s.riskScore + '</div>';
  html += '<div style="flex:1"><div class="risk-bar"><div class="risk-bar-fill" style="width:' + s.riskScore + '%;background:' + rc + '"></div></div>';
  html += '<div class="detail" style="margin-top:4px">Level: <b>' + rl + '</b> — ' + (s.riskScore < 30 ? "store is healthy" : s.riskScore < 60 ? "some areas need attention" : s.riskScore < 80 ? "elevated risk" : "critical risk") + '</div></div>';
  html += '</div></div>';

  // Summary metrics grid
  html += '<div class="health-section"><h3>Memory Summary</h3><div class="health-grid">';
  html += healthCard("Total Memories", s.total, "good", (state && state.cloud) ? (state.cloud.server && state.cloud.server.includes("cloud.aidimag.com") ? SVG_AIDIMAG: IC_BRAIN) : IC_BRAIN);
  html += healthCard("Verified", s.byStatus.VERIFIED, "good", IC_CHECK_C);
  html += healthCard("Unverified", s.unverified, s.unverified > 5 ? "warning" : "", IC_CANCEL);
  html += healthCard("Stale", s.stale, s.stale > 0 ? "warning" : "good", IC_SCROLL_OLD);
  html += healthCard("Refuted", s.refuted, s.refuted > 0 ? "danger" : "good", IC_WARN);
  html += healthCard("Failed Approaches", s.failedApproaches, s.failedApproaches > 0 ? "warning" : "", IC_STOP);
  html += healthCard("Pending Proposals", s.pendingProposals, s.pendingProposals > 0 ? "warning" : "", IC_HOURGLASS);
  html += healthCard("Pinned", s.pinned, "good", IC_PIN);
  html += healthCard("Coverage Paths", s.coveragePaths, "", IC_PATH);
  html += '</div></div>';

  // Coverage heatmap
  if (h.topRisks && h.topRisks.length > 0) {
    html += '<div class="health-section"><h3>Coverage Heatmap (Top Risk Paths)</h3>';
    html += '<div class="heatmap-grid">';
    for (const r of h.topRisks) {
      const rc2 = riskColor(r.riskScore);
      const opacity = Math.max(0.15, r.riskScore / 100);
      html += '<div class="heatmap-cell" style="border-left:3px solid ' + rc2 + '">';
      html += '<div class="path" title="' + esc(r.path) + '">' + esc(r.path) + '</div>';
      html += '<div class="stats">';
      html += '<span>' + r.memories + ' mem</span>';
      if (r.stale > 0) html += '<span style="color:' + COLORS.STALE + '">' + r.stale + ' stale</span>';
      if (r.guardrails > 0) html += '<span>🛡 ' + r.guardrails + '</span>';
      if (r.failedApproaches > 0) html += '<span style="color:' + COLORS.REFUTED + '">' + r.failedApproaches + ' failed</span>';
      html += '</div>';
      html += '<div class="risk-bar" style="margin-top:6px"><div class="risk-bar-fill" style="width:' + r.riskScore + '%;background:' + rc2 + '"></div></div>';
      html += '</div>';
    }
    html += '</div></div>';
  }

  // Trend charts from analytics
  if (a) {
    // Verify trend chart
    if (a.verifyTrend && a.verifyTrend.length > 0) {
      html += '<div class="health-section"><h3>Verify Pass Rate (Last 30 Days)</h3>';
      html += '<div class="trend-chart">';
      const maxVal = Math.max(...a.verifyTrend.map(d => d.total || 1), 1);
      for (const d of a.verifyTrend) {
        const passRate = d.passRate ?? (d.total > 0 ? Math.round((d.verified / d.total) * 100) : 0);
        const heightPct = Math.max(2, (d.total / maxVal) * 100);
        const color = riskColor(passRate >= 80 ? 20 : passRate >= 50 ? 40 : 85);
        html += '<div class="trend-bar" style="height:' + heightPct + '%;background:' + color + '">';
        html += '<div class="tooltip">' + d.date + ': ' + d.verified + '/' + d.total + ' (' + passRate + '%)</div>';
        html += '</div>';
      }
      html += '</div>';
      html += '<div class="detail" style="margin-top:4px">Bars show daily verify volume; color = pass rate (green ≥80%, yellow ≥50%, red <50%)</div>';
      html += '</div>';
    }

    // Token usage trend
    if (a.tokenUsage && a.tokenUsage.daily && a.tokenUsage.daily.length > 0) {
      html += '<div class="health-section"><h3>Token Usage (Last 30 Days)</h3>';
      html += '<div class="trend-chart">';
      const maxTokens = Math.max(...a.tokenUsage.daily.map(d => d.tokensRequested || 1), 1);
      for (const d of a.tokenUsage.daily) {
        const heightPct = Math.max(2, ((d.tokensRequested || 0) / maxTokens) * 100);
        html += '<div class="trend-bar" style="height:' + heightPct + '%;background:hsl(var(--primary))">';
        html += '<div class="tooltip">' + d.date + ': requested ' + (d.tokensRequested || 0) + ', delivered ' + (d.tokensDelivered || 0) + ', saved ' + (d.tokensSaved || 0) + '</div>';
        html += '</div>';
      }
      html += '</div>';
      html += '<div class="detail" style="margin-top:4px">Total tokens saved: <b>' + (a.tokenUsage.totalSaved || 0) + '</b> across ' + (a.tokenUsage.totalRequests || 0) + ' requests</div>';
      html += '</div>';
    }

    // Proposal throughput
    if (a.proposals && (a.proposals.created > 0 || a.proposals.pending > 0)) {
      html += '<div class="health-section"><h3>Proposal Throughput</h3><div class="health-grid">';
      html += healthCard("Proposed", a.proposals.created, "");
      html += healthCard("Approved", a.proposals.approved, "good");
      html += healthCard("Rejected", a.proposals.rejected, "");
      html += healthCard("Pending", a.proposals.pending, a.proposals.pending > 0 ? "warning" : "");
      const rate = a.proposals.created > 0 ? Math.round((a.proposals.approved / a.proposals.created) * 100) : 0;
      html += healthCard("Approval Rate", rate + "%", rate >= 70 ? "good" : rate >= 40 ? "warning" : "");
      html += '</div></div>';
    }

    // Agent activity
    if (a.agentActivity && a.agentActivity.length > 0) {
      html += '<div class="health-section"><h3>Agent Activity</h3><div class="health-grid">';
      for (const ag of a.agentActivity.slice(0, 6)) {
        html += healthCard(ag.agent || "unknown", ag.events + " events", "");
      }
      html += '</div></div>';
    }
  }

  // Alerts
  if (h.alerts && h.alerts.length > 0) {
    html += '<div class="health-section"><h3>Alerts</h3>';
    html += '<div style="background:hsl(var(--muted));border-radius:8px;padding:12px 16px;border-left:3px solid ' + COLORS.STALE + '">';
    for (const alert of h.alerts) {
      html += '<div style="font-size:13px;margin-bottom:4px">' + esc(alert) + '</div>';
    }
    html += '</div></div>';
  }

  // Repeated-mistake trends
  if (h.repeatedMistakeTrends && h.repeatedMistakeTrends.length > 0) {
    html += '<div class="health-section"><h3>Repeated-Mistake Trends</h3>';
    html += '<div class="detail" style="margin-bottom:12px">Areas with recurring FAILED_APPROACH memories. Trend direction shows whether failures are increasing or decreasing over time.</div>';
    for (const t of h.repeatedMistakeTrends.slice(0, 8)) {
      const trendIcon = t.trend === "increasing" ? "📈" : t.trend === "decreasing" ? "📉" : "➡️";
      const trendColor = t.trend === "increasing" ? COLORS.REFUTED : t.trend === "decreasing" ? COLORS.VERIFIED : COLORS.STALE;
      html += '<div class="card" style="margin-bottom:8px;padding:12px 16px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
      html += '<div style="font-weight:600;font-size:13px">' + trendIcon + ' ' + esc(t.area) + '</div>';
      html += '<div style="font-size:12px;color:' + trendColor + ';font-weight:600;text-transform:uppercase">' + esc(t.trend) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:12px">';
      html += '<div style="font-size:24px;font-weight:700;color:' + trendColor + '">' + t.count + '</div>';
      html += '<div style="flex:1">';
      // Mini timeline: show dots for each failure date
      if (t.dates && t.dates.length > 0) {
        const dates = t.dates.slice().sort();
        const first = new Date(dates[0]).getTime();
        const last = new Date(dates[dates.length - 1]).getTime();
        const span = Math.max(1, last - first);
        html += '<div style="position:relative;height:20px;margin:4px 0">';
        for (const d of dates) {
          const dt = new Date(d).getTime();
          const pct = ((dt - first) / span) * 100;
          html += '<div style="position:absolute;left:' + pct + '%;top:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:' + trendColor + '" title="' + esc(d) + '"></div>';
        }
        html += '<div style="position:absolute;left:0;top:50%;width:100%;height:2px;background:hsl(var(--border));transform:translateY(-50%)"></div>';
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:hsl(var(--muted-foreground))">';
        html += '<span>' + esc(dates[0].slice(0, 10)) + '</span>';
        html += '<span>' + esc(dates[dates.length - 1].slice(0, 10)) + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Suggestions
  if (h.suggestions && h.suggestions.length > 0) {
    html += '<div class="health-section"><h3>Suggestions</h3><ul class="health-suggestions">';
    for (const sug of h.suggestions) {
      html += '<li><span class="suggestion-icon">💡</span>' + esc(sug) + '</li>';
    }
    html += '</ul></div>';
  }

  // Oldest stale memories
  if (h.oldestStale && h.oldestStale.length > 0) {
    html += '<div class="health-section"><h3>Oldest Stale Memories</h3>';
    for (const m of h.oldestStale) {
      html += '<div class="card" style="margin-bottom:8px"><div class="claim">' + esc(m.claim) + '</div>';
      html += '<div class="meta"><span class="kind" style="color:' + (KIND_COLORS[m.kind] || 'hsl(var(--primary))') + '">' + m.kind + '</span><span class="status-' + m.status.toLowerCase() + '">' + m.status + '</span></div></div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

function healthCard(label, value, cls, icon) {
  return '<div class="health-card ' + (cls || '') + '"><div class="label">' + (icon ? icon + ' ' : '') + esc(String(label)) + '</div><div class="value">' + esc(String(value)) + '</div></div>';
}

// ── Critical Areas management ────────────────────────────────────────────────

let areasData = null;

async function loadAreas() {
  const el = document.getElementById("areas-list");
  if (!el) return;
  el.innerHTML = '<div class="empty">Loading critical areas…</div>';
  try {
    areasData = await api("/api/critical-areas");
    renderAreas();
  } catch (e) {
    el.innerHTML = '<div class="empty">Failed to load: ' + esc(e.message) + '</div>';
  }
}

function renderAreas() {
  const el = document.getElementById("areas-list");
  if (!el || !areasData) return;
  const areas = areasData.areas || [];
  if (areas.length === 0) {
    el.innerHTML = '<div class="empty">No critical areas defined. Click "Add Area" to protect sensitive code paths.</div>';
    return;
  }
  let html = "";
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i];
    html += '<div class="card" style="margin-bottom:12px;padding:16px" id="area-row-' + i + '">';
    html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">';
    html += '<input class="area-label" style="font-weight:600;font-size:14px;background:transparent;border:1px solid var(--border);border-radius:4px;padding:4px 8px;color:var(--fg)" value="' + esc(a.label || "") + '" placeholder="Area label (e.g. Authentication)" data-idx="' + i + '">';
    html += '<button class="icon" onclick="removeAreaRow(' + i + ')" title="Remove area" style="color:var(--danger)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    html += '</div>';
    html += '<label style="font-size:12px;color:var(--muted)">Paths (one per line)</label>';
    html += '<textarea class="area-paths" style="width:100%;min-height:60px;margin:4px 0 12px;font-family:monospace;font-size:13px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px;color:var(--fg)" placeholder="src/auth&#10;src/auth/**" data-idx="' + i + '">' + esc((a.paths || []).join("\\n")) + '</textarea>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    html += '<div><label style="font-size:12px;color:var(--muted)">Owners (comma-separated)</label>';
    html += '<input class="area-owners" style="width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--fg)" value="' + esc((a.owners || []).join(", ")) + '" placeholder="@alice, @bob" data-idx="' + i + '"></div>';
    html += '<div><label style="font-size:12px;color:var(--muted)">Approval token</label>';
    html += '<input class="area-token" style="width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--fg)" value="' + esc(a.approvalToken || "") + '" placeholder="[CRITICAL-OK]" data-idx="' + i + '"></div>';
    html += '</div>';
    html += '<div style="margin-top:12px"><label style="font-size:12px;color:var(--muted)">Required tests (comma-separated)</label>';
    html += '<input class="area-tests" style="width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--fg)" value="' + esc((a.requiredTests || []).join(", ")) + '" placeholder="npm test -- --grep auth" data-idx="' + i + '"></div>';
    html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px">';
    html += '<label style="font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer">';
    html += '<input type="checkbox" class="area-block"' + (a.block !== false ? " checked" : "") + ' data-idx="' + i + '"> Block unapproved changes (uncheck to warn only)';
    html += '</label>';
    html += '</div>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function addAreaRow() {
  if (!areasData) areasData = { areas: [] };
  areasData.areas.push({ paths: [], label: "New Area", block: true });
  renderAreas();
}

function removeAreaRow(idx) {
  if (!areasData) return;
  areasData.areas.splice(idx, 1);
  renderAreas();
}

async function saveAreas() {
  if (!areasData) return;
  const statusEl = document.getElementById("areas-status");
  if (statusEl) statusEl.textContent = "Saving…";

  // Read form values back into areasData
  const labels = document.querySelectorAll(".area-label");
  const pathsEls = document.querySelectorAll(".area-paths");
  const ownersEls = document.querySelectorAll(".area-owners");
  const tokenEls = document.querySelectorAll(".area-token");
  const testsEls = document.querySelectorAll(".area-tests");
  const blockEls = document.querySelectorAll(".area-block");

  for (let i = 0; i < areasData.areas.length; i++) {
    const labelEl = document.querySelector('.area-label[data-idx="' + i + '"]');
    const pathsEl = document.querySelector('.area-paths[data-idx="' + i + '"]');
    const ownersEl = document.querySelector('.area-owners[data-idx="' + i + '"]');
    const tokenEl = document.querySelector('.area-token[data-idx="' + i + '"]');
    const testsEl = document.querySelector('.area-tests[data-idx="' + i + '"]');
    const blockEl = document.querySelector('.area-block[data-idx="' + i + '"]');

    if (labelEl) areasData.areas[i].label = labelEl.value.trim() || "Unnamed";
    if (pathsEl) areasData.areas[i].paths = pathsEl.value.split("\\n").map(s => s.trim()).filter(Boolean);
    if (ownersEl) areasData.areas[i].owners = ownersEl.value.split(",").map(s => s.trim()).filter(Boolean);
    if (tokenEl) areasData.areas[i].approvalToken = tokenEl.value.trim() || undefined;
    if (testsEl) areasData.areas[i].requiredTests = testsEl.value.split(",").map(s => s.trim()).filter(Boolean);
    if (blockEl) areasData.areas[i].block = blockEl.checked;
  }

  // Filter out areas with no paths
  areasData.areas = areasData.areas.filter(a => a.paths.length > 0);

  try {
    await api("/api/critical-areas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(areasData),
    });
    if (statusEl) statusEl.textContent = "Saved";
    renderAreas();
    setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 2000);
  } catch (e) {
    if (statusEl) statusEl.textContent = "Error: " + e.message;
  }
}

function switchTab(name) {
  document.body.classList.toggle("tab-actions", name === "actions");
  document.body.classList.toggle("tab-health", name === "health");
  document.body.classList.toggle("tab-areas", name === "areas");
  document.getElementById("tab-overview").classList.toggle("active", name === "overview");
  document.getElementById("tab-health").classList.toggle("active", name === "health");
  document.getElementById("tab-actions").classList.toggle("active", name === "actions");
  document.getElementById("tab-areas").classList.toggle("active", name === "areas");
  document.getElementById("tab-overview").setAttribute("aria-selected", String(name === "overview"));
  document.getElementById("tab-health").setAttribute("aria-selected", String(name === "health"));
  document.getElementById("tab-actions").setAttribute("aria-selected", String(name === "actions"));
  document.getElementById("tab-areas").setAttribute("aria-selected", String(name === "areas"));
  localStorage.setItem("aidimag-ui-tab", name);
  if (name === "overview" && state) renderGraph();
  if (name === "health") loadHealth();
  if (name === "areas") loadAreas();
}

async function refreshKnowledgeStatus() {
  try {
    knowledgeInfo = await api("/api/knowledge/status");
    renderActionsView();
  } catch { /* endpoint unavailable — badge stays hidden */ }
}

function showOutput(title, html, followUps) {
  document.getElementById("out-title").innerHTML = title;
  document.getElementById("out-body").innerHTML = html;
  const actions = document.getElementById("out-actions");
  actions.innerHTML = "";
  (followUps || []).forEach((f) => {
    const b = document.createElement("button");
    if (f.primary) b.className = "primary";
    if (f.danger) b.className = "danger";
    b.textContent = f.label;
    b.onclick = f.onClick;
    actions.appendChild(b);
  });
  const close = document.createElement("button");
  close.textContent = "Close";
  close.onclick = () => document.getElementById("dlg-output").close();
  actions.appendChild(close);
  document.getElementById("dlg-output").showModal();
}

function copyCli(cmd, why) {
  navigator.clipboard.writeText(cmd)
    .then(() => toast("Copied '" + cmd + "' — " + (why || "paste it into your terminal")))
    .catch(() => toast("Run in your terminal: " + cmd));
}

function showConfirm(title, body) {
  const dlg = document.getElementById("dlg-confirm");
  document.getElementById("confirm-title").innerHTML = title;
  document.getElementById("confirm-body").textContent = body;
  const okBtn = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");
  return new Promise((resolve) => {
    const cleanup = () => {
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      dlg.removeEventListener("close", onClose);
    };
    const onClose = () => { cleanup(); resolve(false); };
    okBtn.onclick = () => { cleanup(); dlg.close(); resolve(true); };
    cancelBtn.onclick = () => { cleanup(); dlg.close(); resolve(false); };
    dlg.addEventListener("close", onClose);
    dlg.showModal();
  });
}

// The catalog: every aidimag capability as a grouped, self-explaining card.
const ACTION_GROUPS = [
  {
    icon: IC_DIAMOND, title: "Core", sub: "Capture, review, and verify your project's memory",
    actions: [
      { id: "add-memory", icon: IC_PLUS, title: "Add Memory", cli: "dim remember",
        desc: "Write a falsifiable claim about this repo, with optional evidence.",
        help: "Stores a durable memory: a claim a check could verify (e.g. 'all DB access goes through src/db/store.ts'). Add kind, scope paths, evidence, and pin it if it should never decay.",
        run: () => document.getElementById("dlg-new").showModal() },
      { id: "mine", icon: IC_PICK, title: "Mine Commits", cli: "dim mine",
        desc: "Scan new git commits for memory-worthy decisions and gotchas.",
        help: "Reads commit history since the last run and turns strong signals (reverts, fixes, decision keywords) into proposals for your review. Shift-click to rescan all history. For LLM-deep or PR mining run 'dim mine --llm' / 'dim mine --prs' in a terminal.",
        run: (ev) => runMine(ev) },
      { id: "bootstrap", icon: IC_BUILDING, title: "Build Initial Memory", cli: "dim bootstrap",
        desc: "Analyze the README, docs, and repository structure to create your first memories.",
        help: "Surveys README/docs/manifests/directory shape/churn and asks your LLM (Ollama or OPENAI_API_KEY) to extract 5–30 initial claims. Everything is queued for review — nothing is auto-saved. May take a few minutes. If no LLM is detected, you'll be prompted to set up Ollama.",
        run: () => runBootstrap() },
      { id: "harvest", icon: IC_CHAT, title: "Harvest AI Chats", cli: "dim harvest",
        desc: "Extract durable facts from your AI coding sessions.",
        help: "Scans local transcripts from Claude Code, Codex, Copilot, and Cursor for this repo, redacts secrets, and LLM-extracts durable facts *you* stated into proposals. Local-only; needs an LLM provider — you'll be prompted to set up Ollama if none is detected.",
        run: () => runHarvest() },
      { id: "knowledge", icon: IC_BOOK, title: "Import Knowledge", cli: "dim knowledge sync",
        desc: "Summarize documents in the knowledge/ folder into memory proposals.",
        help: "Any md/pdf/docx dropped into the knowledge inbox is LLM-summarized into falsifiable claims and queued for review. The dashboard also auto-ingests while it's running.",
        badge: () => knowledgeInfo && knowledgeInfo.pending.length ? knowledgeInfo.pending.length : 0,
        run: () => runKnowledgeSync() },
      { id: "review", icon: IC_CHECK_C, title: "Review Proposals", cli: "dim review",
        desc: "Approve or reject memories mined, harvested, or imported into the review queue.",
        help: "Nothing captured automatically becomes memory until you approve it. Opens the Overview tab where each pending proposal has Approve / Reject buttons.",
        badge: () => state ? state.proposals.length : 0,
        run: () => { switchTab("overview"); document.getElementById("proposals-h").scrollIntoView({ behavior: "smooth" }); } },
      { id: "verify", icon: IC_COGNITIVE, title: "Verify Memory", cli: "dim verify",
        desc: "Re-run available evidence and update memory statuses.",
        help: "Re-runs COMMIT_REF and STATIC_CHECK evidence. Passing evidence marks memories VERIFIED; failing evidence marks them STALE. Unverified memories decay in confidence over time.",
        run: () => runVerify(false) },
      { id: "brief", icon: IC_BRIEF, title: "Generate Session Briefing", cli: "dim brief",
        desc: "What to know before this session: memory, guardrails, warnings.",
        help: "Builds a briefing from your branch diff: in-scope memories, guardrails, stale warnings, coverage gaps, and clarifying questions to answer before coding.",
        run: () => runBrief() },
    ],
  },
  {
    icon: IC_SEARCH, title: "Analysis", sub: "Audit evidence, find gaps, and check for contradictions",
    actions: [
      { id: "audit", icon: IC_SEARCH, title: "Audit Memory Evidence", cli: "dim audit",
        desc: "Find memories supported by weak or missing evidence.",
        help: "Lists memories that are agent-authored, evidence-free, stale, or long-unverified — ranked by risk — so you can confirm, add evidence, or forget them.",
        run: () => runAudit() },
      { id: "gaps", icon: IC_HOLE, title: "Review Knowledge Gaps", cli: "dim gaps",
        desc: "Find questions your agents or searches couldn't answer.",
        help: "Every memory search that returned zero results is logged as a gap — the facts your brain is missing, most-asked first. Fill them with Add Memory.",
        badge: () => state ? state.gapCount : 0,
        run: () => runGaps() },
      { id: "check", icon: IC_FLASK, title: "Check Changes", cli: "dim check",
        desc: "Check staged changes for contradictions with active memories before committing.",
        help: "Analyzes your staged git diff against memories and guardrails scoped to the changed files: re-runs STATIC_CHECKs, trips 'never' guardrails, and reminds you of invariants.",
        run: () => runCheck() },
    ],
  },
  {
    icon: IC_PEOPLE, title: "Collaboration", sub: "Sync with your team and connect ticketing",
    actions: [
      { id: "cloud", icon: IC_CLOUD, title: "Connect Cloud", cli: "dim cloud link",
        desc: "Sync this project's memory with your team.",
        help: "Connect a self-hosted (dim serve) or cloud sync server. The token is stored on this machine only, never in the repo. Also manages brain-scoped API keys.",
        run: () => openCloud() },
      { id: "sync", icon: IC_SYNC, title: "Sync Now", cli: "dim sync",
        desc: "Push & pull memory with the linked team server.",
        help: "Exchanges memory events with your team brain. Synced-in executable evidence stays quarantined until you approve it via Review Synced Evidence.",
        disabled: () => state && !state.cloud ? "Connect a cloud server first" : null,
        run: () => runSync() },
      { id: "login", icon: IC_KEY, title: "Sign In", cli: "dim login",
        desc: "Approve this device using your browser.",
        help: "Starts a device-code flow: shows a code and opens the server's approval page in your browser. Polls until you approve.",
        disabled: () => state && !state.cloud ? "Connect a cloud server first" : null,
        run: () => runLogin() },
      { id: "logout", icon: IC_LOGOUT, title: "Sign Out", cli: "dim logout", danger: true,
        desc: "Remove this device's stored token.",
        help: "Deletes the sync token stored for this device.",
        disabled: () => state && !state.cloud ? "Connect a cloud server first" : null,
        run: () => runLogout() },
    ],
  },
  {
    icon: IC_BRANCH, title: "Ticketing", sub: "Connect, browse, create branches, and sync ticket context into memory",
    actions: [
      { id: "tickets", icon: () => state && state.tickets ? (state.tickets.provider === "remote" && state.teamTickets ? (PROVIDER_LOGOS[state.teamTickets.provider] || IC_TICKET) : (PROVIDER_LOGOS[state.tickets.provider] || IC_TICKET)) : IC_TICKET, title: "Connect Ticketing App", cli: "dim ticket connect",
        desc: "Jira, GitHub Issues, Linear, HTTP middleware or team server.",
        help: "Once connected, proposals mined from commits carry ticket context, and branch-naming conventions can be enforced by git hooks. Credentials stay on this machine.",
        run: () => openTickets() },
      { id: "ticket-show", icon: IC_EYE, title: "View Ticket", cli: "dim ticket show <id>",
        desc: "Fetch a ticket by id from the connected provider.",
        help: "Round-trips a ticket id through your provider config — great for checking the connection works and peeking at ticket context.",
        disabled: () => state && !state.tickets ? "Connect a ticket provider first" : null,
        run: () => document.getElementById("dlg-ticket-show").showModal() },
      { id: "branch", icon: IC_BRANCH, title: "Create Ticket Branch", cli: "dim branch <ticketId>",
        desc: "Create a convention-conforming branch for a ticket.",
        help: "Fetches the ticket details, extracts context into UNVERIFIED memories, and creates a branch like feature/PROJ-123. Creates the branch in your working tree.",
        disabled: () => state && !state.tickets ? "Connect a ticket provider first" : null,
        run: () => { document.getElementById("branch-ticket-id").value = ""; document.getElementById("dlg-branch").showModal(); } },
      { id: "branch-resync", icon: IC_REFRESH, title: "Resync Current Branch Ticket", cli: "dim branch --resync",
        desc: "Fetch updated ticket details for the current branch and create memories.",
        help: "Detects the ticket ID from your current git branch, fetches the latest ticket details from your provider, and creates UNVERIFIED memories if anything changed. Useful when ticket details are updated mid-sprint.",
        disabled: () => state && !state.tickets ? "Connect a ticket provider first" : null,
        run: () => runBranchResync() },
    ],
  },
  {
    icon: IC_GEAR, title: "Advanced", sub: "Deep verification, maintenance, and agent context export",
    actions: [
      { id: "verify-deep", icon: IC_SCOPE, title: "Deep Verify", cli: "dim verify --deep",
        desc: "Re-run all available evidence, including test results and execution traces.",
        help: "The expensive tier: executes test commands and traced executions too. Can take a while on large evidence sets.",
        run: () => runVerify(true) },
      { id: "verify-trust", icon: IC_SHIELD, title: "Review Synced Evidence", cli: "dim verify --trust",
        desc: "Approve evidence commands received through team sync before they can affect memory verification.",
        help: "Synced-in evidence commands are NEVER executed until you inspect and approve them. Shows each pending command with its memory claim and lets you approve all or individually.",
        run: () => runVerifyTrust() },
      { id: "gc", icon: IC_TRASH, title: "Clean Up Proposals", cli: "dim proposals gc", danger: true,
        desc: "Remove resolved proposals from the database. Runs as a dry-run first.",
        help: "Removes already approved/rejected proposal rows (tombstoned for team sync). Shows a dry-run count first, then asks for confirmation.",
        run: () => runProposalsGc() },
      { id: "gen-context", icon: IC_WING, title: "Generate Agent Context", cli: "dim generate-context",
        desc: "Export trusted memory into CLAUDE.md, .cursorrules, and other agent context files.",
        help: "Writes your verified/unverified memory into static context files that coding agents read automatically (Claude Code, Cursor, Copilot, Windsurf, generic AGENTS.md).",
        run: () => document.getElementById("dlg-context").showModal() },
      { id: "reindex", icon: IC_CALC, title: "Reindex Embeddings", cli: "dim reindex",
        desc: "Rebuild semantic search vectors for all memories.",
        help: "Regenerates embeddings using a dedicated embedding model (Ollama nomic-embed-text, OpenAI text-embedding-3-small, or AWS Bedrock Titan). Requires one of these providers — the MCP/LLM chat model cannot generate embeddings. Without a provider, search falls back to keyword (FTS) only, which still works fine for most repos.",
        run: () => runReindex() },
      { id: "setup-ollama", icon: IC_OLLAMA, title: "Setup Ollama", cli: "dim setup-ollama",
        desc: "Install Ollama and pull a free local embedding model for semantic search.",
        help: "Installs Ollama (via Homebrew or install script), starts the server, and lets you pick an embedding model (all-minilm ~45MB, nomic-embed-text ~274MB recommended, mxbai-embed-large ~670MB, or snowflake-arctic-embed ~1.2GB). If you already have Ollama, detects pulled embedding models and offers to reuse them. Free and fully local — no API key needed.",
        run: () => runSetupOllama() },
      { id: "hermes", icon: IC_HERMES, title: "Install Hermes Agent", cli: "dim hermes install",
        desc: "Register aidimag as a native Hermes memory provider.",
        help: "Installs a stdlib-only Python bridge into $HERMES_HOME/plugins/aidimag that delegates to the MCP server. Session briefings are injected into the system prompt, recall is prefetched per turn, and learnings become review-queue proposals.",
        run: () => runHermesInstall() },
      { id: "scratch-jot", icon: IC_WRITING, title: "Jot Note", cli: "dim scratch",
        desc: "Quick working note. Expires in 24 h by default.",
        help: "Session working memory for hypotheses, plans and intermediate findings. TTL-expiring, local-only, never becomes durable memory — promote anything worth keeping via Add Memory.",
        run: () => document.getElementById("dlg-note").showModal() },
      { id: "scratch-view", icon: IC_BOOK_O, title: "View Notes", cli: "dim scratch --all",
        desc: "List current (unexpired) scratchpad notes.",
        help: "Shows all unexpired scratchpad notes across sessions, newest first.",
        badge: () => state ? state.scratchCount : 0,
        run: () => runShowNotes() },
      { id: "scratch-clear", icon: IC_BROOM, title: "Clear Notes", cli: "dim scratch --clear --all", danger: true,
        desc: "Delete all scratchpad notes.",
        help: "Permanently deletes every scratchpad note in every session. They would expire on their own anyway.",
        run: () => runClearNotes() },
      { id: "refresh", icon: IC_REFRESH, title: "Refresh Data", cli: "—",
        desc: "Reload memories, proposals and status from disk.",
        help: "Re-reads the local aidimag database and refreshes every widget on this page.",
        run: () => { toast("Refreshing…"); load(); } },
      { id: "reset-onboarding", icon: IC_GRAD, title: "Reset Onboarding", cli: "—",
        desc: "Show the first-time dashboard tour again.",
        help: "Re-enables the onboarding overlay that appears on first dashboard open. Reload the page after clicking to see it.",
        run: () => runResetOnboarding() },
    ],
  },
];

function statCard(label, value, sub, attention, onclick, id, connected, icon) {
  return '<div class="stat' + (attention ? " attention" : "") + (onclick ? " stat-clickable" : "") + '"' + (id ? ' id="' + id + '"' : "") + (onclick ? ' onclick="' + onclick + '"' : "") + '>' +
    (connected ? '<div class="stat-connected-badge" title="Connected">' + IC_CHECK_C + '</div>' : "") +
    '<div class="stat-label">' + (icon ? '<span class="stat-icon">' + icon + '</span>' : "") + label + '</div>' +
    '<div class="stat-value">' + value + '</div>' +
    (sub ? '<div class="stat-sub">' + sub + '</div>' : "") + '</div>';
}

let mcpStatus = null;

async function refreshMcpStatus() {
  try {
    mcpStatus = await api("/api/mcp/status");
    renderIntegrationPanel();
  } catch { /* endpoint unavailable */ }
}

function renderIntegrationPanel() {
  const el = document.getElementById("integration-panel");
  if (!el || !mcpStatus) return;

  const cfg = mcpStatus;
  const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const attrEsc = (s) => esc(s).replace(/"/g,"&quot;").replace(/'/g,"&#39;");

  const configRows = cfg.agentConfigs.map((ac) => {
    const icon = ac.exists ? IC_CHECK_C : IC_WARN;
    const logo = AGENT_LOGOS[ac.name] || "";
    const mtime = ac.mtime ? new Date(ac.mtime).toLocaleDateString() : "";
    return '<tr><td>' + icon + '</td><td>' + logo + ' ' + esc(ac.name) + '</td><td><code>' + esc(ac.file) + '</code></td><td>' + (ac.exists ? '<span class="ip-ok">exists' + (mtime ? " · " + mtime : "") + '</span>' : '<span class="ip-off">not generated</span>') + '</td></tr>';
  }).join("");

  const hermesBadge = cfg.hermes.installed
    ? '<span class="ip-ok">' + IC_CHECK_C + ' Installed' + (cfg.hermes.path ? ' · <code>' + esc(cfg.hermes.path) + '</code>' : '') + '</span>'
    : '<span class="ip-off">' + IC_DOWN + ' Not installed</span>';

  el.innerHTML =
    '<div class="ip-card">' +
      '<div class="ip-head"><span class="ip-icon">' + IC_MCP + '</span><h3>Integrations</h3>' +
        '<span class="ip-sub">MCP server, agent config files, and Hermes status</span></div>' +

      '<div class="ip-section">' +
        '<div class="ip-label">MCP server command</div>' +
        '<div class="ip-cmd-row"><code>' + esc(cfg.mcpCommand) + '</code>' +
          '<button class="ip-copy" data-copy="' + attrEsc(cfg.mcpCommand) + '">Copy</button></div>' +
        '<div class="ip-label" style="margin-top:8px">Env var</div>' +
        '<div class="ip-cmd-row"><code>' + esc(cfg.envVar) + '</code>' +
          '<button class="ip-copy" data-copy="' + attrEsc(cfg.envVar) + '">Copy</button></div>' +
      '</div>' +

      '<div class="ip-section">' +
        '<div class="ip-label">Agent config snippet <span class="ip-hint">(paste into .mcp.json or your agent&#39;s MCP settings)</span></div>' +
        '<pre class="ip-snippet">' + esc(cfg.snippet) + '</pre>' +
        '<button class="ip-copy" data-copy="' + attrEsc(cfg.snippet) + '">Copy snippet</button>' +
      '</div>' +

      '<div class="ip-section">' +
        '<div class="ip-label">Agent config files</div>' +
        '<table class="ip-table"><thead><tr><th></th><th>Agent</th><th>File</th><th>Status</th></tr></thead><tbody>' +
          configRows +
        '</tbody></table>' +
        '<div class="ip-hint" style="margin-top:6px">Generate with <code>dim generate-context --format all</code> or the Generate Agent Context action below.</div>' +
      '</div>' +

      '<div class="ip-section">' +
        '<div class="ip-label">Hermes Agent</div>' +
        '<div class="ip-cmd-row">' + hermesBadge +
          '<button class="ip-copy" data-copy="dim hermes install">Copy install command</button>' +
        '</div>' +
      '</div>' +

      '<div class="ip-section">' +
        '<div class="ip-label">Registries</div>' +
        '<div class="ip-registry" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
          '<a href="' + esc(cfg.registry.mcpRegistry) + '" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/MCP-Registry-6366f1?logo=modelcontextprotocol" alt="MCP Registry"></a>' +
          '<a href="' + esc(cfg.registry.glama) + '" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/Glama-MCP-8b5cf6" alt="Glama"></a>' +
          '<a href="' + esc(cfg.registry.serverJson) + '" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/server.json-config-6366f1" alt="server.json"></a>' +
          '<a href="' + esc(cfg.docsUrl) + '" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/docs-aidimag.com-blue" alt="Docs"></a>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function copyToClip(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

// Delegated click handler for [data-copy] buttons inside the integration panel
document.addEventListener("click", (e) => {
  const el = e.target;
  if (!(el instanceof Element)) return;
  const btn = el.closest("[data-copy]");
  if (!btn) return;
  copyToClip(btn, btn.getAttribute("data-copy"));
});

function renderActionsView() {
  if (!state) return;
  const s = state.summary.byStatus;

  // header badge = things awaiting a human
  const pendingTotal = state.proposals.length + (knowledgeInfo ? knowledgeInfo.pending.length : 0);
  const tb = document.getElementById("tab-actions-badge");
  tb.style.display = pendingTotal ? "" : "none";
  tb.textContent = pendingTotal;

  document.getElementById("status-strip").innerHTML = [
    statCard("Memories", state.summary.total, "✓" + s.VERIFIED + " verified · ?" + s.UNVERIFIED + " unverified · ~" + s.STALE + " stale · ✗" + s.REFUTED + " refuted", false, null, null, false, IC_BRAIN),
    statCard("Review Queue", state.proposals.length, state.proposals.length ? "proposals awaiting review" : "queue is empty", state.proposals.length > 0, null, null, false, IC_CLIP),
    statCard("Knowledge Inbox", knowledgeInfo ? knowledgeInfo.pending.length : "–", knowledgeInfo ? knowledgeInfo.processed + " docs processed" : "checking…", knowledgeInfo && knowledgeInfo.pending.length > 0, null, null, false, IC_BOOK),
    statCard("Knowledge Gaps", state.gapCount, state.gapCount ? "unanswered searches (30 d)" : "no unanswered searches", state.gapCount > 0, null, null, false, IC_SEARCH),
    statCard("Scratchpad", state.scratchCount, "session notes (auto-expiring)", false, null, null, false, IC_MEMO),
    '<div id="stat-models" style="display:flex;gap:10px;grid-column:span 2">' +
    statCard("LLM", state.llmProvider ? ((state.llmProvider.name === "ollama" ? IC_OLLAMA + " " : "") + esc(state.llmProvider.name)) : "off", state.llmProvider ? esc(state.llmProvider.model) : "no provider — click to set up", !state.llmProvider, state.llmProvider ? "openModelSettings()" : "runSetupOllama()", "stat-llm", !!state.llmProvider, IC_WING),
    statCard("Embeddings", state.embeddingProvider ? ((state.embeddingProvider.name === "ollama" ? IC_OLLAMA + " " : "") + esc(state.embeddingProvider.name)) : "off", state.embeddingProvider ? esc(state.embeddingProvider.model) : "keyword search only — click to set up", !state.embeddingProvider, state.embeddingProvider ? "openModelSettings()" : "runSetupOllama()", "stat-embeddings", !!state.embeddingProvider, IC_CALC) +
    '</div>',
    statCard("Team sync", state.cloud ? (state.cloud.server && state.cloud.server.includes("cloud.aidimag.com") ? SVG_AIDIMAG + " linked" : IC_BRAIN + " linked") : "off", state.cloud ? esc(state.cloud.brain) + " @ " + esc(state.cloud.server) : "link a server to share memory", false, null, null, !!state.cloud, IC_SYNC),
    statCard("Tickets", state.tickets ? (state.tickets.provider === "remote" && state.teamTickets ? (PROVIDER_LOGOS[state.teamTickets.provider] || IC_TICKET) + " linked" : (PROVIDER_LOGOS[state.tickets.provider] || IC_TICKET) + " linked") : "off", state.tickets ? (state.tickets.provider === "remote" ? "team credentials on server" : state.tickets.hasCredential ? "credential stored" : IC_WARN + " no credential") : state.teamTickets ? "team has " + esc(state.teamTickets.provider) + " — click to connect" : "connect Jira / GitHub / Linear", false, (state.tickets || state.teamTickets) ? "openTickets()" : null, null, !!state.tickets, IC_TICKET),
  ].join("");

  const groupsEl = document.getElementById("action-groups");
  groupsEl.innerHTML = "";
  for (let gi = 0; gi < ACTION_GROUPS.length; gi++) {
    const group = ACTION_GROUPS[gi];
    const section = document.createElement("section");
    section.innerHTML =
      '<div class="action-group-head"><span class="g-icon">' + group.icon + '</span>' +
      '<h3>' + group.title + '</h3><span class="g-sub">' + group.sub + '</span></div>';
    const grid = document.createElement("div");
    grid.className = "action-grid";
    for (const a of group.actions) {
      const disabledReason = a.disabled ? a.disabled() : null;
      const badge = a.badge ? a.badge() : 0;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "action-card" + (a.danger ? " danger" : "");
      card.id = "act-" + a.id;
      if (disabledReason) card.setAttribute("aria-disabled", "true");
      card.innerHTML =
        '<div class="ac-top"><span class="ac-icon">' + (typeof a.icon === "function" ? a.icon() : a.icon) + '</span>' +
        '<span class="ac-title">' + a.title + '</span>' +
        (badge ? '<span class="ac-badge">' + badge + '</span>' : "") +
        (a.terminal ? '<span class="ac-term" title="Interactive — runs in your terminal; clicking copies the command">CLI</span>' : "") +
        '<span class="help" tabindex="0" role="note" aria-label="What does this do?" data-tip="' +
          esc(a.help + (a.cli && a.cli !== "—" ? " (CLI: " + a.cli + ")" : "")) + '" onclick="event.stopPropagation()">?</span></div>' +
        '<div class="ac-desc">' + esc(a.desc) + '</div>' +
        (a.cli && a.cli !== "—" ? '<span class="ac-cli">' + esc(a.cli) + '<span class="ac-copy" title="Copy command" data-cli="' + esc(a.cli) + '">⧉</span></span>' : '<span class="ac-cli">' + esc(a.cli) + '</span>');
      card.onclick = (ev) => {
        if (ev.target.classList.contains("help")) return;
        if (ev.target.classList.contains("ac-copy")) {
          ev.stopPropagation();
          copyCli(ev.target.getAttribute("data-cli"));
          return;
        }
        if (disabledReason) { toast(disabledReason); return; }
        a.run(ev);
      };
      if (disabledReason) card.title = disabledReason;
      grid.appendChild(card);
    }
    section.appendChild(grid);
    groupsEl.appendChild(section);
    // Insert integration panel after the Analysis group
    if (group.title === "Analysis") {
      const panel = document.createElement("div");
      panel.id = "integration-panel";
      groupsEl.appendChild(panel);
      renderIntegrationPanel();
    }
  }
}

function setBusy(id, busy) {
  const el = document.getElementById("act-" + id);
  if (el) el.classList.toggle("busy", busy);
}

// ---------------------------------------------------------------- action handlers

async function runBootstrap() {
  const ok = await showConfirm(
    "Build Initial Memory",
    "Bootstrap surveys your README/docs/structure and asks your LLM to draft initial memories.\\nIt may take a few minutes. Continue?"
  );
  if (!ok) return;
  setBusy("bootstrap", true);
  toastLoading("Bootstrapping… the LLM is reading your repo (this can take minutes)");
  try {
    let r = await api("/api/bootstrap", { method: "POST" });
    if (r.alreadyBootstrapped) {
      const rerun = await showConfirm("Already bootstrapped", "This repo was already bootstrapped. Run again anyway?");
      if (rerun) {
        r = await api("/api/bootstrap?force=1", { method: "POST" });
      } else { setBusy("bootstrap", false); return; }
    }
    if (!r.provider) await promptOllamaSetupUI("No LLM provider found. Bootstrap needs an LLM to survey your repo.");
    else toastDone("Bootstrap: " + r.proposed + " proposal(s) queued for review (" + r.provider + ")");
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("bootstrap", false); }
}

async function runHarvest() {
  setBusy("harvest", true);
  toastLoading("Harvesting AI coding transcripts…");
  try {
    const r = await api("/api/harvest", { method: "POST" });
    if (!r.transcriptDir) toast("No AI coding transcripts found for this repo");
    else if (!r.provider) await promptOllamaSetupUI("No LLM provider found. Harvest needs an LLM to extract facts from your chats.");
    else toastDone("Harvest: " + r.sessionsScanned + " session(s) scanned, " + r.proposed + " proposal(s) queued");
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("harvest", false); }
}

async function runKnowledgeSync() {
  setBusy("knowledge", true);
  toastLoading("Summarizing knowledge inbox…");
  try {
    const r = await api("/api/knowledge/sync", { method: "POST" });
    if (r.pendingNoSummarizer) await promptOllamaSetupUI("No LLM provider found. Knowledge sync needs an LLM to summarize documents.");
    else toastDone("Knowledge: " + r.processed + " doc(s) processed" + (r.duplicates ? ", " + r.duplicates + " duplicate(s) retired" : ""));
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("knowledge", false); }
}

async function runAudit() {
  setBusy("audit", true);
  try {
    const r = await api("/api/audit");
    const body = r.findings.length
      ? r.findings.map((f) =>
          '<div class="out-row"><div class="out-content"><b>risk ' + f.risk + '</b> · <span class="kind" style="color:' + (KIND_COLORS[f.memory.kind] || 'hsl(var(--primary))') + '">' + f.memory.kind + '</span> ' + esc(f.memory.claim) +
          '<div class="out-meta">' + f.reasons.map(esc).join(" · ") + '</div></div></div>').join("")
      : '<div class="empty">Nothing risky found — your memory rests on solid ground.</div>';
    showOutput(IC_SEARCH + " Provenance audit — weakest-ground memories first", body, r.findings.length ? [
      { label: "Verify memories", primary: true, onClick: () => { document.getElementById("dlg-output").close(); runVerify(false); } },
    ] : []);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("audit", false); }
}

async function runGaps() {
  setBusy("gaps", true);
  try {
    const r = await api("/api/gaps");
    const body = r.gaps.length
      ? r.gaps.map((g) =>
          '<div class="out-row"><div class="out-content">“' + esc(g.query) + '”' +
          '<div class="out-meta">missed ' + g.misses + '×' + (g.paths.length ? " · " + esc(g.paths.join(", ")) : "") +
          ' · last asked ' + new Date(g.lastAsked).toLocaleString() + '</div></div></div>').join("")
      : '<div class="empty">No unanswered searches in the last ' + r.days + ' days.</div>';
    showOutput(IC_HOLE + " Knowledge gaps — searches that found nothing", body, r.gaps.length ? [
      { label: "Add memory", primary: true, onClick: () => { document.getElementById("dlg-output").close(); document.getElementById("dlg-new").showModal(); } },
      { label: "Clear gaps", danger: true, onClick: async () => {
          const ok = await showConfirm("Clear gaps", "Clear the whole search-gap log?");
          if (!ok) return;
          try { const c = await api("/api/gaps/clear", { method: "POST" }); toast("Cleared " + c.cleared + " logged search(es)"); document.getElementById("dlg-output").close(); load(); }
          catch (e) { toast("Error: " + e.message); }
        } },
    ] : []);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("gaps", false); }
}

async function runProposalsGc() {
  setBusy("gc", true);
  try {
    const dry = await api("/api/proposals/gc?dryRun=1", { method: "POST" });
    if (!dry.removed) { toast("Nothing to purge — no resolved proposal rows"); return; }
    const ok = await showConfirm("Clean up proposals", "Purge " + dry.removed + " resolved proposal row(s)? (They are tombstoned for team sync.)");
    if (!ok) return;
    const r = await api("/api/proposals/gc", { method: "POST" });
    toast("Purged " + r.removed + " resolved proposal(s)");
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("gc", false); }
}

async function runCheck() {
  setBusy("check", true);
  toastLoading("Checking staged changes against memory…");
  try {
    const r = await api("/api/check", { method: "POST" });
    if (!r.changedFiles.length) { showOutput(IC_FLASK + " Check staged changes", '<div class="empty">No staged changes — stage files with git add first.</div>'); return; }
    const body =
      '<div class="out-meta" style="margin-bottom:8px">' + r.changedFiles.length + ' changed file(s) · ' + r.checked + ' memories checked</div>' +
      (r.violations.length
        ? r.violations.map((v) =>
            '<div class="out-row">' + (v.severity === "fail" ? IC_WARN : IC_WARN) + ' <div class="out-content"><b>' + v.severity.toUpperCase() + '</b> · <span class="kind" style="color:' + (KIND_COLORS[v.memory.kind] || 'hsl(var(--primary))') + '">' + v.memory.kind + '</span> ' + esc(v.memory.claim) +
            '<div class="out-meta">' + esc(v.detail) + '</div></div></div>').join("")
        : '<div class="empty">' + IC_CHECK_C + ' No contradictions — your staged diff agrees with active memory.</div>');
    showOutput(IC_FLASK + " Check staged changes", body);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("check", false); }
}

function renderMarkdown(md) {
  let html = esc(md);
  html = html.replace(/^### (.+)$/gm, '<h4 style="margin:14px 0 6px;font-size:13px;font-weight:700">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:14px;font-weight:700">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="margin:0 0 12px;font-size:16px;font-weight:700">$1</h2>');
  html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\\s\\S]*?<\\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/\\n\\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>(<h[234]>)/g, '$1').replace(/(<\\/h[234]>)<\\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1').replace(/(<\\/ul>)<\\/p>/g, '$1');
  return html;
}

async function runBrief() {
  setBusy("brief", true);
  try {
    const r = await api("/api/brief");
    showOutput(IC_BRIEF + " Session briefing", renderMarkdown(r.rendered));
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("brief", false); }
}

async function saveNote() {
  const content = document.getElementById("note-content").value.trim();
  if (!content) { toast("Write something first"); return; }
  const ttlHours = Number(document.getElementById("note-ttl").value) || 24;
  try {
    await api("/api/scratchpad", { method: "POST", body: JSON.stringify({ content, ttlHours }) });
    document.getElementById("dlg-note").close();
    document.getElementById("note-content").value = "";
    toast("Note saved — expires in " + ttlHours + " h, never synced");
    load();
  } catch (e) { toast("Error: " + e.message); }
}

async function runShowNotes() {
  setBusy("scratch-view", true);
  try {
    const r = await api("/api/scratchpad");
    const body = r.notes.length
      ? r.notes.map((n) =>
          '<div class="out-row"><div class="out-content">' + esc(n.content) +
          '<div class="out-meta">' + esc(n.createdBy) + ' · ' + new Date(n.createdAt).toLocaleString() + ' · expires ' + new Date(n.expiresAt).toLocaleString() + '</div></div></div>').join("")
      : '<div class="empty">Scratchpad is empty. Notes expire automatically.</div>';
    showOutput(IC_MEMO + " Scratchpad notes", body, r.notes.length ? [
      { label: "Clear all", danger: true, onClick: () => { document.getElementById("dlg-output").close(); runClearNotes(); } },
    ] : []);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("scratch-view", false); }
}

async function runClearNotes() {
  const ok = await showConfirm(IC_BROOM + " Clear Notes", "Delete ALL scratchpad notes? They would expire on their own anyway.");
  if (!ok) return;
  try {
    const r = await api("/api/scratchpad/clear", { method: "POST" });
    toast("Cleared " + r.cleared + " note(s)");
    load();
  } catch (e) { toast("Error: " + e.message); }
}

async function runGenerateContext() {
  const format = document.getElementById("ctx-format").value;
  document.getElementById("dlg-context").close();
  setBusy("gen-context", true);
  toastLoading("Generating context files…");
  try {
    const r = await api("/api/generate-context", { method: "POST", body: JSON.stringify({ format }) });
    toastDone("Wrote " + r.files.join(", ") + " (" + r.total + " memories, " + r.pinned + " pinned)");
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("gen-context", false); }
}

async function runResetOnboarding() {
  setBusy("reset-onboarding", true);
  try {
    await api("/api/onboard/reset", { method: "POST" });
    switchTab("overview");
    toast("Onboarding reset — reloading…");
    setTimeout(() => location.reload(), 800);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("reset-onboarding", false); }
}

async function runShowTicket() {
  const id = document.getElementById("ticket-show-id").value.trim();
  if (!id) { toast("Enter a ticket id"); return; }
  document.getElementById("dlg-ticket-show").close();
  try {
    const r = await api("/api/tickets/show?id=" + encodeURIComponent(id));
    const t = r.ticket;
    showOutput(IC_TICKET + " " + esc(t.id) + " — " + esc(t.title),
      '<div class="out-meta" style="margin-bottom:8px">' + esc(t.status || "") + (t.type ? " · " + esc(t.type) : "") + (t.labels && t.labels.length ? " · " + esc(t.labels.join(", ")) : "") + (t.url ? ' · <a href="' + esc(t.url) + '" target="_blank" rel="noreferrer">open ↗</a>' : "") + '</div>' +
      "<pre>" + esc(t.body || "(no description)") + "</pre>");
  } catch (e) {
    const msg = e.message || "";
    if (msg.includes("no ticket provider configured")) toast("Team ticket credentials were removed from the server — ask your admin to reconfigure");
    else toast("Error: " + msg);
  }
}

async function runLogin() {
  setBusy("login", true);
  toastLoading("Starting device login…");
  try {
    const start = await api("/api/auth/login", { method: "POST" });
    const approveUrl = start.verifyUrl;
    const body =
      '<div style="text-align:center;padding:8px 0">' +
      '<div style="font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:8px">' + esc(start.userCode) + '</div>' +
      '<div class="out-meta" style="margin-bottom:12px">Enter this code in your browser to approve this device.</div>' +
      '<button class="btn-primary" id="login-approve-btn" data-url="' + esc(approveUrl) + '">Open approval page ↗</button>' +
      '</div>' +
      '<div class="out-meta" style="margin-top:12px">Waiting for approval… this dialog will close automatically.</div>';
    showOutput(IC_PHONE + " Device login", body);
    const approveBtn = document.getElementById("login-approve-btn");
    if (approveBtn) approveBtn.onclick = () => window.open(approveUrl, "_blank");
    // Poll until approved
    const poll = async () => {
      try {
        const r = await api("/api/auth/login/poll", {
          method: "POST",
          body: JSON.stringify({ server: start.server, deviceCode: start.deviceCode }),
        });
        if (r.pending) {
          setTimeout(poll, (start.interval || 5) * 1000);
          return;
        }
        toastDone("Signed in" + (r.brain ? " (scope: " + r.brain + ")" : ""));
        document.getElementById("dlg-output").close();
        load();
      } catch (e) {
        toast("Login failed: " + e.message);
      }
    };
    setTimeout(poll, (start.interval || 5) * 1000);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("login", false); }
}

async function runLogout() {
  const ok = await showConfirm("Sign Out", "Remove this device's stored sync token?");
  if (!ok) return;
  setBusy("logout", true);
  try {
    await api("/api/auth/logout", { method: "POST" });
    toastDone("Signed out — token removed");
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("logout", false); }
}

// ---- create ticket branch via server API ----

async function runBranchFromDialog() {
  const ticketId = document.getElementById("branch-ticket-id").value.trim();
  if (!ticketId) { toast("Enter a ticket id"); return; }
  const prefix = document.getElementById("branch-prefix").value;
  document.getElementById("dlg-branch").close();
  await runBranch(ticketId, prefix);
}

async function runBranch(ticketId, prefix) {
  setBusy("branch", true);
  toastLoading("Creating branch for " + ticketId + "…");
  try {
    const body = { ticketId };
    if (prefix !== undefined) body.prefix = prefix;
    const r = await api("/api/branch", { method: "POST", body: JSON.stringify(body) });
    if (r.ok) {
      let msg = "🌿 Created branch " + r.branch;
      if (r.ticketTitle) msg += " (ticket: '" + r.ticketTitle + "')";
      if (r.memoriesCount > 0) msg += " — " + r.memoriesCount + " memor" + (r.memoriesCount > 1 ? "ies" : "y") + " created";
      toastDone(msg);
      load();
    } else {
      toast("Error: " + r.error);
    }
  } catch (e) {
    if (e.message && e.message.includes("already exists")) {
      toast("Branch already exists — try a different ticket id or switch to it manually");
    } else {
      toast("Error: " + e.message);
    }
  }
  finally { setBusy("branch", false); }
}

async function runBranchResync() {
  setBusy("branch-resync", true);
  toastLoading("Resyncing ticket from current branch…");
  try {
    const r = await api("/api/branch/resync", { method: "POST" });
    if (r.ok) {
      let msg = "🔄 Resynced ticket " + r.ticketId + " from branch " + r.branch;
      if (r.message) msg += " — " + r.message;
      else if (r.memoriesCount > 0) msg += " — " + r.memoriesCount + " memor" + (r.memoriesCount > 1 ? "ies" : "y") + " created";
      else msg += " — no changes detected";
      toastDone(msg);
      load();
    } else {
      toast("Error: " + r.error);
    }
  } catch (e) {
    toast("Error: " + e.message);
  }
  finally { setBusy("branch-resync", false); }
}

// ---- Hermes plugin install via server API ----

async function runHermesInstall() {
  setBusy("hermes", true);
  toastLoading("Installing Hermes plugin…");
  try {
    const r = await api("/api/hermes/install", { method: "POST" });
    if (r.ok) {
      toastDone("✓ Hermes plugin installed → " + r.path);
      refreshMcpStatus();
    } else {
      toast("Error: " + r.error);
    }
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("hermes", false); }
}

// ---- verify --trust: review synced evidence via server API ----

async function runVerifyTrust() {
  setBusy("verify-trust", true);
  toastLoading("Loading untrusted evidence…");
  try {
    const r = await api("/api/verify/trust");
    if (!r.count) {
      showOutput(IC_CLOUD + " Review synced evidence",
        '<div class="empty">No untrusted evidence — everything runnable was authored or approved on this machine.</div>');
      return;
    }
    const body =
      '<div class="out-meta" style="margin-bottom:8px">' + r.count + ' synced-in evidence command(s) are NOT yet approved to execute here:</div>' +
      r.pending.map((u) =>
        '<div class="out-row"><div class="out-content"><b>[' + esc(u.type) + ']</b> <code>' + esc(u.payload) + '</code>' +
        '<div class="out-meta">for: "' + esc(u.claim.slice(0, 90)) + '"</div></div></div>').join("");
    showOutput(IC_CLOUD + " Review synced evidence", body, [
      {
        label: "Approve all", primary: true, onClick: async () => {
          try {
            const a = await api("/api/verify/trust/approve", { method: "POST", body: JSON.stringify({ all: true }) });
            toastDone("✓ Approved " + a.approved + " command(s). They'll run on the next verify.");
            document.getElementById("dlg-output").close();
            load();
          } catch (e) { toast("Error: " + e.message); }
        }
      },
      { label: "Close", onClick: () => document.getElementById("dlg-output").close() },
    ]);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("verify-trust", false); }
}

// ---- Ollama setup (step-by-step in UI) ----
async function runSetupOllama() {
  const content = document.getElementById("ollama-content");
  const actions = document.getElementById("ollama-actions");
  document.getElementById("ollama-title").innerHTML = IC_OLLAMA + ' Setup Ollama for Semantic Search';
  document.getElementById("dlg-ollama").showModal();
  toastLoading("Setting up Ollama…");

  const stepIcon = (state) => state === 'done' ? IC_CHECK_C : state === 'active' ? '<span class="spinner" style="width:14px;height:14px;border-width:1.5px"></span>' : IC_CIRCLE;
  const renderSteps = (steps) => {
    content.innerHTML = steps.map(s => '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' + stepIcon(s.state || (s.done ? 'done' : 'pending')) + '<span>' + s.label + (s.detail ? '<span style="color:hsl(var(--muted-foreground))"> — ' + esc(s.detail) + '</span>' : '') + '</span></div>').join('');
  };
  const setActions = (btns) => {
    actions.innerHTML = '<button onclick="document.getElementById(\\'dlg-ollama\\').close()">Close</button>' + btns;
  };

  // Step 1: Check status
  content.innerHTML = '<div class="loading-overlay"><div class="spinner spinner-lg"></div><div>Checking Ollama status…</div></div>';
  setActions('');
  let st;
  try {
    st = await api("/api/ollama/status");
  } catch (e) {
    content.innerHTML = '<div style="color:hsl(var(--destructive))">Error checking status: ' + esc(e.message) + '</div>';
    return;
  }

  const steps = [
    { label: 'Install Ollama', state: st.installed ? 'done' : 'pending', detail: st.installed ? 'already installed' : 'not installed' },
    { label: 'Start Ollama server', state: st.running ? 'done' : 'pending', detail: st.running ? 'running on :11434' : 'not running' },
    { label: 'Pull models (embedding + LLM)', state: 'pending', detail: 'pending' },
    { label: 'Verify embedding', state: 'pending', detail: 'pending' },
  ];
  renderSteps(steps);

  if (!st.installed) {
    setActions('<button class="primary" id="ollama-install-btn">Install Ollama</button>');
    document.getElementById("ollama-install-btn").onclick = async () => {
      steps[0].state = 'active'; steps[0].detail = 'installing…';
      renderSteps(steps);
      setActions('');
      try {
        const r = await api("/api/ollama/install", { method: "POST" });
        if (r.ok) {
          steps[0].state = 'done';
          steps[0].detail = 'installed via ' + (r.method || 'script');
          renderSteps(steps);
          toastDone('Ollama installed successfully');
          runSetupOllama();
        } else {
          content.innerHTML = '<div style="color:hsl(var(--destructive))">Install failed: ' + esc(r.message || 'unknown error') + '</div><div style="margin-top:8px">Install manually from <a href="https://ollama.com/download" target="_blank">ollama.com/download</a></div>';
        }
      } catch (e) {
        content.innerHTML = '<div style="color:hsl(var(--destructive))">Error: ' + esc(e.message) + '</div>';
      }
    };
    return;
  }

  if (!st.running) {
    setActions('<button class="primary" id="ollama-start-btn">Start server</button>');
    document.getElementById("ollama-start-btn").onclick = async () => {
      steps[1].state = 'active'; steps[1].detail = 'starting…';
      renderSteps(steps);
      setActions('');
      try {
        const r = await api("/api/ollama/start", { method: "POST" });
        if (r.ok) {
          steps[1].state = 'done';
          steps[1].detail = 'running on :11434';
          renderSteps(steps);
          toastDone('Ollama server started');
          runSetupOllama();
        } else {
          content.innerHTML = '<div style="color:hsl(var(--destructive))">Server failed to start: ' + esc(r.message || 'timeout') + '</div><div style="margin-top:8px">Try running <code>ollama serve</code> in a terminal manually.</div>';
        }
      } catch (e) {
        content.innerHTML = '<div style="color:hsl(var(--destructive))">Error: ' + esc(e.message) + '</div>';
      }
    };
    return;
  }

  // Server is running — show model selection
  const pulledEmb = st.pulledEmbedding || [];
  const modelOptions = st.embeddingModels || [];
  const pulledLlm = st.pulledLlm || [];
  const llmOptions = st.llmModels || [];
  const currentLlm = st.currentLlmModel || 'llama3.1';
  let modelHtml = '<div style="margin-bottom:10px">Server is running. Choose your models:</div>';

  // Embedding model section
  modelHtml += '<div style="margin-bottom:6px;font-weight:600">📦 Embedding model (for semantic search):</div>';
  if (pulledEmb.length > 0) {
    modelHtml += '<div style="margin-bottom:4px;font-size:12px;color:hsl(var(--muted-foreground))">Already pulled:</div>';
    pulledEmb.forEach((m, i) => {
      const info = modelOptions.find(em => em.name === m);
      modelHtml += '<label style="display:flex;align-items:start;gap:6px;margin-bottom:4px;cursor:pointer"><input type="radio" name="ollama-emb-model" value="' + esc(m) + '"' + (i === 0 ? ' checked' : '') + ' style="margin:3px 0 0 0;padding:0;flex-shrink:0;width:auto"><span style="flex:1;min-width:0"><b>' + esc(m) + '</b>' + (info ? ' — ' + esc(info.size) + ', ' + esc(info.desc) : ' (already available)') + '</span></label>';
    });
    modelHtml += '<div style="margin:6px 0 4px;font-size:12px;color:hsl(var(--muted-foreground))">Or pull a new one:</div>';
  }

  modelOptions.forEach((m) => {
    const already = pulledEmb.includes(m.name);
    const isDefault = m.name === 'nomic-embed-text';
    modelHtml += '<label style="display:flex;align-items:start;gap:6px;margin-bottom:4px;cursor:pointer"><input type="radio" name="ollama-emb-model" value="' + esc(m.name) + '"' + (pulledEmb.length === 0 && isDefault ? ' checked' : '') + (already ? ' disabled' : '') + ' style="margin:3px 0 0 0;padding:0;flex-shrink:0;width:auto"><span style="flex:1;min-width:0"><b>' + esc(m.name) + '</b> — ' + esc(m.size) + ', ' + esc(m.desc) + (already ? ' ✓ already pulled' : '') + '</span></label>';
  });

  // LLM model section
  modelHtml += '<div style="margin:12px 0 6px;font-weight:600">LLM model (for mining, harvest, bootstrap):</div>';
  if (pulledLlm.length > 0) {
    modelHtml += '<div style="margin-bottom:4px;font-size:12px;color:hsl(var(--muted-foreground))">Already pulled:</div>';
    pulledLlm.forEach((m) => {
      const info = llmOptions.find(lm => lm.name === m);
      const isCurrent = m === currentLlm;
      modelHtml += '<label style="display:flex;align-items:start;gap:6px;margin-bottom:4px;cursor:pointer"><input type="radio" name="ollama-llm-model" value="' + esc(m) + '"' + (isCurrent ? ' checked' : '') + ' style="margin:3px 0 0 0;padding:0;flex-shrink:0;width:auto"><span style="flex:1;min-width:0"><b>' + esc(m) + '</b>' + (info ? ' — ' + esc(info.size) + ', ' + esc(info.desc) : ' (already available)') + (isCurrent ? ' ✓ current' : '') + '</span></label>';
    });
    modelHtml += '<div style="margin:6px 0 4px;font-size:12px;color:hsl(var(--muted-foreground))">Or pull a new one:</div>';
  }

  llmOptions.forEach((m) => {
    const already = pulledLlm.includes(m.name);
    const isDefault = m.name === 'llama3.2' && !pulledLlm.length;
    modelHtml += '<label style="display:flex;align-items:start;gap:6px;margin-bottom:4px;cursor:pointer"><input type="radio" name="ollama-llm-model" value="' + esc(m.name) + '"' + (isDefault ? ' checked' : '') + (already ? ' disabled' : '') + ' style="margin:3px 0 0 0;padding:0;flex-shrink:0;width:auto"><span style="flex:1;min-width:0"><b>' + esc(m.name) + '</b> — ' + esc(m.size) + ', ' + esc(m.desc) + (already ? ' ✓ already pulled' : '') + '</span></label>';
  });

  content.innerHTML = modelHtml;
  setActions('<button class="primary" id="ollama-pull-btn">Pull & Setup</button>');
  document.getElementById("ollama-pull-btn").onclick = async () => {
    const embSelected = document.querySelector('input[name="ollama-emb-model"]:checked');
    const llmSelected = document.querySelector('input[name="ollama-llm-model"]:checked');
    if (!embSelected) { toast("Select an embedding model"); return; }
    if (!llmSelected) { toast("Select an LLM model"); return; }
    const embModel = embSelected.value;
    const llmModel = llmSelected.value;
    const embAlreadyPulled = pulledEmb.includes(embModel);
    const llmAlreadyPulled = pulledLlm.includes(llmModel);

    // Save LLM model to config immediately
    try {
      await api("/api/ollama/config", { method: "POST", body: JSON.stringify({ embeddingModel: embModel, llmModel }) });
    } catch { /* ignore — verify will also save */ }

    // Pull embedding model
    if (embAlreadyPulled) {
      steps[2].state = 'done';
      steps[2].detail = embModel + ' already pulled';
    } else {
      steps[2].state = 'active';
      steps[2].detail = 'pulling ' + embModel + '…';
    }
    renderSteps(steps);
    setActions('');

    if (!embAlreadyPulled) {
      try {
        const r = await api("/api/ollama/pull?model=" + encodeURIComponent(embModel), { method: "POST" });
        if (!r.ok) {
          content.innerHTML = '<div style="color:hsl(var(--destructive))">Pull failed: ' + esc(r.message || 'error') + '</div><div style="margin-top:8px">Try <code>ollama pull ' + esc(embModel) + '</code> in a terminal.</div>';
          setActions('<button class="primary" id="ollama-retry-btn">Retry</button>');
          document.getElementById("ollama-retry-btn").onclick = () => document.getElementById("ollama-pull-btn").click();
          return;
        }
        steps[2].state = 'done';
        steps[2].detail = embModel + ' pulled';
        toastDone('Embedding model ' + embModel + ' pulled');
      } catch (e) {
        content.innerHTML = '<div style="color:hsl(var(--destructive))">Error: ' + esc(e.message) + '</div>';
        return;
      }
    }

    // Pull LLM model if needed
    if (!llmAlreadyPulled) {
      renderSteps(steps);
      try {
        toastLoading('Pulling LLM model ' + llmModel + '…');
        const r = await api("/api/ollama/pull?model=" + encodeURIComponent(llmModel), { method: "POST" });
        if (!r.ok) {
          toast('LLM pull failed — run "ollama pull ' + esc(llmModel) + '" manually');
        } else {
          toastDone('LLM model ' + llmModel + ' pulled');
        }
      } catch (e) {
        toast('LLM pull error: ' + e.message);
      }
    }

    // Step 4: Verify
    steps[3].state = 'active';
    steps[3].detail = 'verifying ' + embModel + '…';
    renderSteps(steps);
    try {
      const r = await api("/api/ollama/verify?model=" + encodeURIComponent(embModel), { method: "POST" });
      if (r.ok) {
        steps[3].state = 'done';
        steps[3].detail = 'embedding works!';
        renderSteps(steps);
        toastDone('Ollama setup complete!');
        load();
        content.innerHTML = '<div style="color:hsl(var(--verified));font-weight:600;margin-bottom:10px">' + IC_CHECK_C + ' Ollama ready!</div><div style="margin-bottom:6px">' + IC_PACKAGE + ' Embedding: <b>' + esc(embModel) + '</b> — semantic search enabled.</div><div style="margin-bottom:8px">' + IC_BRAIN + ' LLM: <b>' + esc(llmModel) + '</b> — mining, harvest & bootstrap ready.</div><div style="margin-bottom:8px">Run <b>Reindex Embeddings</b> to build vectors for existing memories.</div>';
        setActions('<button class="primary" id="ollama-reindex-btn">Reindex now</button>');
        document.getElementById("ollama-reindex-btn").onclick = async () => {
          document.getElementById("dlg-ollama").close();
          runReindex();
        };
      } else {
        steps[3].detail = 'probe failed';
        renderSteps(steps);
        content.innerHTML = '<div style="color:hsl(var(--destructive))">Embedding probe failed: ' + esc(r.message || 'error') + '</div><div style="margin-top:8px">The model may still be loading — try <b>Reindex Embeddings</b> in a moment.</div>';
        setActions('<button class="primary" id="ollama-reindex-btn">Try reindex anyway</button>');
        document.getElementById("ollama-reindex-btn").onclick = async () => {
          document.getElementById("dlg-ollama").close();
          runReindex();
        };
      }
    } catch (e) {
      content.innerHTML = '<div style="color:hsl(var(--destructive))">Error: ' + esc(e.message) + '</div>';
    }
  };
}

// restore last-used tab
if (localStorage.getItem("aidimag-ui-tab") === "actions") switchTab("actions");
if (localStorage.getItem("aidimag-ui-tab") === "health") switchTab("health");

let sim = null;
let _simTimer = null;

function fireSignal(src, links, g, palette) {
  const wave1 = new Set(), wave2 = new Set();
  for (const l of links) {
    const s = l.source.id || l.source, t = l.target.id || l.target;
    if (s === src.id) wave1.add(t);
    if (t === src.id) wave1.add(s);
  }
  for (const l of links) {
    const s = l.source.id || l.source, t = l.target.id || l.target;
    if (wave1.has(s) && !wave1.has(t) && t !== src.id) wave2.add(t);
    if (wave1.has(t) && !wave1.has(s) && s !== src.id) wave2.add(s);
  }

  // Traveling pulse particles along edges from source
  for (const l of links) {
    const s = l.source.id || l.source, t = l.target.id || l.target;
    if (s !== src.id && t !== src.id) continue;
    const fx = s === src.id ? l.source.x : l.target.x;
    const fy = s === src.id ? l.source.y : l.target.y;
    const tx = s === src.id ? l.target.x : l.source.x;
    const ty = s === src.id ? l.target.y : l.source.y;
    g.append("circle")
      .attr("r", 4).attr("cx", fx).attr("cy", fy)
      .attr("fill", palette.primary).attr("opacity", 0.9)
      .attr("filter", "url(#signal-glow)")
      .transition().duration(700).ease(d3.easeQuadOut)
      .attr("cx", tx).attr("cy", ty)
      .attr("r", 1.5).attr("opacity", 0)
      .remove();
  }

  // Cascading node pulse: source → wave1 → wave2
  const pulse = (id, scale, delay) => setTimeout(() => {
    const sel = g.select(".nodes").selectAll("g").filter(d => d.id === id);
    const c = sel.select("circle");
    if (c.empty()) return;
    const r = +c.attr("r");
    c.transition().duration(250).attr("r", r * scale)
      .transition().duration(400).attr("r", r);
  }, delay);
  pulse(src.id, 1.6, 0);
  wave1.forEach(id => pulse(id, 1.4, 400));
  wave2.forEach(id => pulse(id, 1.25, 800));
}

function renderGraph() {
  const container = document.getElementById("graph");
  const oldSvg = container.querySelector("svg");
  if (oldSvg) oldSvg.remove();
  const W = container.clientWidth, H = container.clientHeight;

  const nodes = [], links = [], pathNodes = new Map();
  for (const m of state.memories) {
    nodes.push({ id: m.id, type: "memory", label: m.claim.slice(0, 36) + (m.claim.length > 36 ? "…" : ""), status: m.status, conf: m.confidence });
    for (const p of m.scope.paths) {
      if (!pathNodes.has(p)) { pathNodes.set(p, { id: "path:" + p, type: "path", label: p }); }
      links.push({ source: m.id, target: "path:" + p, kind: "scope" });
    }
    for (const l of m.links) {
      if (l.fromId === m.id) links.push({ source: l.fromId, target: l.toId, kind: l.relation });
    }
  }
  nodes.push(...pathNodes.values());

  const stats = document.getElementById("graph-stats");
  if (stats) stats.textContent = nodes.length + " nodes · " + links.length + " edges";

  const palette = graphPalette();

  const svg = d3.select(container).append("svg").attr("width", W).attr("height", H);
  const defs = svg.append("defs");

  // Glow filter for nodes
  const glow = defs.append("filter").attr("id", "node-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
  glow.append("feGaussianBlur").attr("stdDeviation", 2.5).attr("result", "blur");
  const gm = glow.append("feMerge");
  gm.append("feMergeNode").attr("in", "blur");
  gm.append("feMergeNode").attr("in", "SourceGraphic");

  // Brighter glow for signal particles
  const sg = defs.append("filter").attr("id", "signal-glow").attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%");
  sg.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "blur");
  const sgm = sg.append("feMerge");
  sgm.append("feMergeNode").attr("in", "blur");
  sgm.append("feMergeNode").attr("in", "blur");
  sgm.append("feMergeNode").attr("in", "SourceGraphic");

  const g = svg.append("g");
  svg.call(d3.zoom().scaleExtent([0.3, 4]).on("zoom", e => g.attr("transform", e.transform)));

  if (sim) sim.stop();
  const LARGE = nodes.length > 200;
  sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(LARGE ? 60 : 90))
    .force("charge", d3.forceManyBody().strength(LARGE ? -80 : -220))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collide", d3.forceCollide(LARGE ? 12 : 28))
    .alphaDecay(LARGE ? 0.05 : 0.023);

  // Links — animated flow on "supports" edges for small graphs
  const linkG = g.append("g").attr("class", "links");
  const link = linkG.selectAll("line").data(links).join("line")
    .attr("stroke", d => d.kind === "contradicts" ? palette.REFUTED : d.kind === "supports" ? palette.VERIFIED : palette.link)
    .attr("stroke-width", d => d.kind === "supports" ? 1.8 : 1.2)
    .attr("stroke-opacity", 0.55);
  if (!LARGE) {
    link.filter(d => d.kind === "supports")
      .attr("stroke-dasharray", "5 5")
      .style("animation", "dash-flow 2s linear infinite");
  }

  const node = g.append("g").attr("class", "nodes").selectAll("g").data(nodes).join("g")
    .style("cursor", "pointer")
    .call(d3.drag()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

  // Memory nodes — brain icon on colored status ring with breathing pulse
  const memNode = node.filter(d => d.type === "memory");
  const memRadius = d => 9 + d.conf * 8;
  // Invisible collision circle (keeps physics + breathing pulse, hides sphere)
  memNode.append("circle")
    .attr("r", memRadius)
    .attr("fill", "transparent")
    .attr("stroke", "transparent")
    .attr("stroke-width", 0)
    .each(function(d) {
      if (LARGE) return;
      const r0 = memRadius(d);
      const el = d3.select(this);
      const period = 2800 + (d.conf * 1000);
      (function breathe() {
        el.transition().duration(period).ease(d3.easeSinInOut)
          .attr("r", r0 * 1.12)
          .transition().duration(period).ease(d3.easeSinInOut)
          .attr("r", r0)
          .on("end", breathe);
      })();
    });

  // Lucide Brain icon — stroke-based, scaled to fit inside the node circle
  {
    const brainPaths = [
      "M12 18V5",
      "M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4",
      "M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5",
      "M17.997 5.125a4 4 0 0 1 2.526 5.77",
      "M18 18a4 4 0 0 0 2-7.464",
      "M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517",
      "M6 18a4 4 0 0 1-2-7.464",
      "M6.003 5.125a4 4 0 0 0-2.526 5.77",
    ];
    memNode.each(function(d) {
      const r = memRadius(d);
      const s = (r * 1.3) / 24;
      const g = d3.select(this).append("g")
        .attr("transform", "scale(" + s + ") translate(-12,-12)")
        .attr("pointer-events", "none");
      for (const p of brainPaths) {
        g.append("path")
          .attr("d", p)
          .attr("fill", "none")
          .attr("stroke", d => palette[d.status] || palette.UNVERIFIED)
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round");
      }
    });
  }

  // Pulsing halo for verified nodes — brain-neuron ripple (continuous)
  if (!LARGE) {
    memNode.filter(d => d.status === "VERIFIED").append("circle")
      .attr("r", memRadius)
      .attr("fill", "none")
      .attr("stroke", d => palette[d.status])
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5)
      .each(function(d) {
        const r0 = memRadius(d);
        const el = d3.select(this);
        (function repeat() {
          el.attr("r", r0).attr("stroke-width", 2).attr("stroke-opacity", 0.5)
            .transition().duration(2200).ease(d3.easeSinOut)
            .attr("r", r0 + 16).attr("stroke-width", 0.3).attr("stroke-opacity", 0)
            .on("end", repeat);
        })();
      });
  }

  // Scope nodes — Lucide FileCode2 icon (no sphere)
  const pathNode = node.filter(d => d.type === "path");
  pathNode.append("circle")
    .attr("r", 12)
    .attr("fill", "transparent")
    .attr("stroke", "transparent")
    .attr("stroke-width", 0);
  {
    const fileCodePaths = [
      "M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4",
      "M14 2L14 8L20 8",
      "m9 18 3-3-3-3",
      "m5 12-3 3 3 3",
    ];
    pathNode.each(function() {
      const s = 14 / 24;
      const g = d3.select(this).append("g")
        .attr("transform", "scale(" + s + ") translate(-12,-12)")
        .attr("pointer-events", "none");
      for (const p of fileCodePaths) {
        g.append("path")
          .attr("d", p)
          .attr("fill", "none")
          .attr("stroke", palette.path)
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round");
      }
    });
  }

  // Labels — hidden on large graphs to reduce DOM clutter
  if (!LARGE) {
    node.append("text")
      .attr("dy", d => d.type === "memory" ? memRadius(d) + 12 : 26)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", "hsl(" + cssVar("--muted-foreground", "215 16% 47%") + ")")
      .attr("pointer-events", "none")
      .text(d => d.label);
  }

  node.on("click", (e, d) => {
    if (d.type !== "memory") return;
    if (!LARGE) fireSignal(d, links, g, palette);
    const card = document.getElementById("mem-" + d.id);
    if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.style.outline = "2px solid " + palette.primary; setTimeout(() => card.style.outline = "", 1500); }
  });

  // Hover tooltip for large graphs (since labels are hidden)
  if (LARGE) {
    const tip = document.getElementById("graph-tip");
    node.on("mouseenter", function(e, d) {
      d3.select(this).select("circle").attr("fill-opacity", 1);
      if (tip) { tip.textContent = d.label; tip.style.display = "block"; }
    }).on("mousemove", function(e) {
      if (tip) {
        const rect = container.getBoundingClientRect();
        tip.style.left = (e.clientX - rect.left + 12) + "px";
        tip.style.top = (e.clientY - rect.top - 8) + "px";
      }
    }).on("mouseleave", function(e, d) {
      d3.select(this).select("circle").attr("fill-opacity", 0.88);
      if (tip) tip.style.display = "none";
    });
  }

  sim.on("tick", () => {
    link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
  });

  // Recurring neural cascade — fires signals through random nodes continuously
  if (_simTimer) { clearInterval(_simTimer); _simTimer = null; }
  if (!LARGE) {
    const memNodes = nodes.filter(n => n.type === "memory");
    const verified = memNodes.filter(n => n.status === "VERIFIED");
    const pool = verified.length >= 2 ? verified : memNodes;
    if (pool.length) {
      _simTimer = setInterval(() => {
        if (sim.alpha() < 0.08 && document.visibilityState === "visible") {
          const seed = pool[Math.floor(Math.random() * pool.length)];
          fireSignal(seed, links, g, palette);
        }
      }, 3500);
      // Fire one shortly after settle for immediate feedback
      setTimeout(() => {
        if (sim.alpha() < 0.1) fireSignal(pool[0], links, g, palette);
      }, 2500);
    }
  }
}

window.addEventListener("resize", () => state && renderGraph());
replaceDialogIcons();
initTkDropdownIcons();
initKindDropdown("q-kind-dd", "q-kind", true, () => doSearch());
initKindDropdown("nm-kind-dd", "nm-kind", false, (v) => toggleGuardrailLevel());
load();
// Reset onboarding: hold Shift+R+O for 2 seconds on the dashboard
let _resetTimer = null;
window.addEventListener("keydown", (e) => {
  if (e.shiftKey && (e.key === "R" || e.key === "r") && e.altKey) {
    if (_resetTimer) clearTimeout(_resetTimer);
    _resetTimer = setTimeout(async () => {
      try { await api("/api/onboard/reset", { method: "POST" }); toast("Onboarding reset — reload to see it again"); }
      catch (e) { toast("Reset failed: " + e.message); }
    }, 2000);
  }
});
</script>
</body>
</html>`;

