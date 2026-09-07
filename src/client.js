// =============================================================================
// Floating Tetris — shared game engine + UI (host-resident client plugin)
// -----------------------------------------------------------------------------
// 这份源码与“动态 cordis_define 函数体”等价，但已模块化：
//   * import React（宿主浏览器半区用 tsdown 打包，ModuleLoader require('react')）
//   * 去掉 Run 卡片专用的 tool.view.cordis 注册与 QuickLaunch
//   * 末尾导出宿主插件对象（apply + inject），由 client 半区入口消费
// 入口与装配见同目录 index.* 与 host-plugin/README.md。
// =============================================================================

import * as React from 'react'

const el = React.createElement

const COLS = 10
const ROWS = 20
const CELL = 18
const LS_KEY = 'dsh.tetris.records.v1'
const PALETTE = { 1: '#22d3ee', 2: '#facc15', 3: '#a78bfa', 4: '#4ade80', 5: '#f87171', 6: '#60a5fa', 7: '#fb923c' }
const TYPE_IDX = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
const SPAWN = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
}
const SCORE_TABLE = [0, 100, 300, 500, 800]

const THEMES = {
  dark: {
    windowBg: 'rgba(10,15,30,.52)',
    text: '#e2e8f0',
    border: 'rgba(148,163,184,.42)',
    headerBorder: 'rgba(148,163,184,.28)',
    boardBorder: 'rgba(148,163,184,.3)',
    cellEmpty: 'rgba(255,255,255,.03)',
    cellLine: 'rgba(148,163,184,.18)',
    btnBg: 'rgba(148,163,184,.14)',
    btnBorder: 'rgba(148,163,184,.42)',
    sub: 'rgba(226,232,240,.68)',
    overBg: 'rgba(10,15,30,.8)',
    overText: '#f8fafc',
    overBtnBg: '#f8fafc',
    overBtnText: '#0f172a',
    shadow: '0 14px 44px rgba(0,0,0,.5)'
  },
  light: {
    windowBg: 'rgba(250,252,255,.6)',
    text: '#0f172a',
    border: 'rgba(100,116,139,.42)',
    headerBorder: 'rgba(100,116,139,.25)',
    boardBorder: 'rgba(100,116,139,.32)',
    cellEmpty: 'rgba(15,23,42,.03)',
    cellLine: 'rgba(100,116,139,.25)',
    btnBg: 'rgba(255,255,255,.7)',
    btnBorder: 'rgba(100,116,139,.42)',
    sub: 'rgba(15,23,42,.62)',
    overBg: 'rgba(248,250,252,.9)',
    overText: '#0f172a',
    overBtnBg: '#0f172a',
    overBtnText: '#f8fafc',
    shadow: '0 14px 44px rgba(15,23,42,.28)'
  }
}

function emptyBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
}
function shuffle(a) {
  const arr = a.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t
  }
  return arr
}
function rotCW(m) {
  const h = m.length, w = m[0].length, out = []
  for (let c = 0; c < w; c++) {
    const row = []
    for (let r = h - 1; r >= 0; r--) row.push(m[r][c])
    out.push(row)
  }
  return out
}
function rotCCW(m) { return rotCW(rotCW(rotCW(m))) }
function collides(board, m, x, y) {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue
      const xx = x + c, yy = y + r
      if (xx < 0 || xx >= COLS || yy >= ROWS) return true
      if (yy >= 0 && board[yy] && board[yy][xx]) return true
    }
  }
  return false
}
function mergeBoard(board, m, x, y, color) {
  const b = board.map(r => r.slice())
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (m[r][c] && y + r >= 0 && b[y + r]) b[y + r][x + c] = color
    }
  }
  return b
}
function speedFor(level) { return Math.max(90, 760 - (level - 1) * 70) }
function takeType(bag) {
  const nb = bag.slice()
  let type = nb.shift()
  if (nb.length === 0) nb.push(...shuffle(TYPES))
  return { type, bag: nb }
}
function spawnState(board, bag, base) {
  const t = takeType(bag)
  const m = SPAWN[t.type]
  const piece = { m: m.map(r => r.slice()), x: Math.floor((COLS - m[0].length) / 2), y: 0, color: PALETTE[TYPE_IDX[t.type]] }
  const over = collides(board, piece.m, piece.x, piece.y)
  return Object.assign({}, base, { board, piece: over ? null : piece, over, bag: t.bag })
}
function newGameState() {
  return spawnState(emptyBoard(), shuffle(TYPES), { score: 0, lines: 0, level: 1, paused: false })
}
function clearAndSpawn(s, board, extraScore) {
  const kept = []
  let cleared = 0
  for (let y = 0; y < ROWS; y++) {
    const row = board[y] || new Array(COLS).fill(0)
    if (row.every(v => v)) cleared++
    else kept.push(row.slice())
  }
  while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0))
  const lines = s.lines + cleared
  const level = Math.floor(lines / 10) + 1
  const base = { score: s.score + SCORE_TABLE[cleared] + extraScore, lines, level, paused: s.paused }
  return spawnState(kept, s.bag || shuffle(TYPES), base)
}
function lockNow(s) {
  const p = s.piece
  if (!p) return s
  return clearAndSpawn(s, mergeBoard(s.board, p.m, p.x, p.y, p.color), 0)
}
function tick(s) {
  if (s.over || s.paused || !s.piece) return s
  const p = s.piece
  if (!collides(s.board, p.m, p.x, p.y + 1)) return Object.assign({}, s, { piece: Object.assign({}, p, { y: p.y + 1 }) })
  return lockNow(s)
}
function softDown(s) {
  if (s.over || s.paused || !s.piece) return s
  const p = s.piece
  if (collides(s.board, p.m, p.x, p.y + 1)) return s
  return Object.assign({}, s, { piece: Object.assign({}, p, { y: p.y + 1 }), score: s.score + 1 })
}
function tryShift(s, dx) {
  if (!s || s.over || s.paused || !s.piece) return s
  const p = s.piece
  if (collides(s.board, p.m, p.x + dx, p.y)) return s
  return Object.assign({}, s, { piece: Object.assign({}, p, { x: p.x + dx }) })
}
function tryRotate(s, dir) {
  if (!s || s.over || s.paused || !s.piece) return s
  const p = s.piece
  const m = dir > 0 ? rotCW(p.m) : rotCCW(p.m)
  const kicks = [0, -1, 1, -2, 2]
  for (let i = 0; i < kicks.length; i++) {
    const off = kicks[i]
    if (!collides(s.board, m, p.x + off, p.y)) return Object.assign({}, s, { piece: Object.assign({}, p, { m, x: p.x + off }) })
  }
  return s
}
function hardDrop(s) {
  if (!s || s.over || s.paused || !s.piece) return s
  let p = s.piece, y = p.y, d = 0
  while (!collides(s.board, p.m, p.x, y + 1)) { y++; d++ }
  return clearAndSpawn(s, mergeBoard(s.board, p.m, p.x, y, p.color), 2 * d)
}

function normState(s) {
  let src = s
  if (!src || typeof src !== 'object') src = {}
  let board = src.board
  if (!Array.isArray(board) || board.length !== ROWS) board = emptyBoard()
  else {
    board = board.map(row => Array.isArray(row) ? row : new Array(COLS).fill(0))
  }
  const bag = Array.isArray(src.bag) && src.bag.length ? src.bag.slice() : shuffle(TYPES)
  const piece = src.piece || null
  return {
    board, bag, piece,
    score: typeof src.score === 'number' ? src.score : 0,
    lines: typeof src.lines === 'number' ? src.lines : 0,
    level: typeof src.level === 'number' ? src.level : 1,
    paused: !!src.paused,
    over: !!src.over
  }
}

function loadRecords() {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(r => r && typeof r.score === 'number').slice(0, 10)
  } catch (err) {
    return []
  }
}
function saveRecords(list) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 10)))
  } catch (err) {}
}
function pushRecord(entry) {
  const list = loadRecords()
  list.unshift(entry)
  const trimmed = list.slice(0, 10)
  saveRecords(trimmed)
  return trimmed
}
function sortByScore(list) {
  return list.slice().sort((a, b) => (b.score - a.score) || ((b.at || 0) - (a.at || 0)))
}
function nowTs() {
  return typeof Date !== 'undefined' ? Date.now() : 0
}

function winDefaultPos() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  return { x: Math.max(12, Math.round((vw - 332) / 2)), y: 72 }
}
function makeStore() {
  return {
    open: true,
    theme: 'dark',
    pos: null,
    listeners: new Set(),
    emit() { this.listeners.forEach(f => f()) },
    sub(f) { this.listeners.add(f); return () => this.listeners.delete(f) },
    toggle() { this.open = !this.open; this.emit() },
    close() { if (this.open) { this.open = false; this.emit() } },
    setPos(x, y) { this.pos = { x, y }; this.emit() },
    toggleTheme() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; this.emit() }
  }
}
function useStore(store) {
  const [, force] = React.useState(0)
  React.useEffect(() => store.sub(() => force(n => n + 1)), [])
  return store
}

const left = (st) => tryShift(st, -1)
const right = (st) => tryShift(st, 1)
const rot = (st) => tryRotate(st, 1)
const rotCC = (st) => tryRotate(st, -1)
const drop = (st) => hardDrop(st)
const down = (st) => softDown(st)
const togglePause = (st) => Object.assign({}, st, { paused: !st.paused })

function LaunchButton(props) {
  const store = props.store
  useStore(store)
  const wide = props.wide
  const style = {
    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    background: 'transparent', border: 'none', color: 'inherit',
    fontSize: 13, padding: '6px 8px', borderRadius: 6
  }
  return el('button', { style, title: store.open ? '收起俄罗斯方块' : '打开俄罗斯方块', onClick: () => store.toggle() },
    el('span', { style: { fontSize: 16 } }, '🎮'),
    wide ? el('span', null, store.open ? '收起方块' : '俄罗斯方块') : null
  )
}

function TetrisWindow(props) {
  const store = props.store
  const ctx = props.ctx
  useStore(store)
  const [s, setS] = React.useState(newGameState)
  const [records, setRecords] = React.useState(loadRecords)
  const [showRank, setShowRank] = React.useState(false)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [lastAt, setLastAt] = React.useState(0)
  const [mini, setMini] = React.useState(false)
  const drag = React.useState({ on: false })[0]
  const prevOver = React.useState({ current: false })[0]
  const open = store.open
  const pos = store.pos || winDefaultPos()
  const v = normState(s)
  const th = THEMES[store.theme] || THEMES.dark
  const sortedRecords = sortByScore(records)

  React.useEffect(() => {
    if (!open || showRank || mini || v.over || v.paused || !v.piece) return
    return ctx.interval(() => setS(tick), speedFor(v.level))
  }, [open, showRank, mini, v.over, v.paused, v.level])

  React.useEffect(() => {
    if (!open) return
    const w = typeof window !== 'undefined' ? window : null
    if (!w) return
    const onKeyDown = (e) => {
      const t = e.target
      const tag = t && t.tagName ? String(t.tagName).toUpperCase() : ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
      const k = e.key
      let handled = true
      if (k === 'ArrowLeft') setS(left)
      else if (k === 'ArrowRight') setS(right)
      else if (k === 'ArrowDown') setS(down)
      else if (k === 'ArrowUp' || k === 'x' || k === 'X') setS(rot)
      else if (k === 'z' || k === 'Z') setS(rotCC)
      else if (k === ' ' || k === 'Spacebar') setS(drop)
      else if (k === 'p' || k === 'P') setS(togglePause)
      else handled = false
      if (handled) e.preventDefault()
    }
    w.addEventListener('keydown', onKeyDown)
    return () => w.removeEventListener('keydown', onKeyDown)
  }, [open])

  React.useEffect(() => {
    if (v.over && !prevOver.current) {
      const ts = nowTs()
      const updated = pushRecord({ score: v.score, lines: v.lines, level: v.level, at: ts })
      setRecords(updated)
      setLastAt(ts)
    }
    prevOver.current = v.over
  }, [v.over])

  const act = (fn) => setS(fn)
  const stopEvt = (e) => { e.stopPropagation(); e.preventDefault() }
  const openRank = () => { setMini(false); setShowRank(true) }
  const closeRank = () => setShowRank(false)
  const startNew = () => { setShowRank(false); setConfirmClear(false); setMini(false); act(newGameState) }
  const collapseToBar = () => { setShowRank(false); setMini(true) }
  const hideAll = () => { store.close() }
  const clearAll = () => {
    saveRecords([])
    setRecords([])
    setLastAt(0)
    setConfirmClear(false)
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    const cur = e.currentTarget
    try { cur.setPointerCapture(e.pointerId) } catch (err) {}
    drag.on = true
    drag.px = e.clientX
    drag.py = e.clientY
    drag.sx = pos.x
    drag.sy = pos.y
  }
  const onPointerMove = (e) => {
    if (!drag.on) return
    const vw = typeof window !== 'undefined' ? window.innerWidth : 4000
    const vh = typeof window !== 'undefined' ? window.innerHeight : 3000
    let nx = drag.sx + (e.clientX - drag.px)
    let ny = drag.sy + (e.clientY - drag.py)
    nx = Math.max(-(332 - 70), Math.min(nx, vw - 70))
    ny = Math.max(0, Math.min(ny, vh - 50))
    store.setPos(nx, ny)
  }
  const onPointerUp = () => { drag.on = false }
  const noFocus = (e) => e.preventDefault()

  const rankRows = sortedRecords.slice(0, 10).map((r, i) => {
    const isNew = v.over && lastAt > 0 && r.at === lastAt
    return el('div', {
      key: 'r' + i,
      style: {
        display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12,
        padding: '2px 4px', borderRadius: 4,
        background: isNew ? th.btnBg : 'transparent',
        fontWeight: isNew ? 700 : 400
      }
    },
      el('span', null, '#' + (i + 1) + '  ' + r.score + ' 分' + (isNew ? ' ←' : '')),
      el('span', { style: { opacity: .7 } }, r.lines + ' 行 · Lv' + r.level)
    )
  })

  const rankTitle = el('div', { style: { fontSize: 14, fontWeight: 700 } }, '🏆 排行榜')
  const rankNote = el('div', { style: { fontSize: 11, opacity: .65 } }, '最近 10 局 · 按分数从高到低 · 数据仅保存在本机浏览器')
  const rankEmpty = el('div', { style: { fontSize: 12, opacity: .7, padding: 4 } }, '暂无记录，去玩一局吧')
  const rankListWrap = el('div', { style: { maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 } },
    sortedRecords.length ? rankRows : rankEmpty
  )

  const board = v.board
  const p = v.piece
  const rows = []
  for (let y = 0; y < ROWS; y++) {
    const rowSrc = board[y] || new Array(COLS).fill(0)
    const cells = []
    for (let x = 0; x < COLS; x++) {
      let color = rowSrc[x] || null
      if (p && !v.over && y >= p.y && y < p.y + p.m.length && x >= p.x && x < p.x + p.m[0].length) {
        const cellRow = p.m[y - p.y]
        if (cellRow && cellRow[x - p.x]) color = p.color
      }
      const cellStyle = {
        width: CELL, height: CELL,
        background: color || th.cellEmpty,
        boxShadow: color ? 'inset 0 0 0 1px rgba(255,255,255,.22)' : 'inset 0 0 0 1px ' + th.cellLine
      }
      cells.push(el('div', { key: y + '-' + x, style: cellStyle }))
    }
    rows.push(el('div', { key: y, style: { display: 'flex' } }, cells))
  }

  const nextType = v.bag.length ? v.bag[0] : 'I'
  const nextM = SPAWN[nextType] || [[1, 1, 1, 1]]
  const nextCells = []
  for (let r = 0; r < nextM.length; r++) {
    const cs = []
    for (let c = 0; c < nextM[r].length; c++) {
      const style = {
        width: 12, height: 12,
        background: nextM[r][c] ? PALETTE[TYPE_IDX[nextType]] : 'transparent',
        boxShadow: nextM[r][c] ? 'none' : 'inset 0 0 0 1px ' + th.cellLine
      }
      cs.push(el('div', { key: c, style }))
    }
    nextCells.push(el('div', { key: r, style: { display: 'flex' } }, cs))
  }

  const statStyle = { fontSize: 12, margin: '3px 0', color: th.sub }
  const btn = (label, fn, title) => el('button', {
    onMouseDown: noFocus, onClick: () => act(fn), title,
    style: { cursor: 'pointer', margin: 2, padding: '3px 7px', borderRadius: 5, fontSize: 13, color: 'inherit', border: '1px solid ' + th.btnBorder, background: th.btnBg }
  }, label)
  const rawBtn = (label, fn, title, danger) => el('button', {
    onMouseDown: noFocus, onClick: fn, title,
    style: { cursor: 'pointer', margin: 2, padding: '3px 7px', borderRadius: 5, fontSize: 13, color: danger ? '#ef4444' : 'inherit', border: '1px solid ' + (danger ? 'rgba(239,68,68,.6)' : th.btnBorder), background: danger ? 'rgba(239,68,68,.12)' : th.btnBg }
  }, label)

  const panel = el('div', { style: { padding: '10px 12px', minWidth: 108, flex: 1 } },
    el('div', { style: { fontSize: 12, opacity: .65, marginBottom: 2, color: th.sub } }, '分数'),
    el('div', { style: { fontSize: 20, fontWeight: 700, marginBottom: 8 } }, String(v.score)),
    el('div', { style: statStyle }, '等级 ' + v.level),
    el('div', { style: statStyle }, '行数 ' + v.lines),
    el('div', { style: Object.assign({ marginTop: 10, marginBottom: 4 }, statStyle, { opacity: .65 }) }, '下一个'),
    el('div', { style: { display: 'inline-block', padding: 4, border: '1px solid ' + th.cellLine, borderRadius: 6 } }, nextCells),
    el('div', { style: { marginTop: 12 } },
      btn('←', left, '左移'),
      btn('→', right, '右移'),
      btn('↻', rot, '旋转'),
      btn('⤓', drop, '硬降'),
      btn('▼', down, '软降')
    ),
    el('div', { style: { marginTop: 6 } },
      btn(v.paused ? '▶ 继续' : 'Ⅱ 暂停', togglePause, '暂停/继续'),
      btn('↺ 新局', newGameState, '重新开始'),
      rawBtn('🏆', openRank, '最近成绩')
    )
  )

  const headerBtn = (label, fn, title) => el('button', {
    onPointerDown: stopEvt, onMouseDown: noFocus, onClick: fn, title,
    style: { cursor: 'pointer', border: 'none', background: 'transparent', fontSize: 15, padding: '2px 6px', color: 'inherit', borderRadius: 5, lineHeight: 1 }
  }, label)

  const header = el('div', {
    onPointerDown, onPointerMove, onPointerUp,
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 10px', cursor: 'grab', userSelect: 'none',
      borderBottom: '1px solid ' + th.headerBorder, fontSize: 13, fontWeight: 600,
      whiteSpace: 'nowrap', overflow: 'hidden'
    }
  },
    el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, '🕹️ 俄罗斯方块'),
    mini
      ? el('div', { style: { display: 'flex', alignItems: 'center', gap: 2 } },
          headerBtn('□ 还原', () => setMini(false), '还原完整界面'),
          headerBtn('✕', hideAll, '彻底隐藏（可从侧栏或 Run 卡片重新打开）')
        )
      : el('div', { style: { display: 'flex', alignItems: 'center', gap: 2 } },
          headerBtn('▁', collapseToBar, '收起为标题条（自动暂停）'),
          headerBtn('🏆', openRank, '最近成绩排行'),
          headerBtn(store.theme === 'dark' ? '☀️' : '🌙', () => store.toggleTheme(), '切换深浅色'),
          headerBtn('✕', collapseToBar, '收起为标题条（自动暂停）')
        )
  )

  const boardWrap = el('div', { style: { display: 'flex', gap: 8 } },
    el('div', { style: { padding: 5, background: 'transparent', border: '1px solid ' + th.boardBorder, borderRadius: 6 } }, rows),
    panel
  )

  const rankOverlay = el('div', {
    style: { position: 'absolute', inset: 0, zIndex: 6, background: th.overBg, borderRadius: 8, color: th.overText, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }
  },
    rankTitle,
    rankNote,
    rankListWrap,
    el('div', { style: { marginTop: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 } },
      rawBtn('◀ 返回游戏', closeRank, '返回'),
      rawBtn('↺ 新局', startNew, '重新开始'),
      el('span', { style: { flex: 1 } }),
      rawBtn(confirmClear ? '确认清空？' : '🗑 清空', () => confirmClear ? clearAll() : setConfirmClear(true), '清空最近记录', true)
    )
  )

  const overOverlay = el('div', {
    style: { position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', background: th.overBg, borderRadius: 8, color: th.overText, padding: 14, gap: 8 }
  },
    el('div', { style: { fontSize: 20, fontWeight: 700 } }, '游戏结束'),
    el('div', { style: { fontSize: 14 } }, '最终得分 ' + v.score),
    el('div', { style: { fontSize: 12, alignSelf: 'flex-start', opacity: .8 } }, '🏆 排行榜（本局 ← 高亮）：'),
    rankListWrap,
    el('div', { style: { marginTop: 'auto', textAlign: 'center' } },
      el('button', { onClick: () => act(newGameState), style: { cursor: 'pointer', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, background: th.overBtnBg, color: th.overBtnText } }, '再来一局')
    )
  )

  const bodyWrap = el('div', { style: { padding: 8, position: 'relative' } },
    boardWrap,
    showRank ? rankOverlay : null,
    (!showRank && v.over) ? overOverlay : null
  )

  const windowStyle = {
    position: 'fixed', left: 0, top: 0,
    width: mini ? 232 : 332, transform: 'translate(' + pos.x + 'px,' + pos.y + 'px)',
    background: th.windowBg,
    backdropFilter: 'blur(16px) saturate(150%)',
    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
    color: th.text,
    borderRadius: 12, boxShadow: th.shadow,
    border: '1px solid ' + th.border,
    fontFamily: 'system-ui, sans-serif', zIndex: 2147483000,
    display: open ? 'block' : 'none'
  }

  return el('div', { style: windowStyle },
    header,
    mini ? null : bodyWrap
  )
}

// ── host-resident client plugin exports ──────────────────────────────────────
export const inject = ['timer']

export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  const store = makeStore()
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'tetris-launch', order: 5, label: '俄罗斯方块' },
    (props) => el(LaunchButton, { store, wide: !!props.wide })
  ))
  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'tetris-window', order: 10, label: '俄罗斯方块' },
    (props) => el(TetrisWindow, { store, ctx })
  ))
}
