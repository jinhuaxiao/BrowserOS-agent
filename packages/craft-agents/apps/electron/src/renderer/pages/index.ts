/**
 * Pages Index
 *
 * Export all page components for use in MainContentPanel.
 */

// Main pages
export { default as DashboardPage } from './DashboardPage'
export { default as ProxiesPage } from './ProxiesPage'
export { default as AgentPage } from './AgentPage'

// Settings pages
export {
  SettingsNavigator,
  AppSettingsPage,
  WorkspaceSettingsPage,
  PermissionsSettingsPage,
  LabelsSettingsPage,
  ShortcutsPage,
  PreferencesPage,
} from './settings'
