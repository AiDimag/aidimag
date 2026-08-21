<template>
  <div class="demo-launcher">
    <button class="demo-launch-btn" @click="openModal">
      <span class="demo-launch-icon">▶</span>
      <span class="demo-launch-text">
        <strong>Try Interactive Demo</strong>
        <small>No install — full terminal experience in your browser</small>
      </span>
      <span class="demo-launch-arrow">→</span>
    </button>

    <Teleport to="body">
      <div v-if="modalOpen" class="demo-modal-overlay" @click.self="closeModal">
        <div class="demo-modal" :class="{ 'demo-modal-compact': !started }" role="dialog" aria-modal="true" aria-label="AI Dimag Interactive Demo">
          <!-- Terminal window chrome -->
          <div class="term-window">
            <div class="term-titlebar">
              <div class="term-traffic">
                <span class="term-dot term-dot-red"></span>
                <span class="term-dot term-dot-yellow"></span>
                <span class="term-dot term-dot-green"></span>
              </div>
              <span class="term-title">aidimag-demo — dim — 120×40</span>
              <button class="term-close" @click="closeModal" aria-label="Close demo">×</button>
            </div>

            <!-- Welcome screen (before steps begin) -->
            <div v-if="!started" class="term-welcome">
              <img src="/logo.svg" alt="AI Dimag" class="term-welcome-logo" />
              <h2>Welcome to the AI Dimag demo</h2>
              <p class="term-welcome-desc">This is a simulated terminal experience. You'll run <code>dim</code> commands step by step to see how AI Dimag captures, verifies, and protects engineering knowledge.</p>
              <p class="term-welcome-sub">No installation needed. No terminal required. Just click <strong>Run</strong> on each step — or type the command yourself if you want the full experience.</p>
              <div class="term-welcome-choices">
                <button class="term-welcome-btn term-welcome-primary" @click="startGuided">▶ Guided tour (auto-run)</button>
                <button class="term-welcome-btn term-welcome-secondary" @click="startManual">Step by step (I'll type)</button>
              </div>
              <div class="term-welcome-meta">
                <span>⏱ ~3 minutes</span>
                <span>9 steps</span>
                <span>No install</span>
              </div>
            </div>

            <!-- Step pills (only after started) -->
            <div v-if="started" class="term-steps">
              <button
                v-for="(s, i) in steps"
                :key="i"
                class="term-step-pill"
                :class="{ active: i === step, done: i < step, current: i === step }"
                @click="goTo(i)"
                :aria-label="`Step ${i + 1}: ${s.shortLabel}`"
              >
                <span class="term-step-num">{{ i + 1 }}</span>
                <span class="term-step-label">{{ s.shortLabel }}</span>
              </button>
            </div>

            <!-- Terminal body (only after started) -->
            <div v-if="started" class="term-body" ref="termBody">
              <!-- Step info bar -->
              <div class="term-stepinfo">
                <span class="term-stepinfo-counter">Step {{ step + 1 }} of {{ steps.length }}</span>
                <span class="term-stepinfo-title">{{ steps[step].title }}</span>
                <span class="term-stepinfo-sub">{{ steps[step].subtitle }}</span>
              </div>

              <!-- Plain English explanation before command -->
              <div v-if="!stepStates[step].completed" class="term-explain">
                <span class="term-explain-icon">📖</span>
                <span class="term-explain-text">{{ steps[step].explain }}</span>
              </div>

              <!-- Hint with example command -->
              <div v-if="!stepStates[step].completed" class="term-hint">
                <span class="term-hint-icon">💡</span>
                <span>{{ steps[step].hint }}</span>
                <code class="term-hint-cmd" @click="fillCommand">{{ steps[step].cli.replace(/\\\n/g, ' ') }}</code>
                <button class="term-hint-copy" @click="copyCommand" :title="copied ? 'Copied!' : 'Copy command'">
                  <span v-if="copied">✓</span>
                  <span v-else>⧉</span>
                </button>
              </div>

              <!-- Command input line -->
              <div v-if="!stepStates[step].completed" class="term-input-line">
                <span class="term-prompt">$</span>
                <input
                  ref="inputEl"
                  v-model="userInput"
                  class="term-input"
                  :placeholder="steps[step].placeholder"
                  @keydown.enter="submitCommand"
                  @keydown.left.prevent="step > 0 && prev()"
                  @keydown.right.prevent="step < steps.length - 1 && next()"
                  spellcheck="false"
                  autocomplete="off"
                />
                <button class="term-run-btn" @click="runCommand">▶ Run command</button>
                <button class="term-skip-btn" @click="showAnswer">Skip typing</button>
              </div>
              <div v-if="inputError" class="term-input-error">{{ inputError }}</div>

              <!-- Completed command display with typing animation -->
              <div v-if="stepStates[step].completed" class="term-output-section">
                <div class="term-cmd-line">
                  <span class="term-prompt">$</span>
                  <span class="term-cmd-text">{{ typedCommand }}</span>
                  <span v-if="commandTyping" class="term-cursor">▊</span>
                </div>

                <!-- Flags explanation -->
                <div v-if="steps[step].flags && !commandTyping" class="term-flags">
                  <div v-for="f in steps[step].flags" :key="f.flag" class="term-flag-row">
                    <code class="term-flag">{{ f.flag }}</code>
                    <span class="term-flag-desc">{{ f.desc }}</span>
                  </div>
                </div>

                <!-- Terminal output -->
                <div v-if="!commandTyping" class="term-output">
                  <pre class="term-output-pre">{{ typedOutput }}<span v-if="outputTyping" class="term-cursor">▊</span></pre>
                </div>

                <!-- Screenshots carousel -->
                <div v-if="steps[step].screenshots && !commandTyping && !outputTyping" class="term-carousel">
                  <img :src="steps[step].screenshots[currentScreenshot]" :alt="`Dashboard screenshot ${currentScreenshot + 1}`" class="term-carousel-img" @click="expandScreenshot(steps[step].screenshots[currentScreenshot])" />
                  <button class="term-carousel-arrow term-carousel-prev" @click="prevScreenshot" aria-label="Previous screenshot">‹</button>
                  <button class="term-carousel-arrow term-carousel-next" @click="nextScreenshot" aria-label="Next screenshot">›</button>
                  <div class="term-carousel-dots">
                    <button
                      v-for="(_, i) in steps[step].screenshots"
                      :key="i"
                      class="term-carousel-dot"
                      :class="{ active: i === currentScreenshot }"
                      @click="goToScreenshot(i)"
                      :aria-label="`Screenshot ${i + 1}`"
                    />
                  </div>
                </div>

                <!-- Diff display -->
                <div v-if="steps[step].diff && !commandTyping && !outputTyping" class="term-diff">
                  <div class="term-diff-file">{{ steps[step].diff.file }}</div>
                  <pre class="term-diff-content"><span v-for="(line, i) in steps[step].diff.added" :key="i" class="term-diff-added">+ {{ line }}
</span></pre>
                </div>

                <!-- Risk score -->
                <div v-if="steps[step].risk && !commandTyping && !outputTyping" class="term-risk">
                  <div class="term-risk-label">Risk Score</div>
                  <div class="term-risk-score" :style="{ color: riskColor(steps[step].risk.score) }">{{ steps[step].risk.score }}/100</div>
                  <div class="term-risk-level" :style="{ color: riskColor(steps[step].risk.score) }">{{ steps[step].risk.level }}</div>
                  <div class="term-risk-bar"><div class="term-risk-bar-fill" :style="{ width: steps[step].risk.score + '%', background: riskColor(steps[step].risk.score) }"></div></div>
                </div>

                <!-- Plain English summary after output -->
                <div v-if="steps[step].explainAfter && !commandTyping && !outputTyping" class="term-explain-after">
                  <span class="term-explain-after-icon">💬</span>
                  <span class="term-explain-after-text">{{ steps[step].explainAfter }}</span>
                </div>

                <!-- What changed panel -->
                <div v-if="steps[step].changed && !commandTyping && !outputTyping" class="term-changed">
                  <div class="term-changed-label">What changed</div>
                  <div class="term-changed-text">{{ steps[step].changed }}</div>
                </div>
              </div>

              <!-- Memory state sidebar inside terminal -->
              <div v-if="stepStates[step].completed && !commandTyping && !outputTyping" class="term-mem-card" :class="memStatusClass">
                <div class="term-mem-header">
                  <span class="term-mem-kind">{{ steps[step].memory.kind }}</span>
                  <span class="term-mem-status" :class="memStatusClass">{{ steps[step].memory.status }}</span>
                </div>
                <div class="term-mem-claim">{{ steps[step].memory.claim }}</div>
                <div class="term-mem-meta">
                  <span>id: {{ steps[step].memory.id }}</span>
                  <span>conf: {{ steps[step].memory.confidence.toFixed(2) }}</span>
                  <span>scope: {{ steps[step].memory.scope }}</span>
                </div>
                <div v-if="steps[step].memory.evidence" class="term-mem-evidence">📊 {{ steps[step].memory.evidence }}</div>
                <div v-if="steps[step].memory.appliesWhen" class="term-mem-applies">⚠️ applies when: {{ steps[step].memory.appliesWhen }}</div>
              </div>

              <!-- Next button after completion -->
              <div v-if="stepStates[step].completed && !commandTyping && !outputTyping" class="term-next-row">
                <button v-if="step < steps.length - 1" class="term-next-btn" @click="next">Next step →</button>
                <button v-else class="term-next-btn term-replay-btn" @click="replay">↻ Replay from start</button>
              </div>
            </div>

            <!-- Progress bar -->
            <div class="term-progress">
              <div class="term-progress-fill" :style="{ width: progressPct + '%' }"></div>
            </div>

            <!-- Bottom toolbar -->
            <div v-if="started" class="term-toolbar">
              <div class="term-toolbar-left">
                <button class="term-tb-btn" :disabled="step === 0" @click="prev">← Prev</button>
                <button class="term-tb-btn" :class="{ active: autoPlay }" @click="toggleAuto">{{ autoPlay ? '⏸ Pause tour' : '▶ Auto-play' }}</button>
                <button class="term-tb-btn" :disabled="step === steps.length - 1" @click="next">Next →</button>
                <button class="term-tb-btn term-restart-btn" @click="restart">↻ Start over</button>
              </div>
              <div class="term-toolbar-right">
                <span class="term-kb-hint">← → navigate · Enter to run · Esc to close</span>
              </div>
            </div>
          </div>

          <!-- Summary + CTA (outside terminal window, inside modal) -->
          <div v-if="isLastStep && allCompleted" class="demo-modal-summary">
            <h3>What you just saw</h3>
            <div class="demo-summary-grid">
              <div class="demo-summary-item">
                <span class="demo-summary-icon">⚙️</span>
                <div><strong>Setup</strong><p>Initialize AI Dimag in your repo with git hooks.</p></div>
              </div>
              <div class="demo-summary-item">
                <span class="demo-summary-icon">📝</span>
                <div><strong>Remember</strong><p>Capture checkable claims with evidence commands.</p></div>
              </div>
              <div class="demo-summary-item">
                <span class="demo-summary-icon">✅</span>
                <div><strong>Verify</strong><p>Evidence re-runs automatically — verified claims earn trust.</p></div>
              </div>
              <div class="demo-summary-item">
                <span class="demo-summary-icon">🚫</span>
                <div><strong>Check</strong><p>Pre-commit checks block violations before they land.</p></div>
              </div>
              <div class="demo-summary-item">
                <span class="demo-summary-icon">⚠️</span>
                <div><strong>Detect staleness</strong><p>When code drifts, memories flip to STALE.</p></div>
              </div>
              <div class="demo-summary-item">
                <span class="demo-summary-icon">🧠</span>
                <div><strong>Prevent mistakes</strong><p>FAILED_APPROACH memories warn before repeating dead ends.</p></div>
              </div>
              <div class="demo-summary-item">
                <span class="demo-summary-icon">🖥️</span>
                <div><strong>Dashboard</strong><p>Visualize memory health with a local web dashboard.</p></div>
              </div>
              <div class="demo-summary-item">
                <span class="demo-summary-icon">📄</span>
                <div><strong>Generate context</strong><p>Export verified memory to CLAUDE.md, .cursorrules, and more.</p></div>
              </div>
            </div>
          </div>

          <!-- Sticky CTA -->
          <div class="demo-modal-cta">
            <a href="/getting-started" class="demo-cta-btn">Get Started →</a>
            <a href="https://github.com/AiDimag/aidimag" class="demo-cta-btn demo-cta-secondary">GitHub</a>
            <a href="/sample-repo" class="demo-cta-link">Sample repo →</a>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const steps = [
  {
    shortLabel: 'Setup',
    title: '1. Initialize AI Dimag in your repo',
    subtitle: 'Run dim setup to create config, install git hooks, and prepare memory storage',
    hint: 'Type: dim setup',
    placeholder: 'dim setup',
    accept: ['dim setup', 'dim init', 'dim s'],
    cli: 'dim setup',
    explain: 'First, we initialize AI Dimag in your repository. This creates a local database for memories and installs a git hook that will check your commits later.',
    explainAfter: 'That\'s it — AI Dimag is now set up. The .aidimag/ folder contains your memory database and config. The git hook will automatically check your commits for violations.',
    flags: [
      { flag: 'dim setup', desc: 'Creates .aidimag/ directory, config.json, memory.db, and installs git pre-commit hook' },
    ],
    output: '⚙️  AI Dimag setup\n\n  ✓ Created .aidimag/ directory\n  ✓ Created .aidimag/config.json (added to .gitignore)\n  ✓ Created .aidimag/memory.db (SQLite)\n  ✓ Installed git pre-commit hook (.git/hooks/pre-commit)\n  ✓ Configured default model: claude-sonnet-4-20250514\n\nSetup complete. Run `dim bootstrap` to scan your repo\nand suggest your first memories.',
    memory: {
      id: '—',
      kind: 'SETUP',
      claim: 'AI Dimag initialized — .aidimag/ ready, git hook installed',
      status: 'READY',
      confidence: 1.0,
      scope: '.aidimag',
      evidence: 'Filesystem check: .aidimag/config.json exists, .git/hooks/pre-commit executable',
    },
    changed: 'Created .aidimag/ directory with config, memory database, and git pre-commit hook. Your repo is now ready to capture and verify memories.',
  },
  {
    shortLabel: 'Bootstrap',
    title: '2. Bootstrap surveys your repo',
    subtitle: 'AI Dimag scans your code and suggests memories with auto-generated evidence',
    hint: 'Type: dim bootstrap',
    placeholder: 'dim bootstrap',
    accept: ['dim bootstrap', 'dim boot', 'dim b'],
    cli: 'dim bootstrap',
    explain: 'Now let\'s scan your codebase. AI Dimag reads your README, file structure, and git history to suggest memories — things like conventions, decisions, and patterns it finds.',
    explainAfter: 'AI Dimag found 3 memory candidates! Each one has an evidence command — a shell command that can prove whether the claim is still true. But these are just proposals — they need your approval first.',
    flags: [
      { flag: 'dim bootstrap', desc: 'Surveys README, manifests, directory structure, and git history — LLM suggests memories with evidence commands' },
    ],
    output: '🔍  Surveying repo...\n     Scanning README.md, package.json, tsconfig.json\n     Analyzing directory structure (47 files)\n     Reading last 50 commits\n\nFound 3 memory candidates:\n\n  1. [CONVENTION] All DB access goes through src/db/store.ts\n     evidence: STATIC_CHECK: ! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts\n     scope: src\n\n  2. [DECISION] We use better-sqlite3 instead of Prisma\n     evidence: COMMIT_REF: a1b2c3d\n     scope: src/db\n\n  3. [CONVENTION] Error responses use { error: { code, message } } format\n     evidence: (none — manual review needed)\n     scope: src/api\n\nRun `dim review` to approve or reject.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'UNVERIFIED',
      confidence: 0.50,
      scope: 'src',
      evidence: 'STATIC_CHECK: ! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts (auto-generated)',
    },
    changed: '3 memory proposals created with auto-generated evidence commands. All start as UNVERIFIED with 0.50 confidence — they need your review and evidence verification before earning trust.',
  },
  {
    shortLabel: 'Review',
    title: '3. Review and approve proposals',
    subtitle: 'Approve the proposals — AI Dimag runs the evidence command automatically',
    hint: 'Type: dim review --yes',
    placeholder: 'dim review --yes',
    accept: ['dim review', 'dim rev', 'dim review --yes'],
    cli: 'dim review --yes',
    explain: 'AI Dimag doesn\'t trust its own suggestions — you need to approve them first. This is the human review step. You can approve all at once (--yes) or review one by one.',
    explainAfter: 'All 3 proposals are now approved. But they\'re still just claims — the evidence hasn\'t been run yet. That\'s what verification is for.',
    flags: [
      { flag: 'dim review --yes', desc: 'Approves all pending proposals — you can also review one-by-one with `dim review`' },
    ],
    output: '📋  Reviewing 3 proposals...\n\n  ✓ Approved  4f3a9c21  CONVENTION  All DB access goes through src/db/store.ts\n  ✓ Approved  7a2c8e15  DECISION   We use better-sqlite3 instead of Prisma\n  ✓ Approved  9b1d3f07  CONVENTION Error responses use { error: { code, message } } format\n\n3 proposals approved. Run `dim verify` to run\nevidence commands and boost confidence.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'APPROVED',
      confidence: 0.50,
      scope: 'src',
      evidence: 'STATIC_CHECK: ! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts (pending verification)',
    },
    changed: '3 proposals approved. Status changed from UNVERIFIED → APPROVED. Confidence still 0.50 — evidence commands haven\'t run yet. That happens in the next step.',
  },
  {
    shortLabel: 'Verify',
    title: '4. Verify — evidence runs and confidence boosts',
    subtitle: 'AI Dimag executes the STATIC_CHECK command. If it passes, the memory earns VERIFIED status',
    hint: 'Type: dim verify',
    placeholder: 'dim verify',
    accept: ['dim verify', 'dim v'],
    cli: 'dim verify',
    explain: 'This is the magic step. AI Dimag runs the evidence command for each memory. If the command passes, the memory earns VERIFIED status and higher confidence. If it fails, the memory stays unverified or goes stale.',
    explainAfter: '2 memories are now VERIFIED with boosted confidence (0.50 → 0.80). The evidence command actually ran — this isn\'t just a claim, it\'s a proven fact about your codebase.',
    flags: [
      { flag: 'dim verify', desc: 'Runs all pending evidence commands. PASS → VERIFIED + confidence boost. FAIL → stays UNVERIFIED or goes STALE' },
    ],
    output: '🔬  Verifying 3 memories...\n\n  Running STATIC_CHECK for 4f3a9c21...\n    $ grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts\n    (no output — check passed)\n\n  Running COMMIT_REF for 7a2c8e15...\n    $ git show a1b2c3d --stat\n    commit a1b2c3d "Switch from Prisma to better-sqlite3"\n    (verified)\n\n  9b1d3f07 has no evidence command — skipping.\n\n✓ [CONVENTION] All DB access goes through src/db/store.ts\n    id=4f3a9c21  status=VERIFIED  conf=0.80  scope=src\n    evidence: STATIC_CHECK (PASS)\n\n✓ [DECISION] We use better-sqlite3 instead of Prisma\n    id=7a2c8e15  status=VERIFIED  conf=0.85  scope=src/db\n    evidence: COMMIT_REF (verified)\n\n2 memories verified. Confidence boosted 0.50 → 0.80.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'VERIFIED',
      confidence: 0.80,
      scope: 'src',
      evidence: 'STATIC_CHECK (PASS) — grep found no stray imports',
    },
    changed: '2 memories verified! Status: APPROVED → VERIFIED. Confidence boosted 0.50 → 0.80. The evidence command ran and passed — this memory now has executable proof backing it.',
  },
  {
    shortLabel: 'Check',
    title: '5. Someone breaks the convention — dim check catches it',
    subtitle: 'A teammate stages a file that imports better-sqlite3 outside src/db/store.ts. The pre-commit hook fires.',
    hint: 'Type: dim check --block',
    placeholder: 'dim check --block',
    accept: ['dim check', 'dim verify', 'git commit', 'dim check --block'],
    cli: 'dim check --block',
    explain: 'Imagine a teammate adds a file that breaks the convention. The git pre-commit hook runs `dim check` automatically. With --block, it stops the commit from landing.',
    explainAfter: 'The commit was blocked! AI Dimag detected that the new file violates the convention and calculated a risk score. The developer gets a clear message about what\'s wrong and how to fix it.',
    flags: [
      { flag: '--block', desc: 'Exits with code 1 on violations — used by the git pre-commit hook to block the commit' },
    ],
    output: '🚫  [CONVENTION] All DB access goes through src/db/store.ts\n     severity: fail\n     detail: src/api/handler.ts imports better-sqlite3 outside src/db/store.ts\n\n     Risk Score: 72/100 (HIGH)\n       +40  convention violation\n       +20  critical path touched (src/db)\n       +12  change breadth (1 file)\n\n     exit 1 — blocked by --block flag\n\n💡  Fix: move the import into src/db/store.ts or\n     add a scoped exception with `dim remember --exception`.',
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
    diff: {
      file: 'src/api/handler.ts',
      added: [
        'import Database from "better-sqlite3";',
        'const db = new Database("./app.db");',
      ],
    },
    changed: 'The pre-commit hook detected a violation! The VERIFIED memory\'s evidence command now FAILS because of the stray import. The commit is blocked. Risk score: 72/100 HIGH.',
  },
  {
    shortLabel: 'Stale',
    title: '6. Memory goes STALE — drift detected',
    subtitle: 'After the bad code lands (hook bypassed with --no-verify), verify detects the drift automatically',
    hint: 'Type: dim verify',
    placeholder: 'dim verify',
    accept: ['dim verify', 'dim v'],
    cli: 'dim verify',
    explain: 'What if someone bypasses the hook with --no-verify? The next time `dim verify` runs, it re-checks the evidence. Since the code drifted, the memory automatically flips to STALE.',
    explainAfter: 'The memory is now STALE. This is the key difference from static context files — AI Dimag notices when reality changes. Agents will see a STALE warning instead of trusting outdated information.',
    output: '🔬  Verifying 3 memories...\n\n  Running STATIC_CHECK for 4f3a9c21...\n    $ grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts\n    src/api/handler.ts\n    (output found — check FAILED)\n\n~  [VERIFIED → STALE]  conf 0.80 → 0.20\n   All DB access goes through src/db/store.ts\n   id=4f3a9c21  scope=src\n   evidence: STATIC_CHECK (FAIL)\n   src/api/handler.ts imports better-sqlite3 outside src/db/store.ts\n\n1 memory went stale. The memory noticed the code drifted.\n\nNext `dim generate-context` will include a STALE warning\nso agents know this convention is currently broken.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'STALE',
      confidence: 0.20,
      scope: 'src',
      evidence: 'STATIC_CHECK (FAIL) — grep found stray import in handler.ts',
    },
    changed: 'Memory status flipped: VERIFIED → STALE. Confidence dropped 0.80 → 0.20. The evidence command now fails because the code drifted. Agents will see this as a STALE warning instead of trusting it blindly.',
  },
  {
    shortLabel: 'Failed',
    title: '7. Prevent a known dead end — FAILED_APPROACH',
    subtitle: 'Record a lesson your team already learned so agents don\'t repeat the mistake',
    hint: 'Type: dim remember "Retry on declined payments caused duplicate ledger entries" --kind FAILED_APPROACH --path src/payments',
    placeholder: 'dim remember ...',
    accept: ['dim remember', 'dim rem'],
    cli: 'dim remember \\\n  "Retry on declined payments caused duplicate ledger entries" \\\n  --kind FAILED_APPROACH --path src/payments \\\n  --applies-when "keyword:retry keyword:idempotency"',
    explain: 'This is AI Dimag\'s secret weapon. Instead of just remembering what was done, you can record what DIDN\'T work. When an agent tries something similar, it gets warned before wasting time.',
    explainAfter: 'Now any agent working in src/payments will see this warning before adding retry logic. This is how teams stop agents from repeating known mistakes.',
    flags: [
      { flag: '--kind FAILED_APPROACH', desc: 'Marks this as a failed approach — agents get warned before repeating it' },
      { flag: '--applies-when', desc: 'Only fires when these keywords appear in the code being written' },
      { flag: '--path src/payments', desc: 'Scoped to this directory — only triggers for changes in src/payments' },
    ],
    output: '✓  Memory written\n   id=8b2e1f04  kind=FAILED_APPROACH  conf=0.50\n   scope: src/payments\n   applies_when: keyword:retry, keyword:idempotency\n\nNext time an agent tries to add retry logic\nin src/payments, it will see this warning first:\n\n  ⚠️  FAILED_APPROACH detected\n      "Retry on declined payments caused duplicate\n       ledger entries" (PR #417, reverted)\n      Recommendation: Add idempotency protection\n      before retrying.',
    memory: {
      id: '8b2e1f04',
      kind: 'FAILED_APPROACH',
      claim: 'Retry on declined payments caused duplicate ledger entries',
      status: 'UNVERIFIED',
      confidence: 0.50,
      scope: 'src/payments',
      appliesWhen: 'keyword:retry, keyword:idempotency',
    },
    changed: 'New FAILED_APPROACH memory created. This doesn\'t just recall what was done — it recalls what DIDN\'T work and why. Agents working in src/payments will see this warning before writing retry logic.',
  },
  {
    shortLabel: 'Dashboard',
    title: '8. Visualize everything with dim ui',
    subtitle: 'Launch a local web dashboard to browse memories, review proposals, and check sync status',
    hint: 'Type: dim ui',
    placeholder: 'dim ui',
    accept: ['dim ui', 'dim dashboard', 'dim web'],
    cli: 'dim ui',
    explain: 'Prefer a visual interface? `dim ui` launches a local web dashboard where you can browse memories, approve proposals, and see sync status — all in your browser.',
    explainAfter: 'The dashboard gives you a bird\'s-eye view of your memory health. You can see verified vs stale counts, pending proposals, and sync status — all without leaving your browser.',
    flags: [
      { flag: 'dim ui', desc: 'Starts a local web server at http://localhost:4517 with an interactive dashboard' },
    ],
    output: 'aidimag dashboard: http://localhost:4517 (Ctrl+C to stop)',
    screenshots: ['/screenshots/dashboard-overview.png', '/screenshots/dashboard-actions.png', '/screenshots/dashboard-health.png', '/screenshots/dashboard-tickets-modal.png'],
    memory: {
      id: '—',
      kind: 'UI',
      claim: 'Local web dashboard available at http://localhost:4517',
      status: 'READY',
      confidence: 1.0,
      scope: '.aidimag',
      evidence: 'HTTP server responding on port 4517',
    },
    changed: 'Launched the local web dashboard. You can now visually browse memories, approve proposals, and monitor sync status without using the CLI.',
  },
  {
    shortLabel: 'Export',
    title: '9. Generate context files for your agents',
    subtitle: 'Export verified memories to CLAUDE.md, .cursorrules, AGENTS.md, or MCP server — all from one source of truth',
    hint: 'Type: dim generate-context --all',
    placeholder: 'dim generate-context ...',
    accept: ['dim generate-context', 'dim gen', 'dim generate', 'dim generate-context --all'],
    cli: 'dim generate-context --all',
    explain: 'Finally, let\'s export your verified memories into context files that coding agents can read. One command generates files for Claude Code, Cursor, GitHub Copilot, and more — all from the same source of truth.',
    explainAfter: 'That\'s cross-agent portability! Every agent on your team — Claude Code, Cursor, Copilot — now has the same verified knowledge, including STALE warnings and failed-approach lessons. No more maintaining separate context files.',
    flags: [
      { flag: '--all', desc: 'Generates all supported formats: CLAUDE.md, .cursorrules, AGENTS.md, .github/copilot-instructions.md' },
      { flag: '--mcp', desc: 'Alternatively, serve memories live via the MCP server (dim mcp start) — no file generation needed' },
    ],
    output: '📄  Generating context files...\n\n  ✓ .claude/CLAUDE.md          (3 verified, 1 stale, 1 failed_approach)\n  ✓ .cursor/rules/aidimag.mdc  (3 verified, 1 stale, 1 failed_approach)\n  ✓ AGENTS.md                  (3 verified, 1 stale, 1 failed_approach)\n  ✓ .github/copilot-instructions.md (3 verified, 1 stale, 1 failed_approach)\n\n  STALE warning included for:\n    4f3a9c21  All DB access goes through src/db/store.ts\n\n  FAILED_APPROACH warning included for:\n    8b2e1f04  Retry on declined payments...\n\n4 files generated. Every coding agent on your team\nnow has the same verified knowledge — no matter\nwhich tool they use.',
    memory: {
      id: '4f3a9c21',
      kind: 'CONVENTION',
      claim: 'All DB access goes through src/db/store.ts',
      status: 'STALE',
      confidence: 0.20,
      scope: 'src',
      evidence: 'STATIC_CHECK (FAIL) — stale warning included in all generated files',
    },
    changed: '4 context files generated from one source of truth. Every agent — Claude Code, Cursor, GitHub Copilot, or any AGENTS.md reader — gets the same verified knowledge, including STALE warnings and FAILED_APPROACH lessons. This is cross-agent portability in action.',
  },
]

const modalOpen = ref(false)
const started = ref(false)
const guidedMode = ref(false)
const step = ref(0)
const autoPlay = ref(false)
const typedOutput = ref('')
const typedCommand = ref('')
const userInput = ref('')
const inputError = ref('')
const inputEl = ref(null)
const termBody = ref(null)
const commandTyping = ref(false)
const outputTyping = ref(false)
const copied = ref(false)
const currentScreenshot = ref(0)
let screenshotTimer = null
let autoTimer = null
let cmdTimer = null
let outputTimer = null
let escHandler = null

const stepStates = ref(steps.map(() => ({ completed: false })))

const progressPct = computed(() => ((step.value + 1) / steps.length) * 100)
const isLastStep = computed(() => step.value === steps.length - 1)
const allCompleted = computed(() => stepStates.value.every(s => s.completed))
const memStatusClass = computed(() => {
  const s = steps[step.value].memory.status
  if (s === 'VERIFIED') return 'mem-verified'
  if (s === 'STALE') return 'mem-stale'
  if (s === 'APPROVED') return 'mem-approved'
  if (s === 'READY') return 'mem-ready'
  return 'mem-unverified'
})

function riskColor(score) {
  if (score >= 80) return '#ef4444'
  if (score >= 60) return '#f97316'
  if (score >= 30) return '#eab308'
  return '#22c55e'
}

function typeCommand(text, callback) {
  commandTyping.value = true
  typedCommand.value = ''
  let i = 0
  function tick() {
    if (i >= text.length) {
      commandTyping.value = false
      if (callback) callback()
      return
    }
    typedCommand.value = text.slice(0, i + 1)
    i++
    cmdTimer = setTimeout(tick, 20)
  }
  tick()
}

function typeOutput(text, callback) {
  outputTyping.value = true
  typedOutput.value = ''
  let i = 0
  function tick() {
    if (i >= text.length) {
      outputTyping.value = false
      if (callback) callback()
      return
    }
    typedOutput.value = text.slice(0, i + 1)
    i++
    scrollToBottom()
    outputTimer = setTimeout(tick, 3)
  }
  tick()
}

function scrollToBottom() {
  nextTick(() => {
    if (termBody.value) {
      termBody.value.scrollTop = termBody.value.scrollHeight
    }
  })
}

function normalizeCmd(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/['"]/g, '"').trim()
}

function executeStep() {
  const s = steps[step.value]
  const cmdText = s.cli.replace(/\\\n/g, '\n')
  stepStates.value[step.value].completed = true
  currentScreenshot.value = 0
  stopScreenshotTimer()
  typeCommand(cmdText, () => {
    typeOutput(s.output, () => {
      scrollToBottom()
      startScreenshotTimer()
    })
  })
}

function submitCommand() {
  const s = steps[step.value]
  const input = userInput.value.trim()
  if (!input) return
  const normalized = normalizeCmd(input)
  const accepted = s.accept.map(normalizeCmd)
  if (accepted.includes(normalized)) {
    inputError.value = ''
    executeStep()
  } else {
    inputError.value = `Not quite — type "${s.cli.replace(/\\\n/g, ' ')}" or click the hint to copy it.`
  }
}

function showAnswer() {
  inputError.value = ''
  executeStep()
}

function runCommand() {
  inputError.value = ''
  executeStep()
}

function fillCommand() {
  const s = steps[step.value]
  userInput.value = s.cli.replace(/\\\n/g, ' ')
  nextTick(() => {
    if (inputEl.value) inputEl.value.focus()
  })
}

function copyCommand() {
  const s = steps[step.value]
  const cmd = s.cli.replace(/\\\n/g, ' ')
  navigator.clipboard.writeText(cmd).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}

function startScreenshotTimer() {
  stopScreenshotTimer()
  const s = steps[step.value]
  if (s.screenshots && s.screenshots.length > 1) {
    screenshotTimer = setInterval(() => {
      currentScreenshot.value = (currentScreenshot.value + 1) % s.screenshots.length
    }, 10000)
  }
}

function stopScreenshotTimer() {
  if (screenshotTimer) {
    clearInterval(screenshotTimer)
    screenshotTimer = null
  }
}

function nextScreenshot() {
  const s = steps[step.value]
  if (s.screenshots) {
    currentScreenshot.value = (currentScreenshot.value + 1) % s.screenshots.length
    startScreenshotTimer()
  }
}

function prevScreenshot() {
  const s = steps[step.value]
  if (s.screenshots) {
    currentScreenshot.value = (currentScreenshot.value - 1 + s.screenshots.length) % s.screenshots.length
    startScreenshotTimer()
  }
}

function goToScreenshot(i) {
  currentScreenshot.value = i
  startScreenshotTimer()
}

function expandScreenshot(src) {
  const overlay = document.createElement('div')
  overlay.id = 'dim-lightbox'
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10001;display:flex;align-items:center;justify-content:center;padding:2rem;cursor:zoom-out;">
      <button aria-label="Close" style="position:fixed;top:1.5rem;right:1.5rem;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.2s;backdrop-filter:blur(4px);">&times;</button>
      <img src="${src}" alt="Dashboard screenshot" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 8px 48px rgba(0,0,0,0.5);object-fit:contain;" />
    </div>
  `
  document.body.appendChild(overlay)
  const close = () => overlay.remove()
  overlay.addEventListener('click', close)
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close()
      document.removeEventListener('keydown', escHandler)
    }
  }
  document.addEventListener('keydown', escHandler)
}

function startGuided() {
  started.value = true
  guidedMode.value = true
  autoPlay.value = true
  nextTick(() => {
    renderStep()
    startAuto()
  })
}

function startManual() {
  started.value = true
  guidedMode.value = false
  nextTick(() => {
    renderStep()
  })
}

function restart() {
  step.value = 0
  started.value = false
  guidedMode.value = false
  autoPlay.value = false
  stepStates.value = steps.map(() => ({ completed: false }))
  typedOutput.value = ''
  typedCommand.value = ''
  userInput.value = ''
  inputError.value = ''
  commandTyping.value = false
  outputTyping.value = false
  currentScreenshot.value = 0
  stopScreenshotTimer()
  stopAuto()
}

function renderStep() {
  typedOutput.value = ''
  typedCommand.value = ''
  userInput.value = ''
  inputError.value = ''
  commandTyping.value = false
  outputTyping.value = false
  currentScreenshot.value = 0
  stopScreenshotTimer()
  if (autoPlay.value && !stepStates.value[step.value].completed) {
    executeStep()
  }
  if (!stepStates.value[step.value].completed) {
    nextTick(() => {
      if (inputEl.value) inputEl.value.focus()
    })
  } else {
    // Re-render the completed step
    const s = steps[step.value]
    typedCommand.value = s.cli.replace(/\\\n/g, '\n')
    typedOutput.value = s.output
    startScreenshotTimer()
  }
}

function next() {
  if (step.value < steps.length - 1) {
    step.value++
    renderStep()
    scrollToBottom()
  } else {
    stopAuto()
  }
}
function prev() {
  if (step.value > 0) {
    step.value--
    renderStep()
    scrollToBottom()
  }
}
function goTo(i) {
  step.value = i
  renderStep()
  stopAuto()
  scrollToBottom()
}

function replay() {
  step.value = 0
  stepStates.value = steps.map(() => ({ completed: false }))
  typedOutput.value = ''
  typedCommand.value = ''
  renderStep()
}

function startAuto() {
  autoPlay.value = true
  autoTimer = setInterval(() => {
    if (step.value < steps.length - 1) {
      next()
    } else {
      stopAuto()
    }
  }, 6000)
}
function stopAuto() {
  autoPlay.value = false
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}
function toggleAuto() {
  if (autoPlay.value) stopAuto()
  else {
    if (!stepStates.value[step.value].completed) {
      executeStep()
    }
    startAuto()
  }
}

function openModal() {
  modalOpen.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    escHandler = (e) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', escHandler)
  })
}

function closeModal() {
  modalOpen.value = false
  started.value = false
  guidedMode.value = false
  document.body.style.overflow = ''
  stopScreenshotTimer()
  stopAuto()
  if (escHandler) {
    document.removeEventListener('keydown', escHandler)
    escHandler = null
  }
}

onMounted(() => {
  nextTick(() => {
    openModal()
  })
})

onUnmounted(() => {
  stopAuto()
  stopScreenshotTimer()
  if (cmdTimer) clearTimeout(cmdTimer)
  if (outputTimer) clearTimeout(outputTimer)
  if (escHandler) document.removeEventListener('keydown', escHandler)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* ===== Launcher button ===== */
.demo-launcher {
  margin: 24px 0;
}
.demo-launch-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 20px 24px;
  border-radius: 14px;
  border: 2px solid var(--vp-c-brand);
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  transition: all 0.25s;
  text-align: left;
}
.demo-launch-btn:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-bg-alt);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.15);
}
.demo-launch-icon {
  font-size: 28px;
  color: var(--vp-c-brand);
  flex-shrink: 0;
}
.demo-launch-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.demo-launch-text strong {
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.demo-launch-text small {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.demo-launch-arrow {
  font-size: 20px;
  color: var(--vp-c-brand);
  flex-shrink: 0;
}

/* ===== Modal overlay ===== */
.demo-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: demo-fade-in 0.2s ease;
}
@keyframes demo-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.demo-modal {
  width: 100%;
  max-width: 1000px;
  height: 92vh;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  gap: 0;
  animation: demo-slide-up 0.3s ease;
  overflow: hidden;
}
.demo-modal-compact {
  height: auto;
  max-height: 90vh;
}
@keyframes demo-slide-up {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* ===== Terminal window ===== */
.term-window {
  background: #0c0e14;
  border-radius: 12px 12px 0 0;
  border: 1px solid #1e2330;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

/* Welcome screen */
.term-welcome {
  padding: 48px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-height: 300px;
  justify-content: center;
}
.term-welcome-logo {
  width: 56px;
  height: 56px;
  margin-bottom: 4px;
}
.term-welcome h2 {
  font-size: 22px;
  font-weight: 700;
  color: #e8ecf0;
  margin-bottom: 4px;
}
.term-welcome-desc {
  font-size: 14px;
  color: #9ca3af;
  max-width: 520px;
  line-height: 1.6;
  margin: 0;
}
.term-welcome-desc code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--vp-c-brand);
  background: #131620;
  padding: 2px 6px;
  border-radius: 4px;
}
.term-welcome-sub {
  font-size: 13px;
  color: #6b7280;
  max-width: 480px;
  line-height: 1.6;
  margin: 0;
}
.term-welcome-sub strong {
  color: #e8ecf0;
}
.term-welcome-choices {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: center;
}
.term-welcome-btn {
  padding: 12px 24px;
  border-radius: 10px;
  border: 1px solid var(--vp-button-brand-border);
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.term-welcome-btn:hover {
  background: var(--vp-button-brand-hover-bg);
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}
.term-welcome-primary {
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
}
.term-welcome-primary:hover {
  background: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-hover-text);
}
.term-welcome-secondary {
  background: var(--vp-button-alt-bg, transparent);
  border: 1px solid var(--vp-button-alt-border, var(--vp-c-border));
  color: var(--vp-button-alt-text, var(--vp-c-text-1));
}
.term-welcome-secondary:hover {
  background: var(--vp-button-alt-hover-bg, var(--vp-c-bg-alt));
  border-color: var(--vp-button-alt-hover-border, var(--vp-c-border));
  color: var(--vp-button-alt-hover-text, var(--vp-c-text-1));
}
.term-welcome-meta {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  font-size: 12px;
  color: #4a5060;
  font-family: 'JetBrains Mono', monospace;
}

/* Plain English explanation before command */
.term-explain {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.15);
  font-size: 13px;
  color: #b8c4d4;
  line-height: 1.6;
}
.term-explain-icon {
  flex-shrink: 0;
  font-size: 15px;
}
.term-explain-text {
  flex: 1;
}

/* Plain English summary after output */
.term-explain-after {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  margin: 12px 0;
  border-radius: 8px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.15);
  font-size: 13px;
  color: #b8c4d4;
  line-height: 1.6;
}
.term-explain-after-icon {
  flex-shrink: 0;
  font-size: 15px;
}
.term-explain-after-text {
  flex: 1;
}

/* Clickable hint command */
.term-hint-cmd {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--vp-c-brand);
  background: #131620;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: 4px;
  border: 1px solid #1e2330;
}
.term-hint-cmd:hover {
  background: #1a1d27;
  border-color: var(--vp-c-brand);
}

/* Copy button next to hint command */
.term-hint-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid #1e2330;
  background: #131620;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
  transition: all 0.15s;
  padding: 0;
  margin-left: 2px;
}
.term-hint-copy:hover {
  background: #1a1d27;
  border-color: #3a3f4d;
  color: #e8ecf0;
}

/* Restart button in toolbar */
.term-restart-btn {
  margin-left: auto;
}

/* Title bar */
.term-titlebar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #14171f;
  border-bottom: 1px solid #1e2330;
  gap: 12px;
}
.term-traffic {
  display: flex;
  gap: 7px;
  flex-shrink: 0;
}
.term-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.term-dot-red { background: #ff5f57; }
.term-dot-yellow { background: #febc2e; }
.term-dot-green { background: #28c840; }
.term-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #6b7280;
  flex: 1;
  text-align: center;
}
.term-close {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s;
  flex-shrink: 0;
}
.term-close:hover {
  background: #1e2330;
  color: #ef4444;
}

/* Step pills */
.term-steps {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: #0f1117;
  border-bottom: 1px solid #1e2330;
  overflow-x: auto;
  scrollbar-width: thin;
}
.term-step-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-size: 12px;
}
.term-step-pill:hover {
  background: #1a1d27;
}
.term-step-pill.done {
  color: #28c840;
}
.term-step-pill.active {
  background: var(--vp-c-brand);
  color: #fff;
  border-color: var(--vp-c-brand);
}
.term-step-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  opacity: 0.7;
}
.term-step-label {
  font-weight: 500;
}

/* Terminal body (scrollable) */
.term-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #c8d0d8;
  background: #0c0e14;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #2a2f3d transparent;
}
.term-body::-webkit-scrollbar {
  width: 8px;
}
.term-body::-webkit-scrollbar-track {
  background: transparent;
}
.term-body::-webkit-scrollbar-thumb {
  background: #2a2f3d;
  border-radius: 4px;
}

/* Step info bar */
.term-stepinfo {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1a1d27;
}
.term-stepinfo-counter {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: var(--vp-c-brand);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}
.term-stepinfo-title {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: #e8ecf0;
  margin-bottom: 2px;
}
.term-stepinfo-sub {
  display: block;
  font-size: 12px;
  color: #7a8290;
}

/* Hint */
.term-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  border-radius: 8px;
  background: #131620;
  border: 1px solid #1e2330;
  font-size: 12px;
  color: #9ca3af;
}
.term-hint-icon {
  flex-shrink: 0;
}

/* Input line */
.term-input-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}
.term-prompt {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  color: #28c840;
  flex-shrink: 0;
}
.term-input {
  flex: 1;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #1e2330;
  background: #0f1117;
  color: #e8ecf0;
  outline: none;
  transition: border-color 0.2s;
}
.term-input:focus {
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}
.term-input::placeholder {
  color: #4a5060;
}
.term-run-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--vp-button-brand-border);
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;
}
.term-run-btn:hover {
  background: var(--vp-button-brand-hover-bg);
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text);
}
.term-skip-btn {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-button-alt-border, var(--vp-c-border));
  background: var(--vp-button-alt-bg, transparent);
  color: var(--vp-button-alt-text, var(--vp-c-text-2));
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;
}
.term-skip-btn:hover {
  background: var(--vp-button-alt-hover-bg, var(--vp-c-bg-alt));
  border-color: var(--vp-button-alt-hover-border, var(--vp-c-border));
  color: var(--vp-button-alt-hover-text, var(--vp-c-text-1));
}
.term-input-error {
  margin-top: 6px;
  font-size: 12px;
  color: #ef4444;
}

/* Output section */
.term-output-section {
  margin-top: 8px;
}
.term-cmd-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
}
.term-cmd-text {
  color: #e8ecf0;
  white-space: pre-wrap;
  word-break: break-word;
}
.term-cursor {
  color: var(--vp-c-brand);
  animation: term-blink 1s steps(2) infinite;
  font-weight: 700;
}
@keyframes term-blink {
  50% { opacity: 0; }
}

/* Flags */
.term-flags {
  margin: 12px 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #131620;
  border: 1px solid #1e2330;
}
.term-flag-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 6px;
}
.term-flag-row:last-child {
  margin-bottom: 0;
}
.term-flag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand);
  white-space: nowrap;
  flex-shrink: 0;
}
.term-flag-desc {
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
}

/* Terminal output */
.term-output {
  margin: 8px 0;
}
.term-output-pre {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #a8b3c0;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* Screenshots carousel */
.term-carousel {
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #1e2330;
  position: relative;
}
.term-carousel-img {
  width: 100%;
  display: block;
  cursor: zoom-in;
}
.term-carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  padding: 0;
  z-index: 1;
}
.term-carousel-arrow:hover {
  background: rgba(0, 0, 0, 0.7);
}
.term-carousel-prev {
  left: 8px;
}
.term-carousel-next {
  right: 8px;
}
.term-carousel-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 6px;
  background: #0a0c12;
}
.term-carousel-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: none;
  background: #2a2f3d;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}
.term-carousel-dot.active {
  background: var(--vp-c-brand);
}

/* Diff */
.term-diff {
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #1e2330;
}
.term-diff-file {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  background: #131620;
  color: #9ca3af;
  border-bottom: 1px solid #1e2330;
}
.term-diff-content {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 10px 12px;
  margin: 0;
  background: #0f1117;
}
.term-diff-added {
  color: #22c55e;
  display: block;
}

/* Risk score */
.term-risk {
  margin: 12px 0;
  padding: 14px;
  border-radius: 8px;
  background: #131620;
  border: 1px solid #1e2330;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.term-risk-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
}
.term-risk-score {
  font-size: 32px;
  font-weight: 700;
  font-family: 'Space Grotesk', sans-serif;
  line-height: 1;
}
.term-risk-level {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.term-risk-bar {
  height: 6px;
  border-radius: 3px;
  background: #1e2330;
  overflow: hidden;
  margin-top: 4px;
}
.term-risk-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* What changed panel */
.term-changed {
  margin: 12px 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
}
.term-changed-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-brand);
  margin-bottom: 6px;
}
.term-changed-text {
  font-size: 13px;
  color: #c8d0d8;
  line-height: 1.6;
}

/* Memory card inside terminal */
.term-mem-card {
  margin: 14px 0;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid #1e2330;
  border-left: 4px solid #64748b;
  background: #0f1117;
  transition: all 0.3s ease;
}
.term-mem-card.mem-verified { border-left-color: #22c55e; }
.term-mem-card.mem-stale { border-left-color: #eab308; }
.term-mem-card.mem-approved { border-left-color: #3b82f6; }
.term-mem-card.mem-ready { border-left-color: #28c840; }
.term-mem-card.mem-unverified { border-left-color: #64748b; }
.term-mem-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.term-mem-kind {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
  background: #1a1d27;
  color: #9ca3af;
}
.term-mem-status {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.term-mem-status.mem-verified { color: #22c55e; }
.term-mem-status.mem-stale { color: #eab308; }
.term-mem-status.mem-approved { color: #3b82f6; }
.term-mem-status.mem-ready { color: #28c840; }
.term-mem-status.mem-unverified { color: #64748b; }
.term-mem-claim {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: #e8ecf0;
  margin-bottom: 10px;
}
.term-mem-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: #6b7280;
  font-family: 'JetBrains Mono', monospace;
}
.term-mem-evidence {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
  padding: 6px 10px;
  border-radius: 6px;
  background: #131620;
}
.term-mem-applies {
  margin-top: 8px;
  font-size: 12px;
  color: #eab308;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(234, 179, 8, 0.08);
}

/* Next button */
.term-next-row {
  margin: 16px 0 8px;
  display: flex;
  gap: 8px;
}
.term-next-btn {
  padding: 10px 24px;
  border-radius: 8px;
  border: 1px solid var(--vp-button-brand-border);
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.term-next-btn:hover {
  background: var(--vp-button-brand-hover-bg);
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text);
  transform: translateY(-1px);
}
.term-replay-btn {
  background: var(--vp-button-alt-bg, transparent);
  border: 1px solid var(--vp-button-alt-border, var(--vp-c-border));
  color: var(--vp-button-alt-text, var(--vp-c-text-1));
}
.term-replay-btn:hover {
  background: var(--vp-button-alt-hover-bg, var(--vp-c-bg-alt));
  border-color: var(--vp-button-alt-hover-border, var(--vp-c-border));
  color: var(--vp-button-alt-hover-text, var(--vp-c-text-1));
}

/* Progress bar */
.term-progress {
  height: 3px;
  background: #14171f;
  border-bottom: 1px solid #1e2330;
  overflow: hidden;
}
.term-progress-fill {
  height: 100%;
  background: var(--vp-c-brand);
  transition: width 0.4s ease;
}

/* Bottom toolbar */
.term-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #14171f;
  border-radius: 0 0 0 0;
  gap: 12px;
  flex-wrap: wrap;
}
.term-toolbar-left {
  display: flex;
  gap: 6px;
}
.term-toolbar-right {
  display: flex;
  align-items: center;
}
.term-tb-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #1e2330;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.term-tb-btn:hover:not(:disabled) {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
}
.term-tb-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.term-tb-btn.active {
  background: var(--vp-c-brand);
  color: #fff;
  border-color: var(--vp-c-brand);
}
.term-kb-hint {
  font-size: 11px;
  color: #4a5060;
  font-family: 'JetBrains Mono', monospace;
}

/* ===== Summary (outside terminal, inside modal) ===== */
.demo-modal-summary {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 0;
  padding: 20px 24px;
  max-height: 25vh;
  overflow-y: auto;
  flex-shrink: 0;
}
.demo-modal-summary h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--vp-c-text-1);
}
.demo-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.demo-summary-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.demo-summary-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.demo-summary-item strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.demo-summary-item p {
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin: 2px 0 0;
  line-height: 1.4;
}

/* ===== Sticky CTA ===== */
.demo-modal-cta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: var(--vp-c-bg);
  border-radius: 0 0 12px 12px;
  border: 1px solid var(--vp-c-border);
  border-top: none;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.demo-cta-btn {
  display: inline-block;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text) !important;
  border: 1px solid var(--vp-button-brand-border);
  transition: all 0.2s;
}
.demo-cta-btn:hover {
  background: var(--vp-button-brand-hover-bg);
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text) !important;
}
.demo-cta-secondary {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1) !important;
  border: 1px solid var(--vp-c-border);
}
.demo-cta-link {
  font-size: 11px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  margin-left: auto;
}
.demo-cta-link:hover {
  color: var(--vp-c-brand);
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .demo-modal-overlay {
    padding: 8px;
  }
  .term-body {
    font-size: 12px;
    padding: 12px;
  }
  .term-step-label {
    display: none;
  }
  .term-step-pill {
    padding: 5px 8px;
  }
  .term-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .term-kb-hint {
    display: none;
  }
  .demo-modal-cta {
    flex-direction: column;
    align-items: stretch;
  }
  .demo-cta-link {
    margin-left: 0;
    text-align: center;
  }
}
</style>

<style>
/* ===== Light mode overrides (non-scoped for proper specificity) ===== */
html:not(.dark) .term-window {
  background: #f6f7f9;
  border-color: #d0d4da;
}
html:not(.dark) .term-titlebar {
  background: #ebedf0;
  border-color: #d0d4da;
}
html:not(.dark) .term-title {
  color: #4a5060;
}
html:not(.dark) .term-close {
  color: #6b7280;
}
html:not(.dark) .term-close:hover {
  color: #1a1d27;
}
html:not(.dark) .term-welcome h2 {
  color: #1a1d27;
}
html:not(.dark) .term-welcome-desc {
  color: #4a5060;
}
html:not(.dark) .term-welcome-sub {
  color: #6b7280;
}
html:not(.dark) .term-welcome-sub strong {
  color: #1a1d27;
}
html:not(.dark) .term-welcome-meta {
  color: #6b7280;
}
html:not(.dark) .term-welcome-desc code,
html:not(.dark) .term-hint-cmd,
html:not(.dark) .term-hint-copy {
  background: #ebedf0;
  color: #3b82f6;
  border-color: #d0d4da;
}
html:not(.dark) .term-hint-cmd:hover {
  background: #e0e3e8;
}
html:not(.dark) .term-hint-copy:hover {
  background: #e0e3e8;
  color: #1a1d27;
  border-color: #b0b6c0;
}
html:not(.dark) .term-steps {
  background: #ebedf0;
  border-color: #d0d4da;
}
html:not(.dark) .term-step-pill {
  background: #ebedf0;
  border-color: #d0d4da;
  color: #4a5060;
}
html:not(.dark) .term-step-pill:hover {
  background: #e0e3e8;
}
html:not(.dark) .term-step-pill.done {
  background: #d1fae5;
  border-color: #6ee7b7;
  color: #065f46;
}
html:not(.dark) .term-step-pill.active {
  background: var(--vp-c-brand);
  color: #fff;
  border-color: var(--vp-c-brand);
}
html:not(.dark) .term-body {
  background: #f6f7f9;
  color: #3a3f4d;
}
html:not(.dark) .term-body::-webkit-scrollbar-thumb {
  background: #c0c6d0;
}
html:not(.dark) .term-stepinfo {
  border-color: #d0d4da;
}
html:not(.dark) .term-stepinfo-title {
  color: #1a1d27;
}
html:not(.dark) .term-stepinfo-sub {
  color: #6b7280;
}
html:not(.dark) .term-explain {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
}
html:not(.dark) .term-hint {
  background: #fefce8;
  border-color: #fde68a;
  color: #92400e;
}
html:not(.dark) .term-input-line {
  border-color: #d0d4da;
}
html:not(.dark) .term-input {
  background: #fff;
  border-color: #d0d4da;
  color: #1a1d27;
}
html:not(.dark) .term-input::placeholder {
  color: #9ca3af;
}
html:not(.dark) .term-skip-btn {
  background: var(--vp-button-alt-bg, transparent);
  color: var(--vp-button-alt-text, var(--vp-c-text-2));
  border-color: var(--vp-button-alt-border, var(--vp-c-border));
}
html:not(.dark) .term-skip-btn:hover {
  background: var(--vp-button-alt-hover-bg, var(--vp-c-bg-alt));
  color: var(--vp-button-alt-hover-text, var(--vp-c-text-1));
  border-color: var(--vp-button-alt-hover-border, var(--vp-c-border));
}
html:not(.dark) .term-cmd-text {
  color: #0a0c12;
  font-weight: 600;
}
html:not(.dark) .term-output-pre {
  color: #3a3f4d;
}
html:not(.dark) .term-flags {
  border-color: #d0d4da;
}
html:not(.dark) .term-flag {
  background: #ebedf0;
  color: #3b82f6;
}
html:not(.dark) .term-flag-desc {
  color: #4a5060;
}
html:not(.dark) .term-diff {
  border-color: #d0d4da;
}
html:not(.dark) .term-diff-file {
  background: #ebedf0;
  color: #4a5060;
}
html:not(.dark) .term-diff-added {
  color: #059669;
}
html:not(.dark) .term-explain-after {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}
html:not(.dark) .term-changed {
  border-color: #d0d4da;
}
html:not(.dark) .term-changed-label {
  color: var(--vp-c-brand);
}
html:not(.dark) .term-changed-text {
  color: #3a3f4d;
}
html:not(.dark) .term-mem-card {
  background: #f6f7f9;
  border-color: #d0d4da;
}
html:not(.dark) .term-mem-kind {
  color: #1a1d27;
}
html:not(.dark) .term-mem-claim {
  color: #3a3f4d;
}
html:not(.dark) .term-mem-meta {
  color: #6b7280;
}
html:not(.dark) .term-mem-evidence,
html:not(.dark) .term-mem-applies {
  color: #4a5060;
}
html:not(.dark) .term-progress {
  background: #ebedf0;
}
html:not(.dark) .term-toolbar {
  background: #ebedf0;
  border-color: #d0d4da;
}
html:not(.dark) .term-tb-btn {
  background: #f6f7f9;
  border-color: #d0d4da;
  color: #4a5060;
}
html:not(.dark) .term-tb-btn:hover:not(:disabled) {
  background: #e0e3e8;
}
html:not(.dark) .term-kb-hint {
  color: #9ca3af;
}
html:not(.dark) .term-carousel {
  border-color: #d0d4da;
}
html:not(.dark) .term-carousel-arrow {
  background: rgba(255, 255, 255, 0.7);
  color: #1a1d27;
}
html:not(.dark) .term-carousel-arrow:hover {
  background: rgba(255, 255, 255, 0.9);
}
html:not(.dark) .term-carousel-dots {
  background: #ebedf0;
}
html:not(.dark) .term-carousel-dot {
  background: #c0c6d0;
}
html:not(.dark) .term-explain {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
}
html:not(.dark) .term-flags {
  background: #f6f7f9;
  border-color: #d0d4da;
}
html:not(.dark) .term-diff-file {
  background: #ebedf0;
}
html:not(.dark) .term-risk {
  background: #f6f7f9;
  border-color: #d0d4da;
}
html:not(.dark) .term-risk-bar {
  background: #d0d4da;
}
html:not(.dark) .term-mem-card {
  background: #f6f7f9;
  border-color: #d0d4da;
}
html:not(.dark) .term-mem-kind {
  background: #ebedf0;
  color: #6b7280;
}
html:not(.dark) .term-mem-evidence {
  background: #ebedf0;
  color: #4a5060;
}
html:not(.dark) .term-mem-applies {
  background: #fefce8;
  color: #92400e;
}
html:not(.dark) .term-progress {
  background: #ebedf0;
  border-color: #d0d4da;
}
html:not(.dark) .term-toolbar {
  background: #ebedf0;
}
html:not(.dark) .term-close:hover {
  background: #e0e3e8;
}
</style>
