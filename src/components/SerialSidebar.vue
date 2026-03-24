<script setup>
import { computed, ref } from 'vue'
import { useSerialStore } from '../stores/serial'

const serialStore = useSerialStore()
const showSettings = ref(false)
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
  </div>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(87, 199, 255, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(14, 25, 35, 0.96), rgba(9, 18, 25, 0.98));
}

.sidebar-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(132, 169, 193, 0.12);
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
  color: #88a8bd;
}

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: #f4fbff;
}

.section-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #93acbf;
  letter-spacing: 0.08em;
}

.section-meta {
  color: #6f889a;
}

.ports-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 8px 10px 10px;
  border-radius: 12px;
  border: 1px solid rgba(132, 169, 193, 0.08);
  background: rgba(8, 17, 24, 0.42);
}

.refresh-btn {
  margin-left: auto;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(126, 161, 183, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: #a9c0d0;
  cursor: pointer;
  transition: all 0.18s ease;
  font-size: 11px;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

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
  background: rgba(126, 161, 183, 0.22);
  border-radius: 999px;
}

.no-ports {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 12px;
  text-align: center;
  color: #7f99ac;
  font-size: 13px;
}

.no-ports-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: #b5c8d5;
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
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.04);
}

.port-item.selected {
  background: rgba(87, 199, 255, 0.08);
  border-color: rgba(87, 199, 255, 0.18);
}

.port-item.selected::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 999px;
  background: #57c7ff;
}

.port-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #5d7586;
  box-shadow: 0 0 0 5px rgba(93, 117, 134, 0.14);
  flex-shrink: 0;
}

.port-icon.active {
  background: #52d7a6;
  box-shadow: 0 0 0 5px rgba(82, 215, 166, 0.14);
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
  color: #dfeaf2;
}

.port-meta {
  font-size: 11px;
  color: #8099ab;
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

.port-notice.error {
  color: #ffb8b1;
}

.port-notice.warning {
  color: #ffd18a;
}

.port-notice.success {
  color: #99f0c8;
}

.port-notice.info {
  color: #8ccdf3;
}

.port-status-connected {
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(82, 215, 166, 0.12);
  color: #8df4ca;
  font-size: 10px;
  font-weight: 600;
}

.port-action-btn {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(87, 199, 255, 0.16);
  background: rgba(87, 199, 255, 0.08);
  color: #bfe9ff;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.port-action-btn:hover {
  background: rgba(87, 199, 255, 0.16);
}

.port-action-btn.disconnect {
  border-color: rgba(196, 43, 28, 0.16);
  background: rgba(196, 43, 28, 0.08);
  color: #ffccc6;
}

.port-action-btn.disconnect:hover {
  background: rgba(196, 43, 28, 0.16);
}

.settings-section {
  margin: 0 10px 10px;
  padding: 2px 0 0;
  border-radius: 12px;
  border: 1px solid rgba(132, 169, 193, 0.08);
  background: rgba(8, 17, 24, 0.38);
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
  color: #6f889a;
}

.settings-toggle {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(126, 161, 183, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: #a9c0d0;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.settings-toggle:hover {
  background: rgba(255, 255, 255, 0.06);
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item label {
  font-size: 10px;
  color: #8ea6b8;
  letter-spacing: 0.08em;
}

.setting-select {
  padding: 7px 9px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(132, 169, 193, 0.1);
  color-scheme: dark;
  color: #dbe8f1;
  border-radius: 9px;
  font-size: 11px;
  cursor: pointer;
}

.setting-select option {
  background-color: #0f1922;
  color: #e7f3fb;
}

.setting-select option:checked,
.setting-select option:hover {
  background-color: #173449;
  color: #ffffff;
}

.setting-select:focus {
  outline: none;
  border-color: rgba(87, 199, 255, 0.28);
  box-shadow: 0 0 0 3px rgba(87, 199, 255, 0.12);
}

.theme-light.sidebar-container {
  background: #ffffff;
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

.theme-light .ports-section,
.theme-light .settings-section {
  background: #ffffff;
}

.theme-light .refresh-btn,
.theme-light .settings-toggle,
.theme-light .setting-select,
.theme-light .port-action-btn {
  background: #ffffff;
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
  background: #5c6b77;
  box-shadow: 0 0 0 5px rgba(92, 107, 119, 0.12);
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
  color: #1f2328;
  background: #ffffff;
}

.theme-light .setting-select option {
  background-color: #ffffff;
  color: #1f2328;
}

.theme-light .setting-select option:checked,
.theme-light .setting-select option:hover {
  background-color: #e8f3ff;
  color: #1f2328;
}

.theme-light .ports-list::-webkit-scrollbar-thumb {
  background: rgba(197, 216, 232, 0.9);
}
</style>
