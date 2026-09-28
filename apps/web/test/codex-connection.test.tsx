import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CodexConnectionForm } from '../src/components/settings/CodexConnectionForm.js'
import { ProviderConfigForm } from '../src/components/settings/ProviderConfigForm.js'
import { mockFetch, pathOf, jsonResponse } from './mock-fetch.js'

const restore: Array<() => void> = []
afterEach(() => { cleanup(); for (const fn of restore.splice(0)) fn() })

it('connects and disconnects the CLI session through typed API calls without a key field', async () => {
  let enabled = false
  const requests: string[] = []
  restore.push(mockFetch((url, init) => {
    const route = pathOf(url); requests.push(`${init?.method ?? 'GET'} ${route}`)
    if (route.endsWith('/connect')) { enabled = true; expect(JSON.parse(String(init?.body))).toEqual({}) }
    if (route.endsWith('/disconnect')) enabled = false
    return jsonResponse({ state: enabled ? 'connected' : 'disconnected', enabled, message: enabled ? 'Connected' : 'Disconnected', model: 'test-model', runtimeVersion: '0.157.1', checkedAt: null, models: [{ id: 'test-model', displayName: 'Test model', tier: 'standard' }] })
  }))
  const onSaved = vi.fn()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ProviderConfigForm providerName="codex" onSaved={onSaved} /></QueryClientProvider>)
  await screen.findByText('Disconnected')
  expect(screen.queryByLabelText(/API key/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Connect existing Codex' }))
  await screen.findByText('Connected')
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))
  expect(requests).toContain('POST /api/v1/settings/providers/codex/connect')
  expect(requests).toContain('POST /api/v1/settings/providers/codex/disconnect')
  expect(requests.some(request => request.includes('logout'))).toBe(false)
})

it('renders the server unavailable state and keeps connection disabled', async () => {
  restore.push(mockFetch(() => jsonResponse({ state: 'unavailable', enabled: false, message: 'Local Canonry required.', model: null, runtimeVersion: null, checkedAt: null, models: [] })))
  render(<QueryClientProvider client={new QueryClient()}><CodexConnectionForm onSaved={() => undefined} /></QueryClientProvider>)
  await screen.findByText('Local Canonry required.')
  expect(screen.getByRole('button', { name: 'Connect existing Codex' }).hasAttribute('disabled')).toBe(true)
})

it('submits an explicitly selected model and identifies the saved-model fallback accurately', async () => {
  const bodies: unknown[] = []
  restore.push(mockFetch((url, init) => {
    if (pathOf(url).endsWith('/connect')) bodies.push(JSON.parse(String(init?.body)))
    return jsonResponse({ state: 'connected', enabled: true, message: 'Connected', model: 'saved-model', runtimeVersion: '0.158.0', checkedAt: null,
      models: [{ id: 'saved-model', displayName: 'Saved model', tier: 'standard' }, { id: 'chosen-model', displayName: 'Chosen model', tier: 'standard' }] })
  }))
  const onSaved = vi.fn()
  render(<QueryClientProvider client={new QueryClient()}><CodexConnectionForm onSaved={onSaved} /></QueryClientProvider>)
  await screen.findByText('Connected')
  expect(screen.getByRole('option', { name: 'Keep the saved model' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Use the CLI default model' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Codex model'), { target: { value: 'chosen-model' } })
  fireEvent.click(screen.getByRole('button', { name: 'Reconnect Codex' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(bodies).toEqual([{ model: 'chosen-model' }])
})
