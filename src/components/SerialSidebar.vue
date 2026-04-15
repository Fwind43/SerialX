<script setup>
import { computed, ref } from 'vue'
import { useSerialStore } from '../stores/serial'

const serialStore = useSerialStore()
const showSettings = ref(false)
const showAutoLogSettings = ref(false)
const themeMode = computed(() => serialStore.appUiState?.themeMode || 'dark')

const isPortConnected = (portPath) => serialStore.getPortStatus(portPath)
const getPortNotice = (portPath) => serialStore.getPortNotice(portPath)

const selectPort = (portPath) => {
  serialStore.selectedPort = portPath
}

const handleConnect = async (portPath = null) => {
  const targetPort = portPath || serialStore.selectedPort

  if (!targetPort) {
    serialStore.addLog('请先选择串口', 'error')
    return
  }

  if (serialStore.getPortStatus(targetPort)) {
    await serialStore.disconnect(targetPort)
    return
  }

  await serialStore.connect(targetPort, {
    ...serialStore.defaultSettings,
    path: targetPort
  })
}

const handleRefresh = async () => {
  await serialStore.refreshPorts()
}

const settingsSummary = computed(() => {
  const { baudRate, dataBits, stopBits, parity } = serialStore.defaultSettings
  const parityLabelMap = {
    none: 'N',
    even: 'E',
    odd: 'O'
  }

  return `${baudRate} / ${dataBits}${parityLabelMap[parity] || 'N'}${stopBits}`
})

const autoLogSummary = computed(() => {
  if (!serialStore.autoLogSettings.enabled) {
    return '已关闭'
  }

  return `自动保存 / ${serialStore.autoLogSettings.format.toUpperCase()}`
})

const autoLogDirectoryLabel = computed(() => (
  serialStore.getResolvedAutoLogDirectory() || '未设置'
))

const handleSelectAutoLogDirectory = async () => {
  try {
    await serialStore.selectAutoLogDirectory()
  } catch (error) {
    serialStore.addLog(`选择日志目录失败：${error.message}`, 'error')
  }
}

const handleOpenAutoLogDirectory = async () => {
  try {
    await serialStore.openAutoLogDirectory()
  } catch (error) {
    serialStore.addLog(`打开日志目录失败：${error.message}`, 'error')
  }
}
</script>

<template>
  <div :class="['sidebar-container', `theme-${themeMode}`]">
    <div class="sidebar-title">
      <div class="title-copy">
        <span class="title-kicker">Serial Workspace</span>
        <span class="title-text">串口设备</span>
      </div>
    </div>

    <div class="ports-section">
      <div class="section-header">
        <span>可用串口</span>
        <span class="section-meta">{{ serialStore.ports.length }} 个</span>
        <button class="refresh-btn" title="刷新串口列表" @click="handleRefresh">
          刷新
        </button>
      </div>

      <div class="ports-list">
        <div v-if="serialStore.ports.length === 0" class="no-ports">
          <span class="no-ports-icon">○</span>
          <span>未找到串口设备</span>
        </div>

        <div
          v-for="port in serialStore.ports"
          :key="port.path"
          :class="['port-item', { selected: serialStore.selectedPort === port.path }]"
          @click="selectPort(port.path)"
        >
          <span class="port-icon" :class="{ active: isPortConnected(port.path) }"></span>
          <div class="port-copy">
            <span class="port-path">{{ port.path }}</span>
            <span class="port-meta">{{ port.manufacturer || '未知设备' }}</span>
            <span
              v-if="getPortNotice(port.path)"
              :class="['port-notice', getPortNotice(port.path).type]"
              :title="getPortNotice(port.path).message"
            >
              {{ getPortNotice(port.path).message }}
            </span>
          </div>
          <span v-if="isPortConnected(port.path)" class="port-status-connected">已连接</span>
          <button
            class="port-action-btn"
            :class="{ disconnect: isPortConnected(port.path) }"
            :title="isPortConnected(port.path) ? '断开该串口' : '连接该串口'"
            @click.stop="handleConnect(port.path)"
          >
            {{ isPortConnected(port.path) ? '断开' : '连接' }}
          </button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header settings-header">
        <div class="settings-copy">
          <span>默认串口参数</span>
          <span class="settings-summary">{{ settingsSummary }}</span>
        </div>
        <button
          class="settings-toggle"
          :title="showSettings ? '收起默认参数' : '展开默认参数'"
          @click="showSettings = !showSettings"
        >
          {{ showSettings ? '收起' : '编辑' }}
        </button>
      </div>

      <div v-if="showSettings" class="settings-grid">
        <div class="setting-item">
          <label>波特率</label>
          <select v-model="serialStore.defaultSettings.baudRate" class="setting-select">
            <option v-for="rate in serialStore.availableBaudRates" :key="rate" :value="rate">
              {{ rate }}
            </option>
          </select>
        </div>
        <div class="setting-item">
          <label>数据位</label>
          <select v-model="serialStore.defaultSettings.dataBits" class="setting-select">
            <option :value="8">8</option>
            <option :value="7">7</option>
            <option :value="6">6</option>
            <option :value="5">5</option>
          </select>
        </div>
        <div class="setting-item">
          <label>停止位</label>
          <select v-model="serialStore.defaultSettings.stopBits" class="setting-select">
            <option :value="1">1</option>
            <option :value="2">2</option>
          </select>
        </div>
        <div class="setting-item">
          <label>校验位</label>
          <select v-model="serialStore.defaultSettings.parity" class="setting-select">
            <option value="none">无</option>
            <option value="even">偶</option>
            <option value="odd">奇</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header settings-header">
        <div class="settings-copy">
          <span>自动日志保存</span>
          <span class="settings-summary">{{ autoLogSummary }}</span>
        </div>
        <button
          class="settings-toggle"
          :title="showAutoLogSettings ? '收起自动日志保存' : '展开自动日志保存'"
          @click="showAutoLogSettings = !showAutoLogSettings"
        >
          {{ showAutoLogSettings ? '收起' : '编辑' }}
        </button>
      </div>

      <div v-if="showAutoLogSettings" class="auto-log-grid">
        <label class="check-row">
          <input
            type="checkbox"
            :checked="serialStore.autoLogSettings.enabled"
            @change="serialStore.updateAutoLogSettings({ enabled: $event.target.checked })"
          >
          <span>连接期间自动落盘</span>
        </label>

        <div class="setting-item">
          <label>保存格式</label>
          <select
            :value="serialStore.autoLogSettings.format"
            class="setting-select"
            @change="serialStore.updateAutoLogSettings({ format: $event.target.value })"
          >
            <option value="txt">TXT</option>
            <option value="jsonl">JSONL</option>
          </select>
        </div>

        <div class="setting-item auto-log-dir">
          <label>保存目录</label>
          <div class="dir-path" :title="autoLogDirectoryLabel">{{ autoLogDirectoryLabel }}</div>
          <div class="dir-actions">
            <button class="secondary-btn" @click="handleSelectAutoLogDirectory">选择目录</button>
            <button class="secondary-btn" @click="handleOpenAutoLogDirectory">打开目录</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, var(--app-accent-soft), transparent 26%),
    linear-gradient(180deg, var(--app-sidebar-shell), var(--app-sidebar-base));
}

.sidebar-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--app-border);
}

.title-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title-kicker {
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--app-text-soft);
}

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.section-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-soft);
  letter-spacing: 0.08em;
}

.section-meta { color: var(--app-text-soft); }

.ports-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 8px 10px 10px;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-sidebar-soft);
}

.refresh-btn {
  margin-left: auto;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
  cursor: pointer;
  transition: all 0.18s ease;
  font-size: 11px;
}

.refresh-btn:hover { background: var(--app-accent-soft); }

.ports-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ports-list::-webkit-scrollbar {
  width: 6px;
}

.ports-list::-webkit-scrollbar-thumb {
  background: var(--app-border);
  border-radius: 999px;
}

.no-ports {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 12px;
  text-align: center;
  color: var(--app-text-soft);
  font-size: 13px;
}

.no-ports-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
}

.port-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
  border: 1px solid transparent;
  position: relative;
}

.port-item:hover {
  background: var(--app-chip-bg);
  border-color: var(--app-chip-border);
}

.port-item.selected {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
}

.port-item.selected::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 999px;
  background: var(--app-accent);
}

.port-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--app-text-soft);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--app-text-soft) 18%, transparent);
  flex-shrink: 0;
}

.port-icon.active {
  background: var(--app-success);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--app-success) 18%, transparent);
}

.port-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.port-path {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
}

.port-meta {
  font-size: 11px;
  color: var(--app-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.port-notice {
  font-size: 10px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.port-notice.error { color: var(--app-danger-text); }
.port-notice.warning { color: var(--app-warning-text); }
.port-notice.success { color: var(--app-success-text); }
.port-notice.info { color: var(--app-chip-text); }

.port-status-connected {
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--app-success-soft);
  color: var(--app-success-text);
  font-size: 10px;
  font-weight: 600;
}

.port-action-btn {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--app-chip-border);
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.port-action-btn:hover { background: var(--app-accent-strong); }

.port-action-btn.disconnect {
  border-color: var(--app-danger-border);
  background: var(--app-danger-soft);
  color: var(--app-danger-text);
}

.port-action-btn.disconnect:hover { background: color-mix(in srgb, var(--app-danger) 18%, transparent); }

.settings-section {
  margin: 0 10px 10px;
  padding: 2px 0 0;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-sidebar-soft);
}

.settings-header {
  justify-content: space-between;
  padding-bottom: 6px;
}

.settings-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.settings-summary {
  font-size: 10px;
  letter-spacing: normal;
  color: var(--app-text-soft);
}

.settings-toggle {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-text);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.settings-toggle:hover { background: var(--app-accent-soft); }

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
}

.auto-log-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item label {
  font-size: 10px;
  color: var(--app-text-soft);
  letter-spacing: 0.08em;
}

.setting-select {
  padding: 7px 9px;
  background: var(--app-workspace-soft);
  border: 1px solid var(--app-border);
  color-scheme: dark;
  color: var(--app-text);
  border-radius: 9px;
  font-size: 11px;
  cursor: pointer;
}

.setting-select option {
  background-color: var(--app-modal-bg);
  color: var(--app-text);
}

.setting-select option:checked,
.setting-select option:hover {
  background-color: var(--app-accent-soft);
  color: var(--app-text);
}

.setting-select:focus {
  outline: none;
  border-color: var(--app-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--app-text);
}

.check-row input {
  accent-color: var(--app-accent);
}

.auto-log-dir {
  gap: 6px;
}

.dir-path {
  padding: 7px 9px;
  border-radius: 9px;
  border: 1px solid var(--app-border);
  background: var(--app-workspace-soft);
  color: var(--app-text);
  font-size: 11px;
  line-height: 1.45;
  word-break: break-all;
}

.dir-actions {
  display: flex;
  gap: 8px;
}

.secondary-btn {
  flex: 1;
  padding: 7px 9px;
  border-radius: 9px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-text);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.secondary-btn:hover {
  background: var(--app-accent-soft);
}

.theme-light.sidebar-container {
  background: var(--app-sidebar-base, var(--app-surface-base, #ffffff));
}

.theme-light .sidebar-title,
.theme-light .ports-section,
.theme-light .settings-section {
  border-color: rgba(0, 102, 153, 0.12);
}

.theme-light .title-kicker,
.theme-light .section-header,
.theme-light .section-meta,
.theme-light .settings-summary,
.theme-light .port-meta,
.theme-light .setting-item label {
  color: #6b7785;
}

.theme-light .title-text,
.theme-light .port-path {
  color: #1f2328;
}

.theme-light .check-row {
  color: #1f2328;
}

.theme-light .ports-section,
.theme-light .settings-section {
  background: var(--app-sidebar-soft, var(--app-surface-soft, #ffffff));
}

.theme-light .refresh-btn,
.theme-light .settings-toggle,
.theme-light .setting-select,
.theme-light .port-action-btn,
.theme-light .secondary-btn,
.theme-light .dir-path {
  background: var(--app-sidebar-soft, var(--app-surface-soft, #ffffff));
  border-color: rgba(0, 102, 153, 0.12);
  color: #1f2328;
}

.theme-light .refresh-btn:hover,
.theme-light .settings-toggle:hover,
.theme-light .port-item:hover {
  background: rgba(0, 120, 212, 0.08);
}

.theme-light .port-item.selected {
  background: rgba(0, 120, 212, 0.1);
  border-color: rgba(0, 120, 212, 0.18);
}

.theme-light .port-icon {
  background: var(--app-text-soft);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--app-text-soft) 16%, transparent);
}

.theme-light .port-status-connected {
  background: rgba(82, 215, 166, 0.12);
  color: #177b57;
}

.theme-light .port-action-btn.disconnect {
  background: rgba(196, 43, 28, 0.08);
  color: #b2473d;
}

.theme-light .no-ports,
.theme-light .port-notice.info {
  color: #6b7785;
}

.theme-light .no-ports-icon {
  background: rgba(0, 120, 212, 0.08);
  color: #005fb8;
}

.theme-light .setting-select {
  color-scheme: light;
  color: var(--app-text);
  background: var(--app-workspace-soft);
}

.theme-light .setting-select option {
  background-color: var(--app-modal-bg);
  color: var(--app-text);
}

.theme-light .setting-select option:checked,
.theme-light .setting-select option:hover {
  background-color: var(--app-accent-soft);
  color: var(--app-text);
}

.theme-light .ports-list::-webkit-scrollbar-thumb {
  background: rgba(197, 216, 232, 0.9);
}
</style>
