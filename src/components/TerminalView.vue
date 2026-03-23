<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSerialStore } from '../stores/serial'
import SerialPanel from './SerialPanel.vue'

const serialStore = useSerialStore()

const MIN_PANE_WIDTH = 240
const PANE_GAP_WIDTH = 18

const splitPanes = ref(serialStore.workspaceLayout?.splitPanes?.length
  ? serialStore.workspaceLayout.splitPanes.map((pane) => ({
      tabs: Array.isArray(pane?.tabs) ? [...pane.tabs] : [],
      activeTab: typeof pane?.activeTab === 'string' ? pane.activeTab : ''
    }))
  : [{ tabs: [], activeTab: '' }])
const paneWidths = ref(Array.isArray(serialStore.workspaceLayout?.paneWidths)
  ? [...serialStore.workspaceLayout.paneWidths]
  : [])
const paneRefs = ref([])
const contentContainer = ref(null)

const draggedData = ref(null)
const dropZoneIndex = ref(-1)
const dropPosition = ref('')
const isDraggingSeparator = ref(false)
const draggingSeparatorIndex = ref(-1)
const separatorStartX = ref(0)
const initialLeftWidth = ref(0)
const initialRightWidth = ref(0)

const connectedPorts = computed(() => {
  return Array.from(serialStore.openPorts.entries())
    .filter(([, data]) => data.isConnected)
    .map(([path]) => path)
})

const allTabs = computed(() => splitPanes.value.flatMap((pane) => pane.tabs))
const setPaneRef = (element, paneIndex) => {
  if (element) {
    paneRefs.value[paneIndex] = element
  }
}

const getAvailablePaneWidth = (paneCount = splitPanes.value.length) => {
  const containerWidth = contentContainer.value?.clientWidth || 0
  return Math.max(0, containerWidth - Math.max(0, paneCount - 1) * PANE_GAP_WIDTH)
}

const getEvenPaneWidths = (paneCount = splitPanes.value.length) => {
  if (paneCount <= 1) return []
  const availableWidth = getAvailablePaneWidth(paneCount)
  const widthPerPane = availableWidth > 0 ? availableWidth / paneCount : 0
  return Array.from({ length: paneCount }, () => widthPerPane)
}

const getCurrentPaneWidths = (paneCount = splitPanes.value.length) => {
  if (paneCount <= 1) return []
  if (paneWidths.value.length === paneCount) {
    return [...paneWidths.value]
  }

  const measuredWidths = paneRefs.value
    .slice(0, paneCount)
    .map((pane) => pane?.offsetWidth || 0)
    .filter((width) => width > 0)

  if (measuredWidths.length === paneCount) {
    return measuredWidths
  }

  return getEvenPaneWidths(paneCount)
}

const normalizePaneWidths = (widths, paneCount = splitPanes.value.length) => {
  if (!widths || paneCount <= 1) return []
  if (widths.length !== paneCount) return getEvenPaneWidths(paneCount)

  const safeWidths = widths.map((width) => Math.max(0, Number(width) || 0))
  const totalWidth = safeWidths.reduce((sum, width) => sum + width, 0)
  const availableWidth = getAvailablePaneWidth(paneCount)

  if (!totalWidth || !availableWidth) return getEvenPaneWidths(paneCount)

  const minimumTotalWidth = paneCount * MIN_PANE_WIDTH
  if (availableWidth <= minimumTotalWidth) {
    return safeWidths.map((width) => width / totalWidth * availableWidth)
  }

  let normalizedWidths = safeWidths.map((width) => Math.max(MIN_PANE_WIDTH, width / totalWidth * availableWidth))
  let overflow = normalizedWidths.reduce((sum, width) => sum + width, 0) - availableWidth

  while (overflow > 0.5) {
    const adjustableIndexes = normalizedWidths
      .map((width, index) => ({ width, index }))
      .filter(({ width }) => width > MIN_PANE_WIDTH + 0.5)

    if (!adjustableIndexes.length) break

    const deduction = overflow / adjustableIndexes.length
    adjustableIndexes.forEach(({ index }) => {
      normalizedWidths[index] = Math.max(MIN_PANE_WIDTH, normalizedWidths[index] - deduction)
    })
    overflow = normalizedWidths.reduce((sum, width) => sum + width, 0) - availableWidth
  }

  const finalTotalWidth = normalizedWidths.reduce((sum, width) => sum + width, 0)
  if (finalTotalWidth > 0 && Math.abs(finalTotalWidth - availableWidth) > 0.5) {
    const scale = availableWidth / finalTotalWidth
    normalizedWidths = normalizedWidths.map((width) => width * scale)
  }

  return normalizedWidths
}

const applyPaneWidths = (widths, paneCount = splitPanes.value.length) => {
  paneWidths.value = normalizePaneWidths(widths, paneCount)
}

const trimPaneRefs = () => {
  paneRefs.value = paneRefs.value.slice(0, splitPanes.value.length)
}

const ensurePaneStructure = () => {
  if (!splitPanes.value.length) {
    splitPanes.value = [{ tabs: [], activeTab: '' }]
  }

  splitPanes.value.forEach((pane) => {
    if (!Array.isArray(pane.tabs)) {
      pane.tabs = []
    }

    if (!pane.tabs.includes(pane.activeTab)) {
      pane.activeTab = pane.tabs[0] || ''
    }
  })
}

const syncSelectedPortWithPanes = () => {
  const activeTabs = splitPanes.value
    .map((pane) => pane.activeTab)
    .filter(Boolean)

  if (serialStore.selectedPort && activeTabs.includes(serialStore.selectedPort)) {
    return
  }

  serialStore.selectedPort = activeTabs[0] || connectedPorts.value[0] || null
}

const syncPaneLayout = () => {
  ensurePaneStructure()
  syncSelectedPortWithPanes()
  serialStore.updateWorkspaceLayout({
    splitPanes: splitPanes.value,
    paneWidths: paneWidths.value
  })

  nextTick(() => {
    trimPaneRefs()
    handleResize()
  })
}

const removePaneAndWidth = (paneIndex) => {
  const nextPaneCount = splitPanes.value.length - 1
  const currentWidths = getCurrentPaneWidths(splitPanes.value.length)
  let removedWidth = 0

  if (currentWidths.length === splitPanes.value.length) {
    removedWidth = currentWidths[paneIndex] || 0
  }

  splitPanes.value.splice(paneIndex, 1)

  if (nextPaneCount <= 1) {
    paneWidths.value = []
    return
  }

  const nextWidths = currentWidths.filter((_, index) => index !== paneIndex)
  const targetIndex = Math.min(paneIndex, nextWidths.length - 1)
  if (targetIndex >= 0) {
    nextWidths[targetIndex] += removedWidth
  }
  applyPaneWidths(nextWidths, nextPaneCount)
}

watch(() => connectedPorts.value, (newPorts) => {
  const currentTabs = allTabs.value
  newPorts.forEach((port) => {
    if (!currentTabs.includes(port)) {
      ensurePaneStructure()
      splitPanes.value[0].tabs.push(port)
      if (!splitPanes.value[0].activeTab) {
        splitPanes.value[0].activeTab = port
      }
    }
  })

  splitPanes.value.forEach((pane) => {
    pane.tabs = pane.tabs.filter((port) => newPorts.includes(port))
    if (!newPorts.includes(pane.activeTab)) {
      pane.activeTab = pane.tabs[0] || ''
    }
  })

  while (splitPanes.value.length > 1 && splitPanes.value.some((pane) => pane.tabs.length === 0)) {
    const emptyIndex = splitPanes.value.findIndex((pane) => pane.tabs.length === 0)
    if (emptyIndex !== -1) {
      removePaneAndWidth(emptyIndex)
    }
  }

  ensurePaneStructure()
  if (!newPorts.includes(serialStore.selectedPort)) {
    serialStore.selectedPort = splitPanes.value.find((pane) => pane.activeTab)?.activeTab || newPorts[0] || null
  }
  syncPaneLayout()
}, { deep: true })

watch(() => serialStore.selectedPort, (selectedPort) => {
  if (!selectedPort) {
    syncSelectedPortWithPanes()
    return
  }

  const targetPaneIndex = splitPanes.value.findIndex((pane) => pane.tabs.includes(selectedPort))
  if (targetPaneIndex === -1) {
    syncSelectedPortWithPanes()
    return
  }

  if (splitPanes.value[targetPaneIndex].activeTab !== selectedPort) {
    splitPanes.value[targetPaneIndex].activeTab = selectedPort
  }
})

watch(paneWidths, (widths) => {
  serialStore.updateWorkspaceLayout({
    splitPanes: splitPanes.value,
    paneWidths: widths
  })
}, { deep: true })

const selectTab = (paneIndex, port) => {
  splitPanes.value[paneIndex].activeTab = port
  serialStore.selectedPort = port
}

const disconnectPort = (port) => {
  serialStore.disconnect(port)
}

const splitPane = (paneIndex) => {
  const pane = splitPanes.value[paneIndex]
  if (!pane.tabs.length) return

  const sourcePaneElement = paneRefs.value[paneIndex]
  const sourcePaneWidth = sourcePaneElement?.offsetWidth || 0
  const lastTab = pane.tabs.pop()
  if (pane.activeTab === lastTab) {
    pane.activeTab = pane.tabs[0] || ''
  }

  splitPanes.value.splice(paneIndex + 1, 0, {
    tabs: [lastTab],
    activeTab: lastTab
  })

  if (!sourcePaneWidth) {
    paneWidths.value = getEvenPaneWidths(splitPanes.value.length)
    syncPaneLayout()
    return
  }

  const nextWidths = getCurrentPaneWidths(splitPanes.value.length - 1)
  const primaryWidth = Math.max(MIN_PANE_WIDTH, Math.floor(sourcePaneWidth / 2))
  const splitWidth = Math.max(MIN_PANE_WIDTH, sourcePaneWidth - primaryWidth)
  nextWidths[paneIndex] = primaryWidth
  nextWidths.splice(paneIndex + 1, 0, splitWidth)
  applyPaneWidths(nextWidths, splitPanes.value.length)
  syncPaneLayout()
}

const removeEmptyPane = (paneIndex) => {
  if (splitPanes.value.length <= 1) return
  if (splitPanes.value[paneIndex].tabs.length > 0) return
  removePaneAndWidth(paneIndex)
  syncPaneLayout()
}

const handleContentDragOver = (event, paneIndex) => {
  event.preventDefault()
  if (!draggedData.value) return

  dropZoneIndex.value = paneIndex
  const rect = event.currentTarget.getBoundingClientRect()
  dropPosition.value = event.clientX - rect.left < rect.width / 2 ? 'left' : 'right'
}

const handleContentDrop = (event, targetPaneIndex) => {
  event.preventDefault()
  const data = draggedData.value
  if (!data) return

  const { paneIndex: sourcePaneIndex, port } = data
  if (sourcePaneIndex === targetPaneIndex) {
    dropZoneIndex.value = -1
    dropPosition.value = ''
    return
  }

  const sourcePane = splitPanes.value[sourcePaneIndex]
  const sourceTabIndex = sourcePane.tabs.indexOf(port)
  if (sourceTabIndex !== -1) {
    sourcePane.tabs.splice(sourceTabIndex, 1)
    if (sourcePane.activeTab === port) {
      sourcePane.activeTab = sourcePane.tabs[0] || ''
    }
  }

  const targetPane = splitPanes.value[targetPaneIndex]
  if (dropPosition.value === 'right') {
    targetPane.tabs.push(port)
  } else {
    targetPane.tabs.unshift(port)
  }

  if (!targetPane.activeTab) {
    targetPane.activeTab = port
  }

  if (sourcePane.tabs.length === 0 && splitPanes.value.length > 1) {
    removePaneAndWidth(sourcePaneIndex)
  }

  dropZoneIndex.value = -1
  dropPosition.value = ''
  draggedData.value = null
  syncPaneLayout()
}

const handleContentDragLeave = () => {
  dropZoneIndex.value = -1
  dropPosition.value = ''
}

const handleDragStart = (event, paneIndex, port) => {
  draggedData.value = { paneIndex, port }
  event.dataTransfer.setData('text', JSON.stringify({ paneIndex, port }))
  event.dataTransfer.effectAllowed = 'move'
}

const handleTabListDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

const handleTabListDrop = (event, targetPaneIndex) => {
  event.preventDefault()
  const data = JSON.parse(event.dataTransfer.getData('text'))
  if (!data) return

  const { paneIndex: sourcePaneIndex, port } = data
  if (sourcePaneIndex === targetPaneIndex) return

  const sourcePane = splitPanes.value[sourcePaneIndex]
  const sourceTabIndex = sourcePane.tabs.indexOf(port)
  if (sourceTabIndex !== -1) {
    sourcePane.tabs.splice(sourceTabIndex, 1)
    if (sourcePane.activeTab === port) {
      sourcePane.activeTab = sourcePane.tabs[0] || ''
    }
  }

  const targetPane = splitPanes.value[targetPaneIndex]
  targetPane.tabs.push(port)
  if (!targetPane.activeTab) {
    targetPane.activeTab = port
  }

  if (sourcePane.tabs.length === 0 && splitPanes.value.length > 1) {
    removePaneAndWidth(sourcePaneIndex)
  }

  draggedData.value = null
  dropZoneIndex.value = -1
  syncPaneLayout()
}

const handleDragEnd = () => {
  draggedData.value = null
  dropZoneIndex.value = -1
  dropPosition.value = ''
}

const handleSeparatorMouseDown = (event, index) => {
  isDraggingSeparator.value = true
  draggingSeparatorIndex.value = index
  separatorStartX.value = event.clientX

  const paneGroups = document.querySelectorAll('.split-pane-group')
  const leftPane = paneGroups[index - 1]
  const rightPane = paneGroups[index]

  if (leftPane && rightPane) {
    initialLeftWidth.value = leftPane.offsetWidth
    initialRightWidth.value = rightPane.offsetWidth
  }

  document.body.style.cursor = 'col-resize'
  event.preventDefault()
}

const handleSeparatorMouseMove = (event) => {
  if (!isDraggingSeparator.value || draggingSeparatorIndex.value === -1) return

  const delta = event.clientX - separatorStartX.value
  const paneGroups = document.querySelectorAll('.split-pane-group')
  const leftPane = paneGroups[draggingSeparatorIndex.value - 1]
  const rightPane = paneGroups[draggingSeparatorIndex.value]
  if (!leftPane || !rightPane) return

  const minWidth = 240
  const newLeftWidth = initialLeftWidth.value + delta
  const newRightWidth = initialRightWidth.value - delta

  if (newLeftWidth < minWidth || newRightWidth < minWidth) return

  const nextWidths = getCurrentPaneWidths()
  nextWidths[draggingSeparatorIndex.value - 1] = newLeftWidth
  nextWidths[draggingSeparatorIndex.value] = newRightWidth
  applyPaneWidths(nextWidths)
}

const handleSeparatorMouseUp = () => {
  isDraggingSeparator.value = false
  draggingSeparatorIndex.value = -1
  document.body.style.cursor = ''
}

const handleResize = () => {
  if (isDraggingSeparator.value) return

  const paneCount = splitPanes.value.length
  if (paneCount <= 1) {
    paneWidths.value = []
    return
  }

  const widths = getCurrentPaneWidths(paneCount)
  applyPaneWidths(widths, paneCount)
}

onMounted(() => {
  window.addEventListener('mousemove', handleSeparatorMouseMove)
  window.addEventListener('mouseup', handleSeparatorMouseUp)
  window.addEventListener('resize', handleResize)
  syncPaneLayout()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleSeparatorMouseMove)
  window.removeEventListener('mouseup', handleSeparatorMouseUp)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="terminal-shell">
    <div ref="contentContainer" class="content-container">
      <template v-for="(pane, paneIndex) in splitPanes" :key="paneIndex">
        <div
          v-if="paneIndex > 0"
          class="split-separator"
          @mousedown="handleSeparatorMouseDown($event, paneIndex)"
          @dragover="handleTabListDragOver"
          @drop="handleTabListDrop($event, paneIndex)"
        ></div>

        <div
          :ref="(element) => setPaneRef(element, paneIndex)"
          class="split-pane-group"
          :style="paneWidths.length === splitPanes.length ? { flex: `0 0 ${Math.floor(paneWidths[paneIndex])}px` } : null"
        >
          <div class="tab-header-section">
            <div class="tab-list">
              <div
                v-for="port in pane.tabs"
                :key="port"
                :class="['tab-item', { active: pane.activeTab === port }]"
                :draggable="true"
                @click="selectTab(paneIndex, port)"
                @dragstart="handleDragStart($event, paneIndex, port)"
                @dragend="handleDragEnd"
              >
                <span class="tab-icon"></span>
                <span class="tab-label">{{ port }}</span>
                <span class="tab-close" @click.stop="disconnectPort(port)">×</span>
              </div>
            </div>
            <button class="pane-split-btn" title="向右拆分" @click.stop="splitPane(paneIndex)">
              拆分
            </button>
          </div>

          <div
            class="split-pane"
            @dragover="handleContentDragOver($event, paneIndex)"
            @drop="handleContentDrop($event, paneIndex)"
            @dragleave="handleContentDragLeave"
            :class="{
              'drop-zone-left': dropZoneIndex === paneIndex && dropPosition === 'left',
              'drop-zone-right': dropZoneIndex === paneIndex && dropPosition === 'right'
            }"
          >
            <SerialPanel v-if="pane.activeTab" :port-path="pane.activeTab" class="panel-full" />
            <div v-else class="empty-state">
              <span class="empty-icon">◎</span>
              <p>这个面板还没有串口</p>
              <span class="empty-hint">连接设备后会自动出现在这里，也可以拖拽标签重新排布。</span>
              <button class="delete-empty-btn" @click="removeEmptyPane(paneIndex)">
                删除空面板
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.terminal-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: rgba(7, 13, 19, 0.82);
}

.content-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  padding: 6px;
  gap: 6px;
}

.split-pane-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  border-radius: 14px;
  background: rgba(8, 14, 20, 0.58);
  border: 1px solid rgba(126, 161, 183, 0.12);
}

.split-separator {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  position: relative;
}

.split-separator::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 2px;
  width: 2px;
  border-radius: 999px;
  background: rgba(98, 130, 151, 0.18);
  transition: all 0.18s ease;
}

.split-separator:hover::before {
  background: rgba(87, 199, 255, 0.4);
}

.tab-header-section {
  display: flex;
  align-items: center;
  background: rgba(10, 19, 27, 0.56);
  border-bottom: 1px solid rgba(126, 161, 183, 0.12);
  flex-shrink: 0;
  height: 40px;
}

.tab-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
  align-items: center;
  padding-left: 6px;
}

.tab-list::-webkit-scrollbar {
  height: 4px;
}

.tab-list::-webkit-scrollbar-thumb {
  background: rgba(126, 161, 183, 0.3);
  border-radius: 999px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-right: 6px;
  min-width: 112px;
  max-width: 220px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  border: 1px solid transparent;
  color: #b7cbd9;
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.tab-item.active {
  background: rgba(87, 199, 255, 0.08);
  border-color: rgba(87, 199, 255, 0.16);
  color: #f4fbff;
}

.tab-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #57c7ff;
  box-shadow: 0 0 0 4px rgba(87, 199, 255, 0.08);
  flex-shrink: 0;
}

.tab-label {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 14px;
  color: #8ca4b6;
}

.tab-close:hover {
  background: rgba(196, 43, 28, 0.18);
  color: #fff;
}

.pane-split-btn {
  margin-right: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(126, 161, 183, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: #a8bfce;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.18s ease;
}

.pane-split-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.split-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.split-pane.drop-zone-left {
  background: linear-gradient(to right, rgba(87, 199, 255, 0.18) 0%, transparent 28%);
  box-shadow: inset 3px 0 0 rgba(87, 199, 255, 0.54);
}

.split-pane.drop-zone-right {
  background: linear-gradient(to left, rgba(87, 199, 255, 0.18) 0%, transparent 28%);
  box-shadow: inset -3px 0 0 rgba(87, 199, 255, 0.54);
}

.panel-full {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: #8ea5b7;
}

.empty-icon {
  width: 72px;
  height: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  color: #dceaf4;
  font-size: 28px;
}

.empty-state p {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #eef8ff;
}

.empty-hint {
  max-width: 340px;
  line-height: 1.6;
}

.delete-empty-btn {
  margin-top: 6px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(196, 43, 28, 0.22);
  background: rgba(196, 43, 28, 0.14);
  color: #ffd5d1;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.delete-empty-btn:hover {
  background: rgba(196, 43, 28, 0.22);
}
</style>
