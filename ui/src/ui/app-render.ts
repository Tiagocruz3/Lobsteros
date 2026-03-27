import { html, nothing } from "lit";
import { parseAgentSessionKey } from "../../../src/routing/session-key.js";
import { t } from "../i18n/index.ts";
import { refreshChat } from "./app-chat.ts";
import { handleChannelConfigReload as handleChannelConfigReloadInternal, handleChannelConfigSave as handleChannelConfigSaveInternal, handleNostrProfileCancel as handleNostrProfileCancelInternal, handleNostrProfileEdit as handleNostrProfileEditInternal, handleNostrProfileFieldChange as handleNostrProfileFieldChangeInternal, handleNostrProfileImport as handleNostrProfileImportInternal, handleNostrProfileSave as handleNostrProfileSaveInternal, handleNostrProfileToggleAdvanced as handleNostrProfileToggleAdvancedInternal, handleWhatsAppLogout as handleWhatsAppLogoutInternal, handleWhatsAppStart as handleWhatsAppStartInternal, handleWhatsAppWait as handleWhatsAppWaitInternal } from "./app-channels.ts";
import { DEFAULT_CRON_FORM, DEFAULT_LOG_LEVEL_FILTERS } from "./app-defaults.ts";
import { connectGateway as connectGatewayInternal } from "./app-gateway.ts";
import { renderChatControls } from "./app-render.helpers.ts";
import type { AppViewState } from "./app-view-state.ts";
import { loadAgentFileContent, loadAgentFiles, saveAgentFile } from "./controllers/agent-files.ts";
import { loadAgentIdentities, loadAgentIdentity } from "./controllers/agent-identity.ts";
import { loadAgentSkills } from "./controllers/agent-skills.ts";
import { loadAgents, loadToolsCatalog, saveAgentsConfig } from "./controllers/agents.ts";
import { loadChannels } from "./controllers/channels.ts";
import { loadChatHistory } from "./controllers/chat.ts";
import { applyConfig, ensureAgentConfigEntry, findAgentConfigEntryIndex, loadConfig, runUpdate, saveConfig, updateConfigFormValue, removeConfigFormValue } from "./controllers/config.ts";
import { loadCronRuns, loadMoreCronJobs, loadMoreCronRuns, reloadCronJobs, toggleCronJob, runCronJob, removeCronJob, addCronJob, startCronEdit, startCronClone, cancelCronEdit, validateCronForm, hasCronFormErrors, normalizeCronFormState, getVisibleCronJobs, updateCronJobsFilter, updateCronRunsFilter } from "./controllers/cron.ts";
import { loadDebug, callDebugMethod } from "./controllers/debug.ts";
import { approveDevicePairing, loadDevices, rejectDevicePairing, revokeDeviceToken, rotateDeviceToken } from "./controllers/devices.ts";
import { loadExecApprovals, removeExecApprovalsFormValue, saveExecApprovals, updateExecApprovalsFormValue } from "./controllers/exec-approvals.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadPresence } from "./controllers/presence.ts";
import { deleteSessionAndRefresh, loadSessions, patchSession } from "./controllers/sessions.ts";
import { installSkill, loadSkills, saveSkillApiKey, updateSkillEdit, updateSkillEnabled } from "./controllers/skills.ts";
import { icons } from "./icons.ts";
import { iconForTab, TAB_GROUPS, titleForTab, type Tab } from "./navigation.ts";
import { resolveAgentConfig, resolveConfiguredCronModelSuggestions, resolveEffectiveModelFallbacks, resolveModelPrimary, sortLocaleStrings } from "./views/agents-utils.ts";
import { renderAgents } from "./views/agents.ts";
import { renderChannels } from "./views/channels.ts";
import { renderChat } from "./views/chat.ts";
import { renderConfig } from "./views/config.ts";
import { renderCron } from "./views/cron.ts";
import { renderDebug } from "./views/debug.ts";
import { renderExecApprovalPrompt } from "./views/exec-approval.ts";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation.ts";
import { renderInstances } from "./views/instances.ts";
import { renderLogs } from "./views/logs.ts";
import { renderNodes } from "./views/nodes.ts";
import { renderOverview } from "./views/overview.ts";
import { renderSessions } from "./views/sessions.ts";
import { renderSkills } from "./views/skills.ts";
import { renderUsageTab } from "./app-render-usage-tab.ts";
import { renderCalendarScheduler } from "./views/calendar-scheduler.ts";
import { renderAgentProfiles } from "./views/agent-profiles.ts";
import { renderAgentDashboard } from "./views/agent-dashboard.ts";
import { renderWallpaper, startWallpaperAnimation } from "./wallpaper-animation.ts";

// ===========================================
// Code Flux - Desktop OS State Management
// ===========================================

type WindowState = {
  id: string;
  tab: Tab;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  active: boolean;
};

// Desktop icon state
type DesktopIconState = {
  id: Tab;
  order: number;
};

// Global window manager state
let windowCounter = 0;
const openWindows = new Map<string, WindowState>();
let activeWindowId: string | null = null;
let startMenuOpen = false;
let highestZIndex = 100;

// Desktop icon state
let desktopIcons: DesktopIconState[] = [];
let selectedIcon: Tab | null = null;
let contextMenuOpen = false;
let contextMenuX = 0;
let contextMenuY = 0;
let contextMenuIcon: Tab | null = null;

// Drag and drop state
let draggedIcon: Tab | null = null;
let dragOverIcon: Tab | null = null;

// App launcher state
let activeLauncherCategory = 'communication';

// Default window positions cascade
const getDefaultPosition = (): { x: number; y: number } => {
  const offset = (windowCounter % 10) * 30;
  return {
    x: 50 + offset,
    y: 30 + offset,
  };
};

// ===========================================
// Window Management Functions
// ===========================================

function openWindow(tab: Tab, title: string, icon: string): string {
  const id = `window-${Date.now()}-${++windowCounter}`;
  const pos = getDefaultPosition();
  
  // Set default window size based on app type
  let defaultWidth = 800;
  let defaultHeight = 600;
  
  if (tab === "chat") {
    defaultWidth = 900;
    defaultHeight = 700;
  } else if (tab === "cron") {
    // Scheduler needs larger size to display calendar properly
    defaultWidth = 1100;
    defaultHeight = 750;
  }
  
  const windowState: WindowState = {
    id,
    tab,
    title,
    icon,
    x: pos.x,
    y: pos.y,
    width: defaultWidth,
    height: defaultHeight,
    zIndex: ++highestZIndex,
    minimized: false,
    maximized: false,
    active: true,
  };
  
  // Deactivate other windows
  openWindows.forEach(w => w.active = false);
  
  openWindows.set(id, windowState);
  activeWindowId = id;
  
  // Request re-render
  requestRender();
  
  return id;
}

function closeWindow(id: string) {
  const win = openWindows.get(id);
  if (win) {
    // Instant close - no animation
    openWindows.delete(id);
    if (activeWindowId === id) {
      activeWindowId = null;
      // Activate most recent window
      let maxZ = 0;
      openWindows.forEach((w, wid) => {
        if (!w.minimized && w.zIndex > maxZ) {
          maxZ = w.zIndex;
          activeWindowId = wid;
        }
      });
      if (activeWindowId) {
        const w = openWindows.get(activeWindowId);
        if (w) w.active = true;
      }
    }
    requestRender();
  }
}

function minimizeWindow(id: string) {
  const win = openWindows.get(id);
  if (win) {
    win.minimized = true;
    win.active = false;
    
    // Activate another window
    activeWindowId = null;
    let maxZ = 0;
    openWindows.forEach((w, wid) => {
      if (!w.minimized && wid !== id && w.zIndex > maxZ) {
        maxZ = w.zIndex;
        activeWindowId = wid;
      }
    });
    if (activeWindowId) {
      const w = openWindows.get(activeWindowId);
      if (w) w.active = true;
    }
    requestRender();
  }
}

function maximizeWindow(id: string) {
  const win = openWindows.get(id);
  if (win) {
    win.maximized = !win.maximized;
    requestRender();
  }
}

function activateWindow(id: string) {
  const win = openWindows.get(id);
  if (win && !win.minimized) {
    // Deactivate others
    openWindows.forEach(w => w.active = false);
    win.active = true;
    win.zIndex = ++highestZIndex;
    activeWindowId = id;
    requestRender();
  }
}

function restoreWindow(id: string) {
  const win = openWindows.get(id);
  if (win) {
    win.minimized = false;
    activateWindow(id);
  }
}

let renderCallback: (() => void) | null = null;

function requestRender() {
  if (renderCallback) {
    renderCallback();
  }
}

// ===========================================
// App Definitions
// ===========================================

interface AppDefinition {
  id: Tab;
  name: string;
  icon: string;
  category: string;
}

const APPS: AppDefinition[] = [
  // Communication
  { id: "chat", name: "Chat", icon: "messageSquare", category: "communication" },
  { id: "channels", name: "Channels", icon: "link", category: "communication" },
  { id: "mail", name: "Mail", icon: "mail", category: "communication" },
  
  // System
  { id: "overview", name: "Overview", icon: "barChart", category: "system" },
  { id: "instances", name: "Instances", icon: "radio", category: "system" },
  { id: "sessions", name: "Sessions", icon: "fileText", category: "system" },
  { id: "usage", name: "Usage", icon: "usage", category: "system" },
  { id: "cron", name: "Scheduler", icon: "scheduler", category: "system" },
  { id: "systemMonitor", name: "System Monitor", icon: "activity", category: "system" },
  
  // Agent
  { id: "agentDashboard", name: "Agent Dashboard", icon: "barChart", category: "agent" },
  { id: "agents", name: "Agents", icon: "folder", category: "agent" },
  { id: "agentProfiles", name: "Agent Profiles", icon: "bot", category: "agent" },
  { id: "skills", name: "Skills", icon: "zap", category: "agent" },
  { id: "nodes", name: "Nodes", icon: "monitor", category: "agent" },
  
  // Utilities
  { id: "calculator", name: "Calculator", icon: "calculator", category: "utilities" },
  { id: "notes", name: "Notes", icon: "fileEdit", category: "utilities" },
  { id: "files", name: "Files", icon: "files", category: "utilities" },
  { id: "terminal", name: "Terminal", icon: "terminal", category: "utilities" },
  { id: "browser", name: "Browser", icon: "globe", category: "utilities" },
  { id: "music", name: "Music", icon: "music", category: "utilities" },
  { id: "photos", name: "Photos", icon: "images", category: "utilities" },
  { id: "weather", name: "Weather", icon: "weather", category: "utilities" },
  { id: "clock", name: "Clock", icon: "clock", category: "utilities" },
  
  // Settings
  { id: "config", name: "Settings", icon: "settings", category: "settings" },
  { id: "debug", name: "Debug", icon: "bug", category: "settings" },
  { id: "logs", name: "Logs", icon: "scrollText", category: "settings" },
  { id: "settingsDisplay", name: "Display", icon: "monitor", category: "settings" },
  { id: "settingsNetwork", name: "Network", icon: "network", category: "settings" },
  { id: "settingsPrivacy", name: "Privacy", icon: "shield", category: "settings" },
];

function getAppById(id: Tab): AppDefinition | undefined {
  return APPS.find(app => app.id === id);
}

// Initialize desktop icons with default order
function initializeDesktopIcons() {
  if (desktopIcons.length === 0) {
    desktopIcons = APPS.map((app, index) => ({ id: app.id, order: index }));
  }
}

// Get sorted desktop icons
function getSortedDesktopIcons(): DesktopIconState[] {
  initializeDesktopIcons();
  return [...desktopIcons].sort((a, b) => a.order - b.order);
}

// Remove desktop icon
function removeDesktopIcon(id: Tab) {
  desktopIcons = desktopIcons.filter(icon => icon.id !== id);
  if (selectedIcon === id) selectedIcon = null;
  requestRender();
}

// Add desktop icon
function addDesktopIcon(id: Tab) {
  const exists = desktopIcons.find(icon => icon.id === id);
  if (!exists) {
    const maxOrder = desktopIcons.length > 0 
      ? Math.max(...desktopIcons.map(i => i.order)) 
      : -1;
    desktopIcons.push({ id, order: maxOrder + 1 });
    requestRender();
  }
}

// Check if icon is on desktop
function isOnDesktop(id: Tab): boolean {
  return desktopIcons.some(icon => icon.id === id);
}

// Handle drag start
function handleIconDragStart(e: DragEvent, id: Tab) {
  draggedIcon = id;
  document.body.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }
  requestRender();
}

// Handle drag over
function handleIconDragOver(e: DragEvent, id: Tab) {
  e.preventDefault();
  if (draggedIcon && draggedIcon !== id) {
    dragOverIcon = id;
    requestRender();
  }
}

// Handle drop
function handleIconDrop(e: DragEvent, targetId: Tab) {
  e.preventDefault();
  if (draggedIcon && draggedIcon !== targetId) {
    // Swap orders
    const draggedIndex = desktopIcons.findIndex(i => i.id === draggedIcon);
    const targetIndex = desktopIcons.findIndex(i => i.id === targetId);
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const tempOrder = desktopIcons[draggedIndex].order;
      desktopIcons[draggedIndex].order = desktopIcons[targetIndex].order;
      desktopIcons[targetIndex].order = tempOrder;
    }
  }
  draggedIcon = null;
  dragOverIcon = null;
  document.body.classList.remove('dragging');
  requestRender();
}

// Handle drag end
function handleIconDragEnd() {
  draggedIcon = null;
  dragOverIcon = null;
  document.body.classList.remove('dragging');
  requestRender();
}

// Show context menu with boundary detection
function showContextMenu(e: MouseEvent, iconId: Tab) {
  e.preventDefault();
  const menuWidth = 200;
  const menuHeight = 150;
  
  // Calculate position with boundary detection
  let x = e.clientX;
  let y = e.clientY;
  
  // Prevent going off right edge
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  
  // Prevent going off bottom edge
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  contextMenuX = x;
  contextMenuY = y;
  contextMenuIcon = iconId;
  contextMenuOpen = true;
  requestRender();
}

// Close context menu
function closeContextMenu() {
  contextMenuOpen = false;
  contextMenuIcon = null;
  requestRender();
}

// Dock context menu state
let dockContextMenuOpen = false;
let dockContextMenuX = 0;
let dockContextMenuY = 0;
let dockContextMenuApp: Tab | null = null;

// Show dock context menu with boundary detection
function showDockContextMenu(e: MouseEvent, appId: Tab) {
  e.preventDefault();
  const menuWidth = 180;
  const menuHeight = 120;
  
  // Calculate position with boundary detection
  let x = e.clientX;
  let y = e.clientY;
  
  // Prevent going off right edge
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  
  // Prevent going off bottom edge
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  dockContextMenuX = x;
  dockContextMenuY = y;
  dockContextMenuApp = appId;
  dockContextMenuOpen = true;
  requestRender();
}

// Close dock context menu
function closeDockContextMenu() {
  dockContextMenuOpen = false;
  dockContextMenuApp = null;
  requestRender();
}

// Handle desktop click to deselect and close menus
function handleDesktopClick(e: MouseEvent) {
  // Close all context menus on any desktop click
  if (contextMenuOpen) {
    closeContextMenu();
  }
  if (dockContextMenuOpen) {
    closeDockContextMenu();
  }
  
  // Only deselect if clicking directly on desktop area
  if (e.target === e.currentTarget) {
    selectedIcon = null;
    requestRender();
  }
}

// Handle desktop right-click
function handleDesktopRightClick(e: MouseEvent) {
  // Only show if not clicking on an icon
  if ((e.target as HTMLElement).closest('.app-icon')) return;
  e.preventDefault();
  
  const menuWidth = 200;
  const menuHeight = 100;
  
  // Calculate position with boundary detection
  let x = e.clientX;
  let y = e.clientY;
  
  // Prevent going off right edge
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  
  // Prevent going off bottom edge
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  contextMenuX = x;
  contextMenuY = y;
  contextMenuIcon = null; // Desktop menu, not icon menu
  contextMenuOpen = true;
  selectedIcon = null;
  requestRender();
}

// ===========================================
// Rendering Functions
// ===========================================

function renderWindowContent(state: AppViewState, win: WindowState) {
  // This mirrors the original render logic but for a specific tab
  const tab = win.tab;
  
  const codeFluxVersion =
    (typeof state.hello?.server?.version === "string" && state.hello.server.version.trim()) ||
    state.updateAvailable?.currentVersion ||
    t("common.na");
  const availableUpdate =
    state.updateAvailable &&
    state.updateAvailable.latestVersion !== state.updateAvailable.currentVersion
      ? state.updateAvailable
      : null;
  const presenceCount = state.presenceEntries.length;
  const sessionsCount = state.sessionsResult?.count ?? null;
  const cronNext = state.cronStatus?.nextWakeAtMs ?? null;
  const chatDisabledReason = state.connected ? null : t("chat.disconnected");
  
  const configValue =
    state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null);
  const resolvedAgentId =
    state.agentsSelectedId ??
    state.agentsList?.defaultId ??
    state.agentsList?.agents?.[0]?.id ??
    null;
  const getCurrentConfigValue = () =>
    state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null);
  const findAgentIndex = (agentId: string) =>
    findAgentConfigEntryIndex(getCurrentConfigValue(), agentId);
  const ensureAgentIndex = (agentId: string) => ensureAgentConfigEntry(state, agentId);
  
  const CRON_THINKING_SUGGESTIONS = ["off", "minimal", "low", "medium", "high"];
  const CRON_TIMEZONE_SUGGESTIONS = [
    "UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", 
    "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Tokyo",
  ];
  
  const visibleCronJobs = getVisibleCronJobs(state);
  
  switch (tab) {
    case "overview":
      return renderOverview({
        connected: state.connected,
        hello: state.hello,
        settings: state.settings,
        password: state.password,
        lastError: state.lastError,
        lastErrorCode: state.lastErrorCode,
        presenceCount,
        sessionsCount,
        cronEnabled: state.cronStatus?.enabled ?? null,
        cronNext,
        lastChannelsRefresh: state.channelsLastSuccess,
        onSettingsChange: (next) => state.applySettings(next),
        onPasswordChange: (next) => (state.password = next),
        onSessionKeyChange: (next) => {
          state.sessionKey = next;
          state.chatMessage = "";
          state.resetToolStream();
          state.applySettings({
            ...state.settings,
            sessionKey: next,
            lastActiveSessionKey: next,
          });
          void state.loadAssistantIdentity();
        },
        onConnect: () => state.connect(),
        onRefresh: () => state.loadOverview(),
      });
      
    case "channels":
      return renderChannels({
        connected: state.connected,
        loading: state.channelsLoading,
        snapshot: state.channelsSnapshot,
        lastError: state.channelsError,
        lastSuccessAt: state.channelsLastSuccess,
        whatsappMessage: state.whatsappLoginMessage,
        whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
        whatsappConnected: state.whatsappLoginConnected,
        whatsappBusy: state.whatsappBusy,
        configSchema: state.configSchema,
        configSchemaLoading: state.configSchemaLoading,
        configForm: state.configForm,
        configUiHints: state.configUiHints,
        configSaving: state.configSaving,
        configFormDirty: state.configFormDirty,
        nostrProfileFormState: state.nostrProfileFormState,
        nostrProfileAccountId: state.nostrProfileAccountId,
        onRefresh: (probe) => loadChannels(state, probe),
        onWhatsAppStart: (force) => state.handleWhatsAppStart(force),
        onWhatsAppWait: () => state.handleWhatsAppWait(),
        onWhatsAppLogout: () => state.handleWhatsAppLogout(),
        onConfigPatch: (path, value) => updateConfigFormValue(state, path, value),
        onConfigSave: () => state.handleChannelConfigSave(),
        onConfigReload: () => state.handleChannelConfigReload(),
        onNostrProfileEdit: (accountId, profile) => state.handleNostrProfileEdit(accountId, profile),
        onNostrProfileCancel: () => state.handleNostrProfileCancel(),
        onNostrProfileFieldChange: (field, value) => state.handleNostrProfileFieldChange(field, value),
        onNostrProfileSave: () => state.handleNostrProfileSave(),
        onNostrProfileImport: () => state.handleNostrProfileImport(),
        onNostrProfileToggleAdvanced: () => state.handleNostrProfileToggleAdvanced(),
      });
      
    case "instances":
      return renderInstances({
        loading: state.presenceLoading,
        entries: state.presenceEntries,
        lastError: state.presenceError,
        statusMessage: state.presenceStatus,
        onRefresh: () => loadPresence(state),
      });
      
    case "sessions":
      return renderSessions({
        loading: state.sessionsLoading,
        result: state.sessionsResult,
        error: state.sessionsError,
        activeMinutes: state.sessionsFilterActive,
        limit: state.sessionsFilterLimit,
        includeGlobal: state.sessionsIncludeGlobal,
        includeUnknown: state.sessionsIncludeUnknown,
        basePath: state.basePath,
        onFiltersChange: (next) => {
          state.sessionsFilterActive = next.activeMinutes;
          state.sessionsFilterLimit = next.limit;
          state.sessionsIncludeGlobal = next.includeGlobal;
          state.sessionsIncludeUnknown = next.includeUnknown;
        },
        onRefresh: () => loadSessions(state),
        onPatch: (key, patch) => patchSession(state, key, patch),
        onDelete: (key) => deleteSessionAndRefresh(state, key),
      });
      
    case "usage":
      return html`<div class="window-usage-container">${renderUsageTab(state)}</div>`;
      
    case "cron":
      // Use the new Google Calendar-style scheduler
      return renderCalendarScheduler(state, () => requestRender());
      
    case "agents":
      return renderAgents({
        loading: state.agentsLoading,
        error: state.agentsError,
        agentsList: state.agentsList,
        selectedAgentId: resolvedAgentId,
        activePanel: state.agentsPanel,
        configForm: configValue,
        configLoading: state.configLoading,
        configSaving: state.configSaving,
        configDirty: state.configFormDirty,
        channelsLoading: state.channelsLoading,
        channelsError: state.channelsError,
        channelsSnapshot: state.channelsSnapshot,
        channelsLastSuccess: state.channelsLastSuccess,
        cronLoading: state.cronLoading,
        cronStatus: state.cronStatus,
        cronJobs: state.cronJobs,
        cronError: state.cronError,
        agentFilesLoading: state.agentFilesLoading,
        agentFilesError: state.agentFilesError,
        agentFilesList: state.agentFilesList,
        agentFileActive: state.agentFileActive,
        agentFileContents: state.agentFileContents,
        agentFileDrafts: state.agentFileDrafts,
        agentFileSaving: state.agentFileSaving,
        agentIdentityLoading: state.agentIdentityLoading,
        agentIdentityError: state.agentIdentityError,
        agentIdentityById: state.agentIdentityById,
        agentSkillsLoading: state.agentSkillsLoading,
        agentSkillsReport: state.agentSkillsReport,
        agentSkillsError: state.agentSkillsError,
        agentSkillsAgentId: state.agentSkillsAgentId,
        toolsCatalogLoading: state.toolsCatalogLoading,
        toolsCatalogError: state.toolsCatalogError,
        toolsCatalogResult: state.toolsCatalogResult,
        skillsFilter: state.skillsFilter,
        onRefresh: async () => {
          await loadAgents(state);
          const nextSelected =
            state.agentsSelectedId ??
            state.agentsList?.defaultId ??
            state.agentsList?.agents?.[0]?.id ??
            null;
          await loadToolsCatalog(state, nextSelected);
          const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
          if (agentIds.length > 0) {
            void loadAgentIdentities(state, agentIds);
          }
        },
        onSelectAgent: (agentId) => {
          if (state.agentsSelectedId === agentId) return;
          state.agentsSelectedId = agentId;
          state.agentFilesList = null;
          state.agentFilesError = null;
          state.agentFilesLoading = false;
          state.agentFileActive = null;
          state.agentFileContents = {};
          state.agentFileDrafts = {};
          state.agentSkillsReport = null;
          state.agentSkillsError = null;
          state.agentSkillsAgentId = null;
          void loadAgentIdentity(state, agentId);
          if (state.agentsPanel === "tools") {
            void loadToolsCatalog(state, agentId);
          }
          if (state.agentsPanel === "files") {
            void loadAgentFiles(state, agentId);
          }
          if (state.agentsPanel === "skills") {
            void loadAgentSkills(state, agentId);
          }
        },
        onSelectPanel: (panel) => {
          state.agentsPanel = panel;
          if (panel === "files" && resolvedAgentId) {
            if (state.agentFilesList?.agentId !== resolvedAgentId) {
              state.agentFilesList = null;
              state.agentFilesError = null;
              state.agentFileActive = null;
              state.agentFileContents = {};
              state.agentFileDrafts = {};
              void loadAgentFiles(state, resolvedAgentId);
            }
          }
          if (panel === "tools") {
            void loadToolsCatalog(state, resolvedAgentId);
          }
          if (panel === "skills") {
            if (resolvedAgentId) {
              void loadAgentSkills(state, resolvedAgentId);
            }
          }
          if (panel === "channels") {
            void loadChannels(state, false);
          }
          if (panel === "cron") {
            void state.loadCron();
          }
        },
        onLoadFiles: (agentId) => loadAgentFiles(state, agentId),
        onSelectFile: (name) => {
          state.agentFileActive = name;
          if (!resolvedAgentId) return;
          void loadAgentFileContent(state, resolvedAgentId, name);
        },
        onFileDraftChange: (name, content) => {
          state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
        },
        onFileReset: (name) => {
          const base = state.agentFileContents[name] ?? "";
          state.agentFileDrafts = { ...state.agentFileDrafts, [name]: base };
        },
        onFileSave: (name) => {
          if (!resolvedAgentId) return;
          const content = state.agentFileDrafts[name] ?? state.agentFileContents[name] ?? "";
          void saveAgentFile(state, resolvedAgentId, name, content);
        },
        onToolsProfileChange: (agentId, profile, clearAllow) => {
          const index = profile || clearAllow ? ensureAgentIndex(agentId) : findAgentIndex(agentId);
          if (index < 0) return;
          const basePath = ["agents", "list", index, "tools"];
          if (profile) {
            updateConfigFormValue(state, [...basePath, "profile"], profile);
          } else {
            removeConfigFormValue(state, [...basePath, "profile"]);
          }
          if (clearAllow) {
            removeConfigFormValue(state, [...basePath, "allow"]);
          }
        },
        onToolsOverridesChange: (agentId, alsoAllow, deny) => {
          const index = alsoAllow.length > 0 || deny.length > 0 ? ensureAgentIndex(agentId) : findAgentIndex(agentId);
          if (index < 0) return;
          const basePath = ["agents", "list", index, "tools"];
          if (alsoAllow.length > 0) {
            updateConfigFormValue(state, [...basePath, "alsoAllow"], alsoAllow);
          } else {
            removeConfigFormValue(state, [...basePath, "alsoAllow"]);
          }
          if (deny.length > 0) {
            updateConfigFormValue(state, [...basePath, "deny"], deny);
          } else {
            removeConfigFormValue(state, [...basePath, "deny"]);
          }
        },
        onConfigReload: () => loadConfig(state),
        onConfigSave: () => saveAgentsConfig(state),
        onChannelsRefresh: () => loadChannels(state, false),
        onCronRefresh: () => state.loadCron(),
        onSkillsFilterChange: (next) => (state.skillsFilter = next),
        onSkillsRefresh: () => {
          if (resolvedAgentId) {
            void loadAgentSkills(state, resolvedAgentId);
          }
        },
        onAgentSkillToggle: (agentId, skillName, enabled) => {
          const index = ensureAgentIndex(agentId);
          if (index < 0) return;
          const list = (getCurrentConfigValue() as { agents?: { list?: unknown[] } } | null)?.agents?.list;
          const entry = Array.isArray(list) ? (list[index] as { skills?: unknown }) : undefined;
          const normalizedSkill = skillName.trim();
          if (!normalizedSkill) return;
          const allSkills = state.agentSkillsReport?.skills?.map((skill) => skill.name).filter(Boolean) ?? [];
          const existing = Array.isArray(entry?.skills)
            ? entry.skills.map((name) => String(name).trim()).filter(Boolean)
            : undefined;
          const base = existing ?? allSkills;
          const next = new Set(base);
          if (enabled) {
            next.add(normalizedSkill);
          } else {
            next.delete(normalizedSkill);
          }
          updateConfigFormValue(state, ["agents", "list", index, "skills"], [...next]);
        },
        onAgentSkillsClear: (agentId) => {
          const index = findAgentIndex(agentId);
          if (index < 0) return;
          removeConfigFormValue(state, ["agents", "list", index, "skills"]);
        },
        onAgentSkillsDisableAll: (agentId) => {
          const index = ensureAgentIndex(agentId);
          if (index < 0) return;
          updateConfigFormValue(state, ["agents", "list", index, "skills"], []);
        },
        onModelChange: (agentId, modelId) => {
          const index = modelId ? ensureAgentIndex(agentId) : findAgentIndex(agentId);
          if (index < 0) return;
          const basePath = ["agents", "list", index, "model"];
          if (!modelId) {
            removeConfigFormValue(state, basePath);
            return;
          }
          const list = (getCurrentConfigValue() as { agents?: { list?: unknown[] } } | null)?.agents?.list;
          const entry = Array.isArray(list) ? (list[index] as { model?: unknown }) : undefined;
          const existing = entry?.model;
          if (existing && typeof existing === "object" && !Array.isArray(existing)) {
            const fallbacks = (existing as { fallbacks?: unknown }).fallbacks;
            const next = {
              primary: modelId,
              ...(Array.isArray(fallbacks) ? { fallbacks } : {}),
            };
            updateConfigFormValue(state, basePath, next);
          } else {
            updateConfigFormValue(state, basePath, modelId);
          }
        },
        onModelFallbacksChange: (agentId, fallbacks) => {
          const normalized = fallbacks.map((name) => name.trim()).filter(Boolean);
          const currentConfig = getCurrentConfigValue();
          const resolvedConfig = resolveAgentConfig(currentConfig, agentId);
          const effectivePrimary =
            resolveModelPrimary(resolvedConfig.entry?.model) ??
            resolveModelPrimary(resolvedConfig.defaults?.model);
          const effectiveFallbacks = resolveEffectiveModelFallbacks(
            resolvedConfig.entry?.model,
            resolvedConfig.defaults?.model,
          );
          const index =
            normalized.length > 0
              ? effectivePrimary
                ? ensureAgentIndex(agentId)
                : -1
              : (effectiveFallbacks?.length ?? 0) > 0 || findAgentIndex(agentId) >= 0
                ? ensureAgentIndex(agentId)
                : -1;
          if (index < 0) return;
          const list = (getCurrentConfigValue() as { agents?: { list?: unknown[] } } | null)?.agents?.list;
          const basePath = ["agents", "list", index, "model"];
          const entry = Array.isArray(list) ? (list[index] as { model?: unknown }) : undefined;
          const existing = entry?.model;
          const resolvePrimary = () => {
            if (typeof existing === "string") {
              return existing.trim() || null;
            }
            if (existing && typeof existing === "object" && !Array.isArray(existing)) {
              const primary = (existing as { primary?: unknown }).primary;
              if (typeof primary === "string") {
                const trimmed = primary.trim();
                return trimmed || null;
              }
            }
            return null;
          };
          const primary = resolvePrimary() ?? effectivePrimary;
          if (normalized.length === 0) {
            if (primary) {
              updateConfigFormValue(state, basePath, primary);
            } else {
              removeConfigFormValue(state, basePath);
            }
            return;
          }
          if (!primary) return;
          updateConfigFormValue(state, basePath, { primary, fallbacks: normalized });
        },
      });
      
    case "skills":
      return renderSkills({
        loading: state.skillsLoading,
        report: state.skillsReport,
        error: state.skillsError,
        filter: state.skillsFilter,
        edits: state.skillEdits,
        messages: state.skillMessages,
        busyKey: state.skillsBusyKey,
        onFilterChange: (next) => (state.skillsFilter = next),
        onRefresh: () => loadSkills(state, { clearMessages: true }),
        onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
        onEdit: (key, value) => updateSkillEdit(state, key, value),
        onSaveKey: (key) => saveSkillApiKey(state, key),
        onInstall: (skillKey, name, installId) => installSkill(state, skillKey, name, installId),
      });
      
    case "nodes":
      return renderNodes({
        loading: state.nodesLoading,
        nodes: state.nodes,
        devicesLoading: state.devicesLoading,
        devicesError: state.devicesError,
        devicesList: state.devicesList,
        configForm: state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null),
        configLoading: state.configLoading,
        configSaving: state.configSaving,
        configDirty: state.configFormDirty,
        configFormMode: state.configFormMode,
        execApprovalsLoading: state.execApprovalsLoading,
        execApprovalsSaving: state.execApprovalsSaving,
        execApprovalsDirty: state.execApprovalsDirty,
        execApprovalsSnapshot: state.execApprovalsSnapshot,
        execApprovalsForm: state.execApprovalsForm,
        execApprovalsSelectedAgent: state.execApprovalsSelectedAgent,
        execApprovalsTarget: state.execApprovalsTarget,
        execApprovalsTargetNodeId: state.execApprovalsTargetNodeId,
        onRefresh: () => loadNodes(state),
        onDevicesRefresh: () => loadDevices(state),
        onDeviceApprove: (requestId) => approveDevicePairing(state, requestId),
        onDeviceReject: (requestId) => rejectDevicePairing(state, requestId),
        onDeviceRotate: (deviceId, role, scopes) =>
          rotateDeviceToken(state, { deviceId, role, scopes }),
        onDeviceRevoke: (deviceId, role) => revokeDeviceToken(state, { deviceId, role }),
        onLoadConfig: () => loadConfig(state),
        onLoadExecApprovals: () => {
          const target =
            state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
              ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
              : { kind: "gateway" as const };
          return loadExecApprovals(state, target);
        },
        onBindDefault: (nodeId) => {
          if (nodeId) {
            updateConfigFormValue(state, ["tools", "exec", "node"], nodeId);
          } else {
            removeConfigFormValue(state, ["tools", "exec", "node"]);
          }
        },
        onBindAgent: (agentIndex, nodeId) => {
          const basePath = ["agents", "list", agentIndex, "tools", "exec", "node"];
          if (nodeId) {
            updateConfigFormValue(state, basePath, nodeId);
          } else {
            removeConfigFormValue(state, basePath);
          }
        },
        onSaveBindings: () => saveConfig(state),
        onExecApprovalsTargetChange: (kind, nodeId) => {
          state.execApprovalsTarget = kind;
          state.execApprovalsTargetNodeId = nodeId;
          state.execApprovalsSnapshot = null;
          state.execApprovalsForm = null;
          state.execApprovalsDirty = false;
          state.execApprovalsSelectedAgent = null;
        },
        onExecApprovalsSelectAgent: (agentId) => {
          state.execApprovalsSelectedAgent = agentId;
        },
        onExecApprovalsPatch: (path, value) => updateExecApprovalsFormValue(state, path, value),
        onExecApprovalsRemove: (path) => removeExecApprovalsFormValue(state, path),
        onSaveExecApprovals: () => {
          const target =
            state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
              ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
              : { kind: "gateway" as const };
          return saveExecApprovals(state, target);
        },
      });
      
    case "chat":
      return renderChat({
        sessionKey: state.sessionKey,
        onSessionKeyChange: (next) => {
          state.sessionKey = next;
          state.chatMessage = "";
          state.chatStream = null;
          state.chatStreamStartedAt = null;
          state.chatRunId = null;
          state.chatQueue = [];
          state.chatAttachments = [];
          state.resetToolStream();
          state.resetChatScroll();
          state.applySettings({
            ...state.settings,
            sessionKey: next,
            lastActiveSessionKey: next,
          });
          void state.loadAssistantIdentity();
          void loadChatHistory(state);
        },
        thinkingLevel: state.chatThinkingLevel,
        showThinking: state.onboarding ? false : state.settings.chatShowThinking,
        loading: state.chatLoading,
        sending: state.chatSending,
        compactionStatus: state.compactionStatus,
        fallbackStatus: state.fallbackStatus,
        assistantAvatarUrl: state.chatAvatarUrl ?? null,
        messages: state.chatMessages,
        toolMessages: state.chatToolMessages,
        streamSegments: state.chatStreamSegments,
        stream: state.chatStream,
        streamStartedAt: state.chatStreamStartedAt,
        draft: state.chatMessage,
        queue: state.chatQueue,
        connected: state.connected,
        canSend: state.connected,
        disabledReason: chatDisabledReason,
        error: state.lastError,
        sessions: state.sessionsResult,
        focusMode: false,
        onRefresh: () => {
          state.resetToolStream();
          return Promise.all([loadChatHistory(state)]);
        },
        onToggleFocusMode: () => {},
        onChatScroll: (event) => state.handleChatScroll(event),
        onDraftChange: (next) => (state.chatMessage = next),
        attachments: state.chatAttachments,
        onAttachmentsChange: (next) => (state.chatAttachments = next),
        onSend: () => state.handleSendChat(),
        canAbort: Boolean(state.chatRunId),
        onAbort: () => void state.handleAbortChat(),
        onQueueRemove: (id) => state.removeQueuedMessage(id),
        onNewSession: () => state.handleSendChat("/new", { restoreDraft: true }),
        showNewMessages: state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
        onScrollToBottom: () => state.scrollToBottom(),
        sidebarOpen: state.sidebarOpen,
        sidebarContent: state.sidebarContent,
        sidebarError: state.sidebarError,
        splitRatio: state.splitRatio,
        onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
        onCloseSidebar: () => state.handleCloseSidebar(),
        onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
        assistantName: state.assistantName,
        assistantAvatar: state.assistantAvatar,
      });
      
    case "config":
      return renderConfig({
        raw: state.configRaw,
        originalRaw: state.configRawOriginal,
        valid: state.configValid,
        issues: state.configIssues,
        loading: state.configLoading,
        saving: state.configSaving,
        applying: state.configApplying,
        updating: state.updateRunning,
        connected: state.connected,
        schema: state.configSchema,
        schemaLoading: state.configSchemaLoading,
        uiHints: state.configUiHints,
        formMode: state.configFormMode,
        formValue: state.configForm,
        originalValue: state.configFormOriginal,
        searchQuery: state.configSearchQuery,
        activeSection: state.configActiveSection,
        activeSubsection: state.configActiveSubsection,
        onRawChange: (next) => { state.configRaw = next; },
        onFormModeChange: (mode) => (state.configFormMode = mode),
        onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
        onSearchChange: (query) => (state.configSearchQuery = query),
        onSectionChange: (section) => {
          state.configActiveSection = section;
          state.configActiveSubsection = null;
        },
        onSubsectionChange: (section) => (state.configActiveSubsection = section),
        onReload: () => loadConfig(state),
        onSave: () => saveConfig(state),
        onApply: () => applyConfig(state),
        onUpdate: () => runUpdate(state),
      });
      
    case "debug":
      return renderDebug({
        loading: state.debugLoading,
        status: state.debugStatus,
        health: state.debugHealth,
        models: state.debugModels,
        heartbeat: state.debugHeartbeat,
        eventLog: state.eventLog,
        methods: (state.hello?.features?.methods ?? []).toSorted(),
        callMethod: state.debugCallMethod,
        callParams: state.debugCallParams,
        callResult: state.debugCallResult,
        callError: state.debugCallError,
        onCallMethodChange: (next) => (state.debugCallMethod = next),
        onCallParamsChange: (next) => (state.debugCallParams = next),
        onRefresh: () => loadDebug(state),
        onCall: () => callDebugMethod(state),
      });
      
    case "logs":
      return renderLogs({
        loading: state.logsLoading,
        error: state.logsError,
        file: state.logsFile,
        entries: state.logsEntries,
        filterText: state.logsFilterText,
        levelFilters: state.logsLevelFilters,
        autoFollow: state.logsAutoFollow,
        truncated: state.logsTruncated,
        onFilterTextChange: (next) => (state.logsFilterText = next),
        onLevelToggle: (level, enabled) => {
          state.logsLevelFilters = { ...state.logsLevelFilters, [level]: enabled };
        },
        onToggleAutoFollow: (next) => (state.logsAutoFollow = next),
        onRefresh: () => loadLogs(state, { reset: true }),
        onExport: (lines, label) => state.exportLogs(lines, label),
        onScroll: (event) => state.handleLogsScroll(event),
      });
      
    case "agentDashboard":
      return renderAgentDashboard({
        loading: state.agentsLoading,
        error: state.agentsError,
        agentsList: state.agentsList,
        agentIdentityById: state.agentIdentityById,
        sessionsResult: state.sessionsResult,
        onRefresh: () => {
          void loadAgents(state);
          void loadSessions(state);
          const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
          if (agentIds.length > 0) {
            void loadAgentIdentities(state, agentIds);
          }
        },
        onViewAgent: (agentId) => {
          state.agentsSelectedId = agentId;
          launchApp("agents");
        },
        onViewProfiles: () => {
          launchApp("agentProfiles");
        },
      });
      
    case "agentProfiles":
      return renderAgentProfiles({
        loading: state.agentsLoading,
        error: state.agentsError,
        agentsList: state.agentsList,
        agentIdentityById: state.agentIdentityById,
        agentIdentityLoading: state.agentIdentityLoading,
        selectedAgentId: state.agentProfilesSelectedId,
        onRefresh: () => {
          void loadAgents(state);
          const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
          if (agentIds.length > 0) {
            void loadAgentIdentities(state, agentIds);
          }
        },
        onSelectAgent: (agentId) => {
          state.agentProfilesSelectedId = agentId || null;
          requestRender();
        },
        onLoadIdentity: (agentId) => {
          void loadAgentIdentity(state, agentId);
        },
      });
      
    case "calculator":
      return renderCalculator();
      
    case "notes":
      return renderNotes();
      
    case "files":
      return renderFiles();
      
    case "terminal":
      return renderTerminal();
      
    case "browser":
      return renderBrowser();
      
    case "music":
      return renderMusic();
      
    case "photos":
      return renderPhotos();
      
    case "weather":
      return renderWeather();
      
    case "clock":
      return renderClock();
      
    case "settingsDisplay":
    case "settingsNetwork":
    case "settingsPrivacy":
      return renderSettingsPlaceholder(tab);
      
    case "systemMonitor":
      return renderSystemMonitor();
      
    default:
      return html`<div class="empty-state">
        <div class="empty-state__title">Unknown App</div>
        <div class="empty-state__description">This application is not available.</div>
      </div>`;
  }
}

// ===========================================
// Main Render Function
// ===========================================

export function renderApp(state: AppViewState) {
  // Set up render callback for window management
  renderCallback = () => {
    (state as unknown as { requestUpdate: () => void }).requestUpdate();
  };
  
  const codeFluxVersion =
    (typeof state.hello?.server?.version === "string" && state.hello.server.version.trim()) ||
    state.updateAvailable?.currentVersion ||
    t("common.na");
  const connected = state.connected;
  
  // Get current time for clock
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  
  return html`
    <div class="os-container">
      <!-- Desktop Background -->
      ${renderWallpaper()}
      
      <!-- Linux Top Panel -->
      <div class="top-panel">
        <div class="panel-left">
          <!-- Linux Menu Button -->
          <button 
            class="linux-menu-btn ${startMenuOpen ? 'active' : ''}"
            @click=${() => { startMenuOpen = !startMenuOpen; requestRender(); }}
          >
            <div class="linux-menu-btn__icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <span class="linux-menu-btn__text">Applications</span>
          </button>
          
          <div style="width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
          
          <!-- Active Windows -->
          ${Array.from(openWindows.values())
            .filter(w => !w.minimized)
            .sort((a, b) => a.zIndex - b.zIndex)
            .slice(0, 5)
            .map(win => html`
              <div 
                class="panel-window-item ${win.active ? 'active' : ''}"
                @click=${() => win.minimized ? restoreWindow(win.id) : activateWindow(win.id)}
              >
                <div class="panel-window-item__icon">
                  ${icons[win.icon as keyof typeof icons]}
                </div>
                <span class="panel-window-item__label">${win.title}</span>
              </div>
            `)}
        </div>
        
        <div class="panel-center">
          <!-- Workspace Indicator -->
          <div style="display: flex; gap: 8px; align-items: center;">
            <div style="width: 10px; height: 10px; border-radius: 2px; background: var(--accent); box-shadow: 0 0 10px var(--accent);"></div>
            <div style="width: 10px; height: 10px; border-radius: 2px; background: rgba(255,255,255,0.2);"></div>
            <div style="width: 10px; height: 10px; border-radius: 2px; background: rgba(255,255,255,0.2);"></div>
          </div>
        </div>
        
        <div class="panel-right">
          <!-- Connection Status -->
          <div style="display: flex; gap: 12px; align-items: center; font-size: 13px; color: var(--muted);">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span class="status-dot ${connected ? 'ok' : ''}" style="width: 6px; height: 6px;"></span>
              ${connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          
          <!-- Clock -->
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 600; color: var(--text-strong);">${timeString}</div>
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">${dateString}</div>
          </div>
        </div>
      </div>
      
      <!-- Linux Side Dock -->
      <div class="linux-dock">
        <div class="linux-dock__favorites">
          ${['chat', 'agents', 'nodes', 'config', 'overview'].map(tabId => {
            const app = getAppById(tabId as Tab);
            if (!app) return nothing;
            const isOpen = openWindows.has(getWindowIdForTab(tabId as Tab) || '');
            const onDesktop = isOnDesktop(tabId as Tab);
            return html`
              <div 
                class="linux-dock__item ${isOpen ? 'active' : ''} ${onDesktop ? 'on-desktop' : ''}"
                @click=${() => launchApp(tabId as Tab)}
                @contextmenu=${(e: MouseEvent) => showDockContextMenu(e, tabId as Tab)}
                title="${app.name}${onDesktop ? ' (on Desktop)' : ''}"
              >
                ${icons[app.icon as keyof typeof icons]}
                ${onDesktop ? html`<div class="dock-desktop-indicator"></div>` : nothing}
              </div>
            `;
          })}
        </div>
        
        <div class="linux-dock__bottom">
          <div class="linux-dock__separator"></div>
          
          <div 
            class="linux-dock__item launcher-btn"
            @click=${() => { startMenuOpen = !startMenuOpen; requestRender(); }}
            title="Show Applications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
        </div>
      </div>
      
      <!-- Desktop Area -->
      <div class="desktop-area" @click=${handleDesktopClick} @contextmenu=${handleDesktopRightClick}>
        <!-- Desktop Icons -->
        <div class="desktop-icons">
          ${getSortedDesktopIcons().map((iconState) => {
            const app = getAppById(iconState.id);
            if (!app) return nothing;
            const isOpen = openWindows.has(getWindowIdForTab(app.id) || '');
            const isSelected = selectedIcon === app.id;
            const isDragging = draggedIcon === app.id;
            const isDragOver = dragOverIcon === app.id;
            return html`
              <div 
                class="app-icon 
                  ${isOpen ? 'active' : ''} 
                  ${isSelected ? 'selected' : ''}
                  ${isDragging ? 'dragging' : ''}
                  ${isDragOver ? 'drag-over' : ''}"
                draggable="true"
                @click=${(e: MouseEvent) => {
                  e.stopPropagation();
                  selectedIcon = app.id;
                  requestRender();
                }}
                @dblclick=${() => launchApp(app.id)}
                @contextmenu=${(e: MouseEvent) => showContextMenu(e, app.id)}
                @dragstart=${(e: DragEvent) => handleIconDragStart(e, app.id)}
                @dragover=${(e: DragEvent) => handleIconDragOver(e, app.id)}
                @drop=${(e: DragEvent) => handleIconDrop(e, app.id)}
                @dragend=${handleIconDragEnd}
              >
                <div class="app-icon__graphic">
                  ${icons[app.icon as keyof typeof icons]}
                </div>
                <span class="app-icon__label">${app.name}</span>
              </div>
            `;
          })}
          
          <!-- Trash Icon -->
          <div class="desktop-icons__trash ${draggedIcon ? 'can-drop' : ''}" 
               @click=${() => {
                 // Show trash contents or empty trash
               }}
               @dragover=${(e: DragEvent) => {
                 if (draggedIcon) {
                   e.preventDefault();
                 }
               }}
               @drop=${(e: DragEvent) => {
                 e.preventDefault();
                 if (draggedIcon) {
                   removeDesktopIcon(draggedIcon);
                   draggedIcon = null;
                   dragOverIcon = null;
                   requestRender();
                 }
               }}
          >
            <div class="app-icon__graphic">
              ${icons.trash}
            </div>
            <span class="app-icon__label">Trash</span>
          </div>
        </div>
        
        <!-- Windows Container -->
        <div class="windows-container">
          ${Array.from(openWindows.values()).map(win => renderWindow(state, win))}
        </div>
      </div>
      
      ${startMenuOpen ? renderStartMenu() : nothing}
      ${contextMenuOpen ? renderDesktopContextMenu() : nothing}
      ${dockContextMenuOpen ? renderDockContextMenu() : nothing}
      ${renderExecApprovalPrompt(state)}
      ${renderGatewayUrlConfirmation(state)}
    </div>
  `;
}

// Helper to get window ID for a tab (if open)
function getWindowIdForTab(tab: Tab): string | undefined {
  for (const [id, win] of openWindows) {
    if (win.tab === tab) return id;
  }
  return undefined;
}

// Launch an app (open or focus)
function launchApp(tab: Tab) {
  // Check if already open
  const existingId = getWindowIdForTab(tab);
  if (existingId) {
    restoreWindow(existingId);
    return;
  }
  
  // Open new window
  const app = getAppById(tab);
  if (app) {
    openWindow(tab, app.name, app.icon);
  }
}

// Track resize observers to prevent memory leaks
const resizeObservers = new Map<string, ResizeObserver>();

// Render a single window
function renderWindow(state: AppViewState, win: WindowState) {
  const windowStyle = win.maximized 
    ? '' 
    : `left: ${win.x}px; top: ${win.y}px; width: ${win.width}px; height: ${win.height}px;`;
  
  // Set up resize observer for this window
  const setupResizeObserver = (el?: Element) => {
    if (!el || win.maximized) return;
    
    // Clean up old observer
    const oldObserver = resizeObservers.get(win.id);
    if (oldObserver) {
      oldObserver.disconnect();
    }
    
    // Create new observer to track manual resizing
    let resizeTimeout: number | null = null;
    const observer = new ResizeObserver((entries) => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          const rect = entry.contentRect;
          // Only update if size changed significantly (not during normal render)
          const widthDiff = Math.abs(rect.width - win.width);
          const heightDiff = Math.abs(rect.height - win.height);
          if (widthDiff > 10 || heightDiff > 10) {
            win.width = Math.round(rect.width);
            win.height = Math.round(rect.height);
          }
        }
      }, 100);
    });
    
    observer.observe(el);
    resizeObservers.set(win.id, observer);
  };
  
  return html`
    <div 
      class="window ${win.active ? 'active' : ''} ${win.closing ? 'closing' : ''} ${win.maximized ? 'maximized' : ''}"
      style="${windowStyle} z-index: ${win.zIndex};"
      @mousedown=${() => activateWindow(win.id)}
      ${(el: Element) => setupResizeObserver(el)}
    >
      <!-- Window Header -->
      <div 
        class="window-header"
        @mousedown=${(e: MouseEvent) => startDrag(e, win.id)}
      >
        <div class="window-title">
          <div class="window-title__icon">
            ${icons[win.icon as keyof typeof icons]}
          </div>
          <span>${win.title}</span>
        </div>
        <div class="window-controls">
          <button 
            class="window-btn window-btn--minimize"
            @click=${() => minimizeWindow(win.id)}
            title="Minimize"
          >−</button>
          <button 
            class="window-btn window-btn--maximize"
            @click=${() => maximizeWindow(win.id)}
            title="${win.maximized ? 'Restore' : 'Maximize'}"
          >${win.maximized ? '❐' : '□'}</button>
          <button 
            class="window-btn window-btn--close"
            @click=${() => {
              // Clean up observer on close
              const observer = resizeObservers.get(win.id);
              if (observer) {
                observer.disconnect();
                resizeObservers.delete(win.id);
              }
              closeWindow(win.id);
            }}
            title="Close"
          >×</button>
        </div>
      </div>
      
      <!-- Window Content -->
      <div class="window-content">
        ${renderWindowContent(state, win)}
      </div>
      
      ${!win.maximized ? html`<div class="window-resize-handle window-resize-handle--se"></div>` : nothing}
    </div>
  `;
}

// Render Desktop Context Menu
function renderDesktopContextMenu() {
  const app = contextMenuIcon ? getAppById(contextMenuIcon) : null;
  return html`
    <div 
      class="desktop-context-menu"
      style="left: ${contextMenuX}px; top: ${contextMenuY}px;"
      @click=${(e: Event) => e.stopPropagation()}
    >
      ${app ? html`
        <div class="desktop-context-menu__item" @click=${() => {
          if (contextMenuIcon) {
            launchApp(contextMenuIcon);
            closeContextMenu();
          }
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Open
        </div>
        <div class="desktop-context-menu__divider"></div>
      ` : nothing}
      
      ${app ? html`
        <div class="desktop-context-menu__item" @click=${() => {
          // Sort alphabetically
          desktopIcons.sort((a, b) => {
            const appA = getAppById(a.id);
            const appB = getAppById(b.id);
            return (appA?.name || '').localeCompare(appB?.name || '');
          });
          desktopIcons.forEach((icon, idx) => icon.order = idx);
          closeContextMenu();
          requestRender();
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m3 16 4 4 4-4"/>
            <path d="M7 20V4"/>
            <path d="M11 4h10"/>
            <path d="M11 8h7"/>
            <path d="M11 12h4"/>
          </svg>
          Sort by Name
        </div>
        <div class="desktop-context-menu__divider"></div>
      ` : nothing}
      
      ${contextMenuIcon ? html`
        <div class="desktop-context-menu__item danger" @click=${() => {
          if (contextMenuIcon) {
            removeDesktopIcon(contextMenuIcon);
            closeContextMenu();
          }
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          Remove from Desktop
        </div>
      ` : html`
        <div class="desktop-context-menu__item" @click=${() => {
          // Restore all icons
          desktopIcons = APPS.map((app, index) => ({ id: app.id, order: index }));
          closeContextMenu();
          requestRender();
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Restore All Icons
        </div>
      `}
    </div>
    
    <!-- Backdrop to close menu -->
    <div 
      style="position: fixed; inset: 0; z-index: 9999;"
      @click=${closeContextMenu}
    ></div>
  `;
}

// Render Dock Context Menu
function renderDockContextMenu() {
  const app = dockContextMenuApp ? getAppById(dockContextMenuApp) : null;
  const onDesktop = dockContextMenuApp ? isOnDesktop(dockContextMenuApp) : false;
  
  if (!app) return nothing;
  
  return html`
    <div 
      class="dock-context-menu"
      style="left: ${dockContextMenuX}px; top: ${dockContextMenuY}px;"
      @click=${(e: Event) => e.stopPropagation()}
    >
      <div class="dock-context-menu__header">
        ${icons[app.icon as keyof typeof icons]}
        <span>${app.name}</span>
      </div>
      <div class="dock-context-menu__divider"></div>
      
      <div class="dock-context-menu__item" @click=${() => {
        if (dockContextMenuApp) {
          launchApp(dockContextMenuApp);
          closeDockContextMenu();
        }
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Open
      </div>
      
      <div class="dock-context-menu__divider"></div>
      
      ${!onDesktop ? html`
        <div class="dock-context-menu__item" @click=${() => {
          if (dockContextMenuApp) {
            addDesktopIcon(dockContextMenuApp);
            closeDockContextMenu();
          }
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Add to Desktop
        </div>
      ` : html`
        <div class="dock-context-menu__item" @click=${() => {
          if (dockContextMenuApp) {
            removeDesktopIcon(dockContextMenuApp);
            closeDockContextMenu();
          }
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          Remove from Desktop
        </div>
      `}
    </div>
    
    <!-- Backdrop to close menu -->
    <div 
      style="position: fixed; inset: 0; z-index: 9999;"
      @click=${closeContextMenu}
    ></div>
  `;
}

// Render Enhanced Linux App Launcher
function renderStartMenu() {
  const categories = [
    { id: 'communication', name: 'Communication', icon: 'messageSquare' },
    { id: 'system', name: 'System Tools', icon: 'monitor' },
    { id: 'agent', name: 'Agent Tools', icon: 'bot' },
    { id: 'utilities', name: 'Utilities', icon: 'briefcase' },
    { id: 'settings', name: 'Settings', icon: 'settings' },
  ];
  
  const filteredApps = APPS.filter(app => app.category === activeLauncherCategory);
  
  return html`
    <div class="app-launcher" @click=${(e: Event) => e.stopPropagation()}>
      <!-- Sidebar -->
      <div class="app-launcher__sidebar">
        <div class="app-launcher__brand">
          <div class="app-launcher__logo">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <div class="app-launcher__brand-text">
            <h3>Code Flux</h3>
            <span>v2.0.0</span>
          </div>
        </div>
        
        <div class="app-launcher__categories">
          ${categories.map(cat => html`
            <div 
              class="launcher-category ${activeLauncherCategory === cat.id ? 'active' : ''}"
              @click=${() => { activeLauncherCategory = cat.id; requestRender(); }}
            >
              ${icons[cat.icon as keyof typeof icons]}
              ${cat.name}
            </div>
          `)}
        </div>
        
        <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255,51,51,0.1);">
          <div class="launcher-category" @click=${() => { startMenuOpen = false; requestRender(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log Out
          </div>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="app-launcher__main">
        <div class="app-launcher__search">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search applications..." />
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;">
            ${categories.find(c => c.id === activeLauncherCategory)?.name}
          </span>
        </div>
        
        <div class="app-launcher__grid">
          ${filteredApps.map(app => html`
            <div 
              class="launcher-app"
              @click=${() => {
                launchApp(app.id);
                startMenuOpen = false;
                requestRender();
              }}
            >
              <div class="launcher-app__icon">
                ${icons[app.icon as keyof typeof icons]}
              </div>
              <span class="launcher-app__label">${app.name}</span>
            </div>
          `)}
        </div>
        
        <div class="app-launcher__footer">
          <span>${filteredApps.length} applications</span>
          <span style="color: var(--accent);">●</span>
        </div>
      </div>
    </div>
    
    <!-- Backdrop -->
    <div 
      style="position: fixed; inset: 0; z-index: 998; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);"
      @click=${() => { startMenuOpen = false; requestRender(); }}
    ></div>
  `;
}

// Utility App Placeholder Renderers
function renderCalculator() {
  const [display, setDisplay] = (() => {
    let val = "0";
    return [val, (newVal: string) => { val = newVal; requestRender(); }];
  })();
  
  const buttons = [
    "C", "±", "%", "÷",
    "7", "8", "9", "×",
    "4", "5", "6", "-",
    "1", "2", "3", "+",
    "0", ".", "="
  ];
  
  return html`
    <div class="utility-app calculator">
      <div class="calculator__display">${display}</div>
      <div class="calculator__buttons">
        ${buttons.map(btn => html`
          <button 
            class="calc-btn ${["÷", "×", "-", "+", "="].includes(btn) ? "operator" : ""} ${btn === "0" ? "zero" : ""}"
            @click=${() => setDisplay(btn === "C" ? "0" : display === "0" ? btn : display + btn)}
          >${btn}</button>
        `)}
      </div>
    </div>
  `;
}

function renderNotes() {
  return html`
    <div class="utility-app notes">
      <div class="notes__sidebar">
        <div class="notes__header">
          <h3>Notes</h3>
          <button class="notes__new">+ New Note</button>
        </div>
        <div class="notes__list">
          ${["Welcome", "Ideas", "Tasks"].map((note, i) => html`
            <div class="note-item ${i === 0 ? "active" : ""}">
              <div class="note-item__title">${note}</div>
              <div class="note-item__preview">Click to edit this note...</div>
            </div>
          `)}
        </div>
      </div>
      <div class="notes__editor">
        <input class="notes__title-input" value="Welcome" />
        <textarea class="notes__content" placeholder="Start typing..."></textarea>
      </div>
    </div>
  `;
}

function renderFiles() {
  return html`
    <div class="utility-app files">
      <div class="files__toolbar">
        <button class="files__btn">${icons.folder} Home</button>
        <button class="files__btn">${icons.folder} Documents</button>
        <button class="files__btn">${icons.folder} Downloads</button>
      </div>
      <div class="files__grid">
        ${["Documents", "Downloads", "Pictures", "Music", "Videos"].map(folder => html`
          <div class="file-item">
            <div class="file-item__icon">${icons.folder}</div>
            <span class="file-item__name">${folder}</span>
          </div>
        `)}
      </div>
    </div>
  `;
}

function renderTerminal() {
  return html`
    <div class="utility-app terminal">
      <div class="terminal__output">
        <div class="terminal__line">
          <span class="terminal__prompt">user@codeflux:~$</span>
          <span class="terminal__cmd">welcome</span>
        </div>
        <div class="terminal__line terminal__output-text">
          🚀 Welcome to Code Flux Terminal v2.0.0
        </div>
        <div class="terminal__line terminal__output-text">
          Type 'help' for available commands.
        </div>
        <div class="terminal__line">
          <span class="terminal__prompt">user@codeflux:~$</span>
          <span class="terminal__cursor">_</span>
        </div>
      </div>
    </div>
  `;
}

function renderBrowser() {
  return html`
    <div class="utility-app browser">
      <div class="browser__toolbar">
        <div class="browser__nav">
          <button>←</button>
          <button>→</button>
          <button>↻</button>
        </div>
        <input class="browser__url" value="https://codeflux.ai" readonly />
      </div>
      <div class="browser__content">
        <div class="browser__placeholder">
          ${icons.globe}
          <h3>Web Browser</h3>
          <p>External browsing coming soon</p>
        </div>
      </div>
    </div>
  `;
}

function renderMusic() {
  return html`
    <div class="utility-app music">
      <div class="music__player">
        <div class="music__cover">
          ${icons.music}
        </div>
        <div class="music__info">
          <h3>No Track Playing</h3>
          <p>Select a track to start listening</p>
        </div>
        <div class="music__controls">
          <button>⏮</button>
          <button class="play">▶</button>
          <button>⏭</button>
        </div>
      </div>
      <div class="music__playlist">
        <h4>Playlist</h4>
        ${["Track 1", "Track 2", "Track 3"].map((track, i) => html`
          <div class="music__track">
            <span>${i + 1}. ${track}</span>
            <span>3:45</span>
          </div>
        `)}
      </div>
    </div>
  `;
}

function renderPhotos() {
  return html`
    <div class="utility-app photos">
      <div class="photos__grid">
        ${Array.from({ length: 12 }, (_, i) => html`
          <div class="photo-item">
            <div class="photo-item__placeholder">
              ${icons.image}
              <span>Photo ${i + 1}</span>
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
}

function renderWeather() {
  return html`
    <div class="utility-app weather">
      <div class="weather__current">
        <div class="weather__icon">☀️</div>
        <div class="weather__temp">72°F</div>
        <div class="weather__desc">Sunny</div>
        <div class="weather__location">San Francisco, CA</div>
      </div>
      <div class="weather__forecast">
        ${["Mon", "Tue", "Wed", "Thu", "Fri"].map(day => html`
          <div class="weather__day">
            <span>${day}</span>
            <span>☀️</span>
            <span>70°</span>
          </div>
        `)}
      </div>
    </div>
  `;
}

function renderClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  return html`
    <div class="utility-app clock">
      <div class="clock__display">
        <div class="clock__time">${timeStr}</div>
        <div class="clock__date">${dateStr}</div>
      </div>
      <div class="clock__alarms">
        <h4>Alarms</h4>
        <div class="clock__alarm">
          <span>07:00 AM</span>
          <span class="clock__alarm-label">Wake up</span>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsPlaceholder(tab: string) {
  const settingsNames: Record<string, string> = {
    settingsDisplay: "Display Settings",
    settingsNetwork: "Network Settings", 
    settingsPrivacy: "Privacy Settings"
  };
  
  return html`
    <div class="utility-app settings-placeholder">
      <div class="settings-placeholder__content">
        ${icons.settings}
        <h2>${settingsNames[tab] || "Settings"}</h2>
        <p>This settings panel is coming soon.</p>
      </div>
    </div>
  `;
}

function renderSystemMonitor() {
  return html`
    <div class="utility-app system-monitor">
      <div class="monitor__grid">
        <div class="monitor__card">
          <h4>CPU Usage</h4>
          <div class="monitor__value">12%</div>
          <div class="monitor__bar"><div style="width: 12%"></div></div>
        </div>
        <div class="monitor__card">
          <h4>Memory</h4>
          <div class="monitor__value">4.2 GB</div>
          <div class="monitor__bar"><div style="width: 35%"></div></div>
        </div>
        <div class="monitor__card">
          <h4>Disk</h4>
          <div class="monitor__value">128 GB</div>
          <div class="monitor__bar"><div style="width: 45%"></div></div>
        </div>
        <div class="monitor__card">
          <h4>Network</h4>
          <div class="monitor__value">↓ 2.4 MB/s</div>
          <div class="monitor__value">↑ 0.8 MB/s</div>
        </div>
      </div>
      <div class="monitor__processes">
        <h4>Processes</h4>
        ${["codeflux-daemon", "gateway-server", "agent-runner"].map(proc => html`
          <div class="monitor__process">
            <span>${proc}</span>
            <span>Running</span>
          </div>
        `)}
      </div>
    </div>
  `;
}

// Drag functionality
let dragWindowId: string | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e: MouseEvent, windowId: string) {
  // Don't drag if clicking controls
  if ((e.target as HTMLElement).closest('.window-controls')) return;
  
  const win = openWindows.get(windowId);
  if (!win || win.maximized) return;
  
  dragWindowId = windowId;
  dragOffsetX = e.clientX - win.x;
  dragOffsetY = e.clientY - win.y;
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(e: MouseEvent) {
  if (!dragWindowId) return;
  
  const win = openWindows.get(dragWindowId);
  if (!win) return;
  
  win.x = Math.max(0, e.clientX - dragOffsetX);
  win.y = Math.max(0, e.clientY - dragOffsetY);
  
  requestRender();
}

function stopDrag() {
  dragWindowId = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}
