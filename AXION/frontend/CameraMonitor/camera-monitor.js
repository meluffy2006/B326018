/* camera-monitor.js - simulated live camera feed, view modes, snapshots and event history. */
(function () {
  const R = window.Rover, S = R.S, $ = R.$;
  let fc = null, fx = null;

  function drawScene(ctx, w, h, t, mode, lights, heat) {
    const lum = lights ? 1 : .45;
    let g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b1d22'); g.addColorStop(1, '#2b2926'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const off = (t * 40) % 120;
    ctx.fillStyle = '#34383f';
    for (let i = -1; i < 8; i++) { const x = i * 120 - off; ctx.fillRect(x, h * .18, 70, h * .28); }   // underframe beams
    ctx.fillStyle = '#222'; ctx.fillRect(0, h * .5, w, 6);
    for (let i = -1; i < 10; i++) { const x = i * 90 - off * .75; ctx.fillStyle = '#4a4338'; ctx.fillRect(x, h * .7, 10, h * .3); } // sleepers
    ctx.fillStyle = '#5b5f66'; ctx.fillRect(0, h * .62, w, 5); ctx.fillRect(0, h * .82, w, 5); // rails
    const bx = w * .55 - (off * .6) % 60;
    ctx.fillStyle = '#3b3f47'; ctx.beginPath(); ctx.arc(bx, h * .34, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#22252a'; ctx.beginPath(); ctx.arc(bx, h * .34, 16, 0, 7); ctx.fill(); // wheel/axle
    if (heat) { // hot spot on axle
      const r = ctx.createRadialGradient(bx, h * .34, 2, bx, h * .34, 60); r.addColorStop(0, 'rgba(255,60,30,.95)'); r.addColorStop(.5, 'rgba(255,170,30,.5)'); r.addColorStop(1, 'rgba(255,170,30,0)');
      ctx.fillStyle = r; ctx.fillRect(bx - 70, h * .34 - 70, 140, 140);
    }
    // ground vignette for lights
    const v = ctx.createRadialGradient(w / 2, h * .6, 40, w / 2, h * .6, w * .7); v.addColorStop(0, `rgba(255,250,220,${.18 * lum})`); v.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    if (mode === 'thermal') {
      const d = ctx.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) { const l = (p[i] + p[i + 1] + p[i + 2]) / 3; const k = Math.min(255, l * 2.2); p[i] = k; p[i + 1] = k > 150 ? (k - 150) * 2 : 0; p[i + 2] = k < 90 ? k * 2 : 60; }
      ctx.putImageData(d, 0, 0);
    }
    if (mode === 'night') { ctx.fillStyle = 'rgba(0,255,100,.18)'; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(0,255,100,.08)'; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1); }
    if (heat) {
      ctx.strokeStyle = '#2ee59d'; ctx.lineWidth = 2; ctx.strokeRect(bx - 52, h * .34 - 52, 104, 104);
      ctx.fillStyle = '#ff4d5e'; ctx.fillRect(bx - 52, h * .34 - 72, 126, 20); ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText('Heat detected (' + S.temp.toFixed(0) + '\u00b0C)', bx - 47, h * .34 - 57);
    }
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(8, h - 26, 150, 18); ctx.fillStyle = '#e6f0ff'; ctx.font = '11px sans-serif'; ctx.fillText('Dist ' + S.dist.toFixed(0) + ' cm  |  ' + S.temp.toFixed(1) + '\u00b0C', 12, h - 13);
  }

  /* ---------- Snapshots (saved as small JPEGs so they survive page changes) ---------- */
  function snapshot(tag) {
    const c = document.createElement('canvas'); c.width = 240; c.height = 180;
    const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
    drawScene(ctx, 240, 180, S.t, S.mode === 'thermal' ? 'thermal' : 'normal', S.lights, S.heat);
    let src = ''; try { src = c.toDataURL('image/jpeg', .7); } catch (e) { return; }
    S.snaps.unshift({ title: (tag === 'manual' ? 'Manual' : 'Alert #' + tag) + ' - ' + R.now(), src });
    S.snaps = S.snaps.slice(0, 6);
    R.save(); renderSnaps();
  }
  function renderSnaps() {
    const box = $('snaps'); if (!box) return;
    box.innerHTML = S.snaps.length
      ? S.snaps.map(s => `<img src="${s.src}" alt="${s.title}" title="${s.title}">`).join('')
      : '<div class="empty" style="grid-column:span 3">Snapshots appear here when an alert fires.</div>';
  }
  function renderHist() {
    const h = $('history'); if (!h) return;
    h.innerHTML = S.history.length ? S.history.map(e => `<div class="item low">${e.m}<span>${e.t}</span></div>`).join('') : '<div class="empty">No events yet.</div>';
  }

  /* ---------- Hooks used by dashboard.js ---------- */
  R.drawFeed = () => { if (fx) drawScene(fx, 640, 360, S.t, S.mode, S.lights, S.heat); };
  R.snapshot = snapshot; R.renderHist = renderHist;

  R.ready(() => {
    fc = $('feed'); if (fc) fx = fc.getContext('2d', { willReadFrequently: true });
    renderSnaps(); renderHist();
    if (!fc) return;
    const names = { normal: 'Normal view', thermal: 'Thermal view', night: 'Low-light view' };
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      S.mode = b.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
      $('camMode').textContent = names[S.mode] + ' \u00b7 Coach B, Zone 3';
    });
    $('lights').onclick = e => { S.lights = !S.lights; e.target.classList.toggle('on', S.lights); e.target.textContent = 'LED lights: ' + (S.lights ? 'on' : 'off'); };
    $('snapBtn').onclick = () => { snapshot('manual'); R.logEv('Manual snapshot captured'); R.toast('Snapshot saved'); };
  });
})();
