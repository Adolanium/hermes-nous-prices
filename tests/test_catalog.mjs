import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import React, { useMemo, useRef, useState } from 'react'
import { act, create } from 'react-test-renderer'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { atom } from 'nanostores'
import { useStore } from '@nanostores/react'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const settle = () => new Promise(resolve => setTimeout(resolve, 10))
const initialRow = () => ({ slug: 'nous', models: ['work'],
  pricing: { work: { input: '1', output: '2', cache: '0.5' } },
  capabilities: { work: { reasoning: false, fast: false } },
  context_lengths: { work: 131072 }, featured_models: [], unavailable_models: [] })

for (const file of ['plugin.js', 'desktop/plugin.js', 'catalog/desktop/plugin.js']) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  function harness(store = new Map()) {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
    const gateway = {}
    const requests = [], notices = [], results = {}, options = {}
    const state = { row: initialRow(), failure: null }
    const ctx = { storage: { get: (key, fallback) => store.has(key) ? store.get(key) : fallback,
      set: (key, value) => store.set(key, value) } }
    let rendering, root
    const context = vm.createContext({
      ID: 'nous-prices', NOUS: 'nous', CATALOG_STALE_MS: 300000,
      PENDING_REFETCH_ATTEMPTS: 12, PENDING_REFETCH_MS: 1000, PENDING_REFETCH_MAX_MS: 10000,
      atom, useMemo, useRef, useState, useValue: useStore, useQueryClient,
      useQuery: value => { options[rendering] = value; return useQuery(value) },
      usePluginI18n: () => (key, count) => count === undefined ? key : `${key}:${count}`,
      host: { state: { gateway: atom('open') }, getGateway: () => gateway, notify: notice => notices.push(notice) },
      fetchCatalog: async (refresh, _ctx, profile) => {
        requests.push({ refresh, profile })
        if (state.failure) throw state.failure
        return { providers: [structuredClone(state.row)] }
      }
    })
    vm.runInContext(source.slice(source.indexOf('function nousRow('), source.indexOf('function requireModelSave(')), context)
    function Consumer({ name, profile }) {
      rendering = name
      results[name] = context.useCatalog(profile, ctx)
      return null
    }
    const tree = profile => React.createElement(QueryClientProvider, { client },
      React.createElement(Consumer, { name: 'page', profile }),
      React.createElement(Consumer, { name: 'chip', profile }))
    async function change(fn) {
      await act(async () => { await fn() })
      await act(settle)
    }
    return { state, store, requests, notices, results, options, client, change,
      async mount(profile = 'work') { await change(() => { root = create(tree(profile)) }) },
      async profile(profile) { await change(() => root.update(tree(profile))) },
      async close() { if (root) { await act(() => root.unmount()); root = null }; client.clear() },
      refresh() { return change(() => results.page.refreshCatalog()) },
      interval(name) { return options[name].refetchInterval({ state: { data: results[name].catalog.data } }) }
    }
  }

  test(`${file}: manual refresh updates both mounted consumers without splitting the cache`, async t => {
    const h = harness(); t.after(() => h.close()); await h.mount()
    assert.equal(h.requests.length, 1)
    h.state.row.pricing.work.input = '3'
    await h.refresh()
    assert.equal(h.requests.at(-1).refresh, true)
    for (const name of ['page', 'chip']) assert.equal(h.results[name].catalog.data.providers[0].pricing.work.input, '3')
    assert.equal(h.client.getQueryCache().getAll().length, 1)
  })

  test(`${file}: interval and auto refresh changes reach the status bar immediately`, async t => {
    const h = harness(); t.after(() => h.close()); await h.mount()
    await h.change(() => h.results.page.refreshSettings.changeIntervalNum(24))
    await h.change(() => h.results.page.refreshSettings.changeIntervalUnit('hours'))
    assert.equal(h.interval('page'), 86400000)
    assert.equal(h.interval('chip'), 86400000)
    await h.change(() => h.results.page.refreshSettings.changeAuto(false))
    assert.equal(h.interval('page'), false)
    assert.equal(h.interval('chip'), false)
    assert.equal(h.requests.length, 1, 'settings must not create new catalog queries')
    assert.equal(h.client.getQueryCache().getAll().length, 1)
  })

  test(`${file}: refresh disabled still loads saved prices live after restart and resolves pending catalogs`, async t => {
    const first = harness(); await first.mount()
    await first.change(() => first.results.page.refreshSettings.changeAuto(false))
    await first.close()
    const h = harness(first.store); t.after(() => h.close()); await h.mount()
    assert.equal(h.results.page.refreshSettings.autoRefresh, false)
    assert.equal(h.requests.length, 1, 'a persisted snapshot needs an initial live fetch')
    assert.notEqual(h.results.page.catalog.data.providers[0].pricing_pending, true)
    h.state.row.pricing_pending = true
    await h.refresh()
    assert.ok(h.interval('page') > 0, 'pending responses need bounded completion retries even when periodic refresh is off')
    h.state.row.pricing_pending = false
    await h.refresh()
    assert.equal(h.interval('page'), false)
  })

  test(`${file}: settings switch with profiles and survive restart independently`, async t => {
    const h = harness(); t.after(() => h.close()); await h.mount()
    await h.change(() => h.results.page.refreshSettings.changeNotify(false))
    await h.change(() => h.results.page.refreshSettings.changeAuto(false))
    await h.change(() => h.results.page.refreshSettings.changeIntervalNum(24))
    await h.change(() => h.results.page.refreshSettings.changeIntervalUnit('hours'))
    await h.profile('personal')
    for (const name of ['page', 'chip']) {
      const settings = h.results[name].refreshSettings
      assert.equal(settings.notifyChanges, true)
      assert.equal(settings.autoRefresh, true)
      assert.equal(settings.intervalNum, 5)
      assert.equal(settings.intervalUnit, 'minutes')
    }
    await h.change(() => h.results.page.refreshSettings.changeIntervalNum(10))
    await h.profile('work')
    assert.equal(h.results.chip.refreshSettings.intervalNum, 24)
    assert.equal(h.results.chip.refreshSettings.intervalUnit, 'hours')
    assert.equal(h.results.chip.refreshSettings.notifyChanges, false)
    assert.equal(h.results.chip.refreshSettings.autoRefresh, false)
    const restarted = harness(h.store); t.after(() => restarted.close()); await restarted.mount('personal')
    assert.equal(restarted.results.page.refreshSettings.intervalNum, 10)
    assert.equal(restarted.results.page.refreshSettings.notifyChanges, true)
  })

  test(`${file}: notifications track displayed metadata and respect opt-out without replaying missed changes`, async t => {
    const h = harness(); t.after(() => h.close()); await h.mount()
    assert.equal(h.notices.length, 0)
    await h.refresh()
    assert.equal(h.notices.length, 0)
    const changes = [
      row => { row.capabilities.work.reasoning = true },
      row => { row.capabilities.work.fast = true },
      row => { row.featured_models = ['work'] },
      row => { row.unavailable_models = ['work'] },
      row => { row.pricing.work.was_input = '4' },
      row => { row.pricing.work.was_output = '5' },
      row => { row.pricing.work.free = true },
      row => { row.context_lengths.work = 262144 }
    ]
    for (const update of changes) {
      const before = h.notices.length
      update(h.state.row); await h.refresh()
      assert.equal(h.notices.length, before + 1)
      assert.equal(h.notices.at(-1).kind, 'info')
      assert.equal(h.notices.at(-1).message, 'priceChangesMessage:1')
    }
    await h.change(() => h.results.page.refreshSettings.changeNotify(false))
    h.state.row.pricing.work.input = '8'; await h.refresh()
    assert.equal(h.notices.length, changes.length)
    await h.change(() => h.results.page.refreshSettings.changeNotify(true))
    await h.refresh()
    assert.equal(h.notices.length, changes.length)
    h.state.row.pricing.work.input = '9'; await h.refresh()
    assert.equal(h.notices.length, changes.length + 1)
  })
}
