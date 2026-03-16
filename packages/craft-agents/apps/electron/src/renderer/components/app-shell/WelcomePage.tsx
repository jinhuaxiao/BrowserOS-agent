import { useAtomValue } from 'jotai'
import * as React from 'react'
import { skillsAtom } from '@/atoms/skills'
import { sourcesAtom } from '@/atoms/sources'
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import type { FileAttachment } from '../../../shared/types'
import { FreeFormInput } from './input/FreeFormInput'

export function WelcomePage() {
  const { currentModel, onModelChange, enabledSources, skills, labels } =
    useAppShellContext()
  const sourcesFromAtom = useAtomValue(sourcesAtom)
  const skillsFromAtom = useAtomValue(skillsAtom)
  const sources = enabledSources ?? sourcesFromAtom
  const allSkills = skills ?? skillsFromAtom

  const handleSubmit = React.useCallback(
    (
      message: string,
      _attachments?: FileAttachment[],
      _skillSlugs?: string[],
    ) => {
      if (!message.trim()) return
      navigate(routes.action.newChat({ input: message, send: true }))
    },
    [],
  )

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="font-semibold text-2xl text-foreground">
          Your agent, ready to work.
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          What should we work on next?
        </p>
      </div>

      <div className="w-full max-w-[560px]">
        <FreeFormInput
          placeholder="Describe a task..."
          currentModel={currentModel}
          onModelChange={onModelChange}
          sources={sources}
          skills={allSkills}
          labels={labels}
          isEmptySession={true}
          onSubmit={handleSubmit}
          onStop={() => {}}
        />
      </div>
    </div>
  )
}
