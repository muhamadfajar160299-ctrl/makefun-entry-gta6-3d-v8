// Marina Nights — grader driver (Node).
// Serves ./game over local HTTP, opens headless Chromium, captures the four
// staged screenshots (?shot=1..4) into MAKEFUN_OUTPUT_DIR (default /output).
// No npm dependencies: talks to Chromium over the DevTools Protocol with the
// built-in WebSocket client. Works as user "nobody", from any cwd, offline.
import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(REPO_DIR, 'game');
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const SHOTS = [1, 2, 3, 4];
const WIDTH = 1280;
const HEIGHT = 720;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function findChromium(): string {
  const candidates: string[] = [];
  if (process.env.CHROMIUM_PATH) candidates.push(process.env.CHROMIUM_PATH);
  if (process.env.CHROMIUM_BIN) candidates.push(process.env.CHROMIUM_BIN);
  const home = process.env.HOME || '';
  if (home) {
    candidates.push(
      join(home, '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell'),
      join(home, '.cache/ms-playwright/chromium-1187/chrome-linux/chrome'),
    );
  }
  candidates.push(
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Last resort: the Muse browser binary refuses headless CDP use without
    // the Hatch domain policy, so it is only listed, never preferred.
    '/opt/meta-chromium/chrome',
  );
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  throw new Error('no Chromium binary found (tried: ' + candidates.join(', ') + ')');
}

function serve(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        let p = decodeURIComponent(url.pathname);
        if (p === '/') p = '/index.html';
        const file = resolve(join(GAME_DIR, '.' + p));
        if (!file.startsWith(GAME_DIR) || !existsSync(file)) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(readFileSync(file));
      } catch (e) {
        res.writeHead(500);
        res.end('error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('could not bind local server'));
        return;
      }
      resolvePromise({ port: addr.port, close: () => server.close() });
    });
  });
}

interface CdpTarget {
  webSocketDebuggerUrl: string;
}

async function jsonGet(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
}

// Minimal CDP client over the built-in WebSocket.
class Cdp {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private onEvent: (method: string, params: any) => void;
  private opened: Promise<void>;

  constructor(url: string, onEvent: (method: string, params: any) => void) {
    this.onEvent = onEvent;
    this.ws = new WebSocket(url);
    this.opened = new Promise((resolvePromise, reject) => {
      this.ws.addEventListener('open', () => resolvePromise());
      this.ws.addEventListener('error', (e) => reject(e));
    });
    this.ws.addEventListener('message', (ev: MessageEvent) => {
      let msg: any;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error('CDP ' + msg.method + ': ' + JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      } else if (msg.method) {
        this.onEvent(msg.method, msg.params || {});
      }
    });
  }

  async ready(): Promise<void> { await this.opened; }

  call(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP call timed out after 20s: ' + method));
      }, 20000);
      this.pending.set(id, {
        resolve: (v: any) => { clearTimeout(timer); resolvePromise(v); },
        reject: (e: any) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression: string): Promise<any> {
    const r = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error('page JS error: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    }
    return r.result ? r.result.value : undefined;
  }

  close(): void { try { this.ws.close(); } catch { /* ignore */ } }
}

async function main(): Promise<number> {
  mkdirSync(OUT_DIR, { recursive: true });
  const chromium = findChromium();
  const { port, close } = await serve();
  const base = 'http://127.0.0.1:' + port;
  console.log('[driver] serving game at ' + base + ' -> ' + OUT_DIR);
  console.log('[driver] chromium: ' + chromium);

  const profile = mkdtempSync(join(tmpdir(), 'marina-chrome-'));
  const debugPort = 19000 + Math.floor(Math.random() * 500);
  const chrome: ChildProcess = spawn(chromium, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--mute-audio',
    '--window-size=' + WIDTH + ',' + HEIGHT,
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + debugPort,
    'about:blank',
  ], { stdio: 'ignore' });

  const errors: string[] = [];
  let cdp: Cdp | null = null;
  try {
    // wait for the DevTools endpoint
    let version: any = null;
    for (let i = 0; i < 60; i++) {
      try { version = await jsonGet('http://127.0.0.1:' + debugPort + '/json/version'); break; }
      catch { await sleep(500); }
    }
    if (!version) throw new Error('Chromium DevTools endpoint did not come up');

    for (const shot of SHOTS) {
      const url = base + '/index.html?shot=' + shot;
      const target: CdpTarget = await jsonGet(
        'http://127.0.0.1:' + debugPort + '/json/new?about:blank'
      ).catch(async () => {
        // older/newer Chrome wants PUT
        const res = await fetch('http://127.0.0.1:' + debugPort + '/json/new?about:blank', { method: 'PUT' });
        return res.json();
      });
      cdp = new Cdp(target.webSocketDebuggerUrl, (method, params) => {
        if (method === 'Runtime.exceptionThrown') {
          errors.push('shot ' + shot + ' exception: ' + JSON.stringify(params).slice(0, 400));
        }
        if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
          errors.push('shot ' + shot + ' console.error: ' + JSON.stringify(params.args).slice(0, 400));
        }
      });
      await cdp.ready();
      await cdp.call('Page.enable');
      await cdp.call('Runtime.enable');
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
      });
      await cdp.call('Page.navigate', { url });
      // wait for the game to signal readiness
      let ready = false;
      for (let i = 0; i < 120; i++) {
        await sleep(250);
        try {
          ready = await cdp.evalJs('window.__gameReady === true');
          if (ready) break;
        } catch { /* page still loading */ }
      }
      if (!ready) throw new Error('shot ' + shot + ': game did not become ready in 30s');
      await sleep(1800); // let the staged scene settle (police, pedestrians, beacon)
      const shot2 = await cdp.call('Page.captureScreenshot', { format: 'png' });
      const out = join(OUT_DIR, 'shot-' + shot + '.png');
      writeFileSync(out, Buffer.from(shot2.data, 'base64'));
      console.log('[driver] shot ' + shot + ' -> ' + out);
      cdp.close();
      cdp = null;
      // Close the target so its game loop stops rendering: otherwise every
      // earlier shot page keeps burning SwiftShader in the background and
      // each later shot gets slower until CDP calls stall.
      try {
        await fetch('http://127.0.0.1:' + debugPort + '/json/close/' + target.id);
      } catch { /* already gone */ }
    }
  } finally {
    if (cdp) cdp.close();
    try { chrome.kill('SIGKILL'); } catch { /* ignore */ }
    close();
  }

  // Post-capture verification: every staged shot must exist and hold real
  // image data — a 0-byte or thumbnail-sized PNG means the scene never
  // rendered, and the submit must not go out on that.
  const { statSync } = await import('node:fs');
  let verifyOk = true;
  for (const shot of SHOTS) {
    const out = join(OUT_DIR, 'shot-' + shot + '.png');
    try {
      const size = statSync(out).size;
      const ok = size > 10000;
      console.log('[driver] verify: shot-' + shot + '.png ' + size + ' bytes ' + (ok ? 'OK' : 'TOO SMALL'));
      if (!ok) verifyOk = false;
    } catch {
      console.error('[driver] verify: shot-' + shot + '.png MISSING');
      verifyOk = false;
    }
  }
  if (!verifyOk) {
    console.error('[driver] screenshot verification FAILED');
    return 1;
  }

  if (errors.length > 0) {
    console.error('[driver] page JS errors detected:');
    for (const e of errors) console.error('  ' + e);
    return 1;
  }
  console.log('[driver] all 4 screenshots captured, exit 0');
  return 0;
}

process.exitCode = await main().catch((e: unknown) => {
  console.error('[driver] FATAL: ' + (e instanceof Error ? e.stack || e.message : String(e)));
  return 1;
});
