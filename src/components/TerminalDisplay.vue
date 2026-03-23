<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { useSerialStore } from '../stores/serial'
import 'xterm/css/xterm.css'

const props = defineProps({
  portPath: {
    type: String,
    required: true
  }
})

const serialStore = useSerialStore()
const terminalContainer = ref(null)
const searchInput = ref(null)

// xterm 实例
let terminal = null
let fitAddon = null
let searchAddon = null

// 日志数据跟踪
let logEntries = [] // 存储所有日志条目 { id, line }
const MAX_LOG_COUNT = 1000 // xterm 最大行数
let renderedLogCount = 0
let renderedFirstLogId = null
let renderedLastLogId = null

// 搜索功能
const showSearch = ref(false)
const searchQuery = ref('')
const searchMatchCount = ref(0)
const currentMatchIndex = ref(0)

// 右键菜单
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedText = ref('')

// 打开搜索框
const openSearch = () => {
  showSearch.value = true
  // 重置搜索状态
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  nextTick(() => {
    if (searchInput.value) {
      searchInput.value.focus()
      searchInput.value.select()
    }
  })
}

// 搜索防抖定时器
let searchDebounceTimer = null

// 带防抖的搜索
const debouncedSearch = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    performSearch()
  }, 150) // 150ms 防抖
}

// 获取当前串口的显示设置
const portDisplaySettings = computed(() => {
  return serialStore.getPortDisplaySettings(props.portPath)
})

// 获取当前串口的控制设置
const portControlSettings = computed(() => {
  return serialStore.getPortControlSettings(props.portPath)
})

// 获取当前串口的过滤器
const portFilters = computed(() => {
  return serialStore.getPortFilters(props.portPath)
})

const terminalAppearance = computed(() => {
  return serialStore.terminalAppearance
})

const terminalCssVars = computed(() => ({
  '--terminal-background': terminalAppearance.value.terminalBackground,
  '--terminal-foreground': terminalAppearance.value.terminalForeground,
  '--search-match-text-color': terminalAppearance.value.terminalForeground,
  '--search-match-shadow': 'inset 0 -0.72em 0 rgba(29, 61, 75, 0.92)',
  '--search-current-match-text-color': '#ffffff',
  '--search-current-match-shadow': 'inset 0 -0.78em 0 rgba(41, 88, 107, 0.98)',
  '--search-line-highlight': terminalAppearance.value.searchLineHighlightColor
}))

const portLogs = computed(() => {
  return serialStore.getPortLogs(props.portPath)
})

// 格式化日志行 - 使用 ANSI 转义码添加颜色
const getHexLengthPerLine = () => {
  // 根据终端实际列数动态计算（减去时间戳和前缀占用的空间）
  const terminalCols = terminal?.cols || 100
  const reservedCols = 18 // 时间戳 (8) + 空格 (1) + 前缀 (4) + 空格 (1) + 续行标记 (2) + 余量 (2)
  return Math.max(4, terminalCols - reservedCols)
}

const formatLogLine = (log) => {
  const timestamp = log.timestamp.padEnd(8)
  const prefix = getLogPrefix(log.type)
  const maxCharsPerLine = getHexLengthPerLine()

  let content = ''
  if (portDisplaySettings.value.hexReceive && log.hexData) {
    // Hex 模式 - hexData 是带空格的格式（如 "41 42 43"），每字节占 3 字符
    const hexData = log.hexData
    // 计算每行能容纳的最大字节数（每字节 3 字符：2 位 hex+1 空格）
    const bytesPerLine = Math.floor(maxCharsPerLine / 3)

    if (hexData.length <= maxCharsPerLine) {
      content = hexData
    } else {
      // 分段显示长数据 - 按字节分割
      const lines = []
      const hexBytes = hexData.split(' ') // 按空格分割成字节数组
      for (let i = 0; i < hexBytes.length; i += bytesPerLine) {
        const segment = hexBytes.slice(i, i + bytesPerLine).join(' ')
        const continuation = i > 0 ? '  ' : '' // 续行标记
        lines.push(continuation + segment)
      }
      content = lines.join('\n')
    }
    if (portDisplaySettings.value.showAscii) {
      const ascii = hexData.split(' ').map(h => {
        const code = parseInt(h, 16)
        return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
      }).join('')
      content += ` [${ascii}]`
    }
  } else {
    content = log.message
  }

  // 根据日志类型应用不同颜色（使用 ANSI 转义码）
  const colorCodes = {
    tx: '\x1b[38;5;39m',    // 青色 - TX
    rx: '\x1b[38;5;40m',    // 绿色 - RX
    info: '\x1b[38;5;252m', // 浅灰色 - INFO
    success: '\x1b[38;5;71m', // 浅绿色 - OK
    error: '\x1b[38;5;196m',  // 红色 - ERR
    warning: '\x1b[38;5;214m' // 橙色 - WARN
  }

  const reset = '\x1b[0m'
  const color = colorCodes[log.type] || colorCodes.info

  return `${timestamp} ${color}${prefix}${reset} ${content}`
}

// 获取日志前缀
const getLogPrefix = (type) => {
  const prefixes = {
    tx: '[TX]',
    rx: '[RX]',
    info: '[INFO]',
    success: '[OK]',
    error: '[ERR]',
    warning: '[WARN]'
  }
  return prefixes[type] || '[INFO]'
}

const getTerminalTheme = () => ({
  background: terminalAppearance.value.terminalBackground,
  foreground: terminalAppearance.value.terminalForeground,
  cursor: terminalAppearance.value.cursorColor,
  cursorAccent: terminalAppearance.value.terminalBackground,
  selection: terminalAppearance.value.selectionColor,
  black: '#1e1e1e',
  red: '#f44747',
  green: '#6a9955',
  yellow: '#ffd700',
  blue: '#569cd6',
  magenta: '#c586c0',
  cyan: '#4ec9b0',
  white: '#cccccc',
  brightBlack: '#808080',
  brightRed: '#f44747',
  brightGreen: '#6a9955',
  brightYellow: '#ffd700',
  brightBlue: '#569cd6',
  brightMagenta: '#c586c0',
  brightCyan: '#4ec9b0',
  brightWhite: '#ffffff'
})

const applyTerminalAppearance = () => {
  if (!terminal) return
  terminal.options.theme = getTerminalTheme()
  refreshSearchResults()
}

const initTerminal = () => {
  if (!terminalContainer.value) return

  terminal = new Terminal({
    allowProposedApi: true,
    fontSize: 13,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: getTerminalTheme(),
    scrollback: 1000,
    convertEol: true,
    cursorBlink: false,
    disableStdin: true
  })

  fitAddon = new FitAddon()
  searchAddon = new SearchAddon({
    highlightLimit: 1000
  })

  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)
  terminal.open(terminalContainer.value)
  fitAddon.fit()
  terminal.attachCustomKeyEventHandler((event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && terminal?.hasSelection()) {
      copySelection()
      return false
    }
    return true
  })

  // 加载历史日志
  loadHistoryLogs()

  // 监听搜索结果变化
  searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
    searchMatchCount.value = resultCount
    currentMatchIndex.value = resultIndex >= 0 ? resultIndex + 1 : 0
  })

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
}

// 处理窗口大小变化 - 防抖处理
let resizeDebounceTimer = null
const handleResize = () => {
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }
  resizeDebounceTimer = setTimeout(() => {
    if (fitAddon) {
      fitAddon.fit()
      // 等待终端列数更新后再刷新显示
      nextTick(() => {
        refreshDisplay()
      })
    }
  }, 100) // 100ms 防抖
}

// ResizeObserver 监听容器大小变化
let resizeObserver = null
const initResizeObserver = () => {
  if (!terminalContainer.value || resizeObserver) return

  resizeObserver = new ResizeObserver(() => {
    handleResize()
  })
  resizeObserver.observe(terminalContainer.value)
}

// 加载历史日志
const loadHistoryLogs = () => {
  if (!terminal || !portLogs.value) return

  const logs = portLogs.value
  logEntries = []

  terminal.clear()

  const startIdx = Math.max(0, logs.length - MAX_LOG_COUNT)
  for (let i = startIdx; i < logs.length; i++) {
    const log = logs[i]
    const line = formatLogLine(log)
    terminal.writeln(line)
    logEntries.push({
      id: log.id,
      line: terminal.rows - 1
    })
  }

  const renderedLogs = logs.slice(startIdx)
  renderedLogCount = logs.length
  renderedFirstLogId = renderedLogs[0]?.id ?? null
  renderedLastLogId = renderedLogs[renderedLogs.length - 1]?.id ?? null

  terminal.scrollToBottom()
}

// 添加新日志
const addLogEntry = (log) => {
  if (!terminal) return

  const line = formatLogLine(log)
  terminal.writeln(line)

  logEntries.push({
    id: log.id,
    line: terminal.rows - 1
  })

  // 限制行数
  if (logEntries.length > MAX_LOG_COUNT) {
    logEntries.shift()
  }

  // 自动滚动
  if (portControlSettings.value.isAutoScroll) {
    terminal.scrollToBottom()
  }
}

const resetRenderedLogState = () => {
  renderedLogCount = 0
  renderedFirstLogId = null
  renderedLastLogId = null
}

const syncTerminalLogs = () => {
  if (!terminal) return

  const logs = portLogs.value || []
  if (logs.length === 0) {
    terminal.clear()
    logEntries = []
    resetRenderedLogState()
    performSearch()
    return
  }

  const currentFirstLogId = logs[0]?.id ?? null
  const currentLastLogId = logs[logs.length - 1]?.id ?? null
  const canAppendIncrementally =
    renderedLogCount > 0 &&
    currentFirstLogId === renderedFirstLogId &&
    logs.length >= renderedLogCount

  if (!canAppendIncrementally) {
    loadHistoryLogs()
    refreshSearchResults()
    return
  }

  for (let i = renderedLogCount; i < logs.length; i++) {
    addLogEntry(logs[i])
  }

  renderedLogCount = logs.length
  renderedLastLogId = currentLastLogId
  refreshSearchResults()
}

// 刷新显示（用于设置变更）
const refreshDisplay = () => {
  if (!terminal) return
  loadHistoryLogs()
  refreshSearchResults()
}

const getSearchOptions = () => ({
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  decorations: {
    matchBackground: 'rgba(29, 61, 75, 0.92)',
    matchBorder: 'rgba(76, 130, 154, 0.88)',
    matchOverviewRuler: 'rgba(29, 61, 75, 0.92)',
    activeMatchBackground: 'rgba(41, 88, 107, 0.98)',
    activeMatchBorder: 'rgba(118, 184, 214, 0.95)',
    activeMatchColorOverviewRuler: 'rgba(41, 88, 107, 0.98)'
  }
})

const clearSearchHighlights = () => {
  if (terminal) {
    terminal.clearSelection()
  }
  if (searchAddon?.clearDecorations) {
    searchAddon.clearDecorations()
  }
}

const refreshSearchResults = () => {
  if (!showSearch.value || !searchQuery.value || !terminal || !searchAddon) return
  nextTick(() => {
    searchAddon.findNext(searchQuery.value, getSearchOptions())
  })
}

// 搜索功能
const performSearch = () => {
  if (!terminal || !searchAddon) {
    searchMatchCount.value = 0
    currentMatchIndex.value = 0
    return
  }

  // 清除之前的搜索结果
  if (!searchQuery.value) {
    clearSearchHighlights()
    searchMatchCount.value = 0
    currentMatchIndex.value = 0
    return
  }

  clearSearchHighlights()

  // 使用 xterm SearchAddon 查找，启用高亮装饰

  // 定位到第一个匹配项，onDidChangeResults 会更新计数
  searchAddon.findNext(searchQuery.value, getSearchOptions())
}

// 导航到下一个匹配项
const goToNextMatch = () => {
  if (!searchQuery.value || !terminal || !searchAddon) return
  searchAddon.findNext(searchQuery.value, getSearchOptions())
}

// 导航到上一个匹配项
const goToPreviousMatch = () => {
  if (!searchQuery.value || !terminal || !searchAddon) return
  searchAddon.findPrevious(searchQuery.value, getSearchOptions())
}

// 处理 Enter 键导航
const handleEnterKey = () => {
  goToNextMatch()
}

// 清除搜索
const clearSearch = () => {
  showSearch.value = false
  searchQuery.value = ''
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  clearSearchDebounce()
  clearSearchHighlights()
}

// 监听搜索输入
watch(searchQuery, () => {
  debouncedSearch()
})

// 清除搜索防抖定时器
const clearSearchDebounce = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

// 处理键盘快捷键 - F3 和 Escape
const handleGlobalKeyDown = (e) => {
  // 如果搜索框已打开，只响应 Escape
  if (showSearch.value) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      clearSearch()
      return
    }
  }

  // F3 和 Shift+F3 导航（只有搜索打开时才响应）
  if (searchQuery.value && e.key === 'F3') {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      goToPreviousMatch()
    } else {
      goToNextMatch()
    }
  }
}

// 监听全局搜索打开事件
const handleOpenSearch = (event) => {
  const targetPortPath = event?.detail?.portPath
  if (targetPortPath && targetPortPath !== props.portPath) return
  serialStore.selectedPort = props.portPath
  openSearch()
}

// 直接在组件内监听键盘事件（捕获阶段）
const handleKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && serialStore.selectedPort === props.portPath) {
    const selection = terminal?.getSelection()
    if (selection) {
      e.preventDefault()
      e.stopPropagation()
      copySelection()
    }
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && serialStore.selectedPort === props.portPath) {
    e.preventDefault()
    e.stopPropagation()
    openSearch()
  }
}

// 监听日志变化，兼容批量刷新和日志裁剪
watch(() => {
  const logs = portLogs.value || []
  return `${logs.length}:${logs[0]?.id ?? ''}:${logs[logs.length - 1]?.id ?? ''}`
}, () => {
  syncTerminalLogs()
})

// 监听设置变更
watch([portDisplaySettings, portFilters], () => {
  refreshDisplay()
}, { deep: true })

watch(terminalAppearance, () => {
  applyTerminalAppearance()
}, { deep: true })

// 监听 HEX 接收设置
watch(() => portDisplaySettings.value.hexReceive, () => {
  refreshDisplay()
})

// 组件挂载
onMounted(() => {
  nextTick(() => {
    initTerminal()
    initResizeObserver()
  })
  // 监听全局键盘事件（F3、Escape）
  document.addEventListener('keydown', handleGlobalKeyDown, true)
  // 监听全局搜索打开事件
  window.addEventListener('serialx-open-search', handleOpenSearch)
  // 直接监听键盘事件（捕获阶段，优先处理 Ctrl+F）
  document.addEventListener('keydown', handleKeyDown, true)
  // 监听右键菜单
  if (terminalContainer.value) {
    terminalContainer.value.addEventListener('contextmenu', handleContextMenu)
  }
  // 点击其他地方关闭菜单
  document.addEventListener('click', closeContextMenu)
})

// 右键菜单处理
const handleContextMenu = (e) => {
  e.preventDefault()
  const text = terminal?.getSelection()?.trim()
  if (text) {
    selectedText.value = text
    contextMenuPosition.value = { x: e.clientX, y: e.clientY }
    showContextMenu.value = true
  }
}

// 复制选中的文本
const copySelection = async () => {
  const text = terminal?.getSelection()
  if (text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      // 降级处理
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }
  showContextMenu.value = false
}

// 全选
const selectAll = () => {
  if (terminal) {
    const range = document.createRange()
    range.selectNodeContents(terminal.element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  showContextMenu.value = false
}

// 关闭右键菜单
const closeContextMenu = (e) => {
  // 如果点击的是菜单内部，不关闭
  if (e && e.target && e.target.closest('.context-menu')) return
  showContextMenu.value = false
  selectedText.value = ''
}

// 组件卸载
onUnmounted(() => {
  clearSearchDebounce()
  resetRenderedLogState()
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  document.removeEventListener('keydown', handleGlobalKeyDown, true)
  document.removeEventListener('keydown', handleKeyDown, true)
  window.removeEventListener('serialx-open-search', handleOpenSearch)
  if (terminalContainer.value) {
    terminalContainer.value.removeEventListener('contextmenu', handleContextMenu)
  }
  if (terminal) {
    terminal.dispose()
    terminal = null
  }
})

// 暴露方法给父组件
defineExpose({
  refreshDisplay
})
</script>

<template>
  <div :class="['terminal-wrapper', { 'search-open': showSearch }]" :style="terminalCssVars">
    <!-- 搜索浮窗 -->
    <div v-if="showSearch" class="search-widget">
      <div class="search-input-wrapper">
        <span class="search-chip">查找</span>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索日志内容..."
          @keydown.enter.prevent="handleEnterKey"
          @keydown.shift.enter.prevent="goToPreviousMatch"
        />
        <div class="search-controls">
          <span class="search-count">
            {{ !searchQuery ? '' : (searchMatchCount > 0 ? `${currentMatchIndex} / ${searchMatchCount}` : '无匹配项') }}
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

    <!-- 右键菜单 -->
    <div
      v-if="showContextMenu"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="copySelection">
        <span>📋</span>
        <span>复制</span>
      </div>
      <div class="context-menu-item" @click="selectAll">
        <span>✓</span>
        <span>全选</span>
      </div>
    </div>

    <!-- xterm 容器 -->
    <div :class="['terminal-container', { 'search-open': showSearch }]" ref="terminalContainer"></div>
  </div>
</template>

<style scoped>
/* 自定义滚动条 - VS Code 风格 */
.terminal-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: var(--terminal-background);
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.terminal-container {
  flex: 1;
  width: 100%;
  position: relative;
  padding: 2px 6px;
  box-sizing: border-box;
  overflow: hidden;
}

.terminal-container.search-open {
  padding-top: 44px;
}

/* 隐藏 xterm 默认滚动条样式，使用自定义样式 */
.terminal-container ::v-deep(.xterm-viewport) {
  width: auto !important;
  background-color: var(--terminal-background) !important;
  border-left: none !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar) {
  width: 14px !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: var(--terminal-background) !important;
  border: none !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #424242 !important;
  border-radius: 7px !important;
  border: 2px solid var(--terminal-background) !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: #555 !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-thumb:active) {
  background: #666 !important;
}

.terminal-container ::v-deep(.xterm-viewport::-webkit-scrollbar-corner) {
  background: #1e1e1e !important;
}

/* 确保 xterm 内部元素不显示额外边框 */
.terminal-container ::v-deep(.xterm) {
  background: transparent !important;
  width: 100% !important;
  height: 100% !important;
}

/* 确保 xterm 所有内部容器宽度动态 */
.terminal-container ::v-deep(.xterm .xterm-screen),
.terminal-container ::v-deep(.xterm .xterm-screen-canvas),
.terminal-container ::v-deep(.xterm .xterm-rows),
.terminal-container ::v-deep(.xterm .xterm-scroll-area) {
  width: 100% !important;
  max-width: 100% !important;
}

/* 修复 xterm-rows 子 div 宽度 - 这些是实际的行元素 */
.terminal-container ::v-deep(.xterm-rows > div) {
  width: auto !important;
  max-width: 100% !important;
}

/* 搜索高亮样式 - 鲜艳黄色 */
.terminal-container ::v-deep(.xterm-find-match) {
  background-color: transparent !important;
  color: var(--search-match-text-color) !important;
  font-weight: 700;
  box-shadow: var(--search-match-shadow);
  border-radius: 0.08em;
}

.terminal-container ::v-deep(.xterm-find-match-current) {
  background-color: transparent !important;
  color: var(--search-current-match-text-color) !important;
  font-weight: 700;
  box-shadow: var(--search-current-match-shadow);
  border-radius: 0.1em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.42);
}

/* xterm 5.x search addon 高亮样式 */
.terminal-container ::v-deep(span.xterm-highlight) {
  background-color: transparent !important;
  color: var(--search-match-text-color) !important;
  box-shadow: var(--search-match-shadow);
  border-radius: 0.08em;
  font-weight: 700;
}

.terminal-container ::v-deep(.xterm .xterm-selection-match) {
  background-color: transparent !important;
  color: var(--search-match-text-color) !important;
  box-shadow: var(--search-match-shadow);
  font-weight: 700;
}


/* 搜索浮窗 */
.search-widget {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 100;
  padding: 5px 6px;
  border-radius: 999px;
  border: 1px solid rgba(126, 161, 183, 0.12);
  background: rgba(12, 21, 28, 0.9);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(12px);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-chip {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 24px;
  border-radius: 999px;
  background: rgba(87, 199, 255, 0.08);
  color: #a9dfff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.search-input {
  width: 180px;
  height: 24px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.08);
  border-radius: 999px;
  color: #dce8f0;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  outline: none;
}

.search-input:focus {
  border-color: rgba(87, 199, 255, 0.24);
}

.search-input::placeholder {
  color: #6f889a;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-count {
  min-width: 52px;
  padding: 0 2px;
  text-align: right;
  color: #8ea6b8;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.search-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(126, 161, 183, 0.08);
  border-radius: 999px;
  color: #dce8f0;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  transition: all 0.16s ease;
}

.search-btn:hover {
  background: rgba(87, 199, 255, 0.12);
  border-color: rgba(87, 199, 255, 0.18);
}

.search-btn.close:hover {
  background: rgba(196, 43, 28, 0.18);
  border-color: rgba(196, 43, 28, 0.22);
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background-color: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 10000;
  min-width: 120px;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: #cccccc;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.context-menu-item:hover {
  background-color: #007acc;
  color: #ffffff;
}

.context-menu-item span:first-child {
  font-size: 14px;
}
</style>
