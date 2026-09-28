import { z } from 'zod'
import { ProviderNames } from './provider.js'

export const codexConnectionStateSchema = z.enum(['unavailable', 'disconnected', 'connected', 'signed-out', 'wrong-auth', 'account-changed', 'error'])
export const CodexConnectionStates = codexConnectionStateSchema.enum
export const codexStatusDtoSchema = z.object({
  state: codexConnectionStateSchema,
  enabled: z.boolean(),
  message: z.string(),
  model: z.string().nullable(),
  runtimeVersion: z.string().nullable(),
  checkedAt: z.string().nullable(),
  models: z.array(z.object({ id: z.string(), displayName: z.string(), tier: z.enum(['flagship', 'standard', 'fast', 'economy']) })),
})
export type CodexStatusDto = z.infer<typeof codexStatusDtoSchema>
export const codexConnectRequestSchema = z.object({ model: z.string().trim().min(1).optional() }).strict()
export type CodexConnectRequest = z.infer<typeof codexConnectRequestSchema>

/** Subscription-backed Codex must never be enrolled by an implicit provider selection. */
export function isImplicitProvider(name: string): boolean {
  return name !== ProviderNames.codex
}
