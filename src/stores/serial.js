import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

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
  const isHexMode = ref(false) // 发送 Hex 模式
  const isAutoScroll = ref(true)
  const isLoopSend = ref(false)
  const loopInterval = ref(1000)
  let loopTimer = null

  // 每个串口的显示设置（独立配置）
  const portDisplaySettings = ref(new Map()) // path -> { hexMode: boolean, showAscii: boolean }

  // 获取串口显示设置
  const getPortDisplaySettings = (portPath) => {
    if (!portDisplaySettings.value.has(portPath)) {
      portDisplaySettings.value.set(portPath, {
        hexMode: false,
        showAscii: true
      })
    }
    return portDisplaySettings.value.get(portPath)
  }

  // 更新串口显示设置
  const updatePortDisplaySettings = (portPath, updates) => {
    const current = getPortDisplaySettings(portPath)
    portDisplaySettings.value.set(portPath, { ...current, ...updates })
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
      pattern: ''
    }
  }

  const setPortFilters = (portPath, filters) => {
    const current = getPortFilters(portPath)
    portFilters.value.set(portPath, { ...current, ...filters })
  }

  // 检查日志是否应该被过滤（返回 true 表示过滤掉）
  const shouldFilterLog = (portPath, logType, message) => {
    const filters = getPortFilters(portPath)
    if (!filters.enabled) return false

    // 只过滤 RX 数据
    if (logType !== 'rx') return false

    // 没有pattern 不过滤
    if (!filters.pattern) return false

    // 关键字匹配
    if (filters.matchMode === 'keyword') {
      return message.includes(filters.pattern)
    }

    // 正则表达式匹配
    if (filters.matchMode === 'regex') {
      try {
        const regex = new RegExp(filters.pattern)
        return regex.test(message)
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
    return logs.filter(log => shouldFilterLog(portPath, log.type, log.message)).length
  }

  // Actions
  async function refreshPorts() {
    try {
      console.log('Refreshing serial ports...')
      const portList = await window.electronAPI.listPorts()
      console.log('Available ports:', portList)
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
      console.log('Opening port:', targetPort, connectionSettings)
      const result = await window.electronAPI.openPort(connectionSettings)
      console.log('Open port result:', result)

      if (result.success) {
        openPorts.value.set(targetPort, {
          isConnected: true,
          baudRate: connectionSettings.baudRate,
          dataBits: connectionSettings.dataBits,
          stopBits: connectionSettings.stopBits,
          parity: connectionSettings.parity
        })
        portSettings.value.set(targetPort, connectionSettings)
        portLogs.value.set(targetPort, [])
        portFilters.value.set(targetPort, {
          enabled: false,
          mode: 'discard',
          matchMode: 'regex',
          pattern: ''
        })
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
        portLogs.value.delete(targetPort)
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
      portLogs.value.clear()
      stopLoopSend()
      return result.success
    } catch (error) {
      return false
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
    if (isHex) {
      try {
        // 移除空格和常见分隔符，只保留十六进制字符
        const hexString = dataToSend.replace(/[\s,-]/g, '').toUpperCase()
        // 空字符串允许直接发送
        if (hexString.length === 0) {
          addPortLog(targetPort, '发送失败：Hex 模式下请输入有效的十六进制数据', 'error')
          return { success: false, error: 'Hex 数据为空' }
        }
        // 验证是否为有效的十六进制字符串
        if (!/^[0-9A-F]+$/.test(hexString)) {
          addPortLog(targetPort, `发送失败：无效的 Hex 格式，请输入 0-9 和 A-F 字符`, 'error')
          return { success: false, error: '无效的 Hex 格式' }
        }
        // 如果长度是奇数，在前面补 0
        const paddedHex = hexString.length % 2 === 1 ? '0' + hexString : hexString
        // 转换为字节数组
        const bytes = []
        for (let i = 0; i < paddedHex.length; i += 2) {
          bytes.push(parseInt(paddedHex.substr(i, 2), 16))
        }
        actualData = Buffer.from(bytes)
        logData = dataToSend // 日志仍显示原始输入的 Hex 字符串
      } catch (error) {
        addPortLog(targetPort, `Hex 转换失败：${error.message}`, 'error')
        return { success: false, error: `Hex 转换失败：${error.message}` }
      }
    }

    try {
      const result = await window.electronAPI.writeData(targetPort, actualData)
      if (result.success) {
        addPortLog(targetPort, `TX: ${logData}`, 'tx')
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
    if (!targetPort || !getPortSendingData(targetPort)) return

    const loopData = { port: targetPort, timer: null }

    loopData.timer = setInterval(() => {
      const portStatus = openPorts.value.get(targetPort)
      const dataToSend = getPortSendingData(targetPort)
      if (portStatus?.isConnected && dataToSend) {
        sendData(targetPort, dataToSend, isHexMode.value)
      }
    }, loopInterval.value)

    loopTimer = loopData.timer
    addPortLog(targetPort, `循环发送已启动 (间隔：${loopInterval.value}ms)`, 'info')
  }

  function stopLoopSendForPort(portPath) {
    // 如果只停止特定串口的循环发送
    if (loopTimer) {
      clearInterval(loopTimer)
      loopTimer = null
    }
  }

  function stopLoopSend() {
    if (loopTimer) {
      clearInterval(loopTimer)
      loopTimer = null
    }
    isLoopSend.value = false
  }

  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString()
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

  function addPortLog(portPath, message, type = 'info', rawData = null) {
    if (!portLogs.value.has(portPath)) {
      portLogs.value.set(portPath, [])
    }

    const portLog = portLogs.value.get(portPath)
    const timestamp = new Date().toLocaleTimeString()
    portLog.push({
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type,
      hexData: rawData?.hexData || null,
      rawBytes: rawData?.rawBytes || null
    })

    // Limit log history per port
    if (portLog.length > 1000) {
      portLog.shift()
    }
  }

  function getPortLogs(portPath) {
    return portLogs.value.get(portPath) || []
  }

  function clearLogs() {
    logs.value = []
    portLogs.value.clear()
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
      if (shouldFilterLog(port, 'rx', data)) {
        return
      }
      // 存储原始数据用于 Hex 显示
      addPortLog(port, `RX: ${data}`, 'rx', { hexData, rawBytes })
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
    isHexMode,
    isAutoScroll,
    isLoopSend,
    loopInterval,
    commonCommands,
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
    // Actions
    refreshPorts,
    connect,
    disconnect,
    disconnectAll,
    sendData,
    startLoopSend,
    stopLoopSendForPort,
    stopLoopSend,
    addLog,
    addPortLog,
    getPortLogs,
    clearLogs,
    formatDisplayData,
    updateDefaultSetting,
    setupEventListeners,
    addCommonCommand,
    removeCommonCommand,
    updateCommonCommand,
    toggleCommandEnabled,
    loadCommonCommands,
    saveCommonCommands
  }
})
