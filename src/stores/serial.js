import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
  const isHexMode = ref(false)
  const isAutoScroll = ref(true)
  const isLoopSend = ref(false)
  const loopInterval = ref(1000)
  let loopTimer = null

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

  async function sendData(portPath = null, data = null) {
    const targetPort = portPath || selectedPort.value
    const dataToSend = data !== null ? data : getPortSendingData(targetPort)

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

    try {
      const result = await window.electronAPI.writeData(targetPort, dataToSend)
      if (result.success) {
        addPortLog(targetPort, `TX: ${dataToSend}`, 'tx')
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
        sendData(targetPort, dataToSend)
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

  function addPortLog(portPath, message, type = 'info') {
    if (!portLogs.value.has(portPath)) {
      portLogs.value.set(portPath, [])
    }

    const portLog = portLogs.value.get(portPath)
    const timestamp = new Date().toLocaleTimeString()
    portLog.push({
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type
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

  // Set up event listeners
  function setupEventListeners() {
    window.electronAPI.onSerialData(({ port, data }) => {
      // 过滤检查：如果数据被过滤，直接丢弃不显示
      if (shouldFilterLog(port, 'rx', data)) {
        return
      }
      addPortLog(port, `RX: ${data}`, 'rx')
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
    // Getters
    availableBaudRates,
    getPortStatus,
    getPortSettings,
    getPortSendingData,
    setPortSendingData,
    getPortFilters,
    setPortFilters,
    shouldFilterLog,
    getFilteredCount,
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
    setupEventListeners
  }
})
