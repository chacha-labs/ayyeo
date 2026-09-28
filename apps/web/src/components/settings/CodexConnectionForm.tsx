import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiV1SettingsProvidersCodexStatusOptions } from '@ainyc/canonry-api-client/react-query'
import { postApiV1SettingsProvidersCodexConnect, postApiV1SettingsProvidersCodexRefresh, postApiV1SettingsProvidersCodexDisconnect } from '@ainyc/canonry-api-client'
import { CodexConnectionStates, describeError } from '@ainyc/canonry-contracts'
import { heyClient } from '../../api.js'
import { Button } from '../ui/button.js'

export function CodexConnectionForm({ leadingField, secondaryActions, onSaved }: { leadingField?: ReactNode; secondaryActions?: ReactNode; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const status = useQuery(getApiV1SettingsProvidersCodexStatusOptions({ client: heyClient }))
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function act(action: 'connect' | 'refresh' | 'disconnect') {
    setBusy(true); setError(null)
    try {
      if (action === 'connect') await postApiV1SettingsProvidersCodexConnect({ client: heyClient, body: model ? { model } : {}, throwOnError: true })
      else if (action === 'refresh') await postApiV1SettingsProvidersCodexRefresh({ client: heyClient, body: {}, throwOnError: true })
      else await postApiV1SettingsProvidersCodexDisconnect({ client: heyClient, body: {}, throwOnError: true })
      await queryClient.invalidateQueries()
      if (action !== 'refresh') onSaved()
    } catch (caught) { setError(describeError(caught)) }
    finally { setBusy(false) }
  }
  const unavailable = status.data?.state === CodexConnectionStates.unavailable
  return <div className="mt-3 space-y-3">
    {leadingField}
    <p className="text-sm text-secondary" role="status">{status.data?.message ?? (status.isPending ? 'Checking Codex connection…' : 'Could not read the Codex connection.')}</p>
    <p className="text-sm text-secondary">Uses the Codex CLI subscription on the machine running Canonry. Sign in there with <code>codex login</code>, then connect here. Select Codex explicitly in your project or run to use it.</p>
    {status.data?.models.length ? <div className="space-y-1">
      <label htmlFor="codex-model" className="block text-sm text-secondary">Codex model</label>
      <select id="codex-model" className="setup-input" value={model || status.data.model || ''} onChange={event => setModel(event.target.value)} disabled={busy}>
        <option value="">{status.data.model ? 'Keep the saved model' : 'Use the CLI default model'}</option>
        {status.data.models.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
      </select>
    </div> : null}
    {(error || status.isError) && <p role="alert" className="text-sm text-negative">{error ?? describeError(status.error)}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy || status.isPending || unavailable} onClick={() => { void act('connect') }}>{busy ? 'Working…' : status.data?.enabled ? 'Reconnect Codex' : 'Connect existing Codex'}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => { void act('refresh') }}>Check again</Button>
      {status.data?.enabled && <Button type="button" variant="outline" disabled={busy} onClick={() => { void act('disconnect') }}>Disconnect</Button>}
      {secondaryActions}
    </div>
    <p className="text-sm text-secondary">Disconnecting here leaves your Codex CLI signed in. Usage shares your subscription allowance.</p>
  </div>
}
