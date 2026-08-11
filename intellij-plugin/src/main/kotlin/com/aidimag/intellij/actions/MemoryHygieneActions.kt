package com.aidimag.intellij.actions

import com.aidimag.intellij.core.AidimagNotifications
import com.aidimag.intellij.core.DimRunner
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages

/**
 * Memory hygiene actions (parity with the VS Code extension 1.0.4):
 *
 *   ScratchpadAction  dim scratch [--all|--clear]  short-term session notes (TTL-expiring, never synced)
 *   AuditAction       dim audit                    provenance audit: agent-authored / evidence-free /
 *                                                  stale / long-unverified memories, highest risk first
 */

class ScratchpadAction : AnAction() {
  override fun actionPerformed(e: AnActionEvent) {
    val project = projectOrWarn(e) ?: return
    val choice = Messages.showDialog(
      project,
      "Scratchpad: short-term working notes for the current session.\n" +
        "Notes expire automatically (24h) and are never synced — promote durable\n" +
        "learnings with Pin/Add Memory instead.",
      "aidimag: Scratchpad",
      arrayOf("Jot a Note", "Show Notes", "Clear All", "Cancel"),
      0, null,
    )
    when (choice) {
      0 -> {
        val note = Messages.showInputDialog(
          project,
          "Note to jot (expires in 24h):",
          "aidimag: Scratchpad Note",
          null,
        )?.trim()
        if (note.isNullOrBlank()) return
        runOnBackground(project, "Scratchpad") {
          val result = DimRunner.run(project, listOf("scratch", note))
          ApplicationManager.getApplication().invokeLater {
            if (result.exitCode == 0) {
              AidimagNotifications.info(project, "aidimag: note jotted 📝 (expires in 24h)")
            } else {
              AidimagNotifications.error(project, "scratch failed: ${result.stdout.ifBlank { "no output" }}")
            }
          }
        }
      }
      1 -> runOnBackground(project, "Scratchpad") {
        val result = DimRunner.run(project, listOf("scratch", "--all"))
        ApplicationManager.getApplication().invokeLater {
          if (result.exitCode == 0) {
            Messages.showInfoMessage(
              project,
              result.stdout.take(4000).ifBlank { "Scratchpad is empty." },
              "aidimag: Scratchpad Notes",
            )
          } else {
            AidimagNotifications.error(project, "scratch failed: ${result.stdout.ifBlank { "no output" }}")
          }
        }
      }
      2 -> runOnBackground(project, "Scratchpad") {
        val result = DimRunner.run(project, listOf("scratch", "--clear", "--all"))
        ApplicationManager.getApplication().invokeLater {
          AidimagNotifications.info(project, "aidimag: ${result.stdout.trim().ifBlank { "scratchpad cleared" }}")
        }
      }
    }
  }
}

class AuditAction : AnAction() {
  override fun actionPerformed(e: AnActionEvent) {
    val project = projectOrWarn(e) ?: return
    runOnBackground(project, "Provenance Audit") {
      val result = DimRunner.run(project, listOf("audit"))
      ApplicationManager.getApplication().invokeLater {
        if (result.exitCode != 0) {
          AidimagNotifications.error(project, "audit failed: ${result.stdout.ifBlank { "no output" }}")
          return@invokeLater
        }
        val clean = result.stdout.contains("Nothing suspicious", ignoreCase = true)
        if (clean) {
          Messages.showInfoMessage(project, result.stdout.take(4000), "aidimag: Provenance Audit")
          return@invokeLater
        }
        val choice = Messages.showDialog(
          project,
          result.stdout.take(4000),
          "aidimag: Provenance Audit (memories resting on weak ground)",
          arrayOf("Close", "Verify Memories"),
          0, null,
        )
        if (choice == 1) {
          runInTerminal(project, "aidimag verify", listOf("verify"))
        }
      }
    }
  }
}

