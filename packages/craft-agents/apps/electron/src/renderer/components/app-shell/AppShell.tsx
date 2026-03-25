import { getDocUrl } from '@craft-agent/shared/docs/doc-links'
import type { LabelConfig } from '@craft-agent/shared/labels'
import {
  extractLabelId,
  findLabelById,
  getDescendantIds,
  getLabelDisplayName,
} from '@craft-agent/shared/labels'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@craft-agent/ui'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  Bot,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheckBig,
  DatabaseZap,
  ExternalLink,
  Flag,
  Globe,
  HelpCircle,
  LayoutDashboard,
  ListFilter,
  ListTodo,
  MonitorSmartphone,
  Search,
  Settings,
  Tag,
  Users,
  Zap,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import appIcon from '@/assets/app-icon.png'
import {
  ensureSessionMessagesLoadedAtom,
  type SessionMeta,
  sessionMetaMapAtom,
} from '@/atoms/sessions'
import { skillsAtom } from '@/atoms/skills'
import { sourcesAtom } from '@/atoms/sources'
import { OrgSwitcher } from '@/components/team/OrgSwitcher'
import { Button } from '@/components/ui/button'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { HeaderIconButton } from '@/components/ui/HeaderIconButton'
import { LabelIcon } from '@/components/ui/label-icon'
import { ContextMenuProvider } from '@/components/ui/menu-context'
import type { RichTextInputHandle } from '@/components/ui/rich-text-input'
import {
  ContextMenu,
  ContextMenuTrigger,
  StyledContextMenuContent,
} from '@/components/ui/styled-context-menu'
import {
  DropdownMenu,
  DropdownMenuSub,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
  StyledDropdownMenuSubContent,
  StyledDropdownMenuSubTrigger,
} from '@/components/ui/styled-dropdown'
import {
  statusConfigsToTodoStates,
  type TodoState,
  type TodoStateId,
} from '@/config/todo-states'
import {
  type AppShellContextType,
  AppShellProvider,
} from '@/context/AppShellContext'
import {
  EscapeInterruptProvider,
  useEscapeInterrupt,
} from '@/context/EscapeInterruptContext'
import { useFocusContext } from '@/context/FocusContext'
import { useTheme } from '@/context/ThemeContext'
import {
  isBrowserProfilesNavigation,
  isChatsNavigation,
  isConnectorsNavigation,
  isSettingsNavigation,
  isSkillsNavigation,
  isSourcesNavigation,
  isTeamNavigation,
  useNavigation,
  useNavigationState,
} from '@/contexts/NavigationContext'
import {
  isAgentNavigation,
  isDashboardNavigation,
  isProxiesNavigation,
  isTasksNavigation,
} from '../../shared/types'
import { useFocusZone, useGlobalShortcuts } from '@/hooks/keyboard'
import { useLabels } from '@/hooks/useLabels'
import { getResizeGradientStyle } from '@/hooks/useResizeGradient'
import { useSession } from '@/hooks/useSession'
import { useStatuses } from '@/hooks/useStatuses'
import { useViews } from '@/hooks/useViews'
import { clearSourceIconCaches } from '@/lib/icon-cache'
import * as storage from '@/lib/local-storage'
import { navigate, routes } from '@/lib/navigate'
import { hasOpenOverlay } from '@/lib/overlay-detection'
import { isMac } from '@/lib/platform'
import { cn } from '@/lib/utils'
import type {
  LoadedSkill,
  LoadedSource,
  PermissionMode,
  SettingsSubpage,
  SourceFilter,
} from '../../../shared/types'
import { AppMenu, AppMenuContent } from '../AppMenu'
import { PanelLeftRounded } from '../icons/PanelLeftRounded'
import { PanelRightRounded } from '../icons/PanelRightRounded'
import { SquarePenRounded } from '../icons/SquarePenRounded'
import { LeftSidebar } from './LeftSidebar'
import { MainContentPanel } from './MainContentPanel'
import { PanelHeader } from './PanelHeader'
import { RightSidebar } from './RightSidebar'
import { SessionList } from './SessionList'
import { SidebarMenu } from './SidebarMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

/**
 * AppShellProps - Minimal props interface for AppShell component
 *
 * Data and callbacks come via contextValue (AppShellContextType).
 * Only UI-specific state is passed as separate props.
 *
 * Adding new features:
 * 1. Add to AppShellContextType in context/AppShellContext.tsx
 * 2. Update App.tsx to include in contextValue
 * 3. Use via useAppShellContext() hook in child components
 */
interface AppShellProps {
  /** All data and callbacks - passed directly to AppShellProvider */
  contextValue: AppShellContextType
  /** UI-specific props */
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  menuNewChatTrigger?: number
  /** Focused mode - hides sidebars, shows only the chat content */
  isFocusedMode?: boolean
}

/**
 * FilterMenuRow - Consistent layout for filter menu items.
 * Enforces: [icon 14px box] [label flex] [accessory 12px box]
 */
function FilterMenuRow({
  icon,
  label,
  accessory,
  iconClassName,
  iconStyle,
  noIconContainer,
}: {
  icon: React.ReactNode
  label: string
  accessory?: React.ReactNode
  /** Additional classes for icon container (e.g., for status icon scaling) */
  iconClassName?: string
  /** Style for icon container (e.g., for status icon color) */
  iconStyle?: React.CSSProperties
  /** When true, skip the icon container (for icons that have their own container) */
  noIconContainer?: boolean
}) {
  return (
    <>
      {noIconContainer ? (
        // Wrapper for color inheritance. Clone icon to add bare prop (removes EntityIcon container).
        <span style={iconStyle}>
          {React.isValidElement(icon)
            ? React.cloneElement(
                icon as React.ReactElement<{ bare?: boolean }>,
                { bare: true },
              )
            : icon}
        </span>
      ) : (
        <span
          className={cn(
            'flex h-3.5 w-3.5 shrink-0 items-center justify-center',
            iconClassName,
          )}
          style={iconStyle}
        >
          {icon}
        </span>
      )}
      <span className="flex-1">{label}</span>
      <span className="w-3 shrink-0">{accessory}</span>
    </>
  )
}

/**
 * FilterLabelItems - Recursive component for rendering label tree in the filter dropdown.
 * Labels with children render as nested submenus; leaf labels render as toggleable items.
 */
function FilterLabelItems({
  labels,
  labelFilter,
  setLabelFilter,
}: {
  labels: LabelConfig[]
  labelFilter: Set<string>
  setLabelFilter: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  return (
    <>
      {labels.map((label) => {
        const hasChildren = label.children && label.children.length > 0
        if (hasChildren) {
          // Parent label: render as a submenu trigger with nested items.
          // The parent itself is also toggleable via clicking the trigger area.
          return (
            <DropdownMenuSub key={label.id}>
              <StyledDropdownMenuSubTrigger>
                <FilterMenuRow
                  icon={<LabelIcon label={label} size="sm" hasChildren />}
                  label={label.name}
                  accessory={
                    labelFilter.has(label.id) && (
                      <Check className="h-3 w-3 text-foreground" />
                    )
                  }
                />
              </StyledDropdownMenuSubTrigger>
              <StyledDropdownMenuSubContent minWidth="min-w-[160px]">
                {/* Allow selecting the parent label itself */}
                <StyledDropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault()
                    setLabelFilter((prev) => {
                      const next = new Set(prev)
                      if (next.has(label.id)) next.delete(label.id)
                      else next.add(label.id)
                      return next
                    })
                  }}
                >
                  <FilterMenuRow
                    icon={<LabelIcon label={label} size="sm" hasChildren />}
                    label={label.name}
                    accessory={
                      labelFilter.has(label.id) && (
                        <Check className="h-3 w-3 text-foreground" />
                      )
                    }
                  />
                </StyledDropdownMenuItem>
                <StyledDropdownMenuSeparator />
                {/* Recurse into children */}
                <FilterLabelItems
                  labels={label.children ?? []}
                  labelFilter={labelFilter}
                  setLabelFilter={setLabelFilter}
                />
              </StyledDropdownMenuSubContent>
            </DropdownMenuSub>
          )
        }
        // Leaf label: render as a simple toggleable item
        return (
          <StyledDropdownMenuItem
            key={label.id}
            onClick={(e) => {
              e.preventDefault()
              setLabelFilter((prev) => {
                const next = new Set(prev)
                if (next.has(label.id)) next.delete(label.id)
                else next.add(label.id)
                return next
              })
            }}
          >
            <FilterMenuRow
              icon={<LabelIcon label={label} size="sm" />}
              label={label.name}
              accessory={
                labelFilter.has(label.id) && (
                  <Check className="h-3 w-3 text-foreground" />
                )
              }
            />
          </StyledDropdownMenuItem>
        )
      })}
    </>
  )
}

const PANEL_WINDOW_EDGE_SPACING = 6 // Padding between panels and window edge
const PANEL_PANEL_SPACING = 5 // Gap between adjacent panels

/**
 * AppShell - Main 3-panel layout container
 *
 * Layout: [LeftSidebar 20%] | [NavigatorPanel 32%] | [MainContentPanel 48%]
 *
 * Chat Filters:
 * - 'allChats': Shows all sessions
 * - 'flagged': Shows flagged sessions
 * - 'state': Shows sessions with a specific todo state
 */
export function AppShell(props: AppShellProps) {
  // Wrap with EscapeInterruptProvider so AppShellContent can use useEscapeInterrupt
  return (
    <EscapeInterruptProvider>
      <AppShellContent {...props} />
    </EscapeInterruptProvider>
  )
}

/**
 * AppShellContent - Inner component that contains all the AppShell logic
 * Separated to allow useEscapeInterrupt hook to work (must be inside provider)
 */
function AppShellContent({
  contextValue,
  defaultLayout: _defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  menuNewChatTrigger,
  isFocusedMode = false,
}: AppShellProps) {
  // Destructure commonly used values from context
  // Note: sessions is NOT destructured here - we use sessionMetaMapAtom instead
  // to prevent closures from retaining the full messages array
  const {
    workspaces,
    activeWorkspaceId,
    currentModel,
    sessionOptions,
    onSelectWorkspace,
    onRefreshWorkspaces,
    onCreateSession,
    onDeleteSession,
    onFlagSession,
    onUnflagSession,
    onMarkSessionRead,
    onMarkSessionUnread,
    onTodoStateChange,
    onRenameSession,
    onOpenSettings,
    onOpenKeyboardShortcuts,
    onOpenStoredUserPreferences,
    onReset,
    onSendMessage,
    openNewChat,
  } = contextValue

  const [isSidebarVisible, setIsSidebarVisible] = React.useState(() => {
    return storage.get(storage.KEYS.sidebarVisible, !defaultCollapsed)
  })
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    return storage.get(storage.KEYS.sidebarWidth, 160)
  })
  // Session list width in pixels (min 240, max 480)
  const [sessionListWidth, setSessionListWidth] = React.useState(() => {
    return storage.get(storage.KEYS.sessionListWidth, 300)
  })

  // Right sidebar state (min 280, max 480)
  const [isRightSidebarVisible, setIsRightSidebarVisible] = React.useState(
    () => {
      return storage.get(storage.KEYS.rightSidebarVisible, false)
    },
  )
  const [rightSidebarWidth, setRightSidebarWidth] = React.useState(() => {
    return storage.get(storage.KEYS.rightSidebarWidth, 300)
  })
  const [skipRightSidebarAnimation, setSkipRightSidebarAnimation] =
    React.useState(false)

  // Window width tracking for responsive behavior
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth)

  // Calculate overlay threshold dynamically based on actual sidebar widths
  // Formula: 600px (300px right sidebar + 300px center) + leftSidebar + sessionList
  // This ensures we switch to overlay mode when inline right sidebar would compress content
  const MIN_INLINE_SPACE = 600 // 300px for right sidebar + 300px for center content
  const leftSidebarEffectiveWidth = isSidebarVisible ? sidebarWidth : 0
  const OVERLAY_THRESHOLD =
    MIN_INLINE_SPACE + leftSidebarEffectiveWidth + sessionListWidth
  const shouldUseOverlay = windowWidth < OVERLAY_THRESHOLD

  const [isResizing, setIsResizing] = React.useState<
    'sidebar' | 'session-list' | 'right-sidebar' | null
  >(null)
  const [sidebarHandleY, setSidebarHandleY] = React.useState<number | null>(
    null,
  )
  const [sessionListHandleY, setSessionListHandleY] = React.useState<
    number | null
  >(null)
  const [rightSidebarHandleY, setRightSidebarHandleY] = React.useState<
    number | null
  >(null)
  const resizeHandleRef = React.useRef<HTMLDivElement>(null)
  const sessionListHandleRef = React.useRef<HTMLDivElement>(null)
  const rightSidebarHandleRef = React.useRef<HTMLDivElement>(null)
  const [session, setSession] = useSession()
  const { resolvedMode, isDark } = useTheme()
  const { canGoBack, canGoForward, goBack, goForward, navigateToSource } =
    useNavigation()

  // Double-Esc interrupt feature: first Esc shows warning, second Esc interrupts
  const { handleEscapePress } = useEscapeInterrupt()

  // UNIFIED NAVIGATION STATE - single source of truth from NavigationContext
  // All sidebar/navigator/main panel state is derived from this
  const navState = useNavigationState()
  const hasMiddlePanel = !isFocusedMode && isChatsNavigation(navState)

  // Derive chat filter from navigation state (only when in chats navigator)
  const chatFilter = isChatsNavigation(navState) ? navState.filter : null

  // Derive source filter from navigation state (only when in sources navigator)
  const _sourceFilter: SourceFilter | null = isSourcesNavigation(navState)
    ? (navState.filter ?? null)
    : null

  // Session list filter: empty set shows all, otherwise shows only sessions with selected states
  const [listFilter, setListFilter] = React.useState<Set<TodoStateId>>(() => {
    const saved = storage.get<TodoStateId[]>(storage.KEYS.listFilter, [])
    return new Set(saved)
  })
  // Label filter: empty set shows all, otherwise shows only sessions with at least one matching label
  const [labelFilter, setLabelFilter] = React.useState<Set<string>>(() => {
    const saved = storage.get<string[]>(storage.KEYS.labelFilter, [])
    return new Set(saved)
  })
  // Search state for session list
  const [searchActive, setSearchActive] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Reset search only when navigator or filter changes (not when selecting sessions)
  const _navFilterKey = React.useMemo(() => {
    if (isChatsNavigation(navState)) {
      const filter = navState.filter
      return `chats:${filter.kind}:${filter.kind === 'state' ? filter.stateId : ''}`
    }
    return navState.navigator
  }, [navState])

  React.useEffect(() => {
    setSearchActive(false)
    setSearchQuery('')
  }, [])

  // Auto-hide right sidebar when navigating away from chat sessions
  React.useEffect(() => {
    // Hide sidebar if not in chat view or no session selected
    if (!isChatsNavigation(navState) || !navState.details) {
      setSkipRightSidebarAnimation(true)
      setIsRightSidebarVisible(false)
      // Reset skip flag after state update
      setTimeout(() => setSkipRightSidebarAnimation(false), 0)
    }
  }, [navState])

  // Cmd+F to activate search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchActive(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track window width for responsive right sidebar behavior
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Unified sidebar keyboard navigation state
  // Load expanded folders from localStorage (default: all collapsed)
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(
    () => {
      const saved = storage.get<string[]>(storage.KEYS.expandedFolders, [])
      return new Set(saved)
    },
  )
  const [focusedSidebarItemId, setFocusedSidebarItemId] = React.useState<
    string | null
  >(null)
  const sidebarItemRefs = React.useRef<Map<string, HTMLElement>>(new Map())
  // Track which expandable sidebar items are collapsed
  // Labels are collapsed by default; user preference is persisted once toggled
  const [collapsedItems, setCollapsedItems] = React.useState<Set<string>>(
    () => {
      const saved = storage.get<string[] | null>(
        storage.KEYS.collapsedSidebarItems,
        null,
      )
      if (saved !== null) return new Set(saved)
      return new Set(['nav:labels'])
    },
  )
  const isExpanded = React.useCallback(
    (id: string) => !collapsedItems.has(id),
    [collapsedItems],
  )
  const toggleExpanded = React.useCallback((id: string) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  // Sources state (workspace-scoped)
  const [sources, setSources] = React.useState<LoadedSource[]>([])
  // Sync sources to atom for NavigationContext auto-selection
  const setSourcesAtom = useSetAtom(sourcesAtom)
  React.useEffect(() => {
    setSourcesAtom(sources)
  }, [sources, setSourcesAtom])

  // Skills state (workspace-scoped)
  const [skills, setSkills] = React.useState<LoadedSkill[]>([])
  // Sync skills to atom for NavigationContext auto-selection
  const setSkillsAtom = useSetAtom(skillsAtom)
  React.useEffect(() => {
    setSkillsAtom(skills)
  }, [skills, setSkillsAtom])
  // Whether local MCP servers are enabled (affects stdio source status)
  const [_localMcpEnabled, setLocalMcpEnabled] = React.useState(true)

  // Enabled permission modes for Shift+Tab cycling (min 2 modes)
  const [enabledModes, setEnabledModes] = React.useState<PermissionMode[]>([
    'safe',
    'ask',
    'allow-all',
  ])

  // Load workspace settings (for localMcpEnabled and cyclablePermissionModes) on workspace change
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI
      .getWorkspaceSettings(activeWorkspaceId)
      .then((settings) => {
        if (settings) {
          setLocalMcpEnabled(settings.localMcpEnabled ?? true)
          // Load cyclablePermissionModes from workspace settings
          if (
            settings.cyclablePermissionModes &&
            settings.cyclablePermissionModes.length >= 2
          ) {
            setEnabledModes(settings.cyclablePermissionModes)
          }
        }
      })
      .catch((err) => {
        console.error('[Chat] Failed to load workspace settings:', err)
      })
  }, [activeWorkspaceId])

  // Load sources from backend on mount
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI
      .getSources(activeWorkspaceId)
      .then((loaded) => {
        setSources(loaded || [])
      })
      .catch((err) => {
        console.error('[Chat] Failed to load sources:', err)
      })
  }, [activeWorkspaceId])

  // Subscribe to live source updates (when sources are added/removed dynamically)
  React.useEffect(() => {
    const cleanup = window.electronAPI.onSourcesChanged((updatedSources) => {
      // Clear icon cache so updated source icons are re-fetched on render
      clearSourceIconCaches()
      setSources(updatedSources || [])
    })
    return cleanup
  }, [])

  // Load skills from backend on mount
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI
      .getSkills(activeWorkspaceId)
      .then((loaded) => {
        setSkills(loaded || [])
      })
      .catch((err) => {
        console.error('[Chat] Failed to load skills:', err)
      })
  }, [activeWorkspaceId])

  // Subscribe to live skill updates (when skills are added/removed dynamically)
  React.useEffect(() => {
    const cleanup = window.electronAPI.onSkillsChanged?.((updatedSkills) => {
      setSkills(updatedSkills || [])
    })
    return cleanup
  }, [])

  // Handle session source selection changes
  const handleSessionSourcesChange = React.useCallback(
    async (sessionId: string, sourceSlugs: string[]) => {
      try {
        await window.electronAPI.sessionCommand(sessionId, {
          type: 'setSources',
          sourceSlugs,
        })
        // Session will emit a 'sources_changed' event that updates the session state
      } catch (err) {
        console.error('[Chat] Failed to set session sources:', err)
      }
    },
    [],
  )

  // Handle session label changes (add/remove via # menu or badge X)
  const handleSessionLabelsChange = React.useCallback(
    async (sessionId: string, labels: string[]) => {
      try {
        await window.electronAPI.sessionCommand(sessionId, {
          type: 'setLabels',
          labels,
        })
        // Session will emit a 'labels_changed' event that updates the session state
      } catch (err) {
        console.error('[Chat] Failed to set session labels:', err)
      }
    },
    [],
  )

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  // Load dynamic statuses from workspace config
  const { statuses: statusConfigs, isLoading: isLoadingStatuses } = useStatuses(
    activeWorkspace?.id || null,
  )
  const [todoStates, setTodoStates] = React.useState<TodoState[]>([])

  // Convert StatusConfig to TodoState with resolved icons
  React.useEffect(() => {
    if (!activeWorkspace?.id || statusConfigs.length === 0) {
      setTodoStates([])
      return
    }

    setTodoStates(
      statusConfigsToTodoStates(statusConfigs, activeWorkspace.id, isDark),
    )
  }, [statusConfigs, activeWorkspace?.id, isDark])

  // Optimistic status order: immediately reflects drag-drop order while IPC propagates.
  // Cleared when statusConfigs changes (config watcher is source of truth).
  const [optimisticStatusOrder, setOptimisticStatusOrder] = React.useState<
    string[] | null
  >(null)

  // Clear optimistic state when the config watcher fires (statusConfigs changes)
  React.useEffect(() => {
    setOptimisticStatusOrder(null)
  }, [])

  // Derive effective todo states: apply optimistic reorder if active, otherwise use canonical order
  const effectiveTodoStates = React.useMemo(() => {
    if (!optimisticStatusOrder) return todoStates
    // Reorder todoStates array to match optimistic order
    const stateMap = new Map(todoStates.map((s) => [s.id, s]))
    const reordered: TodoState[] = []
    for (const id of optimisticStatusOrder) {
      const state = stateMap.get(id)
      if (state) reordered.push(state)
    }
    // Append any states not in the optimistic order (shouldn't happen, but defensive)
    for (const state of todoStates) {
      if (!optimisticStatusOrder.includes(state.id)) reordered.push(state)
    }
    return reordered
  }, [todoStates, optimisticStatusOrder])

  // Load labels from workspace config
  const { labels: labelConfigs } = useLabels(activeWorkspace?.id || null)

  // Views: compiled once on config load, evaluated per session in list/chat
  const { evaluateSession: evaluateViews, viewConfigs } = useViews(
    activeWorkspace?.id || null,
  )

  // Build hierarchical label tree from nested config structure

  // Ensure session messages are loaded when selected
  const ensureMessagesLoaded = useSetAtom(ensureSessionMessagesLoadedAtom)

  // Handle selecting a source from the list (preserves current filter type)
  const _handleSourceSelect = React.useCallback(
    (source: LoadedSource) => {
      if (!activeWorkspaceId) return
      navigateToSource(source.config.slug)
    },
    [activeWorkspaceId, navigateToSource],
  )

  // Handle selecting a skill from the list
  const _handleSkillSelect = React.useCallback(
    (skill: LoadedSkill) => {
      if (!activeWorkspaceId) return
      navigate(routes.view.skills(skill.slug))
    },
    [activeWorkspaceId],
  )

  // Focus zone management
  const { focusZone, focusNextZone, focusPreviousZone } = useFocusContext()

  // Register focus zones
  const { zoneRef: sidebarRef, isFocused: sidebarFocused } = useFocusZone({
    zoneId: 'sidebar',
  })

  // Ref for focusing chat input (passed to ChatDisplay)
  const chatInputRef = useRef<RichTextInputHandle>(null)
  const focusChatInput = useCallback(() => {
    chatInputRef.current?.focus()
  }, [])

  // Global keyboard shortcuts
  useGlobalShortcuts({
    shortcuts: [
      // Zone navigation
      { key: '1', cmd: true, action: () => focusZone('sidebar') },
      { key: '2', cmd: true, action: () => focusZone('session-list') },
      { key: '3', cmd: true, action: () => focusZone('chat') },
      // Tab navigation between zones
      {
        key: 'Tab',
        action: focusNextZone,
        when: () => !document.querySelector('[role="dialog"]'),
      },
      // Shift+Tab cycles permission mode through enabled modes (textarea handles its own, this handles when focus is elsewhere)
      {
        key: 'Tab',
        shift: true,
        action: () => {
          if (session.selected) {
            const currentOptions = contextValue.sessionOptions.get(
              session.selected,
            )
            const currentMode = currentOptions?.permissionMode ?? 'ask'
            // Cycle through enabled permission modes
            const modes =
              enabledModes.length >= 2
                ? enabledModes
                : (['safe', 'ask', 'allow-all'] as PermissionMode[])
            const currentIndex = modes.indexOf(currentMode)
            // If current mode not in enabled list, jump to first enabled mode
            const nextIndex =
              currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length
            const nextMode = modes[nextIndex]
            contextValue.onSessionOptionsChange(session.selected, {
              permissionMode: nextMode,
            })
          }
        },
        when: () =>
          !document.querySelector('[role="dialog"]') &&
          document.activeElement?.tagName !== 'TEXTAREA',
      },
      // Sidebar toggle (CMD+\ like VS Code, avoids conflict with CMD+B for bold)
      { key: '\\', cmd: true, action: () => setIsSidebarVisible((v) => !v) },
      // New chat
      { key: 'n', cmd: true, action: () => handleNewChat(true) },
      // Settings
      { key: ',', cmd: true, action: onOpenSettings },
      // History navigation
      { key: '[', cmd: true, action: goBack },
      { key: ']', cmd: true, action: goForward },
      // ESC to stop processing - requires double-press within 1 second
      // First press shows warning overlay, second press interrupts
      {
        key: 'Escape',
        action: () => {
          if (session.selected) {
            const meta = sessionMetaMap.get(session.selected)
            if (meta?.isProcessing) {
              // handleEscapePress returns true on second press (within timeout)
              const shouldInterrupt = handleEscapePress()
              if (shouldInterrupt) {
                window.electronAPI
                  .cancelProcessing(session.selected, false)
                  .catch((err) => {
                    console.error(
                      '[AppShell] Failed to cancel processing:',
                      err,
                    )
                  })
              }
            }
          }
        },
        when: () => {
          // Only active when no overlay is open and session is processing
          // Overlays (dialogs, menus, popovers, etc.) should handle their own Escape
          if (hasOpenOverlay()) return false
          if (!session.selected) return false
          const meta = sessionMetaMap.get(session.selected)
          return meta?.isProcessing ?? false
        },
      },
    ],
  })

  // Global paste listener for file attachments
  // Fires when Cmd+V is pressed anywhere in the app (not just textarea)
  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Skip if a dialog or menu is open
      if (document.querySelector('[role="dialog"], [role="menu"]')) {
        return
      }

      // Skip if there are no files in the clipboard
      const files = e.clipboardData?.files
      if (!files || files.length === 0) return

      // Skip if the active element is an input/textarea/contenteditable (let it handle paste directly)
      const activeElement = document.activeElement as HTMLElement | null
      if (
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'INPUT' ||
        activeElement?.isContentEditable
      ) {
        return
      }

      // Prevent default paste behavior
      e.preventDefault()

      // Dispatch custom event for FreeFormInput to handle
      const filesArray = Array.from(files)
      window.dispatchEvent(
        new CustomEvent('craft:paste-files', {
          detail: { files: filesArray },
        }),
      )
    }

    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [])

  // Resize effect for sidebar, session list, and right sidebar
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing === 'sidebar') {
        const newWidth = Math.min(Math.max(e.clientX, 140), 240)
        setSidebarWidth(newWidth)
        if (resizeHandleRef.current) {
          const rect = resizeHandleRef.current.getBoundingClientRect()
          setSidebarHandleY(e.clientY - rect.top)
        }
      } else if (isResizing === 'session-list') {
        const offset = isSidebarVisible ? sidebarWidth : 0
        const newWidth = Math.min(Math.max(e.clientX - offset, 240), 480)
        setSessionListWidth(newWidth)
        if (sessionListHandleRef.current) {
          const rect = sessionListHandleRef.current.getBoundingClientRect()
          setSessionListHandleY(e.clientY - rect.top)
        }
      } else if (isResizing === 'right-sidebar') {
        // Calculate from right edge
        const newWidth = Math.min(
          Math.max(window.innerWidth - e.clientX, 280),
          480,
        )
        setRightSidebarWidth(newWidth)
        if (rightSidebarHandleRef.current) {
          const rect = rightSidebarHandleRef.current.getBoundingClientRect()
          setRightSidebarHandleY(e.clientY - rect.top)
        }
      }
    }

    const handleMouseUp = () => {
      if (isResizing === 'sidebar') {
        storage.set(storage.KEYS.sidebarWidth, sidebarWidth)
        setSidebarHandleY(null)
      } else if (isResizing === 'session-list') {
        storage.set(storage.KEYS.sessionListWidth, sessionListWidth)
        setSessionListHandleY(null)
      } else if (isResizing === 'right-sidebar') {
        storage.set(storage.KEYS.rightSidebarWidth, rightSidebarWidth)
        setRightSidebarHandleY(null)
      }
      setIsResizing(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    isResizing,
    sidebarWidth,
    sessionListWidth,
    rightSidebarWidth,
    isSidebarVisible,
  ])

  // Spring transition config - shared between sidebar and header
  // Critical damping (no bounce): damping = 2 * sqrt(stiffness * mass)
  const springTransition = {
    type: 'spring' as const,
    stiffness: 600,
    damping: 49,
  }

  // Use session metadata from Jotai atom (lightweight, no messages)
  // This prevents closures from retaining full message arrays
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)

  // Filter session metadata by active workspace
  const workspaceSessionMetas = useMemo(() => {
    const metas = Array.from(sessionMetaMap.values())
    return activeWorkspaceId
      ? metas.filter((s) => s.workspaceId === activeWorkspaceId)
      : metas
  }, [sessionMetaMap, activeWorkspaceId])

  // Count sessions by todo state (scoped to workspace)
  const _isMetaDone = (s: SessionMeta) =>
    s.todoState === 'done' || s.todoState === 'cancelled'

  // Count sources by type for the Sources dropdown subcategories
  const _sourceTypeCounts = useMemo(() => {
    const counts = { api: 0, mcp: 0, local: 0 }
    for (const source of sources) {
      const t = source.config.type
      if (t === 'api' || t === 'mcp' || t === 'local') {
        counts[t]++
      }
    }
    return counts
  }, [sources])

  // Filter session metadata based on sidebar mode and chat filter
  const filteredSessionMetas = useMemo(() => {
    // When in sources mode, return empty (no sessions to show)
    if (!chatFilter) {
      return []
    }

    let result: SessionMeta[]

    switch (chatFilter.kind) {
      case 'allChats':
        // "All Chats" - shows all sessions
        result = workspaceSessionMetas
        break
      case 'flagged':
        result = workspaceSessionMetas.filter((s) => s.isFlagged)
        break
      case 'state':
        // Filter by specific todo state
        result = workspaceSessionMetas.filter(
          (s) => (s.todoState || 'todo') === chatFilter.stateId,
        )
        break
      case 'label': {
        if (chatFilter.labelId === '__all__') {
          // "Labels" header: show all sessions that have at least one label
          result = workspaceSessionMetas.filter(
            (s) => s.labels && s.labels.length > 0,
          )
        } else {
          // Specific label: includes sessions tagged with this label or any descendant
          const descendants = getDescendantIds(labelConfigs, chatFilter.labelId)
          const matchIds = new Set([chatFilter.labelId, ...descendants])
          result = workspaceSessionMetas.filter((s) =>
            s.labels?.some((l) => matchIds.has(extractLabelId(l))),
          )
        }
        break
      }
      case 'view': {
        // Filter by view: __all__ shows any session matched by any view,
        // otherwise filter to the specific view
        result = workspaceSessionMetas.filter((s) => {
          const matched = evaluateViews(s)
          if (chatFilter.viewId === '__all__') {
            return matched.length > 0
          }
          return matched.some((v) => v.id === chatFilter.viewId)
        })
        break
      }
      default:
        result = workspaceSessionMetas
    }

    // Apply secondary filters in allChats view (status + labels, AND-ed together)
    if (chatFilter.kind === 'allChats') {
      // Filter by status if any statuses are selected
      if (listFilter.size > 0) {
        result = result.filter((s) =>
          listFilter.has((s.todoState || 'todo') as TodoStateId),
        )
      }
      // Filter by labels if any labels are selected (includes descendants)
      if (labelFilter.size > 0) {
        // Expand selected labels to include all descendant IDs
        const matchIds = new Set<string>()
        for (const id of labelFilter) {
          matchIds.add(id)
          const descendants = getDescendantIds(labelConfigs, id)
          for (const d of descendants) matchIds.add(d)
        }
        result = result.filter((s) =>
          s.labels?.some((l) => matchIds.has(extractLabelId(l))),
        )
      }
    }

    return result
  }, [
    workspaceSessionMetas,
    chatFilter,
    listFilter,
    labelFilter,
    labelConfigs,
    evaluateViews,
  ])

  // Ensure session messages are loaded when selected
  React.useEffect(() => {
    if (session.selected) {
      ensureMessagesLoaded(session.selected)
    }
  }, [session.selected, ensureMessagesLoaded])

  // Wrap delete handler to clear selection when deleting the currently selected session
  // This prevents stale state during re-renders that could cause crashes
  const handleDeleteSession = useCallback(
    async (sessionId: string, skipConfirmation?: boolean): Promise<boolean> => {
      // Clear selection first if this is the selected session
      if (session.selected === sessionId) {
        setSession({ selected: null })
      }
      return onDeleteSession(sessionId, skipConfirmation)
    },
    [session.selected, setSession, onDeleteSession],
  )

  // Right sidebar OPEN button (fades out when sidebar is open, hidden in focused mode or non-chat views)
  const rightSidebarOpenButton = React.useMemo(() => {
    if (isFocusedMode || !isChatsNavigation(navState) || !navState.details)
      return null

    return (
      <motion.div
        initial={false}
        animate={{ opacity: isRightSidebarVisible ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        style={{ pointerEvents: isRightSidebarVisible ? 'none' : 'auto' }}
      >
        <HeaderIconButton
          icon={<PanelRightRounded className="h-5 w-6" />}
          onClick={() => setIsRightSidebarVisible(true)}
          tooltip="Open sidebar"
          className="text-foreground"
        />
      </motion.div>
    )
  }, [isFocusedMode, navState, isRightSidebarVisible])

  // Right sidebar CLOSE button (shown in sidebar header when open)
  const rightSidebarCloseButton = React.useMemo(() => {
    if (isFocusedMode || !isRightSidebarVisible) return null

    return (
      <HeaderIconButton
        icon={<PanelLeftRounded className="h-5 w-6" />}
        onClick={() => setIsRightSidebarVisible(false)}
        tooltip="Close sidebar"
        className="text-foreground"
      />
    )
  }, [isFocusedMode, isRightSidebarVisible])

  // Extend context value with local overrides (textareaRef, wrapped onDeleteSession, sources, skills, labels, enabledModes, rightSidebarOpenButton, effectiveTodoStates)
  const appShellContextValue = React.useMemo<AppShellContextType>(
    () => ({
      ...contextValue,
      onDeleteSession: handleDeleteSession,
      textareaRef: chatInputRef,
      enabledSources: sources,
      skills,
      labels: labelConfigs,
      onSessionLabelsChange: handleSessionLabelsChange,
      enabledModes,
      todoStates: effectiveTodoStates,
      onSessionSourcesChange: handleSessionSourcesChange,
      rightSidebarButton: rightSidebarOpenButton,
    }),
    [
      contextValue,
      handleDeleteSession,
      sources,
      skills,
      labelConfigs,
      handleSessionLabelsChange,
      enabledModes,
      effectiveTodoStates,
      handleSessionSourcesChange,
      rightSidebarOpenButton,
    ],
  )

  // Persist expanded folders to localStorage
  React.useEffect(() => {
    storage.set(storage.KEYS.expandedFolders, [...expandedFolders])
  }, [expandedFolders])

  // Persist sidebar visibility to localStorage
  React.useEffect(() => {
    storage.set(storage.KEYS.sidebarVisible, isSidebarVisible)
  }, [isSidebarVisible])

  // Persist right sidebar visibility to localStorage
  React.useEffect(() => {
    storage.set(storage.KEYS.rightSidebarVisible, isRightSidebarVisible)
  }, [isRightSidebarVisible])

  // Persist list filter to localStorage
  React.useEffect(() => {
    storage.set(storage.KEYS.listFilter, [...listFilter])
  }, [listFilter])

  // Persist label filter to localStorage
  React.useEffect(() => {
    storage.set(storage.KEYS.labelFilter, [...labelFilter])
  }, [labelFilter])

  // Persist sidebar section collapsed states
  React.useEffect(() => {
    storage.set(storage.KEYS.collapsedSidebarItems, [...collapsedItems])
  }, [collapsedItems])

  // Handler for individual todo state views
  const handleTodoStateClick = useCallback((stateId: TodoStateId) => {
    navigate(routes.view.state(stateId))
  }, [])

  // Handler for label filter views (hierarchical — includes descendant labels)
  const handleLabelClick = useCallback((labelId: string) => {
    navigate(routes.view.label(labelId))
  }, [])

  const _handleViewClick = useCallback((viewId: string) => {
    navigate(routes.view.view(viewId))
  }, [])

  // Handlers for source type filter views (subcategories in Sources dropdown)
  const _handleSourcesApiClick = useCallback(() => {
    navigate(routes.view.sourcesApi())
  }, [])

  const _handleSourcesMcpClick = useCallback(() => {
    navigate(routes.view.sourcesMcp())
  }, [])

  const _handleSourcesLocalClick = useCallback(() => {
    navigate(routes.view.sourcesLocal())
  }, [])

  // Handler for dashboard view
  const handleDashboardClick = useCallback(() => {
    navigate(routes.view.dashboard())
  }, [])

  // Handler for browser profiles view
  const handleBrowserProfilesClick = useCallback(() => {
    navigate(routes.view.browserProfiles())
  }, [])

  // Handler for proxies view
  const handleProxiesClick = useCallback(() => {
    navigate(routes.view.proxies())
  }, [])

  // Handler for agent view
  const handleAgentClick = useCallback(() => {
    navigate(routes.view.agent())
  }, [])

  // Handler for tasks view
  const handleTasksClick = useCallback(() => {
    navigate(routes.view.tasks())
  }, [])

  // Handler for team management view
  const handleTeamClick = useCallback(
    (
      subpage:
        | 'members'
        | 'roles'
        | 'activity-log'
        | 'org-settings' = 'members',
    ) => {
      navigate(routes.view.team(subpage))
    },
    [],
  )

  // Handler for settings view
  const handleSettingsClick = useCallback(
    (subpage: SettingsSubpage = 'app') => {
      navigate(routes.view.settings(subpage))
    },
    [],
  )

  // ============================================================================
  // EDIT POPOVER STATE
  // ============================================================================
  // State to control which EditPopover is open (triggered from context menus).
  // We use controlled popovers instead of deep links so the user can type
  // their request in the popover UI before opening a new chat window.
  // add-source variants: add-source (generic), add-source-api, add-source-mcp, add-source-local
  const [editPopoverOpen, setEditPopoverOpen] = useState<
    | 'statuses'
    | 'labels'
    | 'views'
    | 'add-source'
    | 'add-source-api'
    | 'add-source-mcp'
    | 'add-source-local'
    | 'add-skill'
    | 'add-label'
    | null
  >(null)

  // Stores the Y position of the last right-clicked sidebar item so the EditPopover
  // appears near it rather than at a fixed location. Updated synchronously before
  // the setTimeout that opens the popover, ensuring the ref is set before render.
  const editPopoverAnchorY = useRef<number>(120)
  // Tracks which label was right-clicked when opening label EditPopovers,
  // so the agent knows the target for commands like "make this red" or "add below this"
  const editLabelTargetId = useRef<string | undefined>(undefined)

  // Stores the trigger element (button) so we can keep it highlighted while the
  // EditPopover is open (after Radix removes data-state="open" on context menu close).
  const editPopoverTriggerRef = useRef<Element | null>(null)

  // Captures the bounding rect of the currently-open context menu trigger (the button).
  // Radix sets data-state="open" on the button (via ContextMenuTrigger asChild)
  // while the menu is visible, so we can locate it in the DOM at click time.
  const captureContextMenuPosition = useCallback(() => {
    const trigger = document.querySelector(
      '.group\\/section > [data-state="open"]',
    )
    if (trigger) {
      const rect = trigger.getBoundingClientRect()
      editPopoverAnchorY.current = rect.top
      editPopoverTriggerRef.current = trigger
    }
  }, [])

  // Sync data-edit-active attribute on the trigger element with EditPopover open state.
  // This keeps the sidebar item visually highlighted while the popover is shown,
  // since Radix's data-state="open" disappears when the context menu closes.
  useEffect(() => {
    const el = editPopoverTriggerRef.current
    if (!el) return
    if (editPopoverOpen) {
      el.setAttribute('data-edit-active', 'true')
    } else {
      el.removeAttribute('data-edit-active')
      editPopoverTriggerRef.current = null
    }
  }, [editPopoverOpen])

  // Handler for "Configure Statuses" context menu action
  // Opens the EditPopover for status configuration
  // Uses setTimeout to delay opening until after context menu closes,
  // preventing the popover from immediately closing due to focus shift
  const openConfigureStatuses = useCallback(() => {
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('statuses'), 50)
  }, [captureContextMenuPosition])

  // Handler for "Configure Labels" context menu action
  // Opens the EditPopover for label configuration, storing which label was right-clicked
  const openConfigureLabels = useCallback(
    (labelId?: string) => {
      editLabelTargetId.current = labelId
      captureContextMenuPosition()
      setTimeout(() => setEditPopoverOpen('labels'), 50)
    },
    [captureContextMenuPosition],
  )

  // Handler for "Edit Views" context menu action
  // Opens the EditPopover for view configuration
  const _openConfigureViews = useCallback(() => {
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('views'), 50)
  }, [captureContextMenuPosition])

  // Handler for "Delete View" context menu action
  // Removes the view from config by filtering it out and saving
  const _handleDeleteView = useCallback(
    async (viewId: string) => {
      if (!activeWorkspace?.id) return
      try {
        const updated = viewConfigs.filter((v) => v.id !== viewId)
        await window.electronAPI.saveViews(activeWorkspace.id, updated)
      } catch (err) {
        console.error('[AppShell] Failed to delete view:', err)
      }
    },
    [activeWorkspace?.id, viewConfigs],
  )

  // Handler for "Add New Label" context menu action
  // Opens the EditPopover with 'add-label' context, storing which label was right-clicked
  // so the agent knows to add the new label relative to it
  const handleAddLabel = useCallback(
    (parentId?: string) => {
      editLabelTargetId.current = parentId
      captureContextMenuPosition()
      setTimeout(() => setEditPopoverOpen('add-label'), 50)
    },
    [captureContextMenuPosition],
  )

  // Handler for "Delete Label" context menu action
  // Deletes the label and all its descendants, stripping from sessions
  const handleDeleteLabel = useCallback(
    async (labelId: string) => {
      if (!activeWorkspace?.id) return
      try {
        await window.electronAPI.deleteLabel(activeWorkspace.id, labelId)
      } catch (err) {
        console.error('[AppShell] Failed to delete label:', err)
      }
    },
    [activeWorkspace?.id],
  )

  // Handler for "Add Source" context menu action
  // Opens the EditPopover for adding a new source
  // Optional sourceType param allows filter-aware context (from subcategory menus or filtered views)
  const openAddSource = useCallback(
    (sourceType?: 'api' | 'mcp' | 'local') => {
      captureContextMenuPosition()
      const key = sourceType
        ? (`add-source-${sourceType}` as const)
        : ('add-source' as const)
      setTimeout(() => setEditPopoverOpen(key), 50)
    },
    [captureContextMenuPosition],
  )

  // Handler for "Add Skill" context menu action
  // Opens the EditPopover for adding a new skill
  const openAddSkill = useCallback(() => {
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('add-skill'), 50)
  }, [captureContextMenuPosition])

  // Create a new chat and select it
  const handleNewChat = useCallback(
    async (_useCurrentAgent: boolean = true) => {
      if (!activeWorkspace) return

      const newSession = await onCreateSession(activeWorkspace.id)
      // Navigate to the new session via central routing
      navigate(routes.view.allChats(newSession.id))
    },
    [activeWorkspace, onCreateSession],
  )

  // Delete Source - simplified since agents system is removed
  const _handleDeleteSource = useCallback(
    async (sourceSlug: string) => {
      if (!activeWorkspace) return
      try {
        await window.electronAPI.deleteSource(activeWorkspace.id, sourceSlug)
        toast.success(`Deleted source`)
      } catch (error) {
        console.error('[Chat] Failed to delete source:', error)
        toast.error('Failed to delete source')
      }
    },
    [activeWorkspace],
  )

  // Delete Skill
  const _handleDeleteSkill = useCallback(
    async (skillSlug: string) => {
      if (!activeWorkspace) return
      try {
        await window.electronAPI.deleteSkill(activeWorkspace.id, skillSlug)
        toast.success(`Deleted skill: ${skillSlug}`)
      } catch (error) {
        console.error('[Chat] Failed to delete skill:', error)
        toast.error('Failed to delete skill')
      }
    },
    [activeWorkspace],
  )

  // Respond to menu bar "New Chat" trigger
  const menuTriggerRef = useRef(menuNewChatTrigger)
  useEffect(() => {
    // Skip initial render
    if (menuTriggerRef.current === menuNewChatTrigger) return
    menuTriggerRef.current = menuNewChatTrigger
    handleNewChat(true)
  }, [menuNewChatTrigger, handleNewChat])

  // Unified sidebar items: nav buttons only (agents system removed)
  type SidebarItem = {
    id: string
    type: 'nav'
    action?: () => void
  }

  const unifiedSidebarItems = React.useMemo((): SidebarItem[] => {
    const result: SidebarItem[] = []

    // 1. Dashboard
    result.push({
      id: 'nav:dashboard',
      type: 'nav',
      action: handleDashboardClick,
    })

    // 2. Profiles, Proxies, Agent, Tasks, Team, Settings
    result.push({
      id: 'nav:browser-profiles',
      type: 'nav',
      action: handleBrowserProfilesClick,
    })
    result.push({
      id: 'nav:proxies',
      type: 'nav',
      action: handleProxiesClick,
    })
    result.push({
      id: 'nav:agent',
      type: 'nav',
      action: handleAgentClick,
    })
    result.push({
      id: 'nav:tasks',
      type: 'nav',
      action: handleTasksClick,
    })
    result.push({
      id: 'nav:team',
      type: 'nav',
      action: () => handleTeamClick('members'),
    })
    result.push({
      id: 'nav:settings',
      type: 'nav',
      action: () => handleSettingsClick('app'),
    })

    return result
  }, [
    handleDashboardClick,
    handleBrowserProfilesClick,
    handleProxiesClick,
    handleAgentClick,
    handleTasksClick,
    handleTeamClick,
    handleSettingsClick,
  ])

  // Toggle folder expanded state
  const _handleToggleFolder = React.useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Get props for any sidebar item (unified roving tabindex pattern)
  const getSidebarItemProps = React.useCallback(
    (id: string) => ({
      tabIndex: focusedSidebarItemId === id ? 0 : -1,
      'data-focused': focusedSidebarItemId === id,
      ref: (el: HTMLElement | null) => {
        if (el) {
          sidebarItemRefs.current.set(id, el)
        } else {
          sidebarItemRefs.current.delete(id)
        }
      },
    }),
    [focusedSidebarItemId],
  )

  // Unified sidebar keyboard navigation
  const handleSidebarKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!sidebarFocused || unifiedSidebarItems.length === 0) return

      const currentIndex = unifiedSidebarItems.findIndex(
        (item) => item.id === focusedSidebarItemId,
      )
      const currentItem =
        currentIndex >= 0 ? unifiedSidebarItems[currentIndex] : null

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const nextIndex =
            currentIndex < unifiedSidebarItems.length - 1 ? currentIndex + 1 : 0
          const nextItem = unifiedSidebarItems[nextIndex]
          setFocusedSidebarItemId(nextItem.id)
          sidebarItemRefs.current.get(nextItem.id)?.focus()
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prevIndex =
            currentIndex > 0 ? currentIndex - 1 : unifiedSidebarItems.length - 1
          const prevItem = unifiedSidebarItems[prevIndex]
          setFocusedSidebarItemId(prevItem.id)
          sidebarItemRefs.current.get(prevItem.id)?.focus()
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          // At boundary - do nothing (Left doesn't change zones from sidebar)
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          // Move to next zone (session list)
          focusZone('session-list')
          break
        }
        case 'Enter':
        case ' ': {
          e.preventDefault()
          if (currentItem?.type === 'nav' && currentItem.action) {
            currentItem.action()
          }
          break
        }
        case 'Home': {
          e.preventDefault()
          if (unifiedSidebarItems.length > 0) {
            const firstItem = unifiedSidebarItems[0]
            setFocusedSidebarItemId(firstItem.id)
            sidebarItemRefs.current.get(firstItem.id)?.focus()
          }
          break
        }
        case 'End': {
          e.preventDefault()
          if (unifiedSidebarItems.length > 0) {
            const lastItem = unifiedSidebarItems[unifiedSidebarItems.length - 1]
            setFocusedSidebarItemId(lastItem.id)
            sidebarItemRefs.current.get(lastItem.id)?.focus()
          }
          break
        }
      }
    },
    [sidebarFocused, unifiedSidebarItems, focusedSidebarItemId, focusZone],
  )

  // Focus sidebar item when sidebar zone gains focus
  React.useEffect(() => {
    if (sidebarFocused && unifiedSidebarItems.length > 0) {
      // Set focused item if not already set
      const itemId = focusedSidebarItemId || unifiedSidebarItems[0].id
      if (!focusedSidebarItemId) {
        setFocusedSidebarItemId(itemId)
      }
      // Actually focus the DOM element
      requestAnimationFrame(() => {
        sidebarItemRefs.current.get(itemId)?.focus()
      })
    }
  }, [sidebarFocused, focusedSidebarItemId, unifiedSidebarItems])

  // Get title based on navigation state
  const listTitle = React.useMemo(() => {
    // Sources navigator
    if (isSourcesNavigation(navState)) {
      return 'Sources'
    }

    // Skills navigator
    if (isSkillsNavigation(navState)) {
      return 'All Skills'
    }

    // Settings navigator
    if (isSettingsNavigation(navState)) return 'Settings'

    // Connectors navigator
    if (isConnectorsNavigation(navState)) return 'Connectors'

    // Team navigator
    if (isTeamNavigation(navState)) return 'Team'

    // Chats navigator - use chatFilter
    if (!chatFilter) return 'Tasks'

    switch (chatFilter.kind) {
      case 'flagged':
        return 'Flagged'
      case 'state': {
        const state = effectiveTodoStates.find(
          (s) => s.id === chatFilter.stateId,
        )
        return state?.label || 'Tasks'
      }
      case 'label':
        return chatFilter.labelId === '__all__'
          ? 'Labels'
          : getLabelDisplayName(labelConfigs, chatFilter.labelId)
      case 'view':
        return chatFilter.viewId === '__all__'
          ? 'Views'
          : viewConfigs.find((v) => v.id === chatFilter.viewId)?.name || 'Views'
      default:
        return 'Tasks'
    }
  }, [navState, chatFilter, effectiveTodoStates, labelConfigs, viewConfigs])

  return (
    <AppShellProvider value={appShellContextValue}>
      <TooltipProvider delayDuration={0}>
        {/*
          Draggable title bar region for transparent window (macOS)
          - Fixed overlay at z-titlebar allows window dragging from the top bar area
          - Interactive elements (buttons, dropdowns) must use:
            1. titlebar-no-drag: prevents drag behavior on clickable elements
            2. relative z-panel: ensures elements render above this drag overlay
        */}
        <div className="titlebar-drag-region fixed top-0 right-0 left-0 z-titlebar h-[50px]" />

        {/* App Menu - fixed position, always visible (hidden in focused mode)
          On macOS: offset 86px to avoid stoplight controls
          On Windows/Linux: offset 12px (no stoplight controls) */}
        {!isFocusedMode &&
          (() => {
            const menuLeftOffset = isMac ? 86 : 12
            return (
              <div
                className="titlebar-no-drag fixed top-0 z-overlay flex h-[50px] items-center pr-2"
                style={{
                  left: menuLeftOffset,
                  width: sidebarWidth - menuLeftOffset,
                }}
              >
                <AppMenu
                  onBack={goBack}
                  onForward={goForward}
                  canGoBack={canGoBack}
                  canGoForward={canGoForward}
                />
              </div>
            )
          })()}

        {/* === OUTER LAYOUT: Sidebar | Main Content === */}
        <div className="relative flex h-full items-stretch">
          {/* === SIDEBAR (Left) === (hidden in focused mode)
            Animated width with spring physics for smooth 60-120fps transitions.
            Uses overflow-hidden to clip content during collapse animation.
            Resizable via drag handle on right edge (200-400px range). */}
          {!isFocusedMode && (
            <motion.div
              initial={false}
              animate={{ width: isSidebarVisible ? sidebarWidth : 0 }}
              transition={isResizing ? { duration: 0 } : springTransition}
              className="relative h-full shrink-0 overflow-hidden"
            >
              <div
                ref={sidebarRef}
                style={{ width: sidebarWidth }}
                className="relative h-full font-sans"
                data-focus-zone="sidebar"
                tabIndex={sidebarFocused ? 0 : -1}
                onKeyDown={handleSidebarKeyDown}
              >
                <div className="flex h-full select-none flex-col pt-[50px]">
                  {/* Sidebar Top Section */}
                  <div className="flex min-h-0 flex-1 flex-col">
                    {/* Logo Row - Brand area with app icon, name, and dropdown menu */}
                    <div className="shrink-0 px-2 pt-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex w-full items-center gap-2 rounded-[6px] px-2 py-[5px] font-medium text-[13px] hover:bg-foreground/5 focus-visible:outline-none">
                            <img
                              src={appIcon}
                              alt=""
                              className="h-5 w-5 rounded-[4px]"
                            />
                            <span className="text-foreground">
                              Craft Agents
                            </span>
                            <ChevronDown className="ml-auto h-3.5 w-3.5 text-foreground/50" />
                          </button>
                        </DropdownMenuTrigger>
                        <AppMenuContent
                          onNewChat={() => handleNewChat(true)}
                          onNewWindow={() => window.electronAPI.menuNewWindow()}
                          onOpenSettings={onOpenSettings}
                          onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
                          onOpenStoredUserPreferences={
                            onOpenStoredUserPreferences
                          }
                        />
                      </DropdownMenu>
                    </div>
                    {/* Organization Switcher */}
                    <div className="shrink-0 px-2">
                      <OrgSwitcher />
                    </div>
                    {/* New Chat Button - Gmail-style, with context menu for "Open in New Window" */}
                    <div className="shrink-0 px-2 pt-1 pb-2">
                      <ContextMenu modal={true}>
                        <ContextMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            onClick={() => handleNewChat(true)}
                            className="w-full justify-start gap-2 rounded-[6px] bg-background px-2 py-[7px] font-normal text-[13px] shadow-minimal"
                            data-tutorial="new-chat-button"
                          >
                            <SquarePenRounded className="h-3.5 w-3.5 shrink-0" />
                            New Task
                          </Button>
                        </ContextMenuTrigger>
                        <StyledContextMenuContent>
                          <ContextMenuProvider>
                            <SidebarMenu type="newChat" />
                          </ContextMenuProvider>
                        </StyledContextMenuContent>
                      </ContextMenu>
                    </div>
                    {/* Primary Nav: Dashboard | Profiles, Proxies, Agent, Tasks, Team | Settings */}
                    <div className="mask-fade-bottom min-h-0 flex-1 overflow-y-auto">
                      <LeftSidebar
                        isCollapsed={false}
                        getItemProps={getSidebarItemProps}
                        focusedItemId={focusedSidebarItemId}
                        links={[
                          // --- Dashboard ---
                          {
                            id: 'nav:dashboard',
                            title: 'Dashboard',
                            icon: LayoutDashboard,
                            variant: isDashboardNavigation(navState)
                              ? 'default'
                              : 'ghost',
                            onClick: handleDashboardClick,
                          },
                          // --- Separator ---
                          { id: 'separator:dashboard-profiles', type: 'separator' },
                          // --- Profiles, Proxies, Agent, Tasks, Team ---
                          {
                            id: 'nav:browser-profiles',
                            title: 'Profiles',
                            icon: MonitorSmartphone,
                            variant: isBrowserProfilesNavigation(navState)
                              ? 'default'
                              : 'ghost',
                            onClick: handleBrowserProfilesClick,
                          },
                          {
                            id: 'nav:proxies',
                            title: 'Proxies',
                            icon: Globe,
                            variant: isProxiesNavigation(navState)
                              ? 'default'
                              : 'ghost',
                            onClick: handleProxiesClick,
                          },
                          {
                            id: 'nav:agent',
                            title: 'Agent',
                            icon: Bot,
                            variant: isAgentNavigation(navState)
                              ? 'default'
                              : 'ghost',
                            onClick: handleAgentClick,
                          },
                          {
                            id: 'nav:tasks',
                            title: 'Tasks',
                            icon: ListTodo,
                            variant: isTasksNavigation(navState)
                              ? 'default'
                              : 'ghost',
                            onClick: handleTasksClick,
                          },
                          {
                            id: 'nav:team',
                            title: 'Team',
                            icon: Users,
                            variant: isTeamNavigation(navState)
                              ? 'default'
                              : 'ghost',
                            onClick: () => handleTeamClick('members'),
                          },
                          // --- Separator ---
                          {
                            id: 'separator:team-settings',
                            type: 'separator',
                          },
                          // --- Settings ---
                          {
                            id: 'nav:settings',
                            title: 'Settings',
                            icon: Settings,
                            variant: isSettingsNavigation(navState)
                              ? 'default'
                              : 'ghost',
                            onClick: () => handleSettingsClick('app'),
                          },
                        ]}
                      />
                      {/* Agent Tree: Hierarchical list of agents */}
                      {/* Agents section removed */}
                    </div>
                  </div>

                  {/* Sidebar Bottom Section: WorkspaceSwitcher + Help icon */}
                  <div className="mt-auto shrink-0 px-2 py-2">
                    <div className="flex items-center gap-1">
                      {/* Workspace switcher takes available space */}
                      <div className="min-w-0 flex-1">
                        <WorkspaceSwitcher
                          isCollapsed={false}
                          workspaces={workspaces}
                          activeWorkspaceId={activeWorkspaceId}
                          onSelect={onSelectWorkspace}
                          onWorkspaceCreated={() => onRefreshWorkspaces?.()}
                        />
                      </div>
                      {/* Help button - icon only with tooltip */}
                      <DropdownMenu>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button className="flex h-7 w-7 select-none items-center justify-center rounded-[6px] outline-none hover:bg-foreground/5 focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-inset">
                                  <HelpCircle className="h-4 w-4 text-foreground/50" />
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Help & Documentation
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <StyledDropdownMenuContent
                          align="end"
                          side="top"
                          sideOffset={8}
                        >
                          <StyledDropdownMenuItem
                            onClick={() =>
                              window.electronAPI.openUrl(getDocUrl('sources'))
                            }
                          >
                            <DatabaseZap className="h-3.5 w-3.5" />
                            <span className="flex-1">Sources</span>
                            <ExternalLink className="h-3 w-3 text-foreground/50" />
                          </StyledDropdownMenuItem>
                          <StyledDropdownMenuItem
                            onClick={() =>
                              window.electronAPI.openUrl(getDocUrl('skills'))
                            }
                          >
                            <Zap className="h-3.5 w-3.5" />
                            <span className="flex-1">Skills</span>
                            <ExternalLink className="h-3 w-3 text-foreground/50" />
                          </StyledDropdownMenuItem>
                          <StyledDropdownMenuItem
                            onClick={() =>
                              window.electronAPI.openUrl(getDocUrl('statuses'))
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="flex-1">Statuses</span>
                            <ExternalLink className="h-3 w-3 text-foreground/50" />
                          </StyledDropdownMenuItem>
                          <StyledDropdownMenuItem
                            onClick={() =>
                              window.electronAPI.openUrl(
                                getDocUrl('permissions'),
                              )
                            }
                          >
                            <Settings className="h-3.5 w-3.5" />
                            <span className="flex-1">Permissions</span>
                            <ExternalLink className="h-3 w-3 text-foreground/50" />
                          </StyledDropdownMenuItem>
                          <StyledDropdownMenuSeparator />
                          <StyledDropdownMenuItem
                            onClick={() =>
                              window.electronAPI.openUrl(
                                'https://agents.craft.do/docs',
                              )
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="flex-1">All Documentation</span>
                          </StyledDropdownMenuItem>
                        </StyledDropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Sidebar Resize Handle (hidden in focused mode) */}
          {!isFocusedMode && (
            <div
              ref={resizeHandleRef}
              onMouseDown={(e) => {
                e.preventDefault()
                setIsResizing('sidebar')
              }}
              onMouseMove={(e) => {
                if (resizeHandleRef.current) {
                  const rect = resizeHandleRef.current.getBoundingClientRect()
                  setSidebarHandleY(e.clientY - rect.top)
                }
              }}
              onMouseLeave={() => {
                if (!isResizing) setSidebarHandleY(null)
              }}
              className="absolute top-0 z-panel flex h-full w-3 cursor-col-resize justify-center"
              style={{
                left: isSidebarVisible ? sidebarWidth - 6 : -6,
                transition:
                  isResizing === 'sidebar' ? undefined : 'left 0.15s ease-out',
              }}
            >
              {/* Visual indicator - 2px wide */}
              <div
                className="h-full w-0.5"
                style={getResizeGradientStyle(sidebarHandleY)}
              />
            </div>
          )}

          {/* === MAIN CONTENT (Right) ===
            Flex layout: Session List | Chat Display */}
          <div
            className="flex h-full min-w-0 flex-1 overflow-hidden"
            style={{
              padding: PANEL_WINDOW_EDGE_SPACING,
              gap: PANEL_PANEL_SPACING / 2,
            }}
          >
            {/* === SESSION LIST PANEL === (hidden when no middle panel) */}
            <AnimatePresence initial={false}>
              {hasMiddlePanel && (
                <motion.div
                  key="session-list-panel"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: sessionListWidth, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="flex h-full min-w-0 shrink-0 flex-col overflow-hidden rounded-[14px] bg-background shadow-middle"
                >
                  <div
                    style={{ width: sessionListWidth }}
                    className="flex h-full min-w-0 flex-col"
                  >
                    <PanelHeader
                      title={isSidebarVisible ? listTitle : undefined}
                      compensateForStoplight={!isSidebarVisible}
                      actions={
                        <>
                          {/* Filter dropdown - allows filtering by flagged, statuses, and labels */}
                          {isChatsNavigation(navState) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <HeaderIconButton
                                  icon={<ListFilter className="h-4 w-4" />}
                                  className={
                                    listFilter.size > 0 || labelFilter.size > 0
                                      ? 'rounded-[8px] bg-foreground/5 text-foreground shadow-tinted'
                                      : 'rounded-[8px]'
                                  }
                                  style={
                                    listFilter.size > 0 || labelFilter.size > 0
                                      ? ({
                                          '--shadow-color': 'var(--accent-rgb)',
                                        } as React.CSSProperties)
                                      : undefined
                                  }
                                />
                              </DropdownMenuTrigger>
                              <StyledDropdownMenuContent
                                align="end"
                                light
                                minWidth="min-w-[200px]"
                              >
                                {/* Header with title and clear button */}
                                <div className="flex items-center justify-between border-border border-b px-2 py-1.5">
                                  <span className="font-medium text-foreground/50 text-xs">
                                    Filter Chats
                                  </span>
                                  {(listFilter.size > 0 ||
                                    labelFilter.size > 0) && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault()
                                        setListFilter(new Set())
                                        setLabelFilter(new Set())
                                      }}
                                      className="text-foreground/50 text-xs hover:text-foreground"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>

                                {/* Selected items at root level - shows active filters with checkmarks for quick visibility */}
                                {(listFilter.size > 0 ||
                                  labelFilter.size > 0) && (
                                  <>
                                    {/* Selected statuses */}
                                    {effectiveTodoStates
                                      .filter((s) => listFilter.has(s.id))
                                      .map((state) => {
                                        const applyColor = state.iconColorable
                                        return (
                                          <StyledDropdownMenuItem
                                            key={`sel-status-${state.id}`}
                                            onClick={(e) => {
                                              e.preventDefault()
                                              setListFilter((prev) => {
                                                const next = new Set(prev)
                                                next.delete(state.id)
                                                return next
                                              })
                                            }}
                                          >
                                            <FilterMenuRow
                                              icon={state.icon}
                                              label={state.label}
                                              accessory={
                                                <Check className="h-3 w-3 text-foreground" />
                                              }
                                              iconStyle={
                                                applyColor
                                                  ? {
                                                      color:
                                                        state.resolvedColor,
                                                    }
                                                  : undefined
                                              }
                                              noIconContainer
                                            />
                                          </StyledDropdownMenuItem>
                                        )
                                      })}
                                    {/* Selected labels */}
                                    {Array.from(labelFilter).map((labelId) => {
                                      const label = findLabelById(
                                        labelConfigs,
                                        labelId,
                                      )
                                      if (!label) return null
                                      return (
                                        <StyledDropdownMenuItem
                                          key={`sel-label-${labelId}`}
                                          onClick={(e) => {
                                            e.preventDefault()
                                            setLabelFilter((prev) => {
                                              const next = new Set(prev)
                                              next.delete(labelId)
                                              return next
                                            })
                                          }}
                                        >
                                          <FilterMenuRow
                                            icon={
                                              <LabelIcon
                                                label={label}
                                                size="sm"
                                              />
                                            }
                                            label={label.name}
                                            accessory={
                                              <Check className="h-3 w-3 text-foreground" />
                                            }
                                          />
                                        </StyledDropdownMenuItem>
                                      )
                                    })}
                                    <StyledDropdownMenuSeparator />
                                  </>
                                )}

                                {/* Flagged - navigate to flagged view */}
                                <StyledDropdownMenuItem
                                  onClick={() =>
                                    navigate(routes.view.flagged())
                                  }
                                >
                                  <Flag className="h-3.5 w-3.5" />
                                  <span className="flex-1">Flagged</span>
                                  {chatFilter?.kind === 'flagged' && (
                                    <Check className="h-3 w-3 text-foreground" />
                                  )}
                                </StyledDropdownMenuItem>
                                <StyledDropdownMenuSeparator />

                                {/* Statuses submenu - all workspace statuses with toggle selection */}
                                <DropdownMenuSub>
                                  <StyledDropdownMenuSubTrigger>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span className="flex-1">Statuses</span>
                                  </StyledDropdownMenuSubTrigger>
                                  <StyledDropdownMenuSubContent minWidth="min-w-[180px]">
                                    {effectiveTodoStates.map((state) => {
                                      const applyColor = state.iconColorable
                                      return (
                                        <StyledDropdownMenuItem
                                          key={state.id}
                                          onClick={(e) => {
                                            e.preventDefault()
                                            setListFilter((prev) => {
                                              const next = new Set(prev)
                                              if (next.has(state.id))
                                                next.delete(state.id)
                                              else next.add(state.id)
                                              return next
                                            })
                                          }}
                                        >
                                          <FilterMenuRow
                                            icon={state.icon}
                                            label={state.label}
                                            accessory={
                                              listFilter.has(state.id) && (
                                                <Check className="h-3 w-3 text-foreground" />
                                              )
                                            }
                                            iconStyle={
                                              applyColor
                                                ? { color: state.resolvedColor }
                                                : undefined
                                            }
                                            noIconContainer
                                          />
                                        </StyledDropdownMenuItem>
                                      )
                                    })}
                                  </StyledDropdownMenuSubContent>
                                </DropdownMenuSub>

                                {/* Labels submenu - full label tree with recursive submenus */}
                                <DropdownMenuSub>
                                  <StyledDropdownMenuSubTrigger>
                                    <Tag className="h-3.5 w-3.5" />
                                    <span className="flex-1">Labels</span>
                                  </StyledDropdownMenuSubTrigger>
                                  <StyledDropdownMenuSubContent minWidth="min-w-[180px]">
                                    {labelConfigs.length === 0 ? (
                                      <StyledDropdownMenuItem disabled>
                                        <span className="text-foreground/50">
                                          No labels configured
                                        </span>
                                      </StyledDropdownMenuItem>
                                    ) : (
                                      <FilterLabelItems
                                        labels={labelConfigs}
                                        labelFilter={labelFilter}
                                        setLabelFilter={setLabelFilter}
                                      />
                                    )}
                                  </StyledDropdownMenuSubContent>
                                </DropdownMenuSub>

                                <StyledDropdownMenuSeparator />
                                <StyledDropdownMenuItem
                                  onClick={() => {
                                    setSearchActive(true)
                                  }}
                                >
                                  <Search className="h-3.5 w-3.5" />
                                  <span className="flex-1">Search</span>
                                </StyledDropdownMenuItem>
                              </StyledDropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      }
                    />
                    {isChatsNavigation(navState) && (
                      /* Sessions List */
                      <>
                        {/* SessionList: Scrollable list of session cards */}
                        {/* Key on sidebarMode forces full remount when switching views, skipping animations */}
                        <SessionList
                          key={chatFilter?.kind}
                          items={filteredSessionMetas}
                          onDelete={handleDeleteSession}
                          onFlag={onFlagSession}
                          onUnflag={onUnflagSession}
                          onMarkUnread={onMarkSessionUnread}
                          onTodoStateChange={onTodoStateChange}
                          onRename={onRenameSession}
                          onFocusChatInput={focusChatInput}
                          onSessionSelect={(selectedMeta) => {
                            // Navigate to the session via central routing (with filter context)
                            if (!chatFilter || chatFilter.kind === 'allChats') {
                              navigate(routes.view.allChats(selectedMeta.id))
                            } else if (chatFilter.kind === 'flagged') {
                              navigate(routes.view.flagged(selectedMeta.id))
                            } else if (chatFilter.kind === 'state') {
                              navigate(
                                routes.view.state(
                                  chatFilter.stateId,
                                  selectedMeta.id,
                                ),
                              )
                            } else if (chatFilter.kind === 'label') {
                              navigate(
                                routes.view.label(
                                  chatFilter.labelId,
                                  selectedMeta.id,
                                ),
                              )
                            } else if (chatFilter.kind === 'view') {
                              navigate(
                                routes.view.view(
                                  chatFilter.viewId,
                                  selectedMeta.id,
                                ),
                              )
                            }
                          }}
                          onOpenInNewWindow={(selectedMeta) => {
                            if (activeWorkspaceId) {
                              window.electronAPI.openSessionInNewWindow(
                                activeWorkspaceId,
                                selectedMeta.id,
                              )
                            }
                          }}
                          onNavigateToView={(view) => {
                            if (view === 'allChats') {
                              navigate(routes.view.allChats())
                            } else if (view === 'flagged') {
                              navigate(routes.view.flagged())
                            }
                          }}
                          sessionOptions={sessionOptions}
                          searchActive={searchActive}
                          searchQuery={searchQuery}
                          onSearchChange={setSearchQuery}
                          onSearchClose={() => {
                            setSearchActive(false)
                            setSearchQuery('')
                          }}
                          todoStates={effectiveTodoStates}
                          evaluateViews={evaluateViews}
                          labels={labelConfigs}
                          onLabelsChange={handleSessionLabelsChange}
                        />
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Session List Resize Handle (hidden when no middle panel) */}
            <AnimatePresence initial={false}>
              {hasMiddlePanel && (
                <motion.div
                  key="session-list-resize-handle"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 0, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="shrink-0"
                >
                  <div
                    ref={sessionListHandleRef}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsResizing('session-list')
                    }}
                    onMouseMove={(e) => {
                      if (sessionListHandleRef.current) {
                        const rect =
                          sessionListHandleRef.current.getBoundingClientRect()
                        setSessionListHandleY(e.clientY - rect.top)
                      }
                    }}
                    onMouseLeave={() => {
                      if (isResizing !== 'session-list')
                        setSessionListHandleY(null)
                    }}
                    className="relative flex h-full w-0 shrink-0 cursor-col-resize justify-center"
                  >
                    {/* Touch area */}
                    <div className="absolute inset-y-0 -right-1.5 -left-1.5 flex cursor-col-resize justify-center">
                      <div
                        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2"
                        style={getResizeGradientStyle(sessionListHandleY)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* === MAIN CONTENT PANEL === */}
            <div
              className={cn(
                'min-w-0 flex-1 overflow-hidden shadow-middle rounded-[14px] bg-background',
                isFocusedMode
                  ? 'rounded-[14px]'
                  : hasMiddlePanel
                    ? isRightSidebarVisible
                      ? 'rounded-r-[10px] rounded-l-[10px]'
                      : 'rounded-r-[14px] rounded-l-[10px]'
                    : 'rounded-[14px]',
              )}
            >
              <MainContentPanel isFocusedMode={isFocusedMode} />
            </div>

            {/* Right Sidebar - Inline Mode (≥ 920px) */}
            {!isFocusedMode && !shouldUseOverlay && (
              <>
                {/* Resize Handle */}
                {isRightSidebarVisible && (
                  <div
                    ref={rightSidebarHandleRef}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsResizing('right-sidebar')
                    }}
                    onMouseMove={(e) => {
                      if (rightSidebarHandleRef.current) {
                        const rect =
                          rightSidebarHandleRef.current.getBoundingClientRect()
                        setRightSidebarHandleY(e.clientY - rect.top)
                      }
                    }}
                    onMouseLeave={() => {
                      if (isResizing !== 'right-sidebar')
                        setRightSidebarHandleY(null)
                    }}
                    className="relative flex h-full w-0 shrink-0 cursor-col-resize justify-center"
                  >
                    {/* Touch area */}
                    <div className="absolute inset-y-0 -right-1.5 -left-1.5 flex cursor-col-resize justify-center">
                      <div
                        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2"
                        style={getResizeGradientStyle(rightSidebarHandleY)}
                      />
                    </div>
                  </div>
                )}

                {/* Inline Sidebar */}
                <motion.div
                  initial={false}
                  animate={{
                    width: isRightSidebarVisible ? rightSidebarWidth : 0,
                    marginLeft: isRightSidebarVisible
                      ? 0
                      : -PANEL_PANEL_SPACING / 2,
                  }}
                  transition={
                    isResizing === 'right-sidebar' || skipRightSidebarAnimation
                      ? { duration: 0 }
                      : springTransition
                  }
                  className="h-full shrink-0 overflow-visible"
                >
                  <motion.div
                    initial={false}
                    animate={{
                      x: isRightSidebarVisible
                        ? 0
                        : rightSidebarWidth + PANEL_PANEL_SPACING / 2,
                      opacity: isRightSidebarVisible ? 1 : 0,
                    }}
                    transition={
                      isResizing === 'right-sidebar' ||
                      skipRightSidebarAnimation
                        ? { duration: 0 }
                        : springTransition
                    }
                    className="h-full rounded-[14px] bg-background shadow-middle"
                    style={{ width: rightSidebarWidth }}
                  >
                    <RightSidebar
                      panel={{ type: 'sessionMetadata' }}
                      sessionId={
                        isChatsNavigation(navState) && navState.details
                          ? navState.details.sessionId
                          : undefined
                      }
                      closeButton={rightSidebarCloseButton}
                    />
                  </motion.div>
                </motion.div>
              </>
            )}

            {/* Right Sidebar - Overlay Mode (< 920px) */}
            {!isFocusedMode && shouldUseOverlay && (
              <AnimatePresence>
                {isRightSidebarVisible && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={
                        skipRightSidebarAnimation
                          ? { duration: 0 }
                          : { duration: 0.2 }
                      }
                      className="fixed inset-0 z-overlay bg-black/25"
                      onClick={() => setIsRightSidebarVisible(false)}
                    />
                    {/* Drawer panel */}
                    <motion.div
                      initial={{ x: 316 }}
                      animate={{ x: 0 }}
                      exit={{ x: 316 }}
                      transition={
                        skipRightSidebarAnimation
                          ? { duration: 0 }
                          : springTransition
                      }
                      className="fixed inset-y-0 right-0 z-overlay h-screen w-[316px] p-1.5"
                    >
                      <div className="h-full overflow-hidden rounded-[12px] bg-background shadow-strong">
                        <RightSidebar
                          panel={{ type: 'sessionMetadata' }}
                          sessionId={
                            isChatsNavigation(navState) && navState.details
                              ? navState.details.sessionId
                              : undefined
                          }
                          closeButton={rightSidebarCloseButton}
                        />
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ============================================================================
         * CONTEXT MENU TRIGGERED EDIT POPOVERS
         * ============================================================================
         * These EditPopovers are opened programmatically from sidebar context menus.
         * They use controlled state (editPopoverOpen) and invisible anchors for positioning.
         * The anchor Y position is captured from the right-clicked item (editPopoverAnchorY ref)
         * so the popover appears near the triggering item rather than at a fixed location.
         * modal={true} prevents auto-close when focus shifts after context menu closes.
         */}
        {activeWorkspace && (
          <>
            {/* Configure Statuses EditPopover - anchored near sidebar */}
            <EditPopover
              open={editPopoverOpen === 'statuses'}
              onOpenChange={(isOpen) =>
                setEditPopoverOpen(isOpen ? 'statuses' : null)
              }
              modal={true}
              trigger={
                <div
                  className="pointer-events-none fixed h-0 w-0"
                  style={{
                    left: sidebarWidth + 20,
                    top: editPopoverAnchorY.current,
                  }}
                  aria-hidden="true"
                />
              }
              side="bottom"
              align="start"
              secondaryAction={{
                label: 'Edit File',
                onClick: () =>
                  window.electronAPI?.openFile(
                    `${activeWorkspace.rootPath}/statuses/config.json`,
                  ),
              }}
              {...getEditConfig('edit-statuses', activeWorkspace.rootPath)}
            />
            {/* Configure Labels EditPopover - anchored near sidebar */}
            <EditPopover
              open={editPopoverOpen === 'labels'}
              onOpenChange={(isOpen) =>
                setEditPopoverOpen(isOpen ? 'labels' : null)
              }
              modal={true}
              trigger={
                <div
                  className="pointer-events-none fixed h-0 w-0"
                  style={{
                    left: sidebarWidth + 20,
                    top: editPopoverAnchorY.current,
                  }}
                  aria-hidden="true"
                />
              }
              side="bottom"
              align="start"
              secondaryAction={{
                label: 'Edit File',
                onClick: () =>
                  window.electronAPI?.openFile(
                    `${activeWorkspace.rootPath}/labels/config.json`,
                  ),
              }}
              {...(() => {
                // Spread base config, override context to include which label was right-clicked
                const config = getEditConfig(
                  'edit-labels',
                  activeWorkspace.rootPath,
                )
                const targetLabel = editLabelTargetId.current
                  ? findLabelById(labelConfigs, editLabelTargetId.current)
                  : undefined
                if (!targetLabel) return config
                return {
                  ...config,
                  context: {
                    ...config.context,
                    context:
                      (config.context.context || '') +
                      ` The user right-clicked on the label "${targetLabel.name}" (id: "${targetLabel.id}"). ` +
                      'If they refer to "this label" or "this", they mean this specific label.',
                  },
                }
              })()}
            />
            {/* Edit Views EditPopover - anchored near sidebar */}
            <EditPopover
              open={editPopoverOpen === 'views'}
              onOpenChange={(isOpen) =>
                setEditPopoverOpen(isOpen ? 'views' : null)
              }
              modal={true}
              trigger={
                <div
                  className="pointer-events-none fixed h-0 w-0"
                  style={{
                    left: sidebarWidth + 20,
                    top: editPopoverAnchorY.current,
                  }}
                  aria-hidden="true"
                />
              }
              side="bottom"
              align="start"
              secondaryAction={{
                label: 'Edit File',
                onClick: () =>
                  window.electronAPI?.openFile(
                    `${activeWorkspace.rootPath}/views.json`,
                  ),
              }}
              {...getEditConfig('edit-views', activeWorkspace.rootPath)}
            />
            {/* Add Source EditPopovers - one for each variant (generic + filter-specific)
             * editPopoverOpen can be: 'add-source', 'add-source-api', 'add-source-mcp', 'add-source-local'
             * Each variant uses its corresponding EditContextKey for filter-aware agent context */}
            {(
              [
                'add-source',
                'add-source-api',
                'add-source-mcp',
                'add-source-local',
              ] as const
            ).map((variant) => (
              <EditPopover
                key={variant}
                open={editPopoverOpen === variant}
                onOpenChange={(isOpen) =>
                  setEditPopoverOpen(isOpen ? variant : null)
                }
                modal={true}
                trigger={
                  <div
                    className="pointer-events-none fixed h-0 w-0"
                    style={{
                      left: sidebarWidth + 20,
                      top: editPopoverAnchorY.current,
                    }}
                    aria-hidden="true"
                  />
                }
                side="bottom"
                align="start"
                {...getEditConfig(variant, activeWorkspace.rootPath)}
              />
            ))}
            {/* Add Skill EditPopover */}
            <EditPopover
              open={editPopoverOpen === 'add-skill'}
              onOpenChange={(isOpen) =>
                setEditPopoverOpen(isOpen ? 'add-skill' : null)
              }
              modal={true}
              trigger={
                <div
                  className="pointer-events-none fixed h-0 w-0"
                  style={{
                    left: sidebarWidth + 20,
                    top: editPopoverAnchorY.current,
                  }}
                  aria-hidden="true"
                />
              }
              side="bottom"
              align="start"
              {...getEditConfig('add-skill', activeWorkspace.rootPath)}
            />
            {/* Add Label EditPopover - triggered from "Add New Label" context menu on labels */}
            <EditPopover
              open={editPopoverOpen === 'add-label'}
              onOpenChange={(isOpen) =>
                setEditPopoverOpen(isOpen ? 'add-label' : null)
              }
              modal={true}
              trigger={
                <div
                  className="pointer-events-none fixed h-0 w-0"
                  style={{
                    left: sidebarWidth + 20,
                    top: editPopoverAnchorY.current,
                  }}
                  aria-hidden="true"
                />
              }
              side="bottom"
              align="start"
              secondaryAction={{
                label: 'Edit File',
                onClick: () =>
                  window.electronAPI?.openFile(
                    `${activeWorkspace.rootPath}/labels/config.json`,
                  ),
              }}
              {...(() => {
                // Spread base config, override context to include which label was right-clicked
                const config = getEditConfig(
                  'add-label',
                  activeWorkspace.rootPath,
                )
                const targetLabel = editLabelTargetId.current
                  ? findLabelById(labelConfigs, editLabelTargetId.current)
                  : undefined
                if (!targetLabel) return config
                return {
                  ...config,
                  context: {
                    ...config.context,
                    context:
                      (config.context.context || '') +
                      ` The user right-clicked on the label "${targetLabel.name}" (id: "${targetLabel.id}"). ` +
                      'The new label should be added as a sibling after this label, or as a child if the user specifies.',
                  },
                }
              })()}
            />
          </>
        )}
      </TooltipProvider>
    </AppShellProvider>
  )
}
