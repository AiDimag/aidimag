package com.aidimag.intellij.actions

import com.aidimag.intellij.dashboard.AidimagDashboardService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class RefreshDashboardAction : AnAction() {
  override fun actionPerformed(e: AnActionEvent) {
    val project = projectOrWarn(e) ?: return
    runOnBackground(project, "Refresh Dashboard") {
      AidimagDashboardService.getInstance(project).reloadDashboard()
    }
  }
}
