// 中文语言包
export default {
  app: {
    title: 'SerialX - 串口调试工具',
    subtitle: '串口调试工具'
  },
  serial: {
    port: '串口',
    baudRate: '波特率',
    dataBits: '数据位',
    stopBits: '停止位',
    parity: '校验位',
    connect: '打开串口',
    disconnect: '关闭串口',
    refresh: '刷新',
    customBaud: '自定义波特率',
    noPorts: '未找到串口设备',
    connected: '已连接',
    disconnected: '未连接'
  },
  parityOptions: {
    none: '无',
    even: '偶校验',
    odd: '奇校验',
    mark: '标记校验',
    space: '空校验'
  },
  terminal: {
    title: '终端',
    autoScroll: '自动滚动',
    clear: '清空',
    noData: '暂无数据',
    hint: '连接串口后开始接收数据'
  },
  send: {
    placeholder: '输入要发送的数据...',
    send: '发送',
    hexMode: '十六进制',
    loopSend: '循环发送',
    interval: '间隔 (ms)'
  },
  log: {
    tx: '发送',
    rx: '接收',
    info: '信息',
    error: '错误',
    success: '成功',
    warning: '警告'
  }
}
