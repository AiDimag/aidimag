/**
 * Dashboard HTML — embedded as a template string so `tsc` is the whole build
 * (no asset pipeline). D3 v7 from CDN renders the memory graph.
 */

export const PAGE_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>aiDimag — repo brain</title>
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
  .badge { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; border: 1px solid transparent; }
  .badge.VERIFIED { background: color-mix(in srgb, var(--verified) 15%, transparent); color: var(--verified); }
  .badge.UNVERIFIED { background: color-mix(in srgb, var(--unverified) 15%, transparent); color: var(--unverified); }
  .badge.STALE { background: color-mix(in srgb, var(--stale) 15%, transparent); color: var(--stale); }
  .badge.REFUTED { background: color-mix(in srgb, var(--refuted) 15%, transparent); color: var(--refuted); }
  .kind { color: hsl(var(--primary)); font-weight: 500; }
  .actions { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
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
    background: hsl(var(--card)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border) / 0.6);
    padding: 10px 18px;
    border-radius: var(--radius); display: none; font-size: 13px; font-weight: 500; z-index: 50;
    box-shadow: var(--surface-glow);
  }
  .empty { color: hsl(var(--muted-foreground)); font-size: 12px; padding: 8px 0; }
  svg text { fill: hsl(var(--muted-foreground)); font-size: 10px; pointer-events: none; }
  dialog {
    background: hsl(var(--card)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border) / 0.6);
    border-radius: calc(var(--radius) + 2px); padding: 20px; width: 480px; max-width: 92vw;
    box-shadow: var(--surface-glow);
  }
  dialog::backdrop { background: rgba(0,0,0,.55); backdrop-filter: blur(4px); }
  dialog h3 { font-size: 15px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.02em; }
  dialog label {
    display: block; font-size: 12px; color: hsl(var(--muted-foreground));
    margin: 12px 0 4px; font-weight: 500;
  }
  dialog input, dialog select, dialog textarea {
    width: 100%; background: hsl(var(--background)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) - 2px);
    padding: 8px 10px; font-size: 13px; font-family: inherit;
  }
  dialog input:focus, dialog select:focus, dialog textarea:focus {
    outline: 2px solid hsl(var(--ring)); outline-offset: 1px; border-color: transparent;
  }
  dialog textarea { min-height: 64px; resize: vertical; }
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
  .keyrow {
    font-size: 11px; font-family: ui-monospace, monospace;
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0; border-bottom: 1px solid hsl(var(--border));
  }
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

  /* ---------------------------------------------------------- actions view */
  #view-actions { flex: 1; overflow-y: auto; padding: 24px clamp(16px, 5vw, 56px) 56px; }
  .actions-hero { max-width: 1160px; margin: 0 auto 20px; }
  .actions-hero h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; letter-spacing: -0.03em; }
  .actions-hero p { font-size: 13px; color: hsl(var(--muted-foreground)); max-width: 640px; }
  .status-strip {
    max-width: 1160px; margin: 0 auto 28px;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;
  }
  .stat {
    background: hsl(var(--card) / 0.9); border: 1px solid hsl(var(--border) / 0.6);
    border-radius: var(--radius); padding: 12px 14px; box-shadow: var(--surface-glow);
  }
  .stat .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: hsl(var(--muted-foreground)); }
  .stat .stat-value { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-top: 2px; }
  .stat .stat-sub { font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stat.attention .stat-value { color: hsl(var(--primary)); }

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
  .ip-ok { color: hsl(142 71% 45%); font-size: 12px; }
  .ip-off { color: hsl(var(--muted-foreground)); font-size: 12px; }
  .ip-registry { font-size: 12px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .ip-reg-name { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: hsl(var(--muted) / 0.4); padding: 2px 8px; border-radius: 4px; }
  .ip-registry a { color: hsl(var(--primary)); text-decoration: none; font-size: 12px; }
  .ip-registry a:hover { text-decoration: underline; }
  .action-group-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
  .action-group-head .g-icon { font-size: 16px; }
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
  }
  .action-card .ac-term {
    font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--stale); border: 1px solid color-mix(in srgb, var(--stale) 40%, transparent);
    border-radius: 5px; padding: 1px 5px;
  }
  .action-card.busy { pointer-events: none; }
  .action-card.busy .ac-icon { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.4; } }

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
  #dlg-output .out-row { padding: 8px 0; border-bottom: 1px solid hsl(var(--border) / 0.5); }
  #dlg-output .out-row:last-child { border-bottom: none; }
  #dlg-output .out-row .out-meta { font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 2px; }

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
    position: absolute; z-index: 101; max-width: 320px;
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
  #tour-tooltip .tour-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
  #tour-tooltip .tour-dots { display: flex; gap: 5px; margin-right: auto; }
  #tour-tooltip .tour-dot { width: 7px; height: 7px; border-radius: 50%; background: hsl(var(--border)); transition: background 0.2s; }
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
    <button class="tab" id="tab-actions" role="tab" aria-selected="false" onclick="switchTab('actions')">Actions<span class="tab-badge" id="tab-actions-badge" style="display:none"></span></button>
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
      <select id="q-kind" onchange="doSearch()">
        <option value="">all kinds</option>
        <option>DECISION</option><option>CONVENTION</option><option>GOTCHA</option>
        <option>FAILED_APPROACH</option><option>ARCHITECTURE</option><option>INVARIANT</option>
        <option>TODO_CONTEXT</option><option>GUARDRAIL</option><option>SKILL</option>
      </select>
    </div>
    <div id="memories"></div>
  </aside>
</main>

<!-- ============================================================ Actions view -->
<div id="view-actions" role="tabpanel" aria-labelledby="tab-actions">
  <div class="actions-hero">
    <h2>Actions</h2>
    <p>Manage, review, verify, and sync your project's AI memory. Hover any <b>?</b> to learn what an action does before running it.</p>
  </div>
  <div class="status-strip" id="status-strip"></div>
  <div class="action-groups" id="action-groups"></div>
</div>

<!-- New memory dialog (dim remember) -->
<dialog id="dlg-new">
  <h3>＋ New memory</h3>
  <label>Claim (write it falsifiable — something a check could verify)</label>
  <textarea id="nm-claim" placeholder="All DB access goes through src/db/store.ts; nothing else imports better-sqlite3"></textarea>
  <label>Kind</label>
  <select id="nm-kind" onchange="toggleGuardrailLevel()">
    <option>DECISION</option><option>CONVENTION</option><option>GOTCHA</option>
    <option>FAILED_APPROACH</option><option>ARCHITECTURE</option><option>INVARIANT</option>
    <option>TODO_CONTEXT</option><option>GUARDRAIL</option><option>SKILL</option>
  </select>
  <div id="guardrail-section" style="display:none;">
    <label>Guardrail Level</label>
    <select id="nm-guardrail-level">
      <option value="ask-first">🤚 Ask First - Confirm before doing it</option>
      <option value="always">✅ Always - Block completely, refuse to proceed</option>
      <option value="never">🚫 Never - Just a suggestion</option>
    </select>
  </div>
  <label>Scope paths (comma-separated, empty = repo-wide)</label>
  <input id="nm-paths" placeholder="src/db, src/api/auth.ts">
  <label>Symbols (comma-separated, optional)</label>
  <input id="nm-symbols" placeholder="UserService, authenticate()">
  <label>
    <input type="checkbox" id="nm-pinned">
    📌 Pin this memory (exempt from time decay)
  </label>
  <label>Evidence (optional but recommended)</label>
  <div id="nm-evidence"></div>
  <button style="margin-top:6px" onclick="addEvidenceRow()">＋ add evidence</button>
  <div class="hint">STATIC_CHECK: shell command, exit 0 = claim holds · COMMIT_REF: sha · EXEC_TRACE: cmd :: regex · TEST_RESULT: test cmd</div>
  <div class="dialog-actions">
    <button onclick="document.getElementById('dlg-new').close()">Cancel</button>
    <button class="primary" onclick="saveMemory()">Save memory</button>
  </div>
</dialog>

<!-- Cloud settings dialog (dim cloud link / dim keys) -->
<dialog id="dlg-cloud">
  <h3>☁ Team sync</h3>
  <div id="cloud-status" class="hint"></div>
  <label>Server URL</label>
  <input id="cl-server" placeholder="http://localhost:3000">
  <label>Brain (team memory name)</label>
  <input id="cl-brain" placeholder="myrepo">
  <label>Access token (stored on this machine only, never in the repo)</label>
  <input id="cl-token" type="password" placeholder="aidimag_sk_…">
  <div class="dialog-actions">
    <button onclick="cloudUnlink()">Unlink</button>
    <button class="primary" onclick="cloudLink()">Link</button>
  </div>
  <h3 style="margin-top:18px">🔑 API keys (admin)</h3>
  <label>Admin token (used for this request only — not stored)</label>
  <input id="k-admin" type="password" placeholder="server admin token">
  <div class="ev-row">
    <input id="k-brain" placeholder="brain">
    <input id="k-label" placeholder="label (alice-laptop)">
    <button class="primary" onclick="keyCreate()">Create</button>
    <button onclick="keyList()">List</button>
  </div>
  <div id="keys-out"></div>
  <div class="dialog-actions">
    <button onclick="document.getElementById('dlg-cloud').close()">Close</button>
  </div>
</dialog>

<!-- Tickets dialog (dim ticket connect / share) -->
<dialog id="dlg-tickets">
  <h3>🎫 Tickets</h3>
  <div id="tk-status" class="hint"></div>
  <label>Provider</label>
  <select id="tk-provider" onchange="ticketsProviderHint()">
    <option value="jira">Jira</option>
    <option value="github">GitHub Issues</option>
    <option value="linear">Linear</option>
    <option value="http">HTTP middleware (your own)</option>
    <option value="remote">Remote (team sync server — zero local credentials)</option>
  </select>
  <div id="tk-url-row">
    <label id="tk-url-label">Base URL</label>
    <input id="tk-url" placeholder="https://acme.atlassian.net">
  </div>
  <div id="tk-token-row">
    <label id="tk-token-label">Credential (stored on this machine only, never in the repo)</label>
    <input id="tk-token" type="password" placeholder="email:apiToken">
  </div>
  <label>Ticket-id pattern (extracted from branch names &amp; commit messages)</label>
  <input id="tk-pattern" placeholder="[A-Z][A-Z0-9]+-\\\\d+">
  <label>Validate with a real ticket id (optional)</label>
  <input id="tk-test" placeholder="XXX-2100">
  <div class="dialog-actions">
    <button onclick="ticketsDisconnect()">Disconnect</button>
    <button class="primary" onclick="ticketsConnect()">Connect</button>
  </div>
  <h3 style="margin-top:18px">👥 Team credentials (admin)</h3>
  <div class="hint">Stores the provider + token on the linked sync server — teammates connect with provider “remote” and never hold a ticket credential.</div>
  <label>Admin token (used for this request only — not stored)</label>
  <input id="tk-admin" type="password" placeholder="server admin token">
  <div class="ev-row">
    <button class="primary" onclick="ticketsShare()">Share current config</button>
    <button class="danger" onclick="ticketsShare(true)">Remove from server</button>
  </div>
  <div class="dialog-actions">
    <button onclick="document.getElementById('dlg-tickets').close()">Close</button>
  </div>
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
    <button onclick="document.getElementById('dlg-note').close()">Cancel</button>
    <button class="primary" onclick="saveNote()">Save note</button>
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
    <button onclick="document.getElementById('dlg-context').close()">Cancel</button>
    <button class="primary" onclick="runGenerateContext()">Generate</button>
  </div>
</dialog>

<!-- Show ticket dialog (dim ticket show) -->
<dialog id="dlg-ticket-show">
  <h3>👁 Show ticket</h3>
  <div class="hint">Fetches the ticket from your connected provider (Jira / GitHub / Linear / …).</div>
  <label>Ticket id</label>
  <input id="ticket-show-id" placeholder="PROJ-123 or #42">
  <div class="dialog-actions">
    <button onclick="document.getElementById('dlg-ticket-show').close()">Cancel</button>
    <button class="primary" onclick="runShowTicket()">Fetch</button>
  </div>
</dialog>

<!-- Generic output panel for action results -->
<dialog id="dlg-output">
  <h3 id="out-title"></h3>
  <div class="out-body" id="out-body"></div>
  <div class="dialog-actions" id="out-actions">
    <button onclick="document.getElementById('dlg-output').close()">Close</button>
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

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.style.display = "block";
  setTimeout(() => t.style.display = "none", 2500);
}

async function api(path, opts) {
  opts = opts || {};
  const method = (opts.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    if (!csrfToken) throw new Error("missing CSRF token — reload the page");
    opts.headers = { ...(opts.headers || {}), "X-Aidimag-Csrf-Token": csrfToken };
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
    desc: "The force-directed graph shows memories (circles) linked to scope paths (squares). Node size = confidence, color = trust status. Click a memory to fire a neural signal through its connections.",
  },
  {
    selector: "#proposals-h",
    title: "Pending Proposals",
    desc: "Everything captured — mined commits, harvested chats, knowledge docs — lands in this review queue first. Nothing becomes memory until you approve it.",
  },
  {
    selector: "#tab-actions",
    title: "Actions Tab",
    desc: "Manage, review, verify, and sync your project's AI memory — verify, sync, mine, bootstrap, generate context files, and more. Hover the ? on any card for details.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#act-knowledge",
    title: "Knowledge Inbox",
    desc: "Drop docs into the knowledge/ folder and they're auto-summarized into reviewable proposals while the dashboard is running. Click this card to sync manually.",
    onShow: () => switchTab("actions"),
  },
  {
    selector: "#toolbar-overview .primary",
    title: "Verify & Create",
    desc: "Use Verify to re-check evidence and update trust statuses. Click New memory to write a falsifiable claim. Sync pushes and pulls memory from your team server.",
    onShow: () => switchTab("overview"),
  },
  {
    selector: "#btn-theme",
    title: "You're All Set!",
    desc: "Toggle light/dark theme here. Explore the dashboard, add memories, and run actions. You can replay this tour anytime via Actions \u2192 Reset Onboarding.",
    onShow: () => switchTab("overview"),
  },
];

let tourStep = 0;

function startTour() {
  tourStep = 0;
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
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    // Re-measure after scroll
    requestAnimationFrame(() => {
      const rect2 = el.getBoundingClientRect();
      spotlight.style.display = "block";
      spotlight.style.left = (rect2.left - pad) + "px";
      spotlight.style.top = (rect2.top - pad) + "px";
      spotlight.style.width = (rect2.width + pad * 2) + "px";
      spotlight.style.height = (rect2.height + pad * 2) + "px";

      // Position tooltip — clamp within viewport at all times
      const ttW = 320, ttH = 160;
      const vw = window.innerWidth, vh = window.innerHeight;
      let ttLeft = rect2.left + (rect2.width / 2) - (ttW / 2);
      let ttTop;

      if (rect2.bottom + 14 + ttH <= vh) {
        // Fits below
        ttTop = rect2.bottom + 14;
      } else if (rect2.top - 14 - ttH >= 0) {
        // Fits above
        ttTop = rect2.top - ttH - 14;
      } else {
        // Element is too tall — place tooltip at top of viewport, overlapping
        ttTop = Math.max(8, rect2.top + 14);
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

async function endTour() {
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
      <div class="meta"><span class="kind">\${p.kind}</span><span>via \${esc(p.source)}</span>\${p.ticketRef ? \`<span>🎫 \${esc(p.ticketRef)}</span>\` : ""}</div>
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
        \${m.pinned ? '<span class="badge" title="Pinned: never decays with age (evidence failure can still mark it stale)">📌 PINNED</span>' : ""}
        <span class="kind">\${m.kind}</span>
        <span>conf \${m.confidence.toFixed(2)}</span>
        \${m.scope.paths.length ? "<span>📁 " + esc(m.scope.paths.join(", ")) + "</span>" : "<span>repo-wide</span>"}
      </div>
      \${m.grounding.map(e => \`<div class="evidence">\${e.type}(\${e.result}) \${esc(e.payload)}</div>\`).join("")}
      <div class="actions">
        \${m.pinned
          ? \`<button onclick="act('/api/memories/\${m.id}/unpin','unpinned')">Unpin</button>\`
          : \`<button onclick="act('/api/memories/\${m.id}/pin','pinned 📌')">Pin</button>\`}
        \${m.status !== "REFUTED" ? \`<button class="danger" onclick="act('/api/memories/\${m.id}/refute','refuted')">Refute</button>\` : ""}
        <button class="danger" onclick="if(confirm('Delete permanently?'))act('/api/memories/\${m.id}/forget','forgotten')">Forget</button>
      </div>
    </div>\`).join("");
}

async function act(path, verb) {
  try { await api(path, { method: "POST" }); toast("Memory " + verb); load(); }
  catch (e) { toast("Error: " + e.message); }
}

async function runVerify(deep) {
  toast(deep ? "Running deep verification…" : "Verifying…");
  try {
    const r = await api("/api/verify" + (deep ? "?deep=1" : ""), { method: "POST" });
    toast(\`Checked \${r.checked}: \${r.verified} verified, \${r.stale} stale, \${r.decayed} decayed\`);
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
  toast(full ? "Rescanning full git history…" : "Mining git history…");
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
    toast(\`Scanned \${r.scanned} commit(s): \${r.proposed} proposal(s) queued\`);
    load();
  } catch (e) { toast("Error: " + e.message); }
}

async function runSync() {
  toast("Syncing…");
  try {
    const r = await api("/api/sync", { method: "POST" });
    const mem = (n) => n + (n === 1 ? " memory" : " memories");
    let msg;
    if (r.autoRecovered) {
      msg = "✓ Auto-recovery: restored memories from cloud";
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
    toast(msg);
    load();
  } catch (e) { toast("Sync: " + e.message); }
}

async function runReindex() {
  toast("Reindexing embeddings…");
  try {
    const r = await api("/api/reindex", { method: "POST" });
    toast(r.provider ? \`Indexed \${r.indexed} with \${r.provider}\` : "No embedding provider — run Ollama or set OPENAI_API_KEY");
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- cloud + keys

function openCloud() {
  const c = state && state.cloud;
  document.getElementById("cloud-status").textContent = c
    ? \`Linked: \${c.server} → brain '\${c.brain}' (\${c.hasToken ? "token stored" : "⚠ NO TOKEN — paste API key and Link"})\`
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
      ? r.keys.map(k => \`<div class="keyrow"><span>\${k.revoked_at ? "✗" : "✓"} \${esc(k.key)} → \${esc(k.brain)}\${k.label ? " (" + esc(k.label) + ")" : ""}</span></div>\`).join("")
      : '<div class="hint">No keys yet.</div>';
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- tickets

const TK_HINTS = {
  jira:   { url: "Jira site URL", urlPh: "https://acme.atlassian.net", token: "email:apiToken (or a PAT)", needUrl: true,  needToken: true },
  github: { url: "Repo URL", urlPh: "https://github.com/acme/api", token: "GitHub token (repo read)", needUrl: true,  needToken: true },
  linear: { url: "", urlPh: "", token: "Linear API key", needUrl: false, needToken: true },
  http:   { url: "Middleware endpoint (GET /ticket/:id)", urlPh: "https://tickets.internal.acme.com", token: "Bearer token (optional)", needUrl: true, needToken: true },
  remote: { url: "", urlPh: "", token: "", needUrl: false, needToken: false },
};

function ticketsProviderHint() {
  const h = TK_HINTS[document.getElementById("tk-provider").value];
  document.getElementById("tk-url-row").style.display = h.needUrl ? "" : "none";
  document.getElementById("tk-token-row").style.display = h.needToken ? "" : "none";
  if (h.needUrl) {
    document.getElementById("tk-url-label").textContent = h.url;
    document.getElementById("tk-url").placeholder = h.urlPh;
  }
  if (h.needToken) document.getElementById("tk-token-label").textContent = h.token + " — stored on this machine only, never in the repo";
}

function openTickets() {
  const t = state && state.tickets;
  document.getElementById("tk-status").textContent = t
    ? \`Connected: \${t.provider}\${t.baseUrl ? " at " + t.baseUrl : ""} (\${t.hasCredential ? "credential stored" : "⚠ NO CREDENTIAL"})\`
    : "No ticketing app connected — proposals will miss the why from your tickets.";
  if (t) {
    document.getElementById("tk-provider").value = t.provider;
    if (t.baseUrl) document.getElementById("tk-url").value = t.baseUrl;
    document.getElementById("tk-pattern").value = t.pattern || "";
  }
  ticketsProviderHint();
  document.getElementById("dlg-tickets").showModal();
}

async function ticketsConnect() {
  try {
    const r = await api("/api/tickets/connect", {
      method: "POST",
      body: JSON.stringify({
        provider: document.getElementById("tk-provider").value,
        baseUrl: document.getElementById("tk-url").value.trim() || undefined,
        token: document.getElementById("tk-token").value.trim() || undefined,
        pattern: document.getElementById("tk-pattern").value.trim() || undefined,
        testId: document.getElementById("tk-test").value.trim() || undefined,
      }),
    });
    document.getElementById("tk-token").value = "";
    toast(r.validated ? \`Connected ✓ validated with \${r.validated.id}: \${r.validated.title}\` : "Tickets connected");
    load(); openTickets();
  } catch (e) { toast("Error: " + e.message); }
}

async function ticketsDisconnect() {
  try { await api("/api/tickets/disconnect", { method: "POST" }); toast("Tickets disconnected"); load(); openTickets(); }
  catch (e) { toast("Error: " + e.message); }
}

async function ticketsShare(remove) {
  const adminToken = document.getElementById("tk-admin").value.trim();
  if (!adminToken) { toast("Admin token required"); return; }
  try {
    await api("/api/tickets/share", {
      method: "POST",
      body: JSON.stringify(remove ? { adminToken, remove: true } : {
        adminToken,
        provider: document.getElementById("tk-provider").value,
        baseUrl: document.getElementById("tk-url").value.trim() || undefined,
        credential: document.getElementById("tk-token").value.trim() || undefined,
      }),
    });
    document.getElementById("tk-token").value = "";
    toast(remove ? "Team ticket config removed" : "Team credentials stored on the server — teammates use provider 'remote'");
  } catch (e) { toast("Error: " + e.message); }
}

// ---------------------------------------------------------------- actions tab

let knowledgeInfo = null;

function switchTab(name) {
  document.body.classList.toggle("tab-actions", name === "actions");
  document.getElementById("tab-overview").classList.toggle("active", name === "overview");
  document.getElementById("tab-actions").classList.toggle("active", name === "actions");
  document.getElementById("tab-overview").setAttribute("aria-selected", String(name === "overview"));
  document.getElementById("tab-actions").setAttribute("aria-selected", String(name === "actions"));
  localStorage.setItem("aidimag-ui-tab", name);
  if (name === "overview" && state) renderGraph();
}

async function refreshKnowledgeStatus() {
  try {
    knowledgeInfo = await api("/api/knowledge/status");
    renderActionsView();
  } catch { /* endpoint unavailable — badge stays hidden */ }
}

function showOutput(title, html, followUps) {
  document.getElementById("out-title").textContent = title;
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

// The catalog: every aidimag capability as a grouped, self-explaining card.
const ACTION_GROUPS = [
  {
    icon: "◆", title: "Core", sub: "Capture, review, and verify your project's memory",
    actions: [
      { id: "add-memory", icon: "＋", title: "Add Memory", cli: "dim remember",
        desc: "Write a falsifiable claim about this repo, with optional evidence.",
        help: "Stores a durable memory: a claim a check could verify (e.g. 'all DB access goes through src/db/store.ts'). Add kind, scope paths, evidence, and pin it if it should never decay.",
        run: () => document.getElementById("dlg-new").showModal() },
      { id: "mine", icon: "⛏", title: "Mine Commits", cli: "dim mine",
        desc: "Scan new git commits for memory-worthy decisions and gotchas.",
        help: "Reads commit history since the last run and turns strong signals (reverts, fixes, decision keywords) into proposals for your review. Shift-click to rescan all history. For LLM-deep or PR mining run 'dim mine --llm' / 'dim mine --prs' in a terminal.",
        run: (ev) => runMine(ev) },
      { id: "bootstrap", icon: "🧠", title: "Build Initial Memory", cli: "dim bootstrap",
        desc: "Analyze the README, docs, and repository structure to create your first memories.",
        help: "Surveys README/docs/manifests/directory shape/churn and asks your LLM (Ollama or OPENAI_API_KEY) to extract 5–30 initial claims. Everything is queued for review — nothing is auto-saved. May take a few minutes.",
        run: () => runBootstrap() },
      { id: "harvest", icon: "💬", title: "Harvest AI Chats", cli: "dim harvest",
        desc: "Extract durable facts from Claude Code sessions.",
        help: "Scans local Claude Code transcripts for this repo, redacts secrets, and LLM-extracts durable facts *you* stated into proposals. Local-only; needs an LLM provider.",
        run: () => runHarvest() },
      { id: "knowledge", icon: "📚", title: "Import Knowledge", cli: "dim knowledge sync",
        desc: "Summarize documents in the knowledge/ folder into memory proposals.",
        help: "Any md/pdf/docx dropped into the knowledge inbox is LLM-summarized into falsifiable claims and queued for review. The dashboard also auto-ingests while it's running.",
        badge: () => knowledgeInfo && knowledgeInfo.pending.length ? knowledgeInfo.pending.length : 0,
        run: () => runKnowledgeSync() },
      { id: "review", icon: "✅", title: "Review Proposals", cli: "dim review",
        desc: "Approve or reject memories mined, harvested, or imported into the review queue.",
        help: "Nothing captured automatically becomes memory until you approve it. Opens the Overview tab where each pending proposal has Approve / Reject buttons.",
        badge: () => state ? state.proposals.length : 0,
        run: () => { switchTab("overview"); document.getElementById("proposals-h").scrollIntoView({ behavior: "smooth" }); } },
      { id: "verify", icon: "✔", title: "Verify Memory", cli: "dim verify",
        desc: "Re-run available evidence and update memory statuses.",
        help: "Re-runs COMMIT_REF and STATIC_CHECK evidence. Passing evidence marks memories VERIFIED; failing evidence marks them STALE. Unverified memories decay in confidence over time.",
        run: () => runVerify(false) },
      { id: "brief", icon: "📋", title: "Generate Session Briefing", cli: "dim brief",
        desc: "What to know before this session: memory, guardrails, warnings.",
        help: "Builds a briefing from your branch diff: in-scope memories, guardrails, stale warnings, coverage gaps, and clarifying questions to answer before coding.",
        run: () => runBrief() },
    ],
  },
  {
    icon: "🔍", title: "Analysis", sub: "Audit evidence, find gaps, and check for contradictions",
    actions: [
      { id: "audit", icon: "🔍", title: "Audit Memory Evidence", cli: "dim audit",
        desc: "Find memories supported by weak or missing evidence.",
        help: "Lists memories that are agent-authored, evidence-free, stale, or long-unverified — ranked by risk — so you can confirm, add evidence, or forget them.",
        run: () => runAudit() },
      { id: "gaps", icon: "🕳", title: "Review Knowledge Gaps", cli: "dim gaps",
        desc: "Find questions your agents or searches couldn't answer.",
        help: "Every memory search that returned zero results is logged as a gap — the facts your brain is missing, most-asked first. Fill them with Add Memory.",
        badge: () => state ? state.gapCount : 0,
        run: () => runGaps() },
      { id: "check", icon: "🧪", title: "Check Changes", cli: "dim check",
        desc: "Check staged changes for contradictions with active memories before committing.",
        help: "Analyzes your staged git diff against memories and guardrails scoped to the changed files: re-runs STATIC_CHECKs, trips 'never' guardrails, and reminds you of invariants.",
        run: () => runCheck() },
    ],
  },
  {
    icon: "☁", title: "Collaboration", sub: "Sync with your team and connect ticketing",
    actions: [
      { id: "sync", icon: "🔄", title: "Sync Now", cli: "dim sync",
        desc: "Push & pull memory with the linked team server.",
        help: "Exchanges memory events with your team brain. Synced-in executable evidence stays quarantined until you approve it via Review Synced Evidence.",
        disabled: () => state && !state.cloud ? "Connect a cloud server first" : null,
        run: () => runSync() },
      { id: "cloud", icon: "🔗", title: "Connect Cloud", cli: "dim cloud link",
        desc: "Sync this project's memory with your team.",
        help: "Connect a self-hosted (dim serve) or cloud sync server. The token is stored on this machine only, never in the repo. Also manages brain-scoped API keys.",
        run: () => openCloud() },
      { id: "login", icon: "🔐", title: "Sign In", cli: "dim login", terminal: true,
        desc: "Approve this device using your browser.",
        help: "Starts a device-code flow: the CLI prints a code and opens the server's approval page. Runs in your terminal — clicking copies the command.",
        run: () => copyCli("dim login") },
      { id: "logout", icon: "🚪", title: "Sign Out", cli: "dim logout", terminal: true, danger: true,
        desc: "Remove this device's stored token.",
        help: "Deletes the sync token stored for this device. Runs in your terminal — clicking copies the command.",
        run: () => copyCli("dim logout") },
      { id: "tickets", icon: "🎫", title: "Connect Ticketing App", cli: "dim ticket connect",
        desc: "Jira, GitHub Issues, Linear, HTTP middleware or team server.",
        help: "Once connected, proposals mined from commits carry ticket context, and branch-naming conventions can be enforced by git hooks. Credentials stay on this machine.",
        run: () => openTickets() },
      { id: "ticket-show", icon: "👁", title: "View Ticket", cli: "dim ticket show <id>",
        desc: "Fetch a ticket by id from the connected provider.",
        help: "Round-trips a ticket id through your provider config — great for checking the connection works and peeking at ticket context.",
        disabled: () => state && !state.tickets ? "Connect a ticket provider first" : null,
        run: () => document.getElementById("dlg-ticket-show").showModal() },
      { id: "branch", icon: "🌿", title: "Create Ticket Branch", cli: "dim branch <ticketId>", terminal: true,
        desc: "Create a convention-conforming branch for a ticket.",
        help: "Fetches the ticket title and creates a branch like feature/PROJ-123-fix-retries. Creates the branch in your working tree, so it runs in your terminal — clicking copies the command.",
        run: () => { const id = prompt("Ticket id (e.g. PROJ-123):"); if (id) copyCli("dim branch " + id.trim()); } },
      { id: "hermes", icon: "🪽", title: "Install Hermes Agent", cli: "dim hermes install", terminal: true,
        desc: "Register aidimag as a native Hermes memory provider.",
        help: "Installs a stdlib-only Python bridge into $HERMES_HOME/plugins/aidimag that delegates to the MCP server. Session briefings are injected into the system prompt, recall is prefetched per turn, and learnings become review-queue proposals. Runs in your terminal — clicking copies the command.",
        run: () => copyCli("dim hermes install") },
    ],
  },
  {
    icon: "⚙", title: "Advanced", sub: "Deep verification, maintenance, and agent context export",
    actions: [
      { id: "verify-deep", icon: "🔬", title: "Deep Verify", cli: "dim verify --deep",
        desc: "Re-run all available evidence, including test results and execution traces.",
        help: "The expensive tier: executes test commands and traced executions too. Can take a while on large evidence sets.",
        run: () => runVerify(true) },
      { id: "verify-trust", icon: "🛂", title: "Review Synced Evidence", cli: "dim verify --trust", terminal: true,
        desc: "Approve evidence commands received through team sync before they can affect memory verification.",
        help: "Synced-in evidence commands are NEVER executed until you inspect and approve them. This flow is interactive, so it runs in your terminal — clicking copies the command.",
        run: () => copyCli("dim verify --trust", "interactive review runs in a real terminal") },
      { id: "gc", icon: "🗑", title: "Clean Up Proposals", cli: "dim proposals gc", danger: true,
        desc: "Remove resolved proposals from the database. Runs as a dry-run first.",
        help: "Removes already approved/rejected proposal rows (tombstoned for team sync). Shows a dry-run count first, then asks for confirmation.",
        run: () => runProposalsGc() },
      { id: "gen-context", icon: "🧭", title: "Generate Agent Context", cli: "dim generate-context",
        desc: "Export trusted memory into CLAUDE.md, .cursorrules, and other agent context files.",
        help: "Writes your verified/unverified memory into static context files that coding agents read automatically (Claude Code, Cursor, Copilot, Windsurf, generic AGENTS.md).",
        run: () => document.getElementById("dlg-context").showModal() },
      { id: "reindex", icon: "🧮", title: "Reindex Embeddings", cli: "dim reindex",
        desc: "Rebuild semantic search vectors for all memories.",
        help: "Regenerates embeddings with your provider (Ollama or OpenAI). Run after switching embedding models or if semantic search feels off.",
        run: () => runReindex() },
      { id: "scratch-jot", icon: "✏️", title: "Jot Note", cli: "dim scratch",
        desc: "Quick working note. Expires in 24 h by default.",
        help: "Session working memory for hypotheses, plans and intermediate findings. TTL-expiring, local-only, never becomes durable memory — promote anything worth keeping via Add Memory.",
        run: () => document.getElementById("dlg-note").showModal() },
      { id: "scratch-view", icon: "📖", title: "View Notes", cli: "dim scratch --all",
        desc: "List current (unexpired) scratchpad notes.",
        help: "Shows all unexpired scratchpad notes across sessions, newest first.",
        badge: () => state ? state.scratchCount : 0,
        run: () => runShowNotes() },
      { id: "scratch-clear", icon: "🧹", title: "Clear Notes", cli: "dim scratch --clear --all", danger: true,
        desc: "Delete all scratchpad notes.",
        help: "Permanently deletes every scratchpad note in every session. They would expire on their own anyway.",
        run: () => runClearNotes() },
      { id: "refresh", icon: "🔃", title: "Refresh Data", cli: "—",
        desc: "Reload memories, proposals and status from disk.",
        help: "Re-reads the local aidimag database and refreshes every widget on this page.",
        run: () => { toast("Refreshing…"); load(); } },
      { id: "reset-onboarding", icon: "🎓", title: "Reset Onboarding", cli: "—",
        desc: "Show the first-time dashboard tour again.",
        help: "Re-enables the onboarding overlay that appears on first dashboard open. Reload the page after clicking to see it.",
        run: () => runResetOnboarding() },
    ],
  },
];

function statCard(label, value, sub, attention) {
  return '<div class="stat' + (attention ? " attention" : "") + '">' +
    '<div class="stat-label">' + label + '</div>' +
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
    const icon = ac.exists ? "✅" : "⚪";
    const mtime = ac.mtime ? new Date(ac.mtime).toLocaleDateString() : "";
    return '<tr><td>' + icon + '</td><td>' + esc(ac.name) + '</td><td><code>' + esc(ac.file) + '</code></td><td>' + (ac.exists ? '<span class="ip-ok">exists' + (mtime ? " · " + mtime : "") + '</span>' : '<span class="ip-off">not generated</span>') + '</td></tr>';
  }).join("");

  const hermesBadge = cfg.hermes.installed
    ? '<span class="ip-ok">✅ Installed' + (cfg.hermes.path ? ' · <code>' + esc(cfg.hermes.path) + '</code>' : '') + '</span>'
    : '<span class="ip-off">⚪ Not installed</span>';

  el.innerHTML =
    '<div class="ip-card">' +
      '<div class="ip-head"><span class="ip-icon">🔌</span><h3>Integrations</h3>' +
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
        '<div class="ip-registry">' +
          '<span class="ip-reg-name">' + esc(cfg.registry.name) + '</span>' +
          ' · <a href="' + esc(cfg.registry.mcpRegistry) + '" target="_blank" rel="noopener">MCP Registry ↗</a>' +
          ' · <a href="' + esc(cfg.registry.glama) + '" target="_blank" rel="noopener">Glama ↗</a>' +
          ' · <a href="' + esc(cfg.registry.serverJson) + '" target="_blank" rel="noopener">server.json ↗</a>' +
          ' · <a href="' + esc(cfg.docsUrl) + '" target="_blank" rel="noopener">Docs ↗</a>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function copyToClip(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "✓ Copied";
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
    statCard("Memories", state.summary.total, "✓" + s.VERIFIED + " verified · ?" + s.UNVERIFIED + " unverified · ~" + s.STALE + " stale · ✗" + s.REFUTED + " refuted"),
    statCard("Review Queue", state.proposals.length, state.proposals.length ? "proposals awaiting review" : "queue is empty", state.proposals.length > 0),
    statCard("Knowledge Inbox", knowledgeInfo ? knowledgeInfo.pending.length : "–", knowledgeInfo ? knowledgeInfo.processed + " docs processed" : "checking…", knowledgeInfo && knowledgeInfo.pending.length > 0),
    statCard("Knowledge Gaps", state.gapCount, state.gapCount ? "unanswered searches (30 d)" : "no unanswered searches", state.gapCount > 0),
    statCard("Scratchpad", state.scratchCount, "session notes (auto-expiring)"),
    statCard("Team sync", state.cloud ? "linked" : "off", state.cloud ? esc(state.cloud.brain) + " @ " + esc(state.cloud.server) : "link a server to share memory"),
    statCard("Tickets", state.tickets ? esc(state.tickets.provider) : "off", state.tickets ? (state.tickets.hasCredential ? "credential stored" : "⚠ no credential") : "connect Jira / GitHub / Linear"),
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
        '<div class="ac-top"><span class="ac-icon">' + a.icon + '</span>' +
        '<span class="ac-title">' + a.title + '</span>' +
        (badge ? '<span class="ac-badge">' + badge + '</span>' : "") +
        (a.terminal ? '<span class="ac-term" title="Interactive — runs in your terminal; clicking copies the command">CLI</span>' : "") +
        '<span class="help" tabindex="0" role="note" aria-label="What does this do?" data-tip="' +
          esc(a.help + (a.cli && a.cli !== "—" ? " (CLI: " + a.cli + ")" : "")) + '" onclick="event.stopPropagation()">?</span></div>' +
        '<div class="ac-desc">' + esc(a.desc) + '</div>' +
        '<span class="ac-cli">' + esc(a.cli) + '</span>';
      card.onclick = (ev) => {
        if (ev.target.classList.contains("help")) return;
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
  if (!confirm("Bootstrap surveys your README/docs/structure and asks your LLM to draft initial memories.\\nIt may take a few minutes. Continue?")) return;
  setBusy("bootstrap", true);
  toast("Bootstrapping… the LLM is reading your repo (this can take minutes)");
  try {
    let r = await api("/api/bootstrap", { method: "POST" });
    if (r.alreadyBootstrapped) {
      if (confirm("This repo was already bootstrapped. Run again anyway?")) {
        r = await api("/api/bootstrap?force=1", { method: "POST" });
      } else { setBusy("bootstrap", false); return; }
    }
    if (!r.provider) toast("No LLM provider found — run Ollama or set OPENAI_API_KEY");
    else toast("Bootstrap: " + r.proposed + " proposal(s) queued for review (" + r.provider + ")");
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("bootstrap", false); }
}

async function runHarvest() {
  setBusy("harvest", true);
  toast("Harvesting Claude Code transcripts…");
  try {
    const r = await api("/api/harvest", { method: "POST" });
    if (!r.transcriptDir) toast("No Claude Code transcripts found for this repo");
    else if (!r.provider) toast("No LLM provider found — run Ollama or set OPENAI_API_KEY");
    else toast("Harvest: " + r.sessionsScanned + " session(s) scanned, " + r.proposed + " proposal(s) queued");
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("harvest", false); }
}

async function runKnowledgeSync() {
  setBusy("knowledge", true);
  toast("Summarizing knowledge inbox…");
  try {
    const r = await api("/api/knowledge/sync", { method: "POST" });
    if (r.pendingNoSummarizer) toast("No LLM provider — " + r.pendingNoSummarizer + " doc(s) left in the inbox");
    else toast("Knowledge: " + r.processed + " doc(s) processed" + (r.duplicates ? ", " + r.duplicates + " duplicate(s) retired" : ""));
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
          '<div class="out-row"><b>risk ' + f.risk + '</b> · <span class="kind">' + f.memory.kind + '</span> ' + esc(f.memory.claim) +
          '<div class="out-meta">' + f.reasons.map(esc).join(" · ") + '</div></div>').join("")
      : '<div class="empty">Nothing risky found — your memory rests on solid ground. 🎉</div>';
    showOutput("🔍 Provenance audit — weakest-ground memories first", body, r.findings.length ? [
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
          '<div class="out-row">“' + esc(g.query) + '”' +
          '<div class="out-meta">missed ' + g.misses + '×' + (g.paths.length ? " · " + esc(g.paths.join(", ")) : "") +
          ' · last asked ' + new Date(g.lastAsked).toLocaleString() + '</div></div>').join("")
      : '<div class="empty">No unanswered searches in the last ' + r.days + ' days.</div>';
    showOutput("🕳 Knowledge gaps — searches that found nothing", body, r.gaps.length ? [
      { label: "Add memory", primary: true, onClick: () => { document.getElementById("dlg-output").close(); document.getElementById("dlg-new").showModal(); } },
      { label: "Clear gaps", danger: true, onClick: async () => {
          if (!confirm("Clear the whole search-gap log?")) return;
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
    if (!confirm("Purge " + dry.removed + " resolved proposal row(s)? (They are tombstoned for team sync.)")) return;
    const r = await api("/api/proposals/gc", { method: "POST" });
    toast("Purged " + r.removed + " resolved proposal(s)");
    load();
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("gc", false); }
}

async function runCheck() {
  setBusy("check", true);
  toast("Checking staged changes against memory…");
  try {
    const r = await api("/api/check", { method: "POST" });
    if (!r.changedFiles.length) { showOutput("🧪 Check staged changes", '<div class="empty">No staged changes — stage files with git add first.</div>'); return; }
    const body =
      '<div class="out-meta" style="margin-bottom:8px">' + r.changedFiles.length + ' changed file(s) · ' + r.checked + ' memories checked</div>' +
      (r.violations.length
        ? r.violations.map((v) =>
            '<div class="out-row">' + (v.severity === "fail" ? "❌" : "⚠️") + ' <b>' + v.severity.toUpperCase() + '</b> · <span class="kind">' + v.memory.kind + '</span> ' + esc(v.memory.claim) +
            '<div class="out-meta">' + esc(v.detail) + '</div></div>').join("")
        : '<div class="empty">✅ No contradictions — your staged diff agrees with active memory.</div>');
    showOutput("🧪 Check staged changes", body);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("check", false); }
}

async function runBrief() {
  setBusy("brief", true);
  try {
    const r = await api("/api/brief");
    showOutput("📋 Session briefing", "<pre>" + esc(r.rendered) + "</pre>");
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
          '<div class="out-row">' + esc(n.content) +
          '<div class="out-meta">' + esc(n.createdBy) + ' · ' + new Date(n.createdAt).toLocaleString() + ' · expires ' + new Date(n.expiresAt).toLocaleString() + '</div></div>').join("")
      : '<div class="empty">Scratchpad is empty. Notes expire automatically.</div>';
    showOutput("📖 Scratchpad notes", body, r.notes.length ? [
      { label: "Clear all", danger: true, onClick: () => { document.getElementById("dlg-output").close(); runClearNotes(); } },
    ] : []);
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("scratch-view", false); }
}

async function runClearNotes() {
  if (!confirm("Delete ALL scratchpad notes? They would expire on their own anyway.")) return;
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
  toast("Generating context files…");
  try {
    const r = await api("/api/generate-context", { method: "POST", body: JSON.stringify({ format }) });
    toast("Wrote " + r.files.join(", ") + " (" + r.total + " memories, " + r.pinned + " pinned)");
  } catch (e) { toast("Error: " + e.message); }
  finally { setBusy("gen-context", false); }
}

async function runResetOnboarding() {
  setBusy("reset-onboarding", true);
  try {
    await api("/api/onboard/reset", { method: "POST" });
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
    showOutput("🎫 " + esc(t.id) + " — " + esc(t.title),
      '<div class="out-meta" style="margin-bottom:8px">' + esc(t.status || "") + (t.type ? " · " + esc(t.type) : "") + (t.labels && t.labels.length ? " · " + esc(t.labels.join(", ")) : "") + (t.url ? ' · <a href="' + esc(t.url) + '" target="_blank" rel="noreferrer">open ↗</a>' : "") + '</div>' +
      "<pre>" + esc(t.body || "(no description)") + "</pre>");
  } catch (e) { toast("Error: " + e.message); }
}

// restore last-used tab
if (localStorage.getItem("aidimag-ui-tab") === "actions") switchTab("actions");

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
  // Colored background ring
  memNode.append("circle")
    .attr("r", memRadius)
    .attr("fill", d => palette[d.status] || palette.UNVERIFIED)
    .attr("fill-opacity", 0.9)
    .attr("stroke", d => palette[d.status] || palette.UNVERIFIED)
    .attr("stroke-width", 2)
    .attr("stroke-opacity", 0.5)
    .attr("filter", LARGE ? null : "url(#node-glow)")
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
          .attr("stroke", palette.iconStroke)
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

  // Scope nodes — Lucide FileCode2 icon on blue circle
  const pathNode = node.filter(d => d.type === "path");
  pathNode.append("circle")
    .attr("r", 12)
    .attr("fill", palette.path).attr("fill-opacity", 0.9)
    .attr("stroke", palette.path).attr("stroke-width", 2).attr("stroke-opacity", 0.5)
    .attr("filter", LARGE ? null : "url(#node-glow)");
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
          .attr("stroke", palette.iconStroke)
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

