import { defineStore } from 'pinia'
import { ref, computed, watch, reactive } from 'vue'

export const useSerialStore = defineStore('serial', () => {
  // State
  const ports = ref([])
  const selectedPort = ref(null)

  // 多串口支持：每个串口独立的状态
  const openPorts = ref(new Map()) // path -> { baudRate, dataBits, stopBits, parity, isConnected }
  const portLogs = ref(new Map())  // path -> log array
  const portSettings = ref(new Map()) // path -> settings object
  const portSendingData = ref(new Map()) // path -> sending data string
  const portFilters = ref(new Map()) // path -> { enabled, mode, matchMode, pattern } mode: 'discard' | 'hide', matchMode: 'keyword' | 'regex'

  // 当前选中的串口设置（用于新建连接）
  const defaultSettings = ref({
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
  })

  // 全局配置
  const logs = ref([])
  let loopTimer = null
  const portLoopSendCounts = reactive(new Map()) // path -> 已发送次数
  const portLoopSendPaused = reactive(new Map()) // path -> 是否暂停

  // 每个串口的显示设置（独立配置）
  const portDisplaySettings = ref(new Map()) // path -> { hexReceive: boolean, showAscii: boolean }

  // 每个串口的控制设置（独立配置）
  const portControlSettings = ref(new Map()) // path -> { isAutoScroll: boolean, isLoopSend: boolean, loopInterval: number, loopMaxCount: number, hexSend: boolean, packetTimeout: number }

  // 获取串口控制设置
  const getPortControlSettings = (portPath) => {
    if (!portControlSettings.value.has(portPath)) {
      portControlSettings.value.set(portPath, {
        isAutoScroll: true,
        isLoopSend: false,
        loopInterval: 1000,
        loopMaxCount: 0,
        hexSend: false,
        packetTimeout: 500 // 分包超时时间（毫秒）
      })
    }
    return portControlSettings.value.get(portPath)
  }

  // 更新串口控制设置
  const updatePortControlSettings = (portPath, updates) => {
    const current = getPortControlSettings(portPath)
    portControlSettings.value.set(portPath, { ...current, ...updates })
    // 配置变更时自动保存
    saveSessionState()
  }

  // 每个串口的统计数据
  const portStats = ref(new Map()) // path -> { txBytes: number, txCount: number, rxBytes: number, rxCount: number, startTime: string, lastCommTime: string }

  // 获取串口统计数据
  const getPortStats = (portPath) => {
    if (!portStats.value.has(portPath)) {
      portStats.value.set(portPath, {
        txBytes: 0,
        txCount: 0,
        rxBytes: 0,
        rxCount: 0,
        startTime: new Date().toLocaleString(),
        lastCommTime: null
      })
    }
    return portStats.value.get(portPath)
  }

  // 更新串口统计数据
  const updatePortStats = (portPath, type, byteCount) => {
    const stats = getPortStats(portPath)
    stats.lastCommTime = new Date().toLocaleString()
    if (type === 'tx') {
      stats.txBytes += byteCount
      stats.txCount += 1
    } else if (type === 'rx') {
      stats.rxBytes += byteCount
      stats.rxCount += 1
    }
  }

  // 重置串口统计数据
  const resetPortStats = (portPath) => {
    portStats.value.set(portPath, {
      txBytes: 0,
      txCount: 0,
      rxBytes: 0,
      rxCount: 0,
      startTime: new Date().toLocaleString(),
      lastCommTime: null
    })
  }

  // 获取串口显示设置
  const getPortDisplaySettings = (portPath) => {
    if (!portDisplaySettings.value.has(portPath)) {
      portDisplaySettings.value.set(portPath, {
        hexReceive: false,
        showAscii: true
      })
    }
    return portDisplaySettings.value.get(portPath)
  }

  // 更新串口显示设置
  const updatePortDisplaySettings = (portPath, updates) => {
    const current = getPortDisplaySettings(portPath)
    portDisplaySettings.value.set(portPath, { ...current, ...updates })
    // 配置变更时自动保存
    saveSessionState()
  }

  // 保存会话状态到本地存储
  const saveSessionState = async () => {
    try {
      const state = {
        defaultSettings: defaultSettings.value,
        portDisplaySettings: Object.fromEntries(portDisplaySettings.value),
        portControlSettings: Object.fromEntries(portControlSettings.value),
        commonCommands: commonCommands.value
      }
      localStorage.setItem('serialx-session-state', JSON.stringify(state))
    } catch (error) {
      console.error('[Store] Error saving session state:', error)
    }
  }

  // 恢复会话状态
  const restoreSessionState = async () => {
    try {
      const saved = localStorage.getItem('serialx-session-state')
      if (saved) {
        const state = JSON.parse(saved)
        if (state.defaultSettings) {
          Object.assign(defaultSettings.value, state.defaultSettings)
        }
        if (state.portDisplaySettings) {
          portDisplaySettings.value = new Map(Object.entries(state.portDisplaySettings))
        }
        if (state.portControlSettings) {
          portControlSettings.value = new Map(Object.entries(state.portControlSettings))
        }
        if (state.commonCommands) {
          commonCommands.value = state.commonCommands
        }
      }
    } catch (error) {
      console.error('[Store] Error restoring session state:', error)
    }
  }

  // 常用命令配置（全局统一配置）- 初始为空，从配置文件加载
  const commonCommands = ref([])

  // 从配置文件加载常用命令
  const loadCommonCommands = async () => {
    try {
      const config = await window.electronAPI.loadConfig()
      if (config.commonCommands && config.commonCommands.length > 0) {
        commonCommands.value = config.commonCommands
      } else {
        // 使用默认配置
        commonCommands.value = [
          { id: 1, name: '复位', command: 'RESET', enabled: true },
          { id: 2, name: '状态查询', command: 'STATUS?', enabled: true },
          { id: 3, name: '版本信息', command: 'VERSION', enabled: true },
          { id: 4, name: '帮助', command: 'HELP', enabled: true }
        ]
      }
    } catch (error) {
      console.error('[Store] Error loading config:', error)
      // 使用默认配置
      commonCommands.value = [
        { id: 1, name: '复位', command: 'RESET', enabled: true },
        { id: 2, name: '状态查询', command: 'STATUS?', enabled: true },
        { id: 3, name: '版本信息', command: 'VERSION', enabled: true },
        { id: 4, name: '帮助', command: 'HELP', enabled: true }
      ]
    }
  }

  // 保存常用命令到配置文件
  const saveCommonCommands = async () => {
    try {
      const config = await window.electronAPI.loadConfig()
      // 使用 JSON 序列化处理响应式对象，避免无法克隆的错误
      config.commonCommands = JSON.parse(JSON.stringify(commonCommands.value))
      await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('[Store] Error saving config:', error)
    }
  }

  // 监听常用命令变化，自动保存
  watch(() => commonCommands.value, () => {
    saveCommonCommands()
  }, { deep: true })

  // Getters
  const availableBaudRates = computed(() => [
    300, 1200, 2400, 4800, 9600, 14400, 19200, 28800,
    38400, 57600, 74880, 115200, 230400, 460800, 921600
  ])

  const getPortStatus = (portPath) => {
    const port = openPorts.value.get(portPath)
    return port ? port.isConnected : false
  }

  const getPortSettings = (portPath) => {
    return portSettings.value.get(portPath) || defaultSettings.value
  }

  const getPortSendingData = (portPath) => {
    return portSendingData.value.get(portPath) || ''
  }

  const setPortSendingData = (portPath, data) => {
    portSendingData.value.set(portPath, data)
  }

  // 获取/设置过滤器
  const getPortFilters = (portPath) => {
    return portFilters.value.get(portPath) || {
      enabled: false,
      mode: 'discard', // 'discard' | 'hide'
      matchMode: 'regex', // 'keyword' | 'regex'
      pattern: '',
      filterTarget: 'both' // 'hexData' | 'asciiData' | 'both'
    }
  }

  const setPortFilters = (portPath, filters) => {
    const current = getPortFilters(portPath)
    portFilters.value.set(portPath, { ...current, ...filters })
    // 配置变更时自动保存
    saveSessionState()
  }

  // 检查日志是否应该被过滤（返回 true 表示过滤掉）
  const shouldFilterLog = (portPath, logType, message, rawHexData = null, asciiData = null) => {
    const filters = getPortFilters(portPath)
    if (!filters.enabled) return false

    // 只过滤 RX 数据
    if (logType !== 'rx') return false

    // 没有 pattern 不过滤
    if (!filters.pattern) return false

    // 确定要检查的数据内容
    const hexReceive = portDisplaySettings.value.get(portPath)?.hexReceive ?? false
    const filterTarget = filters.filterTarget || 'both'

    let dataToCheck = []

    if (hexReceive) {
      // HEX 模式下根据 filterTarget 决定检查哪些数据
      if (filterTarget === 'hexData' && rawHexData) {
        dataToCheck.push(rawHexData)
      } else if (filterTarget === 'asciiData' && rawHexData) {
        // 从 hexData 反向计算 ASCII
        const ascii = rawHexData.split(' ').map(h => {
          const code = parseInt(h, 16)
          return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
        }).join('')
        dataToCheck.push(ascii)
      } else if (filterTarget === 'both') {
        if (rawHexData) dataToCheck.push(rawHexData)
        if (rawHexData) {
          const ascii = rawHexData.split(' ').map(h => {
            const code = parseInt(h, 16)
            return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.'
          }).join('')
          dataToCheck.push(ascii)
        }
      }
    } else {
      // 文本模式只检查 message
      dataToCheck.push(message)
    }

    // 如果没有数据可检查，不过滤
    if (dataToCheck.length === 0) return false

    // 关键字匹配
    if (filters.matchMode === 'keyword') {
      return dataToCheck.some(data => data.includes(filters.pattern))
    }

    // 正则表达式匹配
    if (filters.matchMode === 'regex') {
      try {
        const regex = new RegExp(filters.pattern)
        return dataToCheck.some(data => regex.test(data))
      } catch {
        return false
      }
    }

    return false
  }

  // 获取被过滤的日志数量
  const getFilteredCount = (portPath) => {
    const filters = getPortFilters(portPath)
    if (!filters.enabled || !filters.pattern) return 0

    const logs = portLogs.value.get(portPath) || []
    return logs.filter(log => shouldFilterLog(portPath, log.type, log.message, log.hexData, null)).length
  }

  // Actions
  async function refreshPorts() {
    try {
      const portList = await window.electronAPI.listPorts()
      ports.value = portList
      return portList
    } catch (error) {
      console.error('Error refreshing ports:', error)
      addLog(`刷新端口失败：${error.message}`, 'error')
      return []
    }
  }

  async function connect(portPath = null, settings = null) {
    const targetPort = portPath || selectedPort.value
    if (!targetPort) {
      addLog('请选择串口', 'error')
      return false
    }

    const connectionSettings = {
      path: targetPort,
      ...(settings || defaultSettings.value)
    }

    try {
      const result = await window.electronAPI.openPort(connectionSettings)

      if (result.success) {
        openPorts.value.set(targetPort, {
          isConnected: true,
          baudRate: connectionSettings.baudRate,
          dataBits: connectionSettings.dataBits,
          stopBits: connectionSettings.stopBits,
          parity: connectionSettings.parity
        })
        portSettings.value.set(targetPort, connectionSettings)
        // 如果是首次连接，初始化日志数组；否则保留之前的日志
        if (!portLogs.value.has(targetPort)) {
          portLogs.value.set(targetPort, [])
        }
        // 如果是首次连接，初始化过滤器
        if (!portFilters.value.has(targetPort)) {
          portFilters.value.set(targetPort, {
            enabled: false,
            mode: 'discard',
            matchMode: 'regex',
            pattern: ''
          })
        }
        addPortLog(targetPort, `已连接，波特率：${connectionSettings.baudRate}`, 'success')
        return true
      } else {
        addPortLog(targetPort, `连接失败：${result.error}`, 'error')
        return false
      }
    } catch (error) {
      console.error('Connection error:', error)
      addPortLog(targetPort, `连接错误：${error.message}`, 'error')
      return false
    }
  }

  async function disconnect(portPath = null) {
    const targetPort = portPath || selectedPort.value
    if (!targetPort) {
      addPortLog(targetPort, '请选择串口', 'error')
      return false
    }

    try {
      const result = await window.electronAPI.closePort(targetPort)
      if (result.success) {
        openPorts.value.delete(targetPort)
        // 保留日志数据、过滤设置、统计数据，只删除连接状态
        stopLoopSendForPort(targetPort)
        addPortLog(targetPort, `已断开`, 'info')
        return true
      }
    } catch (error) {
      addPortLog(targetPort, `断开连接错误：${error.message}`, 'error')
    }
    return false
  }

  async function disconnectAll() {
    try {
      const result = await window.electronAPI.closePort()
      openPorts.value.clear()
      // 保留日志数据、过滤设置、统计数据，只删除连接状态
      stopLoopSend()
      return result.success
    } catch (error) {
      return false
    }
  }

  // Hex 工具函数：将 Hex 字符串转换为 Uint8Array
  const hexToBytes = (hexString) => {
    if (!hexString) return new Uint8Array(0)
    const cleanHex = hexString.replace(/[\s,-]/g, '').toUpperCase()
    if (!/^[0-9A-F]+$/.test(cleanHex)) {
      throw new Error('无效的 Hex 格式')
    }
    const paddedHex = cleanHex.length % 2 === 1 ? '0' + cleanHex : cleanHex
    const bytes = new Uint8Array(paddedHex.length / 2)
    for (let i = 0; i < paddedHex.length; i += 2) {
      bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16)
    }
    return bytes
  }

  // Hex 工具函数：将 Uint8Array 转换为 Hex 字符串（带空格分隔）
  const bytesToHex = (bytes) => {
    if (!bytes || bytes.length === 0) return ''
    return Array.from(bytes)
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ')
  }

  // Hex 工具函数：验证 Hex 字符串是否有效
  const isValidHex = (hexString) => {
    if (!hexString) return false
    const cleanHex = hexString.replace(/[\s,-]/g, '').toUpperCase()
    return cleanHex.length > 0 && /^[0-9A-F]+$/.test(cleanHex)
  }

  // 字节转字符串（支持 ASCII 和 UTF-8 中文）
  const bytesToString = (bytes) => {
    if (!bytes || !Array.isArray(bytes) || bytes.length === 0) return ''
    try {
      const uint8Array = new Uint8Array(bytes)
      const decoder = new TextDecoder('utf-8', { fatal: false })
      return decoder.decode(uint8Array)
    } catch {
      return bytes.map(b => {
        const char = String.fromCharCode(b)
        return (b >= 32 && b <= 126) ? char : '.'
      }).join('')
    }
  }

  async function sendData(portPath = null, data = null, isHex = false) {
    const targetPort = portPath || selectedPort.value
    let dataToSend = data !== null ? data : getPortSendingData(targetPort)

    if (!targetPort) {
      return { success: false, error: '请选择串口' }
    }

    if (!dataToSend) {
      return { success: false, error: '没有数据' }
    }

    const isConnected = openPorts.value.get(targetPort)?.isConnected
    if (!isConnected) {
      return { success: false, error: `串口 ${targetPort} 未打开` }
    }

    // Hex 模式：将十六进制字符串转换为字节数组
    let actualData = dataToSend
    let logData = dataToSend
    let rawBytes = null

    if (isHex) {
      try {
        const hexString = dataToSend.replace(/[\s,-]/g, '').toUpperCase()
        if (hexString.length === 0) {
          addPortLog(targetPort, '发送失败：Hex 模式下请输入有效的十六进制数据', 'error')
          return { success: false, error: 'Hex 数据为空' }
        }
        if (!/^[0-9A-F]+$/.test(hexString)) {
          addPortLog(targetPort, `发送失败：无效的 Hex 格式，请输入 0-9 和 A-F 字符`, 'error')
          return { success: false, error: '无效的 Hex 格式' }
        }
        actualData = hexToBytes(hexString)
        rawBytes = Array.from(actualData)
        logData = dataToSend
      } catch (error) {
        addPortLog(targetPort, `Hex 转换失败：${error.message}`, 'error')
        return { success: false, error: `Hex 转换失败：${error.message}` }
      }
    } else {
      // 非 Hex 模式也保存原始字节，方便切换查看
      rawBytes = Array.from(new TextEncoder().encode(dataToSend))
    }

    try {
      const result = await window.electronAPI.writeData(targetPort, actualData)
      if (result.success) {
        // 更新统计数据
        const byteCount = actualData instanceof Uint8Array ? actualData.length : new TextEncoder().encode(actualData).length
        updatePortStats(targetPort, 'tx', byteCount)

        // 传递原始字节用于 Hex/ASCII 显示，message 只保留纯数据不含 TX/RX 前缀
        const logData_raw = rawBytes ? {
          hexData: bytesToHex(rawBytes),
          rawBytes,
          message: logData
        } : null
        addPortLog(targetPort, logData, 'tx', logData_raw)
        return { success: true }
      } else {
        addPortLog(targetPort, `发送失败：${result.error}`, 'error')
        return { success: false, error: result.error }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  function startLoopSend(portPath = null) {
    const targetPort = portPath || selectedPort.value
    if (!targetPort || !getPortSendingData(targetPort)) {
      addPortLog(targetPort, '循环发送失败：没有数据', 'error')
      return
    }

    // 获取该串口的循环发送设置
    const portControl = getPortControlSettings(targetPort)

    // 初始化该串口的发送计数
    portLoopSendCounts.set(targetPort, 0)
    portLoopSendPaused.set(targetPort, false)

    const loopData = { port: targetPort, timer: null }

    // 立即发送第一帧
    sendData(targetPort, getPortSendingData(targetPort), portControl.hexSend)
      .then(() => {
        portLoopSendCounts.set(targetPort, 1)
      })

    loopData.timer = setInterval(async () => {
      const portStatus = openPorts.value.get(targetPort)
      const dataToSend = getPortSendingData(targetPort)
      // 检查是否暂停
      const isPaused = portLoopSendPaused.get(targetPort)
      if (isPaused) return

      if (portStatus?.isConnected && dataToSend) {
        // 检查是否达到最大发送次数
        const currentCount = portLoopSendCounts.get(targetPort) || 0
        if (portControl.loopMaxCount > 0 && currentCount >= portControl.loopMaxCount) {
          stopLoopSendForPort(targetPort)
          updatePortControlSettings(targetPort, { isLoopSend: false })
          addPortLog(targetPort, `循环发送已达到上限 (${portControl.loopMaxCount} 次)`, 'info')
          return
        }
        await sendData(targetPort, dataToSend, portControl.hexSend)
        // 更新发送计数
        portLoopSendCounts.set(targetPort, currentCount + 1)
      }
    }, portControl.loopInterval)

    loopTimer = loopData.timer
    updatePortControlSettings(targetPort, { isLoopSend: true })
    addPortLog(targetPort, `循环发送已启动 (间隔：${portControl.loopInterval}ms${portControl.loopMaxCount > 0 ? `, 上限：${portControl.loopMaxCount} 次` : ''})`, 'info')
  }

  function pauseLoopSendForPort(portPath) {
    portLoopSendPaused.set(portPath, true)
    addPortLog(portPath, '循环发送已暂停', 'info')
  }

  function resumeLoopSendForPort(portPath) {
    portLoopSendPaused.set(portPath, false)
    addPortLog(portPath, '循环发送已恢复', 'info')
  }

  function togglePauseLoopSendForPort(portPath) {
    const isPaused = portLoopSendPaused.get(portPath) || false
    if (isPaused) {
      resumeLoopSendForPort(portPath)
    } else {
      pauseLoopSendForPort(portPath)
    }
    return !isPaused
  }

  function isLoopSendPaused(portPath) {
    return portLoopSendPaused.get(portPath) || false
  }

  function stopLoopSendForPort(portPath) {
    // 如果只停止特定串口的循环发送
    if (loopTimer) {
      clearInterval(loopTimer)
      loopTimer = null
    }
    // 重置暂停状态
    portLoopSendPaused.set(portPath, false)
  }

  function stopLoopSend() {
    if (loopTimer) {
      clearInterval(loopTimer)
      loopTimer = null
    }
    isLoopSend.value = false
  }

  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
    logs.value.push({
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type
    })

    // Limit log history
    if (logs.value.length > 1000) {
      logs.value.shift()
    }
  }

  // 批量添加日志 - 减少响应式触发
  let logBatchBuffer = new Map() // portPath -> log batch array
  let logFlushTimer = null
  const LOG_BATCH_SIZE = 5 // 每批最多 5 条日志
  const LOG_BATCH_INTERVAL = 100 // 100ms 刷新一次

  function flushLogBatch() {
    for (const [portPath, batch] of logBatchBuffer.entries()) {
      const portLog = portLogs.value.get(portPath)
      if (!portLog) continue

      // 批量添加日志
      for (const logEntry of batch) {
        portLog.push(logEntry)
      }

      // 清理旧日志 - 使用更激进的清理策略
      if (portLog.length > 800) {
        portLog.splice(0, portLog.length - 800)
      }
    }
    logBatchBuffer.clear()
  }

  function addPortLog(portPath, message, type = 'info', rawData = null) {
    if (!portLogs.value.has(portPath)) {
      portLogs.value.set(portPath, [])
    }

    const timestamp = new Date().toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type,
      hexData: rawData?.hexData || null,
      // 不存储 rawBytes，节省内存，需要时从 hexData 反向计算
      pureData: rawData?.message ?? message
    }

    // 加入批处理缓冲
    if (!logBatchBuffer.has(portPath)) {
      logBatchBuffer.set(portPath, [])
    }
    const batch = logBatchBuffer.get(portPath)
    batch.push(logEntry)

    // 达到批量大小立即刷新
    if (batch.length >= LOG_BATCH_SIZE) {
      flushLogBatch()
      if (logFlushTimer) {
        clearTimeout(logFlushTimer)
        logFlushTimer = null
      }
    } else if (!logFlushTimer) {
      // 启动定时器
      logFlushTimer = setTimeout(() => {
        logFlushTimer = null
        flushLogBatch()
      }, LOG_BATCH_INTERVAL)
    }
  }

  function getPortLogs(portPath) {
    return portLogs.value.get(portPath) || []
  }

  function clearLogs() {
    logs.value = []
    portLogs.value.clear()
  }

  function clearPortLogs(portPath) {
    // 创建新 Map 触发响应式更新
    const newMap = new Map(portLogs.value)
    newMap.set(portPath, [])
    portLogs.value = newMap
  }

  function formatDisplayData(data) {
    return data
  }

  function updateDefaultSetting(key, value) {
    defaultSettings.value[key] = value
  }

  // 常用命令操作
  const addCommonCommand = (name, command) => {
    commonCommands.value.push({
      id: Date.now(),
      name,
      command,
      enabled: true
    })
  }

  const removeCommonCommand = (id) => {
    commonCommands.value = commonCommands.value.filter(cmd => cmd.id !== id)
  }

  const updateCommonCommand = (id, updates) => {
    const cmd = commonCommands.value.find(c => c.id === id)
    if (cmd) {
      Object.assign(cmd, updates)
    }
  }

  const toggleCommandEnabled = (id) => {
    const cmd = commonCommands.value.find(c => c.id === id)
    if (cmd) {
      cmd.enabled = !cmd.enabled
    }
  }

  const getEnabledCommands = computed(() => {
    return commonCommands.value.filter(cmd => cmd.enabled)
  })

  // Set up event listeners
  function setupEventListeners() {
    window.electronAPI.onSerialData(({ port, data, hexData, rawBytes }) => {
      // 过滤检查：如果数据被过滤，直接丢弃不显示
      if (shouldFilterLog(port, 'rx', data, hexData, null)) {
        return
      }
      // 更新统计数据
      const byteCount = rawBytes ? rawBytes.length : new TextEncoder().encode(data).length
      updatePortStats(port, 'rx', byteCount)
      // 存储原始数据用于 Hex 显示，message 只保存纯数据
      addPortLog(port, data, 'rx', { hexData, message: data })
    })

    window.electronAPI.onSerialError(({ port, error }) => {
      addPortLog(port, `错误：${error}`, 'error')
    })

    window.electronAPI.onPortClosed(({ port }) => {
      openPorts.value.delete(port)
    })
  }

  // 必须在 setupEventListeners 调用前绑定 this
  setupEventListeners()

  return {
    // State
    ports,
    selectedPort,
    openPorts,
    portLogs,
    portSettings,
    portSendingData,
    portFilters,
    defaultSettings,
    logs,
    commonCommands,
    portLoopSendCounts,
    portLoopSendPaused,
    // Getters
    availableBaudRates,
    getEnabledCommands,
    getPortStatus,
    getPortSettings,
    getPortSendingData,
    setPortSendingData,
    getPortFilters,
    setPortFilters,
    shouldFilterLog,
    getFilteredCount,
    getPortDisplaySettings,
    updatePortDisplaySettings,
    getPortStats,
    resetPortStats,
    getPortControlSettings,
    updatePortControlSettings,
    // Hex 工具函数
    hexToBytes,
    bytesToHex,
    isValidHex,
    // Actions
    refreshPorts,
    connect,
    disconnect,
    disconnectAll,
    sendData,
    startLoopSend,
    stopLoopSendForPort,
    stopLoopSend,
    pauseLoopSendForPort,
    resumeLoopSendForPort,
    togglePauseLoopSendForPort,
    isLoopSendPaused,
    addLog,
    addPortLog,
    getPortLogs,
    clearLogs,
    clearPortLogs,
    formatDisplayData,
    updateDefaultSetting,
    setupEventListeners,
    addCommonCommand,
    removeCommonCommand,
    updateCommonCommand,
    toggleCommandEnabled,
    loadCommonCommands,
    saveCommonCommands,
    saveSessionState,
    restoreSessionState
  }
})
