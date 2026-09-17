import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

for (const file of ['plugin.js', 'desktop/plugin.js', 'catalog/desktop/plugin.js']) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  test(`${file}: context sort puts largest models first and unknown sizes last`, () => {
    const context = vm.createContext({})
    vm.runInContext(source.slice(source.indexOf('const SORTS ='), source.indexOf('const fold =')), context)
    const sorter = vm.runInContext("SORTS['context-desc']", context)
    const entries = [
      { id: 'unknown', contextLength: null }, { id: 'small', contextLength: 8192 },
      { id: 'large-b', contextLength: 1048576 }, { id: 'large-a', contextLength: 1048576 }
    ]
    assert.deepEqual(entries.sort(sorter).map(row => row.id), ['large-a', 'large-b', 'small', 'unknown'])
  })
  test(`${file}: catalog context reaches model rows and details`, () => {
    const element = (type, props) => ({ type: typeof type === 'function' ? type.name : type, ...props })
    const context = vm.createContext({
      ID: 'nous-prices', labKey: () => 'nous', labLabel: () => 'Nous',
      jsx: element, jsxs: element, usePluginI18n: () => key => key,
      Button() {}, GlyphSpinner() {}, CopyButton() {}, CapChips() {}, PriceTag() {},
      icons: { ChevronRight() {} }, useMemo: fn => fn(),
      currentModelId: () => '', catalog: { data: {} },
      row: { models: ['work', 'large', 'missing'], pricing: {},
        context_lengths: { work: 131072, large: 1048576 } },
    })
    vm.runInContext(source.slice(source.indexOf('function priceNumber('), source.indexOf('const CATEGORIES')), context)
    vm.runInContext(source.slice(source.indexOf('function Cell('), source.indexOf('function LabGroup(')), context)
    vm.runInContext(source.slice(source.indexOf('  const entries = useMemo('), source.indexOf('  const pricingPending =')), context)
    for (const [index, label, exact] of [[0, '128K', 131072], [1, '1M', 1048576], [2, '—', null]]) {
      const model = vm.runInContext(`entries[${index}]`, context)
      const detail = context.ModelDetail({ m: model })
      const cell = detail.children[0].children.find(child => child.label === 'context')
      assert.equal(cell?.value, label)
      assert.equal(model.contextLength, exact)
      const row = context.ModelRow({ m: model })
      const contextLabel = row.children[0].children[0].children.find(child => child?.className === 'np-context')
      assert.equal(contextLabel?.children, label)
      if (exact) assert.match(contextLabel.title, new RegExp(String(exact)))
    }
  })
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
    test(`${file}: managed packages have no updater UI or file-replacement helpers`, () => {
      for (const symbol of ['createDesktopUpdater', 'desktopUpdater', 'UPDATE_KEY', 'Check for updates', 'Restore previous version', 'releases/latest']) {
        assert.ok(!source.includes(symbol), `unexpected self-update code: ${symbol}`)
      }
    })
  }
}
