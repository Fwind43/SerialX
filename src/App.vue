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
const isSidebarCollapsed = computed({
  get: () => serialStore.appUiState?.sidebarCollapsed ?? false,
  set: (value) => {
    serialStore.updateAppUiState({ sidebarCollapsed: value })
  }
})

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

const showSettingsMessage = (message) => {
  window.alert(message)
}

const formatImportedSettingsSummary = (result) => {
  const snapshot = result?.data || {}
  const versionText = typeof snapshot.version === 'number' ? `v${snapshot.version}` : '未知版本'
  const hasLayout = snapshot.workspaceLayout ? '包含工作区布局' : '不包含工作区布局'
  return `设置已导入：\n${result.filePath}\n版本：${versionText}\n内容：${hasLayout}`
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
    showSettingsMessage(`设置已导出到：\n${result.filePath}`)
    return
  }

  showSettingsMessage(`导出设置失败：${result.error || '未知错误'}`)
}

const importSettings = async () => {
  showSettingsMenu.value = false
  const result = await window.electronAPI?.importSettings()
  if (!result || result.canceled) return

  if (!result.success) {
    showSettingsMessage(`导入设置失败：${result.error || '未知错误'}`)
    return
  }

  try {
    await serialStore.applySettingsSnapshot(result.data)
    showSettingsMessage(formatImportedSettingsSummary(result))
  } catch (error) {
    showSettingsMessage(`应用设置失败：${error.message}`)
  }
}

const resetAllSettings = async () => {
  showSettingsMenu.value = false
  const confirmed = window.confirm('确定要恢复默认设置吗？这会重置终端外观、串口默认参数和常用命令。')
  if (!confirmed) return

  await serialStore.resetAppSettings()
  showSettingsMessage('已恢复默认设置。')
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
})
</script>

<template>
  <div v-if="!isConverterMode" class="app-container">
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
              <div class="dropdown-item" @click="openAppearanceSettings">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 3.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3ZM4.4 8a3.6 3.6 0 1 1 7.2 0a3.6 3.6 0 0 1-7.2 0Zm8.85-.75 1.25.75-1.25.75-.3 1.42-1.42.3-.75 1.25-.75-1.25-1.42-.3-.3-1.42-1.25-.75 1.25-.75.3-1.42 1.42-.3.75-1.25.75 1.25 1.42.3.3 1.42Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">终端外观设置</span>
              </div>
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
              <div class="dropdown-item danger" @click="resetAllSettings">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 3a5 5 0 1 1-4.58 7H5v1H2V8h1v1.16A6 6 0 1 0 8 2v1Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">恢复默认设置</span>
              </div>
              <div class="dropdown-item" @click="openCommandsConfig">
                <span class="dropdown-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M3 3h10v10H3zM5 6h6v1H5zm0 2h6v1H5zm0 2h4v1H5z" fill="currentColor" />
                  </svg>
                </span>
                <span class="dropdown-text">常用命令配置</span>
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
        <span class="app-version-chip">v0.0.4-dev</span>
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
  --app-bg: #08131b;
  --app-panel: rgba(10, 18, 25, 0.62);
  --app-border: rgba(125, 162, 186, 0.1);
  --app-text: #d9e6f2;
  --app-text-soft: #8fa5b6;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(180deg, #09131b 0%, var(--app-bg) 100%);
  color: var(--app-text);
  overflow: hidden;
  position: relative;
}

.app-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(87, 199, 255, 0.08), transparent 42%);
  opacity: 0.8;
  pointer-events: none;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 14px;
  background: rgba(8, 15, 22, 0.72);
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

.menubar-label {
  font-size: 13px;
  color: var(--app-text);
  letter-spacing: 0.02em;
}

.menubar-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 208px;
  background: rgba(8, 15, 22, 0.96);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.28);
  z-index: 1000;
  margin-top: 6px;
  backdrop-filter: blur(14px);
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

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.dropdown-item.danger:hover {
  background-color: rgba(196, 43, 28, 0.18);
}

.dropdown-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #9ed6f2;
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
  color: #f4fbff;
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
  border: 1px solid rgba(87, 199, 255, 0.22);
  background: rgba(87, 199, 255, 0.08);
  color: #bfe9ff;
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

.window-btn.maximize-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.window-btn.close-btn:hover {
  background-color: #e81123;
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
  background: rgba(7, 15, 22, 0.22);
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
  border: 1px solid rgba(125, 162, 186, 0.08);
  border-radius: 999px;
  background: rgba(10, 19, 27, 0.72);
  color: #8fa5b6;
  cursor: pointer;
  transition: all 0.18s ease;
  backdrop-filter: blur(8px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
}

.sidebar-toggle:hover {
  color: #f4fbff;
  border-color: rgba(87, 199, 255, 0.18);
  background: rgba(13, 25, 35, 0.88);
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
  color: #ffffff;
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
  background: rgba(10, 21, 30, 0.72);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  backdrop-filter: blur(8px);
}

.status-label {
  opacity: 0.72;
}

.status-item.primary {
  border-color: rgba(87, 199, 255, 0.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5e7484;
  box-shadow: 0 0 0 4px rgba(94, 116, 132, 0.16);
}

.status-dot.online {
  background: #52d7a6;
  box-shadow: 0 0 0 4px rgba(82, 215, 166, 0.12);
}

.status-value {
  font-weight: 700;
  color: #f4fbff;
}

.converter-only {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>
