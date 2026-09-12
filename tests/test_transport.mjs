import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

for (const file of ['plugin.js', 'desktop/plugin.js', 'catalog/desktop/plugin.js']) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  function harness() {
    const calls = []
    const gateway = { request: async (...args) => { calls.push(args); return { rpc: true } } }
    const active = { gateway, profile: 'work' }
    const host = { getGateway: () => active.gateway, state: { profile: { get: () => active.profile } } }
    const context = vm.createContext({ host, URLSearchParams })
    vm.runInContext(source.slice(source.indexOf('async function companionRequest('), source.indexOf('function nousRow(')), context)
    return { ...context, active, gateway, calls }
  }

  test(`${file}: REST forwards catalog flags and billing profile`, async () => {
    const h = harness()
    const requests = []
    const ctx = { rest: async (...args) => { requests.push(args); return { rest: true } } }
    assert.equal((await h.fetchCatalog(true, ctx, 'work', h.gateway)).rest, true)
    assert.equal((await h.fetchBilling(ctx, 'work', h.gateway)).rest, true)
    assert.equal(requests[0][0], '/catalog?include_unconfigured=true&profile=work&refresh=true')
    assert.equal(requests[1][0], '/billing?profile=work')
    assert.equal(requests[0][1].timeoutMs, 30000)
    assert.equal(h.calls.length, 0)
  })

  for (const message of [null, '404: {"detail":"Not Found"}', "Error invoking remote method 'hermes:api': Error: 404: {\"detail\":\"Not Found\"}"]) {
    test(`${file}: standalone RPC fallback (${message || 'older SDK'})`, async () => {
      const h = harness()
      const ctx = message ? { rest: async () => { throw new Error(message) } } : {}
      assert.equal((await h.fetchCatalog(true, ctx, 'work', h.gateway)).rpc, true)
      assert.equal((await h.fetchBilling(ctx, 'work', h.gateway)).rpc, true)
      assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [
        ['model.options', { include_unconfigured: true, refresh: true, profile: 'work' }],
        ['billing.state', { profile: 'work' }]
      ])
    })
  }

  for (const message of ['401: unauthorized', '403: forbidden', '404: {"detail":"Profile not found"}', '502: unavailable', 'request timed out']) {
    test(`${file}: preserves ${message}`, async () => {
      const h = harness()
      const error = new Error(message)
      await assert.rejects(h.fetchCatalog(false, { rest: async () => { throw error } }, 'work', h.gateway), e => e === error)
      assert.equal(h.calls.length, 0)
    })
  }

  for (const change of ['profile', 'gateway']) {
    test(`${file}: no RPC fallback after ${change} switches during REST`, async () => {
      const h = harness()
      const ctx = { rest: async () => {
        h.active[change] = change === 'profile' ? 'other' : {}
        throw new Error('404: {"detail":"Not Found"}')
      } }
      await assert.rejects(h.fetchBilling(ctx, 'work', h.gateway), /connection changed/)
      assert.equal(h.calls.length, 0)
    })
  }

  if (file !== 'plugin.js') {
    test(`${file}: every updater action defers to Hermes without file or network access`, async () => {
      const start = source.indexOf('  async function run() {')
      const code = source.slice(start, source.indexOf('  function register(ctx) {', start))
      assert.ok(start > 0)
      let shown
      const context = vm.createContext({ patch: value => { shown = value } })
      vm.runInContext(code, context)
      for (const action of ['check', 'install', 'restore', 'restore-confirm']) {
        await context.run(action)
        assert.match(shown.message, /hermes plugins update nous-prices/)
        assert.equal(shown.busy, false)
      }
    })
  }
}
