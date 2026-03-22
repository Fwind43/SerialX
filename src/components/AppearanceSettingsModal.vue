<script setup>
import { computed } from 'vue'
import { useSerialStore } from '../stores/serial'

const serialStore = useSerialStore()

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show'])

const appearance = computed(() => serialStore.terminalAppearance)

const colorFields = [
  { key: 'terminalBackground', label: '终端背景色', hint: 'xterm 主背景色' },
  { key: 'terminalForeground', label: '终端字体色', hint: '终端普通文本颜色' },
  { key: 'cursorColor', label: '光标颜色', hint: '输入/定位光标颜色' },
  { key: 'selectionColor', label: '选区颜色', hint: '鼠标选中文本的背景色' },
  { key: 'searchMatchColor', label: '搜索匹配色', hint: '普通命中的荧光笔颜色' },
  { key: 'searchMatchTextColor', label: '匹配文字色', hint: '普通命中文字颜色' },
  { key: 'searchCurrentMatchColor', label: '当前匹配色', hint: '当前命中的高亮颜色' },
  { key: 'searchCurrentMatchTextColor', label: '当前文字色', hint: '当前命中文字颜色' }
]

const colorInputValue = (value) => {
  if (typeof value !== 'string') return '#000000'
  return value.startsWith('#') ? value : '#000000'
}

const updateColor = (key, value) => {
  serialStore.updateTerminalAppearance({ [key]: value })
}

const updateLineHighlight = (value) => {
  serialStore.updateTerminalAppearance({
    searchLineHighlightColor: `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})`
  })
}

const parseRgba = (value) => {
  const match = typeof value === 'string'
    ? value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i)
    : null

  if (!match) {
    return { r: 255, g: 235, b: 59, a: 0.14 }
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: Number(match[4] ?? 1)
  }
}

const lineHighlight = computed(() => parseRgba(appearance.value.searchLineHighlightColor))

const closeModal = () => {
  emit('update:show', false)
}

const resetDefaults = () => {
  serialStore.resetTerminalAppearance()
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <div class="modal-title">终端外观设置</div>
          <div class="modal-subtitle">自定义终端文字、搜索高亮和当前命中效果</div>
        </div>
        <button @click="closeModal" class="modal-close">×</button>
      </div>

      <div class="modal-body">
        <div class="settings-grid">
          <div v-for="field in colorFields" :key="field.key" class="setting-card">
            <div class="setting-info">
              <label class="setting-label">{{ field.label }}</label>
              <span class="setting-hint">{{ field.hint }}</span>
            </div>
            <div class="setting-controls">
              <input
                :value="colorInputValue(appearance[field.key])"
                type="color"
                class="color-picker"
                @input="updateColor(field.key, $event.target.value)"
              />
              <input
                :value="appearance[field.key]"
                type="text"
                class="color-input"
                @input="updateColor(field.key, $event.target.value)"
              />
            </div>
          </div>
        </div>

        <div class="setting-card line-highlight-card">
          <div class="setting-info">
            <label class="setting-label">当前匹配行高亮</label>
            <span class="setting-hint">支持 RGBA，控制整行荧光痕迹</span>
          </div>
          <div class="line-grid">
            <input
              :value="appearance.searchLineHighlightColor"
              type="text"
              class="color-input line-input"
              @input="serialStore.updateTerminalAppearance({ searchLineHighlightColor: $event.target.value })"
            />
            <label class="range-group">
              <span>透明度</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="lineHighlight.a"
                @input="updateLineHighlight({ ...lineHighlight, a: Number($event.target.value) })"
              />
            </label>
          </div>
        </div>

        <div class="preview-card">
          <div class="preview-title">预览</div>
          <div class="preview-surface" :style="{ backgroundColor: appearance.terminalBackground, color: appearance.terminalForeground }">
            <span class="preview-text">RX: normal text</span>
            <span
              class="preview-mark"
              :style="{ color: appearance.searchMatchTextColor, boxShadow: `inset 0 -0.62em 0 ${appearance.searchMatchColor}` }"
            >
              matched
            </span>
            <span
              class="preview-mark current"
              :style="{ color: appearance.searchCurrentMatchTextColor, boxShadow: `inset 0 -0.68em 0 ${appearance.searchCurrentMatchColor}` }"
            >
              current
            </span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="resetDefaults" class="modal-btn secondary">恢复默认</button>
        <button @click="closeModal" class="modal-btn primary">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(4px);
}

.modal {
  width: min(880px, calc(100vw - 48px));
  max-height: min(86vh, 900px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #2b2d31, #1b1c1f);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.modal-header,
.modal-footer {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  gap: 12px;
  justify-content: flex-end;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

.modal-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: #94979f;
}

.modal-close {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  cursor: pointer;
}

.modal-body {
  padding: 24px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.setting-card,
.preview-card {
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.setting-info {
  margin-bottom: 12px;
}

.setting-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.setting-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #90939a;
}

.setting-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.color-picker {
  width: 44px;
  height: 36px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.color-input {
  flex: 1;
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.25);
  color: #ffffff;
  font-family: Consolas, "Courier New", monospace;
}

.line-grid {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.line-input {
  min-width: 280px;
}

.range-group {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #d3d6dc;
  font-size: 12px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 12px;
}

.preview-surface {
  border-radius: 12px;
  padding: 18px 16px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 14px;
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.preview-mark {
  background: transparent;
  border-radius: 0.08em;
  padding: 0 0.08em;
}

.preview-mark.current {
  border-radius: 0.1em;
}

.modal-btn {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
}

.modal-btn.secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #f2f3f5;
}

.modal-btn.primary {
  background: linear-gradient(135deg, #f6e05e, #f59e0b);
  color: #1b1c1f;
}
</style>
