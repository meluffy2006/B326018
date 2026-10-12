/* rover-status.js - rover health panel, header link chip and the mini patrol map.
   The map shows the simulated route, and switches the coordinates to real GPS whenever
   the rover/Swift app is posting to /api/rover/location. */
(function () {
  const R = window.Rover, S = R.S, $ = R.$, rnd = R.rnd;
  const route = [[60, 320], [60, 90], [260, 90], [260, 230], [450, 230], [450, 320], [60, 320]];
  let seg = 0, segT = 0, mc = null, mx = null;

  const txt = (id, v) => { const e = $(id); if (e) e.textContent = v; };

  function roverPos() { const a = route[seg], b = route[seg + 1]; return [a[0] + (b[0] - a[0]) * segT, a[1] + (b[1] - a[1]) * segT]; }

  R.stepMap = dt => { segT += dt * .08; if (segT >= 1) { segT = 0; seg = (seg + 1) % (route.length - 1); } };

  R.drawMap = () => {
    if (!mx) return;
    mx.clearRect(0, 0, 520, 390); mx.fillStyle = '#050d1b'; mx.fillRect(0, 0, 520, 390);
    mx.strokeStyle = 'rgba(120,180,255,.1)'; mx.lineWidth = 1;
    for (let i = 0; i < 520; i += 40) { mx.beginPath(); mx.moveTo(i, 0); mx.lineTo(i, 390); mx.stroke(); }
    for (let i = 0; i < 390; i += 40) { mx.beginPath(); mx.moveTo(0, i); mx.lineTo(520, i); mx.stroke(); }
    mx.lineWidth = 10; mx.strokeStyle = '#1c3558'; mx.lineJoin = 'round'; mx.beginPath(); route.forEach((p, i) => i ? mx.lineTo(p[0], p[1]) : mx.moveTo(p[0], p[1])); mx.stroke();
    mx.lineWidth = 2; mx.strokeStyle = '#4aa3ff'; mx.setLineDash([8, 6]); mx.stroke(); mx.setLineDash([]);
    mx.fillStyle = '#8fa8cc'; mx.font = '12px sans-serif'; [['Coach A', 70, 345], ['Coach B', 270, 215], ['Coach C', 455, 215]].forEach(z => mx.fillText(z[0], z[1], z[2]));
    S.alerts.filter(a => a.status === 'open').forEach(a => { const p = route[a.id % 5]; mx.fillStyle = '#ff4d5e'; mx.beginPath(); mx.arc(p[0] + 14, p[1] - 14, 6, 0, 7); mx.fill(); });
    const [x, y] = roverPos(); const pulse = 8 + Math.sin(S.t * 4) * 3;
    mx.fillStyle = 'rgba(46,229,157,.25)'; mx.beginPath(); mx.arc(x, y, pulse + 8, 0, 7); mx.fill(); mx.fillStyle = '#2ee59d'; mx.beginPath(); mx.arc(x, y, 7, 0, 7); mx.fill();
    const pos = $('pos');
    if (pos) {
      const live = S.live && Date.now() - S.live.time < 10000;
      pos.textContent = live ? 'GPS ' + S.live.lat.toFixed(5) + ', ' + S.live.lng.toFixed(5) : 'Simulated \u00b7 ' + x.toFixed(0) + ', ' + y.toFixed(0);
    }
  };

  // Health panel + header link chip (runs on every page that has the navbar)
  function healthTick() {
    txt('rhBat', S.bat.toFixed(0) + '% (~' + Math.round(S.bat * 1.4) + ' min left)');
    S.net = Math.random() < .04 ? 'Weak' : 'Strong';
    txt('rhNet', S.net + ' (' + Math.round(rnd(-62, -48)) + ' dBm)');
    const dot = $('linkDot'); if (dot) dot.className = 'dot' + (S.net === 'Weak' ? ' warn' : '');
    txt('linkTxt', S.net === 'Weak' ? 'Link weak' : 'Rover online');
    txt('rhCpu', Math.round(rnd(28, 52)) + '%');
    txt('rhMot', 'OK \u00b7 ' + Math.round(rnd(38, 46)) + '\u00b0C');
  }

  R.ready(() => {
    mc = $('mapc'); if (mc) mx = mc.getContext('2d');
    healthTick(); setInterval(healthTick, 1000);
    // Real position from the backend (Server-Sent Events). Silent if the server is not running.
    if (mc && location.protocol.startsWith('http') && window.EventSource) {
      try {
        fetch('/api/rover/location').then(r => r.json()).then(p => { if (p) S.live = p; }).catch(() => {});
        const es = new EventSource('/api/rover/stream');
        addEventListener('pagehide', () => es.close());
        es.onmessage = e => { try { S.live = JSON.parse(e.data); } catch (_) { /* ignore bad packet */ } };
      } catch (_) { /* ignore */ }
    }
  });
})();
