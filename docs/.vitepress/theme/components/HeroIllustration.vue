<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const containerRef = ref<HTMLElement | null>(null);
const isFiring = ref(false);
const tiltX = ref(0);
const tiltY = ref(0);

let fireTimer: ReturnType<typeof setTimeout> | null = null;
let rafId: number | null = null;

function handleMouseMove(e: MouseEvent) {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = (e.clientX - cx) / rect.width;
  const dy = (e.clientY - cy) / rect.height;
  tiltY.value = dx * 12;
  tiltX.value = -dy * 12;
}

function handleMouseEnter() {
  isFiring.value = true;
  if (fireTimer) clearTimeout(fireTimer);
}

function handleMouseLeave() {
  fireTimer = setTimeout(() => {
    isFiring.value = false;
  }, 1200);
  tiltX.value = 0;
  tiltY.value = 0;
}

function autoFire() {
  // Periodically trigger neuron firing even without hover
  isFiring.value = true;
  fireTimer = setTimeout(() => {
    isFiring.value = false;
    fireTimer = setTimeout(autoFire, 3500 + Math.random() * 2000);
  }, 1500);
}

onMounted(() => {
  fireTimer = setTimeout(autoFire, 2000);
});

onUnmounted(() => {
  if (fireTimer) clearTimeout(fireTimer);
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<template>
  <div
    ref="containerRef"
    class="hero-illustration"
    @mousemove="handleMouseMove"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      class="hero-illustration-inner"
      :style="{ transform: `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` }"
    >
      <svg
        width="480"
        height="440"
        viewBox="0 0 480 440"
        fill="none"
        font-family="Space Grotesk, Inter, -apple-system, 'Segoe UI', Roboto, sans-serif"
        style="max-width: 100%; height: auto;"
      >
        <defs>
          <linearGradient id="heroGrad" x1="60" y1="40" x2="420" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#2563eb" />
            <stop offset="55%" stop-color="#0ea5e9" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
          <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
            <stop offset="60%" stop-color="#0ea5e9" stop-opacity="0.15" />
            <stop offset="100%" stop-color="#06b6d4" stop-opacity="0" />
          </radialGradient>
          <marker id="heroArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#0ea5e9" />
          </marker>
        </defs>

        <!-- animated glow backdrop -->
        <circle cx="240" cy="220" r="200" fill="url(#brainGlow)" class="hero-glow" />

        <!-- orbit ring -->
        <circle cx="240" cy="220" r="150" stroke="url(#heroGrad)" stroke-width="1.5" stroke-dasharray="3 7" opacity="0.5" class="hero-orbit" />

        <!-- orbit dots -->
        <g class="hero-orbit-dots">
          <circle cx="240" cy="70" r="3" fill="#2563eb" opacity="0.6" />
          <circle cx="390" cy="220" r="3" fill="#0ea5e9" opacity="0.6" />
          <circle cx="240" cy="370" r="3" fill="#06b6d4" opacity="0.6" />
          <circle cx="90" cy="220" r="3" fill="#3b82f6" opacity="0.6" />
        </g>

        <!-- center brain glow pulse -->
        <circle cx="240" cy="220" r="90" fill="url(#brainGlow)" class="brain-pulse" :class="{ firing: isFiring }" />

        <!-- center brain -->
        <circle cx="240" cy="220" r="74" fill="#0f172a" />
        <circle cx="240" cy="220" r="74" stroke="url(#heroGrad)" stroke-width="2.5" class="brain-ring" :class="{ firing: isFiring }" />

        <!-- brain icon -->
        <g transform="translate(192 172) scale(4)" stroke="url(#heroGrad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="brain-icon" :class="{ firing: isFiring }">
          <path d="M12 18V5" />
          <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
          <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
          <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
          <path d="M18 18a4 4 0 0 0 2-7.464" />
          <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
          <path d="M6 18a4 4 0 0 1-2-7.464" />
          <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
        </g>

        <!-- neuron particles - fire along connectors when active -->
        <g class="neuron-particles" :class="{ active: isFiring }">
          <circle r="4" fill="#60a5fa" class="particle p-top" />
          <circle r="4" fill="#34d399" class="particle p-right" />
          <circle r="4" fill="#fbbf24" class="particle p-bottom" />
          <circle r="4" fill="#22d3ee" class="particle p-left" />
        </g>

        <!-- satellite: remember (top) -->
        <g class="satellite s-top">
          <rect x="170" y="18" width="140" height="46" rx="23" fill="#172554" stroke="#2563eb" stroke-width="1.5" />
          <text x="240" y="38" text-anchor="middle" fill="#bfdbfe" font-size="12" font-weight="600">dim remember</text>
          <text x="240" y="55" text-anchor="middle" fill="#60a5fa" font-size="10">claims from you &amp; agents</text>
        </g>

        <!-- satellite: verify (right) -->
        <g class="satellite s-right">
          <rect x="340" y="197" width="132" height="46" rx="23" fill="#052e2b" stroke="#10b981" stroke-width="1.5" />
          <text x="406" y="217" text-anchor="middle" fill="#a7f3d0" font-size="12" font-weight="600">dim verify ✓</text>
          <text x="406" y="234" text-anchor="middle" fill="#34d399" font-size="10">evidence re-checked</text>
        </g>

        <!-- satellite: stale flag (bottom) -->
        <g class="satellite s-bottom">
          <rect x="170" y="376" width="140" height="46" rx="23" fill="#3b1d0e" stroke="#f59e0b" stroke-width="1.5" />
          <text x="240" y="396" text-anchor="middle" fill="#fde68a" font-size="12" font-weight="600">stale? flagged ⚠</text>
          <text x="240" y="413" text-anchor="middle" fill="#fbbf24" font-size="10">never trust old facts</text>
        </g>

        <!-- satellite: deliver (left) -->
        <g class="satellite s-left">
          <rect x="8" y="197" width="132" height="46" rx="23" fill="#082f49" stroke="#06b6d4" stroke-width="1.5" />
          <text x="74" y="217" text-anchor="middle" fill="#a5f3fc" font-size="12" font-weight="600">→ your AI tools</text>
          <text x="74" y="234" text-anchor="middle" fill="#22d3ee" font-size="10">MCP · CLAUDE.md</text>
        </g>

        <!-- connectors -->
        <path d="M240 66v46" stroke="#2563eb" stroke-width="2" marker-end="url(#heroArrow)" opacity="0.8" class="connector c-top" />
        <path d="M338 220h-22" stroke="#10b981" stroke-width="2" marker-end="url(#heroArrow)" opacity="0.8" class="connector c-right" />
        <path d="M240 374v-46" stroke="#f59e0b" stroke-width="2" marker-end="url(#heroArrow)" opacity="0.8" class="connector c-bottom" />
        <path d="M164 220h-22" stroke="#06b6d4" stroke-width="2" marker-end="url(#heroArrow)" opacity="0.8" class="connector c-left" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.hero-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 800px;
}

.hero-illustration-inner {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  transform-style: preserve-3d;
  will-change: transform;
}

/* Glow breathing */
.hero-glow {
  animation: glow-breathe 4s ease-in-out infinite;
  transform-origin: 240px 220px;
}

@keyframes glow-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

/* Orbit ring slow rotation */
.hero-orbit {
  transform-origin: 240px 220px;
  animation: orbit-spin 30s linear infinite;
}

@keyframes orbit-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Orbit dots - counter-rotate to stay on ring */
.hero-orbit-dots {
  transform-origin: 240px 220px;
  animation: orbit-spin 30s linear infinite;
}

/* Brain pulse */
.brain-pulse {
  transform-origin: 240px 220px;
  animation: brain-pulse 3s ease-in-out infinite;
}

.brain-pulse.firing {
  animation: brain-fire 0.8s ease-out;
}

@keyframes brain-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.08); }
}

@keyframes brain-fire {
  0% { opacity: 0.4; transform: scale(1); }
  30% { opacity: 1; transform: scale(1.35); }
  100% { opacity: 0.3; transform: scale(1); }
}

/* Brain ring glow when firing */
.brain-ring {
  transition: stroke-width 0.3s ease, filter 0.3s ease;
}

.brain-ring.firing {
  stroke-width: 4;
  filter: drop-shadow(0 0 12px rgba(96, 165, 250, 0.8));
}

/* Brain icon glow when firing */
.brain-icon {
  transition: filter 0.3s ease;
}

.brain-icon.firing {
  filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.9));
}

/* Satellites - subtle float */
.satellite {
  transition: transform 0.3s ease, filter 0.3s ease;
}

.s-top { animation: float-y 5s ease-in-out infinite; }
.s-right { animation: float-x 4.5s ease-in-out infinite 0.3s; }
.s-bottom { animation: float-y-rev 5.5s ease-in-out infinite 0.5s; }
.s-left { animation: float-x-rev 4.8s ease-in-out infinite 0.8s; }

@keyframes float-y {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes float-y-rev {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}
@keyframes float-x {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}
@keyframes float-x-rev {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-4px); }
}

/* Connectors - flow animation */
.connector {
  stroke-dasharray: 6 4;
  animation: connector-flow 2s linear infinite;
}

@keyframes connector-flow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -20; }
}

/* Neuron particles */
.neuron-particles {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.neuron-particles.active {
  opacity: 1;
}

.particle {
  filter: drop-shadow(0 0 6px currentColor);
}

/* Top: brain (240,146) -> satellite (240,64) */
.p-top {
  animation: fire-top 1.2s ease-out infinite;
}
@keyframes fire-top {
  0% { transform: translate(240px, 146px); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(240px, 64px); opacity: 0; }
}

/* Right: brain (316,220) -> satellite (340,220) */
.p-right {
  animation: fire-right 1.2s ease-out infinite 0.15s;
}
@keyframes fire-right {
  0% { transform: translate(316px, 220px); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(340px, 220px); opacity: 0; }
}

/* Bottom: brain (240,294) -> satellite (240,376) */
.p-bottom {
  animation: fire-bottom 1.2s ease-out infinite 0.3s;
}
@keyframes fire-bottom {
  0% { transform: translate(240px, 294px); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(240px, 376px); opacity: 0; }
}

/* Left: brain (164,220) -> satellite (140,220) */
.p-left {
  animation: fire-left 1.2s ease-out infinite 0.45s;
}
@keyframes fire-left {
  0% { transform: translate(164px, 220px); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(140px, 220px); opacity: 0; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .hero-glow,
  .hero-orbit,
  .hero-orbit-dots,
  .brain-pulse,
  .satellite,
  .connector,
  .neuron-particles {
    animation: none !important;
  }
  .neuron-particles {
    opacity: 0 !important;
  }
}
</style>
