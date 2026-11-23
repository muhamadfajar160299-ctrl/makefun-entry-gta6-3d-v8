// Marina Nights — HUD. Money, wanted stars, speed, objective, damage bar,
// and a REAL minimap: city blocks, bright roads with dashed yellow centrelines,
// the blue bay strip, a gold player arrow, a pulsing objective dot, red
// police dots, and "VELMARA BAY" + "N" labels.
//
// showScreen() takes a KEY ('start','story','win','pause','busted','wasted',
// or null to hide all) and maps it to the right element — never a DOM id.
// setHudVisible() is the single helper that reveals the HUD for gameplay.
import { STREETS, BAY_X } from './city.js';

const SCREENS = {
  start: 'screen-start',
  story: 'screen-story',
  win: 'screen-win',
  pause: 'screen-pause',
  busted: 'screen-busted',
  wasted: 'screen-wasted',
};

function el(id) { return document.getElementById(id); }

export function createHud() {
  const hud = el('hud');
  const moneyNum = el('money-num');
  const stars = Array.from(el('wanted-stars').children);
  const speedNum = el('speed-num');
  const objTitle = el('objective-title');
  const objText = el('objective-text');
  const damageFill = el('damage-fill');
  const messageBox = el('message');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const winMission = el('win-mission');
  const winText = el('win-text');
  const winReward = el('win-reward');
  const objDist = el('objective-dist');
  const clockEl = el('clock');
  const gearEl = el('gear');
  let messageTimer = null;
  let lastWanted = 0;

  // Minimap geometry: world [-210, 210] -> canvas [0, 200].
  const MAP_MIN = -210, MAP_MAX = 210, MAP_SIZE = 200;
  function mx(x) { return ((x - MAP_MIN) / (MAP_MAX - MAP_MIN)) * MAP_SIZE; }
  function mz(z) { return ((z - MAP_MIN) / (MAP_MAX - MAP_MIN)) * MAP_SIZE; }

  function drawMinimap(G, t) {
    const c = mctx;
    // deep water-coloured base
    c.fillStyle = '#0b1c33';
    c.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // city blocks (dark slabs between streets)
    const edges = [-200, -171, -149, -91, -69, -11, 11, 69, 91, 149, 171, 189];
    c.fillStyle = '#16233a';
    for (let i = 0; i < edges.length; i += 2) {
      for (let j = 0; j < edges.length; j += 2) {
        c.fillRect(mx(edges[i]), mz(edges[j]), mx(edges[i + 1]) - mx(edges[i]), mz(edges[j + 1]) - mz(edges[j]));
      }
    }
    // promenade strip (lighter, along the bay)
    c.fillStyle = '#2e4a6b';
    c.fillRect(mx(188), mz(-200), mx(200) - mx(188), mz(200) - mz(-200));
    // bay: bright blue strip on the east edge
    c.fillStyle = '#1565c0';
    c.fillRect(mx(BAY_X), 0, MAP_SIZE - mx(BAY_X), MAP_SIZE);
    c.fillStyle = '#1e88e5';
    for (let y = 8; y < MAP_SIZE; y += 18) {
      c.fillRect(mx(BAY_X) + 3, y, 8, 2);
    }
    // roads: bright lines with dashed yellow centrelines.
    // Vertical roads run the full height; horizontal roads stop at the
    // promenade (x = 188) — the marina strip is pedestrian-only.
    for (const s of STREETS) {
      c.strokeStyle = '#c8d4e6';
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(mx(s), 0); c.lineTo(mx(s), MAP_SIZE); c.stroke();
      c.beginPath(); c.moveTo(0, mz(s)); c.lineTo(mx(188), mz(s)); c.stroke();
      c.strokeStyle = '#ffd54a';
      c.lineWidth = 1;
      c.setLineDash([4, 5]);
      c.beginPath(); c.moveTo(mx(s), 0); c.lineTo(mx(s), MAP_SIZE); c.stroke();
      c.beginPath(); c.moveTo(0, mz(s)); c.lineTo(mx(188), mz(s)); c.stroke();
      c.setLineDash([]);
    }
    // objective: pulsing gold dot
    if (G.missions) {
      const tgt = G.missions.current().target;
      const pulse = 3.5 + Math.sin(t * 4) * 1.6;
      c.fillStyle = '#ffd54a';
      c.beginPath(); c.arc(mx(tgt.x), mz(tgt.z), pulse + 2.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff7a3d';
      c.beginPath(); c.arc(mx(tgt.x), mz(tgt.z), pulse, 0, Math.PI * 2); c.fill();
    }
    // police: red dots
    if (G.police) {
      c.fillStyle = '#ff3344';
      for (const car of G.police.cars) {
        c.beginPath(); c.arc(mx(car.pos.x), mz(car.pos.z), 3, 0, Math.PI * 2); c.fill();
      }
    }
    // traffic: small pale dots so the player can read the flow at a glance
    if (G.traffic) {
      c.fillStyle = 'rgba(232,236,242,0.85)';
      for (const car of G.traffic.cars) {
        c.beginPath(); c.arc(mx(car.group.position.x), mz(car.group.position.z), 1.8, 0, Math.PI * 2); c.fill();
      }
    }
    // player: gold arrow, rotated to heading.
    // World forward is (sin h, cos h) in (x, z); the map draws z downward,
    // so the arrow (drawn pointing up) rotates by (PI - h).
    if (G.player) {
      const px = mx(G.player.pos.x);
      const py = mz(G.player.pos.z);
      c.save();
      c.translate(px, py);
      c.rotate(Math.PI - G.player.heading);
      c.fillStyle = '#ffd54a';
      c.strokeStyle = '#7a5b00';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath();
      c.fill(); c.stroke();
      c.restore();
    }
    // labels
    c.fillStyle = 'rgba(234,242,255,0.92)';
    c.font = 'bold 9px sans-serif';
    c.fillText('VELMARA BAY', 8, 12);
    c.fillStyle = '#7fe3ff';
    c.font = 'bold 11px sans-serif';
    c.fillText('N', MAP_SIZE - 14, 14);
    c.strokeStyle = 'rgba(127,227,255,0.8)';
    c.beginPath(); c.moveTo(MAP_SIZE - 10, 18); c.lineTo(MAP_SIZE - 10, 26); c.stroke();
    c.beginPath(); c.moveTo(MAP_SIZE - 13, 21); c.lineTo(MAP_SIZE - 10, 17); c.lineTo(MAP_SIZE - 7, 21); c.stroke();
  }

  return {
    showScreen(key) {
      for (const k of Object.keys(SCREENS)) {
        const node = el(SCREENS[k]);
        if (node) node.classList.add('hidden');
      }
      if (key && SCREENS[key]) {
        const node = el(SCREENS[key]);
        if (node) node.classList.remove('hidden');
      }
    },
    // The one helper that reveals the HUD for gameplay: drops the hidden
    // class AND clears any inline display:none.
    setHudVisible(v) {
      if (!hud) return;
      if (v) {
        hud.classList.remove('hidden');
        hud.style.display = '';
      } else {
        hud.classList.add('hidden');
        hud.style.display = 'none';
      }
    },
    setMoney(n) { if (moneyNum) moneyNum.textContent = String(n); },
    setWanted(n) {
      // flash the stars when heat rises — the player should feel it
      if (n > lastWanted) {
        const wrap = el('wanted-wrap');
        if (wrap) {
          wrap.classList.remove('flash');
          void wrap.offsetWidth; // restart the animation
          wrap.classList.add('flash');
        }
      }
      lastWanted = n;
      stars.forEach((s, i) => s.classList.toggle('lit', i < n));
    },
    setSpeed(kmh) { if (speedNum) speedNum.textContent = String(Math.round(kmh)); },
    // Gear from speed: R under 0, N at standstill, 1-5 climbing to 130 km/h.
    setGear(speedMs) {
      if (!gearEl) return;
      const kmh = Math.abs(speedMs) * 3.6;
      let g;
      if (speedMs < -0.5) g = 'R';
      else if (kmh < 1) g = 'N';
      else if (kmh < 25) g = '1';
      else if (kmh < 50) g = '2';
      else if (kmh < 80) g = '3';
      else if (kmh < 105) g = '4';
      else g = '5';
      if (gearEl.textContent !== g) gearEl.textContent = g;
    },
    // In-game clock (21:36 at mission start, 1 game-minute per 2 real seconds).
    setClock(text) { if (clockEl) clockEl.textContent = text; },
    setObjectiveDistance(m) {
      if (!objDist) return;
      const txt = m < 1000 ? m + ' m to objective' : (m / 1000).toFixed(1) + ' km to objective';
      if (objDist.textContent !== txt) objDist.textContent = txt;
    },
    setObjective(title, text) {
      if (objTitle) objTitle.textContent = title;
      if (objText) objText.textContent = text;
    },
    setDamage(pct) {
      if (damageFill) damageFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    },
    setWinText(name, reward, last) {
      if (winMission) winMission.textContent = 'MISSION — ' + name.toUpperCase();
      if (winText) {
        winText.textContent = last
          ? 'All five jobs done. Velmara Bay is yours — the crew is already talking about the next score.'
          : 'Package secured. Clean getaway. The next job is already lined up.';
      }
      if (winReward) winReward.textContent = '+$' + reward;
    },
    showMessage(text, ms) {
      if (!messageBox) return;
      messageBox.textContent = text;
      messageBox.classList.remove('hidden');
      if (messageTimer) clearTimeout(messageTimer);
      messageTimer = setTimeout(() => messageBox.classList.add('hidden'), ms || 2600);
    },
    drawMinimap,
  };
}
