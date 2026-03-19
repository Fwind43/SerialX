<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  standalone: {
    type: Boolean,
    default: false
  }
})

const inputHex = ref('')
const inputDecimal = ref('')
const inputBinary = ref('')
const inputFloat32 = ref('')
const inputFloat64 = ref('')
const inputInt8 = ref('')
const inputUint8 = ref('')
const inputInt16 = ref('')
const inputUint16 = ref('')
const inputInt32 = ref('')
const inputUint32 = ref('')

// 字节序：little-endian 或 big-endian
const byteOrder = ref('little')

// 防抖转换
let debounceTimer = null
const debouncedConvert = (fn) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fn, 50)
}

// 独立窗口时添加全局快捷键 Alt+C 和 Ctrl+W 关闭
onMounted(() => {
  if (props.standalone) {
    window.addEventListener('keydown', handleGlobalKey)
  }
})

onBeforeUnmount(() => {
  if (props.standalone) {
    window.removeEventListener('keydown', handleGlobalKey)
  }
})

const handleGlobalKey = (e) => {
  // Ctrl+W 或 Alt+F4 关闭
  if ((e.ctrlKey && e.key === 'w') || (e.key === 'F4' && e.altKey)) {
    e.preventDefault()
    closeWindow()
  }
}

const closeWindow = () => {
  if (props.standalone && typeof window !== 'undefined') {
    window.close()
  }
}

// Hex 转字节数组
const hexToBytes = (hex) => {
  const cleanHex = hex.replace(/\s+/g, '').replace(/0x/gi, '')
  if (cleanHex.length % 2 !== 0) return null
  if (!/^[0-9A-Fa-f]*$/.test(cleanHex)) return null

  const bytes = []
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.substr(i, 2), 16))
  }
  return bytes
}

// 字节数组转 Hex
const bytesToHex = (bytes) => {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

// 字节数组转有符号整数
const bytesToInt = (bytes, bits, signed) => {
  if (bytes.length !== bits / 8) return null

  let value = 0
  for (let i = 0; i < bytes.length; i++) {
    const idx = byteOrder.value === 'little' ? i : bytes.length - 1 - i
    value |= bytes[idx] << (i * 8)
  }

  if (signed && (value & (1 << (bits - 1)))) {
    value = value - Math.pow(2, bits)
  }

  return value
}

// 有符号整数转字节数组
const intToBytes = (value, bits, signed) => {
  const bytes = []
  const numBytes = bits / 8

  // 处理负数
  if (signed && value < 0) {
    value = Math.pow(2, bits) + value
  }

  for (let i = 0; i < numBytes; i++) {
    const idx = byteOrder.value === 'little' ? i : numBytes - 1 - i
    bytes[idx] = (value >> (i * 8)) & 0xFF
  }

  return bytes
}

// 字节数组转浮点数
const bytesToFloat = (bytes, bits) => {
  if (bytes.length !== bits / 8) return null

  const buffer = new Uint8Array(bytes).buffer

  if (bits === 32) {
    return new Float32Array(buffer)[0]
  } else if (bits === 64) {
    return new Float64Array(buffer)[0]
  }
  return null
}

// 浮点数转字节数组
const floatToBytes = (value, bits) => {
  const numBytes = bits / 8
  const bytes = new Uint8Array(numBytes)

  if (bits === 32) {
    const buffer = new Float32Array([value]).buffer
    bytes.set(new Uint8Array(buffer))
  } else if (bits === 64) {
    const buffer = new Float64Array([value]).buffer
    bytes.set(new Uint8Array(buffer))
  }

  // 处理字节序
  if (byteOrder.value === 'big') {
    bytes.reverse()
  }

  return Array.from(bytes)
}

// 从 Hex 转换
const convertFromHex = () => {
  const bytes = hexToBytes(inputHex.value)
  if (!bytes || bytes.length === 0) return

  // 根据字节数选择最合适的转换
  const len = bytes.length

  // 8 位整数
  if (len >= 1) {
    inputInt8.value = bytesToInt(bytes.slice(0, 1), 8, true)
    inputUint8.value = bytesToInt(bytes.slice(0, 1), 8, false)
  }

  // 16 位整数
  if (len >= 2) {
    inputInt16.value = bytesToInt(bytes.slice(0, 2), 16, true)
    inputUint16.value = bytesToInt(bytes.slice(0, 2), 16, false)
  }

  // 32 位整数和浮点数
  if (len >= 4) {
    inputInt32.value = bytesToInt(bytes.slice(0, 4), 32, true)
    inputUint32.value = bytesToInt(bytes.slice(0, 4), 32, false)
    inputFloat32.value = bytesToFloat(bytes.slice(0, 4), 32)
  }

  // 64 位整数和浮点数
  if (len >= 8) {
    inputFloat64.value = bytesToFloat(bytes.slice(0, 8), 64)
  }

  // 十进制
  inputDecimal.value = bytes.reduce((acc, byte, i) => {
    return acc + byte * Math.pow(256, byteOrder.value === 'little' ? i : bytes.length - 1 - i)
  }, 0)

  // 二进制
  inputBinary.value = bytes.map(b => b.toString(2).padStart(8, '0')).join(' ')
}

// 从十进制转换
const convertFromDecimal = () => {
  const value = parseInt(inputDecimal.value, 10)
  if (isNaN(value)) return

  const bytes = []
  let tempValue = value
  do {
    bytes.push(tempValue & 0xFF)
    tempValue = Math.floor(tempValue / 256)
  } while (tempValue > 0)

  if (byteOrder.value === 'big') {
    bytes.reverse()
  }

  inputHex.value = bytesToHex(bytes)
  inputBinary.value = bytes.map(b => b.toString(2).padStart(8, '0')).join(' ')
  inputInt8.value = bytesToInt(bytes.slice(0, 1), 8, true)
  inputUint8.value = bytesToInt(bytes.slice(0, 1), 8, false)
}

// 从二进制转换
const convertFromBinary = () => {
  const cleanBinary = inputBinary.value.replace(/\s+/g, '')
  const bytes = []
  for (let i = 0; i < cleanBinary.length; i += 8) {
    const byteStr = cleanBinary.substr(i, 8)
    if (byteStr.length === 8 && /^[01]+$/.test(byteStr)) {
      bytes.push(parseInt(byteStr, 2))
    }
  }

  if (bytes.length === 0) return

  inputHex.value = bytesToHex(bytes)
  inputDecimal.value = bytes.reduce((acc, byte, i) => {
    return acc + byte * Math.pow(256, byteOrder.value === 'little' ? i : bytes.length - 1 - i)
  }, 0)
}

// 从 Float32 转换
const convertFromFloat32 = () => {
  const value = parseFloat(inputFloat32.value)
  if (isNaN(value)) return

  const bytes = floatToBytes(value, 32)
  inputHex.value = bytesToHex(bytes)
  convertFromHex()
}

// 从 Float64 转换
const convertFromFloat64 = () => {
  const value = parseFloat(inputFloat64.value)
  if (isNaN(value)) return

  const bytes = floatToBytes(value, 64)
  inputHex.value = bytesToHex(bytes)
  convertFromHex()
}

// 清空
const clearAll = () => {
  inputHex.value = ''
  inputDecimal.value = ''
  inputBinary.value = ''
  inputFloat32.value = ''
  inputFloat64.value = ''
  inputInt8.value = ''
  inputUint8.value = ''
  inputInt16.value = ''
  inputUint16.value = ''
  inputInt32.value = ''
  inputUint32.value = ''
}
</script>

<template>
  <div class="converter-container" :class="{ standalone: standalone }">
    <div class="converter-header" v-if="standalone">
      <div class="header-left">
        <span class="title-icon">🔢</span>
        <span class="title-text">进制转换工具</span>
      </div>
      <div class="header-actions">
        <button @click="clearAll" class="icon-btn" title="清空 (C)">
          <span>🗑️</span>
        </button>
        <button @click="closeWindow" class="icon-btn close" title="关闭 (Ctrl+W)">
          <span>✕</span>
        </button>
      </div>
    </div>

    <div class="converter-header" v-else>
      <span class="title-icon">🔢</span>
      <span class="title-text">进制转换</span>
      <button @click="clearAll" class="clear-btn" title="清空">清空</button>
    </div>

    <!-- 字节序选择 -->
    <div class="byte-order-section">
      <label>字节序：</label>
      <label class="radio-label">
        <input type="radio" v-model="byteOrder" value="little" />
        <span>小端 (Little-Endian)</span>
      </label>
      <label class="radio-label">
        <input type="radio" v-model="byteOrder" value="big" />
        <span>大端 (Big-Endian)</span>
      </label>
    </div>

    <!-- 常用格式 -->
    <div class="format-section">
      <div class="section-title">常用格式</div>

      <div class="input-row">
        <label>HEX</label>
        <input
          v-model="inputHex"
          @input="debouncedConvert(() => convertFromHex())"
          type="text"
          class="format-input hex"
          placeholder="例：48 65 6C 6C 6F"
        />
      </div>

      <div class="input-row">
        <label>十进制</label>
        <input
          v-model="inputDecimal"
          @input="debouncedConvert(() => convertFromDecimal())"
          type="text"
          class="format-input decimal"
          placeholder="例：1234567890"
        />
      </div>

      <div class="input-row">
        <label>二进制</label>
        <input
          v-model="inputBinary"
          @input="debouncedConvert(() => convertFromBinary())"
          type="text"
          class="format-input binary"
          placeholder="例：01001000 01100101"
        />
      </div>
    </div>

    <!-- 整数格式 -->
    <div class="format-section">
      <div class="section-title">整数格式</div>

      <div class="input-row">
        <label>Int8</label>
        <input
          v-model="inputInt8"
          @input="debouncedConvert(() => { inputHex.value = bytesToHex(intToBytes(parseInt(inputInt8.value), 8, true)); convertFromHex() })"
          type="text"
          class="format-input int"
          placeholder="-128 ~ 127"
        />
      </div>

      <div class="input-row">
        <label>Uint8</label>
        <input
          v-model="inputUint8"
          @input="debouncedConvert(() => { inputHex.value = bytesToHex(intToBytes(parseInt(inputUint8.value), 8, false)); convertFromHex() })"
          type="text"
          class="format-input uint"
          placeholder="0 ~ 255"
        />
      </div>

      <div class="input-row">
        <label>Int16</label>
        <input
          v-model="inputInt16"
          @input="debouncedConvert(() => { inputHex.value = bytesToHex(intToBytes(parseInt(inputInt16.value), 16, true)); convertFromHex() })"
          type="text"
          class="format-input int"
          placeholder="-32768 ~ 32767"
        />
      </div>

      <div class="input-row">
        <label>Uint16</label>
        <input
          v-model="inputUint16"
          @input="debouncedConvert(() => { inputHex.value = bytesToHex(intToBytes(parseInt(inputUint16.value), 16, false)); convertFromHex() })"
          type="text"
          class="format-input uint"
          placeholder="0 ~ 65535"
        />
      </div>

      <div class="input-row">
        <label>Int32</label>
        <input
          v-model="inputInt32"
          @input="debouncedConvert(() => { inputHex.value = bytesToHex(intToBytes(parseInt(inputInt32.value), 32, true)); convertFromHex() })"
          type="text"
          class="format-input int"
          placeholder="-2147483648 ~ 2147483647"
        />
      </div>

      <div class="input-row">
        <label>Uint32</label>
        <input
          v-model="inputUint32"
          @input="debouncedConvert(() => { inputHex.value = bytesToHex(intToBytes(parseInt(inputUint32.value), 32, false)); convertFromHex() })"
          type="text"
          class="format-input uint"
          placeholder="0 ~ 4294967295"
        />
      </div>
    </div>

    <!-- 浮点数格式 -->
    <div class="format-section">
      <div class="section-title">浮点数 (IEEE 754)</div>

      <div class="input-row">
        <label>Float32</label>
        <input
          v-model="inputFloat32"
          @input="debouncedConvert(() => convertFromFloat32())"
          type="text"
          class="format-input float"
          placeholder="单精度浮点数"
        />
      </div>

      <div class="input-row">
        <label>Float64</label>
        <input
          v-model="inputFloat64"
          @input="debouncedConvert(() => convertFromFloat64())"
          type="text"
          class="format-input double"
          placeholder="双精度浮点数"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.converter-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  background: linear-gradient(145deg, #1e1e1e 0%, #252526 100%);
  overflow-y: auto;
}

/* 独立窗口模式 */
.converter-container.standalone {
  height: 100vh;
  background: linear-gradient(180deg, #0f0f23 0%, #1a1a2e 40%, #16213e 100%);
}

/* 独立窗口标题栏 */
.standalone .converter-header {
  cursor: move;
  user-select: none;
  padding: 14px 18px;
  margin: -12px -12px 20px -12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 14px 14px 0 0;
  border-bottom: none;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.standalone .title-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
}

.standalone .title-text {
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

/* 独立窗口标题栏动作 */
.header-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.icon-btn.close:hover {
  background: rgba(239, 68, 68, 0.8);
  border-color: rgba(239, 68, 68, 1);
}

.converter-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(62, 62, 66, 0.5);
}

.title-icon {
  font-size: 20px;
}

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.clear-btn {
  margin-left: auto;
  padding: 6px 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #ffffff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.clear-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 字节序选择 */
.byte-order-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(62, 62, 66, 0.5) 0%, rgba(45, 45, 48, 0.5) 100%);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #cccccc;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.byte-order-section label {
  color: #858585;
  font-weight: 500;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.radio-label input[type="radio"] {
  accent-color: #007acc;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

/* 格式区域 */
.format-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: #858585;
  text-transform: uppercase;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, rgba(62, 62, 66, 0.3) 0%, rgba(45, 45, 48, 0.3) 100%);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  letter-spacing: 1px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.input-row label {
  width: 75px;
  font-size: 12px;
  color: #999999;
  text-align: right;
  font-weight: 500;
}

.format-input {
  flex: 1;
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(45, 45, 48, 0.8) 0%, rgba(30, 30, 30, 0.8) 100%);
  border: 1px solid rgba(62, 62, 66, 0.8);
  color: #ffffff;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  transition: all 0.2s;
}

.format-input:focus {
  outline: none;
  border-color: rgba(102, 126, 234, 0.6);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  background: linear-gradient(135deg, rgba(45, 45, 48, 1) 0%, rgba(30, 30, 30, 1) 100%);
}

.format-input.hex {
  color: #4ec9b0;
}

.format-input.decimal {
  color: #b5cea8;
}

.format-input.binary {
  color: #9cdcfe;
}

.format-input.int {
  color: #ce9178;
}

.format-input.uint {
  color: #569cd6;
}

.format-input.float {
  color: #dcdcaa;
}

.format-input.double {
  color: #c586c0;
}

/* 使用说明 */
.help-section {
  margin-top: auto;
  padding: 12px;
  background-color: #252526;
  border-radius: 4px;
}

.help-list {
  margin: 8px 0 0 0;
  padding-left: 20px;
  font-size: 12px;
  color: #858585;
  line-height: 1.8;
}

.help-list li {
  margin-bottom: 4px;
}

.help-list code {
  background-color: #1e1e1e;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #4ec9b0;
}
</style>
