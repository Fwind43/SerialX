<script setup>
import { onMounted, computed, ref, onUnmounted, watch } from 'vue'
import { useSerialStore } from './stores/serial'
import SerialSidebar from './components/SerialSidebar.vue'
import TerminalView from './components/TerminalView.vue'
import DataConverter from './components/DataConverter.vue'
import CommandsModal from './components/CommandsModal.vue'
import CommandPalette from './components/CommandPalette.vue'
import AppearanceSettingsModal from './components/AppearanceSettingsModal.vue'

const serialStore = useSerialStore()

const isConverterMode = computed(() => window.location.hash === '#/converter')
const isAppearanceMode = computed(() => window.location.hash === '#/appearance')
const isCommandsMode = computed(() => window.location.hash === '#/commands')

const showToolsMenu = ref(false)
const showSettingsMenu = ref(false)
const showCommandPalette = ref(false)
const isMaximized = ref(false)
const settingsToast = ref({
  visible: false,
  tone: 'info',
  title: '',
  message: ''
})
const showResetConfirm = ref(false)

const appUiState = computed(() => serialStore.appUiState || {})
const appTheme = computed(() => serialStore.appTheme || {})
const savedWorkspaceSnapshots = computed(() => serialStore.savedWorkspaceSnapshots || [])
const activeWorkspaceSnapshotId = computed(() => appUiState.value.activeWorkspaceSnapshotId || '')
const workspaceSnapshotLimit = 8
const activeThemeSchemeId = computed(() => (
  appUiState.value.activeThemeSchemeId ||
  appUiState.value.terminalAppearanceMode ||
  `preset-${appUiState.value.themeMode || 'dark'}`
))
const isSidebarCollapsed = computed({
  get: () => appUiState.value.sidebarCollapsed ?? false,
  set: (value) => {
    serialStore.updateAppUiState({ sidebarCollapsed: value })
  }
})
const themeMode = computed(() => appUiState.value.themeMode || 'dark')
const isDarkMode = computed(() => activeThemeSchemeId.value === 'preset-dark')
const isLightMode = computed(() => activeThemeSchemeId.value === 'preset-light')
const wallpaperPath = computed(() => appUiState.value.wallpaperPath || '')
const wallpaperEnabled = computed(() => Boolean(appUiState.value.wallpaperEnabled && wallpaperPath.value))
const wallpaperOpacity = computed(() => {
  const value = Number(appUiState.value.wallpaperOpacity ?? 0.22)
  return Number.isFinite(value) ? Math.min(0.6, Math.max(0.28, value)) : 0.36
})
const sidebarOpacity = computed(() => {
  const value = Number(appUiState.value.sidebarOpacity ?? 0.42)
  return Number.isFinite(value) ? Math.min(0.82, Math.max(0.04, value)) : 0.42
})
const workspaceOpacity = computed(() => {
  const value = Number(appUiState.value.workspaceOpacity ?? 0.42)
  return Number.isFinite(value) ? Math.min(0.82, Math.max(0.04, value)) : 0.42
})
const terminalOpacity = computed(() => {
  const value = Number(appUiState.value.terminalOpacity ?? 0.34)
  return Number.isFinite(value) ? Math.min(0.82, Math.max(0.04, value)) : 0.34
})
const wallpaperDataUrl = ref('')

const hexToRgb = (color, fallback = { r: 255, g: 255, b: 255 }) => {
  if (typeof color !== 'string') return fallback
  const normalized = color.trim().replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  }
}

const rgbaFromHex = (color, alpha, fallback) => {
  const { r, g, b } = hexToRgb(color, fallback)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
  const nextSchemeId = mode === 'light' ? 'preset-light' : 'preset-dark'
  serialStore.applyThemeScheme(nextSchemeId)
  showSettingsMenu.value = false
  showSettingsMessage(`已切换到${mode === 'dark' ? '深色' : '浅色'}主题`, 'success', '主题已更新')
}

const syncWallpaperDataUrl = async () => {
  if (isAppearanceMode.value) {
    wallpaperDataUrl.value = ''
    return
  }

  if (!wallpaperPath.value) {
    wallpaperDataUrl.value = ''
    return
  }

  const result = await window.electronAPI?.readWallpaperDataUrl?.(wallpaperPath.value)
  wallpaperDataUrl.value = result?.success ? result.dataUrl : ''
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

const formatWorkspaceSnapshotTime = (timestamp) => {
  if (!timestamp) return '创建时间：未知'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '创建时间：未知'
  return `创建时间：${date.toLocaleString('zh-CN', { hour12: false })}`
}

const isTextInputLikeElement = (element) => {
  if (!(element instanceof HTMLElement)) return false
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

const handleGlobalKeydown = (event) => {
  const activeElement = document.activeElement
  const isInputFocused = isTextInputLikeElement(activeElement)

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p' && !isInputFocused) {
    event.preventDefault()
    openCommandPalette()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && serialStore.selectedPort) {
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('serialx-open-search', {
      detail: {
        portPath: serialStore.selectedPort
      }
    }))
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && !isInputFocused && serialStore.selectedPort) {
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('serialx-select-all', {
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
  showSettingsMenu.value = false
  window.electronAPI?.openCommandsWindow?.()
}

const openAppearanceSettings = () => {
  showSettingsMenu.value = false
  window.electronAPI?.openAppearanceWindow?.()
}

const closeAppearanceWindow = () => {
  window.electronAPI?.closeWindow?.()
}

const closeCommandsWindow = () => {
  window.electronAPI?.closeWindow?.()
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

const exportAllLogs = async (format = 'json') => {
  showSettingsMenu.value = false
  const isText = format === 'text'
  const payload = isText
    ? serialStore.buildAllPortPlainTextExport()
    : serialStore.buildAllPortLogExport()

  const hasLogs = isText
    ? Boolean(payload.trim())
    : Array.isArray(payload.ports) && payload.ports.some((port) => Array.isArray(port.logs) && port.logs.length > 0)

  if (!hasLogs) {
    showSettingsMessage('当前没有可导出的串口日志', 'warning', '无可用数据')
    return
  }

  const result = await window.electronAPI?.exportLogs(
    payload,
    `serialx-all-logs-${new Date().toISOString().slice(0, 10)}.${isText ? 'txt' : 'json'}`
  )

  if (!result || result.canceled) return

  const exportedSummaryPayload = isText ? serialStore.buildAllPortLogExport() : payload
  const exportedPortCount = Array.isArray(exportedSummaryPayload.ports) ? exportedSummaryPayload.ports.length : 0
  const exportedLogCount = Array.isArray(exportedSummaryPayload.ports)
    ? exportedSummaryPayload.ports.reduce((total, port) => total + (Array.isArray(port.logs) ? port.logs.length : 0), 0)
    : 0
  const exportedSummary = `${exportedPortCount} 个串口，${exportedLogCount} 条日志`

  if (result.success) {
    showSettingsMessage(`全部串口日志已导出（${exportedSummary}）\n${result.filePath}`, 'success', '导出成功')
    return
  }

  showSettingsMessage(`导出全部串口日志失败\n${result.error || '未知错误'}`, 'error', '导出失败')
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

const saveWorkspaceSnapshotQuick = async () => {
  showSettingsMenu.value = false
  const defaultName = `工作区快照 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
  const name = window.prompt('请输入工作区快照名称：', defaultName)
  if (name === null) return

  const snapshot = await serialStore.saveNamedWorkspaceSnapshot(name)
  showSettingsMessage(`已保存工作区快照\n${snapshot.name}\n${formatWorkspaceSnapshotTime(snapshot.createdAt)}`, 'success', '保存成功')
}

const applySavedWorkspaceSnapshotQuick = async (snapshotId) => {
  showSettingsMenu.value = false
  try {
    const snapshot = await serialStore.applySavedWorkspaceSnapshot(snapshotId)
    showSettingsMessage(`已切换到工作区快照\n${snapshot.name}\n${formatWorkspaceSnapshotTime(snapshot.createdAt)}`, 'success', '工作区已恢复')
  } catch (error) {
    showSettingsMessage(`应用工作区快照失败\n${error.message}`, 'error', '应用失败')
  }
}

const overwriteSavedWorkspaceSnapshotQuick = async (snapshotId, snapshotName) => {
  try {
    const snapshot = await serialStore.overwriteSavedWorkspaceSnapshot(snapshotId)
    showSettingsMessage(`已覆盖工作区快照\n${snapshotName}\n${formatWorkspaceSnapshotTime(snapshot.createdAt)}`, 'success', '覆盖成功')
  } catch (error) {
    showSettingsMessage(`覆盖工作区快照失败\n${error.message}`, 'error', '覆盖失败')
  }
}

const renameSavedWorkspaceSnapshotQuick = async (snapshotId, snapshotName) => {
  const nextName = window.prompt('请输入新的工作区快照名称：', snapshotName)
  if (nextName === null) return

  try {
    const snapshot = await serialStore.renameSavedWorkspaceSnapshot(snapshotId, nextName)
    showSettingsMessage(`已重命名工作区快照\n${snapshot.name}`, 'success', '重命名成功')
  } catch (error) {
    showSettingsMessage(`重命名工作区快照失败\n${error.message}`, 'error', '重命名失败')
  }
}

const removeSavedWorkspaceSnapshotQuick = async (snapshotId, snapshotName) => {
  try {
    await serialStore.removeSavedWorkspaceSnapshot(snapshotId)
    showSettingsMessage(`已删除工作区快照\n${snapshotName}`, 'success', '已删除')
  } catch (error) {
    showSettingsMessage(`删除工作区快照失败\n${error.message}`, 'error', '删除失败')
  }
}

const resetAllSettings = () => {
  showSettingsMenu.value = false
  showResetConfirm.value = true
}

const confirmResetAllSettings = async () => {
  showResetConfirm.value = false
  await serialStore.resetAppSettings()
  showSettingsMessage('主题、工作区布局、默认串口参数和常用命令都已恢复默认。', 'success', '已恢复默认')
}

const cancelResetAllSettings = () => {
  showResetConfirm.value = false
}

const handleSendCommand = (event) => {
  const command = event.detail
  if (!command) return

  const portPath = serialStore.selectedPort
  if (!portPath) {
    showSettingsMessage('请先选中一个串口，再执行快捷命令', 'warning', '无法发送命令')
    return
  }

  serialStore.setPortSendingData(portPath, command)
  serialStore.sendData(portPath)
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.menubar-item')) {
    closeAllMenus()
  }
}

const rootThemeVars = computed(() => {
  const themeColors = {
    background: appTheme.value.background || (themeMode.value === 'light' ? '#f6fbff' : '#08131b'),
    headerBg: appTheme.value.headerBg || appTheme.value.shell || (themeMode.value === 'light' ? '#ffffff' : '#08131b'),
    menuBg: appTheme.value.menuBg || appTheme.value.shell || (themeMode.value === 'light' ? '#ffffff' : '#151b22'),
    sidebarShell: appTheme.value.sidebarShell || appTheme.value.shell || (themeMode.value === 'light' ? '#ffffff' : '#0a1219'),
    sidebarSurface: appTheme.value.sidebarSurface || appTheme.value.surface || (themeMode.value === 'light' ? '#ffffff' : '#0c141c'),
    workspaceShell: appTheme.value.workspaceShell || appTheme.value.shell || (themeMode.value === 'light' ? '#ffffff' : '#0a1219'),
    workspaceSurface: appTheme.value.workspaceSurface || appTheme.value.surface || (themeMode.value === 'light' ? '#ffffff' : '#0c141c'),
    statusBarBg: appTheme.value.statusBarBg || appTheme.value.shell || (themeMode.value === 'light' ? '#ffffff' : '#0a1219'),
    text: appTheme.value.text || (themeMode.value === 'light' ? '#1f2328' : '#d9e6f2'),
    textSoft: appTheme.value.textSoft || (themeMode.value === 'light' ? '#6b7785' : '#8fa5b6'),
    border: appTheme.value.border || (themeMode.value === 'light' ? '#d5e6ef' : '#223847'),
    accent: appTheme.value.accent || (themeMode.value === 'light' ? '#0078d4' : '#57c7ff'),
    accentText: appTheme.value.accentText || (themeMode.value === 'light' ? '#005fb8' : '#b9ecff')
  }

  if (themeMode.value === 'light') {
    const sidebarBaseOpacity = sidebarOpacity.value
    const sidebarSoftOpacity = Math.min(0.9, sidebarBaseOpacity + 0.08)
    const sidebarShellOpacity = Math.min(0.92, sidebarBaseOpacity + 0.1)
    const workspaceBaseOpacity = workspaceOpacity.value
    const workspaceSoftOpacity = Math.min(0.9, workspaceBaseOpacity + 0.08)
    const workspaceStrongOpacity = Math.min(0.96, workspaceBaseOpacity + 0.14)
    const headerOpacity = Math.min(0.96, workspaceBaseOpacity + 0.18)
    const mainOpacity = Math.max(0.12, workspaceBaseOpacity - 0.14)
    return {
      '--app-bg': themeColors.background,
      '--app-bg-gradient': `linear-gradient(180deg, ${themeColors.background} 0%, ${themeColors.background} 100%)`,
      '--app-sidebar-shell': wallpaperEnabled.value ? rgbaFromHex(themeColors.sidebarShell, sidebarShellOpacity, { r: 255, g: 255, b: 255 }) : rgbaFromHex(themeColors.sidebarShell, 0.92, { r: 255, g: 255, b: 255 }),
      '--app-workspace-shell': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceShell, workspaceBaseOpacity, { r: 255, g: 255, b: 255 }) : themeColors.workspaceShell,
      '--app-workspace-shell-strong': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceShell, workspaceStrongOpacity, { r: 255, g: 255, b: 255 }) : themeColors.workspaceShell,
      '--app-sidebar-base': wallpaperEnabled.value ? rgbaFromHex(themeColors.sidebarSurface, sidebarBaseOpacity, { r: 255, g: 255, b: 255 }) : themeColors.sidebarSurface,
      '--app-sidebar-soft': wallpaperEnabled.value ? rgbaFromHex(themeColors.sidebarSurface, sidebarSoftOpacity, { r: 255, g: 255, b: 255 }) : themeColors.sidebarSurface,
      '--app-workspace-base': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceSurface, workspaceBaseOpacity, { r: 255, g: 255, b: 255 }) : themeColors.workspaceSurface,
      '--app-workspace-soft': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceSurface, workspaceSoftOpacity, { r: 255, g: 255, b: 255 }) : themeColors.workspaceSurface,
      '--app-terminal-opacity': wallpaperEnabled.value ? String(terminalOpacity.value) : '1',
      '--app-border': rgbaFromHex(themeColors.border, 0.7, { r: 213, g: 230, b: 239 }),
      '--app-text': themeColors.text,
      '--app-text-soft': themeColors.textSoft,
      '--app-accent': themeColors.accent,
      '--app-header-bg': wallpaperEnabled.value ? rgbaFromHex(themeColors.headerBg, headerOpacity, { r: 255, g: 255, b: 255 }) : rgbaFromHex(themeColors.headerBg, 0.96, { r: 255, g: 255, b: 255 }),
      '--app-main-bg': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceShell, mainOpacity, { r: 255, g: 255, b: 255 }) : themeColors.workspaceShell,
      '--app-chip-bg': rgbaFromHex(themeColors.accent, 0.1, { r: 0, g: 120, b: 212 }),
      '--app-chip-border': rgbaFromHex(themeColors.accent, 0.16, { r: 0, g: 120, b: 212 }),
      '--app-chip-text': themeColors.accentText,
      '--app-radial': 'none',
      '--app-toast-bg': rgbaFromHex(themeColors.workspaceShell, 0.98, { r: 255, g: 255, b: 255 }),
      '--app-menu-bg': themeColors.menuBg,
      '--app-status-bg': themeColors.statusBarBg,
      '--app-overlay-bg': rgbaFromHex(themeColors.workspaceShell, 0.28, { r: 255, g: 255, b: 255 }),
      '--app-overlay-strong': rgbaFromHex(themeColors.workspaceShell, 0.4, { r: 255, g: 255, b: 255 }),
      '--app-modal-bg': rgbaFromHex(themeColors.workspaceShell, 0.98, { r: 255, g: 255, b: 255 }),
      '--app-modal-soft': rgbaFromHex(themeColors.workspaceSurface, 0.96, { r: 255, g: 255, b: 255 }),
      '--app-modal-border': rgbaFromHex(themeColors.border, 0.78, { r: 213, g: 230, b: 239 }),
      '--app-shadow-lg': '0 24px 56px rgba(31, 35, 40, 0.16)',
      '--app-accent-soft': rgbaFromHex(themeColors.accent, 0.1, { r: 0, g: 120, b: 212 }),
      '--app-accent-strong': rgbaFromHex(themeColors.accent, 0.24, { r: 0, g: 120, b: 212 }),
      '--app-success': '#1b9c6a',
      '--app-success-soft': 'rgba(27, 156, 106, 0.12)',
      '--app-success-border': 'rgba(27, 156, 106, 0.18)',
      '--app-success-text': '#187354',
      '--app-warning': '#c18512',
      '--app-warning-soft': 'rgba(193, 133, 18, 0.12)',
      '--app-warning-border': 'rgba(193, 133, 18, 0.18)',
      '--app-warning-text': '#9a660d',
      '--app-danger': '#c42b1c',
      '--app-danger-soft': 'rgba(196, 43, 28, 0.1)',
      '--app-danger-border': 'rgba(196, 43, 28, 0.18)',
      '--app-danger-text': '#b2473d'
    }
  }

  return {
    '--app-sidebar-base': wallpaperEnabled.value ? rgbaFromHex(themeColors.sidebarSurface, sidebarOpacity.value, { r: 12, g: 20, b: 28 }) : rgbaFromHex(themeColors.sidebarSurface, 0.62, { r: 12, g: 20, b: 28 }),
    '--app-sidebar-soft': wallpaperEnabled.value ? rgbaFromHex(themeColors.sidebarSurface, Math.min(0.9, sidebarOpacity.value + 0.1), { r: 12, g: 20, b: 28 }) : rgbaFromHex(themeColors.sidebarSurface, 0.78, { r: 12, g: 20, b: 28 }),
    '--app-sidebar-shell': wallpaperEnabled.value ? rgbaFromHex(themeColors.sidebarShell, Math.min(0.92, sidebarOpacity.value + 0.08), { r: 10, g: 18, b: 25 }) : rgbaFromHex(themeColors.sidebarShell, 0.62, { r: 10, g: 18, b: 25 }),
    '--app-workspace-base': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceSurface, workspaceOpacity.value, { r: 12, g: 20, b: 28 }) : rgbaFromHex(themeColors.workspaceSurface, 0.62, { r: 12, g: 20, b: 28 }),
    '--app-workspace-soft': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceSurface, Math.min(0.9, workspaceOpacity.value + 0.1), { r: 12, g: 20, b: 28 }) : rgbaFromHex(themeColors.workspaceSurface, 0.78, { r: 12, g: 20, b: 28 }),
    '--app-workspace-shell': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceShell, workspaceOpacity.value, { r: 10, g: 18, b: 25 }) : rgbaFromHex(themeColors.workspaceShell, 0.62, { r: 10, g: 18, b: 25 }),
    '--app-workspace-shell-strong': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceShell, Math.min(0.94, workspaceOpacity.value + 0.16), { r: 8, g: 15, b: 22 }) : rgbaFromHex(themeColors.workspaceShell, 0.94, { r: 8, g: 15, b: 22 }),
    '--app-terminal-opacity': wallpaperEnabled.value ? String(terminalOpacity.value) : '1',
    '--app-bg': themeColors.background,
    '--app-bg-gradient': `linear-gradient(180deg, ${themeColors.background} 0%, ${themeColors.background} 100%)`,
    '--app-border': rgbaFromHex(themeColors.border, 0.42, { r: 34, g: 56, b: 71 }),
    '--app-text': themeColors.text,
    '--app-text-soft': themeColors.textSoft,
    '--app-accent': themeColors.accent,
    '--app-header-bg': wallpaperEnabled.value ? rgbaFromHex(themeColors.headerBg, Math.min(0.88, workspaceOpacity.value + 0.12), { r: 8, g: 15, b: 22 }) : rgbaFromHex(themeColors.headerBg, 0.72, { r: 8, g: 15, b: 22 }),
    '--app-main-bg': wallpaperEnabled.value ? rgbaFromHex(themeColors.workspaceShell, Math.max(0.1, workspaceOpacity.value - 0.18), { r: 7, g: 15, b: 22 }) : rgbaFromHex(themeColors.workspaceShell, 0.22, { r: 7, g: 15, b: 22 }),
    '--app-chip-bg': rgbaFromHex(themeColors.accent, 0.08, { r: 87, g: 199, b: 255 }),
    '--app-chip-border': rgbaFromHex(themeColors.accent, 0.22, { r: 87, g: 199, b: 255 }),
    '--app-chip-text': themeColors.accentText,
    '--app-radial': `radial-gradient(circle at 50% 0%, ${rgbaFromHex(themeColors.accent, 0.08, { r: 87, g: 199, b: 255 })}, transparent 42%)`,
    '--app-toast-bg': rgbaFromHex(themeColors.workspaceShell, 0.94, { r: 8, g: 15, b: 22 }),
    '--app-menu-bg': themeColors.menuBg,
    '--app-status-bg': themeColors.statusBarBg,
    '--app-overlay-bg': 'rgba(0, 0, 0, 0.58)',
    '--app-overlay-strong': 'rgba(0, 0, 0, 0.72)',
    '--app-modal-bg': rgbaFromHex(themeColors.workspaceShell, 0.96, { r: 8, g: 15, b: 22 }),
    '--app-modal-soft': rgbaFromHex(themeColors.workspaceSurface, 0.88, { r: 12, g: 20, b: 28 }),
    '--app-modal-border': rgbaFromHex(themeColors.border, 0.48, { r: 34, g: 56, b: 71 }),
    '--app-shadow-lg': '0 24px 56px rgba(0, 0, 0, 0.32)',
    '--app-accent-soft': rgbaFromHex(themeColors.accent, 0.12, { r: 87, g: 199, b: 255 }),
    '--app-accent-strong': rgbaFromHex(themeColors.accent, 0.28, { r: 87, g: 199, b: 255 }),
    '--app-success': '#52d7a6',
    '--app-success-soft': 'rgba(82, 215, 166, 0.12)',
    '--app-success-border': 'rgba(82, 215, 166, 0.2)',
    '--app-success-text': '#9df2d0',
    '--app-warning': '#ffc266',
    '--app-warning-soft': 'rgba(255, 194, 102, 0.12)',
    '--app-warning-border': 'rgba(255, 194, 102, 0.2)',
    '--app-warning-text': '#ffdca8',
    '--app-danger': '#e85454',
    '--app-danger-soft': 'rgba(232, 84, 84, 0.12)',
    '--app-danger-border': 'rgba(232, 84, 84, 0.22)',
    '--app-danger-text': '#ffc8c8'
  }
})

watch(rootThemeVars, (vars) => {
  if (typeof document === 'undefined') return
  Object.entries(vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })
}, { immediate: true })

const wallpaperLayerStyle = computed(() => ({
  backgroundImage: wallpaperEnabled.value && wallpaperDataUrl.value ? `url("${wallpaperDataUrl.value}")` : 'none',
  opacity: wallpaperEnabled.value ? String(wallpaperOpacity.value) : '0'
}))

onMounted(async () => {
  await serialStore.restoreSessionState()
  await syncWallpaperDataUrl()

  if (!isAppearanceMode.value && !isConverterMode.value) {
    if (!isCommandsMode.value) {
      serialStore.refreshPorts()
    }
    serialStore.loadCommonCommands()
  }

  if (!isAppearanceMode.value) {
    window.electronAPI?.onWindowMaximized(() => {
      isMaximized.value = true
    })

    window.electronAPI?.onWindowUnmaximized(() => {
      isMaximized.value = false
    })
  }

  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('serialx-send-command', handleSendCommand)
  document.addEventListener('click', handleClickOutside)
})

watch(wallpaperPath, () => {
  syncWallpaperDataUrl()
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
    v-if="!isConverterMode && !isAppearanceMode && !isCommandsMode"
    :class="['app-container', `theme-${themeMode}`, { 'wallpaper-active': wallpaperEnabled }]"
    :style="rootThemeVars"
  >
    <div class="app-wallpaper-layer" :style="wallpaperLayerStyle"></div>
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
                <span class="dropdown-text">深色主题</span>
              </div>
              <div class="dropdown-item" :class="{ selected: isLightMode }" @click="setThemeMode('light')">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <circle cx="8" cy="8" r="3" fill="currentColor" />
                    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
                  </svg>
                </span>
                <span class="dropdown-text">浅色主题</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-section-label">外观与命令</div>
              <div class="dropdown-item" @click="openAppearanceSettings">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 3.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3ZM4.4 8a3.6 3.6 0 1 1 7.2 0a3.6 3.6 0 0 1-7.2 0Zm8.85-.75 1.25.75-1.25.75-.3 1.42-1.42.3-.75 1.25-.75-1.25-1.42-.3-.3-1.42-1.25-.75 1.25-.75.3-1.42 1.42-.3.75-1.25.75 1.25 1.42.3.3 1.42Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">外观设置</span>
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
              <div class="dropdown-item" @click="exportAllLogs('json')">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M3 3h10v3H3zM3 8h10v5H3zM5 5h6v1H5zm0 5h6v1H5z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">导出全部日志 (JSON)</span>
              </div>
              <div class="dropdown-item" @click="exportAllLogs('text')">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M4 3h8v2H4zm0 4h8v1H4zm0 3h6v1H4zm0 3h8v1H4z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">导出全部日志 (TXT)</span>
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
              <div class="dropdown-item" @click="saveWorkspaceSnapshotQuick">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M3 3h8l2 2v8H3zM5 3v4h5V3M5 11h6v1H5z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">保存工作区快照</span>
              </div>
              <template v-if="savedWorkspaceSnapshots.length">
                <div class="dropdown-divider"></div>
                <div class="dropdown-section-label">快捷工作区（{{ savedWorkspaceSnapshots.length }}/{{ workspaceSnapshotLimit }}）</div>
                <div
                  v-for="snapshot in savedWorkspaceSnapshots.slice(0, 5)"
                  :key="snapshot.id"
                  :class="['dropdown-item', 'dropdown-item-composite', { selected: snapshot.id === activeWorkspaceSnapshotId }]"
                  @click="applySavedWorkspaceSnapshotQuick(snapshot.id)"
                >
                  <span class="dropdown-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="16" height="16">
                      <path d="M3 4h10v8H3zM5 2h6v2H5z" fill="currentColor" />
                    </svg>
                  </span>
                  <div class="dropdown-item-content">
                    <div class="dropdown-item-main">
                      <span class="dropdown-text">{{ snapshot.name }}</span>
                      <span v-if="snapshot.id === activeWorkspaceSnapshotId" class="dropdown-item-badge">当前</span>
                    </div>
                    <div class="dropdown-item-meta">{{ formatWorkspaceSnapshotTime(snapshot.createdAt) }}</div>
                  </div>
                  <div class="dropdown-item-actions">
                    <button
                      class="dropdown-inline-action"
                      title="覆盖保存当前工作区"
                      @click.stop="overwriteSavedWorkspaceSnapshotQuick(snapshot.id, snapshot.name)"
                    >
                      ↺
                    </button>
                    <button
                      class="dropdown-inline-action"
                      title="重命名快照"
                      @click.stop="renameSavedWorkspaceSnapshotQuick(snapshot.id, snapshot.name)"
                    >
                      ✎
                    </button>
                    <button
                      class="dropdown-inline-action"
                      title="删除快照"
                      @click.stop="removeSavedWorkspaceSnapshotQuick(snapshot.id, snapshot.name)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </template>
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
    <CommandPalette v-model="showCommandPalette" />
  </div>

  <div v-else-if="isConverterMode" class="converter-only">
    <DataConverter standalone />
  </div>

  <div v-else-if="isAppearanceMode" class="appearance-only">
    <AppearanceSettingsModal :show="true" standalone @update:show="closeAppearanceWindow" />
  </div>

  <div v-else class="commands-only">
    <CommandsModal :show="true" standalone @update:show="closeCommandsWindow" />
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

.app-wallpaper-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 0;
}

.app-container::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--app-radial);
  opacity: 0.9;
  pointer-events: none;
  z-index: 1;
}

.wallpaper-active ::v-deep(.theme-light.sidebar-container) {
  background: transparent !important;
  backdrop-filter: none !important;
}

.wallpaper-active ::v-deep(.theme-light .ports-section),
.wallpaper-active ::v-deep(.theme-light .settings-section),
.wallpaper-active ::v-deep(.theme-light .refresh-btn),
.wallpaper-active ::v-deep(.theme-light .settings-toggle),
.wallpaper-active ::v-deep(.theme-light .setting-select),
.wallpaper-active ::v-deep(.theme-light .port-action-btn) {
  background: color-mix(in srgb, var(--app-workspace-shell) 74%, transparent) !important;
}

.wallpaper-active ::v-deep(.theme-light.terminal-shell),
.wallpaper-active ::v-deep(.theme-light .content-container),
.wallpaper-active ::v-deep(.theme-light .tab-header-section),
.wallpaper-active ::v-deep(.theme-light.serial-panel),
.wallpaper-active ::v-deep(.theme-light .panel-header),
.wallpaper-active ::v-deep(.theme-light .filter-panel),
.wallpaper-active ::v-deep(.theme-light .send-console) {
  background: color-mix(in srgb, var(--app-workspace-shell) 42%, transparent) !important;
  backdrop-filter: blur(14px);
}

.wallpaper-active ::v-deep(.theme-light.terminal-shell),
.wallpaper-active ::v-deep(.theme-light .content-container),
.wallpaper-active ::v-deep(.theme-light .split-pane-group) {
  background: transparent !important;
  backdrop-filter: none !important;
}

.wallpaper-active ::v-deep(.theme-light .split-pane-group) {
  border-color: rgba(0, 102, 153, 0.12) !important;
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
  background-color: var(--app-chip-bg);
  border-color: var(--app-chip-border);
}

.theme-light .menubar-item:hover {
  background-color: var(--app-accent-soft);
  border-color: var(--app-chip-border);
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
  background: var(--app-menu-bg);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 8px;
  box-shadow: var(--app-shadow-lg);
  z-index: 1000;
  margin-top: 6px;
}

.theme-light .menubar-dropdown {
  border-color: rgba(0, 102, 153, 0.16);
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

.dropdown-item-composite {
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.dropdown-item-content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dropdown-item-meta {
  font-size: 11px;
  color: var(--app-text-soft);
  line-height: 1.35;
}

.dropdown-item-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--app-chip-border);
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
  flex-shrink: 0;
}

.dropdown-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.dropdown-item:hover,
.dropdown-item.selected {
  background-color: var(--app-accent-soft);
  box-shadow: inset 0 0 0 1px var(--app-chip-border);
}

.theme-light .dropdown-item:hover,
.theme-light .dropdown-item.selected {
  background-color: var(--app-accent-soft);
  box-shadow: inset 0 0 0 1px var(--app-chip-border);
}

.dropdown-item.danger:hover {
  background-color: var(--app-danger-soft);
}

.dropdown-slider {
  padding: 10px 12px 8px;
  border-radius: 10px;
}

.dropdown-slider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.dropdown-slider-label,
.dropdown-slider-value {
  font-size: 12px;
  color: var(--app-text);
}

.dropdown-slider-value {
  color: var(--app-text-soft);
  font-variant-numeric: tabular-nums;
}

.dropdown-range {
  width: 100%;
  margin: 0;
  accent-color: var(--app-accent);
  cursor: pointer;
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
  flex: 1;
}

.dropdown-inline-action {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-soft);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.dropdown-inline-action:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger-text);
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
  background: var(--app-chip-bg);
  color: var(--app-text);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.18s ease;
}

.window-btn:hover {
  background-color: var(--app-accent-soft);
  color: var(--app-text);
}

.theme-light .window-btn:hover {
  background-color: var(--app-accent-soft);
}

.window-btn.maximize-btn:hover {
  background-color: var(--app-chip-border);
}

.window-btn.close-btn:hover {
  background-color: var(--app-danger);
  color: var(--app-text);
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
  background: var(--app-sidebar-shell);
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
  background: var(--app-workspace-shell-strong);
  color: var(--app-text-soft);
  cursor: pointer;
  transition: all 0.18s ease;
  backdrop-filter: blur(8px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
}

.sidebar-toggle:hover {
  color: var(--app-text);
  background: var(--app-workspace-shell);
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
  background: var(--app-status-bg);
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
  background: var(--app-text-soft);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-text-soft) 18%, transparent);
}

.status-dot.online {
  background: var(--app-success);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-success) 16%, transparent);
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
  box-shadow: var(--app-shadow-lg);
  backdrop-filter: blur(16px);
}

.settings-toast.success {
  border-color: var(--app-success-border);
}

.settings-toast.error {
  border-color: var(--app-danger-border);
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
  background: var(--app-chip-bg);
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
  background: var(--app-overlay-bg);
  backdrop-filter: blur(6px);
}

.confirm-dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 20px;
  border-radius: 16px;
  background: var(--app-workspace-shell-strong);
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
  background: var(--app-chip-bg);
  border-color: var(--app-border);
  color: var(--app-text);
}

.confirm-btn.danger {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
  color: var(--app-danger-text);
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

.appearance-only {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--app-bg-gradient);
}

.commands-only {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--app-bg-gradient);
}

</style>
