<script setup>
import { ref, computed } from 'vue'
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
const showAdvancedOptions = ref(false)
const sendErrorMessage = ref('')
const sendSuccessMessage = ref('')
let sendFeedbackTimer = null

const portDisplaySettings = computed(() => serialStore.getPortDisplaySettings(props.portPath))
const portControlSettings = computed(() => serialStore.getPortControlSettings(props.portPath))
const portSettings = computed(() => serialStore.getPortSettings(props.portPath))
const portStats = computed(() => serialStore.getPortStats(props.portPath))
const portFilters = computed(() => serialStore.getPortFilters(props.portPath))
const isConnected = computed(() => serialStore.getPortStatus(props.portPath))
const portNotice = computed(() => serialStore.getPortNotice(props.portPath))
const enabledCommands = computed(() => serialStore.getEnabledCommands)
const isPaused = computed(() => serialStore.portLoopSendPaused.get(props.portPath) || false)
const loopSendCount = computed(() => serialStore.portLoopSendCounts.get(props.portPath) || 0)
const loopHasStarted = computed(() => loopSendCount.value > 0)
const connectionStatusText = computed(() => isConnected.value ? '已连接' : '未连接')

const loopActionLabel = computed(() => {
  if (!loopHasStarted.value) return '开始'
  return isPaused.value ? '继续' : '暂停'
})

const loopActionTitle = computed(() => {
  if (!loopHasStarted.value) return '开始循环发送'
  return isPaused.value ? '继续循环发送' : '暂停循环发送'
})

const loopActionClass = computed(() => {
  if (!loopHasStarted.value || isPaused.value) return 'loop-start-btn'
  return 'loop-pause-btn'
})

const isHexInputValid = computed(() => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!portControlSettings.value.hexSend || !data) return true
  return serialStore.isValidHex(data)
})

const isSendDisabled = computed(() => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!data) return true
  if (portControlSettings.value.hexSend) return !isHexInputValid.value
  return false
})

const toggleHexReceive = () => {
  serialStore.updatePortDisplaySettings(props.portPath, {
    hexReceive: !portDisplaySettings.value.hexReceive
  })
}

const toggleHexSend = () => {
  serialStore.updatePortControlSettings(props.portPath, {
    hexSend: !portControlSettings.value.hexSend
  })
}

const toggleShowAscii = () => {
  serialStore.updatePortDisplaySettings(props.portPath, {
    showAscii: !portDisplaySettings.value.showAscii
  })
}

const toggleAutoScroll = () => {
  serialStore.updatePortControlSettings(props.portPath, {
    isAutoScroll: !portControlSettings.value.isAutoScroll
  })
}

const toggleLoopSend = () => {
  if (portControlSettings.value.isLoopSend) {
    serialStore.stopLoopSendForPort(props.portPath)
  } else {
    serialStore.updatePortControlSettings(props.portPath, { isLoopSend: true })
    serialStore.addPortLog(props.portPath, '循环发送已启用，请点击“开始”按钮启动', 'info')
  }
}

const startLoopSend = () => {
  if (!serialStore.getPortSendingData(props.portPath)) {
    serialStore.setPortNotice(props.portPath, 'warning', '请先输入要发送的数据')
    serialStore.addPortLog(props.portPath, '请先输入要发送的数据', 'warning')
    return
  }
  if (!isConnected.value) {
    serialStore.setPortNotice(props.portPath, 'warning', '请先连接串口')
    serialStore.addPortLog(props.portPath, '请先连接串口', 'warning')
    return
  }
  serialStore.clearPortNotice(props.portPath)
  serialStore.startLoopSend(props.portPath)
}

const togglePauseLoopSend = () => {
  if (loopSendCount.value <= 0) {
    startLoopSend()
    return
  }

  if (isPaused.value) {
    serialStore.resumeLoopSendForPort(props.portPath)
  } else {
    serialStore.pauseLoopSendForPort(props.portPath)
  }
}

const updateLoopInterval = (value) => {
  serialStore.updatePortControlSettings(props.portPath, { loopInterval: Number(value) })
}

const updateLoopMaxCount = (value) => {
  serialStore.updatePortControlSettings(props.portPath, { loopMaxCount: Number(value) })
}

const updateLoopStartDelay = (value) => {
  serialStore.updatePortControlSettings(props.portPath, { loopStartDelay: Number(value) })
}

const updateLoopFailureLimit = (value) => {
  serialStore.updatePortControlSettings(props.portPath, { loopFailureLimit: Number(value) })
}

const updatePacketTimeout = (value) => {
  serialStore.updatePortControlSettings(props.portPath, { packetTimeout: Number(value) })
}

const executeCommand = (command) => {
  serialStore.setPortSendingData(props.portPath, command)
  sendErrorMessage.value = ''
  sendSuccessMessage.value = ''
  serialStore.clearPortNotice(props.portPath)
  serialStore.addPortLog(props.portPath, `命令 "${command}" 已填入输入框，请按 Enter 发送`, 'info')
}

const handleClearLogs = () => {
  serialStore.clearPortLogs(props.portPath)
}

const handlePanelFocus = () => {
  serialStore.selectedPort = props.portPath
}

const handleSendingInput = (value) => {
  serialStore.setPortSendingData(props.portPath, value)
  sendErrorMessage.value = ''
  sendSuccessMessage.value = ''
  serialStore.clearPortNotice(props.portPath)
}

const handleSend = async () => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!data) return

  const result = await serialStore.sendData(props.portPath, null, portControlSettings.value.hexSend)
  if (!result.success) {
    sendErrorMessage.value = result.error || '发送失败'
    sendSuccessMessage.value = ''
    serialStore.addPortLog(props.portPath, `发送失败：${sendErrorMessage.value}`, 'error')
    return
  }

  sendErrorMessage.value = ''
  sendSuccessMessage.value = '发送成功'
  serialStore.clearPortNotice(props.portPath)
  if (sendFeedbackTimer) {
    clearTimeout(sendFeedbackTimer)
  }
  sendFeedbackTimer = setTimeout(() => {
    sendSuccessMessage.value = ''
    sendFeedbackTimer = null
  }, 1600)
}

const handleSendingKeyDown = (event) => {
  if (event.key !== 'Enter') return

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    handleSend()
    return
  }

  if (!event.shiftKey && !event.altKey) {
    event.preventDefault()
    handleSend()
  }
}

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
    return '输入关键字，匹配的 RX 数据将被过滤...'
  }
  return '输入正则表达式，匹配的 RX 数据将被过滤...'
}

const resetStats = () => {
  serialStore.resetPortStats(props.portPath)
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const hexPlaceholder = '输入十六进制数据，例如：48 65 6C 6C 6F'
const textPlaceholder = '输入要发送的数据，按 Enter 或 Ctrl+Enter 发送...'
</script>

<template>
  <div class="serial-panel" @mousedown="handlePanelFocus">
    <div class="panel-header">
      <div class="panel-title">
        <span class="port-icon"></span>
        <div class="port-copy">
          <span class="port-path">{{ portPath }}</span>
          <span class="port-baud">{{ portSettings.baudRate }} baud · {{ connectionStatusText }}</span>
        </div>
        <span v-if="portControlSettings.isLoopSend" class="loop-send-status">
          <span class="loop-indicator" :class="{ paused: isPaused }"></span>
          <span class="loop-count">
            {{ loopSendCount }}{{ portControlSettings.loopMaxCount > 0 ? ` / ${portControlSettings.loopMaxCount}` : '' }}
            {{ isPaused ? ' · 已暂停' : '' }}
          </span>
        </span>
      </div>
      <div class="panel-actions">
        <div class="stats-display" @click="resetStats" title="点击重置统计">
          <span class="stats-line tx">TX {{ portStats.txCount }} / {{ formatBytes(portStats.txBytes) }}</span>
          <span class="stats-line rx">RX {{ portStats.rxCount }} / {{ formatBytes(portStats.rxBytes) }}</span>
        </div>
        <button @click="showFilters = !showFilters" class="action-btn filter" :class="{ active: showFilters }">
          {{ showFilters ? '隐藏过滤' : '显示过滤' }}
        </button>
        <button @click="handleClearLogs" class="action-btn">清空日志</button>
        <button @click="handleDisconnect" class="action-btn disconnect">断开</button>
      </div>
    </div>

    <div v-if="showFilters" class="filter-panel">
      <div class="filter-toolbar">
        <label class="option-checkbox">
          <input
            type="checkbox"
            :checked="portFilters.enabled"
            @change="setFilterEnabled($event.target.checked)"
          />
          <span class="option-text">启用过滤</span>
        </label>

        <div class="inline-group mode-summary" :class="{ disabled: !portFilters.enabled }">
          <span class="mode-text">过滤方式：丢弃匹配的 RX 数据</span>
        </div>

        <div class="inline-group" :class="{ disabled: !portFilters.enabled }">
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

        <div
          v-if="portDisplaySettings.hexReceive"
          class="inline-group"
          :class="{ disabled: !portFilters.enabled }"
        >
          <span class="target-label">过滤目标</span>
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-target"
              value="hexData"
              :checked="portFilters.filterTarget === 'hexData'"
              @change="setFilterTarget('hexData')"
              :disabled="!portFilters.enabled"
            />
            <span class="mode-text">Hex</span>
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
      </div>

      <div class="filter-search-row">
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
        <span v-if="portFilters.enabled">
          丢弃模式：匹配的 RX 数据会在接收时直接丢弃。
        </span>
        <span v-else>
          启用过滤后，接收数据会根据关键字或正则表达式进行筛选。
        </span>
      </div>
    </div>

    <TerminalDisplay ref="terminalRef" :port-path="portPath" />

    <div class="send-console">
      <div class="send-row">
        <input
          :value="serialStore.getPortSendingData(props.portPath)"
          @input="handleSendingInput($event.target.value)"
          type="text"
          class="send-input"
          :class="{ 'hex-invalid': portControlSettings.hexSend && !isHexInputValid, 'send-error': !!sendErrorMessage }"
          :placeholder="portControlSettings.hexSend ? hexPlaceholder : textPlaceholder"
          @keydown="handleSendingKeyDown"
        />
        <button @click="handleSend" class="send-button" :disabled="isSendDisabled">
          发送
        </button>
      </div>

      <div v-if="sendErrorMessage" class="send-feedback error">
        {{ sendErrorMessage }}
      </div>

      <div v-else-if="sendSuccessMessage" class="send-feedback success">
        {{ sendSuccessMessage }}
      </div>

      <div
        v-else-if="portNotice"
        :class="['send-feedback', 'notice', portNotice.type]"
      >
        {{ portNotice.message }}
      </div>

      <div class="send-options">
        <select
          v-if="enabledCommands.length > 0"
          @change="executeCommand($event.target.value); $event.target.value = ''"
          class="command-select"
          :disabled="!isConnected"
        >
          <option value="" disabled>快捷命令</option>
          <option v-for="cmd in enabledCommands" :key="cmd.id" :value="cmd.command">
            {{ cmd.name }} ({{ cmd.command }})
          </option>
        </select>

        <div class="option-chip-group">
          <label class="checkbox-label">
            <input type="checkbox" :checked="portControlSettings.isAutoScroll" @change="toggleAutoScroll" />
            <span class="option-text">自动滚动</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" :checked="portControlSettings.hexSend" @change="toggleHexSend" />
            <span class="option-text">HEX 发送</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" :checked="portDisplaySettings.hexReceive" @change="toggleHexReceive" />
            <span class="option-text">HEX 接收</span>
          </label>
          <label v-if="portDisplaySettings.hexReceive" class="checkbox-label">
            <input type="checkbox" :checked="portDisplaySettings.showAscii" @change="toggleShowAscii" />
            <span class="option-text">ASCII</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" :checked="portControlSettings.isLoopSend" @change="toggleLoopSend" />
            <span class="option-text">循环发送</span>
          </label>
        </div>

        <div v-if="portControlSettings.isLoopSend" class="loop-controls">
          <button @click="togglePauseLoopSend" :class="loopActionClass" :title="loopActionTitle">
            {{ loopActionLabel }}
          </button>
          <button
            v-if="loopSendCount > 0"
            @click="toggleLoopSend"
            class="loop-stop-btn"
            title="停止循环发送"
          >
            停止
          </button>

          <label class="interval-group">
            <span class="interval-label">间隔</span>
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

          <label class="interval-group">
            <span class="interval-label">次数</span>
            <input
              type="number"
              :value="portControlSettings.loopMaxCount"
              @input="updateLoopMaxCount($event.target.value)"
              :min="0"
              :step="1"
              class="interval-input"
            />
            <span class="interval-unit">{{ portControlSettings.loopMaxCount > 0 ? '次' : '不限' }}</span>
          </label>
        </div>

        <button
          class="advanced-toggle"
          :class="{ active: showAdvancedOptions }"
          @click="showAdvancedOptions = !showAdvancedOptions"
          :title="showAdvancedOptions ? '收起更多参数' : '展开更多参数'"
        >
          {{ showAdvancedOptions ? '收起参数' : '更多参数' }}
        </button>
      </div>

      <div v-if="showAdvancedOptions" class="advanced-options">
        <label v-if="portControlSettings.isLoopSend" class="interval-group packet-timeout">
          <span class="interval-label packet-label">启动延时</span>
          <input
            type="number"
            :value="portControlSettings.loopStartDelay"
            @input="updateLoopStartDelay($event.target.value)"
            :min="0"
            :step="100"
            class="interval-input"
            title="开始循环发送前先等待一段时间"
          />
          <span class="interval-unit">ms</span>
        </label>

        <label v-if="portControlSettings.isLoopSend" class="interval-group packet-timeout">
          <span class="interval-label packet-label">失败停止</span>
          <input
            type="number"
            :value="portControlSettings.loopFailureLimit"
            @input="updateLoopFailureLimit($event.target.value)"
            :min="0"
            :step="1"
            class="interval-input"
            title="连续发送失败达到该次数后自动停止，0 表示不限"
          />
          <span class="interval-unit">{{ portControlSettings.loopFailureLimit > 0 ? '次' : '不限' }}</span>
        </label>

        <label class="interval-group packet-timeout">
          <span class="interval-label packet-label">分包超时</span>
          <input
            type="number"
            :value="portControlSettings.packetTimeout"
            @input="updatePacketTimeout($event.target.value)"
            :min="100"
            :step="100"
            class="interval-input"
            title="超过该时间未收到后续数据时，将当前数据视为一个完整分包"
          />
          <span class="interval-unit">ms</span>
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
  background: rgba(7, 13, 18, 0.86);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(10, 19, 27, 0.52);
  border-bottom: 1px solid rgba(126, 161, 183, 0.12);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.port-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #57c7ff;
  box-shadow: 0 0 0 5px rgba(87, 199, 255, 0.14);
  flex-shrink: 0;
}

.port-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.port-path {
  font-size: 15px;
  font-weight: 700;
  color: #f4fbff;
}

.port-baud {
  font-size: 11px;
  color: #94adbf;
}

.loop-send-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  background: rgba(255, 183, 77, 0.08);
  border: 1px solid rgba(255, 183, 77, 0.18);
  border-radius: 999px;
}

.loop-indicator {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ffc266;
  box-shadow: 0 0 0 4px rgba(255, 194, 102, 0.16);
}

.loop-indicator.paused {
  background: #8c9eae;
  box-shadow: 0 0 0 4px rgba(140, 158, 174, 0.16);
}

.loop-count {
  font-size: 11px;
  font-weight: 600;
  color: #ffdca8;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.stats-display {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(126, 161, 183, 0.12);
  cursor: pointer;
  user-select: none;
}

.stats-line {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.stats-line.tx {
  color: #83ddff;
}

.stats-line.rx {
  color: #bce8a4;
}

.action-btn {
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.12);
  color: #d3e2ec;
  border-radius: 10px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.18s ease;
}

.action-btn:hover {
  background: rgba(87, 199, 255, 0.12);
  border-color: rgba(87, 199, 255, 0.18);
}

.action-btn.disconnect:hover {
  background: rgba(196, 43, 28, 0.18);
  border-color: rgba(196, 43, 28, 0.22);
}

.action-btn.filter.active {
  background: rgba(87, 199, 255, 0.18);
  border-color: rgba(87, 199, 255, 0.22);
  color: #f4fbff;
}

.filter-panel {
  padding: 10px 12px 12px;
  background: rgba(10, 19, 27, 0.4);
  border-bottom: 1px solid rgba(126, 161, 183, 0.12);
}

.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
}

.filter-search-row {
  margin-top: 12px;
}

.inline-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(126, 161, 183, 0.08);
}

.inline-group.disabled {
  opacity: 0.5;
}

.option-checkbox,
.mode-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #dce8f0;
}

.option-checkbox input,
.mode-radio input {
  accent-color: #57c7ff;
}

.option-text,
.mode-text,
.target-label {
  font-size: 12px;
  color: #dce8f0;
}

.pattern-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.12);
  color: #dce8f0;
  border-radius: 10px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.pattern-input:focus {
  outline: none;
  border-color: rgba(87, 199, 255, 0.22);
  box-shadow: 0 0 0 3px rgba(87, 199, 255, 0.1);
}

.pattern-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.filter-hint {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: #93acbf;
  font-size: 12px;
  line-height: 1.5;
}

.send-console {
  padding: 10px 12px 12px;
  background: rgba(10, 18, 25, 0.48);
  border-top: 1px solid rgba(126, 161, 183, 0.12);
  flex-shrink: 0;
}

.send-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.send-input {
  flex: 1;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.12);
  color: #ffffff;
  border-radius: 10px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.send-input.hex-invalid {
  border-color: rgba(196, 43, 28, 0.38);
  box-shadow: 0 0 0 3px rgba(196, 43, 28, 0.1);
}

.send-input.send-error {
  border-color: rgba(196, 43, 28, 0.32);
}

.send-input::placeholder {
  color: #698193;
}

.send-input:focus {
  outline: none;
  border-color: rgba(87, 199, 255, 0.24);
  box-shadow: 0 0 0 4px rgba(87, 199, 255, 0.1);
}

.send-button {
  padding: 10px 18px;
  background: #1495e1;
  border: 1px solid rgba(87, 199, 255, 0.12);
  border-radius: 10px;
  color: white;
  font-weight: 800;
  cursor: pointer;
  font-size: 13px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  box-shadow: none;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.send-button:disabled {
  background: rgba(255, 255, 255, 0.06);
  color: #688093;
  cursor: not-allowed;
  box-shadow: none;
}

.send-feedback {
  margin: -2px 0 8px;
  font-size: 11px;
  line-height: 1.4;
}

.send-feedback.error {
  color: #ffb8b1;
}

.send-feedback.success {
  color: #99f0c8;
}

.send-feedback.notice {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 1px;
}

.send-feedback.notice.error {
  color: #ffb8b1;
}

.send-feedback.notice.warning {
  color: #ffd18a;
}

.send-feedback.notice.success {
  color: #99f0c8;
}

.send-feedback.notice.info {
  color: #8ccdf3;
}

.send-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.advanced-options {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.command-select {
  padding: 9px 34px 9px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.12);
  border-radius: 10px;
  color-scheme: dark;
  color: #f4fbff;
  font-size: 12px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23d9ecff' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  min-width: 190px;
}

.command-select option {
  background-color: #0f1922;
  color: #e7f3fb;
}

.command-select option:checked,
.command-select option:hover {
  background-color: #173449;
  color: #ffffff;
}

.command-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-chip-group,
.loop-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.12);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type='checkbox'] {
  accent-color: #57c7ff;
  width: 12px;
  height: 12px;
  cursor: pointer;
}

.option-text {
  font-size: 11px;
  line-height: 1;
}

.loop-start-btn,
.loop-pause-btn,
.loop-stop-btn {
  padding: 8px 12px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.18s ease;
  font-weight: 600;
}

.loop-start-btn {
  background: rgba(87, 199, 255, 0.14);
  color: #bfe9ff;
  border-color: rgba(87, 199, 255, 0.18);
}

.loop-pause-btn {
  background: rgba(255, 183, 77, 0.14);
  color: #ffe1af;
  border-color: rgba(255, 183, 77, 0.18);
}

.loop-stop-btn {
  background: rgba(196, 43, 28, 0.14);
  color: #ffd5d1;
  border-color: rgba(196, 43, 28, 0.18);
}

.interval-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(126, 161, 183, 0.08);
  color: #dce8f0;
}

.packet-timeout {
  background: rgba(87, 199, 255, 0.04);
  border-color: rgba(87, 199, 255, 0.12);
  padding-right: 6px;
}

.advanced-toggle {
  margin-left: auto;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(126, 161, 183, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: #9fb6c7;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.18s ease;
}

.advanced-toggle:hover,
.advanced-toggle.active {
  background: rgba(255, 255, 255, 0.06);
  color: #dce8f0;
}

.packet-label {
  color: #a9c3d5;
  font-weight: 600;
}

.interval-label {
  color: #94adbf;
  font-size: 12px;
}

.interval-input {
  width: 62px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.12);
  color: #dce8f0;
  border-radius: 10px;
  font-size: 12px;
  text-align: center;
}

.interval-unit {
  color: #94adbf;
  font-size: 12px;
}
</style>
