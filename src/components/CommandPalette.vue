<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useSerialStore } from '../stores/serial'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue'])

const serialStore = useSerialStore()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)

// 获取已启用命令
const enabledCommands = computed(() => {
  return serialStore.getEnabledCommands
})

// 过滤后的命令
const filteredCommands = computed(() => {
  if (!searchQuery.value) return enabledCommands.value
  const query = searchQuery.value.toLowerCase()
  return enabledCommands.value.filter(cmd =>
    cmd.name.toLowerCase().includes(query) ||
    cmd.command.toLowerCase().includes(query)
  )
})

// 监听打开状态，自动聚焦
watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    selectedIndex.value = 0
    searchQuery.value = ''
    await nextTick()
    inputRef.value?.focus()
  }
})

// 键盘导航
const handleKeyDown = (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    sendCommand(filteredCommands.value[selectedIndex.value])
  } else if (e.key === 'Escape') {
    emit('update:modelValue', false)
  }
}

// 发送命令
const sendCommand = (cmd) => {
  if (cmd) {
    // 触发全局事件来发送命令
    window.dispatchEvent(new CustomEvent('serialx-send-command', { detail: cmd.command }))
    emit('update:modelValue', false)
  }
}

// 点击命令
const selectCommand = (cmd) => {
  sendCommand(cmd)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="modelValue" class="command-palette-overlay" @click.self="emit('update:modelValue', false)">
        <div class="command-palette">
          <div class="palette-header">
            <span class="palette-icon">⚡</span>
            <input
              ref="inputRef"
              v-model="searchQuery"
              type="text"
              class="palette-input"
              placeholder="搜索命令... (输入关键字过滤)"
              @keydown="handleKeyDown"
            />
          </div>
          <div class="palette-body">
            <div
              v-for="(cmd, index) in filteredCommands"
              :key="cmd.id"
              :class="['command-item', { selected: index === selectedIndex }]"
              @click="selectCommand(cmd)"
              @mouseenter="selectedIndex = index"
            >
              <span class="command-name">{{ cmd.name }}</span>
              <code class="command-value">{{ cmd.command }}</code>
            </div>
            <div v-if="filteredCommands.length === 0" class="no-commands">
              <span class="no-commands-icon">🔍</span>
              <span class="no-commands-text">未找到匹配的命令</span>
            </div>
          </div>
          <div class="palette-footer">
            <span class="shortcut-hint">
              <kbd>↑↓</kbd> 选择
            </span>
            <span class="shortcut-hint">
              <kbd>Enter</kbd> 发送
            </span>
            <span class="shortcut-hint">
              <kbd>Esc</kbd> 关闭
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.command-palette-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--app-overlay-bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.palette-enter-active,
.palette-leave-active {
  transition: all 0.2s ease;
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.command-palette {
  width: 500px;
  max-width: 90vw;
  max-height: 400px;
  background: linear-gradient(145deg, var(--app-modal-bg) 0%, var(--app-modal-soft) 100%);
  border: 1px solid var(--app-modal-border);
  border-radius: 12px;
  box-shadow: var(--app-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.palette-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-workspace-shell);
}

.palette-icon {
  font-size: 20px;
}

.palette-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--app-text);
  font-size: 16px;
  font-family: inherit;
}

.palette-input::placeholder { color: var(--app-text-soft); }

.palette-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  max-height: 300px;
}

.command-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.command-item:hover,
.command-item.selected {
  background: var(--app-accent-soft);
}

.command-item.selected {
  background: var(--app-accent-strong);
  border: 1px solid var(--app-chip-border);
}

.command-name {
  font-size: 14px;
  color: var(--app-text);
  font-weight: 500;
}

.command-value {
  font-size: 12px;
  color: var(--app-chip-text);
  background: var(--app-chip-bg);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
}

.no-commands {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--app-text-soft);
}

.no-commands-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.no-commands-text {
  font-size: 14px;
}

.palette-footer {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 12px 16px;
  border-top: 1px solid var(--app-border);
  background: var(--app-workspace-shell);
}

.shortcut-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--app-text-soft);
}

kbd {
  background: var(--app-chip-bg);
  border: 1px solid var(--app-chip-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: inherit;
  color: var(--app-chip-text);
}
</style>
