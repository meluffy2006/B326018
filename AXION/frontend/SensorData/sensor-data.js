/* sensor-data.js - sensor readings, sensor cards, radar sweep and the header battery chip.
   Uses real readings from the backend (GET /api/sensors) while the hardware is posting them,
   and falls back to simulated readings otherwise. */
(function () {
  const R = window.Rover, S = R.S, $ = R.$, rnd = R.rnd;
  let rc = null, rx = null;
  S.hw = null;   // latest live reading from the backend, or null when simulating

  const txt = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  function setBar(id, pct, col) { const e = $(id); if (!e) return; e.style.width = Math.max(2, Math.min(100, pct)) + '%'; e.style.background = col; }

  function drawRadar() {
    if (!rx) return;
    rx.clearRect(0, 0, 170, 170); rx.fillStyle = '#04120c'; rx.beginPath(); rx.arc(85, 85, 84, 0, 7); rx.fill();
    rx.strokeStyle = 'rgba(46,229,157,.4)'; [28, 56, 84].forEach(r => { rx.beginPath(); rx.arc(85, 85, r, 0, 7); rx.stroke(); });
    const a = S.t * 2.5; const g = rx.createConicGradient ? rx.createConicGradient(a - 1.2, 85, 85) : null;
    if (g) { g.addColorStop(0, 'rgba(46,229,157,0)'); g.addColorStop(.19, 'rgba(46,229,157,.55)'); g.addColorStop(.2, 'rgba(46,229,157,0)'); rx.fillStyle = g; rx.beginPath(); rx.arc(85, 85, 84, 0, 7); rx.fill(); }
    rx.strokeStyle = '#2ee59d'; rx.beginPath(); rx.moveTo(85, 85); rx.lineTo(85 + Math.cos(a) * 84, 85 + Math.sin(a) * 84); rx.stroke();
    const d = Math.min(80, S.dist / 2); rx.fillStyle = '#ffb020'; rx.beginPath(); rx.arc(85 + Math.cos(1.1) * d, 85 + Math.sin(1.1) * d, 4, 0, 7); rx.fill();
  }

  let pulling = false;
  function pull() {
    if (!location.protocol.startsWith('http') || document.hidden || pulling) return;
    pulling = true;
    fetch('/api/sensors').then(r => r.json()).then(d => { S.hw = d && d.live ? d.reading : null; }).catch(() => { S.hw = null; }).finally(() => { pulling = false; });
  }

  function tick() {
    if (S.hw) {
      if (isNum(S.hw.temperature)) S.temp = S.hw.temperature;
      if (isNum(S.hw.distance)) S.dist = S.hw.distance;
      if (isNum(S.hw.battery)) S.bat = S.hw.battery;
    } else {
      S.temp += ((S.heat ? 75 : 34) - S.temp) * .3 + rnd(-.6, .6);
      S.dist = Math.max(15, Math.min(200, S.dist + rnd(-12, 12)));
      S.bat = Math.max(5, S.bat - .02);
    }
    txt('sT', S.temp.toFixed(1) + '\u00b0C'); txt('sU', S.dist.toFixed(0) + ' cm'); txt('sB', S.bat.toFixed(0) + '%');
    setBar('bT', S.temp, S.temp > 60 ? '#ff4d5e' : S.temp > 45 ? '#ffb020' : '#2ee59d');
    setBar('bU', S.dist / 2, S.dist < 30 ? '#ff4d5e' : '#4aa3ff');
    setBar('bB', S.bat, S.bat < 20 ? '#ff4d5e' : S.bat < 40 ? '#ffb020' : '#2ee59d');
    txt('hBat', S.bat.toFixed(0));
    // Auto alert when an overheating reading is seen (20 s cooldown so it cannot repeat in a burst)
    if (S.temp > 60 && !S.heat && !S.alerts.some(a => a.status === 'open' && a.type === 'Heat anomaly') && Date.now() - S.lastHeatAlert > 20000) {
      S.lastHeatAlert = Date.now();
      R.addAlert('Heat anomaly', 'high', R.zones ? R.zones[1] : 'Coach B - Zone 3');
    }
    if (S.dist < 22 && Math.random() < .25) R.logEv('Obstacle within ' + S.dist.toFixed(0) + ' cm, rover slowed');
  }

  R.drawRadar = drawRadar;

  R.ready(() => {
    const wrap = $('sensorCards');
    if (wrap) {
      wrap.innerHTML =
        R.tpl('sensor-card', { label: 'Temperature', vid: 'sT', bid: 'bT' }) +
        R.tpl('sensor-card', { label: 'Ultrasonic distance', vid: 'sU', bid: 'bU' }) +
        R.tpl('sensor-card', { label: 'Battery', vid: 'sB', bid: 'bB' }) +
        '<div class="card"><div class="l">Radar sweep</div><canvas class="radar" id="radar" width="170" height="170"></canvas></div>';
    }
    rc = $('radar'); if (rc) rx = rc.getContext('2d');
    pull(); tick();
    const a = setInterval(pull, 1000), b = setInterval(tick, 1000);
    addEventListener('pagehide', () => { clearInterval(a); clearInterval(b); });
  });
})();
