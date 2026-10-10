/* core.js - shared core. Load this FIRST on every page.
   Provides window.Rover: state, helpers, saved data, HTML components, 3D background. */
(function () {
  const BASE = document.currentScript.src.replace(/assets\/js\/core\.js(\?.*)?$/, ''); // .../frontend/
  const KEY = 'axion.rover.v1';
  const COMPONENTS = ['navbar', 'sidebar', 'sensor-card', 'alert-card'];

  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pad = n => String(n).padStart(2, '0');
  const now = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };

  const S = {
    mode: 'normal', lights: true, temp: 34, dist: 120, bat: 86, heat: false, net: 'Strong',
    alerts: [], history: [], snaps: [], sel: null, verified: 0, nextId: 100,
    t: 0, live: null, lastHeatAlert: 0
  };
  const R = window.Rover = { BASE, S, $, rnd, now, templates: {}, _hooks: [], booted: false, resetting: false };

  /* ---------- Saved data (alerts, history, snapshots survive page changes) ---------- */
  R.save = function () {
    if (R.resetting) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        alerts: S.alerts.slice(0, 50), history: S.history, snaps: S.snaps, verified: S.verified, nextId: S.nextId
      }));
    } catch (e) { /* storage full or blocked: keep running without saving */ }
  };
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d) return;
      S.alerts = d.alerts || []; S.history = d.history || []; S.snaps = d.snaps || [];
      S.verified = d.verified || 0; S.nextId = d.nextId || 100;
    } catch (e) { /* ignore corrupt data */ }
  }
  R.reset = function () { R.resetting = true; try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };

  /* ---------- Small helpers ---------- */
  R.toast = function (m) {
    let t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = m; t.classList.add('show');
    clearTimeout(R.toast.h); R.toast.h = setTimeout(() => t.classList.remove('show'), 2200);
  };
  R.logEv = function (m) {
    S.history.unshift({ t: now(), m });
    S.history = S.history.slice(0, 30);
    R.save();
    if (R.renderHist) R.renderHist();
  };
  R.ready = fn => (R.booted ? fn() : R._hooks.push(fn));

  /* ---------- HTML components (frontend/components/*.html) ---------- */
  R.tpl = (name, vars) => (R.templates[name] || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : ''));

  function loadComponents() {
    return Promise.all(COMPONENTS.map(n =>
      fetch(BASE + 'components/' + n + '.html')
        .then(r => (r.ok ? r.text() : ''))
        .then(t => { R.templates[n] = t; })
        .catch(() => { R.templates[n] = ''; console.warn('Could not load component "' + n + '". Open the site through the server (npm start), not as a file.'); })
    ));
  }
  function fixLinks(root) {
    (root || document).querySelectorAll('[data-href]').forEach(a => {
      a.href = BASE + a.dataset.href;
      if (a.pathname === location.pathname) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    });
  }
  function mount() {
    const nb = $('navbar-slot'), sb = $('sidebar-slot');
    if (nb) nb.innerHTML = R.tpl('navbar');
    if (sb) sb.innerHTML = R.tpl('sidebar');
    fixLinks();
    const rb = $('resetData'); if (rb) rb.onclick = () => { if (confirm('Clear saved alerts, history and snapshots?')) R.reset(); };
    setInterval(() => {
      const c = $('clock'); if (c) c.textContent = now();
      const ts = $('camTs'); if (ts) ts.textContent = new Date().toLocaleString();
    }, 1000);
  }

  /* ---------- 3D background (three.js, optional) ---------- */
  function init3D() {
    const cv = $('bg');
    if (!cv || !window.THREE) return;
    const R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, powerPreference: 'low-power' });
    R3.setPixelRatio(1);
    const sc = new THREE.Scene(); sc.fog = new THREE.Fog(0x06101f, 12, 60);
    const cam = new THREE.PerspectiveCamera(60, 1, .1, 100); cam.position.set(0, 3.2, 9);
    const rails = new THREE.Group(); sc.add(rails);
    const mat = new THREE.LineBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: .6 });
    [-1.4, 1.4].forEach(x => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, -80), new THREE.Vector3(x, 0, 40)]); rails.add(new THREE.Line(g, mat)); });
    const sl = new THREE.BoxGeometry(4, .12, .3), sm = new THREE.MeshBasicMaterial({ color: 0x1d4a85, wireframe: true });
    const sleepers = []; for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sl, sm); m.position.set(0, -.05, -i * 2 + 10); rails.add(m); sleepers.push(m); }
    const grid = new THREE.GridHelper(120, 60, 0x1d4a85, 0x0e2548); grid.position.y = -.2; sc.add(grid);
    // wireframe rover
    const rover = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, .5, 1.8), new THREE.MeshBasicMaterial({ color: 0x2ee59d, wireframe: true })); body.position.y = .55; rover.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.5, .35, .5), new THREE.MeshBasicMaterial({ color: 0xffb020, wireframe: true })); head.position.set(0, 1, .2); rover.add(head);
    [-.8, .8].forEach(x => { const t = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, 2), new THREE.MeshBasicMaterial({ color: 0x4aa3ff, wireframe: true })); t.position.set(x, .2, 0); rover.add(t); });
    rover.position.set(0, 0, 2); sc.add(rover);
    // floating polyhedra
    const shapes = []; const geos = [new THREE.IcosahedronGeometry(.7), new THREE.OctahedronGeometry(.6), new THREE.TorusGeometry(.5, .15, 8, 16)];
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(geos[i % 3], new THREE.MeshBasicMaterial({ color: i % 4 ? 0x2f6fb8 : 0xff4d5e, wireframe: true, transparent: true, opacity: .45 })); m.position.set(rnd(-14, 14), rnd(1.5, 8), rnd(-35, 2)); sc.add(m); shapes.push(m); }
    function rs() { const w = innerWidth, h = innerHeight; R3.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    addEventListener('resize', rs); rs();
    let px = 0, py = 0; addEventListener('pointermove', e => { px = e.clientX / innerWidth - .5; py = e.clientY / innerHeight - .5; });
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0, lastF = 0;
    (function anim(ts) {
      requestAnimationFrame(anim);
      if (document.hidden || ts - lastF < 33) return;      // pause in background tabs, cap at ~30 fps
      lastF = ts; if (!reduce) t += .033;
      sleepers.forEach((m, i) => { m.position.z = ((i * 3.3 + t * 6) % 80) - 70 + 10; });
      shapes.forEach((m, i) => { m.rotation.x = t * .4 + i; m.rotation.y = t * .3 + i; m.position.y += Math.sin(t + i) * .004; });
      rover.position.y = Math.sin(t * 3) * .03;
      cam.position.x += (px * 3 - cam.position.x) * .06; cam.position.y += (3.2 - py * 1.5 - cam.position.y) * .06; cam.lookAt(0, 1, -5);
      R3.render(sc, cam);
    })(0);
  }

  // Load three.js only after the page is usable, so it never blocks the dashboard from opening.
  function lazy3D() {
    if (!$('bg') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const go = () => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      sc.async = true;
      sc.onload = () => { try { init3D(); } catch (e) { console.warn('3D background disabled:', e); } };
      document.head.appendChild(sc);
    };
    (window.requestIdleCallback || (f => setTimeout(f, 800)))(go, { timeout: 2500 });
  }

  /* ---------- Boot ---------- */
  function boot() {
    load();
    fixLinks();                       // plain links work even if components fail to load
    loadComponents().then(() => {
      mount();
      R.booted = true;
      R._hooks.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
      lazy3D();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
