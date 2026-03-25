<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSerialStore } from '../stores/serial'

const props = defineProps({
  standalone: {
    type: Boolean,
    default: false
  }
})

const serialStore = useSerialStore()

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

const byteOrder = ref('little')
const debounceTimer = ref(null)
const isAlwaysOnTop = ref(false)

const themeMode = computed(() => serialStore.appUiState?.themeMode || 'dark')
const isDarkMode = computed(() => themeMode.value === 'dark')
const appTheme = computed(() => serialStore.appTheme || {})

const themeVars = computed(() => {
  const theme = appTheme.value
  if (isDarkMode.value) {
    return {
      '--app-workspace-base': '#121a2b',
      '--app-workspace-soft': '#172133',
      '--app-workspace-shell': '#090f1d',
      '--app-workspace-shell-strong': '#0d1425',
      '--app-border': '#273248',
      '--app-text': '#f9fafb',
      '--app-text-soft': '#94a3b8',
      '--app-accent': '#5ea0ff',
      '--app-chip-text': '#dbeafe',
      '--app-danger-soft': 'rgba(232, 84, 84, 0.12)',
      '--app-danger-border': 'rgba(232, 84, 84, 0.22)',
      '--app-danger-text': '#ffc8c8',
      '--converter-bg': `linear-gradient(180deg, ${theme.background || '#0f1720'} 0%, ${theme.workspaceShell || '#131c25'} 100%)`,
      '--converter-panel': 'var(--app-workspace-base)',
      '--converter-panel-strong': 'var(--app-workspace-shell-strong)',
      '--converter-panel-soft': 'var(--app-workspace-soft)',
      '--converter-border': 'var(--app-border)',
      '--converter-text': 'var(--app-text)',
      '--converter-text-soft': 'var(--app-text-soft)',
      '--converter-title': 'var(--app-text)',
      '--converter-accent': 'var(--app-accent)',
      '--converter-accent-strong': 'var(--app-chip-text)',
      '--converter-shadow': '0 20px 40px rgba(0, 0, 0, 0.28)',
      '--converter-input-bg': 'var(--app-workspace-shell)',
      '--converter-scroll-track': 'var(--app-workspace-shell)',
      '--converter-scroll-thumb': 'var(--app-border)'
    }
  }

  return {
    '--app-workspace-base': '#ffffff',
    '--app-workspace-soft': '#f4f7fb',
    '--app-workspace-shell': '#edf2f7',
    '--app-workspace-shell-strong': '#e2e8f0',
    '--app-border': '#d8deea',
    '--app-text': '#111827',
    '--app-text-soft': '#6b7280',
    '--app-accent': '#2563eb',
    '--app-chip-text': '#1d4ed8',
    '--app-danger-soft': 'rgba(196, 43, 28, 0.1)',
    '--app-danger-border': 'rgba(196, 43, 28, 0.18)',
    '--app-danger-text': '#b2473d',
    '--converter-bg': `linear-gradient(180deg, ${theme.background || '#f4f7fb'} 0%, ${theme.workspaceShell || '#e7eef6'} 100%)`,
    '--converter-panel': 'var(--app-workspace-base)',
    '--converter-panel-strong': 'var(--app-workspace-shell-strong)',
    '--converter-panel-soft': 'var(--app-workspace-soft)',
    '--converter-border': 'var(--app-border)',
    '--converter-text': 'var(--app-text)',
    '--converter-text-soft': 'var(--app-text-soft)',
    '--converter-title': 'var(--app-text)',
    '--converter-accent': 'var(--app-accent)',
    '--converter-accent-strong': 'var(--app-chip-text)',
    '--converter-shadow': '0 18px 34px rgba(59, 87, 111, 0.12)',
    '--converter-input-bg': 'var(--app-workspace-shell)',
    '--converter-scroll-track': 'var(--app-workspace-shell)',
    '--converter-scroll-thumb': 'var(--app-border)'
  }
})

const commonFields = [
  {
    key: 'hex',
    label: 'HEX',
    value: inputHex,
    placeholder: '例如：41 42 43 44 或 41424344',
    handler: () => convertFromHex()
  },
  {
    key: 'decimal',
    label: '十进制',
    value: inputDecimal,
    placeholder: '例如：1234567890',
    handler: () => convertFromDecimal()
  },
  {
    key: 'binary',
    label: '二进制',
    value: inputBinary,
    placeholder: '例如：01001000 01100101',
    handler: () => convertFromBinary()
  }
]

const integerFields = [
  {
    key: 'int8',
    label: 'Int8',
    value: inputInt8,
    placeholder: '-128 ~ 127',
    handler: () => updateFromInteger(inputInt8.value, 8, true)
  },
  {
    key: 'uint8',
    label: 'Uint8',
    value: inputUint8,
    placeholder: '0 ~ 255',
    handler: () => updateFromInteger(inputUint8.value, 8, false)
  },
  {
    key: 'int16',
    label: 'Int16',
    value: inputInt16,
    placeholder: '-32768 ~ 32767',
    handler: () => updateFromInteger(inputInt16.value, 16, true)
  },
  {
    key: 'uint16',
    label: 'Uint16',
    value: inputUint16,
    placeholder: '0 ~ 65535',
    handler: () => updateFromInteger(inputUint16.value, 16, false)
  },
  {
    key: 'int32',
    label: 'Int32',
    value: inputInt32,
    placeholder: '-2147483648 ~ 2147483647',
    handler: () => updateFromInteger(inputInt32.value, 32, true)
  },
  {
    key: 'uint32',
    label: 'Uint32',
    value: inputUint32,
    placeholder: '0 ~ 4294967295',
    handler: () => updateFromInteger(inputUint32.value, 32, false)
  }
]

const floatFields = [
  {
    key: 'float32',
    label: 'Float32',
    value: inputFloat32,
    placeholder: 'IEEE 754 单精度浮点数',
    handler: () => convertFromFloat32()
  },
  {
    key: 'float64',
    label: 'Float64',
    value: inputFloat64,
    placeholder: 'IEEE 754 双精度浮点数',
    handler: () => convertFromFloat64()
  }
]

watch(byteOrder, () => {
  if (inputHex.value) {
    convertFromHex()
  }
})

const debouncedConvert = (fn) => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  debounceTimer.value = setTimeout(fn, 60)
}

const handleGlobalKey = (event) => {
  if ((event.ctrlKey && event.key.toLowerCase() === 'w') || (event.altKey && event.key === 'F4')) {
    event.preventDefault()
    closeWindow()
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault()
    clearAll()
  }
}

onMounted(() => {
  if (props.standalone) {
    window.addEventListener('keydown', handleGlobalKey)
    syncAlwaysOnTopState()
  }
})

onBeforeUnmount(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }

  if (props.standalone) {
    window.removeEventListener('keydown', handleGlobalKey)
  }
})

const closeWindow = () => {
  if (!props.standalone || typeof window === 'undefined') return

  if (window.electronAPI?.closeWindow) {
    window.electronAPI.closeWindow()
    return
  }

  window.close()
}

const syncAlwaysOnTopState = async () => {
  if (!props.standalone || typeof window === 'undefined') return
  if (!window.electronAPI?.getWindowAlwaysOnTop) return

  isAlwaysOnTop.value = Boolean(await window.electronAPI.getWindowAlwaysOnTop())
}

const toggleAlwaysOnTop = async () => {
  if (!props.standalone || typeof window === 'undefined') return
  if (!window.electronAPI?.setWindowAlwaysOnTop) return

  isAlwaysOnTop.value = Boolean(await window.electronAPI.setWindowAlwaysOnTop(!isAlwaysOnTop.value))
}

const hexToBytes = (hex) => {
  const cleanHex = hex.replace(/[\s,]+/g, '').replace(/0x/gi, '')
  if (!cleanHex.length) return []
  if (cleanHex.length % 2 !== 0) return null
  if (!/^[0-9A-Fa-f]*$/.test(cleanHex)) return null

  const bytes = []
  for (let index = 0; index < cleanHex.length; index += 2) {
    bytes.push(parseInt(cleanHex.slice(index, index + 2), 16))
  }
  return bytes
}

const bytesToHex = (bytes) => bytes
  .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
  .join(' ')

const bytesToBinary = (bytes) => bytes
  .map((byte) => byte.toString(2).padStart(8, '0'))
  .join(' ')

const bytesToUnsignedDecimal = (bytes) => bytes.reduce((sum, byte, index) => {
  const exponent = byteOrder.value === 'little' ? index : bytes.length - 1 - index
  return sum + byte * Math.pow(256, exponent)
}, 0)

const bytesToInt = (bytes, bits, signed) => {
  if (bytes.length !== bits / 8) return null

  const buffer = new Uint8Array(bytes).buffer
  const view = new DataView(buffer)
  const isLittleEndian = byteOrder.value === 'little'

  if (bits === 8) {
    return signed ? view.getInt8(0) : view.getUint8(0)
  }

  if (bits === 16) {
    return signed ? view.getInt16(0, isLittleEndian) : view.getUint16(0, isLittleEndian)
  }

  if (bits === 32) {
    return signed ? view.getInt32(0, isLittleEndian) : view.getUint32(0, isLittleEndian)
  }

  return null
}

const intToBytes = (value, bits, signed) => {
  const buffer = new ArrayBuffer(bits / 8)
  const view = new DataView(buffer)
  const isLittleEndian = byteOrder.value === 'little'

  if (bits === 8) {
    if (signed) {
      view.setInt8(0, value)
    } else {
      view.setUint8(0, value)
    }
  } else if (bits === 16) {
    if (signed) {
      view.setInt16(0, value, isLittleEndian)
    } else {
      view.setUint16(0, value, isLittleEndian)
    }
  } else if (bits === 32) {
    if (signed) {
      view.setInt32(0, value, isLittleEndian)
    } else {
      view.setUint32(0, value, isLittleEndian)
    }
  }

  return Array.from(new Uint8Array(buffer))
}

const bytesToFloat = (bytes, bits) => {
  if (bytes.length !== bits / 8) return null

  const buffer = new Uint8Array(bytes).buffer
  const view = new DataView(buffer)
  const isLittleEndian = byteOrder.value === 'little'

  if (bits === 32) {
    return view.getFloat32(0, isLittleEndian)
  }

  if (bits === 64) {
    return view.getFloat64(0, isLittleEndian)
  }

  return null
}

const floatToBytes = (value, bits) => {
  const buffer = new ArrayBuffer(bits / 8)
  const view = new DataView(buffer)
  const isLittleEndian = byteOrder.value === 'little'

  if (bits === 32) {
    view.setFloat32(0, value, isLittleEndian)
  } else if (bits === 64) {
    view.setFloat64(0, value, isLittleEndian)
  }

  return Array.from(new Uint8Array(buffer))
}

const setValuesFromBytes = (bytes) => {
  if (!bytes?.length) return

  inputHex.value = bytesToHex(bytes)
  inputBinary.value = bytesToBinary(bytes)
  inputDecimal.value = String(bytesToUnsignedDecimal(bytes))

  inputInt8.value = bytes.length >= 1 ? String(bytesToInt(bytes.slice(0, 1), 8, true)) : ''
  inputUint8.value = bytes.length >= 1 ? String(bytesToInt(bytes.slice(0, 1), 8, false)) : ''
  inputInt16.value = bytes.length >= 2 ? String(bytesToInt(bytes.slice(0, 2), 16, true)) : ''
  inputUint16.value = bytes.length >= 2 ? String(bytesToInt(bytes.slice(0, 2), 16, false)) : ''
  inputInt32.value = bytes.length >= 4 ? String(bytesToInt(bytes.slice(0, 4), 32, true)) : ''
  inputUint32.value = bytes.length >= 4 ? String(bytesToInt(bytes.slice(0, 4), 32, false)) : ''
  inputFloat32.value = bytes.length >= 4 ? String(bytesToFloat(bytes.slice(0, 4), 32)) : ''
  inputFloat64.value = bytes.length >= 8 ? String(bytesToFloat(bytes.slice(0, 8), 64)) : ''
}

const convertFromHex = () => {
  const bytes = hexToBytes(inputHex.value)
  if (!bytes?.length) return
  setValuesFromBytes(bytes)
}

const convertFromDecimal = () => {
  const value = parseInt(inputDecimal.value, 10)
  if (Number.isNaN(value)) return

  let bits = 8
  if (value > 127 || value < -128) bits = 16
  if (value > 32767 || value < -32768) bits = 32
  if (value > 2147483647 || value < -2147483648) bits = 64

  const buffer = new ArrayBuffer(bits / 8)
  const view = new DataView(buffer)
  const isLittleEndian = byteOrder.value === 'little'

  if (bits === 8) {
    view.setInt8(0, value)
  } else if (bits === 16) {
    view.setInt16(0, value, isLittleEndian)
  } else if (bits === 32) {
    view.setInt32(0, value, isLittleEndian)
  } else {
    view.setBigInt64(0, BigInt(value), isLittleEndian)
  }

  setValuesFromBytes(Array.from(new Uint8Array(buffer)))
}

const convertFromBinary = () => {
  const cleanBinary = inputBinary.value.replace(/\s+/g, '')
  if (!cleanBinary || cleanBinary.length % 8 !== 0 || !/^[01]+$/.test(cleanBinary)) return

  const bytes = []
  for (let index = 0; index < cleanBinary.length; index += 8) {
    bytes.push(parseInt(cleanBinary.slice(index, index + 8), 2))
  }

  setValuesFromBytes(bytes)
}

const convertFromFloat32 = () => {
  const value = parseFloat(inputFloat32.value)
  if (Number.isNaN(value)) return
  setValuesFromBytes(floatToBytes(value, 32))
}

const convertFromFloat64 = () => {
  const value = parseFloat(inputFloat64.value)
  if (Number.isNaN(value)) return
  setValuesFromBytes(floatToBytes(value, 64))
}

const updateFromInteger = (rawValue, bits, signed) => {
  const value = parseInt(rawValue, 10)
  if (Number.isNaN(value)) return
  setValuesFromBytes(intToBytes(value, bits, signed))
}

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
  <div
    :class="['converter-container', `theme-${themeMode}`, { standalone }]"
    :style="themeVars"
  >
    <header v-if="standalone" class="window-titlebar">
      <div class="window-title">
        <span class="window-title-dot" aria-hidden="true"></span>
        <span class="window-title-text">进制转换工具</span>
      </div>

      <div class="window-controls">
        <button
          :class="['window-titlebar-pin', { active: isAlwaysOnTop }]"
          type="button"
          :title="isAlwaysOnTop ? '取消置顶' : '置顶显示'"
          :aria-label="isAlwaysOnTop ? '取消置顶' : '置顶显示'"
          @click="toggleAlwaysOnTop"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M10.9 2.3 13.7 5.1 10.8 6l-1.9 1.9.8 3.6-.7.7-2.7-2.7-2.3 2.3-.9-.9 2.3-2.3-2.7-2.7.7-.7 3.6.8L8 5.2l.9-2.9Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          class="window-titlebar-close"
          type="button"
          title="关闭 (Ctrl+W)"
          aria-label="关闭进制转换工具"
          @click="closeWindow"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
    <section class="toolbar-card">
      <div class="toolbar-title">
        <span class="toolbar-label">字节序</span>
        <span class="toolbar-hint">切换后会按当前输入内容重新计算</span>
      </div>

      <div class="toolbar-actions">
        <label class="toggle-pill">
          <input v-model="byteOrder" type="radio" value="little">
          <span>小端 Little-Endian</span>
        </label>
        <label class="toggle-pill">
          <input v-model="byteOrder" type="radio" value="big">
          <span>大端 Big-Endian</span>
        </label>
        <button class="ghost-btn" type="button" title="清空 (Ctrl+L)" @click="clearAll">清空</button>
      </div>
    </section>

    <section class="converter-grid">
      <div class="format-section">
        <div class="section-head">
          <span class="section-title">常用格式</span>
          <span class="section-note">适合直接粘贴原始收发数据</span>
        </div>

        <div
          v-for="field in commonFields"
          :key="field.key"
          class="input-row"
        >
          <label :for="field.key">{{ field.label }}</label>
          <input
            :id="field.key"
            v-model="field.value.value"
            type="text"
            class="format-input"
            :placeholder="field.placeholder"
            @input="debouncedConvert(field.handler)"
          >
        </div>
      </div>

      <div class="format-section">
        <div class="section-head">
          <span class="section-title">整数格式</span>
          <span class="section-note">按当前字节序解析 8 / 16 / 32 位整数</span>
        </div>

        <div
          v-for="field in integerFields"
          :key="field.key"
          class="input-row"
        >
          <label :for="field.key">{{ field.label }}</label>
          <input
            :id="field.key"
            v-model="field.value.value"
            type="text"
            class="format-input"
            :placeholder="field.placeholder"
            @input="debouncedConvert(field.handler)"
          >
        </div>
      </div>

      <div class="format-section">
        <div class="section-head">
          <span class="section-title">浮点格式</span>
          <span class="section-note">兼容 IEEE 754 单精度和双精度表示</span>
        </div>

        <div
          v-for="field in floatFields"
          :key="field.key"
          class="input-row"
        >
          <label :for="field.key">{{ field.label }}</label>
          <input
            :id="field.key"
            v-model="field.value.value"
            type="text"
            class="format-input"
            :placeholder="field.placeholder"
            @input="debouncedConvert(field.handler)"
          >
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.converter-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  color: var(--converter-text);
  background: var(--converter-bg);
}

.converter-container.standalone {
  min-height: 100vh;
}

.converter-container::-webkit-scrollbar {
  width: 12px;
}

.converter-container::-webkit-scrollbar-track {
  background: var(--converter-scroll-track);
  border-radius: 999px;
}

.converter-container::-webkit-scrollbar-thumb {
  background: var(--converter-scroll-thumb);
  border-radius: 999px;
  border: 2px solid var(--converter-scroll-track);
}

.toolbar-card,
.format-section {
  border: 1px solid var(--converter-border);
  background: var(--converter-panel);
  box-shadow: var(--converter-shadow);
  backdrop-filter: blur(14px);
}

.window-titlebar {
  position: sticky;
  top: 0;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  margin: -16px -16px 0;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--converter-border);
  background: var(--converter-panel-strong);
  color: var(--converter-text-soft);
  -webkit-app-region: drag;
}

.window-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.window-title-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--converter-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--converter-accent) 14%, transparent);
}

.window-title-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--converter-title);
  letter-spacing: 0.01em;
}

.window-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.window-titlebar-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 30px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--converter-text-soft);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.window-titlebar-pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 30px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--converter-text-soft);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.window-titlebar-pin:hover {
  background: color-mix(in srgb, var(--converter-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--converter-accent) 28%, transparent);
  color: var(--converter-title);
}

.window-titlebar-pin.active {
  background: color-mix(in srgb, var(--converter-accent) 18%, transparent);
  border-color: color-mix(in srgb, var(--converter-accent) 40%, var(--converter-border));
  color: var(--converter-accent-strong);
}

.window-titlebar-pin:focus-visible,
.window-titlebar-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--converter-accent) 18%, transparent);
}

.window-titlebar-close:hover {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
  color: var(--app-danger-text);
}

.ghost-btn {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--converter-border);
  background: var(--converter-panel-strong);
  color: var(--converter-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.ghost-btn:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--converter-accent) 35%, var(--converter-border));
}

.toolbar-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 16px;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.toolbar-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.toolbar-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--converter-title);
}

.toolbar-hint {
  font-size: 12px;
  color: var(--converter-text-soft);
}

.byte-order-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.toggle-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  border-radius: 999px;
  cursor: pointer;
}

.toggle-pill input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.toggle-pill span {
  display: inline-flex;
  align-items: center;
  padding: 9px 14px;
  border: 1px solid var(--converter-border);
  border-radius: 999px;
  background: var(--converter-panel-strong);
  color: var(--converter-text-soft);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.toggle-pill input:checked + span {
  background: color-mix(in srgb, var(--converter-accent) 18%, var(--converter-panel-strong));
  border-color: color-mix(in srgb, var(--converter-accent) 42%, var(--converter-border));
  color: var(--converter-title);
}

.converter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  min-height: 0;
}

.format-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
}

.section-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--converter-title);
}

.section-note {
  font-size: 12px;
  color: var(--converter-text-soft);
}

.input-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.input-row label {
  font-size: 12px;
  font-weight: 600;
  color: var(--converter-text-soft);
}

.format-input {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--converter-border);
  background: var(--converter-input-bg);
  color: var(--converter-title);
  font-size: 13px;
  font-family: 'Consolas', 'JetBrains Mono', 'SFMono-Regular', monospace;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.format-input::placeholder {
  color: color-mix(in srgb, var(--converter-text-soft) 88%, transparent);
}

.format-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--converter-accent-strong) 50%, var(--converter-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--converter-accent) 16%, transparent);
}

@media (max-width: 900px) {
  .converter-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .converter-container {
    padding: 12px;
  }

  .window-titlebar {
    margin: -12px -12px 0;
    padding: 0 8px 0 12px;
  }

  .toolbar-card,
  .format-section {
    padding: 14px;
    border-radius: 16px;
  }

  .input-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>

