/* alerts.js - anomaly alerts, human verification, simulate button and buzzer test. */
(function () {
  const R = window.Rover, S = R.S, $ = R.$;
  const Z = ['Coach A - Zone 1', 'Coach B - Zone 3', 'Coach C - Zone 2', 'Coach D - Zone 4'];
  const TYPES = [['Heat anomaly', 'high'], ['Loose component', 'med'], ['Obstacle on track', 'low'], ['Unusual movement', 'med'], ['Possible fire risk', 'high']];

  R.addAlert = function (type, sev, zone) {
    const a = { id: ++S.nextId, type, sev, zone, time: R.now(), status: 'open', temp: S.temp.toFixed(1) };
    S.alerts.unshift(a);
    S.alerts = S.alerts.slice(0, 50);
    R.logEv('Alert raised: ' + type + ' (' + zone + ')');
    try { if (R.snapshot) R.snapshot(a.id); } catch (e) { console.warn('Snapshot failed:', e); }
    R.save(); renderAlerts(); R.toast('New alert: ' + type);
  };

  function renderAlerts() {
    const open = S.alerts.filter(a => a.status === 'open').length;
    const h = $('hAl'); if (h) h.textContent = open;
    const list = $('alertList'); if (!list) return;
    list.innerHTML = S.alerts.length ? S.alerts.map(a => R.tpl('alert-card', {
      id: a.id, type: a.type,
      cls: (a.sev === 'high' ? 'high' : a.sev === 'low' ? 'low' : '') + (a.status !== 'open' ? ' done' : '') + (S.sel === a.id ? ' sel' : ''),
      meta: a.zone + ' &middot; ' + a.time + ' &middot; ' + (a.status === 'open' ? 'Awaiting verification' : a.status)
    })).join('') : '<div class="empty">No alerts. The rover is scanning the route.</div>';
  }

  function renderHuman() {
    const box = $('selBox'); if (!box) return;
    const a = S.alerts.find(x => x.id === S.sel);
    const dis = !a || a.status !== 'open';
    ['confirm', 'false', 'escal'].forEach(k => { const b = $(k); if (b) b.disabled = dis; });
    box.innerHTML = a ? `<b>#${a.id} ${a.type}</b><br>${a.zone} &middot; ${a.temp}\u00b0C &middot; ${a.status === 'open' ? 'needs your decision' : a.status}` : 'Select an alert to review it.';
    const v = $('vCount'); if (v) v.textContent = S.verified;
  }

  function decide(label) {
    const a = S.alerts.find(x => x.id === S.sel); if (!a) return;
    a.status = label; S.verified++;
    R.logEv('Alert #' + a.id + ' ' + label + ' by security officer');
    if (label === 'threat confirmed') R.toast('Threat confirmed. Control room notified.');
    R.save(); renderAlerts(); renderHuman();
  }

  R.ready(() => {
    renderAlerts(); renderHuman();
    const list = $('alertList');
    if (list) {
      const pick = el => { const item = el.closest('.item[data-id]'); if (!item) return; S.sel = +item.dataset.id; renderAlerts(); renderHuman(); };
      list.addEventListener('click', e => pick(e.target));
      list.addEventListener('keydown', e => { if (e.key === 'Enter') pick(e.target); });
    }
    const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
    on('confirm', () => decide('threat confirmed'));
    on('false', () => decide('false alarm'));
    on('escal', () => decide('escalated'));
    on('simAlert', () => {
      S.heat = true; const t = TYPES[Math.floor(Math.random() * TYPES.length)];
      S.temp = R.rnd(68, 82);
      R.addAlert(t[0], t[1], Z[Math.floor(Math.random() * Z.length)]);
      setTimeout(() => { S.heat = false; }, 6000);
    });
    on('buzz', () => {
      try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 300); } catch (e) { /* no audio available */ }
      R.toast('Buzzer tested');
    });
  });

  R.zones = Z;
})();
