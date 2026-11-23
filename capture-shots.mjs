// VELMARA screenshot capture — serves the game over local HTTP, drives
// headless Chromium over CDP, and shoots the four staged scenarios as
// 1280x720 JPEGs. Fails loudly on any page error or bad file size.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.join(ROOT, "game");
const SHOTS_DIR = path.join(ROOT, "screenshots");
const CHROME = "/home/hatch/workspace/metamask-chrome/chromium/chrome-linux/chrome";
const CDP_PORT = 9223;
const WIDTH = 1280;
const HEIGHT = 720;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg"
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://127.0.0.1");
        if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
        let p = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
        if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
        if (p.endsWith(path.sep)) p = path.join(p, "index.html");
        const data = await readFile(p);
        res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error("CDP did not come up at " + url);
}

async function newTarget(url) {
  // Newer Chromium wants PUT here; older builds accept GET.
  let r = await fetch(
    `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" }
  );
  if (!r.ok) {
    r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`);
  }
  if (!r.ok) throw new Error("could not open target, HTTP " + r.status);
  return await r.json();
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        this.errors.push("exception: " + (d.exception?.description || d.text || "unknown"));
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.errors.push("console.error: " + JSON.stringify(msg.params.args.map((a) => a.value ?? a.description ?? "")));
      } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        const text = msg.params.entry.text || "";
        const url = msg.params.entry.url || "";
        if (!/favicon/i.test(text) && !/favicon/i.test(url)) this.errors.push("log: " + text);
      }
    };
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    const p = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return p;
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function shootOne(cdp, baseUrl, n) {
  const url = `${baseUrl}/game/index.html?shot=${n}`;
  await cdp.send("Page.navigate", { url });
  await sleep(7000); // let the scene settle: traffic, strobes, diamond
  const diag = await cdp.send("Runtime.evaluate", {
    expression: "JSON.stringify({title: document.title, err: document.body.getAttribute('data-pageerror'), canvas: (document.querySelector('#game-root canvas')||{}).width, speed: document.getElementById('hud-speed')?.textContent, url: location.href})",
    returnByValue: true
  });
  console.log(`shot ${n} diag:`, diag.result?.value);
  const attr = await cdp.send("Runtime.evaluate", {
    expression: "document.body ? (document.body.getAttribute('data-pageerror') || '') : 'no body'",
    returnByValue: true
  });
  const pageError = attr.result?.value;
  if (pageError) throw new Error(`shot ${n}: page error: ${pageError}`);
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "jpeg", quality: 88
  });
  const out = path.join(SHOTS_DIR, `shot-${n}.jpg`);
  await writeFile(out, Buffer.from(shot.data, "base64"));
  const s = await stat(out);
  if (s.size <= 10 * 1024) throw new Error(`shot ${n}: only ${s.size} bytes, under 10 KiB`);
  if (s.size > 256 * 1024) throw new Error(`shot ${n}: ${s.size} bytes, over 256 KiB`);
  return s.size;
}

async function main() {
  await mkdir(SHOTS_DIR, { recursive: true });
  const server = await serve();
  const httpPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const profile = `/tmp/velmara-chrome-${process.pid}`;
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage", "--hide-scrollbars",
    `--remote-debugging-port=${CDP_PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    `--user-data-dir=${profile}`,
    "about:blank"
  ], { stdio: "ignore" });

  try {
    await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const target = await newTarget("about:blank");
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false
    });
    const sizes = {};
    for (let n = 1; n <= 4; n++) {
      sizes[n] = await shootOne(cdp, baseUrl, n);
      console.log(`shot-${n}.jpg: ${sizes[n]} bytes`);
    }
    if (cdp.errors.length > 0) {
      throw new Error("page errors seen: " + cdp.errors.join(" | "));
    }
    console.log("capture OK, 0 page errors");
    cdp.close();
  } finally {
    chrome.kill("SIGKILL");
    server.close();
  }
}

main().catch((err) => {
  console.error("CAPTURE FAILED:", err.message);
  process.exit(1);
});
