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

let terminal = null
let fitAddon = null
let searchAddon = null

let logEntries = []
const formattedLogCache = new Map()
const MAX_LOG_COUNT = 1000
let renderedLogCount = 0
let renderedFirstLogId = null
let renderedLastLogId = null

const showSearch = ref(false)
const searchQuery = ref('')
const searchMatchCount = ref(0)
const currentMatchIndex = ref(0)

const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedText = ref('')

let searchDebounceTimer = null
let resizeDebounceTimer = null
let resizeObserver = null

const portDisplaySettings = computed(() => serialStore.getPortDisplaySettings(props.portPath))
const portControlSettings = computed(() => serialStore.getPortControlSettings(props.portPath))
const portFilters = computed(() => serialStore.getPortFilters(props.portPath))
const terminalAppearance = computed(() => serialStore.terminalAppearance)
const portLogs = computed(() => serialStore.getPortLogs(props.portPath))

const terminalCssVars = computed(() => ({
  '--terminal-background': terminalAppearance.value.terminalBackground,
  '--terminal-foreground': terminalAppearance.value.terminalForeground,
  '--search-match-text-color': terminalAppearance.value.terminalForeground,
  '--search-match-shadow': 'inset 0 -0.72em 0 rgba(29, 61, 75, 0.92)',
  '--search-current-match-text-color': '#ffffff',
  '--search-current-match-shadow': 'inset 0 -0.78em 0 rgba(41, 88, 107, 0.98)',
  '--search-line-highlight': terminalAppearance.value.searchLineHighlightColor
}))

const focusSearchInput = () => {
  nextTick(() => {
    if (searchInput.value) {
      searchInput.value.focus()
      searchInput.value.select()
    }
  })
}

const clearSearchDebounce = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

const openSearch = () => {
  showSearch.value = true
  closeContextMenu()
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  focusSearchInput()
}

const getHexLengthPerLine = () => {
  const terminalCols = terminal?.cols || 100
  const reservedCols = 18
  return Math.max(4, terminalCols - reservedCols)
}

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

const clearFormattedLogCache = () => {
  formattedLogCache.clear()
}

const buildLogCacheKey = (log) => {
  return [
    log.id,
    portDisplaySettings.value.hexReceive ? 'hex' : 'text',
    portDisplaySettings.value.showAscii ? 'ascii' : 'plain',
    getHexLengthPerLine()
  ].join(':')
}

const formatLogLine = (log) => {
  const cacheKey = buildLogCacheKey(log)
  const cachedLine = formattedLogCache.get(cacheKey)
  if (cachedLine) {
    return cachedLine
  }

  const timestamp = log.timestamp.padEnd(8)
  const prefix = getLogPrefix(log.type)
  const maxCharsPerLine = getHexLengthPerLine()

  let content = ''
  if (portDisplaySettings.value.hexReceive && log.hexData) {
    const hexData = log.hexData
    const bytesPerLine = Math.floor(maxCharsPerLine / 3)

    if (hexData.length <= maxCharsPerLine) {
      content = hexData
    } else {
      const lines = []
      const hexBytes = hexData.split(' ')
      for (let i = 0; i < hexBytes.length; i += bytesPerLine) {
        const segment = hexBytes.slice(i, i + bytesPerLine).join(' ')
        const continuation = i > 0 ? '  ' : ''
        lines.push(continuation + segment)
      }
      content = lines.join('\n')
    }

    if (portDisplaySettings.value.showAscii) {
      const ascii = hexData.split(' ').map((h) => {
        const code = parseInt(h, 16)
        return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.'
      }).join('')
      content += ` [${ascii}]`
    }
  } else {
    content = log.message
  }

  const colorCodes = {
    tx: '\x1b[38;5;39m',
    rx: '\x1b[38;5;40m',
    info: '\x1b[38;5;252m',
    success: '\x1b[38;5;71m',
    error: '\x1b[38;5;196m',
    warning: '\x1b[38;5;214m'
  }

  const reset = '\x1b[0m'
  const color = colorCodes[log.type] || colorCodes.info
  const formattedLine = `${timestamp} ${color}${prefix}${reset} ${content}`

  formattedLogCache.set(cacheKey, formattedLine)
  if (formattedLogCache.size > MAX_LOG_COUNT * 8) {
    formattedLogCache.clear()
  }

  return formattedLine
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

const performSearch = () => {
  if (!terminal || !searchAddon) {
    searchMatchCount.value = 0
    currentMatchIndex.value = 0
    return
  }

  if (!searchQuery.value) {
    clearSearchHighlights()
    searchMatchCount.value = 0
    currentMatchIndex.value = 0
    return
  }

  clearSearchHighlights()
  searchAddon.findNext(searchQuery.value, getSearchOptions())
}

const debouncedSearch = () => {
  clearSearchDebounce()
  searchDebounceTimer = setTimeout(() => {
    performSearch()
  }, 150)
}

const goToNextMatch = () => {
  if (!searchQuery.value || !terminal || !searchAddon) return
  searchAddon.findNext(searchQuery.value, getSearchOptions())
}

const goToPreviousMatch = () => {
  if (!searchQuery.value || !terminal || !searchAddon) return
  searchAddon.findPrevious(searchQuery.value, getSearchOptions())
}

const handleSearchKeyDown = (event) => {
  if (event.key !== 'Enter') return

  if (event.shiftKey) {
    goToPreviousMatch()
    return
  }

  goToNextMatch()
}

const clearSearch = () => {
  showSearch.value = false
  searchQuery.value = ''
  searchMatchCount.value = 0
  currentMatchIndex.value = 0
  clearSearchDebounce()
  clearSearchHighlights()
}

const applyTerminalAppearance = () => {
  if (!terminal) return
  terminal.options.theme = getTerminalTheme()
  refreshSearchResults()
}

const loadHistoryLogs = () => {
  if (!terminal || !portLogs.value) return

  const logs = portLogs.value
  logEntries = []
  terminal.clear()

  const startIdx = Math.max(0, logs.length - MAX_LOG_COUNT)
  const lines = []
  for (let i = startIdx; i < logs.length; i++) {
    const log = logs[i]
    const line = formatLogLine(log)
    lines.push(line)
    logEntries.push({
      id: log.id,
      line: i - startIdx
    })
  }

  if (lines.length > 0) {
    terminal.write(`${lines.join('\r\n')}\r\n`)
  }

  const renderedLogs = logs.slice(startIdx)
  renderedLogCount = logs.length
  renderedFirstLogId = renderedLogs[0]?.id ?? null
  renderedLastLogId = renderedLogs[renderedLogs.length - 1]?.id ?? null
  terminal.scrollToBottom()
}

const addLogEntry = (log) => {
  if (!terminal) return

  const line = formatLogLine(log)
  terminal.writeln(line)
  logEntries.push({
    id: log.id,
    line: terminal.rows - 1
  })

  if (logEntries.length > MAX_LOG_COUNT) {
    logEntries.shift()
  }

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
    clearFormattedLogCache()
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

const refreshDisplay = () => {
  if (!terminal) return
  loadHistoryLogs()
  refreshSearchResults()
}

const handleResize = () => {
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
  }

  resizeDebounceTimer = setTimeout(() => {
    if (fitAddon) {
      fitAddon.fit()
      nextTick(() => {
        refreshDisplay()
      })
    }
  }, 100)
}

const initResizeObserver = () => {
  if (!terminalContainer.value || resizeObserver) return

  resizeObserver = new ResizeObserver(() => {
    handleResize()
  })
  resizeObserver.observe(terminalContainer.value)
}

const copySelection = async () => {
  const text = terminal?.getSelection()
  if (text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
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

const openSearchFromContextMenu = () => {
  openSearch()
}

const selectAll = () => {
  if (terminal?.element) {
    const range = document.createRange()
    range.selectNodeContents(terminal.element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  showContextMenu.value = false
}

const clearTerminalLogs = () => {
  serialStore.clearPortLogs(props.portPath)
  closeContextMenu()
}

const exportTerminalLogs = async () => {
  const payload = serialStore.buildPortLogExport(props.portPath)
  const suggestedName = `${props.portPath.replace(/[\\/:*?"<>|]/g, '_')}-logs-${new Date().toISOString().slice(0, 10)}.json`
  const result = await window.electronAPI?.exportLogs(payload, suggestedName)

  if (!result || result.canceled) {
    closeContextMenu()
    return
  }

  if (!result.success) {
    serialStore.setPortNotice(props.portPath, 'error', result.error || '导出日志失败')
    closeContextMenu()
    return
  }

  serialStore.setPortNotice(props.portPath, 'success', `日志已导出到 ${result.filePath}`)
  closeContextMenu()
}

const closeContextMenu = (event) => {
  if (event?.target?.closest('.context-menu')) return
  showContextMenu.value = false
  selectedText.value = ''
}

const handleContextMenu = (event) => {
  event.preventDefault()
  selectedText.value = terminal?.getSelection()?.trim() || ''
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  showContextMenu.value = true
}

const handleGlobalKeyDown = (event) => {
  if (showSearch.value && event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    clearSearch()
    return
  }

  if (searchQuery.value && event.key === 'F3') {
    event.preventDefault()
    event.stopPropagation()
    if (event.shiftKey) {
      goToPreviousMatch()
    } else {
      goToNextMatch()
    }
  }
}

const handleOpenSearch = (event) => {
  const targetPortPath = event?.detail?.portPath
  if (targetPortPath && targetPortPath !== props.portPath) return
  serialStore.selectedPort = props.portPath
  openSearch()
}

const handleKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && serialStore.selectedPort === props.portPath) {
    const selection = terminal?.getSelection()
    if (selection) {
      event.preventDefault()
      event.stopPropagation()
      copySelection()
    }
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && serialStore.selectedPort === props.portPath) {
    event.preventDefault()
    event.stopPropagation()
    openSearch()
  }
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

  loadHistoryLogs()

  searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
    searchMatchCount.value = resultCount
    currentMatchIndex.value = resultIndex >= 0 ? resultIndex + 1 : 0
  })

  window.addEventListener('resize', handleResize)
}

watch(searchQuery, () => {
  debouncedSearch()
})

watch(() => {
  const logs = portLogs.value || []
  return `${logs.length}:${logs[0]?.id ?? ''}:${logs[logs.length - 1]?.id ?? ''}`
}, () => {
  syncTerminalLogs()
})

watch([portDisplaySettings, portFilters], () => {
  clearFormattedLogCache()
  refreshDisplay()
}, { deep: true })

watch(terminalAppearance, () => {
  applyTerminalAppearance()
}, { deep: true })

watch(() => portDisplaySettings.value.hexReceive, () => {
  clearFormattedLogCache()
  refreshDisplay()
})

onMounted(() => {
  nextTick(() => {
    initTerminal()
    initResizeObserver()
  })

  document.addEventListener('keydown', handleGlobalKeyDown, true)
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('click', closeContextMenu)
  window.addEventListener('serialx-open-search', handleOpenSearch)

  if (terminalContainer.value) {
    terminalContainer.value.addEventListener('contextmenu', handleContextMenu)
  }
})

onUnmounted(() => {
  clearSearchDebounce()
  resetRenderedLogState()

  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
    resizeDebounceTimer = null
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  document.removeEventListener('keydown', handleGlobalKeyDown, true)
  document.removeEventListener('keydown', handleKeyDown, true)
  document.removeEventListener('click', closeContextMenu)
  window.removeEventListener('serialx-open-search', handleOpenSearch)
  window.removeEventListener('resize', handleResize)

  if (terminalContainer.value) {
    terminalContainer.value.removeEventListener('contextmenu', handleContextMenu)
  }

  if (terminal) {
    terminal.dispose()
    terminal = null
  }
})

defineExpose({
  refreshDisplay
})
</script>

<template>
  <div :class="['terminal-wrapper', { 'search-open': showSearch }]" :style="terminalCssVars">
    <div v-if="showSearch" class="search-widget">
      <div class="search-input-wrapper">
        <span class="search-chip">查找</span>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索终端内容..."
          @keydown.enter.prevent="handleSearchKeyDown"
        />
        <div class="search-controls">
          <span class="search-count">
            {{ !searchQuery ? '' : (searchMatchCount > 0 ? `${currentMatchIndex} / ${searchMatchCount}` : '无匹配项') }}
          </span>
          <button class="search-btn" title="上一个匹配 (Shift+Enter / Shift+F3)" @click="goToPreviousMatch">
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path d="M6 3 2 7h8Z" fill="currentColor" />
            </svg>
          </button>
          <button class="search-btn" title="下一个匹配 (Enter / F3)" @click="goToNextMatch">
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path d="M6 9 10 5H2Z" fill="currentColor" />
            </svg>
          </button>
          <button class="search-btn close" title="关闭 (Esc)" @click="clearSearch">
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path d="M2 2 10 10M10 2 2 10" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showContextMenu"
      class="context-menu"
      :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
      @click.stop
    >
      <div class="context-menu-item" @click="openSearchFromContextMenu">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.3" />
            <path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
        </span>
        <span>查找</span>
      </div>
      <div class="context-menu-item" :class="{ disabled: !selectedText }" @click="selectedText && copySelection()">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M6 3h7v10H6z" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M3 6h7v7H3z" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </span>
        <span>复制</span>
      </div>
      <div class="context-menu-item" @click="selectAll">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M3 3h10v10H3z" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M5 5h6v6H5z" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </span>
        <span>全选</span>
      </div>
      <div class="context-menu-item" @click="exportTerminalLogs">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M8 2v7.2l2.1-2.1.9.9L8 11 5 8l.9-.9L8 9.2V2Z" fill="currentColor" />
            <path d="M3 12h10v2H3z" fill="currentColor" />
          </svg>
        </span>
        <span>导出日志</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" @click="clearTerminalLogs">
        <span class="menu-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M5 4h6l-.5 9h-5z" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M4 4h8M6 4V2h4v2" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </span>
        <span>清空日志</span>
      </div>
    </div>

    <div ref="terminalContainer" :class="['terminal-container', { 'search-open': showSearch }]"></div>
  </div>
</template>

<style scoped>
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

.terminal-container ::v-deep(.xterm) {
  background: transparent !important;
  width: 100% !important;
  height: 100% !important;
}

.terminal-container ::v-deep(.xterm .xterm-screen),
.terminal-container ::v-deep(.xterm .xterm-screen-canvas),
.terminal-container ::v-deep(.xterm .xterm-rows),
.terminal-container ::v-deep(.xterm .xterm-scroll-area) {
  width: 100% !important;
  max-width: 100% !important;
}

.terminal-container ::v-deep(.xterm-rows > div) {
  width: auto !important;
  max-width: 100% !important;
}

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
  font-family: Consolas, "Monaco", monospace;
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

.context-menu {
  position: fixed;
  min-width: 148px;
  padding: 6px;
  border-radius: 10px;
  background: rgba(17, 25, 33, 0.96);
  border: 1px solid rgba(126, 161, 183, 0.14);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(14px);
  z-index: 10000;
  animation: fadeIn 0.14s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  color: #d8e5ee;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.context-menu-item:hover {
  background: rgba(87, 199, 255, 0.14);
  color: #ffffff;
}

.context-menu-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.context-menu-item.disabled:hover {
  background: transparent;
  color: #d8e5ee;
}

.context-menu-item.danger:hover {
  background: rgba(196, 43, 28, 0.86);
}

.context-menu-divider {
  height: 1px;
  margin: 6px 2px;
  background: rgba(126, 161, 183, 0.18);
}

.menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
