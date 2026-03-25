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
    <div className="flex h-full flex-col items-center justify-center gap-10 px-4">
      <div className="text-center">
        <h1 className="font-serif font-medium text-[40px] text-foreground tracking-tight">
          Let's knock something off your list
        </h1>
        <p className="mt-4 text-foreground/50 text-base">
          What can I help you with today?
        </p>
      </div>

      <div className="w-full max-w-[640px]">
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
