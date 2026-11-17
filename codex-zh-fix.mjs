// codex-zh-fix.mjs v2 — Codex 桌面版中文界面修复（localStorage 缓存注入，运行时捕获键名）
// 依据从本机 app.asar 提取的 @statsig/js-client 真实实现：
//   - 缓存键: statsig.cached.evaluations.<DJB2(sdkKey|user)>，读取时仅校验 stableID
//   - 缓存条目: { source, data(JSON字符串,含has_updates), receivedAt, stableID, fullUserHash }
//   - V2 layer: layer_configs['72216192'] -> {v, r, s, ep, pr} + values[v] = {enable_i18n:true,...}
// 用法: node codex-zh-fix.mjs [--revert|--inspect]
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 9222;
const MODE = process.argv[2] || '--apply';
const SDK_KEY = 'client-sYWqzCYMRkUg4DqqiZcR5DGTNl2iD7zNJY0HoeDLzxR';
const LAYER_ID = '72216192';
const EXE = process.env.CODEX_EXE ||
  'C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0\\app\\ChatGPT.exe';

function djb2(s) { let t = 0; for (let i = 0; i < s.length; i++) { t = (t << 5) - t + s.charCodeAt(i); t &= t; } return String(t >>> 0); }

function fakeData() {
  return JSON.stringify({
    response_format: 'init-v2',
    feature_gates: {},
    dynamic_configs: {},
    layer_configs: {
      [LAYER_ID]: {
        v: 'zh_fix_vk',
        r: 'default',
        s: [],
        ep: ['enable_i18n', 'locale_source'],
        pr: { enable_i18n: 'default', locale_source: 'default' },
      },
    },
    param_stores: {},
    values: { zh_fix_vk: { enable_i18n: true, locale_source: 'IDE' } },
    exposures: {},
    time: Date.now(),
    has_updates: true,
  });
}

function buildEntry(stableID) {
  return JSON.stringify({
    source: 'Cache',
    data: fakeData(),
    receivedAt: Date.now(),
    stableID,
    fullUserHash: null,
  });
}

// ---------- CDP ----------
let _id = 0;
const pending = new Map();
function cdpSend(ws, method, params = {}, timeoutMs = 30000) {
  const id = ++_id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
    pending.set(id, { resolve, reject, t });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function attachWs(ws) {
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(p.t);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  };
}
async function connectWs(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
  attachWs(ws);
  return ws;
}

async function launch() {
  try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); console.log('[应用] 已在运行'); }
  catch {
    console.log(`[启动] ${EXE}`);
    const c = spawn(EXE, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' });
    c.unref();
    let ok = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); ok = true; break; } catch {}
    }
    if (!ok) throw new Error('调试端口未就绪');
    await sleep(6000);
  }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && /app:\/\/|codex|chatgpt/i.test(t.url)) || list.find((t) => t.type === 'page');
  if (!page) throw new Error('未找到页面 target');
  const ws = await connectWs(page.webSocketDebuggerUrl);
  await cdpSend(ws, 'Runtime.enable');
  await cdpSend(ws, 'Page.enable');
  return { ws, url: page.url };
}

async function evalJs(ws, expr) {
  const r = await cdpSend(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面脚本异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}

async function gracefulClose(ws) {
  try {
    await evalJs(ws, `window.onbeforeunload=null; 'ok'`);
  } catch {}
  try {
    const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    const bws = await connectWs(v.webSocketDebuggerUrl);
    await cdpSend(bws, 'Browser.close');
    await sleep(2000);
    console.log('[退出] 已正常关闭（确保刷盘）');
  } catch (e) {
    console.log(`[退出] Browser.close 失败(${e.message})，请手动退出`);
  }
}

const HOOK = `(function(){
  if (window.__zhHookInstalled) return;
  window.__zhHookInstalled = true;
  window.__zhCaptured = [];
  const gi = Storage.prototype.getItem;
  Storage.prototype.getItem = function(k){
    try {
      if (typeof k === 'string' && k.indexOf('statsig.cached.evaluations') === 0 && window.__zhCaptured.indexOf(k) < 0) window.__zhCaptured.push(k);
    } catch(e){}
    return gi.call(this, k);
  };
})();`;

async function main() {
  const { ws } = await launch();
  console.log('[页面] 已连接');

  if (MODE === '--inspect' || MODE === '--revert') {
    const keys = await evalJs(ws, `JSON.stringify(Object.keys(localStorage).filter(k=>k.indexOf('statsig.cached.evaluations')===0))`);
    if (MODE === '--revert') {
      const n = await evalJs(ws, `(function(){const r=[];Object.keys(localStorage).forEach(k=>{if(k.indexOf('statsig.cached.evaluations')===0){localStorage.removeItem(k);r.push(k);}});return JSON.stringify(r);})()`);
      console.log('[回退] 已删除:', n);
    } else {
      console.log('[检查] evaluations 缓存键:', keys);
      const detail = await evalJs(ws, `JSON.stringify(Object.keys(localStorage).filter(k=>k.indexOf('statsig.cached.evaluations')===0).map(k=>{try{const o=JSON.parse(localStorage.getItem(k));let d=o.data;if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){}}const lc=d&&d.layer_configs&&d.layer_configs['${LAYER_ID}'];return {key:k, format:d&&d.response_format, i18n:!!(lc&&d.values[lc.v]&&d.values[lc.v].enable_i18n), source:o.source};}catch(e){return {key:k, err:String(e)}}}))`);
      console.log('[检查] 详情:', detail);
    }
    await gracefulClose(ws);
    return;
  }

  // --apply
  const rawStable = await evalJs(ws, `localStorage.getItem('statsig.stable_id.685440364') || ''`);
  // Storage 里是 JSON.stringify 后的值（可能带引号），StableID.get() 会 JSON.parse 后比较
  let stableID = rawStable;
  try {
    const p = JSON.parse(rawStable);
    if (typeof p === 'string') stableID = p;
  } catch {}
  console.log(`[stableID] raw=${rawStable.slice(0, 20)}... 解析后=${stableID.slice(0, 20)}...`);

  // 1. 安装捕获钩子（下次导航生效）并重载，捕获 SDK 真实查询的缓存键
  await cdpSend(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  await cdpSend(ws, 'Page.reload', { ignoreCache: false }).catch(() => {});
  await sleep(10000);
  let captured = [];
  try { captured = JSON.parse(await evalJs(ws, `JSON.stringify(window.__zhCaptured||[])`)); } catch {}
  console.log('[捕获] SDK 查询的 evaluations 缓存键:', JSON.stringify(captured));

  // 2. 计算候选键（user=null 与 user={} 两种），与捕获键合并
  const kNull = `statsig.cached.evaluations.${djb2('k:' + SDK_KEY)}`;
  const kEmpty = `statsig.cached.evaluations.${djb2(['uid:', 'cids:', 'k:' + SDK_KEY].join('|'))}`;
  const targetKeys = [...new Set([...captured, kNull, kEmpty])];
  console.log('[写入] 目标键:', JSON.stringify(targetKeys));

  const entry = buildEntry(stableID);
  const written = await evalJs(ws, `(function(){
    const keys = ${JSON.stringify(targetKeys)};
    const val = ${JSON.stringify(entry)};
    const r = [];
    keys.forEach(k => { try { localStorage.setItem(k, val); r.push(k); } catch(e){} });
    return JSON.stringify(r);
  })()`);
  console.log('[写入] 完成:', written);

  // 3. 卸载钩子并重载，让 SDK 从缓存初始化
  await cdpSend(ws, 'Page.removeScriptToEvaluateOnNewDocument', {}).catch(() => {});
  await cdpSend(ws, 'Page.reload', { ignoreCache: false }).catch(() => {});
  await sleep(15000);

  // 4. 验证：缓存是否命中 + 界面中文
  const check = await evalJs(ws, `(function(){
    const hit = (window.__zhCaptured||[]).length;
    const cjk = (((document.body||{}).innerText)||'').match(/[\\u4e00-\\u9fff]/g);
    return JSON.stringify({ cjk: cjk ? cjk.length : 0, capturedReads: hit });
  })()`);
  console.log('[验证#1]', check);
  if (JSON.parse(check).cjk < 150) {
    await sleep(15000);
    const check2 = await evalJs(ws, `JSON.stringify({cjk: ((((document.body||{}).innerText)||'').match(/[\\u4e00-\\u9fff]/g)||[]).length})`);
    console.log('[验证#2] 复查:', check2);
  }

  await gracefulClose(ws);
  console.log('完成。请重新正常启动 Codex 查看界面语言。');
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
