// hud.js — the Velmara HUD: cash, mission card, wanted stars, damage bar,
// clock, speed + gear, and a live minimap canvas with roads, sea, player,
// police, traffic and the gold objective diamond.
const THREE = window.THREE;

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), cash: $('cashValue'), mTitle: $('missionTitle'), mDesc: $('missionDesc'),
    mDist: $('missionDist'), stars: $('stars'), damageBar: $('damageBar'),
    clock: $('clockTime'), speed: $('speedNum'), gear: $('gearBox'),
    toast: $('toast'), start: $('startScreen'), pause: $('pauseScreen'),
    complete: $('completeScreen'), completeSub: $('completeSub'),
    completeDesc: $('completeDesc'), completeReward: $('completeReward'),
    saveLine: $('saveLine'), damageFlash: $('damageFlash'),
  };
  const map = $('minimap');
  const mctx = map.getContext('2d');

  let toastTimer = null;
  let lastCash = -1;

  function renderStars(wanted) {
    let html = '';
    for (let i = 0; i < 5; i++) {
      html += `<span class="${i < wanted ? 'lit' : 'dim'}">★</span>`;
    }
    el.stars.innerHTML = html;
  }

  function drawMinimap(state) {
    const W = map.width, H = map.height;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = '#070b18';
    mctx.fillRect(0, 0, W, H);
    // World -> map: x -200..200 maps to 0..W, z -200..200 maps to 0..H.
    const mx = (x) => ((x + 200) / 400) * W;
    const mz = (z) => ((z + 200) / 400) * H;
    // Sea on the east.
    mctx.fillStyle = '#0d2a55';
    mctx.fillRect(mx(165), 0, W - mx(165), H);
    // Roads.
    mctx.strokeStyle = 'rgba(200,212,235,0.85)';
    mctx.lineWidth = 2.5;
    for (const r of [-165, -110, -55, 0, 55, 110]) {
      mctx.beginPath(); mctx.moveTo(mx(r), mz(-192)); mctx.lineTo(mx(r), mz(192)); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(mx(-192), mz(r)); mctx.lineTo(mx(137), mz(r)); mctx.stroke();
    }
    // Promenade line.
    mctx.strokeStyle = '#7fd4e8';
    mctx.lineWidth = 2;
    mctx.beginPath(); mctx.moveTo(mx(151), mz(-192)); mctx.lineTo(mx(151), mz(192)); mctx.stroke();
    // Traffic (white dots).
    mctx.fillStyle = '#dfe6f5';
    for (const c of state.traffic) {
      mctx.beginPath(); mctx.arc(mx(c.x), mz(c.z), 2, 0, Math.PI * 2); mctx.fill();
    }
    // Police (red dots).
    mctx.fillStyle = '#ff3b4e';
    for (const p of state.police) {
      mctx.beginPath(); mctx.arc(mx(p.x), mz(p.z), 3, 0, Math.PI * 2); mctx.fill();
    }
    // Objective: gold diamond.
    const ox = mx(state.objective.x), oy = mz(state.objective.z);
    mctx.fillStyle = '#f6c945';
    mctx.beginPath();
    mctx.moveTo(ox, oy - 6); mctx.lineTo(ox + 5, oy); mctx.lineTo(ox, oy + 6); mctx.lineTo(ox - 5, oy);
    mctx.closePath(); mctx.fill();
    // Player arrow (rotates with heading).
    const px = mx(state.player.x), py = mz(state.player.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.PI - state.player.heading); // arrow tip starts pointing north (-z)
    mctx.fillStyle = '#f6c945';
    mctx.beginPath();
    mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6);
    mctx.closePath(); mctx.fill();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#aeb6d4';
    mctx.font = 'bold 11px sans-serif';
    mctx.fillText('N', W - 14, 14);
  }

  return {
    showGame() { el.hud.classList.add('on'); el.start.style.display = 'none'; },
    showStart(save) {
      el.start.style.display = 'flex';
      el.saveLine.textContent = save && save.cash > 0
        ? `SAVED PROGRESS — CASH $${save.cash.toLocaleString()} · MISSION ${Math.min(5, save.mission + 1)} OF 5`
        : 'NO SAVE YET — THE BAY IS WAITING';
    },
    showPause(on) { el.pause.style.display = on ? 'flex' : 'none'; },
    showComplete(mission) {
      el.completeSub.textContent = `MISSION — ${mission.name}`;
      el.completeDesc.textContent = mission.done;
      el.completeReward.textContent = `+$${mission.reward}`;
      el.complete.style.display = 'flex';
    },
    hideComplete() { el.complete.style.display = 'none'; },
    toast(text, ms = 2600) {
      el.toast.textContent = text;
      el.toast.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.toast.style.opacity = '0'; }, ms);
    },
    flashDamage(amount) {
      el.damageFlash.style.opacity = Math.min(0.9, 0.3 + amount * 2.5);
      setTimeout(() => { el.damageFlash.style.opacity = '0'; }, 180);
    },
    update(state) {
      if (state.cash !== lastCash) {
        el.cash.textContent = `$${state.cash.toLocaleString()}`;
        lastCash = state.cash;
      }
      el.mTitle.textContent = `MISSION ${state.mission.id} — ${state.mission.name}`;
      el.mDesc.textContent = state.mission.desc;
      el.mDist.textContent = `${Math.round(state.distance)} m to objective`;
      if (el.stars.dataset.w !== String(state.wanted)) {
        renderStars(state.wanted);
        el.stars.dataset.w = String(state.wanted);
      }
      el.damageBar.style.width = `${Math.round(state.damage * 100)}%`;
      const hh = String(state.clockH).padStart(2, '0');
      const mm = String(state.clockM).padStart(2, '0');
      el.clock.textContent = `${hh}:${mm}`;
      el.speed.textContent = String(Math.round(state.speedKmh));
      el.gear.textContent = state.gearLabel;
      drawMinimap(state);
    },
  };
}
