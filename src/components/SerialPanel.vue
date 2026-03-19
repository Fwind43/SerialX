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
  if (!serialStore.getPortSendingData(props.portPath)) return
  await serialStore.sendData(props.portPath)
}

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
        <span class="log-message" v-html="highlightMatch(log.message)"></span>
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
          placeholder="输入要发送的数据，按 Enter 发送..."
          @keyup.enter="handleSend"
        />
        <button @click="handleSend" class="send-button" :disabled="!serialStore.getPortSendingData(props.portPath)">
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

.filter-hint {
  font-size: 11px;
  color: #858585;
  padding-top: 4px;
  border-top: 1px solid #3e3e42;
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
