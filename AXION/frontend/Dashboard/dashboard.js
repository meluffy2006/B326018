/* dashboard.js - starts the render loop for whichever panels the current page has.
   Load this LAST on every app page (dashboard, sensor data, rover status, camera, alerts). */
(function () {
  const R = window.Rover, S = R.S, $ = R.$;

  R.ready(() => {
    let last = performance.now(), tFeed = 0, tMap = 0;
    function loop(ts) {
      requestAnimationFrame(loop);
      if (document.hidden) { last = ts; return; }
      const dt = Math.min(.1, (ts - last) / 1000); last = ts; S.t += dt;
      if (R.stepMap) R.stepMap(dt);
      // Heavy canvases are redrawn at ~15 fps instead of 60: looks the same, uses a quarter of the CPU
      if (ts - tFeed > 66) { tFeed = ts; if (R.drawFeed) R.drawFeed(); }
      if (ts - tMap > 66) { tMap = ts; if (R.drawMap) R.drawMap(); if (R.drawRadar) R.drawRadar(); }
    }
    requestAnimationFrame(loop);

    if (!S.history.length) R.logEv('Rover deployed. Patrol started.');

    // First visit only: show one example heat alert so the panels are not empty
    if (!S.alerts.length && $('alertList')) {
      setTimeout(() => {
        S.heat = true; S.temp = 70;
        R.addAlert('Heat anomaly', 'high', 'Coach B - Zone 3');
        setTimeout(() => { S.heat = false; }, 7000);
      }, 4000);
    }
  });
})();
