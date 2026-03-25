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

const enabledCommands = computed(() => serialStore.getEnabledCommands)
const selectedPort = computed(() => serialStore.selectedPort || '')
const hasSelectedPort = computed(() => Boolean(selectedPort.value))
const selectedPortStatusText = computed(() => {
  if (!selectedPort.value) return '目标：未选择串口'
  return serialStore.getPortStatus(selectedPort.value)
    ? `目标：${selectedPort.value}`
    : `目标：${selectedPort.value}（未连接）`
})

const filteredCommands = computed(() => {
  if (!searchQuery.value) return enabledCommands.value
  const query = searchQuery.value.toLowerCase()
  return enabledCommands.value.filter((cmd) =>
    cmd.name.toLowerCase().includes(query) ||
    cmd.command.toLowerCase().includes(query) ||
    (cmd.group || '默认').toLowerCase().includes(query)
  )
})

const groupedCommands = computed(() => {
  const groups = new Map()
  filteredCommands.value.forEach((cmd) => {
    const group = cmd.group || '默认'
    if (!groups.has(group)) {
      groups.set(group, [])
    }
    groups.get(group).push(cmd)
  })

  return Array.from(groups.entries()).map(([group, commands]) => ({ group, commands }))
})

const flatCommands = computed(() => (
  groupedCommands.value.flatMap((groupBlock) => (
    groupBlock.commands.map((cmd) => ({
      ...cmd,
      groupLabel: groupBlock.group
    }))
  ))
))

const hasResults = computed(() => flatCommands.value.length > 0)
const currentSelectedCommand = computed(() => flatCommands.value[selectedIndex.value] || null)

const syncSelectedIndex = () => {
  if (!flatCommands.value.length) {
    selectedIndex.value = 0
    return
  }

  if (selectedIndex.value >= flatCommands.value.length) {
    selectedIndex.value = flatCommands.value.length - 1
  }
}

watch(searchQuery, () => {
  selectedIndex.value = 0
})

watch(flatCommands, syncSelectedIndex)

watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    selectedIndex.value = 0
    searchQuery.value = ''
    await nextTick()
    inputRef.value?.focus()
  }
})

const handleKeyDown = (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!flatCommands.value.length) return
    selectedIndex.value = (selectedIndex.value + 1) % flatCommands.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!flatCommands.value.length) return
    selectedIndex.value = (selectedIndex.value - 1 + flatCommands.value.length) % flatCommands.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    sendCommand(currentSelectedCommand.value)
  } else if (e.key === 'Escape') {
    emit('update:modelValue', false)
  }
}

const sendCommand = (cmd) => {
  if (cmd && hasSelectedPort.value) {
    window.dispatchEvent(new CustomEvent('serialx-send-command', { detail: cmd.command }))
    emit('update:modelValue', false)
  }
}

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
              placeholder="搜索命令、分组..."
              @keydown="handleKeyDown"
            />
          </div>
          <div class="palette-body">
            <div v-for="groupBlock in groupedCommands" :key="groupBlock.group" class="command-group">
              <div class="command-group-label">{{ groupBlock.group }}</div>
              <div
                v-for="cmd in groupBlock.commands"
                :key="cmd.id"
                :class="['command-item', { selected: currentSelectedCommand?.id === cmd.id }]"
                @click="selectCommand(cmd)"
                @mouseenter="selectedIndex = flatCommands.findIndex((item) => item.id === cmd.id)"
              >
                <span class="command-name">{{ cmd.name }}</span>
                <span class="command-value-wrap">
                  <code class="command-value">{{ cmd.command }}</code>
                </span>
              </div>
            </div>
            <div v-if="!hasResults" class="no-commands">
              <span class="no-commands-icon">🔍</span>
              <span class="no-commands-text">未找到匹配的命令</span>
            </div>
          </div>
          <div class="palette-footer">
            <span class="target-port" :class="{ inactive: !hasSelectedPort }">
              {{ selectedPortStatusText }}
            </span>
            <span class="shortcut-hint"><kbd>↑↓</kbd> 选择</span>
            <span class="shortcut-hint"><kbd>Enter</kbd> 发送</span>
            <span class="shortcut-hint"><kbd>Esc</kbd> 关闭</span>
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
  width: 520px;
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

.palette-input::placeholder {
  color: var(--app-text-soft);
}

.palette-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  max-height: 300px;
}

.command-group {
  margin-bottom: 10px;
}

.command-group-label {
  padding: 4px 10px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--app-text-soft);
  text-transform: uppercase;
}

.command-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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

.command-value-wrap {
  display: inline-flex;
  justify-content: flex-end;
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
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  padding: 12px 16px;
  border-top: 1px solid var(--app-border);
  background: var(--app-workspace-shell);
}

.target-port {
  font-size: 12px;
  color: var(--app-text);
}

.target-port.inactive {
  color: var(--app-warning-text);
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
