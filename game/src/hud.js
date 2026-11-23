// hud.js — cash, wanted stars, mission box, minimap, speed, overlays.
//
// The minimap is a live 2D canvas: roads, the gold objective diamond,
// red/blue police dots, white traffic dots, and the player's gold arrow.
// Everything else is DOM updated once per frame from the game state.
const STAR_ON = '★';
const STAR_OFF = '☆';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    cash: $('cash'), stars: $('stars'), damageBar: $('damage-bar'),
    clock: $('clock'), missionTitle: $('mission-title'),
    missionText: $('mission-text'), missionDist: $('mission-dist'),
    minimap: $('minimap'), speed: $('speed'), gearBox: $('gear-box'),
    toast: $('toast'), startScreen: $('start-screen'),
    pauseScreen: $('pause-screen'), completeScreen: $('complete-screen'),
    completeName: $('complete-name'), completeFlavor: $('complete-flavor'),
    completeCash: $('complete-cash'),
  };
  const ctx = els.minimap.getContext('2d');
  const MAP_RANGE = 170; // world units shown across the minimap
  let toastTimer = null;

  function drawMinimap(game) {
    const S = 216;
    const mid = S / 2;
    const k = S / (MAP_RANGE * 2);
    const wx = (x) => mid + x * k;
    const wz = (z) => mid + z * k;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0d1830';
    ctx.fillRect(0, 0, S, S);
    // City blocks.
    ctx.fillStyle = '#1a2740';
    for (let bx = -125; bx <= 125; bx += 50) {
      for (let bz = -125; bz <= 125; bz += 50) {
        ctx.fillRect(wx(bx - 18), wz(bz - 18), 36 * k, 36 * k);
      }
    }
    // Roads.
    ctx.strokeStyle = '#5a6a80';
    ctx.lineWidth = 7;
    for (const c of [-100, -50, 0, 50, 100]) {
      ctx.beginPath(); ctx.moveTo(wx(c), 0); ctx.lineTo(wx(c), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, wz(c)); ctx.lineTo(S, wz(c)); ctx.stroke();
    }
    // Marina water.
    ctx.fillStyle = '#1d3a58';
    ctx.fillRect(wx(152), 0, S - wx(152), S);
    ctx.fillStyle = '#5a6374';
    ctx.fillRect(wx(126), 0, (152 - 126) * k, S);
    // Objective diamond.
    const m = game.missions.current;
    if (m && game.state !== 'complete') {
      ctx.save();
      ctx.translate(wx(m.target.x), wz(m.target.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd76a';
      ctx.shadowColor = '#ffd76a';
      ctx.shadowBlur = 8;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    // Traffic dots.
    ctx.fillStyle = '#ffffff';
    for (const c of game.traffic) {
      ctx.beginPath(); ctx.arc(wx(c.x), wz(c.z), 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // Police dots (red/blue flash).
    for (const c of game.police) {
      if (!c.active) continue;
      ctx.fillStyle = Math.sin(game.time * 12) > 0 ? '#ff3333' : '#3388ff';
      ctx.beginPath(); ctx.arc(wx(c.x), wz(c.z), 3.4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow: canvas north is up, tip (0,-8) rotated by heading.
    const p = game.player;
    ctx.save();
    ctx.translate(wx(p.x), wz(p.z));
    ctx.rotate(p.heading);
    ctx.fillStyle = '#ffd76a';
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#9fb2cc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S - 12, 14);
  }

  return {
    els,
    update(game, dt) {
      els.cash.textContent = `$${game.cash}`;
      let stars = '';
      for (let i = 0; i < 5; i++) {
        stars += `<span class="${i < game.wanted ? '' : 'off'}">${i < game.wanted ? STAR_ON : STAR_OFF}</span>`;
      }
      els.stars.innerHTML = stars;
      els.damageBar.style.width = `${Math.round(game.player.damage)}%`;
      const totalMin = 21 * 60 + 36 + Math.floor(game.time / 4);
      const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
      const mm = String(totalMin % 60).padStart(2, '0');
      els.clock.textContent = `${hh}:${mm}`;
      const m = game.missions.current;
      if (m) {
        els.missionTitle.textContent = `MISSION ${m.id} — ${m.name}`;
        els.missionText.textContent = m.text;
        const d = Math.round(game.missions.distanceTo(game.player));
        els.missionDist.textContent = `${d} m to objective`;
      } else {
        els.missionTitle.textContent = 'ALL MISSIONS COMPLETE';
        els.missionText.textContent = 'Velmara Bay is yours. Free roam — the city is open.';
        els.missionDist.textContent = '';
      }
      els.speed.textContent = String(Math.round(Math.abs(game.player.speed) * 3.6));
      els.gearBox.textContent = game.player.reversing ? 'R' : game.player.gear === 0 ? 'N' : String(game.player.gear);
      drawMinimap(game);
    },
    toast(msg, ms = 2600) {
      els.toast.textContent = msg;
      els.toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { els.toast.style.opacity = '0'; }, ms);
    },
    showStart() {
      els.startScreen.classList.remove('hidden');
      els.pauseScreen.classList.add('hidden');
      els.completeScreen.classList.add('hidden');
    },
    hideStart() { els.startScreen.classList.add('hidden'); },
    showPause() { els.pauseScreen.classList.remove('hidden'); },
    hidePause() { els.pauseScreen.classList.add('hidden'); },
    showComplete(mission) {
      els.completeName.textContent = `MISSION — ${mission.name}`;
      els.completeFlavor.textContent = mission.flavor;
      els.completeCash.textContent = '+$400';
      els.completeScreen.classList.remove('hidden');
    },
    hideComplete() { els.completeScreen.classList.add('hidden'); },
  };
}
