/**
 * Nous Portal Pricing — a Nous Portal pricing browser as a standalone disk plugin.
 * One page route (/nous-prices) + sidebar row + palette command + keybind +
 * a statusbar price chip for the profile's default model.
 *
 * Data comes from the same `model.options` gateway RPC the model pickers use,
 * to use the app's pricing, sale, entitlement and capability data.
 * `billing.state` adds the account strip when signed in.
 */

import {
  atom,
  Button,
  Codicon,
  CopyButton,
  EmptyState,
  ErrorState,
  GlyphSpinner,
  host,
  icons,
  KEYBINDS_AREA,
  PALETTE_AREA,
  ROUTES_AREA,
  SearchField,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SIDEBAR_NAV_AREA,
  STATUSBAR_AREAS,
  surfaceModelSwitchConfirm,
  Tip,
  usePluginI18n,
  useQuery,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const VERSION = '0.1.1'
const ID = 'nous-prices'
const PATH = '/nous-prices'
const NOUS = 'nous'
const PORTAL_HOME = 'https://portal.nousresearch.com'
const PENDING_REFETCH_MS = 3000
const PENDING_REFETCH_MAX_MS = 15000
const PENDING_REFETCH_ATTEMPTS = 12
const CATALOG_STALE_MS = 300000
const BILLING_REFETCH_MS = 30000

const EN = {
  nav: 'Nous Pricing',
  command: 'Nous Portal Pricing: open model pricing',
  title: 'Nous Portal Pricing',
  subtitle: 'Every model on the portal, with live prices.',
  search: 'Search models…',
  hint1: 'Try "hermes"',
  hint2: 'Try "deepseek"',
  all: 'All',
  featured: 'Featured',
  free: 'Free',
  sale: 'On sale',
  reasoning: 'Reasoning',
  fast: 'Fast',
  allLabs: 'All labs',
  recommended: 'Recommended',
  priceAsc: 'Input price · low to high',
  priceDesc: 'Input price · high to low',
  outputPriceAsc: 'Output price · low to high',
  outputPriceDesc: 'Output price · high to low',
  contextDesc: 'Context size · largest first',
  priceChangesTitle: 'Pricing updated',
  priceChangesMessage: n => `${n} model${n === 1 ? '' : 's'} changed`,
  autoRefresh: 'Auto refresh',
  refreshInterval: 'Refresh interval',
  minutes: 'minutes',
  hours: 'hours',
  notify: 'Notify',
  toggleOn: 'On',
  toggleOff: 'Off',
  byName: 'Name',
  byDiscount: 'Biggest sale',
  refresh: 'Refresh prices',
  openPortal: 'Open portal',
  managePlan: 'Manage plan',
  models: n => `${n} models`,
  freeCount: n => `${n} free`,
  saleCount: n => `${n} on sale`,
  freeBadge: 'Free',
  proBadge: 'Pro',
  current: 'Current',
  locked: 'Paid plan required',
  input: 'Input',
  output: 'Output',
  cached: 'Cached read',
  context: 'Context',
  tokens: 'tokens',
  perMtok: 'per Mtok',
  listPrice: 'List price',
  off: n => `${n}% off`,
  setDefault: 'Set as default',
  confirm: 'Set anyway',
  defaultSet: 'Default model updated',
  defaultSetDetail: m => `${m} · applies to new chats on this profile`,
  setFailed: 'Could not update the default model',
  copyId: 'Copy model id',
  signInTitle: 'Nous Portal is not connected',
  signInDetail: 'Sign in from Settings to load live catalog prices and your plan.',
  loadFailed: 'Model pricing could not be loaded',
  refreshFailed: 'Could not refresh prices. Showing the last loaded prices.',
  billingFailed: 'Could not refresh your balance. Showing the last loaded balance.',
  priceLegend: 'Input / output · USD per million tokens',
  defaultPrice: 'Profile default price',
  savedPrices: date => `Saved prices from ${date}. Live prices may differ.`,
  checkingAvailability: 'Checking availability',
  retry: 'Try again',
  emptyTitle: 'No models match',
  emptyDetail: 'Try a different search, category, or lab.',
  pendingTitle: 'Fetching live prices…',
  pendingDetail: 'The portal catalog is loading. Prices fill in shortly.',
  freeTierNote: n => `${n} models on this page need a paid plan`,
  spendable: 'spendable',
  renews: w => `renews ${w}`,
  topup: 'top-up credit',
  planLeft: (left, total) => `${left} of ${total} left`,
  capabilities: 'Capabilities',
  status: 'Status',
  lab: 'Lab',
  modelId: 'Model id',
  available: 'Available',
  currentDefault: 'Current default',
  tierLocked: 'Locked on the free tier',
  chipNew: 'New',
  chipReasoning: 'Reasoning',
  chipFast: 'Fast',
  otherLab: 'Other',
  statusbarTip: m => `Nous Portal profile default · ${m} · input / output, USD per million tokens`,
  collapse: 'Collapse section',
  expand: 'Expand section'
}

const LOCALES = {
  en: EN,
  ja: { ...EN,
    nav: 'Nous 価格', command: 'Nous Portal Pricing: モデル価格を開く', subtitle: 'ポータルの全モデルと最新価格。',
    search: 'モデルを検索…', hint1: '「hermes」で検索', hint2: '「deepseek」で検索',
    all: 'すべて', featured: '注目', free: '無料', sale: 'セール中', reasoning: '推論', fast: '高速',
    allLabs: 'すべてのラボ', recommended: 'おすすめ順', priceAsc: '価格・安い順', priceDesc: '価格・高い順',
    byName: '名前', byDiscount: '割引率順', outputPriceAsc: '出力価格・安い順', outputPriceDesc: '出力価格・高い順', refresh: '価格を更新', openPortal: 'ポータルを開く',
    managePlan: 'プランを管理', models: n => `${n} モデル`, freeCount: n => `${n} 件無料`,
    saleCount: n => `${n} 件セール中`, freeBadge: '無料', proBadge: 'Pro',
    current: '現在', locked: '有料プランが必要', input: '入力', output: '出力',
    cached: 'キャッシュ読み取り', perMtok: '/100万トークン', listPrice: '定価', off: n => `${n}% オフ`,
    setDefault: 'デフォルトに設定', confirm: 'それでも設定',
    defaultSet: 'デフォルトモデルを更新しました', defaultSetDetail: m => `${m} · このプロファイルの新しいチャットに適用`,
    setFailed: 'デフォルトモデルを更新できませんでした', copyId: 'モデル ID をコピー',
    signInTitle: 'Nous Portal に接続されていません', signInDetail: '設定からサインインすると最新の価格とプランが読み込まれます。',
    loadFailed: 'モデル価格を読み込めませんでした', retry: '再試行', emptyTitle: '一致するモデルがありません',
    emptyDetail: '検索・カテゴリ・ラボを変えてみてください。', pendingTitle: '最新価格を取得中…',
    pendingDetail: 'ポータルのカタログを読み込んでいます。まもなく価格が表示されます。',
    freeTierNote: n => `このアカウントでは ${n} モデルに有料プランが必要`, spendable: '利用可能額',
    renews: w => `${w} に更新`, topup: 'チャージ残高', planLeft: (l, t) => `${t} 中 ${l} 残り`,
    capabilities: '機能', status: '状態', lab: 'ラボ', modelId: 'モデル ID',
    available: '利用可能', currentDefault: '現在のデフォルト', tierLocked: '無料枠ではロック中',
    chipNew: '新着', chipReasoning: '推論', chipFast: '高速', otherLab: 'その他',
    refreshFailed: '価格を更新できませんでした。前回取得した価格を表示しています。',
    billingFailed: '残高を更新できませんでした。前回取得した残高を表示しています。',
    priceLegend: '入力 / 出力 · 100万トークンあたり USD', defaultPrice: 'プロファイルのデフォルト価格',
    savedPrices: date => `${date} に保存した価格です。最新の価格とは異なる場合があります。`,
    checkingAvailability: '利用可否を確認中',
    statusbarTip: m => `Nous Portal プロファイルのデフォルト · ${m} · 入力 / 出力、100万トークンあたり USD`, collapse: 'セクションを折りたたむ', expand: 'セクションを展開' },
  zh: { ...EN,
    nav: 'Nous 价格', command: 'Nous Portal Pricing: 打开模型价格', subtitle: 'Portal 上的每个模型，含实时价格。',
    search: '搜索模型…', hint1: '试试 "hermes"', hint2: '试试 "deepseek"',
    all: '全部', featured: '精选', free: '免费', sale: '促销', reasoning: '推理', fast: '快速',
    allLabs: '全部实验室', recommended: '推荐排序', priceAsc: '价格 · 从低到高', priceDesc: '价格 · 从高到低',
    byName: '名称', byDiscount: '最大折扣', outputPriceAsc: '输出价格 · 从低到高', outputPriceDesc: '输出价格 · 从高到低', refresh: '刷新价格', openPortal: '打开 Portal',
    managePlan: '管理订阅', models: n => `${n} 个模型`, freeCount: n => `${n} 个免费`,
    saleCount: n => `${n} 个促销`, freeBadge: '免费', proBadge: 'Pro',
    current: '当前', locked: '需要付费方案', input: '输入', output: '输出',
    cached: '缓存读取', perMtok: '每百万 token', listPrice: '原价', off: n => `优惠 ${n}%`,
    setDefault: '设为默认', confirm: '仍然设置',
    defaultSet: '默认模型已更新', defaultSetDetail: m => `${m} · 应用于此配置的新会话`,
    setFailed: '无法更新默认模型', copyId: '复制模型 ID',
    signInTitle: '尚未连接 Nous Portal', signInDetail: '在设置中登录即可加载实时目录价格和你的方案。',
    loadFailed: '无法加载模型价格', retry: '重试', emptyTitle: '没有匹配的模型',
    emptyDetail: '换个搜索词、分类或实验室试试。', pendingTitle: '正在获取实时价格…',
    pendingDetail: '正在加载 Portal 目录，价格稍后显示。',
    freeTierNote: n => `此账户上有 ${n} 个模型需要付费方案`, spendable: '可用额度',
    renews: w => `${w} 续期`, topup: '充值余额', planLeft: (l, t) => `${t} 中剩余 ${l}`,
    capabilities: '能力', status: '状态', lab: '实验室', modelId: '模型 ID',
    available: '可用', currentDefault: '当前默认', tierLocked: '免费档不可用',
    chipNew: '新', chipReasoning: '推理', chipFast: '快速', otherLab: '其他',
    refreshFailed: '无法刷新价格，正在显示上次加载的价格。',
    billingFailed: '无法刷新余额，正在显示上次加载的余额。',
    priceLegend: '输入 / 输出 · 美元/百万 token', defaultPrice: '配置默认模型价格',
    savedPrices: date => `价格保存于 ${date}。实时价格可能不同。`, checkingAvailability: '正在检查可用性',
    statusbarTip: m => `Nous Portal 配置默认模型 · ${m} · 输入 / 输出，美元/百万 token`, collapse: '折叠分组', expand: '展开分组' },
  'zh-hant': { ...EN,
    nav: 'Nous 價格', command: 'Nous Portal Pricing: 開啟模型價格', subtitle: 'Portal 上所有模型，含即時價格。',
    search: '搜尋模型…', hint1: '試試 "hermes"', hint2: '試試 "deepseek"',
    all: '全部', featured: '精選', free: '免費', sale: '特價', reasoning: '推理', fast: '快速',
    allLabs: '所有實驗室', recommended: '推薦排序', priceAsc: '價格 · 低到高', priceDesc: '價格 · 高到低',
    byName: '名稱', byDiscount: '最大折扣', outputPriceAsc: '輸出價格 · 低到高', outputPriceDesc: '輸出價格 · 高到低', refresh: '重新整理價格', openPortal: '開啟 Portal',
    managePlan: '管理方案', models: n => `${n} 個模型`, freeCount: n => `${n} 個免費`,
    saleCount: n => `${n} 個特價`, freeBadge: '免費', proBadge: 'Pro',
    current: '目前', locked: '需要付費方案', input: '輸入', output: '輸出',
    cached: '快取讀取', perMtok: '每百萬 token', listPrice: '原價', off: n => `折扣 ${n}%`,
    setDefault: '設為預設', confirm: '仍要設定',
    defaultSet: '預設模型已更新', defaultSetDetail: m => `${m} · 套用於此設定檔的新對話`,
    setFailed: '無法更新預設模型', copyId: '複製模型 ID',
    signInTitle: '尚未連接 Nous Portal', signInDetail: '在設定中登入即可載入即時目錄價格與你的方案。',
    loadFailed: '無法載入模型價格', retry: '重試', emptyTitle: '沒有符合的模型',
    emptyDetail: '換個搜尋詞、分類或實驗室試試。', pendingTitle: '正在取得即時價格…',
    pendingDetail: '正在載入 Portal 目錄，價格稍後顯示。',
    freeTierNote: n => `此帳戶有 ${n} 個模型需要付費方案`, spendable: '可用額度',
    renews: w => `${w} 續訂`, topup: '儲值餘額', planLeft: (l, t) => `${t} 中剩餘 ${l}`,
    capabilities: '能力', status: '狀態', lab: '實驗室', modelId: '模型 ID',
    available: '可用', currentDefault: '目前預設', tierLocked: '免費層級無法使用',
    chipNew: '新', chipReasoning: '推理', chipFast: '快速', otherLab: '其他',
    refreshFailed: '無法重新整理價格，正在顯示上次載入的價格。',
    billingFailed: '無法重新整理餘額，正在顯示上次載入的餘額。',
    priceLegend: '輸入 / 輸出 · 美元/百萬 token', defaultPrice: '設定檔預設模型價格',
    savedPrices: date => `價格儲存於 ${date}。即時價格可能不同。`, checkingAvailability: '正在檢查可用性',
    statusbarTip: m => `Nous Portal 設定檔預設模型 · ${m} · 輸入 / 輸出，美元/百萬 token`, collapse: '摺疊分組', expand: '展開分組' }
}

// Disk plugins are not scanned by Tailwind; every layout rule below is ours.
// Badges reuse the app's token palette so light/dark and custom themes follow.
const CSS = `
.np-chipbar{display:flex;align-items:center;gap:2px;height:100%;color:var(--ui-text-tertiary)}
.np-chipbar .np-chipbar-price{font-family:var(--font-mono,monospace);font-size:10.5px;font-variant-numeric:tabular-nums}
.np-chipbar .np-chipbar-free{color:var(--ui-green);font-size:9.5px;font-weight:650;text-transform:uppercase;letter-spacing:.05em}
.np-page{display:flex;flex-direction:column;flex:1;min-width:0;height:100%;min-height:0;overflow:hidden}
.np-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.np-inner{max-width:62rem;margin:0 auto;padding:22px 28px 64px;display:flex;flex-direction:column;gap:16px}
.np-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
.np-head-main{min-width:0;flex:1}
.np-title{display:flex;align-items:center;gap:10px;font-size:16.5px;font-weight:650;letter-spacing:-0.01em;color:var(--ui-text-primary)}
.np-title-mark{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:color-mix(in srgb,var(--ui-accent) 12%,transparent);color:var(--ui-accent);flex-shrink:0}
.np-sub{margin-top:4px;font-size:12px;color:var(--ui-text-tertiary)}
.np-stats{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--ui-text-tertiary)}
.np-stats b{color:var(--ui-text-secondary);font-weight:600;font-variant-numeric:tabular-nums}
.np-stats .np-stat-sep{color:var(--ui-text-quaternary)}
.np-head-actions{display:flex;align-items:center;gap:4px;flex-shrink:0}
.np-account{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:8px;background:var(--ui-bg-tertiary)}
.np-account-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.np-account-plan{font-size:12.5px;font-weight:650;color:var(--ui-text-primary)}
.np-account-spend{margin-left:auto;text-align:right;flex-shrink:0}
.np-account-num{font-size:14px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--ui-text-primary)}
.np-account-num-label{font-size:10px;color:var(--ui-text-tertiary)}
.np-account-bars{display:flex;flex-direction:column;gap:6px}
.np-bar-row{display:flex;align-items:center;gap:8px}
.np-bar-track{flex:1;height:4px;border-radius:2px;background:var(--ui-bg-quaternary);overflow:hidden}
.np-bar-fill{display:block;height:100%;border-radius:2px;background:var(--ui-accent);transition:width .3s ease}
.np-bar-row[data-kind=topup] .np-bar-fill{background:var(--ui-cyan)}
.np-bar-meta{font-size:10px;color:var(--ui-text-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}
.np-account-actions{display:flex;gap:4px;margin-top:2px}
.np-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.np-toolbar .np-search{flex:1;min-width:9rem;max-width:19rem}
.np-toolbar .np-selects{display:flex;align-items:center;gap:6px;margin-left:auto}
/* SDK SelectTrigger is w-full justify-between; in a shrink-wrap flex row that can
   shrink below content and push the chevron past the border. Size to content. */
.np-selects [data-slot='select-trigger']{width:auto;flex:none;min-width:0}
.np-notice{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;font-size:11.5px;color:var(--ui-text-secondary);background:color-mix(in srgb,var(--ui-yellow) 10%,transparent)}
.np-notice[data-tone=info]{background:var(--ui-bg-tertiary)}
.np-notice>svg{width:12px;height:12px;flex-shrink:0;color:var(--ui-yellow)}
.np-notice[data-tone=info]>svg{color:var(--ui-text-tertiary)}
.np-groups{display:flex;flex-direction:column;gap:2px}
.np-group{display:flex;flex-direction:column}
.np-group-head{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px 5px;border:0;background:transparent;font:inherit;color:var(--ui-text-tertiary);cursor:pointer;border-radius:5px;text-align:left;user-select:none}
.np-group-head:hover{color:var(--ui-text-secondary);background:var(--chrome-action-hover)}
.np-group-caret{display:inline-flex;width:12px;color:var(--ui-text-quaternary);transition:transform .12s ease;flex-shrink:0}
.np-group[data-collapsed=true] .np-group-caret{transform:rotate(-90deg)}
.np-group-name{font-size:10.5px;font-weight:650;text-transform:uppercase;letter-spacing:.07em}
.np-group-meta{font-size:10px;font-variant-numeric:tabular-nums;color:var(--ui-text-quaternary)}
.np-rows{display:flex;flex-direction:column;padding-bottom:6px}
.np-row{display:flex;flex-direction:column;border-radius:6px}
.np-row-line{display:flex;align-items:center;gap:6px}
.np-row-main{display:flex;align-items:center;gap:10px;flex:1;min-width:0;padding:5px 8px;border:0;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;border-radius:6px}
.np-row-main:hover,.np-row[data-open=true]>.np-row-line>.np-row-main{background:var(--chrome-action-hover)}
.np-row-main:focus-visible{outline:1px solid var(--ui-accent);outline-offset:-1px}
.np-row[data-locked=true] .np-row-main{opacity:.55}
.np-caret{display:inline-flex;width:10px;flex-shrink:0;color:var(--ui-text-quaternary);transition:transform .12s ease}
.np-row[data-open=true] .np-caret{transform:rotate(90deg)}
.np-name{font-family:var(--font-mono,monospace);font-size:12px;line-height:18px;color:var(--ui-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:0 1 auto}
.np-row[data-current=true] .np-name{color:var(--ui-accent);font-weight:600}
.np-name-sub{font-size:10.5px;color:var(--ui-text-quaternary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:34%;min-width:0;flex-shrink:1}
.np-chips{display:inline-flex;gap:3px;flex-shrink:0}
.np-cap{display:inline-flex;align-items:center;gap:3px;padding:0 5px;height:15px;border-radius:3px;font-size:9px;font-weight:650;letter-spacing:.03em;text-transform:uppercase;color:var(--ui-text-tertiary);background:var(--ui-bg-quaternary)}
.np-cap>svg{width:9px;height:9px}
.np-cap[data-kind=reasoning]{color:var(--ui-purple);background:color-mix(in srgb,var(--ui-purple) 13%,transparent)}
.np-cap[data-kind=fast]{color:var(--ui-yellow);background:color-mix(in srgb,var(--ui-yellow) 15%,transparent)}
.np-cap[data-kind=featured]{color:var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 11%,transparent)}
.np-cap[data-kind=lock]{color:var(--ui-text-tertiary)}
.np-price{display:inline-flex;align-items:baseline;gap:7px;flex-shrink:0;font-variant-numeric:tabular-nums;font-size:11.5px;line-height:18px;color:var(--ui-text-secondary);font-family:var(--font-mono,monospace)}
.np-context{flex-shrink:0;color:var(--ui-text-secondary);font-variant-numeric:tabular-nums;font-size:11.5px;white-space:nowrap}
.np-price .np-was{color:var(--ui-text-quaternary);font-size:10px;text-decoration:line-through}
.np-badge{display:inline-flex;align-items:center;padding:1px 5px;border-radius:3px;font-size:9.5px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;flex-shrink:0}
.np-badge[data-kind=free]{color:var(--ui-green);background:color-mix(in srgb,var(--ui-green) 14%,transparent)}
.np-badge[data-kind=sale]{color:var(--ui-orange);background:color-mix(in srgb,var(--ui-orange) 14%,transparent)}
.np-badge[data-kind=current]{color:var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 11%,transparent)}
.np-row-copy{flex-shrink:0;opacity:0;pointer-events:none}
.np-copy-btn{opacity:1}
.np-row-line:hover .np-row-copy,.np-row-line:focus-within .np-row-copy{opacity:1;pointer-events:auto}
@media(hover:none){.np-row-copy{opacity:1;pointer-events:auto}}
.np-detail{margin:2px 6px 8px 28px;padding:10px 14px 12px;border-radius:7px;background:var(--ui-bg-tertiary);display:flex;flex-direction:column;gap:12px}
.np-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px 18px}
.np-cell{min-width:0}
.np-cell-label{display:block;font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ui-text-quaternary);margin-bottom:2px}
.np-cell-value{display:block;font-family:var(--font-mono,monospace);font-size:12px;font-variant-numeric:tabular-nums;color:var(--ui-text-primary)}
.np-cell-sub{display:block;font-size:10px;color:var(--ui-text-tertiary);margin-top:1px}
.np-detail-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.np-detail-note{font-size:10.5px;color:var(--ui-text-tertiary);margin-left:auto}
.np-toggle-on{color:var(--ui-accent)!important;border-color:color-mix(in srgb,var(--ui-accent) 55%,var(--ui-stroke-secondary))!important}
.np-toggle-off{color:var(--ui-text-tertiary)!important;border-color:var(--ui-stroke-secondary)!important;opacity:.82}
.np-settings-row .np-selects{gap:6px}
.np-settings-row .np-selects button{height:28px}
.np-settings-row .np-selects button span{font-size:11px}
.np-empty{padding:56px 0}
.np-error{padding:56px 24px}
.np-loading{display:grid;place-items:center;padding:72px 0}
`

// -- data --------------------------------------------------------------------

async function companionRequest(ctx, path, gateway, profile, method, params = {}) {
  const current = () => host.getGateway() === gateway &&
    (host.state.profile.get() || 'default') === (profile || 'default')
  if (!current()) throw new Error('Hermes connection changed; retry on the selected profile')
  if (typeof ctx?.rest === 'function') {
    try {
      return await ctx.rest(path, { timeoutMs: 30000 })
    } catch (error) {
      // Electron IPC can retain only the message. Match the missing-route
      // response, not profile-not-found, authentication, or server failures.
      const missingRoute = /(?:^|\s)404:\s*\{\s*"detail"\s*:\s*"Not Found"\s*\}\s*$/.test(String(error?.message || ''))
      if (!missingRoute) throw error
    }
  }
  if (!current()) throw new Error('Hermes connection changed; retry on the selected profile')
  if (!gateway) throw new Error('Hermes gateway unavailable')
  return gateway.request(method, { ...params, ...(profile ? { profile } : {}) })
}

function fetchCatalog(refresh, ctx, profile, gateway) {
  const params = new URLSearchParams({
    include_unconfigured: 'true',
    ...(profile ? { profile } : {}),
    ...(refresh ? { refresh: 'true' } : {})
  })
  return companionRequest(ctx, `/catalog?${params.toString()}`, gateway, profile,
    'model.options', { include_unconfigured: true, ...(refresh ? { refresh: true } : {}) })
}

function fetchBilling(ctx, profile, gateway) {
  const params = new URLSearchParams(profile ? { profile } : {})
  return companionRequest(ctx, `/billing?${params.toString()}`, gateway, profile, 'billing.state')
}

function nousRow(payload) {
  return (payload?.providers ?? []).find(p => p?.slug === NOUS) ?? null
}

function isCatalogPending(payload) {
  const row = nousRow(payload)
  return row?.pricing_pending === true || row?.free_tier_pending === true
}

function pricingFingerprint(row) {
  const featured = new Set(row?.featured_models ?? [])
  const unavailable = new Set(row?.unavailable_models ?? [])
  return JSON.stringify((row?.models ?? []).filter(Boolean).sort().map(id => [
    id,
    row?.pricing?.[id]?.input ?? null,
    row?.pricing?.[id]?.output ?? null,
    row?.pricing?.[id]?.cache ?? null,
    row?.pricing?.[id]?.discount_percent ?? null,
    row?.pricing?.[id]?.was_input ?? null,
    row?.pricing?.[id]?.was_output ?? null,
    row?.pricing?.[id]?.free === true,
    row?.context_lengths?.[id] ?? null,
    row?.capabilities?.[id]?.reasoning === true,
    row?.capabilities?.[id]?.fast === true,
    featured.has(id),
    unavailable.has(id)
  ]))
}

function pricingChangeCount(before, after) {
  if (!before || !after) return 0
  const a = new Map(JSON.parse(before).map(row => [row[0], JSON.stringify(row.slice(1))]))
  const b = new Map(JSON.parse(after).map(row => [row[0], JSON.stringify(row.slice(1))]))
  const ids = new Set([...a.keys(), ...b.keys()])
  return [...ids].filter(id => a.get(id) !== b.get(id)).length
}

// Query observers share requests, so they must also share the retry counter.
// Weak keys release budgets when a query client or gateway is discarded.
const catalogBudgets = new WeakMap()
const REFRESH_INTERVAL_NUMBERS = [5, 10, 24]
const refreshSettingsStores = new WeakMap()

function normalizeRefreshSettings(value) {
  return {
    autoRefresh: value?.autoRefresh !== false,
    intervalNum: REFRESH_INTERVAL_NUMBERS.includes(value?.intervalNum) ? value.intervalNum : 5,
    intervalUnit: value?.intervalUnit === 'hours' ? 'hours' : 'minutes',
    notifyChanges: value?.notifyChanges !== false
  }
}

function refreshSettingsStore(ctx, profile) {
  if (!refreshSettingsStores.has(ctx.storage)) refreshSettingsStores.set(ctx.storage, new Map())
  const profiles = refreshSettingsStores.get(ctx.storage)
  const key = `local.refreshSettings.v1.${profile || 'default'}`
  if (!profiles.has(key)) {
    let saved
    try { saved = ctx.storage.get(key, null) } catch { /* Use defaults when storage is unavailable. */ }
    profiles.set(key, atom(normalizeRefreshSettings(saved)))
  }
  return { key, store: profiles.get(key) }
}

function useRefreshSettings(ctx, profile) {
  const { key, store } = refreshSettingsStore(ctx, profile)
  const settings = useValue(store)
  const change = patch => {
    const next = normalizeRefreshSettings({ ...store.get(), ...patch })
    store.set(next)
    try { ctx.storage.set(key, next) } catch { /* Keep shared in-memory settings usable. */ }
  }
  return { ...settings,
    changeAuto: autoRefresh => change({ autoRefresh }),
    changeIntervalNum: intervalNum => change({ intervalNum: Number(intervalNum) }),
    changeIntervalUnit: intervalUnit => change({ intervalUnit }),
    changeNotify: notifyChanges => change({ notifyChanges })
  }
}

function catalogBudget(queryClient, gateway, profile) {
  if (!catalogBudgets.has(queryClient)) catalogBudgets.set(queryClient, new WeakMap())
  const gateways = catalogBudgets.get(queryClient)
  const owner = gateway || queryClient
  if (!gateways.has(owner)) gateways.set(owner, new Map())
  const profiles = gateways.get(owner)
  const key = profile || 'default'
  if (!profiles.has(key)) profiles.set(key, { attempts: 0 })
  return profiles.get(key)
}

// Keep data lifecycles outside the page. Both contributions use this hook so
// cold catalogs also recover when only the status bar is mounted.
function loadPriceSnapshot(ctx, key) {
  try {
    const saved = ctx.storage.get(key, null)
    return saved?.version === 1 && Number.isFinite(saved.savedAt) && saved.savedAt > 0 &&
      Array.isArray(saved.models) && saved.models.every(id => typeof id === 'string') &&
      saved.pricing && typeof saved.pricing === 'object' && !Array.isArray(saved.pricing)
      ? saved : null
  } catch { return null }
}

function useCatalog(profile, ctx) {
  const t = usePluginI18n(ID)
  const refreshSettings = useRefreshSettings(ctx, profile)
  const queryClient = useQueryClient()
  const storageKey = `local.prices.v1.${profile || 'default'}`
  const snapshot = useMemo(() => ({ value: loadPriceSnapshot(ctx, storageKey) }), [ctx, storageKey])
  const connection = useValue(host.state.gateway)
  const gateway = host.getGateway()
  const budget = useMemo(() => {
    const current = catalogBudget(queryClient, gateway || queryClient, profile)
    current.attempts = 0
    return current
  }, [queryClient, profile, connection, gateway])
  const queryKey = [ID, 'catalog', profile || 'default']
  const read = async refresh => {
    try {
      let data = await fetchCatalog(refresh, ctx, profile, gateway)
      budget.attempts = isCatalogPending(data) ? budget.attempts + 1 : 0
      const row = nousRow(data)
      if (row && !isCatalogPending(data) && Object.keys(row.pricing ?? {}).length) {
        const fingerprint = pricingFingerprint(row)
        const previousFingerprint = budget.fingerprint
        budget.fingerprint = fingerprint
        const { notifyChanges } = refreshSettingsStore(ctx, profile).store.get()
        const changed = pricingChangeCount(previousFingerprint, fingerprint)
        if (previousFingerprint && changed > 0 && notifyChanges) {
          host.notify({ kind: 'info', title: t('priceChangesTitle'), message: t('priceChangesMessage', changed) })
        }
        const saved = { version: 1, savedAt: Date.now(), models: row.models ?? [],
          pricing: row.pricing, capabilities: row.capabilities ?? {}, featured_models: row.featured_models ?? [],
          context_lengths: row.context_lengths ?? {} }
        snapshot.value = saved
        try { ctx.storage.set(storageKey, saved) } catch { /* Storage failure must not discard live prices. */ }
      } else if (row && isCatalogPending(data) && snapshot.value) {
        data = { ...data, savedPricesAt: snapshot.value.savedAt,
          providers: data.providers.map(provider => provider === row
            ? { ...row, pricing: { ...snapshot.value.pricing, ...row.pricing } } : provider) }
      }
      return data
    } catch (error) {
      budget.attempts += 1
      throw error
    }
  }
  const { autoRefresh, intervalNum, intervalUnit } = refreshSettings
  const autoRefreshMs = autoRefresh ? intervalNum * (intervalUnit === 'hours' ? 3600000 : 60000) : false
  const catalog = useQuery({
    queryKey,
    initialData: () => snapshot.value ? {
      savedPricesAt: snapshot.value.savedAt,
      providers: [{ slug: NOUS, models: snapshot.value.models, pricing: snapshot.value.pricing,
        capabilities: snapshot.value.capabilities, featured_models: snapshot.value.featured_models,
        context_lengths: snapshot.value.context_lengths ?? {},
        pricing_pending: true, free_tier_pending: true }]
    } : undefined,
    initialDataUpdatedAt: 0,
    queryFn: () => read(false),
    staleTime: autoRefreshMs === false ? CATALOG_STALE_MS : autoRefreshMs,
    refetchInterval: query => {
      if (isCatalogPending(query.state.data) && budget.attempts <= PENDING_REFETCH_ATTEMPTS)
        return Math.min(PENDING_REFETCH_MS * 1.5 ** Math.max(0, budget.attempts - 1), PENDING_REFETCH_MAX_MS)
      return autoRefreshMs
    },
    retry: 1
  })
  const refreshCatalog = async () => {
    budget.attempts = 0
    await queryClient.cancelQueries({ queryKey, exact: true })
    return queryClient.fetchQuery({ queryKey, queryFn: () => read(true), staleTime: 0 })
  }
  return { catalog, refreshCatalog, refreshSettings }
}

function requireModelSave(result, message) {
  if (!result || result.ok !== true || result.applied?.model !== true) throw new Error(message)
  return result
}

function useDefaultModel(profile, t) {
  const queryClient = useQueryClient()
  const connection = useValue(host.state.gateway)
  const gateway = host.getGateway()
  const requestToken = useRef(null)
  const busy = useMemo(() => ({ saving: false }), [profile, connection, gateway])
  const [pendingDefault, setPendingDefault] = useState(null)
  useEffect(() => {
    setPendingDefault(null)
    return () => { requestToken.current = null }
  }, [profile, connection, gateway])

  const setDefault = async model => {
    if (busy.saving) return
    const token = {}
    const name = profile || 'default'
    requestToken.current = token
    const isStale = () => requestToken.current !== token || host.getGateway() !== gateway ||
      (host.state.profile.get() || 'default') !== name || host.state.gateway.get() !== 'open'
    const finish = () => {
      if (isStale()) return
      host.notify({ kind: 'success', title: t('defaultSet'), message: t('defaultSetDetail', model) })
      void queryClient.invalidateQueries({ queryKey: [ID, 'catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['model-options'] })
    }
    const save = async confirmed => {
      if (isStale() || !gateway) throw new Error(t('setFailed'))
      busy.saving = true
      setPendingDefault(model)
      try {
        const result = await gateway.request('profiles.configure', {
          name, model, provider: NOUS, ...(confirmed ? { confirm_expensive_model: true } : {})
        })
        if (!confirmed && result?.confirm_required) return result
        return requireModelSave(result, t('setFailed'))
      } finally {
        busy.saving = false
        if (!isStale()) setPendingDefault(null)
      }
    }
    try {
      const result = await save(false)
      if (isStale()) return
      if (result.confirm_required) {
        surfaceModelSwitchConfirm({
          confirmLabel: t('confirm'), confirmMessage: result.confirm_message,
          failureMessage: t('setFailed'), isStale,
          requestConfirmed: () => save(true), finish
        })
      } else finish()
    } catch (error) {
      if (!isStale()) host.notifyError(error, t('setFailed'))
    }
  }
  return { pendingDefault, setDefault }
}

/** The payload's current (model, provider) pair is only "current" for us when
 *  it routes through the Nous row — same check the pickers use. */
function currentModelId(payload, row) {
  const model = payload?.model
  if (!model) return null
  if (row?.is_current) return model
  const provider = (payload?.provider || '').trim()
  return provider === row.slug || provider === row.name || (row.aliases ?? []).includes(provider) ? model : null
}

const LAB_NAMES = {
  'agentica': 'Agentica', 'aion-labs': 'Aion Labs', 'aionlabs': 'Aion Labs', 'alfredpros': 'AlfredPros',
  'allenai': 'AI2', 'alibaba': 'Alibaba', 'amazon': 'Amazon', 'amazon-bedrock': 'Amazon', 'anthropic': 'Anthropic',
  'arcee-ai': 'Arcee', 'arliai': 'ArliAI', 'baidu': 'Baidu', 'bytedance': 'ByteDance', 'cognitivetech': 'CognitiveTech',
  'cohere': 'Cohere', 'deepcogito': 'DeepCogito', 'deepseek': 'DeepSeek', 'eleutherai': 'EleutherAI',
  'essentialai': 'EssentialAI', 'google': 'Google', 'ibm-granite': 'IBM Granite', 'inception': 'Inception',
  'inflection': 'Inflection', 'kwaipilot': 'Kwaipilot', 'liquid': 'Liquid', 'meituan': 'Meituan',
  'meta': 'Meta', 'meta-llama': 'Meta', 'microsoft': 'Microsoft', 'minimax': 'MiniMax', 'mistral': 'Mistral AI',
  'mistralai': 'Mistral AI', 'moonshotai': 'Moonshot AI', 'morph': 'Morph', 'nex-agi': 'Nex AGI',
  'nous': 'Nous Research', 'nousresearch': 'Nous Research', 'nvidia': 'NVIDIA', 'openai': 'OpenAI',
  'opengvlab': 'OpenGVLab', 'openrouter': 'OpenRouter', 'perplexity': 'Perplexity', 'prime-intellect': 'Prime Intellect',
  'qwen': 'Qwen', 'raison': 'Raison', 'relace': 'Relace', 'sao10k': 'Sao10K', 'stepfun-ai': 'StepFun',
  'stepfun': 'StepFun', 'switchpoint': 'Switchpoint', 'tencent': 'Tencent', 'thedrummer': 'TheDrummer',
  'tngtech': 'TNG Tech', 'undi95': 'Undi95', 'x-ai': 'xAI', 'xai': 'xAI', 'xiaomi': 'Xiaomi',
  'z-ai': 'Z.ai', 'zai': 'Z.ai', 'zhipu': 'Z.ai', 'other': 'Other'
}

// The portal also serves some third-party ids without a vendor prefix; these
// leading-token hints keep them out of "Other" without a hardcoded id list.
const BARE_LAB_HINTS = [
  ['hermes', 'nous'], ['nous', 'nous'], ['deepseek', 'deepseek'], ['glm', 'z-ai'],
  ['minimax', 'minimax'], ['kimi', 'moonshotai'], ['moonshot', 'moonshotai'],
  ['gpt', 'openai'], ['o1', 'openai'], ['o3', 'openai'], ['o4', 'openai'], ['codex', 'openai'],
  ['claude', 'anthropic'], ['gemini', 'google'], ['gemma', 'google'], ['llama', 'meta-llama'],
  ['grok', 'x-ai'], ['qwen', 'qwen'], ['qwq', 'qwen'], ['mistral', 'mistralai'],
  ['ministral', 'mistralai'], ['mixtral', 'mistralai'], ['pixtral', 'mistralai'],
  ['command', 'cohere'], ['nova', 'amazon'], ['phi', 'microsoft'], ['miqo', 'alibaba']
]

function labKey(id) {
  const slash = id.indexOf('/')
  if (slash > 0) return id.slice(0, slash).toLowerCase()
  const bare = id.toLowerCase()
  for (const [prefix, key] of BARE_LAB_HINTS) {
    if (bare.startsWith(prefix)) return key
  }
  return 'other'
}

function labLabel(key) {
  return LAB_NAMES[key] ?? key.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Extract a numeric price; "free" is zero and unparseable prices sort last. */
function priceNumber(value) {
  if (value === 'free') return 0
  const match = /([0-9]+(?:\.[0-9]+)?)/.exec(String(value ?? ''))
  return match ? Number(match[1]) : null
}

function formatContext(value) {
  if (!Number.isSafeInteger(value) || value <= 0) return null
  if (value >= 1048576) return `${Math.round(value / 1048576 * 10) / 10}M`
  if (value >= 1024) return `${Math.round(value / 1024 * 10) / 10}K`
  return String(value)
}

function toEntry(id, pricing, caps, featured, locked, current, contextLength) {
  const key = labKey(id)
  return {
    id,
    lab: key,
    labLabel: labLabel(key),
    input: pricing?.input ?? '',
    output: pricing?.output ?? '',
    cache: pricing?.cache ?? null,
    free: pricing?.free === true,
    discount: typeof pricing?.discount_percent === 'number' ? pricing.discount_percent : null,
    wasInput: pricing?.was_input ?? null,
    wasOutput: pricing?.was_output ?? null,
    inputNum: priceNumber(pricing?.input),
    outputNum: priceNumber(pricing?.output),
    contextLength: Number.isSafeInteger(contextLength) && contextLength > 0 ? contextLength : null,
    contextLabel: formatContext(contextLength),
    reasoning: caps?.reasoning === true,
    fast: caps?.fast === true,
    featured,
    locked,
    current
  }
}

const CATEGORIES = [
  { id: 'all', test: () => true },
  { id: 'featured', test: m => m.featured },
  { id: 'free', test: m => m.free },
  { id: 'sale', test: m => m.discount !== null },
  { id: 'reasoning', test: m => m.reasoning },
  { id: 'fast', test: m => m.fast }
]

const SORTS = {
  recommended: null,
  'price-asc': (a, b) => rank(a.inputNum) - rank(b.inputNum) || rank(a.outputNum) - rank(b.outputNum) || a.id.localeCompare(b.id),
  'price-desc': (a, b) => rankDesc(b.inputNum) - rankDesc(a.inputNum) || rankDesc(b.outputNum) - rankDesc(a.outputNum) || a.id.localeCompare(b.id),
  name: (a, b) => a.id.localeCompare(b.id),
  discount: (a, b) => (b.discount ?? -1) - (a.discount ?? -1) || rank(a.inputNum) - rank(b.inputNum),
  'output-price-asc': (a, b) => rank(a.outputNum) - rank(b.outputNum) || rank(a.inputNum) - rank(b.inputNum) || a.id.localeCompare(b.id),
  'output-price-desc': (a, b) => rankDesc(b.outputNum) - rankDesc(a.outputNum) || rankDesc(b.inputNum) - rankDesc(a.inputNum) || a.id.localeCompare(b.id),
  'context-desc': (a, b) => rankDesc(b.contextLength) - rankDesc(a.contextLength) || a.id.localeCompare(b.id)
}

const rank = v => (v === null ? Number.POSITIVE_INFINITY : v)
const rankDesc = v => (v === null ? Number.NEGATIVE_INFINITY : v)

const fold = value => String(value ?? '').toLowerCase().replace(/[-_./\s]+/g, '')

function filterEntries(entries, category, lab, q, sorter) {
  const filtered = entries.filter(m => {
    if (!category.test(m) || (lab !== '*' && m.lab !== lab)) return false
    if (!q) return true
    // Entries are replaced when the catalog changes. Normalize once per entry,
    // on first search, rather than repeating regex work on every keystroke.
    const terms = m.searchTerms ??= [fold(m.id), fold(m.labLabel), fold(m.lab)]
    return terms.some(term => term.includes(q))
  })
  return sorter ? filtered.sort(sorter) : filtered
}

// -- pieces ------------------------------------------------------------------

function PriceTag({ m, t }) {
  if (m.free) {
    return jsxs('span', { className: 'np-price', children: [
      m.discount !== null && m.discount < 100
        ? jsx('span', { className: 'np-badge', 'data-kind': 'sale', children: `-${m.discount}%` })
        : null,
      jsx('span', { className: 'np-badge', 'data-kind': 'free', children: t('freeBadge') })
    ] })
  }
  if (!m.input && !m.output) {
    return jsx('span', { className: 'np-price', style: { opacity: 0.5 }, children: '—' })
  }
  const onSale = m.discount !== null && Boolean(m.wasInput || m.wasOutput)
  return jsxs('span', { className: 'np-price', children: [
    onSale ? jsx('span', { className: 'np-badge', 'data-kind': 'sale', children: `-${m.discount}%` }) : null,
    jsxs('span', { children: [m.input || '?', ' / ', m.output || '?'] }),
    onSale ? jsxs('s', { className: 'np-was', children: [m.wasInput || '?', ' / ', m.wasOutput || '?'] }) : null
  ] })
}

function CapChips({ m, t }) {
  const chips = []
  if (m.featured) chips.push(jsx('span', { className: 'np-cap', 'data-kind': 'featured', children: t('chipNew') }, 'f'))
  if (m.reasoning) chips.push(jsxs('span', { className: 'np-cap', 'data-kind': 'reasoning', children: [jsx(icons.Brain, { 'aria-hidden': true, size: 9 }), t('chipReasoning')] }, 'r'))
  if (m.fast) chips.push(jsxs('span', { className: 'np-cap', 'data-kind': 'fast', children: [jsx(icons.Zap, { 'aria-hidden': true, size: 9 }), t('chipFast')] }, 'z'))
  if (m.locked) chips.push(jsxs('span', { className: 'np-cap', 'data-kind': 'lock', children: [jsx(icons.Lock, { 'aria-hidden': true, size: 9 }), t('proBadge')] }, 'l'))
  return chips.length ? jsx('span', { className: 'np-chips', children: chips }) : null
}

function Cell({ label, value, sub }) {
  return jsxs('div', { className: 'np-cell', children: [
    jsx('span', { className: 'np-cell-label', children: label }),
    jsx('span', { className: 'np-cell-value', children: value }),
    sub ? jsx('span', { className: 'np-cell-sub', children: sub }) : null
  ] })
}

function ModelDetail({ m, pendingDefault, defaultBusy, onSetDefault }) {
  const t = usePluginI18n(ID)
  const em = '—'
  const cells = []
  cells.push(jsx(Cell, { label: t('input'), value: m.free ? t('freeBadge') : m.input || em, sub: m.wasInput ? `${t('listPrice')} ${m.wasInput}` : t('perMtok') }, 'in'))
  cells.push(jsx(Cell, { label: t('output'), value: m.free ? t('freeBadge') : m.output || em, sub: m.wasOutput ? `${t('listPrice')} ${m.wasOutput}` : t('perMtok') }, 'out'))
  cells.push(jsx(Cell, { label: t('context'), value: m.contextLabel || em, sub: m.contextLength ? `${m.contextLength} ${t('tokens')}` : t('tokens') }, 'context'))
  if (m.cache) cells.push(jsx(Cell, { label: t('cached'), value: m.cache, sub: t('perMtok') }, 'cache'))
  if (m.discount !== null) cells.push(jsx(Cell, { label: t('sale'), value: t('off', m.discount) }, 'sale'))
  const capNames = [m.reasoning ? t('chipReasoning') : null, m.fast ? t('chipFast') : null, m.featured ? t('chipNew') : null].filter(Boolean)
  if (capNames.length) cells.push(jsx(Cell, { label: t('capabilities'), value: capNames.join(' · ') }, 'caps'))
  cells.push(jsx(Cell, { label: t('lab'), value: m.labLabel }, 'lab'))
  cells.push(jsx(Cell, {
    label: t('status'),
    value: m.availabilityPending ? t('checkingAvailability') : m.current ? t('currentDefault') : m.locked ? t('tierLocked') : t('available')
  }, 'status'))
  cells.push(jsx(Cell, { label: t('modelId'), value: m.id }, 'id'))
  return jsxs('div', { className: 'np-detail', children: [
    jsx('div', { className: 'np-detail-grid', children: cells }),
    jsxs('div', { className: 'np-detail-actions', children: [
      !m.current && !m.locked
        ? jsx(Button, {
            variant: 'secondary', size: 'xs', disabled: defaultBusy,
            onClick: () => onSetDefault(m.id),
            children: pendingDefault ? jsx(GlyphSpinner, { ariaLabel: t('setDefault') }) : t('setDefault')
          })
        : null,
      m.locked ? jsxs('span', { className: 'np-detail-note', style: { marginLeft: 0 }, children: [t('locked')] }) : null,
      jsx(CopyButton, { appearance: 'icon', buttonSize: 'icon-xs', text: m.id, title: t('copyId'), label: t('copyId') })
    ] })
  ] })
}

function ModelRow({ m, open, onToggle, pendingDefault, defaultBusy, onSetDefault }) {
  const t = usePluginI18n(ID)
  const bare = m.id.indexOf('/') < 0
  return jsxs('div', { className: 'np-row', 'data-open': open, 'data-locked': m.locked, 'data-current': m.current, children: [
    jsxs('div', { className: 'np-row-line', children: [
      jsxs('button', {
        className: 'np-row-main', type: 'button', 'aria-expanded': open,
        onClick: onToggle,
        children: [
          jsx('span', { className: 'np-caret', 'aria-hidden': true, children: jsx(icons.ChevronRight, { size: 10 }) }),
          jsx('span', { className: 'np-name', children: m.id }),
          bare ? jsx('span', { className: 'np-name-sub', children: m.labLabel }) : null,
          jsx('span', { style: { flex: 1, minWidth: 0 } }),
          jsx(CapChips, { m, t }),
          m.current ? jsx('span', { className: 'np-badge', 'data-kind': 'current', children: t('current') }) : null,
          jsx('span', { className: 'np-context', title: m.contextLength ? `${t('context')}: ${m.contextLength} ${t('tokens')}` : t('context'), children: m.contextLabel || '—' }),
          jsx(PriceTag, { m, t })
        ]
      }),
      jsx('span', { className: 'np-row-copy', children:
        jsx(CopyButton, { appearance: 'tool-row', className: 'np-copy-btn', text: m.id, title: t('copyId'), label: t('copyId') })
      })
    ] }),
    open ? jsx(ModelDetail, { m, pendingDefault, defaultBusy, onSetDefault }) : null
  ] })
}

function LabGroup({ lab, label, items, collapsed, onToggle, renderItem }) {
  const t = usePluginI18n(ID)
  const prices = items.map(m => m.inputNum).filter(v => v !== null)
  const range = prices.length
    ? Math.min(...prices) === Math.max(...prices)
      ? `$${Math.min(...prices)}`
      : `$${Math.min(...prices)}-$${Math.max(...prices)}`
    : ''
  return jsxs('section', { className: 'np-group', 'data-collapsed': collapsed, children: [
    jsxs('button', {
      className: 'np-group-head', type: 'button', 'aria-expanded': !collapsed,
      'aria-label': `${collapsed ? t('expand') : t('collapse')}: ${label}`,
      onClick: () => onToggle(lab),
      children: [
        jsx('span', { className: 'np-group-caret', 'aria-hidden': true, children: jsx(icons.ChevronRight, { size: 10 }) }),
        jsx('span', { className: 'np-group-name', children: label }),
        jsxs('span', { className: 'np-group-meta', children: [t('models', items.length), range ? ` · ${range}/Mtok` : ''] })
      ]
    }),
    collapsed ? null : jsx('div', { className: 'np-rows', children: items.map(renderItem) })
  ] })
}

function UsageBar({ kind, bar, meta }) {
  if (!bar) return null
  const pct = Math.max(0, Math.min(1, Number(bar.fill_fraction) || 0))
  return jsxs('div', { className: 'np-bar-row', 'data-kind': kind, children: [
    jsx('span', { className: 'np-bar-track', children: jsx('i', { className: 'np-bar-fill', style: { width: `${Math.round(pct * 100)}%` } }) }),
    jsx('span', { className: 'np-bar-meta', children: meta })
  ] })
}

function AccountStrip({ billing, ctx, t }) {
  if (!billing?.logged_in) return null
  const usage = billing.usage?.available ? billing.usage : null
  const plan = usage?.plan_name || null
  const portalUrl = billing.portal_url || PORTAL_HOME
  return jsxs('div', { className: 'np-account', children: [
    jsxs('div', { className: 'np-account-top', children: [
      jsx('span', { className: 'np-account-plan', children: plan || t('title') }),
      usage?.total_spendable_display
        ? jsxs('span', { className: 'np-account-spend', children: [
            jsx('span', { className: 'np-account-num', children: usage.total_spendable_display }),
            jsxs('span', { className: 'np-account-num-label', children: [' ', t('spendable')] })
          ] })
        : null
    ] }),
    jsxs('div', { className: 'np-account-bars', children: [
      usage?.plan_bar
        ? jsx(UsageBar, {
            kind: 'plan', bar: usage.plan_bar,
            meta: [t('planLeft', usage.plan_bar.remaining_display, usage.plan_bar.total_display), usage.renews_display ? ` · ${t('renews', usage.renews_display)}` : ''].join('')
          })
        : null,
      usage?.topup_bar
        ? jsx(UsageBar, { kind: 'topup', bar: usage.topup_bar, meta: `${usage.topup_bar.remaining_display} ${t('topup')}` })
        : null
    ] }),
    jsxs('div', { className: 'np-account-actions', children: [
      jsx(Button, { variant: 'secondary', size: 'xs', onClick: () => void ctx.os.openExternal(portalUrl), children: t('openPortal') }),
      jsx(Button, { variant: 'text', size: 'xs', onClick: () => void ctx.os.openExternal(portalUrl), children: t('managePlan') })
    ] })
  ] })
}

function NousNotice({ row, t }) {
  if (row?.warning) {
    return jsxs('div', { className: 'np-notice', 'data-tone': 'info', children: [
      jsx(icons.Info, { 'aria-hidden': true }), jsx('span', { children: row.warning })
    ] })
  }
  if (row?.free_tier === true && (row.unavailable_models ?? []).length) {
    return jsxs('div', { className: 'np-notice', children: [
      jsx(icons.Lock, { 'aria-hidden': true }),
      jsx('span', { children: t('freeTierNote', row.unavailable_models.length) })
    ] })
  }
  return null
}

/** When the socket drops and reopens (profile switch, backend restart), cold
 *  caches deserve another shot — invalidate both plugin queries once per open. */
function useGatewayWakeup() {
  const queryClient = useQueryClient()
  const gateway = useValue(host.state.gateway)
  const wasOpen = useRef(gateway === 'open')
  useEffect(() => {
    if (gateway === 'open' && !wasOpen.current) {
      void queryClient.invalidateQueries({ queryKey: [ID] })
    }
    wasOpen.current = gateway === 'open'
  }, [gateway, queryClient])
}

// -- page --------------------------------------------------------------------

function PricesPage({ ctx }) {
  const t = usePluginI18n(ID)
  const profile = useValue(host.state.profile)
  useGatewayWakeup()
  const { catalog, refreshCatalog, refreshSettings } = useCatalog(profile, ctx)
  const gateway = host.getGateway()

  const billing = useQuery({
    queryKey: [ID, 'billing', profile || 'default'],
    queryFn: () => fetchBilling(ctx, profile, gateway),
    staleTime: 0,
    refetchInterval: BILLING_REFETCH_MS,
    retry: false
  })

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(() => ctx.storage.get('local.category', 'all'))
  const [lab, setLab] = useState(() => ctx.storage.get('local.lab', '*'))
  const [sort, setSort] = useState(() => ctx.storage.get('local.sort', 'recommended'))
  const [openId, setOpenId] = useState(null)
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  const { pendingDefault, setDefault } = useDefaultModel(profile, t)

  const row = nousRow(catalog.data)
  const entries = useMemo(() => {
    if (!row) return []
    const pricing = row.pricing ?? {}
    const caps = row.capabilities ?? {}
    const contextLengths = row.context_lengths ?? {}
    const featuredSet = new Set(row.featured_models ?? [])
    const lockedSet = new Set(row.unavailable_models ?? [])
    const current = currentModelId(catalog.data, row)
    return (row.models ?? [])
      .filter(id => typeof id === 'string' && id)
      .map(id => ({ ...toEntry(id, pricing[id], caps[id], featuredSet.has(id), lockedSet.has(id), id === current, contextLengths[id]),
        availabilityPending: row.free_tier_pending === true }))
  }, [catalog.data])

  const pricingPending = isCatalogPending(catalog.data)

  const categoryDef = CATEGORIES.find(c => c.id === category) ?? CATEGORIES[0]
  const q = fold(search.trim())

  const counts = useMemo(() => ({
    total: entries.length,
    free: entries.filter(m => m.free).length,
    sale: entries.filter(m => m.discount !== null).length
  }), [entries])

  const labs = useMemo(() => {
    const seen = new Map()
    for (const m of entries) if (!seen.has(m.lab)) seen.set(m.lab, m.labLabel)
    return [...seen.entries()]
  }, [entries])

  const visible = useMemo(() => {
    const sorter = SORTS[sort] ?? null
    return filterEntries(entries, categoryDef, lab, q, sorter)
  }, [entries, categoryDef, lab, q, sort])

  const groups = useMemo(() => {
    if (sort !== 'recommended') return null
    const byLab = new Map()
    for (const m of visible) {
      const list = byLab.get(m.lab)
      if (list) list.push(m)
      else byLab.set(m.lab, [m])
    }
    return [...byLab.entries()].map(([key, items]) => ({ key, label: items[0].labLabel, items }))
  }, [visible, sort])

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refreshCatalog()
    } catch (error) {
      host.notifyError(error, t('loadFailed'))
    } finally {
      void billing.refetch()
      setRefreshing(false)
    }
  }

  const toggleCollapsed = key => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const pickCategory = id => {
    setCategory(id)
    ctx.storage.set('local.category', id)
  }
  const pickLab = value => {
    setLab(value)
    ctx.storage.set('local.lab', value)
  }
  const pickSort = value => {
    setSort(value)
    ctx.storage.set('local.sort', value)
  }

  const authed = row ? row.authenticated !== false : true
  const hasModels = entries.length > 0
  const loading = catalog.isPending
  const loadError = catalog.isError ? String(catalog.error?.message || catalog.error || t('loadFailed')) : null
  const portalUrl = billing.data?.portal_url || PORTAL_HOME

  const renderRow = m => jsx(ModelRow, {
    m,
    open: openId === m.id,
    onToggle: () => setOpenId(openId === m.id ? null : m.id),
    pendingDefault: pendingDefault === m.id,
    defaultBusy: pendingDefault !== null || m.availabilityPending,
    onSetDefault: setDefault
  }, m.id)

  return jsxs('div', { className: 'np-page', children: [
    jsxs('div', { className: 'np-scroll', children: [
      jsxs('div', { className: 'np-inner', children: [
        jsxs('header', { className: 'np-head', children: [
          jsxs('div', { className: 'np-head-main', children: [
            jsxs('h1', { className: 'np-title', children: [
              jsx('span', { className: 'np-title-mark', 'aria-hidden': true, children: jsx(Codicon, { name: 'credit-card', size: '13px' }) }),
              jsx('span', { children: t('title') })
            ] }),
            jsx('p', { className: 'np-sub', children: t('subtitle') }),
            hasModels
              ? jsxs('div', { className: 'np-stats', children: [
                  jsx('b', { children: t('models', counts.total) }),
                  jsx('span', { className: 'np-stat-sep', 'aria-hidden': true, children: '·' }),
                  jsx('b', { children: t('freeCount', counts.free) }),
                  jsx('span', { className: 'np-stat-sep', 'aria-hidden': true, children: '·' }),
                  jsx('b', { children: t('saleCount', counts.sale) })
                ] })
              : null
          ] }),
          jsxs('div', { className: 'np-head-actions', children: [
            jsx(Button, { variant: 'secondary', size: 'xs', onClick: () => void ctx.os.openExternal(portalUrl), children: t('openPortal') }),
            jsx(Tip, { label: t('refresh'), children:
              jsx(Button, { variant: 'ghost', size: 'icon', 'aria-label': t('refresh'), onClick: () => void refresh(), disabled: refreshing, children:
                refreshing ? jsx(GlyphSpinner, { ariaLabel: t('refresh') }) : jsx(icons.RefreshCw, { 'aria-hidden': true })
              })
            }),
            jsx('div', { className: 'np-settings-row', style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [
              jsx(Button, { variant: 'secondary', size: 'xs', type: 'button', className: refreshSettings.autoRefresh ? 'np-toggle-on' : 'np-toggle-off', 'aria-pressed': refreshSettings.autoRefresh, onClick: () => refreshSettings.changeAuto(!refreshSettings.autoRefresh), children: `${t('autoRefresh')}: ${refreshSettings.autoRefresh ? t('toggleOn') : t('toggleOff')}` }),
              jsx('div', { style: { display: refreshSettings.autoRefresh ? 'flex' : 'none', alignItems: 'center', gap: 6 }, children: [
                jsxs(Select, { value: String(refreshSettings.intervalNum), onValueChange: v => refreshSettings.changeIntervalNum(Number(v)), children: [
                  jsx(SelectTrigger, { size: 'sm', 'aria-label': t('refreshInterval'), children: jsx(SelectValue, {}) }),
                  jsx(SelectContent, { children: REFRESH_INTERVAL_NUMBERS.map(n => jsx(SelectItem, { value: String(n), children: String(n) }, String(n))) })
                ] }),
                jsxs(Select, { value: refreshSettings.intervalUnit, onValueChange: u => refreshSettings.changeIntervalUnit(u), children: [
                  jsx(SelectTrigger, { size: 'sm', children: jsx(SelectValue, {}) }),
                  jsxs(SelectContent, { children: [
                    jsx(SelectItem, { value: 'minutes', children: t('minutes') }, 'minutes'),
                    jsx(SelectItem, { value: 'hours', children: t('hours') }, 'hours')
                  ] })
                ] })
              ] }),
              jsx(Button, { variant: 'secondary', size: 'xs', type: 'button', className: refreshSettings.notifyChanges ? 'np-toggle-on' : 'np-toggle-off', 'aria-pressed': refreshSettings.notifyChanges, onClick: () => refreshSettings.changeNotify(!refreshSettings.notifyChanges), children: `${t('notify')}: ${refreshSettings.notifyChanges ? t('toggleOn') : t('toggleOff')}` })
            ] })
          ] })
        ] }),
        jsx(AccountStrip, { billing: billing.data, ctx, t }),
        billing.isError && billing.data?.logged_in
          ? jsx('div', { className: 'np-notice', role: 'status', children: t('billingFailed') }) : null,
        loadError && hasModels
          ? jsxs('div', { className: 'np-notice', role: 'status', children: [
              jsx('span', { children: t('refreshFailed') }),
              jsx(Button, { variant: 'text', size: 'xs', disabled: refreshing, onClick: () => void refresh(), children: t('retry') })
            ] }) : null,
        hasModels || loading
          ? jsxs('div', { className: 'np-toolbar', children: [
              jsx(SearchField, {
                containerClassName: 'np-search',
                placeholder: t('search'),
                hints: [t('hint1'), t('hint2')],
                value: search,
                onChange: setSearch
              }),
              jsx(SegmentedControl, {
                options: CATEGORIES.map(c => ({ id: c.id, label: t(c.id) })),
                value: categoryDef.id,
                onChange: pickCategory
              }),
              jsxs('div', { className: 'np-selects', children: [
                jsxs(Select, { value: lab, onValueChange: pickLab, children: [
                  jsx(SelectTrigger, { 'aria-label': t('lab'), size: 'sm', children: jsx(SelectValue, {}) }),
                  jsxs(SelectContent, { children: [
                    jsx(SelectItem, { value: '*', children: t('allLabs') }, '*'),
                    labs.map(([key, label]) => jsx(SelectItem, { value: key, children: key === 'other' ? t('otherLab') : label }, key))
                  ] })
                ] }),
                jsxs(Select, { value: sort, onValueChange: pickSort, children: [
                  jsx(SelectTrigger, { 'aria-label': t('recommended'), size: 'sm', children: jsx(SelectValue, {}) }),
                  jsx(SelectContent, { children: [
                    jsx(SelectItem, { value: 'recommended', children: t('recommended') }, 'recommended'),
                    jsx(SelectItem, { value: 'price-asc', children: t('priceAsc') }, 'price-asc'),
                    jsx(SelectItem, { value: 'price-desc', children: t('priceDesc') }, 'price-desc'),
                    jsx(SelectItem, { value: 'output-price-asc', children: t('outputPriceAsc') }, 'output-price-asc'),
                    jsx(SelectItem, { value: 'output-price-desc', children: t('outputPriceDesc') }, 'output-price-desc'),
                    jsx(SelectItem, { value: 'context-desc', children: t('contextDesc') }, 'context-desc'),
                    jsx(SelectItem, { value: 'name', children: t('byName') }, 'name'),
                    jsx(SelectItem, { value: 'discount', children: t('byDiscount') }, 'discount')
                  ] })
                ] })
              ] })
            ] })
          : null,
        jsx(NousNotice, { row, t }),
        catalog.data?.savedPricesAt
          ? jsx('div', { className: 'np-notice', 'data-tone': 'info', role: 'status',
              children: t('savedPrices', new Date(catalog.data.savedPricesAt).toLocaleString()) }) : null,
        hasModels ? jsx('p', { className: 'np-sub', children: t('priceLegend') }) : null,
        loading
          ? jsx('div', { className: 'np-loading', children: jsx(GlyphSpinner, { ariaLabel: t('pendingTitle') }) })
          : loadError && !hasModels
            ? jsx('div', { className: 'np-error', children:
                jsx(ErrorState, { title: t('loadFailed'), description: loadError, children:
                  jsx(Button, { variant: 'secondary', size: 'sm', onClick: () => void catalog.refetch(), children: t('retry') })
                })
              })
            : !hasModels
              ? !authed
                ? jsxs('div', { className: 'np-empty', children: [
                    jsx(EmptyState, { title: t('signInTitle'), description: t('signInDetail') }),
                    jsx('div', { style: { display: 'flex', justifyContent: 'center' }, children:
                      jsx(Button, { variant: 'secondary', size: 'sm', onClick: () => void ctx.os.openExternal(portalUrl), children: t('openPortal') })
                    })
                  ] })
                : jsx('div', { className: 'np-empty', children:
                    jsx(EmptyState, { title: t('emptyTitle'), description: pricingPending ? t('pendingDetail') : t('emptyDetail') })
                  })
                : visible.length === 0
                  ? jsx('div', { className: 'np-empty', children:
                      jsx(EmptyState, { title: t('emptyTitle'), description: t('emptyDetail') })
                    })
                  : jsxs('div', { className: 'np-groups', children: [
                      pricingPending && !catalog.data?.savedPricesAt
                        ? jsxs('div', { className: 'np-notice', 'data-tone': 'info', children: [
                            jsx(GlyphSpinner, { ariaLabel: t('pendingTitle') }),
                            jsx('span', { children: t('pendingDetail') })
                          ] })
                        : null,
                      groups
                        ? groups.map(g => jsx(LabGroup, {
                            lab: g.key, label: g.key === 'other' ? t('otherLab') : g.label, items: g.items,
                            collapsed: collapsed.has(g.key),
                            onToggle: toggleCollapsed,
                            renderItem: renderRow
                          }, g.key))
                        : jsx('div', { className: 'np-rows', children: visible.map(renderRow) })
                    ] })
      ] })
    ] })
  ] })
}

// -- statusbar ---------------------------------------------------------------

function PriceChip({ ctx }) {
  const t = usePluginI18n(ID)
  const profile = useValue(host.state.profile)
  useGatewayWakeup()
  const { catalog } = useCatalog(profile, ctx)
  const row = nousRow(catalog.data)
  const model = catalog.data ? currentModelId(catalog.data, row ?? {}) : null
  const pricing = model ? row?.pricing?.[model] : null
  if (!model || !pricing) return null
  const short = model.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : model
  return jsx('div', { className: 'np-chipbar', children:
    jsx(Tip, { label: t('statusbarTip', model), children:
      jsxs(Button, {
        variant: 'ghost', size: 'micro', 'aria-label': t('statusbarTip', model),
        onClick: () => host.navigate(PATH),
        children: [
          jsx(Codicon, { name: 'credit-card', size: '11px', 'aria-hidden': true }),
          jsx('span', { children: t('defaultPrice') }),
          jsx('span', { style: { maxWidth: '9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: short }),
          jsx('span', { className: 'np-chipbar-price', children: pricing.free
            ? jsx('span', { className: 'np-chipbar-free', children: t('freeBadge') })
            : `${pricing.input || '?'} / ${pricing.output || '?'}` })
        ]
      })
    })
  })
}

// -- plugin ------------------------------------------------------------------



function Page({ ctx }) {
  return jsxs('div', { className: 'np-page', children: [
    jsx('div', { style: { flex: 1, minHeight: 0, overflow: 'hidden' }, children: jsx(PricesPage, { ctx }) }),
    null
  ] });
}

export default {
  id: ID,
  name: 'Nous Portal Pricing',
  description: 'Browse every Nous Portal model with live prices, sale discounts, and free-tier availability.',
  register(ctx) {
    ctx.i18n.register(LOCALES)

    const style = document.createElement('style')
    style.textContent = CSS
    document.head.append(style)
    ctx.onDispose(() => style.remove())

    const open = () => host.navigate(PATH)

    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: PATH },
        render: () => jsx(Page, { ctx })
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        order: 55,
        data: { codicon: 'credit-card', label: ctx.i18n.t('nav'), path: PATH }
      },
      {
        id: 'price',
        area: STATUSBAR_AREAS.right,
        order: 85,
        render: () => jsx(PriceChip, { ctx })
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'nousPrices.open',
          label: ctx.i18n.t('command'),
          keywords: ['nous', 'portal', 'price', 'pricing', 'models', 'cost'],
          run: open
        }
      },
      {
        id: 'open',
        area: KEYBINDS_AREA,
        data: {
          id: 'nousPrices.open',
          category: 'view',
          defaults: ['mod+alt+p'],
          label: ctx.i18n.t('command'),
          run: open
        }
      }
    ])
  }
}
