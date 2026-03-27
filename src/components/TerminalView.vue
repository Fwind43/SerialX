<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSerialStore } from '../stores/serial'
import SerialPanel from './SerialPanel.vue'

const serialStore = useSerialStore()
const themeMode = computed(() => serialStore.appUiState?.themeMode || 'dark')

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
let contentResizeObserver = null
let suppressWorkspaceLayoutSync = false
const tabContextMenuRef = ref(null)
const tabContextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  paneIndex: -1,
  port: ''
})

const draggedData = ref(null)
const draggedPaneIndex = ref(-1)
const dropZoneIndex = ref(-1)
const dropPosition = ref('')
const paneDropIndex = ref(-1)
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
const tabContextMenuPane = computed(() => splitPanes.value[tabContextMenu.value.paneIndex] || null)
const tabContextMenuPortIndex = computed(() => (
  tabContextMenuPane.value ? tabContextMenuPane.value.tabs.indexOf(tabContextMenu.value.port) : -1
))
const canMoveTabToNewPane = computed(() => {
  const pane = tabContextMenuPane.value
  if (!pane || !pane.tabs.includes(tabContextMenu.value.port)) return false
  return !(splitPanes.value.length === 1 && pane.tabs.length === 1)
})
const canCloseTabsToRight = computed(() => {
  const pane = tabContextMenuPane.value
  return Boolean(pane && tabContextMenuPortIndex.value !== -1 && tabContextMenuPortIndex.value < pane.tabs.length - 1)
})
const canCloseTabsToLeft = computed(() => {
  const pane = tabContextMenuPane.value
  return Boolean(pane && tabContextMenuPortIndex.value > 0)
})
const canCloseOtherTabs = computed(() => allTabs.value.filter((item) => item !== tabContextMenu.value.port).length > 0)
const canCloseCurrentPane = computed(() => Boolean(tabContextMenuPane.value?.tabs.length))

const cloneLayoutPanes = (panes = []) => (
  Array.isArray(panes)
    ? panes.map((pane) => ({
        tabs: Array.isArray(pane?.tabs) ? [...pane.tabs] : [],
        activeTab: typeof pane?.activeTab === 'string' ? pane.activeTab : ''
      }))
    : []
)

const getLayoutSignature = (layout = null) => JSON.stringify({
  splitPanes: cloneLayoutPanes(layout?.splitPanes),
  paneWidths: Array.isArray(layout?.paneWidths) ? layout.paneWidths.map((width) => Number(width) || 0) : []
})

const getLocalLayoutSignature = () => JSON.stringify({
  splitPanes: cloneLayoutPanes(splitPanes.value),
  paneWidths: [...paneWidths.value]
})

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

  const assignedTabs = new Set()

  splitPanes.value.forEach((pane) => {
    if (!Array.isArray(pane.tabs)) {
      pane.tabs = []
    }

    pane.tabs = pane.tabs.filter((port) => {
      if (typeof port !== 'string' || !port || assignedTabs.has(port)) {
        return false
      }

      assignedTabs.add(port)
      return true
    })

    if (!pane.tabs.includes(pane.activeTab)) {
      pane.activeTab = pane.tabs[0] || ''
    }
  })

  while (splitPanes.value.length > 1 && splitPanes.value.some((pane) => pane.tabs.length === 0)) {
    const emptyIndex = splitPanes.value.findIndex((pane) => pane.tabs.length === 0)
    if (emptyIndex === -1) break
    removePaneAndWidth(emptyIndex)
  }
}

const syncSelectedPortWithPanes = () => {
  const activeTabs = splitPanes.value
    .map((pane) => pane.activeTab)
    .filter(Boolean)

  if (serialStore.selectedPort && allTabs.value.includes(serialStore.selectedPort)) {
    return
  }

  serialStore.selectedPort = activeTabs[0] || allTabs.value[0] || connectedPorts.value[0] || null
}

const syncPaneLayout = () => {
  ensurePaneStructure()
  syncSelectedPortWithPanes()
  if (suppressWorkspaceLayoutSync) {
    nextTick(() => {
      trimPaneRefs()
      handleResize()
    })
    return
  }

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
  let latestConnectedPort = null
  newPorts.forEach((port) => {
    if (!currentTabs.includes(port)) {
      ensurePaneStructure()
      splitPanes.value[0].tabs.push(port)
      splitPanes.value[0].activeTab = port
      latestConnectedPort = port
    }
  })

  ensurePaneStructure()
  if (latestConnectedPort) {
    serialStore.selectedPort = latestConnectedPort
  } else if (!serialStore.selectedPort || !allTabs.value.includes(serialStore.selectedPort)) {
    serialStore.selectedPort = splitPanes.value.find((pane) => pane.activeTab)?.activeTab || allTabs.value[0] || newPorts[0] || null
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

watch(
  () => getLayoutSignature(serialStore.workspaceLayout),
  () => {
    const workspaceLayout = serialStore.workspaceLayout || {}
    if (getLayoutSignature(workspaceLayout) === getLocalLayoutSignature()) {
      return
    }

    suppressWorkspaceLayoutSync = true
    splitPanes.value = cloneLayoutPanes(workspaceLayout.splitPanes)
    paneWidths.value = Array.isArray(workspaceLayout.paneWidths) ? [...workspaceLayout.paneWidths] : []
    ensurePaneStructure()
    syncSelectedPortWithPanes()

    nextTick(() => {
      trimPaneRefs()
      handleResize()
      suppressWorkspaceLayoutSync = false
    })
  },
  { deep: true }
)

watch(paneWidths, (widths) => {
  if (suppressWorkspaceLayoutSync) return
  serialStore.updateWorkspaceLayout({
    splitPanes: splitPanes.value,
    paneWidths: widths
  })
}, { deep: true })

const selectTab = (paneIndex, port) => {
  splitPanes.value[paneIndex].activeTab = port
  serialStore.selectedPort = port
}

const removeTabFromPanes = (port) => {
  if (!port) return false

  let removed = false
  splitPanes.value.forEach((pane) => {
    const tabIndex = pane.tabs.indexOf(port)
    if (tabIndex === -1) {
      return
    }

    removed = true
    pane.tabs.splice(tabIndex, 1)
    if (pane.activeTab === port) {
      pane.activeTab = pane.tabs[tabIndex] || pane.tabs[tabIndex - 1] || pane.tabs[0] || ''
    }
  })

  while (splitPanes.value.length > 1 && splitPanes.value.some((pane) => pane.tabs.length === 0)) {
    const emptyIndex = splitPanes.value.findIndex((pane) => pane.tabs.length === 0)
    if (emptyIndex === -1) break
    removePaneAndWidth(emptyIndex)
  }

  if (!splitPanes.value.length) {
    splitPanes.value = [{ tabs: [], activeTab: '' }]
  }

  return removed
}

const closePortTab = async (port) => {
  if (!port) return false

  if (serialStore.getPortStatus(port)) {
    const didDisconnect = await serialStore.disconnect(port)
    if (!didDisconnect && serialStore.getPortStatus(port)) {
      return false
    }
  }

  const removed = removeTabFromPanes(port)
  if (!removed) return false

  syncPaneLayout()
  return true
}

const closePortTabsSequentially = async (ports) => {
  for (const port of ports) {
    const didClose = await closePortTab(port)
    if (!didClose) {
      return false
    }
  }

  return true
}

const closeTabByPort = async (port) => {
  await closePortTab(port)
}

const closeTabContextMenu = () => {
  tabContextMenu.value.visible = false
  tabContextMenu.value.paneIndex = -1
  tabContextMenu.value.port = ''
}

const clampTabContextMenuPosition = () => {
  const menu = tabContextMenuRef.value
  if (!menu) return

  const margin = 12
  const rect = menu.getBoundingClientRect()
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin)
  const maxY = Math.max(margin, window.innerHeight - rect.height - margin)

  tabContextMenu.value.x = Math.min(Math.max(margin, tabContextMenu.value.x), maxX)
  tabContextMenu.value.y = Math.min(Math.max(margin, tabContextMenu.value.y), maxY)
}

const openTabContextMenu = async (event, paneIndex, port) => {
  event.preventDefault()
  selectTab(paneIndex, port)
  tabContextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    paneIndex,
    port
  }
  await nextTick()
  clampTabContextMenuPosition()
}

const moveTabToNewPane = (paneIndex, port) => {
  const sourcePane = splitPanes.value[paneIndex]
  if (!sourcePane || !sourcePane.tabs.includes(port)) {
    closeTabContextMenu()
    return
  }

  if (splitPanes.value.length === 1 && sourcePane.tabs.length === 1) {
    closeTabContextMenu()
    return
  }

  const sourcePaneElement = paneRefs.value[paneIndex]
  const sourcePaneWidth = sourcePaneElement?.offsetWidth || 0
  const sourceTabIndex = sourcePane.tabs.indexOf(port)
  if (sourceTabIndex === -1) {
    closeTabContextMenu()
    return
  }

  sourcePane.tabs.splice(sourceTabIndex, 1)
  if (sourcePane.activeTab === port) {
    sourcePane.activeTab = sourcePane.tabs[0] || ''
  }

  splitPanes.value.splice(paneIndex + 1, 0, {
    tabs: [port],
    activeTab: port
  })

  if (!sourcePaneWidth) {
    paneWidths.value = getEvenPaneWidths(splitPanes.value.length)
  } else {
    const nextWidths = getCurrentPaneWidths(splitPanes.value.length - 1)
    const primaryWidth = Math.max(MIN_PANE_WIDTH, Math.floor(sourcePaneWidth / 2))
    const splitWidth = Math.max(MIN_PANE_WIDTH, sourcePaneWidth - primaryWidth)
    nextWidths[paneIndex] = primaryWidth
    nextWidths.splice(paneIndex + 1, 0, splitWidth)
    applyPaneWidths(nextWidths, splitPanes.value.length)
  }

  if (sourcePane.tabs.length === 0 && splitPanes.value.length > 1) {
    removePaneAndWidth(paneIndex)
  }

  serialStore.selectedPort = port
  closeTabContextMenu()
  syncPaneLayout()
}

const closeOtherTabs = async (paneIndex, port) => {
  const portsToClose = allTabs.value.filter((item) => item !== port)
  serialStore.selectedPort = port
  closeTabContextMenu()
  await closePortTabsSequentially(portsToClose)
}

const resolveFallbackPort = (excludedPorts = []) => {
  const excluded = new Set(excludedPorts)
  return connectedPorts.value.find((port) => !excluded.has(port)) || null
}

const closeTabsToRight = async (paneIndex, port) => {
  const pane = splitPanes.value[paneIndex]
  if (!pane) return

  const currentIndex = pane.tabs.indexOf(port)
  if (currentIndex === -1 || currentIndex >= pane.tabs.length - 1) {
    closeTabContextMenu()
    return
  }

  const portsToClose = pane.tabs.slice(currentIndex + 1)
  serialStore.selectedPort = port
  closeTabContextMenu()
  await closePortTabsSequentially(portsToClose)
}

const closeTabsToLeft = async (paneIndex, port) => {
  const pane = splitPanes.value[paneIndex]
  if (!pane) return

  const currentIndex = pane.tabs.indexOf(port)
  if (currentIndex <= 0) {
    closeTabContextMenu()
    return
  }

  const portsToClose = pane.tabs.slice(0, currentIndex)
  serialStore.selectedPort = port
  closeTabContextMenu()
  await closePortTabsSequentially(portsToClose)
}

const closeCurrentPane = async (paneIndex) => {
  const pane = splitPanes.value[paneIndex]
  if (!pane || !pane.tabs.length) {
    closeTabContextMenu()
    return
  }

  const portsToClose = [...pane.tabs]
  serialStore.selectedPort = resolveFallbackPort(portsToClose)
  closeTabContextMenu()
  await closePortTabsSequentially(portsToClose)
}

const closeCurrentTab = async (paneIndex, port) => {
  closeTabContextMenu()
  await closePortTab(port)
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

const movePane = (sourceIndex, targetIndex) => {
  if (sourceIndex === targetIndex) return
  if (sourceIndex < 0 || targetIndex < 0) return
  if (sourceIndex >= splitPanes.value.length || targetIndex >= splitPanes.value.length) return

  const movedPane = splitPanes.value.splice(sourceIndex, 1)[0]
  splitPanes.value.splice(targetIndex, 0, movedPane)

  if (paneWidths.value.length === splitPanes.value.length) {
    const movedWidth = paneWidths.value.splice(sourceIndex, 1)[0]
    paneWidths.value.splice(targetIndex, 0, movedWidth)
  }

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

const handlePaneDragStart = (event, paneIndex) => {
  draggedPaneIndex.value = paneIndex
  event.dataTransfer.setData('application/x-pane-index', String(paneIndex))
  event.dataTransfer.effectAllowed = 'move'
}

const handlePaneDragOver = (event, paneIndex) => {
  if (draggedPaneIndex.value === -1) return
  event.preventDefault()
  paneDropIndex.value = paneIndex
  event.dataTransfer.dropEffect = 'move'
}

const handlePaneDrop = (event, targetPaneIndex) => {
  event.preventDefault()
  if (draggedPaneIndex.value === -1) return

  movePane(draggedPaneIndex.value, targetPaneIndex)
  draggedPaneIndex.value = -1
  paneDropIndex.value = -1
}

const handlePaneDragLeave = (event, paneIndex) => {
  if (draggedPaneIndex.value === -1) return
  const nextTarget = event.relatedTarget
  if (nextTarget && event.currentTarget.contains(nextTarget)) return
  if (paneDropIndex.value === paneIndex) {
    paneDropIndex.value = -1
  }
}

const handlePaneDragEnd = () => {
  draggedPaneIndex.value = -1
  paneDropIndex.value = -1
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
  draggedPaneIndex.value = -1
  paneDropIndex.value = -1
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
  if (contentContainer.value) {
    contentResizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    contentResizeObserver.observe(contentContainer.value)
  }

  window.addEventListener('mousemove', handleSeparatorMouseMove)
  window.addEventListener('mouseup', handleSeparatorMouseUp)
  window.addEventListener('resize', handleResize)
  window.addEventListener('click', closeTabContextMenu)
  window.addEventListener('blur', closeTabContextMenu)
  window.addEventListener('scroll', closeTabContextMenu, true)
  syncPaneLayout()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleSeparatorMouseMove)
  window.removeEventListener('mouseup', handleSeparatorMouseUp)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', closeTabContextMenu)
  window.removeEventListener('blur', closeTabContextMenu)
  window.removeEventListener('scroll', closeTabContextMenu, true)

  if (contentResizeObserver) {
    contentResizeObserver.disconnect()
    contentResizeObserver = null
  }
})
</script>

<template>
  <div :class="['terminal-shell', `theme-${themeMode}`]">
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
          :class="['split-pane-group', { 'pane-drop-target': paneDropIndex === paneIndex }]"
          :style="paneWidths.length === splitPanes.length ? { flex: `0 0 ${Math.floor(paneWidths[paneIndex])}px` } : null"
          @dragover="handlePaneDragOver($event, paneIndex)"
          @drop="handlePaneDrop($event, paneIndex)"
          @dragleave="handlePaneDragLeave($event, paneIndex)"
        >
          <div class="tab-header-section">
            <div class="tab-list">
              <div
                v-for="port in pane.tabs"
                :key="port"
                :class="['tab-item', { active: pane.activeTab === port }]"
                :draggable="true"
                @click="selectTab(paneIndex, port)"
                @contextmenu="openTabContextMenu($event, paneIndex, port)"
                @dragstart="handleDragStart($event, paneIndex, port)"
                @dragend="handleDragEnd"
              >
                <span class="tab-icon"></span>
                <span class="tab-label">{{ port }}</span>
                <span class="tab-close" @click.stop="closeTabByPort(port)">×</span>
              </div>
            </div>
            <div class="pane-actions">
              <button
                v-if="splitPanes.length > 1"
                class="pane-drag-handle"
                title="拖动调换分屏位置"
                draggable="true"
                @dragstart="handlePaneDragStart($event, paneIndex)"
                @dragend="handlePaneDragEnd"
              >
                ⋮⋮
              </button>
              <button class="pane-split-btn" title="向右拆分" @click.stop="splitPane(paneIndex)">
                拆分
              </button>
            </div>
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

    <Teleport to="body">
      <div
        v-if="tabContextMenu.visible"
        ref="tabContextMenuRef"
        class="tab-context-menu"
        :style="{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }"
        @click.stop
      >
        <button class="tab-context-item" :disabled="!canMoveTabToNewPane" @click="moveTabToNewPane(tabContextMenu.paneIndex, tabContextMenu.port)">
          移动到新分屏
        </button>
        <button class="tab-context-item" :disabled="!canCloseTabsToRight" @click="closeTabsToRight(tabContextMenu.paneIndex, tabContextMenu.port)">
          关闭右侧标签
        </button>
        <button class="tab-context-item" :disabled="!canCloseTabsToLeft" @click="closeTabsToLeft(tabContextMenu.paneIndex, tabContextMenu.port)">
          关闭左侧标签
        </button>
        <button class="tab-context-item" :disabled="!canCloseOtherTabs" @click="closeOtherTabs(tabContextMenu.paneIndex, tabContextMenu.port)">
          关闭其他标签
        </button>
        <button class="tab-context-item" :disabled="!canCloseCurrentPane" @click="closeCurrentPane(tabContextMenu.paneIndex)">
          关闭当前分屏
        </button>
        <button class="tab-context-item danger" @click="closeCurrentTab(tabContextMenu.paneIndex, tabContextMenu.port)">
          关闭当前标签
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.terminal-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: var(--app-workspace-shell);
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
  background: var(--app-workspace-base);
  border: 1px solid var(--app-border);
}

.split-pane-group.pane-drop-target {
  border-color: var(--app-accent-strong);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-accent-strong) 38%, transparent);
}

.tab-context-menu {
  position: fixed;
  z-index: 80;
  min-width: 160px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-menu-bg, var(--app-workspace-shell-strong));
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
}

.tab-context-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  font-size: 13px;
  line-height: 1.4;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.tab-context-item:hover {
  background: var(--app-accent-soft);
}

.tab-context-item:disabled {
  cursor: default;
  opacity: 0.45;
}

.tab-context-item:disabled:hover {
  background: transparent;
}

.tab-context-item.danger {
  color: var(--app-danger-text);
}

.tab-context-item.danger:hover {
  background: var(--app-danger-soft);
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
  background: var(--app-border);
  transition: all 0.18s ease;
}

.split-separator:hover::before { background: var(--app-accent-strong); }

.tab-header-section {
  display: flex;
  align-items: center;
  background: var(--app-workspace-soft);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
  height: 40px;
}

.pane-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 8px;
  flex-shrink: 0;
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
  background: var(--app-border);
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
  color: var(--app-text-soft);
}

.tab-item:hover { background: var(--app-chip-bg); }

.tab-item.active {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
  color: var(--app-text);
}

.tab-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--app-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-accent) 12%, transparent);
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
  color: var(--app-text-soft);
}

.tab-close:hover {
  background: var(--app-danger-soft);
  color: var(--app-text);
}

.pane-split-btn {
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-text);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.18s ease;
}

.pane-split-btn:hover { background: var(--app-accent-soft); }

.pane-drag-handle {
  min-width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid var(--app-border);
  background: var(--app-chip-bg);
  color: var(--app-text-soft);
  cursor: grab;
  font-size: 13px;
  line-height: 1;
  letter-spacing: -1px;
  transition: all 0.18s ease;
}

.pane-drag-handle:hover {
  background: var(--app-accent-soft);
  color: var(--app-text);
}

.pane-drag-handle:active {
  cursor: grabbing;
  transform: translateY(1px);
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
  background: linear-gradient(to right, var(--app-accent-soft) 0%, transparent 28%);
  box-shadow: inset 3px 0 0 var(--app-accent);
}

.split-pane.drop-zone-right {
  background: linear-gradient(to left, var(--app-accent-soft) 0%, transparent 28%);
  box-shadow: inset -3px 0 0 var(--app-accent);
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
  color: var(--app-text-soft);
}

.empty-icon {
  width: 72px;
  height: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: var(--app-chip-bg);
  color: var(--app-chip-text);
  font-size: 28px;
}

.empty-state p {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.empty-hint {
  max-width: 340px;
  line-height: 1.6;
}

.delete-empty-btn {
  margin-top: 6px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--app-danger-border);
  background: var(--app-danger-soft);
  color: var(--app-danger-text);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.delete-empty-btn:hover { background: color-mix(in srgb, var(--app-danger) 18%, transparent); }

.theme-light.terminal-shell {
  background: var(--app-workspace-base, var(--app-surface-base, #ffffff));
}

.theme-light .split-pane-group {
  background: var(--app-workspace-base, var(--app-surface-base, #ffffff));
  border-color: rgba(0, 102, 153, 0.12);
}

.theme-light .split-separator::before {
  background: rgba(0, 102, 153, 0.14);
}

.theme-light .split-separator:hover::before {
  background: rgba(33, 122, 184, 0.34);
}

.theme-light .tab-header-section {
  background: var(--app-workspace-soft, var(--app-surface-soft, #ffffff));
  border-bottom-color: rgba(0, 102, 153, 0.12);
}

.theme-light .tab-list::-webkit-scrollbar-thumb {
  background: rgba(197, 216, 232, 0.9);
}

.theme-light .tab-item {
  color: #6b7785;
}

.theme-light .tab-item:hover {
  background: rgba(33, 122, 184, 0.06);
}

.theme-light .tab-item.active {
  background: rgba(0, 120, 212, 0.1);
  border-color: rgba(0, 120, 212, 0.18);
  color: #1f2328;
}

.theme-light .tab-icon {
  background: #1f84c8;
  box-shadow: 0 0 0 4px rgba(31, 132, 200, 0.12);
}

.theme-light .tab-close {
  color: #6c8597;
}

.theme-light .tab-close:hover {
  color: var(--app-text);
}

.theme-light .pane-split-btn {
  border-color: rgba(0, 102, 153, 0.12);
  background: var(--app-workspace-soft, var(--app-surface-soft, #ffffff));
  color: #1f2328;
}

.theme-light .pane-split-btn:hover {
  background: rgba(33, 122, 184, 0.1);
}

.theme-light .split-pane.drop-zone-left {
  background: linear-gradient(to right, rgba(33, 122, 184, 0.12) 0%, transparent 28%);
  box-shadow: inset 3px 0 0 rgba(33, 122, 184, 0.34);
}

.theme-light .split-pane.drop-zone-right {
  background: linear-gradient(to left, rgba(33, 122, 184, 0.12) 0%, transparent 28%);
  box-shadow: inset -3px 0 0 rgba(33, 122, 184, 0.34);
}

.theme-light .empty-state {
  color: #6b7785;
}

.theme-light .empty-icon {
  background: rgba(0, 120, 212, 0.08);
  color: #005fb8;
}

.theme-light .empty-state p {
  color: #1f2328;
}

.theme-light .delete-empty-btn {
  border-color: rgba(196, 43, 28, 0.18);
  background: rgba(196, 43, 28, 0.08);
  color: #b2473d;
}

.theme-light .delete-empty-btn:hover {
  background: rgba(196, 43, 28, 0.14);
}
</style>
