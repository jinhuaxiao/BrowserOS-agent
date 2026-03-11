import { z } from 'zod'

export const ProtocolRequestSchema = z.object({
  id: z.string(),
  action: z.string().min(1),
  payload: z.any().optional(),
})

export const ProtocolResponseSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
})

export const ActionResponseSchema = z
  .object({
    ok: z.boolean(),
    data: z.any().optional(),
    error: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.ok && data.error !== undefined) return false
      if (!data.ok && !data.error) return false
      return true
    },
    {
      message:
        'When ok is true, error must be undefined. When ok is false, error must be provided.',
    },
  )

export type ProtocolRequest = z.infer<typeof ProtocolRequestSchema>
export type ProtocolResponse = z.infer<typeof ProtocolResponseSchema>
export type ActionResponse = z.infer<typeof ActionResponseSchema>

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}
