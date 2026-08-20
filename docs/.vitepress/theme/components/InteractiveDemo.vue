<template>
  <div class="demo-wrapper">
    <div class="demo-header">
      <h2>Interactive Demo: Verified Memory in Action</h2>
      <p>No installation required — this is a simulated walkthrough based on real AIDimag output. Click through each step to see how claims, evidence, verification, and staleness detection work together.</p>
    </div>

    <div class="demo-controls">
      <button class="demo-btn" :disabled="step === 0" @click="prev">← Previous</button>
      <button class="demo-btn" :class="{ active: autoPlay }" @click="toggleAuto">{{ autoPlay ? '⏸ Pause' : '▶ Auto-play' }}</button>
      <button class="demo-btn" :disabled="step === steps.length - 1" @click="next">Next →</button>
    </div>

    <div class="demo-progress-track">
      <div class="demo-progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <div class="demo-dots">
      <button
        v-for="(s, i) in steps"
        :key="i"
        class="demo-dot"
        :class="{ active: i === step, done: i < step }"
        @click="goTo(i)"
      ></button>
    </div>

    <div class="demo-step-info">
      <h3>{{ steps[step].title }}</h3>
      <p>{{ steps[step].subtitle }}</p>
    </div>

    <div class="demo-grid">
      <div class="demo-terminal-panel">
        <div class="demo-panel-label">Terminal — type the command</div>
        <div v-if="!stepStates[step].completed" class="demo-hint">{{ steps[step].hint }}</div>
        <div class="demo-input-row">
          <span class="demo-prompt">$</span>
          <input
            ref="inputEl"
            v-model="userInput"
            class="demo-input"
            :disabled="stepStates[step].completed"
            :placeholder="steps[step].placeholder"
            @keydown.enter="submitCommand"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div v-if="inputError" class="demo-input-error">{{ inputError }}</div>
        <div v-if="!stepStates[step].completed" class="demo-skip-row">
          <button class="demo-skip-btn" @click="showAnswer">Show answer</button>
        </div>
        <div v-if="stepStates[step].completed" class="demo-terminal-done">$ {{ steps[step].cli.replace(/\\\n/g, '\n') }}</div>
        <div v-if="steps[step].flags && stepStates[step].completed" class="demo-flags">
          <div class="demo-flags-label">What the flags mean</div>
          <div v-for="f in steps[step].flags" :key="f.flag" class="demo-flag-row">
            <code class="demo-flag">{{ f.flag }}</code>
            <span class="demo-flag-desc">{{ f.desc }}</span>
          </div>
        </div>
        <div v-if="stepStates[step].completed" class="demo-panel-label" style="margin-top:16px">Output</div>
        <div v-if="stepStates[step].completed" class="demo-output">{{ typedOutput }}</div>
        <div v-if="steps[step].diff" class="demo-diff">
          <div class="diff-file">{{ steps[step].diff.file }}</div>
          <pre class="diff-content"><span v-for="(line, i) in steps[step].diff.added" :key="i" class="diff-added">+ {{ line }}
</span></pre>
        </div>
        <div v-if="steps[step].risk" class="demo-risk">
          <div class="risk-label">Risk Score</div>
          <div class="risk-score" :style="{ color: riskColor(steps[step].risk.score) }">{{ steps[step].risk.score }}/100</div>
          <div class="risk-level" :style="{ color: riskColor(steps[step].risk.score) }">{{ steps[step].risk.level }}</div>
          <div class="risk-bar"><div class="risk-bar-fill" :style="{ width: steps[step].risk.score + '%', background: riskColor(steps[step].risk.score) }"></div></div>
        </div>
      </div>

      <div class="demo-memory-panel">
        <div class="demo-panel-label">Memory State</div>
        <div class="mem-card" :class="memStatusClass">
          <div class="mem-header">
            <span class="mem-kind">{{ steps[step].memory.kind }}</span>
            <span class="mem-status" :class="memStatusClass">{{ steps[step].memory.status }}</span>
          </div>
          <div class="mem-claim">{{ steps[step].memory.claim }}</div>
          <div class="mem-meta">
            <span>id: {{ steps[step].memory.id }}</span>
            <span>conf: {{ steps[step].memory.confidence.toFixed(2) }}</span>
            <span>scope: {{ steps[step].memory.scope }}</span>
          </div>
          <div v-if="steps[step].memory.evidence" class="mem-evidence">📊 {{ steps[step].memory.evidence }}</div>
          <div v-if="steps[step].memory.appliesWhen" class="mem-applies">⚠️ applies when: {{ steps[step].memory.appliesWhen }}</div>
        </div>
      </div>
    </div>

    <div class="demo-footer">
      <p>Want to try it for real?</p>
      <div class="demo-cta">
        <a href="/getting-started" class="demo-cta-btn">Get Started →</a>
        <a href="https://github.com/AiDimag/aidimag" class="demo-cta-btn demo-cta-secondary">View on GitHub</a>
      </div>
      <p style="margin-top:16px;font-size:13px;color:var(--vp-c-text-2)">Or download a <a href="/sample-repo">sample repo</a> with pre-seeded memories to explore the CLI hands-on.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const steps = [
  {
    title: '1. Bootstrap surveys your repo',
    subtitle: 'AIDimag scans your code and suggests memories with auto-generated evidence',
    hint: 'Type: dim bootstrap',
    placeholder: 'dim bootstrap',
    accept: ['dim bootstrap', 'dim boot', 'dim b'],
    cli: 'dim bootstrap',
    flags: [
      { flag: 'dim bootstrap', desc: 'Surveys README, manifests, directory structure, and git history — LLM-suggests memories with evidence commands' },
    ],
    output: '🔍 Surveying repo...\n\nFound 3 memory candidates:\n\n  1. [CONVENTION] All DB access goes through src/db/store.ts\n     evidence: STATIC_CHECK: ! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts\n     scope: src\n\n  2. [DECISION] We use better-sqlite3 instead of Prisma\n     evidence: COMMIT_REF: a1b2c3d\n     scope: src/db\n\n  3. [CONVENTION] Error responses use { error: { code, message } } format\n     evidence: (none — manual review needed)\n     scope: src/api\n\nRun `dim review` to approve or reject.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'UNVERIFIED',
      confidence: 0.50,
      scope: 'src',
      evidence: 'STATIC_CHECK: ! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts (auto-generated)',
    },
  },
  {
    title: '2. Review and verify',
    subtitle: 'Approve the proposal, then AIDimag runs the evidence command automatically',
    hint: 'Type: dim review  then  dim verify',
    placeholder: 'dim review ...',
    accept: ['dim review', 'dim verify', 'dim rev'],
    cli: 'dim review --yes\n\ndim verify',
    flags: [
      { flag: 'dim review --yes', desc: 'Approves all pending proposals — you can also review one-by-one' },
      { flag: 'dim verify', desc: 'Runs the STATIC_CHECK command — passes if grep finds no stray imports' },
    ],
    output: '✓ Approved 3 proposals\n  4f3a9c21  CONVENTION  All DB access goes through src/db/store.ts\n  7a2c8e15  DECISION   We use better-sqlite3 instead of Prisma\n  9b1d3f07  CONVENTION Error responses use { error: { code, message } } format\n\n✓ [CONVENTION] All DB access goes through src/db/store.ts\n    id=4f3a9c21  status=VERIFIED  conf=0.80  scope=src\n    evidence: STATIC_CHECK (PASS) — grep found no stray imports\n\n1 memory verified. Confidence boosted 0.50 → 0.80.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'VERIFIED',
      confidence: 0.80,
      scope: 'src',
      evidence: 'STATIC_CHECK (PASS) — grep found no stray imports',
    },
  },
  {
    title: '3. Someone breaks the convention',
    subtitle: 'A teammate imports better-sqlite3 outside src/db/store.ts',
    hint: 'Type: git diff --cached --name-only',
    placeholder: 'git diff ...',
    accept: ['git diff', 'git add', 'git stage'],
    cli: 'git diff --cached --name-only',
    output: 'src/api/handler.ts\n\n# The staged change adds:\n+ import Database from "better-sqlite3";\n+ const db = new Database("./app.db");',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'VERIFIED',
      confidence: 0.80,
      scope: 'src',
      evidence: 'STATIC_CHECK (PASS) — grep found no stray imports',
    },
    diff: {
      file: 'src/api/handler.ts',
      added: [
        'import Database from "better-sqlite3";',
        'const db = new Database("./app.db");',
      ],
    },
  },
  {
    title: '4. dim check catches it',
    subtitle: 'Pre-commit check detects the violation before it lands',
    hint: 'Type: dim check --block',
    placeholder: 'dim check ...',
    accept: ['dim check', 'dim verify', 'git commit'],
    cli: 'dim check --block',
    output: '🚫 [CONVENTION] All DB access goes through src/db/store.ts\n    severity: fail\n    detail: src/api/handler.ts imports better-sqlite3 outside src/db/store.ts\n\nRisk Score: 72/100 (HIGH)\n  +40 convention violation\n  +20 critical path touched (src/db)\n  +12 change breadth (1 file)\n\nexit 1 — blocked by --block flag',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'VERIFIED',
      confidence: 0.80,
      scope: 'src',
      evidence: 'STATIC_CHECK (FAIL) — grep found stray import in handler.ts',
    },
    risk: { score: 72, level: 'HIGH' },
  },
  {
    title: '5. Verify again — memory goes STALE',
    subtitle: 'After the bad commit lands, verify detects the drift',
    hint: 'Type: dim verify',
    placeholder: 'dim verify',
    accept: ['dim verify', 'dim v'],
    cli: 'dim verify',
    output: '~ [VERIFIED → STALE] conf 0.80→0.20  All DB access goes through src/db/store.ts\n    STATIC_CHECK: FAIL (exit 1)\n    src/api/handler.ts imports better-sqlite3 outside src/db/store.ts\n\n1 memory went stale. The memory noticed the code drifted.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'STALE',
      confidence: 0.20,
      scope: 'src',
      evidence: 'STATIC_CHECK (FAIL) — grep found stray import in handler.ts',
    },
  },
  {
    title: '6. Agent gets warned before repeating a mistake',
    subtitle: 'FAILED_APPROACH memory prevents the same error again',
    hint: 'Type: dim remember "Retry on declined payments caused duplicate ledger entries" --kind FAILED_APPROACH --path src/payments',
    placeholder: 'dim remember ...',
    accept: ['dim remember', 'dim rem'],
    cli: 'dim remember \\\n  "Retry on declined payments caused duplicate ledger entries" \\\n  --kind FAILED_APPROACH --path src/payments \\\n  --applies-when "keyword:retry keyword:idempotency"',
    flags: [
      { flag: '--kind FAILED_APPROACH', desc: 'Marks this as a failed approach — agents get warned before repeating it' },
      { flag: '--applies-when', desc: 'Only fires when these keywords appear in the code being written' },
    ],
    output: '✓ Memory written\n  id=8b2e1f04  kind=FAILED_APPROACH  conf=0.50\n  scope: src/payments\n  applies_when: keyword:retry, keyword:idempotency\n\nNext time an agent tries to add retry logic\nin src/payments, it will see this warning first.',
    memory: {
      id: '8b2e1f04',
      kind: 'FAILED_APPROACH',
      claim: 'Retry on declined payments caused duplicate ledger entries',
      status: 'UNVERIFIED',
      confidence: 0.50,
      scope: 'src/payments',
      appliesWhen: 'keyword:retry, keyword:idempotency',
    },
  },
]

const step = ref(0)
const autoPlay = ref(false)
const typedOutput = ref('')
const userInput = ref('')
const inputError = ref('')
const inputEl = ref(null)
let autoTimer = null
let typeTimer = null
let outputTimer = null

const stepStates = ref(steps.map(() => ({ completed: false })))

const progressPct = computed(() => ((step.value + 1) / steps.length) * 100)
const memStatusClass = computed(() => {
  const s = steps[step.value].memory.status
  if (s === 'VERIFIED') return 'mem-verified'
  if (s === 'STALE') return 'mem-stale'
  return 'mem-unverified'
})

function riskColor(score) {
  if (score >= 80) return '#ef4444'
  if (score >= 60) return '#f97316'
  if (score >= 30) return '#eab308'
  return '#22c55e'
}

function typeText(text, target, speed, callback) {
  if (typeTimer) clearTimeout(typeTimer)
  let i = 0
  function tick() {
    if (i >= text.length) {
      if (callback) callback()
      return
    }
    target.value = text.slice(0, i + 1)
    i++
    typeTimer = setTimeout(tick, speed)
  }
  tick()
}

function normalizeCmd(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/['"]/g, '"').trim()
}

function submitCommand() {
  const s = steps[step.value]
  const input = userInput.value.trim()
  if (!input) return
  const normalized = normalizeCmd(input)
  const accepted = s.accept.map(normalizeCmd)
  if (accepted.some(a => normalized === a || normalized.startsWith(a))) {
    inputError.value = ''
    stepStates.value[step.value].completed = true
    typeText(s.output, typedOutput, 5)
  } else {
    inputError.value = 'Not quite — check the hint and try again. Or click "Show answer".'
  }
}

function showAnswer() {
  const s = steps[step.value]
  userInput.value = s.cli.replace(/\\\n/g, '\n')
  inputError.value = ''
  stepStates.value[step.value].completed = true
  typeText(s.output, typedOutput, 5)
}

function renderStep() {
  const s = steps[step.value]
  typedOutput.value = ''
  userInput.value = ''
  inputError.value = ''
  if (autoPlay.value && !stepStates.value[step.value].completed) {
    stepStates.value[step.value].completed = true
    typeText(s.output, typedOutput, 5)
  }
  if (!stepStates.value[step.value].completed) {
    setTimeout(() => { if (inputEl.value) inputEl.value.focus() }, 100)
  }
}

function next() {
  if (step.value < steps.length - 1) {
    step.value++
    renderStep()
  } else {
    stopAuto()
  }
}
function prev() {
  if (step.value > 0) {
    step.value--
    renderStep()
  }
}
function goTo(i) {
  step.value = i
  renderStep()
  stopAuto()
}

function startAuto() {
  autoPlay.value = true
  autoTimer = setInterval(() => {
    if (step.value < steps.length - 1) {
      step.value++
      renderStep()
    } else {
      stopAuto()
    }
  }, 4000)
}
function stopAuto() {
  autoPlay.value = false
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}
function toggleAuto() {
  if (autoPlay.value) stopAuto()
  else startAuto()
}

onMounted(() => {
  renderStep()
})
onUnmounted(() => {
  stopAuto()
  if (typeTimer) clearTimeout(typeTimer)
  if (outputTimer) clearTimeout(outputTimer)
})
</script>

<style scoped>
.demo-wrapper {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 0 48px;
}
.demo-header h2 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}
.demo-header p {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin-bottom: 24px;
}
.demo-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.demo-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.demo-btn:hover:not(:disabled) {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
}
.demo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.demo-btn.active {
  background: var(--vp-c-brand);
  color: var(--vp-c-white);
  border-color: var(--vp-c-brand);
}
.demo-progress-track {
  height: 4px;
  border-radius: 2px;
  background: var(--vp-c-divider);
  overflow: hidden;
  margin-bottom: 12px;
}
.demo-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--vp-c-brand);
  transition: width 0.4s ease;
}
.demo-dots {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.demo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--vp-c-border);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}
.demo-dot.done {
  background: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
}
.demo-dot.active {
  background: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
  transform: scale(1.3);
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
}
.demo-step-info h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}
.demo-step-info p {
  font-size: 13px;
  color: var(--vp-c-text-2);
  margin-bottom: 20px;
}
.demo-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}
@media (max-width: 768px) {
  .demo-grid { grid-template-columns: 1fr; }
}
.demo-terminal-panel, .demo-memory-panel {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 16px;
}
.demo-panel-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
  margin-bottom: 8px;
}
.demo-terminal {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 40px;
}
.demo-hint {
  font-size: 12px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 10px;
  line-height: 1.5;
}
.demo-hint::before {
  content: '💡 ';
}
.demo-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.demo-prompt {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-brand);
  flex-shrink: 0;
}
.demo-input {
  flex: 1;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
  transition: border-color 0.2s;
}
.demo-input:focus {
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}
.demo-input:disabled {
  opacity: 0.6;
  cursor: default;
}
.demo-input::placeholder {
  color: var(--vp-c-text-3);
}
.demo-input-error {
  margin-top: 6px;
  font-size: 12px;
  color: #ef4444;
}
.demo-skip-row {
  margin-top: 8px;
}
.demo-skip-btn {
  font-size: 12px;
  color: var(--vp-c-text-3);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.demo-skip-btn:hover {
  color: var(--vp-c-brand);
}
.demo-terminal-done {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
}
.demo-flags {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
}
.demo-flags-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin-bottom: 6px;
}
.demo-flag-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 4px;
}
.demo-flag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-brand);
  white-space: nowrap;
  flex-shrink: 0;
}
.demo-flag-desc {
  font-size: 12px;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}
.demo-output {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 80px;
}
.demo-diff {
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
}
.diff-file {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 10px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-border);
}
.diff-content {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 10px;
  margin: 0;
  background: var(--vp-c-bg-alt);
}
.diff-added {
  color: #22c55e;
  display: block;
}
.demo-risk {
  margin-top: 12px;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
}
.risk-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}
.risk-score {
  font-size: 32px;
  font-weight: 700;
  font-family: 'Space Grotesk', sans-serif;
  line-height: 1;
}
.risk-level {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.risk-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--vp-c-divider);
  overflow: hidden;
  margin-top: 4px;
}
.risk-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.mem-card {
  border-radius: 10px;
  padding: 14px;
  border: 1px solid var(--vp-c-border);
  border-left: 4px solid var(--vp-c-text-3);
  background: var(--vp-c-bg);
  transition: all 0.3s ease;
}
.mem-card.mem-verified { border-left-color: #22c55e; }
.mem-card.mem-stale { border-left-color: #eab308; }
.mem-card.mem-unverified { border-left-color: #64748b; }
.mem-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.mem-kind {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-2);
}
.mem-status {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.mem-status.mem-verified { color: #22c55e; }
.mem-status.mem-stale { color: #eab308; }
.mem-status.mem-unverified { color: #64748b; }
.mem-claim {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 10px;
}
.mem-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-family: 'JetBrains Mono', monospace;
}
.mem-evidence {
  margin-top: 8px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--vp-c-bg-alt);
}
.mem-applies {
  margin-top: 8px;
  font-size: 12px;
  color: #eab308;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(234, 179, 8, 0.08);
}
.demo-footer {
  margin-top: 32px;
  text-align: center;
}
.demo-footer p {
  font-size: 15px;
  color: var(--vp-c-text-1);
}
.demo-cta {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 12px;
}
.demo-cta-btn {
  display: inline-block;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  background: var(--vp-c-brand);
  color: var(--vp-c-white) !important;
  transition: all 0.2s;
}
.demo-cta-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}
.demo-cta-secondary {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1) !important;
  border: 1px solid var(--vp-c-border);
}
</style>
