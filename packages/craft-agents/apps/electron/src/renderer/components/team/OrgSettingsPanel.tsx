/**
 * OrgSettingsPanel
 *
 * Displays and allows editing of organization settings including name, plan,
 * member/profile limits, and metadata.
 */

import { Building2 } from 'lucide-react'
import * as React from 'react'
import type {
  Organization,
  UpdateOrganizationInput,
} from '../../../shared/types'

interface OrgSettingsPanelProps {
  organization: Organization
  onUpdate: (input: UpdateOrganizationInput) => Promise<void>
  canEdit: boolean
}

export function OrgSettingsPanel({
  organization,
  onUpdate,
  canEdit,
}: OrgSettingsPanelProps) {
  const [name, setName] = React.useState(organization.name)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setName(organization.name)
  }, [organization.name])

  const handleSave = async () => {
    if (name === organization.name) return
    setIsSaving(true)
    try {
      await onUpdate({ name })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-base">Organization Settings</h2>
          </div>
        </div>

        <div>
          <label className="mb-1 block font-medium text-sm">
            Organization Name
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                className="flex-1 rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-sm focus:border-foreground/30 focus:outline-none disabled:opacity-50"
              />
              {canEdit && name !== organization.name && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-md bg-foreground px-3 py-2 font-medium text-background text-sm disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </label>
        </div>

        <div>
          <span className="mb-1 block font-medium text-sm">Plan</span>
          <span className="inline-block rounded-full bg-foreground/10 px-3 py-1 text-sm capitalize">
            {organization.plan}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="mb-1 block font-medium text-sm">Max Members</span>
            <span className="text-muted-foreground text-sm">
              {organization.maxMembers}
            </span>
          </div>
          <div>
            <span className="mb-1 block font-medium text-sm">Max Profiles</span>
            <span className="text-muted-foreground text-sm">
              {organization.maxProfiles}
            </span>
          </div>
        </div>

        <div>
          <span className="mb-1 block font-medium text-sm">
            Organization ID
          </span>
          <code className="rounded bg-foreground/5 px-2 py-1 text-muted-foreground text-xs">
            {organization.id}
          </code>
        </div>

        <div>
          <span className="mb-1 block font-medium text-sm">Created</span>
          <span className="text-muted-foreground text-sm">
            {new Date(organization.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
