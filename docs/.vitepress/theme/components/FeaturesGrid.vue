<script setup lang="ts">
import {
  Brain,
  BadgeCheck,
  ShieldAlert,
  Plug,
  Users,
  LockKeyhole,
} from "lucide-vue-next";

const features = [
  {
    icon: Brain,
    title: "Never explain your codebase twice",
    details:
      "Your coding agent remembers the architecture decisions, conventions, invariants, gotchas, and dead ends your team already worked through — every session starts where the last one left off, not from a cold repo scan.",
  },
  {
    icon: BadgeCheck,
    title: "Claim-and-verify, not store-and-retrieve",
    details:
      "Every memory is a falsifiable claim with evidence — a shell check, an anchored commit, a test. Git hooks re-verify on every pull and rebase; claims the code has outgrown flip to STALE instead of silently misleading your agent.",
  },
  {
    icon: ShieldAlert,
    title: "Guardrails your agent must respect",
    details:
      "Encode engineering rules as never / ask-first / always guardrails. They surface in every session briefing, ground the memory_critique second-critic, and dim check can block a violating commit before it lands.",
  },
  {
    icon: Plug,
    title: "Wired into your development tools",
    details:
      "Live MCP tools for Claude Code, Cursor, and Copilot — plus generated CLAUDE.md, .cursorrules, and copilot-instructions.md for everything else. VS Code and IntelliJ extensions, git-hook capture, ticket integration.",
  },
  {
    icon: Users,
    title: "Local-first, team-ready",
    details:
      "One SQLite file in your repo — no account, no cloud required. Scale to a team with a self-hosted sync server, brain-scoped API keys, and cross-machine verification consensus.",
  },
  {
    icon: LockKeyhole,
    title: "Engineered for repo security",
    details:
      "Nothing enters memory without human review. Shell-command evidence that arrives via team sync is never executed until you inspect and approve it — a teammate's memory can't become code execution on your machine.",
  },
];
</script>

<template>
  <div class="VPFeatures">
    <div class="container">
      <div class="items">
        <div v-for="f in features" :key="f.title" class="VPFeature">
          <div class="icon">
            <component :is="f.icon" :size="22" :stroke-width="1.8" />
          </div>
          <h3 class="title">{{ f.title }}</h3>
          <p class="details">{{ f.details }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
