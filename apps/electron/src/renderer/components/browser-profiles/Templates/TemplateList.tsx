/**
 * Template List Component
 *
 * Displays list of profile templates with actions.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ProfileTemplate, BrowserProfileConfig } from '../../../../shared/types';
import { Button } from '@/components/ui/button';
import {
  PlusIcon,
  Loader2Icon,
  Trash2Icon,
  PlayIcon,
  CopyIcon,
} from 'lucide-react';
import { CreateTemplateDialog } from './CreateTemplateDialog';

interface TemplateListProps {
  onProfileCreated?: (profile: BrowserProfileConfig) => void;
}

export function TemplateList({ onProfileCreated }: TemplateListProps) {
  const [templates, setTemplates] = useState<ProfileTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const data = await window.electronAPI.listProfileTemplates();
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handle template created
  const handleTemplateCreated = (template: ProfileTemplate) => {
    setTemplates((prev) => [template, ...prev]);
    setShowCreateDialog(false);
  };

  // Create profile from template
  const handleCreateFromTemplate = async (templateId: string) => {
    setCreatingFromTemplate(templateId);
    try {
      const profile = await window.electronAPI.createProfileFromTemplate(templateId);
      if (onProfileCreated) {
        onProfileCreated(profile);
      }
    } catch (err) {
      console.error('Failed to create profile from template:', err);
    } finally {
      setCreatingFromTemplate(null);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    setDeletingTemplateId(templateId);
    try {
      await window.electronAPI.deleteProfileTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error('Failed to delete template:', err);
    } finally {
      setDeletingTemplateId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">Templates</h2>
          <p className="text-sm text-muted-foreground">
            {templates.length} {templates.length === 1 ? 'template' : 'templates'}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
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
          <div className="text-center py-8 text-muted-foreground">
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
                className="border rounded-lg p-4 hover:border-muted-foreground/30"
              >
                <div className="flex items-start justify-between">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      {template.platform && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-muted">
                          {template.platform}
                        </span>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    )}

                    {/* Details */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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
                            className="px-1.5 py-0.5 text-xs rounded bg-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCreateFromTemplate(template.id)}
                      disabled={creatingFromTemplate === template.id}
                      title="Create profile from template"
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
  );
}
