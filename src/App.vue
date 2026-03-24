<script setup>
import { onMounted, computed, ref, onUnmounted } from 'vue'
import { useSerialStore } from './stores/serial'
import SerialSidebar from './components/SerialSidebar.vue'
import TerminalView from './components/TerminalView.vue'
import DataConverter from './components/DataConverter.vue'
import CommandsModal from './components/CommandsModal.vue'
import CommandPalette from './components/CommandPalette.vue'
import AppearanceSettingsModal from './components/AppearanceSettingsModal.vue'

const serialStore = useSerialStore()

const isConverterMode = computed(() => window.location.hash === '#/converter')

const showToolsMenu = ref(false)
const showSettingsMenu = ref(false)
const showCommandsModal = ref(false)
const showCommandPalette = ref(false)
const showAppearanceSettingsModal = ref(false)
const isMaximized = ref(false)
const settingsToast = ref({
  visible: false,
  tone: 'info',
  title: '',
  message: ''
})
const showResetConfirm = ref(false)

const appUiState = computed(() => serialStore.appUiState || {})
const isSidebarCollapsed = computed({
  get: () => appUiState.value.sidebarCollapsed ?? false,
  set: (value) => {
    serialStore.updateAppUiState({ sidebarCollapsed: value })
  }
})
const themeMode = computed(() => appUiState.value.themeMode || 'dark')
const isDarkMode = computed(() => themeMode.value === 'dark')
const wallpaperPath = computed(() => appUiState.value.wallpaperPath || '')
const wallpaperEnabled = computed(() => Boolean(appUiState.value.wallpaperEnabled && wallpaperPath.value))
const wallpaperOpacity = computed(() => {
  const value = Number(appUiState.value.wallpaperOpacity ?? 0.22)
  return Number.isFinite(value) ? Math.min(0.45, Math.max(0.08, value)) : 0.22
})

let settingsToastTimer = null

const closeAllMenus = () => {
  showToolsMenu.value = false
  showSettingsMenu.value = false
}

const toggleToolsMenu = () => {
  if (showToolsMenu.value) {
    showToolsMenu.value = false
    return
  }

  closeAllMenus()
  showToolsMenu.value = true
}

const toggleSettingsMenu = () => {
  if (showSettingsMenu.value) {
    showSettingsMenu.value = false
    return
  }

  closeAllMenus()
  showSettingsMenu.value = true
}

const openCommandPalette = () => {
  showCommandPalette.value = true
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const showSettingsMessage = (message, tone = 'info', title = '设置') => {
  settingsToast.value = {
    visible: true,
    tone,
    title,
    message
  }

  if (settingsToastTimer) {
    clearTimeout(settingsToastTimer)
  }

  settingsToastTimer = setTimeout(() => {
    settingsToast.value.visible = false
    settingsToastTimer = null
  }, 2800)
}

const hideSettingsToast = () => {
  settingsToast.value.visible = false
  if (settingsToastTimer) {
    clearTimeout(settingsToastTimer)
    settingsToastTimer = null
  }
}

const setThemeMode = (mode) => {
  serialStore.applyThemeMode(mode)
  showSettingsMenu.value = false
  showSettingsMessage(`已切换到${mode === 'dark' ? '深色' : '浅色'}模式`, 'success', '主题已更新')
}

const toFileUrl = (filePath) => {
  if (!filePath) return ''
  const normalized = filePath.replace(/\\/g, '/')
  return encodeURI(`file:///${normalized.replace(/^([A-Za-z]):/, '$1:')}`)
}

const pickWallpaper = async () => {
  showSettingsMenu.value = false
  const result = await window.electronAPI?.selectWallpaper()
  if (!result || result.canceled) return

  if (!result.success) {
    showSettingsMessage(`选择壁纸失败\n${result.error || '未知错误'}`, 'error', '壁纸未更新')
    return
  }

  serialStore.updateAppUiState({
    wallpaperEnabled: true,
    wallpaperPath: result.filePath
  })
  showSettingsMessage(`已应用壁纸\n${result.filePath}`, 'success', '桌面背景已更新')
}

const toggleWallpaper = () => {
  if (!wallpaperPath.value) {
    pickWallpaper()
    return
  }

  serialStore.updateAppUiState({
    wallpaperEnabled: !wallpaperEnabled.value
  })
  showSettingsMenu.value = false
  showSettingsMessage(
    wallpaperEnabled.value ? '已关闭自定义壁纸。' : '已启用自定义壁纸。',
    'success',
    wallpaperEnabled.value ? '壁纸已关闭' : '壁纸已启用'
  )
}

const clearWallpaper = () => {
  serialStore.updateAppUiState({
    wallpaperEnabled: false,
    wallpaperPath: ''
  })
  showSettingsMenu.value = false
  showSettingsMessage('已清除当前自定义壁纸。', 'success', '壁纸已清除')
}

const formatImportedSettingsSummary = (result) => {
  const snapshot = result?.data || {}
  const versionText = typeof snapshot.version === 'number' ? `v${snapshot.version}` : '未知版本'
  const hasLayout = snapshot.workspaceLayout ? '包含工作区布局' : '未包含工作区布局'
  return `已导入设置\n${result.filePath}\n版本：${versionText}\n内容：${hasLayout}`
}

const formatImportedWorkspaceSummary = (result) => {
  const snapshot = result?.data || {}
  const versionText = typeof snapshot.version === 'number' ? `v${snapshot.version}` : '未知版本'
  const selectedPortText = snapshot.selectedPort || '未指定'
  return `已导入工作区快照\n${result.filePath}\n版本：${versionText}\n当前串口：${selectedPortText}`
}

const handleGlobalKeydown = (event) => {
  const activeElement = document.activeElement
  const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p' && !isInputFocused) {
    event.preventDefault()
    openCommandPalette()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !isInputFocused) {
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('serialx-open-search', {
      detail: {
        portPath: serialStore.selectedPort
      }
    }))
  }
}

const minimizeWindow = () => {
  window.electronAPI?.minimizeWindow()
}

const closeWindow = () => {
  window.electronAPI?.closeWindow()
}

const toggleMaximize = () => {
  if (isMaximized.value) {
    window.electronAPI?.unmaximizeWindow()
  } else {
    window.electronAPI?.maximizeWindow()
  }
  isMaximized.value = !isMaximized.value
}

const openConverter = () => {
  window.electronAPI?.openConverterWindow()
  showToolsMenu.value = false
}

const openCommandsConfig = () => {
  showCommandsModal.value = true
  showSettingsMenu.value = false
}

const openAppearanceSettings = () => {
  showAppearanceSettingsModal.value = true
  showSettingsMenu.value = false
}

const exportSettings = async () => {
  showSettingsMenu.value = false
  const result = await window.electronAPI?.exportSettings(serialStore.buildSettingsSnapshot())
  if (!result || result.canceled) return

  if (result.success) {
    showSettingsMessage(`设置已导出到\n${result.filePath}`, 'success', '导出成功')
    return
  }

  showSettingsMessage(`导出设置失败\n${result.error || '未知错误'}`, 'error', '导出失败')
}

const importSettings = async () => {
  showSettingsMenu.value = false
  const result = await window.electronAPI?.importSettings()
  if (!result || result.canceled) return

  if (!result.success) {
    showSettingsMessage(`导入设置失败\n${result.error || '未知错误'}`, 'error', '导入失败')
    return
  }

  try {
    await serialStore.applySettingsSnapshot(result.data)
    showSettingsMessage(formatImportedSettingsSummary(result), 'success', '导入成功')
  } catch (error) {
    showSettingsMessage(`应用设置失败\n${error.message}`, 'error', '应用失败')
  }
}

const exportWorkspaceSnapshot = async () => {
  showSettingsMenu.value = false
  const result = await window.electronAPI?.exportWorkspaceSnapshot(serialStore.buildWorkspaceSnapshot())
  if (!result || result.canceled) return

  if (result.success) {
    showSettingsMessage(`工作区快照已导出到\n${result.filePath}`, 'success', '导出成功')
    return
  }

  showSettingsMessage(`导出工作区快照失败\n${result.error || '未知错误'}`, 'error', '导出失败')
}

const importWorkspaceSnapshot = async () => {
  showSettingsMenu.value = false
  const result = await window.electronAPI?.importWorkspaceSnapshot()
  if (!result || result.canceled) return

  if (!result.success) {
    showSettingsMessage(`导入工作区快照失败\n${result.error || '未知错误'}`, 'error', '导入失败')
    return
  }

  try {
    await serialStore.applyWorkspaceSnapshot(result.data)
    showSettingsMessage(formatImportedWorkspaceSummary(result), 'success', '导入成功')
  } catch (error) {
    showSettingsMessage(`应用工作区快照失败\n${error.message}`, 'error', '应用失败')
  }
}

const resetAllSettings = () => {
  showSettingsMenu.value = false
  showResetConfirm.value = true
}

const confirmResetAllSettings = async () => {
  showResetConfirm.value = false
  await serialStore.resetAppSettings()
  showSettingsMessage('终端外观、默认串口参数和常用命令都已恢复默认。', 'success', '已恢复默认')
}

const cancelResetAllSettings = () => {
  showResetConfirm.value = false
}

const handleSendCommand = (event) => {
  const command = event.detail
  if (!command) return

  const portPath = serialStore.selectedPort
  if (!portPath) return

  serialStore.setPortSendingData(portPath, command)
  serialStore.sendData(portPath)
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.menubar-item')) {
    closeAllMenus()
  }
}

const rootThemeVars = computed(() => {
  const wallpaperVars = {
    '--app-wallpaper-image': wallpaperEnabled.value ? `url("${toFileUrl(wallpaperPath.value)}")` : 'none',
    '--app-wallpaper-opacity': wallpaperEnabled.value ? String(wallpaperOpacity.value) : '0'
  }

  if (themeMode.value === 'light') {
    return {
      '--app-bg': '#f6fbff',
      '--app-bg-gradient': 'linear-gradient(180deg, #f6fbff 0%, #f6fbff 100%)',
      '--app-panel': 'rgba(255, 255, 255, 0.92)',
      '--app-panel-strong': 'rgba(255, 255, 255, 1)',
      '--app-border': 'rgba(0, 102, 153, 0.14)',
      '--app-text': '#1f2328',
      '--app-text-soft': '#6b7785',
      '--app-header-bg': 'rgba(255, 255, 255, 0.96)',
      '--app-main-bg': '#ffffff',
      '--app-chip-bg': 'rgba(0, 120, 212, 0.1)',
      '--app-chip-border': 'rgba(0, 120, 212, 0.16)',
      '--app-chip-text': '#005fb8',
      '--app-radial': 'none',
      '--app-toast-bg': 'rgba(255, 255, 255, 0.98)',
      ...wallpaperVars
    }
  }

  return {
    '--app-bg': '#08131b',
    '--app-bg-gradient': 'linear-gradient(180deg, #09131b 0%, #08131b 100%)',
    '--app-panel': 'rgba(10, 18, 25, 0.62)',
    '--app-panel-strong': 'rgba(8, 15, 22, 0.94)',
    '--app-border': 'rgba(125, 162, 186, 0.1)',
    '--app-text': '#d9e6f2',
    '--app-text-soft': '#8fa5b6',
    '--app-header-bg': 'rgba(8, 15, 22, 0.72)',
    '--app-main-bg': 'rgba(7, 15, 22, 0.22)',
    '--app-chip-bg': 'rgba(87, 199, 255, 0.08)',
    '--app-chip-border': 'rgba(87, 199, 255, 0.22)',
    '--app-chip-text': '#bfe9ff',
    '--app-radial': 'radial-gradient(circle at 50% 0%, rgba(87, 199, 255, 0.08), transparent 42%)',
    '--app-toast-bg': 'rgba(8, 15, 22, 0.94)',
    ...wallpaperVars
  }
})

onMounted(async () => {
  serialStore.refreshPorts()
  serialStore.loadCommonCommands()
  await serialStore.restoreSessionState()

  window.electronAPI?.onWindowMaximized(() => {
    isMaximized.value = true
  })

  window.electronAPI?.onWindowUnmaximized(() => {
    isMaximized.value = false
  })

  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('serialx-send-command', handleSendCommand)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('serialx-send-command', handleSendCommand)
  document.removeEventListener('click', handleClickOutside)
  if (settingsToastTimer) {
    clearTimeout(settingsToastTimer)
    settingsToastTimer = null
  }
})
</script>

<template>
  <div
    v-if="!isConverterMode"
    :class="['app-container', `theme-${themeMode}`]"
    :style="rootThemeVars"
  >
    <header class="app-header">
      <div class="header-left">
        <div class="menubar-items">
          <div class="menubar-item" @click.stop="toggleToolsMenu">
            <span class="menubar-label">工具</span>
            <div v-if="showToolsMenu" class="menubar-dropdown">
              <div class="dropdown-item" @click="openConverter">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M3 3h10v3H3zM3 8h4v5H3zM9 8h4v2H9zM9 12h4v1H9z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">进制转换工具</span>
              </div>
            </div>
          </div>

          <div class="menubar-item" @click.stop="toggleSettingsMenu">
            <span class="menubar-label">设置</span>
            <div v-if="showSettingsMenu" class="menubar-dropdown">
              <div class="dropdown-section-label">主题</div>
              <div class="dropdown-item" :class="{ selected: isDarkMode }" @click="setThemeMode('dark')">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M9.8 2.3a5.7 5.7 0 1 0 3.9 10.2A6.2 6.2 0 0 1 9.8 2.3Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">深色模式</span>
              </div>
              <div class="dropdown-item" :class="{ selected: !isDarkMode }" @click="setThemeMode('light')">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <circle cx="8" cy="8" r="3" fill="currentColor" />
                    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
                  </svg>
                </span>
                <span class="dropdown-text">浅色模式</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-section-label">桌面背景</div>
              <div class="dropdown-item" @click="pickWallpaper">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M2 3h12v10H2z" fill="none" stroke="currentColor" stroke-width="1.2" />
                    <circle cx="5.2" cy="6" r="1.1" fill="currentColor" />
                    <path d="m4 11 2.6-2.8 2.1 2 1.6-1.6L12 11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <span class="dropdown-text">{{ wallpaperPath ? '更换壁纸' : '选择壁纸' }}</span>
              </div>
              <div
                v-if="wallpaperPath"
                class="dropdown-item"
                :class="{ selected: wallpaperEnabled }"
                @click="toggleWallpaper"
              >
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 2.5A4.5 4.5 0 1 0 12.5 7 4.5 4.5 0 0 0 8 2.5Zm0 1.4A3.1 3.1 0 1 1 4.9 7 3.1 3.1 0 0 1 8 3.9Z" fill="currentColor" />
                    <path d="M8 1v2M8 13v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
                  </svg>
                </span>
                <span class="dropdown-text">{{ wallpaperEnabled ? '关闭壁纸' : '启用壁纸' }}</span>
              </div>
              <div v-if="wallpaperPath" class="dropdown-item danger" @click="clearWallpaper">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M5 4h6l-.5 8h-5z" fill="none" stroke="currentColor" stroke-width="1.2" />
                    <path d="M4 4h8M6 4V2h4v2" fill="none" stroke="currentColor" stroke-width="1.2" />
                  </svg>
                </span>
                <span class="dropdown-text">清除壁纸</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-section-label">外观与命令</div>
              <div class="dropdown-item" @click="openAppearanceSettings">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 3.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3ZM4.4 8a3.6 3.6 0 1 1 7.2 0a3.6 3.6 0 0 1-7.2 0Zm8.85-.75 1.25.75-1.25.75-.3 1.42-1.42.3-.75 1.25-.75-1.25-1.42-.3-.3-1.42-1.25-.75 1.25-.75.3-1.42 1.42-.3.75-1.25.75 1.25 1.42.3.3 1.42Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">终端外观设置</span>
              </div>
              <div class="dropdown-item" @click="openCommandsConfig">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M3 3h10v10H3zM5 6h6v1H5zm0 2h6v1H5zm0 2h4v1H5z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">常用命令配置</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-section-label">数据与恢复</div>
              <div class="dropdown-item" @click="exportSettings">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 2v7.2l2.1-2.1.9.9L8 11 5 8l.9-.9L8 9.2V2ZM3 12h10v2H3z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">导出设置</span>
              </div>
              <div class="dropdown-item" @click="importSettings">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 14V6.8L5.9 8.9 5 8l3-3 3 3-.9.9L8 6.8V14ZM3 2h10v2H3z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">导入设置</span>
              </div>
              <div class="dropdown-item" @click="exportWorkspaceSnapshot">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 2v3h3v2H8v3H6V7H3V5h3V2Zm-5 9h10v2H3z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">导出工作区快照</span>
              </div>
              <div class="dropdown-item" @click="importWorkspaceSnapshot">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 2v3h3v2H8v3H6V7H3V5h3V2Zm-5 9h10v2H3z" fill="currentColor" opacity="0.4" />
                    <path d="M8 14V9.8l-2.1 2.1-.9-.9L8 8l3 3-.9.9L8 9.8V14Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">导入工作区快照</span>
              </div>
              <div class="dropdown-item danger" @click="resetAllSettings">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 3a5 5 0 1 1-4.58 7H5v1H2V8h1v1.16A6 6 0 1 0 8 2v1Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">恢复默认设置</span>
              </div>
            </div>
          </div>

          <div class="menubar-item">
            <span class="menubar-label">帮助</span>
          </div>
        </div>
      </div>

      <div class="header-center">
        <div class="brand-mark">
          <img src="../logo/icon.png" alt="SerialX" class="app-icon" />
        </div>
        <div class="brand-copy">
          <span class="app-title">SerialX</span>
          <span class="app-subtitle">串口调试工作台</span>
        </div>
        <span class="app-version-chip">v0.0.6-dev</span>
      </div>

      <div class="header-right window-controls">
        <button class="window-btn minimize-btn" title="最小化" @click="minimizeWindow">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button class="window-btn maximize-btn" :title="isMaximized ? '还原' : '最大化'" @click="toggleMaximize">
          <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <rect x="2" y="0" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1" />
            <rect x="0" y="2" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5" />
          </svg>
        </button>
        <button class="window-btn close-btn" title="关闭" @click="closeWindow">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </button>
      </div>
    </header>

    <div class="workspace">
      <aside :class="['sidebar', { collapsed: isSidebarCollapsed }]">
        <SerialSidebar />
      </aside>

      <main class="main-area">
        <button
          class="sidebar-toggle"
          :class="{ collapsed: isSidebarCollapsed }"
          :title="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="toggleSidebar"
        >
          <span class="sidebar-toggle-icon">{{ isSidebarCollapsed ? '>' : '<' }}</span>
        </button>
        <TerminalView />
      </main>
    </div>

    <footer class="status-bar">
      <span class="status-item primary">
        <span class="status-dot" :class="{ online: serialStore.openPorts.size > 0 }"></span>
        <span class="status-label">当前串口</span>
        <span class="status-value">{{ serialStore.selectedPort || '未选择' }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">连接状态</span>
        <span class="status-value">{{ serialStore.openPorts.size > 0 ? '已连接' : '未连接' }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">活动连接</span>
        <span class="status-value">{{ serialStore.openPorts.size }}</span>
      </span>
    </footer>

    <transition name="toast-fade">
      <div v-if="settingsToast.visible" :class="['settings-toast', settingsToast.tone]">
        <div class="toast-copy">
          <div class="toast-title">{{ settingsToast.title }}</div>
          <div class="toast-message">{{ settingsToast.message }}</div>
        </div>
        <button class="toast-close" @click="hideSettingsToast">×</button>
      </div>
    </transition>

    <div v-if="showResetConfirm" class="confirm-overlay" @click.self="cancelResetAllSettings">
      <div class="confirm-dialog">
        <div class="confirm-title">恢复默认设置</div>
        <div class="confirm-message">这会重置终端外观、默认串口参数和常用命令，当前会话布局不会被清空。</div>
        <div class="confirm-actions">
          <button class="confirm-btn secondary" @click="cancelResetAllSettings">取消</button>
          <button class="confirm-btn danger" @click="confirmResetAllSettings">恢复默认</button>
        </div>
      </div>
    </div>

    <CommandsModal v-model:show="showCommandsModal" />
    <AppearanceSettingsModal v-model:show="showAppearanceSettingsModal" />
    <CommandPalette v-model="showCommandPalette" />
  </div>

  <div v-else class="converter-only">
    <DataConverter standalone />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--app-bg-gradient);
  color: var(--app-text);
  overflow: hidden;
  position: relative;
}

.app-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--app-wallpaper-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: var(--app-wallpaper-opacity);
  pointer-events: none;
}

.app-container::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--app-radial);
  opacity: 0.9;
  pointer-events: none;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 14px;
  background: var(--app-header-bg);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
  -webkit-app-region: drag;
  backdrop-filter: blur(14px);
  position: relative;
  z-index: 2;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 12px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menubar-items {
  display: flex;
  align-items: center;
  gap: 4px;
}

.menubar-item {
  position: relative;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.menubar-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.05);
}

.theme-light .menubar-item:hover {
  background-color: rgba(21, 82, 123, 0.08);
  border-color: rgba(21, 82, 123, 0.08);
}

.menubar-label {
  font-size: 13px;
  color: var(--app-text);
  letter-spacing: 0.02em;
}

.menubar-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 228px;
  background: var(--app-panel-strong);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
  z-index: 1000;
  margin-top: 6px;
  backdrop-filter: blur(14px);
}

.dropdown-section-label {
  padding: 6px 12px 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--app-text-soft);
  text-transform: uppercase;
}

.dropdown-divider {
  height: 1px;
  margin: 6px 6px 4px;
  background: var(--app-border);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.dropdown-item:hover,
.dropdown-item.selected {
  background-color: rgba(87, 199, 255, 0.12);
}

.theme-light .dropdown-item:hover,
.theme-light .dropdown-item.selected {
  background-color: rgba(29, 118, 176, 0.1);
}

.dropdown-item.danger:hover {
  background-color: rgba(196, 43, 28, 0.14);
}

.dropdown-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--app-chip-text);
  flex-shrink: 0;
}

.dropdown-text {
  font-size: 13px;
  color: var(--app-text);
}

.app-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.18));
}

.app-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
  letter-spacing: 0.06em;
}

.app-subtitle {
  font-size: 10px;
  color: var(--app-text-soft);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.app-version-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--app-chip-border);
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.window-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  outline: none;
  background: rgba(255, 255, 255, 0.02);
  color: var(--app-text);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.18s ease;
}

.window-btn:hover {
  background-color: rgba(87, 199, 255, 0.12);
  color: #ffffff;
}

.theme-light .window-btn:hover {
  background-color: rgba(21, 82, 123, 0.1);
}

.window-btn.maximize-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.window-btn.close-btn:hover {
  background-color: #e81123;
  color: #ffffff;
}

.window-btn:active {
  transform: scale(0.95);
}

.window-btn svg {
  display: block;
}

.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 10px 10px 6px;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.sidebar {
  width: 272px;
  min-width: 200px;
  max-width: 420px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(12px);
  transition: width 0.22s ease, min-width 0.22s ease, opacity 0.18s ease, border-color 0.18s ease;
}

.sidebar.collapsed {
  width: 0;
  min-width: 0;
  border-color: transparent;
  opacity: 0;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: var(--app-main-bg);
  border: 1px solid var(--app-border);
  border-radius: 18px;
  backdrop-filter: blur(8px);
  position: relative;
}

.sidebar-toggle {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 12px;
  min-width: 12px;
  height: 52px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-panel-strong);
  color: var(--app-text-soft);
  cursor: pointer;
  transition: all 0.18s ease;
  backdrop-filter: blur(8px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
}

.sidebar-toggle:hover {
  color: var(--app-text);
  background: var(--app-panel);
}

.sidebar-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-size: 10px;
  font-weight: 700;
}

.status-bar {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 0 10px 8px;
  background: transparent;
  color: var(--app-text);
  font-size: 12px;
  gap: 8px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  backdrop-filter: blur(8px);
}

.status-label {
  opacity: 0.72;
}

.status-item.primary {
  border-color: var(--app-chip-border);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #748a99;
  box-shadow: 0 0 0 4px rgba(94, 116, 132, 0.16);
}

.status-dot.online {
  background: #52d7a6;
  box-shadow: 0 0 0 4px rgba(82, 215, 166, 0.12);
}

.status-value {
  font-weight: 700;
  color: var(--app-text);
}

.settings-toast {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 1200;
  min-width: 300px;
  max-width: 440px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 14px 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--app-border);
  background: var(--app-toast-bg);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
}

.settings-toast.success {
  border-color: rgba(82, 215, 166, 0.24);
}

.settings-toast.error {
  border-color: rgba(232, 84, 84, 0.26);
}

.toast-copy {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
}

.toast-message {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--app-text-soft);
  white-space: pre-line;
}

.toast-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--app-text);
  cursor: pointer;
  flex-shrink: 0;
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1190;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
}

.confirm-dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 20px;
  border-radius: 16px;
  background: var(--app-panel-strong);
  border: 1px solid var(--app-border);
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.22);
}

.confirm-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.confirm-message {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--app-text-soft);
}

.confirm-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.confirm-btn.secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--app-border);
  color: var(--app-text);
}

.confirm-btn.danger {
  background: rgba(196, 43, 28, 0.14);
  border-color: rgba(196, 43, 28, 0.2);
  color: #d7594d;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.converter-only {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

</style>
