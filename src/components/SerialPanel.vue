<script setup>
import { ref, computed, watch } from 'vue'
import { useSerialStore } from '../stores/serial'
import TerminalDisplay from './TerminalDisplay.vue'

const props = defineProps({
  portPath: {
    type: String,
    required: true
  }
})

const serialStore = useSerialStore()
const terminalRef = ref(null)
const showFilters = ref(false)

// 获取当前串口的显示设置
const portDisplaySettings = computed(() => {
  return serialStore.getPortDisplaySettings(props.portPath)
})

// 获取当前串口的控制设置
const portControlSettings = computed(() => {
  return serialStore.getPortControlSettings(props.portPath)
})

// Hex 接收模式切换
const toggleHexReceive = () => {
  serialStore.updatePortDisplaySettings(props.portPath, {
    hexReceive: !portDisplaySettings.value.hexReceive
  })
}

// Hex 发送模式切换
const toggleHexSend = () => {
  serialStore.updatePortControlSettings(props.portPath, {
    hexSend: !portControlSettings.value.hexSend
  })
}

// ASCII 显示切换
const toggleShowAscii = () => {
  serialStore.updatePortDisplaySettings(props.portPath, {
    showAscii: !portDisplaySettings.value.showAscii
  })
}

// 自动滚动切换
const toggleAutoScroll = () => {
  serialStore.updatePortControlSettings(props.portPath, {
    isAutoScroll: !portControlSettings.value.isAutoScroll
  })
}

// 循环发送切换 - 直接开始发送
const toggleLoopSend = () => {
  if (portControlSettings.value.isLoopSend) {
    // 停止循环发送
    serialStore.stopLoopSendForPort(props.portPath)
    serialStore.updatePortControlSettings(props.portPath, { isLoopSend: false })
    serialStore.addPortLog(props.portPath, '循环发送已停止', 'info')
  } else {
    // 开启循环发送并立即开始
    if (!serialStore.getPortSendingData(props.portPath)) {
      serialStore.addPortLog(props.portPath, '请先输入要发送的数据', 'warning')
      return
    }
    if (!isConnected.value) {
      serialStore.addPortLog(props.portPath, '请先连接串口', 'warning')
      return
    }
    serialStore.updatePortControlSettings(props.portPath, { isLoopSend: true })
    serialStore.startLoopSend(props.portPath)
  }
}

// 中止循环发送
const stopLoopSend = () => {
  serialStore.stopLoopSendForPort(props.portPath)
  serialStore.updatePortControlSettings(props.portPath, { isLoopSend: false })
  serialStore.addPortLog(props.portPath, '循环发送已中止', 'info')
}

// 获取当前串口的循环发送次数
const loopSendCount = computed(() => {
  return serialStore.portLoopSendCounts.get(props.portPath) || 0
})

// 更新循环间隔
const updateLoopInterval = (value) => {
  serialStore.updatePortControlSettings(props.portPath, { loopInterval: Number(value) })
}

// 更新循环次数
const updateLoopMaxCount = (value) => {
  serialStore.updatePortControlSettings(props.portPath, { loopMaxCount: Number(value) })
}

// 执行常用命令
const executeCommand = async (command) => {
  serialStore.setPortSendingData(props.portPath, command)
  await serialStore.sendData(props.portPath)
}

// 获取当前串口的设置和状态
const portSettings = computed(() => {
  return serialStore.getPortSettings(props.portPath)
})

const isConnected = computed(() => {
  return serialStore.getPortStatus(props.portPath)
})

// 获取当前串口的统计数据
const portStats = computed(() => {
  return serialStore.getPortStats(props.portPath)
})

// 获取当前串口的过滤器
const portFilters = computed(() => {
  return serialStore.getPortFilters(props.portPath)
})

// 获取当前串口的日志
const portLogs = computed(() => {
  return serialStore.getPortLogs(props.portPath)
})

const handleClearLogs = () => {
  serialStore.portLogs.set(props.portPath, [])
}

const handleSend = async () => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!data) return
  const result = await serialStore.sendData(props.portPath, null, portControlSettings.value.hexSend)
  if (!result.success) {
    console.error('发送失败:', result.error)
  }
}

// Hex 发送模式下验证输入是否有效
const isHexInputValid = computed(() => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!portControlSettings.value.hexSend || !data) return true
  return serialStore.isValidHex(data)
})

// 发送按钮是否禁用
const isSendDisabled = computed(() => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!data) return true
  if (portControlSettings.value.hexSend) return !isHexInputValid.value
  return false
})

// Hex 模式下的输入框占位符
const hexPlaceholder = '输入十六进制数据，如：48 65 6C 6C 6F 或 48656C6C6F'
const textPlaceholder = '输入要发送的数据，按 Enter 发送...'

const handleDisconnect = async () => {
  await serialStore.disconnect(props.portPath)
}

const setFilterEnabled = (enabled) => {
  serialStore.setPortFilters(props.portPath, { enabled })
}

const setFilterMode = (mode) => {
  serialStore.setPortFilters(props.portPath, { mode })
}

const setFilterMatchMode = (matchMode) => {
  serialStore.setPortFilters(props.portPath, { matchMode })
}

const setFilterPattern = (pattern) => {
  serialStore.setPortFilters(props.portPath, { pattern })
}

const setFilterTarget = (filterTarget) => {
  serialStore.setPortFilters(props.portPath, { filterTarget })
}

const getPatternPlaceholder = () => {
  if (!portFilters.value.enabled) return '启用后输入过滤条件...'
  if (portFilters.value.matchMode === 'keyword') {
    return '输入关键字，包含该关键字的数据将被过滤...'
  }
  return '输入正则表达式，匹配的数据将被过滤...'
}

// 重置统计数据
const resetStats = () => {
  serialStore.resetPortStats(props.portPath)
}

// 格式化字节数显示
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 获取已启用的命令
const enabledCommands = computed(() => {
  return serialStore.getEnabledCommands
})
</script>

<template>
  <div class="serial-panel">
    <!-- 面板标题栏 -->
    <div class="panel-header">
      <div class="panel-title">
        <span class="port-icon">📡</span>
        <span class="port-path">{{ portPath }}</span>
        <span class="port-baud">{{ portSettings.baudRate }} baud</span>
        <span :class="['connection-status', isConnected ? 'connected' : 'disconnected']">
          {{ isConnected ? '● 已连接' : '● 未连接' }}
        </span>
        <!-- 循环发送状态指示 -->
        <span v-if="portControlSettings.isLoopSend" class="loop-send-status">
          <span class="loop-indicator">🔁</span>
          <span class="loop-count">{{ loopSendCount }}{{ portControlSettings.loopMaxCount > 0 ? '/' + portControlSettings.loopMaxCount : '' }}</span>
        </span>
      </div>
      <div class="panel-actions">
        <!-- 统计数据 -->
        <div class="stats-display" @click="resetStats" title="点击重置统计">
          <span class="stats-tx" title="发送">TX: {{ portStats.txCount }}/{{ formatBytes(portStats.txBytes) }}</span>
          <span class="stats-rx" title="接收">RX: {{ portStats.rxCount }}/{{ formatBytes(portStats.rxBytes) }}</span>
        </div>
        <button @click="showFilters = !showFilters" class="action-btn filter" :class="{ active: showFilters }" title="数据过滤">
          <span>🔍</span>
        </button>
        <button @click="handleClearLogs" class="action-btn" title="清空日志">清空</button>
        <button @click="handleDisconnect" class="action-btn disconnect" title="断开连接">断开</button>
      </div>
    </div>

    <!-- 过滤器面板 -->
    <div v-if="showFilters" class="filter-panel">
      <div class="filter-row">
        <label class="option-checkbox">
          <input
            type="checkbox"
            :checked="portFilters.enabled"
            @change="setFilterEnabled($event.target.checked)"
          />
          <span class="option-text">启用</span>
        </label>

        <!-- 模式选择 -->
        <div class="mode-group" :class="{ disabled: !portFilters.enabled }">
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-mode"
              value="discard"
              :checked="portFilters.mode === 'discard'"
              @change="setFilterMode('discard')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text" title="匹配的数据在接收时直接丢弃">丢弃</span>
          </label>
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-mode"
              value="hide"
              :checked="portFilters.mode === 'hide'"
              @change="setFilterMode('hide')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text" title="匹配的数据已接收但隐藏显示">隐藏</span>
          </label>
        </div>

        <!-- 匹配模式 -->
        <div class="match-mode-group" :class="{ disabled: !portFilters.enabled }">
          <label class="mode-radio">
            <input
              type="radio"
              name="match-mode"
              value="keyword"
              :checked="portFilters.matchMode === 'keyword'"
              @change="setFilterMatchMode('keyword')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text">关键字</span>
          </label>
          <label class="mode-radio">
            <input
              type="radio"
              name="match-mode"
              value="regex"
              :checked="portFilters.matchMode === 'regex'"
              @change="setFilterMatchMode('regex')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text">正则</span>
          </label>
        </div>

        <!-- HEX 模式下的过滤目标 -->
        <div class="filter-target-group" v-if="portDisplaySettings.hexReceive" :class="{ disabled: !portFilters.enabled }">
          <span class="target-label">过滤目标:</span>
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-target"
              value="hexData"
              :checked="portFilters.filterTarget === 'hexData'"
              @change="setFilterTarget('hexData')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text">Hex 数据</span>
          </label>
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-target"
              value="asciiData"
              :checked="portFilters.filterTarget === 'asciiData'"
              @change="setFilterTarget('asciiData')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text">ASCII</span>
          </label>
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-target"
              value="both"
              :checked="portFilters.filterTarget === 'both' || !portFilters.filterTarget"
              @change="setFilterTarget('both')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text">两者</span>
          </label>
        </div>

        <input
          type="text"
          class="pattern-input"
          :placeholder="getPatternPlaceholder()"
          :value="portFilters.pattern"
          @input="setFilterPattern($event.target.value)"
          :disabled="!portFilters.enabled"
        />
      </div>
      <div class="filter-hint">
        <span v-if="portFilters.enabled && portFilters.mode === 'discard'">
          🔴 丢弃模式：匹配的数据会在接收时直接丢弃
        </span>
        <span v-else-if="portFilters.enabled && portFilters.mode === 'hide'">
          🟡 隐藏模式：匹配的数据已接收但隐藏显示
        </span>
        <span v-else>
          ℹ️ 启用过滤后，RX 数据会根据匹配规则进行过滤
        </span>
      </div>
    </div>

    <!-- 终端显示区 (xterm.js) -->
    <TerminalDisplay ref="terminalRef" :port-path="portPath" />

    <!-- 发送控制台 -->
    <div class="send-console">
      <div class="send-row">
        <span class="send-prefix">TX:</span>
        <input
          :value="serialStore.getPortSendingData(props.portPath)"
          @input="serialStore.setPortSendingData(props.portPath, $event.target.value)"
          type="text"
          class="send-input"
          :class="{ 'hex-invalid': portControlSettings.hexSend && !isHexInputValid }"
          :placeholder="portControlSettings.hexSend ? hexPlaceholder : textPlaceholder"
          @keyup.enter="handleSend"
        />
        <button @click="handleSend" class="send-button" :disabled="isSendDisabled">
          发送
        </button>
      </div>

      <div class="send-options">
        <!-- 常用命令下拉列表 -->
        <select
          v-if="enabledCommands.length > 0"
          @change="executeCommand($event.target.value); $event.target.value = ''"
          class="command-select"
          :disabled="!isConnected"
        >
          <option value="" disabled>⚡ 常用命令</option>
          <option
            v-for="cmd in enabledCommands"
            :key="cmd.id"
            :value="cmd.command"
          >
            {{ cmd.name }} ({{ cmd.command }})
          </option>
        </select>
        <div class="options-divider"></div>
        <label class="checkbox-label">
          <input type="checkbox" :checked="portControlSettings.isAutoScroll" @change="toggleAutoScroll" />
          <span class="option-text">自动滚动</span>
        </label>
        <!-- HEX 发送 -->
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="portControlSettings.hexSend"
            @change="toggleHexSend"
          />
          <span class="option-text" title="发送数据时使用 Hex 格式">HEX 发送</span>
        </label>
        <!-- HEX 接收 -->
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="portDisplaySettings.hexReceive"
            @change="toggleHexReceive"
          />
          <span class="option-text" title="接收数据时使用 Hex 格式显示">HEX 接收</span>
        </label>
        <!-- ASCII 转换显示 -->
        <label class="checkbox-label" v-if="portDisplaySettings.hexReceive">
          <input
            type="checkbox"
            :checked="portDisplaySettings.showAscii"
            @change="toggleShowAscii"
          />
          <span class="option-text">ASCII</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" :checked="portControlSettings.isLoopSend" @change="toggleLoopSend" />
          <span class="option-text">循环发送</span>
        </label>
        <!-- 循环发送中止按钮 -->
        <button
          v-if="portControlSettings.isLoopSend"
          @click="stopLoopSend"
          class="loop-stop-btn"
          title="中止循环发送"
        >
          ⏹ 中止
        </button>
        <label v-if="portControlSettings.isLoopSend" class="interval-group">
          <span class="interval-label">间隔:</span>
          <input
            type="number"
            :value="portControlSettings.loopInterval"
            @input="updateLoopInterval($event.target.value)"
            :min="100"
            :step="100"
            class="interval-input"
          />
          <span class="interval-unit">ms</span>
        </label>
        <label v-if="portControlSettings.isLoopSend" class="interval-group">
          <span class="interval-label">次数:</span>
          <input
            type="number"
            :value="portControlSettings.loopMaxCount"
            @input="updateLoopMaxCount($event.target.value)"
            :min="0"
            :step="1"
            class="interval-input"
            title="设置发送次数上限，0=无限"
          />
          <span class="interval-unit">{{ portControlSettings.loopMaxCount > 0 ? '次' : '∞' }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.serial-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: #1e1e1e;
  overflow: hidden;
}

/* 面板标题栏 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #cccccc;
}

.port-icon {
  font-size: 16px;
}

.port-path {
  font-weight: 600;
  color: #4ec9b0;
}

.port-baud {
  color: #858585;
  font-size: 12px;
}

.connection-status {
  font-size: 12px;
}

.connection-status.connected {
  color: #4ec9b0;
}

.connection-status.disconnected {
  color: #555;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 统计数据显示 */
.stats-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.stats-display:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

.stats-tx {
  font-size: 11px;
  color: #4ec9b0;
  font-weight: 600;
}

.stats-rx {
  font-size: 11px;
  color: #dcdcaa;
  font-weight: 600;
}

/* 循环发送状态指示 */
.loop-send-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 4px;
  animation: pulse 2s infinite;
}

.loop-indicator {
  font-size: 14px;
  animation: spin 1s linear infinite;
}

.loop-indicator.paused {
  animation: none;
  color: #d97706;
}

.loop-count {
  font-size: 11px;
  color: #667eea;
  font-weight: 600;
  font-family: 'Consolas', monospace;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #cccccc;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  accent-color: #007acc;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.action-btn {
  padding: 4px 12px;
  background-color: #3c3c3c;
  border: 1px solid #555;
  color: #cccccc;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.action-btn:hover {
  background-color: #4a4a4a;
  border-color: #007acc;
}

.action-btn.disconnect:hover {
  background-color: #c42b1c;
  border-color: #a02015;
}

.action-btn.filter {
  padding: 4px 10px;
}

.action-btn.filter.active {
  background-color: #007acc;
  border-color: #007acc;
  color: #ffffff;
}

/* 过滤器面板 */
.filter-panel {
  padding: 8px 16px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.mode-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-group.disabled {
  opacity: 0.5;
}

.mode-radio {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.mode-radio input[type="radio"] {
  accent-color: #007acc;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.mode-radio input[type="radio"]:disabled {
  cursor: not-allowed;
}

.mode-text {
  font-size: 12px;
  color: #cccccc;
  white-space: nowrap;
}

.pattern-input {
  flex: 1;
  padding: 4px 8px;
  background-color: #1e1e1e;
  border: 1px solid #3e3e42;
  color: #cccccc;
  border-radius: 3px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.pattern-input:focus {
  outline: none;
  border-color: #007acc;
}

.pattern-input:disabled {
  background-color: #1e1e1e;
  border-color: #3e3e42;
  color: #555;
  cursor: not-allowed;
}

.match-mode-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.match-mode-group.disabled {
  opacity: 0.5;
}

/* HEX 模式下的过滤目标选择 */
.filter-target-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-target-group.disabled {
  opacity: 0.5;
}

.target-label {
  font-size: 12px;
  color: #858585;
  white-space: nowrap;
}

.filter-hint {
  font-size: 11px;
  color: #858585;
  padding-top: 4px;
  border-top: 1px solid #3e3e42;
}

/* 发送控制台 */
.send-console {
  padding: 10px 16px;
  background-color: #252526;
  border-top: 1px solid #3e3e42;
  flex-shrink: 0;
}

.send-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid #3e3e42;
}

.options-divider {
  width: 1px;
  height: 20px;
  background-color: #3e3e42;
  margin: 0 4px;
}

/* 常用命令下拉列表 */
.command-select {
  padding: 6px 28px 6px 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  font-family: inherit;
  min-width: 180px;
}

.command-select:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.command-select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.command-select:disabled {
  background: #3e3e42;
  border-color: #555;
  color: #666;
  cursor: not-allowed;
}

.command-select option {
  background: #2d2d30;
  color: #ffffff;
}

.send-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.send-prefix {
  font-size: 13px;
  font-weight: 600;
  color: #4ec9b0;
  min-width: 30px;
}

.send-input {
  flex: 1;
  padding: 8px 12px;
  background-color: #1e1e1e;
  border: 1px solid #3e3e42;
  color: #ffffff;
  border-radius: 3px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: border-color 0.2s;
}

.send-input.hex-invalid {
  border-color: #c42b1c;
  animation: shake 0.3s;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.send-input::placeholder {
  color: #6a6a6a;
}

.send-input:focus {
  outline: none;
  border-color: #007acc;
}

.send-button {
  padding: 8px 24px;
  background-color: #0e639c;
  border: 1px solid #0b4f7a;
  border-radius: 3px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.15s;
}

.send-button:hover:not(:disabled) {
  background-color: #1177bb;
}

.send-button:disabled {
  background-color: #3e3e42;
  color: #555;
  cursor: not-allowed;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.checkbox-label input[type="checkbox"] {
  accent-color: #007acc;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

/* 循环发送中止按钮 */
.loop-stop-btn {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 3px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
  background-color: #c42b1c;
  color: white;
  border-color: #a02015;
}

.loop-stop-btn:hover {
  background-color: #d63a2a;
}

.option-text {
  font-size: 12px;
  color: #cccccc;
}

.interval-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #cccccc;
}

.interval-label {
  color: #858585;
}

.interval-input {
  width: 60px;
  padding: 4px 8px;
  background-color: #3c3c3c;
  border: 1px solid #555;
  color: #cccccc;
  border-radius: 3px;
  font-size: 12px;
}

.interval-unit {
  color: #858585;
  font-size: 12px;
}
</style>
