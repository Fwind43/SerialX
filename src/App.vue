<script setup>
import { onMounted, computed, ref, onUnmounted } from 'vue'
import { useSerialStore } from './stores/serial'
import SerialSidebar from './components/SerialSidebar.vue'
import TerminalView from './components/TerminalView.vue'
import DataConverter from './components/DataConverter.vue'
import CommandsModal from './components/CommandsModal.vue'
import CommandPalette from './components/CommandPalette.vue'

const serialStore = useSerialStore()

// 检查是否是转换器独立窗口
const isConverterMode = computed(() => {
  return window.location.hash === '#/converter'
})

// 菜单控制
const showToolsMenu = ref(false)
const showSettingsMenu = ref(false)
const showCommandsModal = ref(false)
const showCommandPalette = ref(false)

// 关闭所有菜单
const closeAllMenus = () => {
  showToolsMenu.value = false
  showSettingsMenu.value = false
}

// 切换菜单显示
const toggleToolsMenu = () => {
  if (showToolsMenu.value) {
    showToolsMenu.value = false
  } else {
    closeAllMenus()
    showToolsMenu.value = true
  }
}

const toggleSettingsMenu = () => {
  if (showSettingsMenu.value) {
    showSettingsMenu.value = false
  } else {
    closeAllMenus()
    showSettingsMenu.value = true
  }
}

// 打开快捷命令面板
const openCommandPalette = () => {
  showCommandPalette.value = true
}

// 全局键盘快捷键处理
const handleGlobalKeydown = (e) => {
  // Ctrl+P 打开快捷命令面板
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    // 检查是否有输入框获得焦点
    const activeElement = document.activeElement
    const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
    if (!isInputFocused) {
      e.preventDefault()
      openCommandPalette()
    }
  }
}

// 窗口控制
const minimizeWindow = () => {
  window.electronAPI?.minimizeWindow()
}

const maximizeWindow = () => {
  window.electronAPI?.maximizeWindow()
}

const closeWindow = () => {
  window.electronAPI?.closeWindow()
}

// 窗口状态
const isMaximized = ref(false)

const toggleMaximize = () => {
  if (isMaximized.value) {
    window.electronAPI?.unmaximizeWindow()
  } else {
    window.electronAPI?.maximizeWindow()
  }
  isMaximized.value = !isMaximized.value
}

// 打开进制转换工具
const openConverter = () => {
  window.electronAPI?.openConverterWindow()
  showToolsMenu.value = false
}

// 打开常用命令配置
const openCommandsConfig = () => {
  showCommandsModal.value = true
  showSettingsMenu.value = false
}

// 关闭命令配置
const closeCommandsModal = () => {
  showCommandsModal.value = false
}

// 处理发送命令事件
const handleSendCommand = (e) => {
  const command = e.detail
  if (command) {
    // 找到当前激活的串口面板并发送命令
    const activePanel = document.querySelector('.serial-panel')
    if (activePanel) {
      // 通过 store 发送
      const portPath = serialStore.selectedPort
      if (portPath) {
        serialStore.setPortSendingData(portPath, command)
        serialStore.sendData(portPath)
      }
    }
  }
}

onMounted(async () => {
  serialStore.refreshPorts()
  // 加载常用命令配置
  serialStore.loadCommonCommands()
  // 恢复会话状态
  await serialStore.restoreSessionState()

  // 监听窗口最大化状态
  window.electronAPI?.onWindowMaximized(() => {
    isMaximized.value = true
  })
  window.electronAPI?.onWindowUnmaximized(() => {
    isMaximized.value = false
  })

  // 监听全局键盘快捷键
  document.addEventListener('keydown', handleGlobalKeydown)

  // 监听命令发送事件
  window.addEventListener('serialx-send-command', handleSendCommand)
})

// 组件卸载时清理
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('serialx-send-command', handleSendCommand)
})

// 点击外部关闭菜单
const handleClickOutside = (event) => {
  if (!event.target.closest('.menubar-item')) {
    closeAllMenus()
  }
}

// 监听全局点击事件
if (typeof document !== 'undefined') {
  document.addEventListener('click', handleClickOutside)
}
</script>

<template>
  <div class="app-container" v-if="!isConverterMode">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <div class="header-left">
        <!-- 菜单栏 -->
        <div class="menubar-items">
          <div class="menubar-item" @click.stop="toggleToolsMenu">
            <span class="menubar-label">工具</span>
            <div v-if="showToolsMenu" class="menubar-dropdown">
              <div class="dropdown-item" @click="openConverter">
                <span class="dropdown-icon">🔢</span>
                <span class="dropdown-text">进制转换工具</span>
              </div>
            </div>
          </div>
          <div class="menubar-item" @click.stop="toggleSettingsMenu">
            <span class="menubar-label">设置</span>
            <div v-if="showSettingsMenu" class="menubar-dropdown">
              <div class="dropdown-item" @click="openCommandsConfig">
                <span class="dropdown-icon">⚡</span>
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
        <img src="../logo/icon.png" alt="SerialX" class="app-icon" />
        <span class="app-title">SerialX</span>
        <span class="app-subtitle">串口调试工具</span>
      </div>
      <div class="header-right window-controls">
        <button class="window-btn minimize-btn" @click="minimizeWindow" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5" width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="window-btn maximize-btn" @click="toggleMaximize" :title="isMaximized ? '还原' : '最大化'">
          <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <rect x="2" y="0" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1"/>
            <rect x="0" y="2" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/>
          </svg>
        </button>
        <button class="window-btn close-btn" @click="closeWindow" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.2"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="workspace">
      <!-- 左侧边栏：串口列表 -->
      <aside class="sidebar">
        <SerialSidebar />
      </aside>

      <!-- 中间内容区：多分屏终端 -->
      <main class="main-area">
        <TerminalView />
      </main>
    </div>

    <!-- 底部状态栏 -->
    <footer class="status-bar">
      <span class="status-item">
        <span class="status-label">串口：</span>
        <span class="status-value">{{ serialStore.selectedPort || '未选择' }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">状态：</span>
        <span class="status-value">{{ serialStore.openPorts.size > 0 ? '已连接' : '未连接' }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">打开的串口：</span>
        <span class="status-value">{{ serialStore.openPorts.size }}</span>
      </span>
    </footer>

    <!-- 常用命令配置弹窗 -->
    <CommandsModal
      v-model:show="showCommandsModal"
    />

    <!-- 快捷命令面板 -->
    <CommandPalette
      v-model="showCommandPalette"
    />
  </div>

  <!-- 转换器独立模式 -->
  <div v-else class="converter-only">
    <DataConverter standalone />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1e1e1e;
  color: #cccccc;
  overflow: hidden;
}

/* 顶部标题栏 */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  background-color: #323233;
  border-bottom: 1px solid #3e3e42;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.header-right {
  display: flex;
  align-items: center;
}

.menubar-items {
  display: flex;
  align-items: center;
  gap: 4px;
}

.menubar-item {
  position: relative;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.menubar-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.menubar-label {
  font-size: 13px;
  color: #cccccc;
}

.menubar-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  margin-top: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.dropdown-icon {
  font-size: 16px;
}

.dropdown-text {
  font-size: 13px;
  color: #cccccc;
}

.app-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.app-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.app-subtitle {
  font-size: 12px;
  color: #858585;
}

/* 窗口控制按钮 */
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
  width: 36px;
  height: 36px;
  border: none;
  outline: none;
  background: transparent;
  color: #cccccc;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.window-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.window-btn.maximize-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
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

/* 工作区：左侧边栏 + 中间内容 */
.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧边栏 */
.sidebar {
  width: 260px;
  min-width: 200px;
  max-width: 400px;
  background-color: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 中间内容区 */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* 底部状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  background-color: #007acc;
  color: #ffffff;
  font-size: 12px;
  gap: 20px;
  flex-shrink: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-label {
  opacity: 0.8;
}

.status-value {
  font-weight: 500;
}

/* 转换器独立模式 */
.converter-only {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>
