# VSCode & IntelliJ Plugin Changes for Quota Management

This document outlines the changes needed in the IDE plugins to support cloud quota management.

---

## VSCode Extension Changes

### 1. Update Sync Status Display

**File:** `vscode-extension/extension.js`

**Current Status Bar:**
```javascript
syncStatusItem.text = "☁ syncing…";
```

**Enhanced Status Bar:**
```javascript
// Show quota status in status bar
function updateSyncStatusBar(syncResult) {
  if (syncResult.quotaExceeded) {
    syncStatusItem.text = `☁ ${syncResult.quota.current}/${syncResult.quota.limit} (limit reached)`;
    syncStatusItem.tooltip = `Free tier limit: ${syncResult.quota.limit} memories. Click to upgrade.`;
    syncStatusItem.command = 'aidimag.upgradeplan';
    syncStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else if (syncResult.quota) {
    syncStatusItem.text = `☁ ${syncResult.quota.current}/${syncResult.quota.limit}`;
    syncStatusItem.tooltip = `Synced memories: ${syncResult.quota.current} of ${syncResult.quota.limit}`;
  } else {
    syncStatusItem.text = "☁ synced";
    syncStatusItem.tooltip = "Cloud sync complete";
  }
}
```

### 2. Add Quota Warning Notifications

```javascript
async function sync(opts) {
  const silent = opts && opts.silent;
  const root = repoRoot();
  if (!root) return;
  
  syncStatusItem.text = "☁ syncing…";
  
  try {
    const { stdout, stderr } = await runDim(["sync"], root);
    const result = JSON.parse(stdout); // Assume sync returns JSON
    
    lastSync = { when: new Date(), summary: stdout.trim(), ok: true };
    
    // Check for quota warnings
    if (result.quotaExceeded) {
      const action = await vscode.window.showWarningMessage(
        `Memory limit reached (${result.quota.current}/${result.quota.limit}). ` +
        `${result.unsyncedCount} memories not synced.`,
        'Select Memories',
        'Upgrade Plan',
        'Dismiss'
      );
      
      if (action === 'Select Memories') {
        vscode.commands.executeCommand('aidimag.selectMemoriesToSync');
      } else if (action === 'Upgrade Plan') {
        vscode.commands.executeCommand('aidimag.upgradeplan');
      }
    } else if (result.warning) {
      if (!silent) {
        vscode.window.showInformationMessage(result.warning);
      }
    } else {
      if (!silent) {
        vscode.window.setStatusBarMessage(`aidimag: ${result.message || 'synced'}`, 6000);
      }
    }
    
    updateSyncStatusBar(result);
    refreshStatusBar();
  } catch (err) {
    lastSync = { when: new Date(), summary: err.message, ok: false };
    if (!silent) vscode.window.showErrorMessage(`aidimag sync: ${err.message}`);
  }
  
  refreshSyncStatus();
}
```

### 3. Add Memory Selection Command

```javascript
vscode.commands.registerCommand('aidimag.selectMemoriesToSync', async () => {
  const root = repoRoot();
  if (!root) return;
  
  try {
    // Get unsynced memories
    const { stdout } = await runDim(["status", "--json"], root);
    const status = JSON.parse(stdout);
    
    if (status.unsyncedMemories.length === 0) {
      vscode.window.showInformationMessage('All memories are synced!');
      return;
    }
    
    // Show quick pick with presets
    const choice = await vscode.window.showQuickPick([
      {
        label: '$(star) Sync newest 100',
        description: 'Most recently created/updated memories',
        value: 'newest'
      },
      {
        label: '$(verified) Sync verified only',
        description: 'Only memories with VERIFIED status',
        value: 'verified'
      },
      {
        label: '$(pin) Sync pinned only',
        description: 'Only pinned memories',
        value: 'pinned'
      },
      {
        label: '$(checklist) Custom selection',
        description: 'Choose specific memories',
        value: 'custom'
      }
    ], {
      placeHolder: 'How would you like to select memories to sync?'
    });
    
    if (!choice) return;
    
    if (choice.value === 'custom') {
      // Open webview for custom selection
      vscode.commands.executeCommand('aidimag.openMemorySelector');
    } else {
      // Run sync with preset
      const { stdout } = await runDim(["sync", "--select", choice.value], root);
      vscode.window.showInformationMessage(stdout);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to select memories: ${err.message}`);
  }
});
```

### 4. Add Upgrade Command

```javascript
vscode.commands.registerCommand('aidimag.upgradeplan', async () => {
  const root = repoRoot();
  if (!root) return;
  
  try {
    const { stdout } = await runDim(["cloud", "info", "--json"], root);
    const info = JSON.parse(stdout);
    
    if (info.server === "cloud.aidimag.com") {
      vscode.env.openExternal(vscode.Uri.parse('https://cloud.aidimag.com/pricing'));
    } else {
      vscode.window.showInformationMessage(
        'Upgrade options are only available for cloud.aidimag.com'
      );
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to open upgrade page: ${err.message}`);
  }
});
```

### 5. Update package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "aidimag.selectMemoriesToSync",
        "title": "aidimag: Select Memories to Sync"
      },
      {
        "command": "aidimag.upgradeplan",
        "title": "aidimag: Upgrade Cloud Plan"
      },
      {
        "command": "aidimag.openMemorySelector",
        "title": "aidimag: Open Memory Selector"
      }
    ]
  }
}
```

---

## IntelliJ Plugin Changes

### 1. Update Sync Action

**File:** `intellij-plugin/src/main/kotlin/com/aidimag/plugin/actions/SyncAction.kt`

```kotlin
class SyncAction : AnAction("Sync with Cloud", "Sync memories with cloud", AllIcons.Actions.Refresh) {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val repoRoot = findRepoRoot(project) ?: return
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Syncing with cloud...") {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val result = runDimCommand(repoRoot, listOf("sync", "--json"))
                    val syncResult = Gson().fromJson(result, SyncResult::class.java)
                    
                    ApplicationManager.getApplication().invokeLater {
                        handleSyncResult(project, syncResult)
                    }
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        Messages.showErrorDialog(project, "Sync failed: ${e.message}", "aidimag Sync")
                    }
                }
            }
        })
    }
    
    private fun handleSyncResult(project: Project, result: SyncResult) {
        when {
            result.quotaExceeded -> {
                val choice = Messages.showDialog(
                    project,
                    "Memory limit reached (${result.quota.current}/${result.quota.limit}). " +
                    "${result.unsyncedCount} memories not synced.",
                    "aidimag Quota Limit",
                    arrayOf("Select Memories", "Upgrade Plan", "Cancel"),
                    0,
                    Messages.getWarningIcon()
                )
                
                when (choice) {
                    0 -> showMemorySelector(project)
                    1 -> openUpgradePage(project)
                }
            }
            result.warning != null -> {
                Notifications.Bus.notify(
                    Notification(
                        "aidimag",
                        "Sync Warning",
                        result.warning,
                        NotificationType.WARNING
                    ),
                    project
                )
            }
            else -> {
                Notifications.Bus.notify(
                    Notification(
                        "aidimag",
                        "Sync Complete",
                        result.message ?: "Synced successfully",
                        NotificationType.INFORMATION
                    ),
                    project
                )
            }
        }
        
        // Update status bar
        updateStatusBar(project, result)
    }
}

data class SyncResult(
    val pushed: Int,
    val pulled: Int,
    val quotaExceeded: Boolean = false,
    val warning: String? = null,
    val message: String? = null,
    val quota: QuotaInfo? = null,
    val unsyncedCount: Int = 0
)

data class QuotaInfo(
    val current: Int,
    val limit: Int,
    val tier: String
)
```

### 2. Add Memory Selector Dialog

```kotlin
class MemorySelectorDialog(project: Project) : DialogWrapper(project) {
    private val presetComboBox = ComboBox(arrayOf(
        "Sync newest 100",
        "Sync verified only",
        "Sync pinned only",
        "Custom selection"
    ))
    
    init {
        title = "Select Memories to Sync"
        init()
    }
    
    override fun createCenterPanel(): JComponent {
        return panel {
            row("Selection:") {
                cell(presetComboBox)
                    .comment("Choose which memories to sync to cloud")
            }
        }
    }
    
    override fun doOKAction() {
        val repoRoot = findRepoRoot(project) ?: return
        val selection = when (presetComboBox.selectedIndex) {
            0 -> "newest"
            1 -> "verified"
            2 -> "pinned"
            3 -> {
                // Open custom selector
                showCustomSelector()
                return
            }
            else -> "newest"
        }
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Syncing selected memories...") {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val result = runDimCommand(repoRoot, listOf("sync", "--select", selection, "--json"))
                    ApplicationManager.getApplication().invokeLater {
                        Messages.showInfoMessage(project, result, "Sync Complete")
                    }
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        Messages.showErrorDialog(project, "Sync failed: ${e.message}", "Sync Error")
                    }
                }
            }
        })
        
        super.doOKAction()
    }
}
```

### 3. Update Status Bar Widget

```kotlin
class AidimagStatusBarWidget(project: Project) : StatusBarWidget, StatusBarWidget.TextPresentation {
    private var syncStatus: SyncResult? = null
    
    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this
    
    override fun getText(): String {
        return when {
            syncStatus?.quotaExceeded == true -> 
                "☁ ${syncStatus?.quota?.current}/${syncStatus?.quota?.limit} (limit)"
            syncStatus?.quota != null -> 
                "☁ ${syncStatus?.quota?.current}/${syncStatus?.quota?.limit}"
            else -> "☁ aidimag"
        }
    }
    
    override fun getTooltipText(): String? {
        return when {
            syncStatus?.quotaExceeded == true ->
                "Memory limit reached. Click to upgrade."
            syncStatus?.quota != null ->
                "Synced memories: ${syncStatus?.quota?.current} of ${syncStatus?.quota?.limit}"
            else -> "aidimag cloud sync"
        }
    }
    
    override fun getClickConsumer(): Consumer<MouseEvent>? {
        return Consumer {
            if (syncStatus?.quotaExceeded == true) {
                openUpgradePage(project)
            } else {
                // Show sync menu
                showSyncMenu(it)
            }
        }
    }
    
    fun updateStatus(result: SyncResult) {
        syncStatus = result
        StatusBar.Info.set("", project, "aidimag")
    }
}
```

### 4. Update plugin.xml

```xml
<actions>
    <action id="aidimag.Sync" 
            class="com.aidimag.plugin.actions.SyncAction" 
            text="Sync with Cloud"
            description="Sync memories with cloud"
            icon="AllIcons.Actions.Refresh">
        <add-to-group group-id="ToolsMenu" anchor="last"/>
    </action>
    
    <action id="aidimag.SelectMemories" 
            class="com.aidimag.plugin.actions.SelectMemoriesAction" 
            text="Select Memories to Sync"
            description="Choose which memories to sync to cloud">
        <add-to-group group-id="ToolsMenu" anchor="last"/>
    </action>
    
    <action id="aidimag.UpgradePlan" 
            class="com.aidimag.plugin.actions.UpgradePlanAction" 
            text="Upgrade Cloud Plan"
            description="Upgrade your aidimag cloud plan">
        <add-to-group group-id="ToolsMenu" anchor="last"/>
    </action>
</actions>

<extensions defaultExtensionNs="com.intellij">
    <statusBarWidgetFactory 
        id="aidimag.StatusBar"
        implementation="com.aidimag.plugin.ui.AidimagStatusBarWidgetFactory"/>
</extensions>
```

---

## Summary of Plugin Changes

### VSCode Extension
- ✅ Enhanced status bar with quota display
- ✅ Warning notifications for quota limits
- ✅ Memory selection command with presets
- ✅ Upgrade command with browser integration
- ✅ JSON output parsing from CLI

### IntelliJ Plugin
- ✅ Enhanced sync action with quota handling
- ✅ Memory selector dialog
- ✅ Status bar widget with quota display
- ✅ Upgrade action
- ✅ Notification system integration

### Common Requirements
Both plugins need:
1. Parse JSON output from `dim sync --json`
2. Display quota status in status bar
3. Show warning dialogs when quota exceeded
4. Provide memory selection UI
5. Open upgrade page in browser
6. Handle partial sync results

---

## CLI Changes Required

The plugins depend on enhanced CLI output. The `dim sync` command needs to support:

```bash
# JSON output mode
dim sync --json

# Output:
{
  "pushed": 10,
  "pulled": 5,
  "memoriesPushed": 8,
  "quotaExceeded": false,
  "quota": {
    "current": 95,
    "limit": 100,
    "tier": "free"
  },
  "unsyncedCount": 5,
  "message": "Synced 10 items"
}

# Selection mode
dim sync --select newest
dim sync --select verified
dim sync --select pinned
dim sync --select custom  # Opens interactive selector
```

These CLI enhancements will be implemented in the next phase.
