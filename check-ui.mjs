// check-ui.mjs — 只读检查当前 UI 语言状态
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 9222;
const SDK_KEY = 'client-sYWqzCYMRkUg4DqqiZcR5DGTNl2iD7zNJY0HoeDLzxR';

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

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
  attachWs(ws);
  await cdpSend(ws, 'Runtime.enable');
  const r = await cdpSend(ws, 'Runtime.evaluate', { returnByValue: true, expression: `(function(){
    const text = ((document.body||{}).innerText)||'';
    const cjk = (text.match(/[\\u4e00-\\u9fff]/g)||[]).length;
    const latin = (text.match(/[a-zA-Z]/g)||[]).length;
    let i18n = null;
    try {
      const inst = window.__STATSIG__.instances['${SDK_KEY}'];
      const l = inst.getLayer('72216192');
      i18n = l.get('enable_i18n', false);
    } catch(e) { i18n = 'err:' + String(e).slice(0,50); }
    return JSON.stringify({ cjk, latin, i18n, sample: text.slice(0, 400) });
  })()` });
  console.log(r.result.value);
}
main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
