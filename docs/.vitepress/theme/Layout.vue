<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import HeroIllustration from "./components/HeroIllustration.vue";
import FeaturesGrid from "./components/FeaturesGrid.vue";
const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #home-hero-image>
      <HeroIllustration />
    </template>
    <template #home-features-before>
      <div class="integration-strip">
        <span class="integration-strip-label">Works with your tools</span>
        <a href="/mcp" class="integration-logo"><img src="/integrations/claude.svg" alt="Claude Code" /> Claude Code</a>
        <a href="/mcp" class="integration-logo"><img src="/integrations/cursor.svg" alt="Cursor" data-invert /> Cursor</a>
        <a href="/mcp" class="integration-logo"><img src="/integrations/copilot.svg" alt="GitHub Copilot" data-invert /> Copilot</a>
        <a href="/ide-extensions" class="integration-logo"><img src="/integrations/vscode.svg" alt="VS Code" /> VS Code</a>
        <a href="/ide-extensions" class="integration-logo"><img src="/integrations/jetbrains.svg" alt="JetBrains" data-invert /> JetBrains</a>
        <a href="/mcp" class="integration-logo"><img src="/integrations/mcp.svg" alt="MCP" data-invert /> MCP</a>
        <a href="https://www.npmjs.com/package/aidimag" target="_blank" rel="noopener" class="integration-logo"><img src="/integrations/npm.svg" alt="npm" /> npm</a>
        <a href="https://github.com/AiDimag/aidimag" target="_blank" rel="noopener" class="integration-logo"><img src="/integrations/git.svg" alt="Git" /> Git</a>
      </div>
      <FeaturesGrid />
    </template>
  </Layout>
</template>
