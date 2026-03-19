<script setup>
import { computed } from 'vue'
import { useSerialStore } from '../stores/serial'

const serialStore = useSerialStore()

// 获取已打开的串口列表
const openedPorts = computed(() => {
  return Array.from(serialStore.openPorts.entries())
    .filter(([_, data]) => data.isConnected)
    .map(([path, data]) => ({ path, ...data }))
})

const handleConnect = async (portPath = null) => {
  const targetPort = portPath || serialStore.selectedPort

  if (!targetPort) {
    serialStore.addLog('请选择串口', 'error')
    return
  }

  // 检查是否已连接
  const isConnected = serialStore.getPortStatus(targetPort)
  if (isConnected) {
    await serialStore.disconnect(targetPort)
    return
  }

  const settings = {
    ...serialStore.defaultSettings,
    path: targetPort
  }
  await serialStore.connect(targetPort, settings)
}

const handleRefresh = async () => {
  await serialStore.refreshPorts()
}
</script>

<template>
  <div class="sidebar-container">
    <!-- 侧边栏标题 -->
    <div class="sidebar-title">
      <span class="title-icon">🔌</span>
      <span class="title-text">串口设备</span>
    </div>

    <!-- 已连接的串口列表 -->
    <div v-if="openedPorts.length > 0" class="connected-section">
      <div class="section-header">已打开的串口</div>
      <div class="connected-list">
        <div v-for="port in openedPorts" :key="port.path" class="connected-item">
          <div class="item-info">
            <span class="item-path">{{ port.path }}</span>
            <span class="item-baud">{{ port.baudRate }} baud</span>
          </div>
          <button @click="handleConnect(port.path)" class="item-close" title="断开">
            ✕
          </button>
        </div>
      </div>
    </div>

    <!-- 可用串口列表 -->
    <div class="ports-section">
      <div class="section-header">
        <span>可用串口</span>
        <button @click="handleRefresh" class="refresh-btn" title="刷新">
          ↻
        </button>
      </div>
      <div class="ports-list">
        <div v-if="serialStore.ports.length === 0" class="no-ports">
          未找到串口设备
        </div>
        <div
          v-for="port in serialStore.ports"
          :key="port.path"
          :class="['port-item', { selected: serialStore.selectedPort === port.path }]"
          @click="serialStore.selectedPort = port.path"
          @dblclick="handleConnect(port.path)"
        >
          <span class="port-icon">🔌</span>
          <span class="port-path">{{ port.path }}</span>
          <span v-if="serialStore.getPortStatus(port.path)" class="port-status-connected">●</span>
        </div>
      </div>
    </div>

    <!-- 连接按钮 -->
    <div class="connect-section">
      <button
        @click="handleConnect()"
        :class="['connect-btn', serialStore.getPortStatus(serialStore.selectedPort) ? 'connected' : 'disconnected']"
        :disabled="!serialStore.selectedPort && !isSimulationMode"
      >
        {{ serialStore.getPortStatus(serialStore.selectedPort) ? '断开连接' : '连接串口' }}
      </button>
    </div>

    <!-- 串口设置 -->
    <div class="settings-section">
      <div class="section-header">串口设置</div>
      <div class="settings-grid">
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
          <label>校验</label>
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
}

/* 侧边栏标题 */
.sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.title-icon {
  font-size: 16px;
}

.title-text {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 模拟模式开关 */
.simulation-toggle {
  padding: 10px 14px;
  border-bottom: 1px solid #3e3e42;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  accent-color: #4ec9b0;
  width: 16px;
  height: 16px;
}

.toggle-text {
  font-size: 13px;
  color: #4ec9b0;
}

/* 已连接的串口 */
.connected-section {
  border-bottom: 1px solid #3e3e42;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #858585;
  text-transform: uppercase;
}

.refresh-btn {
  background: none;
  border: none;
  color: #858585;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
}

.refresh-btn:hover {
  background-color: #3e3e42;
  color: #ffffff;
}

.connected-list {
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.connected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background-color: #1e1e1e;
  border-radius: 3px;
  border-left: 3px solid #4ec9b0;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-path {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.item-baud {
  font-size: 11px;
  color: #858585;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.item-send {
  background: none;
  border: none;
  color: #4ec9b0;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 3px;
  line-height: 1;
}

.item-send:hover:not(:disabled) {
  background-color: #0e639c;
  color: #ffffff;
}

.item-send:disabled {
  color: #555;
  cursor: not-allowed;
}

.item-close {
  background: none;
  border: none;
  color: #858585;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 3px;
  line-height: 1;
}

.item-close:hover {
  background-color: #c42b1c;
  color: #ffffff;
}

/* 可用串口列表 */
.ports-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #3e3e42;
}

.ports-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.no-ports {
  padding: 20px 10px;
  text-align: center;
  color: #858585;
  font-size: 13px;
}

.port-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.port-item:hover {
  background-color: #2a2d2e;
}

.port-item.selected {
  background-color: #37373d;
}

.port-icon {
  font-size: 14px;
}

.port-path {
  flex: 1;
  font-size: 13px;
  color: #cccccc;
}

.port-status {
  font-size: 11px;
  color: #4ec9b0;
  padding: 2px 6px;
  background-color: #4ec9b033;
  border-radius: 3px;
}

.port-status-connected {
  font-size: 12px;
  color: #4ec9b0;
}

/* 连接按钮 */
.connect-section {
  padding: 10px 14px;
  border-bottom: 1px solid #3e3e42;
}

.connect-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 3px;
  color: white;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.connect-btn.connected {
  background-color: #c42b1c;
}

.connect-btn.connected:hover {
  background-color: #d43b2c;
}

.connect-btn.disconnected {
  background-color: #0e639c;
}

.connect-btn.disconnected:hover {
  background-color: #1177bb;
}

.connect-btn:disabled {
  background-color: #3e3e42;
  color: #555;
  cursor: not-allowed;
}

/* 串口设置 */
.settings-section {
  padding: 10px 14px;
  background-color: #252526;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item label {
  font-size: 11px;
  color: #858585;
  text-transform: uppercase;
}

.setting-select {
  padding: 6px 8px;
  background-color: #3c3c3c;
  border: 1px solid #555;
  color: #cccccc;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
}

.setting-select:focus {
  outline: none;
  border-color: #007acc;
}
</style>
