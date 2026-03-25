/**
 * Template List Component
 *
 * Displays list of profile templates with actions.
 */

import {
  CopyIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  BrowserProfileConfig,
  ProfileTemplate,
} from '../../../../shared/types'
import { CreateTemplateDialog } from './CreateTemplateDialog'

interface TemplateListProps {
  onProfileCreated?: (profile: BrowserProfileConfig) => void
}

export function TemplateList({ onProfileCreated }: TemplateListProps) {
  const [templates, setTemplates] = useState<ProfileTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<
    string | null
  >(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const data = await window.electronAPI.listProfileTemplates()
      setTemplates(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Handle template created
  const handleTemplateCreated = (template: ProfileTemplate) => {
    setTemplates((prev) => [template, ...prev])
    setShowCreateDialog(false)
  }

  // Create profile from template
  const handleCreateFromTemplate = async (templateId: string) => {
    setCreatingFromTemplate(templateId)
    try {
      const profile =
        await window.electronAPI.createProfileFromTemplate(templateId)
      if (onProfileCreated) {
        onProfileCreated(profile)
      }
    } catch (err) {
      console.error('Failed to create profile from template:', err)
    } finally {
      setCreatingFromTemplate(null)
    }
  }

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    setDeletingTemplateId(templateId)
    try {
      await window.electronAPI.deleteProfileTemplate(templateId)
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
    } catch (err) {
      console.error('Failed to delete template:', err)
    } finally {
      setDeletingTemplateId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2Icon className="w-6 h-6 animate-spin text-foreground/50" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-serif font-medium text-foreground">
            Templates
          </h2>
          <p className="text-sm text-foreground/50">
            {templates.length}{' '}
            {templates.length === 1 ? 'template' : 'templates'}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          New Template
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 text-sm text-red-500 p-2 bg-red-500/10 rounded">
          {error}
        </div>
      )}

      {/* Template List */}
      <div className="flex-1 overflow-y-auto p-4">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-foreground/50">
            <p>No templates yet</p>
            <p className="text-sm mt-1">
              Create templates for quick profile creation
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="border border-border rounded-xl bg-card p-5 shadow-minimal hover:border-foreground/20 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-medium text-lg text-foreground">
                        {template.name}
                      </span>
                      {template.platform && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-foreground/5 text-foreground/50">
                          {template.platform}
                        </span>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-sm text-foreground/60 mt-1">
                        {template.description}
                      </p>
                    )}

                    {/* Details */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-foreground/50 font-mono">
                      {template.targetPlatform && (
                        <span>{template.targetPlatform}</span>
                      )}
                      {template.targetRegion && (
                        <span>{template.targetRegion.toUpperCase()}</span>
                      )}
                      {template.proxyId && <span>Has proxy</span>}
                      {template.startupUrl && <span>Has startup URL</span>}
                    </div>

                    {/* Tags */}
                    {template.tags && template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs rounded-full border border-border bg-foreground/5 text-foreground/50"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCreateFromTemplate(template.id)}
                      disabled={creatingFromTemplate === template.id}
                      title="Create profile from template"
                      className="text-foreground hover:bg-foreground/10 hover:text-foreground"
                    >
                      {creatingFromTemplate === template.id ? (
                        <Loader2Icon className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlayIcon className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                      disabled={deletingTemplateId === template.id}
                      title="Delete template"
                      className="text-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                    >
                      {deletingTemplateId === template.id ? (
                        <Loader2Icon className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2Icon className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create template dialog */}
      {showCreateDialog && (
        <CreateTemplateDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleTemplateCreated}
        />
      )}
    </div>
  )
}
