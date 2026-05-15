<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
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
const sendHistoryIndex = ref(-1)
const sendHistoryDraft = ref('')
const sendingInput = ref('')
let sendFeedbackTimer = null
let sendInputSyncTimer = null

const portDisplaySettings = computed(() => serialStore.getPortDisplaySettings(props.portPath))
const portControlSettings = computed(() => serialStore.getPortControlSettings(props.portPath))
const portSettings = computed(() => serialStore.getPortSettings(props.portPath))
const portStats = computed(() => serialStore.getPortStats(props.portPath))
const portFilters = computed(() => serialStore.getPortFilters(props.portPath))
const isConnected = computed(() => serialStore.getPortStatus(props.portPath))
const portNotice = computed(() => serialStore.getPortNotice(props.portPath))
const currentSendingData = computed(() => serialStore.getPortSendingData(props.portPath))
const themeMode = computed(() => serialStore.appUiState?.themeMode || 'dark')
const enabledCommands = computed(() => serialStore.getEnabledCommands)
const sendHistory = computed(() => serialStore.getPortSendHistory(props.portPath))
const groupedEnabledCommands = computed(() => {
  const groups = new Map()
  enabledCommands.value.forEach((cmd) => {
    const key = cmd.group || '默认'
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(cmd)
  })
  return Array.from(groups.entries()).map(([group, commands]) => ({ group, commands }))
})
const isPaused = computed(() => serialStore.portLoopSendPaused.get(props.portPath) || false)
const loopSendCount = computed(() => serialStore.portLoopSendCounts.get(props.portPath) || 0)
const loopHasStarted = computed(() => loopSendCount.value > 0)
const connectionStatusText = computed(() => (isConnected.value ? '已连接' : '未连接'))

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
  const data = sendingInput.value
  if (!portControlSettings.value.hexSend || !data) return true
  return serialStore.isValidHex(data)
})

const isSendDisabled = computed(() => {
  const data = sendingInput.value
  if (!data) return true
  if (portControlSettings.value.hexSend) return !isHexInputValid.value
  return false
})

const sendStatusTone = computed(() => {
  if (!portControlSettings.value.isLoopSend) return 'idle'
  if (isPaused.value) return 'paused'
  if (loopSendCount.value > 0) return 'running'
  return 'ready'
})

const sendStatusSummary = computed(() => {
  const summary = []

  if (portControlSettings.value.isLoopSend) {
    summary.push('循环发送')
    summary.push(isPaused.value ? '已暂停' : loopSendCount.value > 0 ? '运行中' : '待启动')
    summary.push(
      loopSendCount.value > 0
        ? `第 ${loopSendCount.value}${portControlSettings.value.loopMaxCount > 0 ? ` / ${portControlSettings.value.loopMaxCount}` : ''} 次`
        : `间隔 ${portControlSettings.value.loopInterval} ms`
    )

    if (!loopHasStarted.value && portControlSettings.value.loopStartDelay > 0) {
      summary.push(`启动延时 ${portControlSettings.value.loopStartDelay} ms`)
    }

    summary.push(
      portControlSettings.value.loopFailureLimit > 0
        ? `失败停发 ${portControlSettings.value.loopFailureLimit} 次`
        : '失败停发 不限'
    )
  } else {
    summary.push('循环发送未启用')
  }

  if (sendHistory.value.length > 0) {
    summary.push(`历史 ${sendHistory.value.length} 条`)
  }

  summary.push(`分包 ${portControlSettings.value.packetTimeout} ms`)

  return summary.join(' · ')
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

const toggleAlignHexContinuation = () => {
  serialStore.updatePortDisplaySettings(props.portPath, {
    alignHexContinuation: !portDisplaySettings.value.alignHexContinuation
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
    serialStore.addPortLog(props.portPath, '循环发送已启用，请点击“开始”按钮启动。', 'info')
  }
}

const startLoopSend = () => {
  if (!sendingInput.value) {
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
  serialStore.updatePortControlSettings(props.portPath, { loopInterval: Math.max(1, Number(value) || 1) })
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
  sendingInput.value = command
  serialStore.setPortSendingData(props.portPath, command)
  sendErrorMessage.value = ''
  sendSuccessMessage.value = ''
  serialStore.clearPortNotice(props.portPath)
  serialStore.addPortLog(props.portPath, `命令 "${command}" 已填入输入框，请按 Enter 发送。`, 'info')
}

const applyHistoryItem = (value, event = null) => {
  if (!value) return
  sendingInput.value = value
  serialStore.setPortSendingData(props.portPath, value)
  sendErrorMessage.value = ''
  sendSuccessMessage.value = ''
  serialStore.clearPortNotice(props.portPath)
  sendHistoryIndex.value = -1
  sendHistoryDraft.value = ''

  if (event?.target) {
    event.target.value = ''
  }
}

const deleteRecentSendHistory = () => {
  const [latestHistoryItem] = sendHistory.value
  if (!latestHistoryItem) return
  serialStore.removePortSendHistoryItem(props.portPath, latestHistoryItem)
}

const clearSendHistory = () => {
  if (!sendHistory.value.length) return
  serialStore.clearPortSendHistory(props.portPath)
}

const handleClearLogs = () => {
  serialStore.clearPortLogs(props.portPath)
}

const handlePanelFocus = () => {
  serialStore.selectedPort = props.portPath
}

const flushSendingInput = () => {
  if (sendInputSyncTimer) {
    clearTimeout(sendInputSyncTimer)
    sendInputSyncTimer = null
  }

  if (serialStore.getPortSendingData(props.portPath) !== sendingInput.value) {
    serialStore.setPortSendingData(props.portPath, sendingInput.value)
  }
}

const handleSendingInput = (value) => {
  sendingInput.value = value
  sendErrorMessage.value = ''
  sendSuccessMessage.value = ''
  serialStore.clearPortNotice(props.portPath)
  if (sendHistoryIndex.value !== -1) {
    sendHistoryIndex.value = -1
    sendHistoryDraft.value = value
  }

  if (sendInputSyncTimer) {
    clearTimeout(sendInputSyncTimer)
  }

  sendInputSyncTimer = setTimeout(() => {
    flushSendingInput()
  }, 140)
}

const navigateSendHistory = (direction) => {
  const history = sendHistory.value
  if (!history.length) return

  if (direction === 'up') {
    if (sendHistoryIndex.value === -1) {
      sendHistoryDraft.value = sendingInput.value
      sendHistoryIndex.value = 0
    } else {
      sendHistoryIndex.value = Math.min(sendHistoryIndex.value + 1, history.length - 1)
    }

    sendingInput.value = history[sendHistoryIndex.value] || ''
    flushSendingInput()
    return
  }

  if (direction === 'down' && sendHistoryIndex.value !== -1) {
    if (sendHistoryIndex.value === 0) {
      sendHistoryIndex.value = -1
      sendingInput.value = sendHistoryDraft.value
      flushSendingInput()
      return
    }

    sendHistoryIndex.value = Math.max(sendHistoryIndex.value - 1, 0)
    sendingInput.value = history[sendHistoryIndex.value] || ''
    flushSendingInput()
  }
}

const handleSend = async () => {
  const data = sendingInput.value
  if (!data) return

  flushSendingInput()
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

  sendHistoryIndex.value = -1
  sendHistoryDraft.value = ''
}

const handleSendingKeyDown = (event) => {
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'ArrowUp') {
    event.preventDefault()
    navigateSendHistory('up')
    return
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'ArrowDown') {
    event.preventDefault()
    navigateSendHistory('down')
    return
  }

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

const handleConnectionToggle = async () => {
  if (isConnected.value) {
    await serialStore.disconnect(props.portPath)
    return
  }

  await serialStore.connect(props.portPath, {
    ...portSettings.value,
    path: props.portPath
  })
}

const setFilterEnabled = (enabled) => {
  serialStore.setPortFilters(props.portPath, { enabled })
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
const textPlaceholder = '输入要发送的数据，按 Enter 发送，↑↓ 浏览最近发送...'

watch(currentSendingData, (value) => {
  if (value !== sendingInput.value) {
    sendingInput.value = value
  }
}, { immediate: true })

onUnmounted(() => {
  if (sendFeedbackTimer) {
    clearTimeout(sendFeedbackTimer)
    sendFeedbackTimer = null
  }
  if (sendInputSyncTimer) {
    clearTimeout(sendInputSyncTimer)
    sendInputSyncTimer = null
  }
})
</script>

<template>
  <div :class="['serial-panel', `theme-${themeMode}`]" @mousedown="handlePanelFocus">
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
        <div class="stats-display" title="点击重置统计" @click="resetStats">
          <span class="stats-line tx">TX {{ portStats.txCount }} / {{ formatBytes(portStats.txBytes) }}</span>
          <span class="stats-line rx">RX {{ portStats.rxCount }} / {{ formatBytes(portStats.rxBytes) }}</span>
        </div>
        <button class="action-btn filter" :class="{ active: showFilters }" @click="showFilters = !showFilters">
          {{ showFilters ? '隐藏过滤' : '显示过滤' }}
        </button>
        <button class="action-btn" @click="handleClearLogs">清空日志</button>
        <button class="action-btn" :class="{ disconnect: isConnected }" @click="handleConnectionToggle">
          {{ isConnected ? '断开' : '连接' }}
        </button>
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
              :disabled="!portFilters.enabled"
              @change="setFilterMatchMode('keyword')"
            />
            <span class="mode-text">关键字</span>
          </label>
          <label class="mode-radio">
            <input
              type="radio"
              name="match-mode"
              value="regex"
              :checked="portFilters.matchMode === 'regex'"
              :disabled="!portFilters.enabled"
              @change="setFilterMatchMode('regex')"
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
              :disabled="!portFilters.enabled"
              @change="setFilterTarget('hexData')"
            />
            <span class="mode-text">Hex</span>
          </label>
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-target"
              value="asciiData"
              :checked="portFilters.filterTarget === 'asciiData'"
              :disabled="!portFilters.enabled"
              @change="setFilterTarget('asciiData')"
            />
            <span class="mode-text">ASCII</span>
          </label>
          <label class="mode-radio">
            <input
              type="radio"
              name="filter-target"
              value="both"
              :checked="portFilters.filterTarget === 'both' || !portFilters.filterTarget"
              :disabled="!portFilters.enabled"
              @change="setFilterTarget('both')"
            />
            <span class="mode-text">两者</span>
          </label>
        </div>
      </div>

      <div class="filter-search-row">
        <input
          type="text"
          class="pattern-input"
          :value="portFilters.pattern"
          :placeholder="getPatternPlaceholder()"
          :disabled="!portFilters.enabled"
          @input="setFilterPattern($event.target.value)"
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
          :value="sendingInput"
          type="text"
          class="send-input"
          :class="{ 'hex-invalid': portControlSettings.hexSend && !isHexInputValid, 'send-error': !!sendErrorMessage }"
          :placeholder="portControlSettings.hexSend ? hexPlaceholder : textPlaceholder"
          @input="handleSendingInput($event.target.value)"
          @keydown="handleSendingKeyDown"
          @blur="flushSendingInput"
        />
        <button class="send-button" :disabled="isSendDisabled" @click="handleSend">
          发送
        </button>
      </div>

      <div class="send-options">
        <div v-if="sendHistory.length > 0" class="history-actions">
          <select
            class="command-select history-select"
            :disabled="!isConnected"
            title="选择最近发送内容填入输入框；输入框内也可用 ↑/↓ 浏览历史"
            @change="applyHistoryItem($event.target.value, $event)"
          >
            <option value="" selected>最近发送</option>
            <option v-for="item in sendHistory" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
          <button
            class="history-action-btn"
            :disabled="!sendHistory.length"
            title="删除最近一条发送历史"
            @click="deleteRecentSendHistory"
          >
            删除最近
          </button>
          <button
            class="history-action-btn danger"
            :disabled="!sendHistory.length"
            title="清空当前串口的发送历史"
            @click="clearSendHistory"
          >
            清空历史
          </button>
        </div>

        <select
          v-if="enabledCommands.length > 0"
          class="command-select"
          :disabled="!isConnected"
          @change="executeCommand($event.target.value); $event.target.value = ''"
        >
          <option value="" disabled>快捷命令</option>
          <optgroup v-for="groupBlock in groupedEnabledCommands" :key="groupBlock.group" :label="groupBlock.group">
            <option v-for="cmd in groupBlock.commands" :key="cmd.id" :value="cmd.command">
              {{ cmd.name }} ({{ cmd.command }})
            </option>
          </optgroup>
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
          <label v-if="portDisplaySettings.hexReceive" class="checkbox-label">
            <input
              type="checkbox"
              :checked="portDisplaySettings.alignHexContinuation"
              @change="toggleAlignHexContinuation"
            />
            <span class="option-text">对齐续行</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" :checked="portControlSettings.isLoopSend" @change="toggleLoopSend" />
            <span class="option-text">循环发送</span>
          </label>
        </div>

        <div v-if="portControlSettings.isLoopSend" class="loop-controls">
          <button :class="loopActionClass" :title="loopActionTitle" @click="togglePauseLoopSend">
            {{ loopActionLabel }}
          </button>
          <button
            v-if="loopSendCount > 0"
            class="loop-stop-btn"
            title="停止循环发送"
            @click="toggleLoopSend"
          >
            停止
          </button>

          <label class="interval-group">
            <span class="interval-label">间隔</span>
            <input
              type="number"
              class="interval-input"
              :value="portControlSettings.loopInterval"
              :min="1"
              :step="1"
              title="循环发送允许设置到 1ms，但实际触发精度仍取决于系统定时器、系统调度与当前负载"
              @input="updateLoopInterval($event.target.value)"
            />
            <span class="interval-unit">ms</span>
          </label>

          <label class="interval-group">
            <span class="interval-label">次数</span>
            <input
              type="number"
              class="interval-input"
              :value="portControlSettings.loopMaxCount"
              :min="0"
              :step="1"
              @input="updateLoopMaxCount($event.target.value)"
            />
            <span class="interval-unit">{{ portControlSettings.loopMaxCount > 0 ? '次' : '不限' }}</span>
          </label>
        </div>

        <div class="send-status-summary" :class="sendStatusTone">
          <span class="send-status-label">发送状态</span>
          <span class="send-status-value">{{ sendStatusSummary }}</span>
        </div>

        <button
          class="advanced-toggle"
          :class="{ active: showAdvancedOptions }"
          :title="showAdvancedOptions ? '收起更多参数' : '展开更多参数'"
          @click="showAdvancedOptions = !showAdvancedOptions"
        >
          {{ showAdvancedOptions ? '收起参数' : '更多参数' }}
        </button>
      </div>

      <div v-if="showAdvancedOptions" class="advanced-options">
        <label class="interval-group packet-timeout">
          <span class="interval-label packet-label">分包超时</span>
          <input
            type="number"
            class="interval-input"
            :value="portControlSettings.packetTimeout"
            :min="100"
            :step="100"
            title="超过该时间未收到后续数据时，将当前数据视为一个完整分包"
            @input="updatePacketTimeout($event.target.value)"
          />
          <span class="interval-unit">ms</span>
        </label>

        <label v-if="portControlSettings.isLoopSend" class="interval-group packet-timeout">
          <span class="interval-label packet-label">启动延时</span>
          <input
            type="number"
            class="interval-input"
            :value="portControlSettings.loopStartDelay"
            :min="0"
            :step="100"
            title="开始循环发送前先等待一段时间"
            @input="updateLoopStartDelay($event.target.value)"
          />
          <span class="interval-unit">ms</span>
        </label>

        <label v-if="portControlSettings.isLoopSend" class="interval-group packet-timeout">
          <span class="interval-label packet-label">失败停发</span>
          <input
            type="number"
            class="interval-input"
            :value="portControlSettings.loopFailureLimit"
            :min="0"
            :step="1"
            title="连续发送失败达到该次数后自动停止，0 表示不限"
            @input="updateLoopFailureLimit($event.target.value)"
          />
          <span class="interval-unit">{{ portControlSettings.loopFailureLimit > 0 ? '次' : '不限' }}</span>
        </label>
        </div>
      </div>

      <div v-if="sendErrorMessage" class="send-feedback floating error">
        {{ sendErrorMessage }}
      </div>
      <div v-else-if="sendSuccessMessage" class="send-feedback floating success">
        {{ sendSuccessMessage }}
      </div>
      <div v-else-if="portNotice" :class="['send-feedback', 'floating', 'notice', portNotice.type]">
        {{ portNotice.message }}
      </div>
    </div>
</template>

<style scoped>
.serial-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--app-workspace-shell);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--app-workspace-soft);
  border-bottom: 1px solid var(--app-border);
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
  background: var(--app-accent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--app-accent) 18%, transparent);
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
  color: var(--app-text);
}

.port-baud {
  font-size: 11px;
  color: var(--app-text-soft);
}

.loop-send-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  background: var(--app-warning-soft);
  border: 1px solid var(--app-warning-border);
  border-radius: 999px;
}

.loop-indicator {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--app-warning);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-warning) 18%, transparent);
}

.loop-indicator.paused {
  background: var(--app-text-soft);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-text-soft) 18%, transparent);
}

.loop-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--app-warning-text);
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
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
  cursor: pointer;
  user-select: none;
}

.stats-line {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.stats-line.tx {
  color: var(--app-chip-text);
}

.stats-line.rx {
  color: var(--app-success-text);
}

.action-btn {
  padding: 7px 10px;
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  border-radius: 10px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.18s ease;
}

.action-btn:hover {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
}

.action-btn.disconnect:hover {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
}

.action-btn.filter.active {
  background: var(--app-accent-strong);
  border-color: var(--app-chip-border);
  color: var(--app-text);
}

.filter-panel {
  padding: 10px 12px 12px;
  background: var(--app-workspace-soft);
  border-bottom: 1px solid var(--app-border);
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
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
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
  color: var(--app-text);
}

.option-checkbox input,
.mode-radio input {
  accent-color: var(--app-accent);
}

.option-text,
.mode-text,
.target-label {
  font-size: 12px;
  color: var(--app-text);
}

.pattern-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  border-radius: 10px;
  font-size: 13px;
  font-family: Consolas, "Monaco", monospace;
}

.pattern-input:focus {
  outline: none;
  border-color: var(--app-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.pattern-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.filter-hint {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--app-chip-bg);
  color: var(--app-text-soft);
  font-size: 12px;
  line-height: 1.5;
}

.send-console {
  position: relative;
  padding: 10px 12px 12px;
  background: var(--app-workspace-soft);
  border-top: 1px solid var(--app-border);
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
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  border-radius: 10px;
  font-size: 13px;
  font-family: Consolas, "Monaco", monospace;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.send-input.hex-invalid {
  border-color: var(--app-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-danger) 18%, transparent);
}

.send-input.send-error {
  border-color: var(--app-danger-border);
}

.send-input::placeholder {
  color: var(--app-text-soft);
}

.send-input:focus {
  outline: none;
  border-color: var(--app-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.send-button {
  padding: 10px 18px;
  background: var(--app-accent);
  border: 1px solid var(--app-chip-border);
  border-radius: 10px;
  color: var(--app-text);
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
  background: var(--app-workspace-soft);
  color: var(--app-text-soft);
  cursor: not-allowed;
  box-shadow: none;
}

.send-feedback {
  font-size: 11px;
  line-height: 1.4;
}

.send-feedback.floating {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  max-width: min(280px, calc(100% - 24px));
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
}

.send-feedback.error {
  color: var(--app-danger-text);
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
}

.send-feedback.success {
  color: var(--app-success-text);
  background: var(--app-success-soft);
  border-color: var(--app-success-border);
}

.send-feedback.notice {
  display: inline-flex;
  align-items: center;
}

.send-feedback.notice.error {
  color: var(--app-danger-text);
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
}

.send-feedback.notice.warning {
  color: var(--app-warning-text);
  background: var(--app-warning-soft);
  border-color: var(--app-warning-border);
}

.send-feedback.notice.success {
  color: var(--app-success-text);
  background: var(--app-success-soft);
  border-color: var(--app-success-border);
}

.send-feedback.notice.info {
  color: var(--app-chip-text);
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
}

.send-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}


.command-select {
  height: 34px;
  padding: 0 34px 0 12px;
  background: var(--app-workspace-soft);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  color-scheme: dark;
  color: var(--app-text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4.25 6 8l4-3.75' fill='none' stroke='%23d9ecff' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px 12px;
  min-width: 190px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.history-select {
  width: 132px;
  min-width: 132px;
  max-width: 132px;
  flex: 0 0 132px;
}

.history-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.history-action-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--app-border);
  background: var(--app-workspace-soft);
  color: var(--app-text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.history-action-btn:hover:not(:disabled) {
  border-color: var(--app-accent);
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
}

.history-action-btn.danger:hover:not(:disabled) {
  border-color: var(--app-danger-border);
  background: var(--app-danger-soft);
  color: var(--app-danger-text);
}

.history-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.command-select::-ms-expand {
  display: none;
}

.command-select:hover:not(:disabled) {
  border-color: var(--app-accent);
}

.command-select:focus {
  outline: none;
  border-color: var(--app-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.command-select option {
  background-color: var(--app-modal-bg);
  color: var(--app-text);
}

.command-select option:checked,
.command-select option:hover {
  background-color: var(--app-accent-soft);
  color: var(--app-text);
}

.command-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-chip-group,
.loop-controls,
.advanced-options {
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
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type='checkbox'] {
  accent-color: var(--app-accent);
  width: 12px;
  height: 12px;
  cursor: pointer;
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
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
  border-color: var(--app-chip-border);
}

.loop-pause-btn {
  background: var(--app-warning-soft);
  color: var(--app-warning-text);
  border-color: var(--app-warning-border);
}

.loop-stop-btn {
  background: var(--app-danger-soft);
  color: var(--app-danger-text);
  border-color: var(--app-danger-border);
}

.send-status-summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
}

.send-status-summary.running {
  background: var(--app-success-soft);
  border-color: var(--app-success-border);
}

.send-status-summary.paused {
  background: var(--app-warning-soft);
  border-color: var(--app-warning-border);
}

.send-status-summary.ready {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
}

.send-status-summary.idle {
  background: var(--app-chip-bg);
  border-color: var(--app-border);
}

.send-status-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--app-text-soft);
}

.send-status-value {
  font-size: 11px;
  color: var(--app-text);
  white-space: nowrap;
}

.advanced-toggle {
  margin-left: auto;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-text-soft);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.18s ease;
}

.advanced-toggle:hover,
.advanced-toggle.active {
  background: var(--app-accent-soft);
  color: var(--app-text);
}

.advanced-options {
  margin-top: 8px;
  justify-content: flex-end;
}

.interval-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--app-chip-bg);
  border: 1px solid var(--app-border);
  color: var(--app-text);
}

.packet-timeout {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
  padding-right: 6px;
}

.packet-label {
  color: var(--app-chip-text);
  font-weight: 600;
}

.interval-label {
  color: var(--app-text-soft);
  font-size: 12px;
}

.interval-input {
  width: 62px;
  padding: 6px 8px;
  background: var(--app-workspace-soft);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  border-radius: 10px;
  font-size: 12px;
  text-align: center;
}

.interval-unit {
  color: var(--app-text-soft);
  font-size: 12px;
}

.theme-light.serial-panel {
  background: var(--app-surface-base, #ffffff);
  color: #1f2328;
}

.theme-light .panel-header,
.theme-light .filter-panel,
.theme-light .send-console {
  background: var(--app-surface-soft, #ffffff);
  border-color: rgba(0, 102, 153, 0.12);
}

.theme-light .port-icon {
  background: #1f84c8;
  box-shadow: 0 0 0 5px rgba(31, 132, 200, 0.12);
}

.theme-light .port-path {
  color: #1f2328;
}

.theme-light .port-baud,
.theme-light .filter-hint,
.theme-light .send-status-label,
.theme-light .interval-label,
.theme-light .interval-unit {
  color: #6b7785;
}

.theme-light .loop-send-status {
  background: rgba(255, 183, 77, 0.1);
  border-color: rgba(255, 183, 77, 0.18);
}

.theme-light .loop-count {
  color: #8a5a18;
}

.theme-light .stats-display,
.theme-light .action-btn,
.theme-light .inline-group,
.theme-light .checkbox-label,
.theme-light .send-status-summary,
.theme-light .advanced-toggle,
.theme-light .interval-group,
.theme-light .command-select,
.theme-light .pattern-input,
.theme-light .send-input,
.theme-light .interval-input {
  background-color: var(--app-surface-soft, #ffffff);
  border-color: rgba(0, 102, 153, 0.12);
  color: #1f2328;
}

.theme-light .action-btn:hover,
.theme-light .action-btn.filter.active,
.theme-light .advanced-toggle:hover,
.theme-light .advanced-toggle.active {
  background: rgba(0, 120, 212, 0.08);
  border-color: rgba(0, 120, 212, 0.16);
}

.theme-light .action-btn.disconnect:hover,
.theme-light .send-input.hex-invalid,
.theme-light .send-input.send-error {
  border-color: rgba(196, 43, 28, 0.26);
}

.theme-light .stats-line.tx {
  color: #1f84c8;
}

.theme-light .stats-line.rx {
  color: #2f8f4f;
}

.theme-light .option-text,
.theme-light .mode-text,
.theme-light .target-label,
.theme-light .send-status-value,
.theme-light .packet-label {
  color: #1f2328;
}

.theme-light .pattern-input::placeholder,
.theme-light .send-input::placeholder {
  color: #6b7785;
}

.theme-light .send-button {
  background: #1b7bc4;
  border-color: rgba(27, 123, 196, 0.14);
}

.theme-light .send-button:disabled {
  background: rgba(214, 221, 228, 0.7);
  color: #6c8597;
}

.theme-light .send-feedback.error,
.theme-light .send-feedback.notice.error {
  color: #b2473d;
}

.theme-light .send-feedback.success,
.theme-light .send-feedback.notice.success {
  color: #177b57;
}

.theme-light .send-feedback.notice.warning {
  color: #a36616;
}

.theme-light .send-feedback.notice.info {
  color: #2a6f9d;
}

.theme-light .send-feedback.floating {
  box-shadow: 0 8px 20px rgba(31, 35, 40, 0.08);
  backdrop-filter: blur(8px);
}

.theme-light .command-select {
  color-scheme: light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4.25 6 8l4-3.75' fill='none' stroke='%231f3342' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px 12px;
}

.theme-light .command-select option {
  background-color: var(--app-modal-bg);
  color: var(--app-text);
}

.theme-light .command-select option:checked,
.theme-light .command-select option:hover {
  background-color: var(--app-accent-soft);
  color: var(--app-text);
}

.theme-light .loop-start-btn {
  background: rgba(33, 122, 184, 0.12);
  color: #196ca3;
  border-color: rgba(33, 122, 184, 0.16);
}

.theme-light .loop-pause-btn {
  background: rgba(255, 183, 77, 0.14);
  color: #9a671e;
  border-color: rgba(255, 183, 77, 0.2);
}

.theme-light .loop-stop-btn {
  background: rgba(196, 43, 28, 0.1);
  color: #b2473d;
  border-color: rgba(196, 43, 28, 0.16);
}

.theme-light .packet-timeout {
  background: var(--app-surface-soft, #ffffff);
  border-color: rgba(0, 102, 153, 0.12);
}
</style>
