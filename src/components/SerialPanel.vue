<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useSerialStore } from '../stores/serial'

const props = defineProps({
  portPath: {
    type: String,
    required: true
  }
})

const serialStore = useSerialStore()
const terminalRef = ref(null)
const showFilters = ref(false)
const showSearch = ref(false)
const searchQuery = ref('')
const currentMatchIndex = ref(0)
const matchedLogIndices = ref([])

// 获取当前串口的显示设置
const portDisplaySettings = computed(() => {
  return serialStore.getPortDisplaySettings(props.portPath)
})

// Hex 模式切换
const toggleHexMode = () => {
  serialStore.updatePortDisplaySettings(props.portPath, {
    hexMode: !portDisplaySettings.value.hexMode
  })
}

// ASCII 显示切换
const toggleShowAscii = () => {
  serialStore.updatePortDisplaySettings(props.portPath, {
    showAscii: !portDisplaySettings.value.showAscii
  })
}

// 字节转 ASCII（可打印字符显示，不可打印显示为.）
const bytesToAscii = (bytes) => {
  if (!bytes || !Array.isArray(bytes)) return ''
  return bytes.map(b => {
    const char = String.fromCharCode(b)
    // 可打印 ASCII 字符范围：32-126
    return (b >= 32 && b <= 126) ? char : '.'
  }).join('')
}

// 将 TX 消息转换为 Hex 格式显示
const formatTxAsHex = (message) => {
  if (!message) return ''
  return Array.from(message)
    .map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

// 快速命令选择
const selectedCommandId = ref('')
const sendSelectedCommand = () => {
  const cmd = serialStore.commonCommands.find(c => c.id === parseInt(selectedCommandId.value))
  if (cmd) {
    executeCommand(cmd.command)
  }
  selectedCommandId.value = '' // 重置选择
}

// 执行常用命令
const executeCommand = async (command) => {
  serialStore.setPortSendingData(props.portPath, command)
  await serialStore.sendData(props.portPath)
}

// 搜索匹配
const performSearch = () => {
  if (!searchQuery.value) {
    matchedLogIndices.value = []
    currentMatchIndex.value = 0
    return
  }

  const query = searchQuery.value.toLowerCase()
  matchedLogIndices.value = displayLogs.value
    .map((log, index) => ({ log, index }))
    .filter(({ log }) => log.message.toLowerCase().includes(query))
    .map(({ index }) => index)

  currentMatchIndex.value = 0
  scrollToCurrentMatch()
}

// 滚动到当前匹配项
const scrollToCurrentMatch = () => {
  if (matchedLogIndices.value.length === 0) return

  nextTick(() => {
    const elements = terminalRef.value?.querySelectorAll('.log-entry')
    if (elements && matchedLogIndices.value[currentMatchIndex.value] !== undefined) {
      const targetElement = elements[matchedLogIndices.value[currentMatchIndex.value]]
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  })
}

// 导航到下一个匹配项
const goToNextMatch = () => {
  if (matchedLogIndices.value.length === 0) return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchedLogIndices.value.length
  scrollToCurrentMatch()
}

// 导航到上一个匹配项
const goToPreviousMatch = () => {
  if (matchedLogIndices.value.length === 0) return
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchedLogIndices.value.length) % matchedLogIndices.value.length
  scrollToCurrentMatch()
}

// 清除搜索
const clearSearch = () => {
  showSearch.value = false
  searchQuery.value = ''
  matchedLogIndices.value = []
  currentMatchIndex.value = 0
}

// 监听搜索输入
watch(searchQuery, () => {
  performSearch()
})

// Ctrl+F 快捷键 - 在终端区域上监听（模板中绑定 @keydown）
const handleKeyDown = (e) => {
  // 如果正在拖拽，不处理任何快捷键
  if (e.target.classList.contains('tab-icon') || e.target.classList.contains('tab-list')) {
    return
  }

  // 全局 Ctrl+F 打开搜索 - 只有在没有输入框获得焦点时才触发
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const activeElement = document.activeElement
    const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
    // 检查是否在当前面板的搜索框中
    const isInCurrentSearchWidget = terminalRef.value?.contains(activeElement)

    if (!isInputFocused || isInCurrentSearchWidget) {
      e.preventDefault()
      e.stopPropagation()
      showSearch.value = true
      nextTick(() => {
        const input = terminalRef.value?.querySelector('.search-input')
        if (input) input.focus()
      })
    }
    return
  }

  // Escape 关闭搜索
  if (e.key === 'Escape' && showSearch.value) {
    e.preventDefault()
    e.stopPropagation()
    clearSearch()
    return
  }

  // F3 和 Shift+F3 导航（只有当前面板搜索打开时才响应）
  if (showSearch.value && matchedLogIndices.value.length > 0 && e.key === 'F3') {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      goToPreviousMatch()
    } else {
      goToNextMatch()
    }
  }
}

// 组件挂载/卸载时不需要全局监听，使用模板中的 @keydown

// 获取当前串口的设置和状态
const portSettings = computed(() => {
  return serialStore.getPortSettings(props.portPath)
})

const isConnected = computed(() => {
  return serialStore.getPortStatus(props.portPath)
})

// 获取当前串口的过滤器
const portFilters = computed(() => {
  return serialStore.getPortFilters(props.portPath)
})

// 获取当前串口的日志
const portLogs = computed(() => {
  return serialStore.getPortLogs(props.portPath)
})

// 显示用的日志（隐藏模式会过滤）
const displayLogs = computed(() => {
  if (portFilters.value.mode !== 'hide') return portLogs.value

  // 隐藏模式：过滤掉匹配的数据
  return portLogs.value.filter(log => {
    if (log.type !== 'rx') return true
    if (!portFilters.value.pattern) return true

    // 关键字匹配
    if (portFilters.value.matchMode === 'keyword') {
      return !log.message.includes(portFilters.value.pattern)
    }

    // 正则匹配
    if (portFilters.value.matchMode === 'regex') {
      try {
        const regex = new RegExp(portFilters.value.pattern)
        return !regex.test(log.message)
      } catch {
        return true
      }
    }

    return true
  })
})

const getLogClass = (type) => {
  const classes = {
    tx: 'log-tx',
    rx: 'log-rx',
    info: 'log-info',
    success: 'log-success',
    error: 'log-error',
    warning: 'log-warning'
  }
  return classes[type] || 'log-info'
}

const getLogPrefix = (type) => {
  const prefixes = {
    tx: 'TX',
    rx: 'RX',
    info: '信息',
    success: '成功',
    error: '错误',
    warning: '警告'
  }
  return prefixes[type] || ''
}

// 高亮匹配文本
const highlightMatch = (message) => {
  if (!searchQuery.value) return message

  try {
    const regex = new RegExp(`(${searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return message.replace(regex, '<mark class="search-match">$1</mark>')
  } catch {
    return message
  }
}

// Auto-scroll when logs change
watch(() => displayLogs.value.length, () => {
  if (serialStore.isAutoScroll) {
    nextTick(() => {
      if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight
      }
    })
  }
})

const handleClearLogs = () => {
  serialStore.portLogs.set(props.portPath, [])
}

const handleSend = async () => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!data) return
  const result = await serialStore.sendData(props.portPath, null, serialStore.isHexMode)
  if (!result.success) {
    console.error('发送失败:', result.error)
  }
}

// Hex 模式下验证输入是否有效
const isHexInputValid = computed(() => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!serialStore.isHexMode || !data) return true
  return serialStore.isValidHex(data)
})

// 发送按钮是否禁用
const isSendDisabled = computed(() => {
  const data = serialStore.getPortSendingData(props.portPath)
  if (!data) return true
  if (serialStore.isHexMode) return !isHexInputValid.value
  return false
})

// Hex 模式下的输入框占位符
const hexPlaceholder = '输入十六进制数据，如：48 65 6C 6C 6F 或 48656C6C6F'
const textPlaceholder = '输入要发送的数据，按 Enter 发送...'

const toggleLoopSend = () => {
  if (serialStore.isLoopSend) {
    serialStore.stopLoopSend()
  } else {
    serialStore.isLoopSend = true
    serialStore.startLoopSend(props.portPath)
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

const getPatternPlaceholder = () => {
  if (!portFilters.value.enabled) return '启用后输入过滤条件...'
  if (portFilters.value.matchMode === 'keyword') {
    return '输入关键字，包含该关键字的数据将被过滤...'
  }
  return '输入正则表达式，匹配的数据将被过滤...'
}
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
      </div>
      <div class="panel-actions">
        <label class="checkbox-label">
          <input type="checkbox" v-model="serialStore.isAutoScroll" />
          自动滚动
        </label>
        <!-- Hex 显示模式 -->
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="portDisplaySettings.hexMode"
            @change="toggleHexMode"
          />
          <span class="option-text">Hex</span>
        </label>
        <!-- ASCII 转换显示 -->
        <label class="checkbox-label" v-if="portDisplaySettings.hexMode">
          <input
            type="checkbox"
            :checked="portDisplaySettings.showAscii"
            @change="toggleShowAscii"
          />
          <span class="option-text">ASCII</span>
        </label>
        <!-- 常用命令快速发送 -->
        <div class="command-dropdown">
          <select
            v-model="selectedCommandId"
            @change="sendSelectedCommand"
            class="command-select"
            :disabled="!isConnected"
          >
            <option value="">⚡ 快速命令</option>
            <option
              v-for="cmd in serialStore.getEnabledCommands"
              :key="cmd.id"
              :value="cmd.id"
            >
              {{ cmd.name }} ({{ cmd.command }})
            </option>
          </select>
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

    <!-- 终端显示区 -->
    <div class="terminal-content" ref="terminalRef" @keydown="handleKeyDown" tabindex="0">
      <!-- 搜索浮窗 -->
      <div v-if="showSearch" class="search-widget">
        <div class="search-input-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索日志内容..."
          />
          <div class="search-controls">
            <span class="search-count" v-if="searchQuery">
              {{ matchedLogIndices.length > 0 ? currentMatchIndex + 1 : 0 }} / {{ matchedLogIndices.length }}
            </span>
            <button @click="goToPreviousMatch" class="search-btn" title="上一个匹配项 (Shift+F3)">
              <span>↑</span>
            </button>
            <button @click="goToNextMatch" class="search-btn" title="下一个匹配项 (F3)">
              <span>↓</span>
            </button>
            <button @click="clearSearch" class="search-btn close" title="关闭 (Esc)">
              <span>✕</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="displayLogs.length === 0" class="empty-state">
        <p class="empty-icon">📡</p>
        <p>暂无数据</p>
        <p class="hint">
          <template v-if="portLogs.length === 0">连接串口后开始接收数据</template>
          <template v-else-if="portFilters.enabled && portFilters.mode === 'discard'">
            所有 RX 数据已被过滤丢弃
          </template>
          <template v-else-if="portFilters.enabled && portFilters.mode === 'hide'">
            所有 RX 数据已被隐藏
          </template>
        </p>
      </div>

      <div
        v-for="(log, index) in displayLogs"
        :key="log.id"
        :class="['log-entry', getLogClass(log.type), { 'match-highlight': matchedLogIndices.includes(index) && index === matchedLogIndices[currentMatchIndex] }]"
      >
        <span class="log-timestamp">{{ log.timestamp }}</span>
        <span class="log-prefix">{{ getLogPrefix(log.type) }}</span>
        <span class="log-message">
          <!-- Hex 模式显示 -->
          <template v-if="portDisplaySettings.hexMode">
            <template v-if="log.type === 'rx' && log.hexData">
              <span class="hex-data">{{ log.hexData }}</span>
              <span v-if="portDisplaySettings.showAscii" class="ascii-data">
                [{{ bytesToAscii(log.rawBytes) }}]
              </span>
            </template>
            <!-- TX 数据在 Hex 模式下也显示为十六进制 -->
            <template v-else-if="log.type === 'tx'">
              <span class="hex-data">{{ formatTxAsHex(log.message) }}</span>
            </template>
          </template>
          <!-- 普通模式显示 -->
          <template v-else>
            <span v-html="highlightMatch(log.message)"></span>
          </template>
        </span>
      </div>
    </div>

    <!-- 发送控制台 -->
    <div class="send-console">
      <div class="send-options">
        <label class="option-checkbox">
          <input type="checkbox" v-model="serialStore.isHexMode" />
          <span class="option-text">Hex</span>
        </label>
        <label class="option-checkbox">
          <input type="checkbox" v-model="serialStore.isLoopSend" @change="toggleLoopSend" />
          <span class="option-text">循环发送</span>
        </label>
        <label v-if="serialStore.isLoopSend" class="interval-group">
          <span class="interval-label">间隔:</span>
          <input
            type="number"
            v-model="serialStore.loopInterval"
            :min="100"
            :step="100"
            class="interval-input"
          />
          <span class="interval-unit">ms</span>
        </label>
      </div>
      <div class="send-row">
        <span class="send-prefix">TX:</span>
        <input
          :value="serialStore.getPortSendingData(props.portPath)"
          @input="serialStore.setPortSendingData(props.portPath, $event.target.value)"
          type="text"
          class="send-input"
          :class="{ 'hex-invalid': serialStore.isHexMode && !isHexInputValid }"
          :placeholder="serialStore.isHexMode ? hexPlaceholder : textPlaceholder"
          @keyup.enter="handleSend"
        />
        <button @click="handleSend" class="send-button" :disabled="isSendDisabled">
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.serial-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
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

/* 命令下拉选择 */
.command-dropdown {
  position: relative;
}

.command-select {
  padding: 6px 12px;
  padding-right: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
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
}

.command-select::-ms-expand {
  display: none;
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

.action-btn.commands {
  padding: 4px 10px;
}

.action-btn.commands.active {
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

.filter-hint {
  font-size: 11px;
  color: #858585;
  padding-top: 4px;
  border-top: 1px solid #3e3e42;
}

/* 常用命令面板 */
.commands-panel {
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(45, 45, 48, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  border-bottom: 1px solid rgba(62, 62, 66, 0.8);
}

.commands-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.commands-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.command-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s ease;
}

.command-item.disabled {
  opacity: 0.5;
  filter: grayscale(0.5);
}

.command-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  overflow: hidden;
}

.command-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.command-btn:hover::before {
  left: 100%;
}

.command-btn:hover:not(:disabled) {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
  border-color: rgba(255, 255, 255, 0.3);
}

.command-btn:active:not(:disabled) {
  transform: translateY(-2px) scale(0.98);
}

.command-btn:disabled {
  background: linear-gradient(135deg, #3e3e42 0%, #2d2d30 100%);
  cursor: not-allowed;
  border-color: rgba(255, 255, 255, 0.05);
}

.command-name {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.3px;
}

.command-value {
  font-size: 10px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 6px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.command-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.2s ease;
}

.command-item:hover .command-actions {
  opacity: 1;
  transform: translateY(0);
}

.cmd-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.cmd-action-btn.enabled {
  background: linear-gradient(135deg, #4ec9b0 0%, #45b8a0 100%);
  color: #1e1e1e;
  box-shadow: 0 2px 8px rgba(78, 201, 176, 0.3);
}

.cmd-action-btn.disabled {
  background: #3e3e42;
  color: #858585;
}

.cmd-action-btn.edit {
  background: linear-gradient(135deg, #569cd6 0%, #4a8dc7 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(86, 156, 214, 0.3);
}

.cmd-action-btn.delete {
  background: linear-gradient(135deg, #c42b1c 0%, #a82518 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(196, 43, 28, 0.3);
}

.cmd-action-btn:hover {
  transform: scale(1.15) translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.cmd-action-btn:active {
  transform: scale(1.05);
}

.commands-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(62, 62, 66, 0.5);
}

.add-command-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #4ec9b0 0%, #45b8a0 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #1e1e1e;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.add-command-btn::before {
  content: '+';
  font-size: 16px;
  font-weight: bold;
}

.add-command-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(78, 201, 176, 0.4);
  border-color: rgba(255, 255, 255, 0.4);
}

.add-command-btn:active {
  transform: translateY(-1px);
}

.commands-hint {
  font-size: 11px;
  color: #6a6a6a;
  text-align: center;
  font-style: italic;
  letter-spacing: 0.3px;
}

/* 命令管理弹窗 */
.command-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.command-modal {
  background: linear-gradient(145deg, #2d2d30 0%, #1e1e1e 100%);
  border: 1px solid rgba(62, 62, 66, 0.8);
  border-radius: 16px;
  padding: 24px;
  min-width: 420px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(62, 62, 66, 0.5);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #858585;
  cursor: pointer;
  font-size: 18px;
  border-radius: 8px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(196, 43, 28, 0.3);
  border-color: rgba(196, 43, 28, 0.5);
  color: #ffffff;
  transform: rotate(90deg);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 12px;
  color: #858585;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input {
  padding: 12px 14px;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(62, 62, 66, 0.8);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  background: rgba(30, 30, 30, 1);
}

.form-input::placeholder {
  color: #555;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid rgba(62, 62, 66, 0.5);
}

.modal-btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.modal-btn.cancel {
  background: transparent;
  border-color: rgba(62, 62, 66, 0.8);
  color: #cccccc;
}

.modal-btn.cancel:hover {
  background: rgba(62, 62, 66, 0.5);
  border-color: rgba(85, 85, 85, 0.8);
}

.modal-btn.save {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.modal-btn.save:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

/* 终端显示区 */
.terminal-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  background-color: #1e1e1e;
  min-height: 0;
  position: relative;
  outline: none;
}

/* 搜索浮窗 */
.search-widget {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 100;
  background-color: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-input {
  padding: 6px 10px;
  background-color: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  color: #cccccc;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  width: 250px;
  outline: none;
}

.search-input:focus {
  border-color: #007acc;
}

.search-input::placeholder {
  color: #6a6a6a;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-count {
  font-size: 12px;
  color: #858585;
  min-width: 50px;
  text-align: right;
  padding: 0 4px;
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: #3c3c3c;
  border: 1px solid #555;
  border-radius: 3px;
  color: #cccccc;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  transition: all 0.15s;
}

.search-btn:hover {
  background-color: #4a4a4a;
  border-color: #007acc;
}

.search-btn.close:hover {
  background-color: #c42b1c;
  border-color: #a02015;
}

/* 搜索高亮 */
.search-match {
  background-color: #888814;
  color: #ffff00;
  border-radius: 2px;
  padding: 0 2px;
}

.match-highlight {
  background-color: rgba(255, 255, 0, 0.1);
  border-radius: 3px;
}

.terminal-content::-webkit-scrollbar {
  width: 10px;
}

.terminal-content::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.terminal-content::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 5px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #555;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.empty-state p {
  margin: 4px 0;
}

.empty-state .hint {
  font-size: 12px;
  color: #3e3e42;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 0;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.log-timestamp {
  color: #858585;
  flex-shrink: 0;
  font-size: 11px;
  font-family: 'Consolas', monospace;
  min-width: 70px;
}

.log-prefix {
  flex-shrink: 0;
  font-weight: bold;
  min-width: 25px;
  font-size: 11px;
}

.log-message {
  flex: 1;
  word-break: break-all;
  color: #cccccc;
  font-size: 12px;
  min-width: 0;
}

.log-tx {
  color: #4ec9b0;
}

.log-tx .log-prefix {
  color: #4ec9b0;
}

.log-tx .log-message {
  color: #4ec9b0;
}

.log-rx {
  color: #dcdcaa;
}

.log-rx .log-prefix {
  color: #dcdcaa;
}

.log-rx .log-message {
  color: #dcdcaa;
}

.log-info .log-prefix {
  color: #9cdcfe;
}

.log-info .log-message {
  color: #9cdcfe;
}

.log-success .log-prefix {
  color: #4ec9b0;
}

.log-success .log-message {
  color: #4ec9b0;
}

.log-error .log-prefix {
  color: #f44747;
}

.log-error .log-message {
  color: #f44747;
}

.log-warning .log-prefix {
  color: #cca700;
}

.log-warning .log-message {
  color: #cca700;
}

/* Hex 数据显示 */
.hex-data {
  font-family: 'Consolas', 'Monaco', monospace;
  color: #ce9178;
  letter-spacing: 0.5px;
}

.ascii-data {
  color: #6a9955;
  font-family: 'Consolas', 'Monaco', monospace;
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
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.option-checkbox input[type="checkbox"] {
  accent-color: #007acc;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.option-text {
  font-size: 13px;
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

.send-row {
  display: flex;
  align-items: center;
  gap: 10px;
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
</style>
