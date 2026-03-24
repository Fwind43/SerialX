<script setup>
import { computed, ref } from 'vue'
import { useSerialStore } from '../stores/serial'

const serialStore = useSerialStore()

const props = defineProps({
  show: { type: Boolean, default: false },
  standalone: { type: Boolean, default: false }
})

const emit = defineEmits(['update:show'])

const activePanel = ref('theme')
const newThemeName = ref('')
const actionMessage = ref('')
const actionTone = ref('info')

const appUiState = computed(() => serialStore.appUiState || {})
const terminalAppearance = computed(() => serialStore.terminalAppearance || {})
const appTheme = computed(() => serialStore.appTheme || {})
const customThemes = computed(() => serialStore.customAppearancePresets || [])

const activeThemeId = computed(() => (
  appUiState.value.activeThemeSchemeId ||
  appUiState.value.terminalAppearanceMode ||
  `preset-${appUiState.value.themeMode || 'dark'}`
))

const themeOptions = computed(() => ([
  { id: 'preset-dark', mode: 'preset-dark', name: '深色默认', kind: 'built-in', description: '内置深色主题，适合作为暗色基底' },
  { id: 'preset-light', mode: 'preset-light', name: '浅色默认', kind: 'built-in', description: '内置浅色主题，适合作为亮色基底' },
  ...customThemes.value.map((theme) => ({
    id: theme.id,
    mode: `custom:${theme.id}`,
    name: theme.name,
    kind: 'custom',
    description: '用户自定义主题，可继续编辑'
  }))
]))

const activeTheme = computed(() => (
  themeOptions.value.find((theme) => theme.mode === activeThemeId.value) || themeOptions.value[0]
))

const isBuiltInTheme = computed(() => (
  activeThemeId.value === 'preset-dark' || activeThemeId.value === 'preset-light'
))

const canEditTheme = computed(() => !isBuiltInTheme.value)
const canCreateTheme = computed(() => (
  typeof serialStore.createThemeScheme === 'function' ||
  typeof serialStore.createCustomTerminalAppearancePreset === 'function'
))

const wallpaperPath = computed(() => appUiState.value.wallpaperPath || '')
const wallpaperEnabled = computed(() => Boolean(appUiState.value.wallpaperEnabled && wallpaperPath.value))

const themePanels = [
  { id: 'theme', label: '主题' },
  { id: 'application', label: '应用' },
  { id: 'terminal', label: '终端' },
  { id: 'wallpaper', label: '壁纸' }
]

const appThemeGroups = [
  {
    id: 'shell',
    title: '窗口与导航',
    description: '控制窗口外层、标题栏、菜单和状态栏，决定整套主题的第一眼气质。',
    fields: [
      { key: 'background', label: '应用背景', hint: '窗口最外层背景颜色' },
      { key: 'headerBg', label: '标题栏', hint: '顶部标题栏与窗口控制区背景' },
      { key: 'menuBg', label: '菜单下拉', hint: '菜单和下拉面板背景' },
      { key: 'statusBarBg', label: '状态栏', hint: '底部状态区域背景' }
    ]
  },
  {
    id: 'surface',
    title: '侧栏与工作区',
    description: '控制侧栏、工作区和面板表面，决定界面层次和空间感。',
    fields: [
      { key: 'sidebarShell', label: '侧栏外壳', hint: '左侧串口区域外层背景' },
      { key: 'sidebarSurface', label: '侧栏内容', hint: '侧栏内部内容区背景' },
      { key: 'workspaceShell', label: '工作区外壳', hint: '主工作区外层背景' },
      { key: 'workspaceSurface', label: '工作区内容', hint: '标签、面板和内容区背景' }
    ]
  },
  {
    id: 'semantic',
    title: '文字与强调',
    description: '控制主文字、弱文字、边框和强调色，保证应用与终端语言一致。',
    fields: [
      { key: 'text', label: '主文字色', hint: '标题和主要信息文字颜色' },
      { key: 'textSoft', label: '次级文字色', hint: '说明和弱化信息文字颜色' },
      { key: 'border', label: '边框色', hint: '分隔线、边界和描边颜色' },
      { key: 'accent', label: '强调色', hint: '选中、高亮和品牌强调颜色' },
      { key: 'accentText', label: '强调文字色', hint: '强调底色上的文字颜色' }
    ]
  }
]

const terminalGroups = [
  {
    id: 'base',
    title: '基础外观',
    description: '终端的底色、文字、光标和选区，决定终端本身的整体风格。',
    fields: [
      { key: 'terminalBackground', label: '终端背景', hint: 'xterm 主背景颜色' },
      { key: 'terminalForeground', label: '终端文字', hint: '终端普通文本颜色' },
      { key: 'cursorColor', label: '光标颜色', hint: '光标和定位颜色' },
      { key: 'selectionColor', label: '选区颜色', hint: '选中文本时的背景色' }
    ]
  },
  {
    id: 'search',
    title: '搜索高亮',
    description: '控制普通命中、当前命中和整行高亮，让搜索反馈保持统一。',
    fields: [
      { key: 'searchMatchColor', label: '匹配高亮', hint: '普通命中的高亮背景色' },
      { key: 'searchMatchTextColor', label: '匹配文字', hint: '普通命中的文字颜色' },
      { key: 'searchCurrentMatchColor', label: '当前命中', hint: '当前命中的高亮背景色' },
      { key: 'searchCurrentMatchTextColor', label: '当前文字', hint: '当前命中的文字颜色' }
    ]
  }
]

const transparencyFields = [
  { key: 'wallpaperOpacity', label: '壁纸透明度', hint: '数值越高越透明，壁纸会更淡一些', min: 40, max: 72, alphaMin: 0.28, alphaMax: 0.6 },
  { key: 'sidebarOpacity', label: '侧栏透明度', hint: '控制左侧串口栏与设置区的透出程度', min: 18, max: 96, alphaMin: 0.04, alphaMax: 0.82 },
  { key: 'workspaceOpacity', label: '工作区透明度', hint: '控制标签区、pane 容器和主工作区壳层', min: 18, max: 96, alphaMin: 0.04, alphaMax: 0.82 },
  { key: 'terminalOpacity', label: '终端透明度', hint: '控制终端正文区域和外框的透出程度', min: 18, max: 96, alphaMin: 0.04, alphaMax: 0.82 }
]

const fontSize = computed(() => {
  const value = Number(terminalAppearance.value.fontSize ?? 13)
  return Number.isFinite(value) ? Math.min(24, Math.max(10, value)) : 13
})

const fontWeight = computed(() => {
  const value = String(terminalAppearance.value.fontWeight ?? '400')
  return ['300', '400', '500', '600', '700'].includes(value) ? value : '400'
})

const transparencyPercentMap = computed(() => ({
  wallpaperOpacity: toTransparencyPercent(appUiState.value.wallpaperOpacity, 0.22, 0.28, 0.6),
  sidebarOpacity: toTransparencyPercent(appUiState.value.sidebarOpacity, 0.42, 0.04, 0.82),
  workspaceOpacity: toTransparencyPercent(appUiState.value.workspaceOpacity, 0.42, 0.04, 0.82),
  terminalOpacity: toTransparencyPercent(appUiState.value.terminalOpacity, 0.34, 0.04, 0.82)
}))

const lineHighlight = computed(() => parseRgba(terminalAppearance.value.searchLineHighlightColor))

function showFeedback(message, tone = 'info') {
  actionMessage.value = message
  actionTone.value = tone
}

function closeModal() {
  emit('update:show', false)
}

function colorInputValue(value) {
  if (typeof value !== 'string') return '#000000'
  return value.startsWith('#') ? value : '#000000'
}

function parseRgba(value) {
  const match = typeof value === 'string'
    ? value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i)
    : null
  if (!match) return { r: 37, g: 99, b: 235, a: 0.08 }
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: Number(match[4] ?? 1) }
}

function toTransparencyPercent(value, fallback, minAlpha, maxAlpha) {
  const numericValue = Number(value ?? fallback)
  const clamped = Number.isFinite(numericValue) ? Math.min(maxAlpha, Math.max(minAlpha, numericValue)) : fallback
  return Math.round((1 - clamped) * 100)
}

function updateTheme(mode) {
  if (activeThemeId.value === mode) {
    showFeedback('当前主题已在使用中。', 'info')
    return
  }
  const applyTheme = serialStore.applyThemeScheme || serialStore.applyTerminalAppearanceMode
  if (typeof applyTheme !== 'function') {
    showFeedback('当前窗口需要刷新后才能切换主题。', 'error')
    return
  }
  const applied = applyTheme(mode)
  showFeedback(applied ? '主题已应用。' : '主题应用失败。', applied ? 'success' : 'error')
}

function createTheme(sourceMode = activeThemeId.value) {
  const createScheme = serialStore.createThemeScheme || serialStore.createCustomTerminalAppearancePreset
  if (typeof createScheme !== 'function') {
    showFeedback('当前窗口需要刷新后才能创建主题。', 'error')
    return
  }
  const created = createScheme(newThemeName.value, sourceMode)
  newThemeName.value = ''
  showFeedback(`已新建主题“${created?.name || '自定义主题'}”。`, 'success')
}

function removeTheme(mode) {
  const removeScheme = serialStore.removeThemeScheme || serialStore.removeCustomTerminalAppearancePreset
  const presetId = typeof mode === 'string' && mode.startsWith('custom:') ? mode.slice('custom:'.length) : ''
  if (!presetId || typeof removeScheme !== 'function') {
    showFeedback('当前窗口需要刷新后才能删除主题。', 'error')
    return
  }
  removeScheme(presetId)
  showFeedback('自定义主题已删除。', 'success')
}

function resetTheme() {
  if (typeof serialStore.resetThemeScheme === 'function') {
    serialStore.resetThemeScheme()
    showFeedback('当前主题已恢复默认状态。', 'success')
    return
  }
  serialStore.resetTerminalAppearance?.()
  serialStore.resetAppTheme?.()
  showFeedback('当前主题已恢复默认状态。', 'success')
}

function resetApplicationTheme() {
  if (typeof serialStore.resetAppTheme !== 'function') return
  serialStore.resetAppTheme()
  showFeedback('当前主题里的应用外观已恢复默认值。', 'success')
}

function updateAppColor(key, value) {
  const updated = serialStore.updateAppTheme?.({ [key]: value })
  if (updated === false) showFeedback('内置主题不能直接编辑，请先基于它新建一套自定义主题。', 'error')
}

function updateTerminalColor(key, value) {
  const updated = serialStore.updateTerminalAppearance?.({ [key]: value })
  if (updated === false) showFeedback('内置主题不能直接编辑，请先基于它新建一套自定义主题。', 'error')
}

function updateFontSize(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return
  updateTerminalColor('fontSize', Math.min(24, Math.max(10, numericValue)))
}

function updateFontWeight(value) {
  const nextValue = String(value)
  if (!['300', '400', '500', '600', '700'].includes(nextValue)) return
  updateTerminalColor('fontWeight', nextValue)
}

function updateLineHighlight(value) {
  updateTerminalColor('searchLineHighlightColor', `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})`)
}

function updateTransparency(field, value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return
  serialStore.updateAppUiState?.({
    [field.key]: Math.min(field.alphaMax, Math.max(field.alphaMin, 1 - numericValue / 100))
  })
}

async function pickWallpaper() {
  const result = await window.electronAPI?.selectWallpaper?.()
  if (!result || result.canceled || !result.success) return
  serialStore.updateAppUiState?.({ wallpaperEnabled: true, wallpaperPath: result.filePath })
}

function toggleWallpaper() {
  if (!wallpaperPath.value) {
    pickWallpaper()
    return
  }
  serialStore.updateAppUiState?.({ wallpaperEnabled: !wallpaperEnabled.value })
}

function clearWallpaper() {
  serialStore.updateAppUiState?.({ wallpaperEnabled: false, wallpaperPath: '' })
}
</script>

<template>
  <div v-if="show" :class="['modal-overlay', { standalone: props.standalone }]">
    <div class="theme-window">
      <header class="window-header">
        <div class="window-copy">
          <div class="window-title">主题设置</div>
          <div class="window-subtitle">一个主题同时覆盖应用界面与终端外观，壁纸与透明度也在同一处统一调整。</div>
        </div>
        <button class="close-btn" @click="closeModal">×</button>
      </header>

      <div class="window-body">
        <aside class="sidebar">
          <div class="sidebar-title">分类</div>
          <nav class="nav-card">
            <button
              v-for="panel in themePanels"
              :key="panel.id"
              :class="['nav-btn', { active: activePanel === panel.id }]"
              @click="activePanel = panel.id"
            >
              {{ panel.label }}
            </button>
          </nav>

          <section class="sidebar-card sidebar-status-card">
            <div class="eyebrow">当前主题</div>
            <div class="sidebar-theme-name">{{ activeTheme.name }}</div>
            <div class="sidebar-theme-meta">{{ activeTheme.kind === 'custom' ? '自定义，可编辑' : '内置，只读' }}</div>
          </section>

          <section v-if="actionMessage" :class="['sidebar-card', 'feedback-card', actionTone]">
            {{ actionMessage }}
          </section>
        </aside>

        <main class="content">
          <section class="toolbar-card">
            <div class="toolbar-copy">
              <div class="toolbar-title">当前主题</div>
              <div class="toolbar-subtitle">主题会同时驱动应用界面与终端外观，壁纸与透明度在同一个窗口内联动调整。</div>
            </div>
            <div class="toolbar-meta">
              <span class="toolbar-theme-name">{{ activeTheme.name }}</span>
              <span class="toolbar-badge">{{ activeTheme.kind === 'custom' ? '自定义主题' : '内置主题' }}</span>
            </div>
          </section>

          <section v-if="activePanel === 'theme'" class="content-section">
            <div class="section-head">
              <div>
                <div class="section-title">主题方案</div>
                <div class="section-subtitle">先选一套整主题，再决定是否基于它创建自己的主题。应用外观和终端外观会一起切换。</div>
              </div>
              <div class="section-actions">
                <button class="ui-btn secondary" :disabled="!canCreateTheme" @click="createTheme()">基于当前新建</button>
                <button class="ui-btn secondary" :disabled="!canEditTheme" @click="resetTheme">恢复主题默认值</button>
              </div>
            </div>

            <div class="scheme-list">
              <article
                v-for="theme in themeOptions"
                :key="theme.mode"
                :class="['scheme-card', { active: activeThemeId === theme.mode }]"
              >
                <div class="scheme-card-head">
                  <div>
                    <div class="scheme-name">{{ theme.name }}</div>
                    <div class="scheme-description">{{ theme.description }}</div>
                  </div>
                  <span :class="['scheme-kind', theme.kind]">{{ theme.kind === 'custom' ? '自定义' : '内置' }}</span>
                </div>

                <div class="scheme-actions">
                  <button class="ui-btn secondary" :disabled="activeThemeId === theme.mode" @click="updateTheme(theme.mode)">
                    {{ activeThemeId === theme.mode ? '当前使用中' : '应用主题' }}
                  </button>
                  <button class="ui-btn secondary" :disabled="!canCreateTheme" @click="createTheme(theme.mode)">基于此复制</button>
                  <button
                    v-if="theme.kind === 'custom'"
                    class="ui-btn danger"
                    :disabled="activeThemeId === theme.mode"
                    @click="removeTheme(theme.mode)"
                  >
                    删除
                  </button>
                </div>
              </article>
            </div>

            <section class="editor-card">
              <div class="card-title">新主题</div>
              <div class="card-hint">复制当前主题的应用配色和终端配置，生成一套新的可编辑主题。</div>
              <div class="inline-form">
                <input
                  v-model="newThemeName"
                  type="text"
                  class="text-input"
                  maxlength="30"
                  placeholder="例如：冷白电蓝 / 雾黑低对比"
                />
                <button class="ui-btn primary" :disabled="!canCreateTheme" @click="createTheme()">新建主题</button>
              </div>
            </section>
          </section>

          <section v-else-if="activePanel === 'application'" class="content-section">
            <div class="section-head">
              <div>
                <div class="section-title">应用外观</div>
                <div class="section-subtitle">这里编辑的是当前主题中的应用区域。主窗口、菜单、面板和弹层都从这里取色。</div>
              </div>
              <div class="section-actions">
                <button class="ui-btn secondary" :disabled="!canEditTheme" @click="resetApplicationTheme">恢复应用默认值</button>
              </div>
            </div>

            <div v-if="!canEditTheme" class="notice-card">
              当前是内置主题。应用外观和终端外观属于同一套主题，所以这里同样只读；先回到“主题”里复制一套自己的主题再编辑。
            </div>

            <div class="group-list">
              <section v-for="group in appThemeGroups" :key="group.id" class="editor-card">
                <div class="section-block-head">
                  <div class="card-title">{{ group.title }}</div>
                  <div class="card-hint">{{ group.description }}</div>
                </div>
                <div class="field-list">
                  <div v-for="field in group.fields" :key="field.key" class="field-row">
                    <div class="field-copy">
                      <div class="field-label">{{ field.label }}</div>
                      <div class="field-hint">{{ field.hint }}</div>
                    </div>
                    <div class="field-controls">
                      <input
                        :value="colorInputValue(appTheme[field.key])"
                        type="color"
                        class="color-picker"
                        :disabled="!canEditTheme"
                        @input="updateAppColor(field.key, $event.target.value)"
                      />
                      <input
                        :value="appTheme[field.key]"
                        type="text"
                        class="text-input"
                        :disabled="!canEditTheme"
                        @input="updateAppColor(field.key, $event.target.value)"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section class="preview-card">
              <div class="card-title">应用预览</div>
              <div class="app-preview" :style="{ backgroundColor: appTheme.background, borderColor: appTheme.border }">
                <div class="app-preview-header" :style="{ backgroundColor: appTheme.headerBg, color: appTheme.text, borderColor: appTheme.border }">SerialX</div>
                <div class="app-preview-body">
                  <div class="app-preview-sidebar" :style="{ backgroundColor: appTheme.sidebarSurface, color: appTheme.text, borderColor: appTheme.border }">
                    <span class="preview-title-text">侧栏</span>
                    <span class="preview-note-text" :style="{ color: appTheme.textSoft }">串口、设置、筛选</span>
                  </div>
                  <div class="app-preview-main" :style="{ backgroundColor: appTheme.workspaceSurface, color: appTheme.text, borderColor: appTheme.border }">
                    <span class="preview-pill" :style="{ backgroundColor: appTheme.accent, color: appTheme.accentText }">当前标签</span>
                    <span class="preview-note-text" :style="{ color: appTheme.textSoft }">面板、内容区、弹层</span>
                  </div>
                </div>
                <div class="app-preview-status" :style="{ backgroundColor: appTheme.statusBarBg, color: appTheme.textSoft, borderColor: appTheme.border }">状态栏</div>
              </div>
            </section>
          </section>

          <section v-else-if="activePanel === 'terminal'" class="content-section">
            <div class="section-head">
              <div>
                <div class="section-title">终端外观</div>
                <div class="section-subtitle">这里编辑的是当前主题中的终端部分，包括字号、字重、终端底色、光标、选区和搜索高亮。</div>
              </div>
            </div>

            <div v-if="!canEditTheme" class="notice-card">
              当前是内置主题。终端外观也属于同一套主题，所以这里同样只读；先回到“主题”里复制一套自己的主题再编辑。
            </div>

            <section class="editor-card">
              <div class="card-title">排版</div>
              <div class="card-hint">先定字号和字重，再继续细调颜色，整体会更顺手。</div>
              <div class="field-list">
                <div class="field-row">
                  <div class="field-copy">
                    <div class="field-label">字体大小</div>
                    <div class="field-hint">影响终端密度与可读性</div>
                  </div>
                  <div class="field-controls slider-controls">
                    <input
                      class="slider-input"
                      type="range"
                      min="10"
                      max="24"
                      step="1"
                      :value="fontSize"
                      :disabled="!canEditTheme"
                      @input="updateFontSize($event.target.value)"
                    />
                    <span class="slider-value">{{ fontSize }}px</span>
                  </div>
                </div>

                <div class="field-row">
                  <div class="field-copy">
                    <div class="field-label">字体粗细</div>
                    <div class="field-hint">让终端文字更轻或更扎实</div>
                  </div>
                  <div class="field-controls">
                    <select class="text-input" :value="fontWeight" :disabled="!canEditTheme" @change="updateFontWeight($event.target.value)">
                      <option value="300">300 细体</option>
                      <option value="400">400 常规</option>
                      <option value="500">500 中等</option>
                      <option value="600">600 半粗</option>
                      <option value="700">700 粗体</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <div class="group-list">
              <section v-for="group in terminalGroups" :key="group.id" class="editor-card">
                <div class="section-block-head">
                  <div class="card-title">{{ group.title }}</div>
                  <div class="card-hint">{{ group.description }}</div>
                </div>
                <div class="field-list">
                  <div v-for="field in group.fields" :key="field.key" class="field-row">
                    <div class="field-copy">
                      <div class="field-label">{{ field.label }}</div>
                      <div class="field-hint">{{ field.hint }}</div>
                    </div>
                    <div class="field-controls">
                      <input
                        :value="colorInputValue(terminalAppearance[field.key])"
                        type="color"
                        class="color-picker"
                        :disabled="!canEditTheme"
                        @input="updateTerminalColor(field.key, $event.target.value)"
                      />
                      <input
                        :value="terminalAppearance[field.key]"
                        type="text"
                        class="text-input"
                        :disabled="!canEditTheme"
                        @input="updateTerminalColor(field.key, $event.target.value)"
                      />
                    </div>
                  </div>

                  <div class="field-row">
                    <div class="field-copy">
                      <div class="field-label">整行高亮</div>
                      <div class="field-hint">当前命中所在行的弱高亮，支持 RGBA</div>
                    </div>
                    <div class="field-controls stacked-controls">
                      <input
                        :value="terminalAppearance.searchLineHighlightColor"
                        type="text"
                        class="text-input"
                        :disabled="!canEditTheme"
                        @input="updateTerminalColor('searchLineHighlightColor', $event.target.value)"
                      />
                      <div class="slider-inline">
                        <span class="field-inline-label">透明度</span>
                        <input
                          class="slider-input"
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          :value="lineHighlight.a"
                          :disabled="!canEditTheme"
                          @input="updateLineHighlight({ ...lineHighlight, a: Number($event.target.value) })"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section class="preview-card">
              <div class="card-title">终端预览</div>
              <div
                class="terminal-preview"
                :style="{
                  backgroundColor: terminalAppearance.terminalBackground,
                  color: terminalAppearance.terminalForeground,
                  fontSize: `${fontSize}px`,
                  fontWeight
                }"
              >
                <span>RX: normal text</span>
                <span
                  class="mark"
                  :style="{ color: terminalAppearance.searchMatchTextColor, boxShadow: `inset 0 -0.62em 0 ${terminalAppearance.searchMatchColor}` }"
                >
                  matched
                </span>
                <span
                  class="mark current"
                  :style="{ color: terminalAppearance.searchCurrentMatchTextColor, boxShadow: `inset 0 -0.68em 0 ${terminalAppearance.searchCurrentMatchColor}` }"
                >
                  current
                </span>
              </div>
            </section>
          </section>

          <section v-else class="content-section">
            <div class="section-head">
              <div>
                <div class="section-title">壁纸与透明度</div>
                <div class="section-subtitle">壁纸不属于主题配色本身，但会和当前主题一起工作，所以放在同一套设置里统一管理。</div>
              </div>
            </div>

            <section class="editor-card">
              <div class="card-title">桌面背景</div>
              <div class="card-hint">{{ wallpaperPath || '还没有选择壁纸' }}</div>
              <div class="section-actions">
                <button class="ui-btn secondary" @click="pickWallpaper">{{ wallpaperPath ? '更换壁纸' : '选择壁纸' }}</button>
                <button v-if="wallpaperPath" class="ui-btn secondary" @click="toggleWallpaper">{{ wallpaperEnabled ? '关闭壁纸' : '启用壁纸' }}</button>
                <button v-if="wallpaperPath" class="ui-btn danger" @click="clearWallpaper">清除壁纸</button>
              </div>
            </section>

            <section class="editor-card">
              <div class="card-title">透明度</div>
              <div class="card-hint">数值越高越透明。你可以分别控制壁纸、侧栏、工作区和终端的透出程度。</div>
              <div class="field-list">
                <div v-for="field in transparencyFields" :key="field.key" class="field-row">
                  <div class="field-copy">
                    <div class="field-label">{{ field.label }}</div>
                    <div class="field-hint">{{ field.hint }}</div>
                  </div>
                  <div class="field-controls slider-controls">
                    <input
                      class="slider-input"
                      type="range"
                      :min="field.min"
                      :max="field.max"
                      step="2"
                      :value="transparencyPercentMap[field.key]"
                      @input="updateTransparency(field, $event.target.value)"
                    />
                    <span class="slider-value">{{ transparencyPercentMap[field.key] }}%</span>
                  </div>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>

      <footer class="window-footer">
        <button class="ui-btn secondary" @click="resetTheme">恢复主题默认值</button>
        <button class="ui-btn primary" @click="closeModal">完成</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 72px 20px 20px;
  background: transparent;
  z-index: 1100;
  pointer-events: none;
}

.modal-overlay.standalone {
  position: relative;
  inset: auto;
  display: block;
  height: 100vh;
  padding: 0;
  pointer-events: auto;
}

.theme-window {
  width: min(980px, calc(100vw - 40px));
  max-height: calc(100vh - 92px);
  display: flex;
  flex-direction: column;
  background: var(--app-workspace-base);
  border: 1px solid var(--app-border);
  border-radius: 22px;
  box-shadow: var(--app-shadow-lg);
  backdrop-filter: blur(18px);
  pointer-events: auto;
}

.modal-overlay.standalone .theme-window {
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.window-header,
.window-footer {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.window-header {
  border-bottom: 1px solid var(--app-border);
}

.window-footer {
  border-top: 1px solid var(--app-border);
  justify-content: flex-end;
}

.window-copy {
  min-width: 0;
}

.window-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.window-subtitle {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--app-text-soft);
}

.close-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-workspace-shell);
  color: var(--app-text);
  cursor: pointer;
}

.window-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
}

.sidebar,
.content {
  min-height: 0;
  overflow: auto;
}

.sidebar {
  padding: 18px 14px;
  border-right: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: color-mix(in srgb, var(--app-workspace-shell) 92%, transparent);
}

.content {
  padding: 18px 22px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sidebar-card,
.editor-card,
.preview-card,
.scheme-card,
.notice-card,
.toolbar-card {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-workspace-soft);
}

.sidebar-card {
  padding: 12px;
}

.sidebar-title {
  padding: 4px 6px 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-text-soft);
}

.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-text-soft);
}

.nav-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-btn {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--app-text);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
}

.nav-btn:hover {
  background: var(--app-workspace-soft);
  border-color: var(--app-border);
}

.nav-btn.active {
  background: var(--app-accent-soft);
  border-color: var(--app-chip-border);
}

.sidebar-status-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-theme-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.sidebar-theme-meta {
  font-size: 12px;
  color: var(--app-text-soft);
}

.toolbar-card {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.toolbar-copy {
  min-width: 0;
}

.toolbar-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
}

.toolbar-subtitle {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-soft);
}

.toolbar-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toolbar-theme-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
}

.toolbar-badge {
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
  font-size: 11px;
  font-weight: 700;
}

.feedback-card {
  font-size: 12px;
  line-height: 1.6;
}

.feedback-card.info {
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
}

.feedback-card.success {
  background: var(--app-success-soft);
  color: var(--app-success-text);
  border-color: var(--app-success-border);
}

.feedback-card.error {
  background: var(--app-danger-soft);
  color: var(--app-danger-text);
  border-color: var(--app-danger-border);
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.section-subtitle {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--app-text-soft);
}

.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.scheme-list,
.group-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.scheme-card,
.editor-card,
.preview-card,
.notice-card {
  padding: 16px;
}

.scheme-card.active {
  border-color: var(--app-chip-border);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-accent) 12%, transparent);
}

.scheme-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.scheme-name,
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.scheme-description,
.card-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--app-text-soft);
}

.scheme-kind {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.scheme-kind.built-in {
  background: var(--app-warning-soft);
  color: var(--app-warning-text);
}

.scheme-kind.custom {
  background: var(--app-accent-soft);
  color: var(--app-chip-text);
}

.scheme-actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.inline-form {
  margin-top: 14px;
  display: flex;
  gap: 12px;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  gap: 16px;
  align-items: center;
}

.field-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.field-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-soft);
}

.field-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.stacked-controls {
  flex-direction: column;
  align-items: stretch;
}

.slider-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  width: 100%;
}

.slider-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}

.field-inline-label {
  min-width: 40px;
  font-size: 12px;
  color: var(--app-text-soft);
}

.text-input {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--app-border);
  background: var(--app-workspace-shell);
  color: var(--app-text);
  font-family: Consolas, "Courier New", monospace;
}

.color-picker {
  width: 44px;
  height: 40px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.slider-input {
  width: 100%;
}

.slider-value {
  min-width: 48px;
  text-align: right;
  font-size: 12px;
  font-weight: 700;
  color: var(--app-text);
}

.notice-card {
  background: var(--app-warning-soft);
  border-color: var(--app-warning-border);
  color: var(--app-warning-text);
  font-size: 12px;
  line-height: 1.6;
}

.section-block-head {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--app-border);
}

.app-preview {
  margin-top: 14px;
  border: 1px solid;
  border-radius: 16px;
  overflow: hidden;
}

.app-preview-header,
.app-preview-status {
  padding: 12px 14px;
  border-bottom: 1px solid;
  font-size: 13px;
  font-weight: 700;
}

.app-preview-status {
  border-bottom: none;
  border-top: 1px solid;
  font-weight: 600;
}

.app-preview-body {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
}

.app-preview-sidebar,
.app-preview-main {
  min-height: 150px;
  padding: 16px;
  border-right: 1px solid;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.app-preview-main {
  border-right: none;
}

.preview-title-text {
  font-size: 13px;
  font-weight: 700;
}

.preview-note-text {
  font-size: 12px;
}

.preview-pill {
  align-self: flex-start;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.terminal-preview {
  margin-top: 14px;
  border-radius: 14px;
  padding: 18px 16px;
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  font-family: Consolas, "Courier New", monospace;
}

.mark {
  padding: 0 0.08em;
  border-radius: 0.08em;
}

.mark.current {
  border-radius: 0.1em;
}

.ui-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.12s ease, filter 0.12s ease, background-color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}

.ui-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-btn.secondary {
  background: var(--app-workspace-shell);
  border-color: var(--app-border);
  color: var(--app-text);
}

.ui-btn.secondary:hover:not(:disabled) {
  background: var(--app-chip-bg);
  border-color: var(--app-chip-border);
}

.ui-btn.primary {
  background: var(--app-accent);
  border-color: var(--app-chip-border);
  color: var(--app-modal-bg);
}

.ui-btn.danger {
  background: var(--app-danger-soft);
  border-color: var(--app-danger-border);
  color: var(--app-danger-text);
}

.ui-btn.primary:hover:not(:disabled),
.ui-btn.danger:hover:not(:disabled) {
  filter: brightness(1.03);
}

.ui-btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.985);
  filter: brightness(0.96);
}

@media (max-width: 760px) {
  .modal-overlay {
    justify-content: center;
    padding: 20px;
  }

  .theme-window {
    width: min(680px, calc(100vw - 24px));
    max-height: min(92vh, 960px);
  }

  .window-body {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--app-border);
  }

  .field-row {
    grid-template-columns: 1fr;
  }

  .inline-form,
  .section-head,
  .toolbar-card {
    flex-direction: column;
    align-items: stretch;
  }

  .app-preview-body {
    grid-template-columns: 1fr;
  }

  .app-preview-sidebar {
    border-right: none;
    border-bottom: 1px solid;
  }
}
</style>
