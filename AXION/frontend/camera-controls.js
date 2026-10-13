/* ESP32 (OV3660) camera settings panel.
   Floating "Camera Settings" button -> right-hand drawer.
   Talks to the Express proxy: /api/camera/status and /api/camera/control?var=..&val=..
   Self-contained: injects its own CSS, no separate .css file needed. */
(function () {
  const API = "/api/camera";

  const FRAMESIZES = [
    [0, "QQVGA (160x120)"], [1, "QCIF (176x144)"], [2, "HQVGA (240x176)"], [3, "240x240"],
    [4, "QVGA (320x240)"], [5, "CIF (400x296)"], [6, "HVGA (480x320)"], [7, "VGA (640x480)"],
    [8, "SVGA (800x600)"], [9, "XGA (1024x768)"], [10, "HD (1280x720)"], [11, "SXGA (1280x1024)"],
    [12, "UXGA (1600x1200)"], [13, "FHD (1920x1080)"], [16, "QXGA (2048x1536)"]
  ];
  const EFFECTS = [
    [0, "No Effect"], [1, "Negative"], [2, "Grayscale"], [3, "Red Tint"],
    [4, "Green Tint"], [5, "Blue Tint"], [6, "Sepia"]
  ];

  // type: xclk | select | range | toggle
  const CONTROLS = [
    { k: "xclk", label: "XCLK MHz", type: "xclk", min: 1, max: 40, def: 21 },
    { k: "framesize", label: "Resolution", type: "select", options: FRAMESIZES },
    { k: "quality", label: "Quality", type: "range", min: 4, max: 63 },
    { k: "brightness", label: "Brightness", type: "range", min: -3, max: 3 },
    { k: "contrast", label: "Contrast", type: "range", min: -3, max: 3 },
    { k: "saturation", label: "Saturation", type: "range", min: -4, max: 4 },
    { k: "sharpness", label: "Sharpness", type: "range", min: -3, max: 3 },
    { k: "denoise", label: "De-Noise", type: "range", min: 0, max: 8 },
    { k: "ae_level", label: "Exposure Level", type: "range", min: -5, max: 5 },
    { k: "gainceiling", label: "Gain Ceiling", type: "range", min: 0, max: 511 },
    { k: "special_effect", label: "Special Effect", type: "select", options: EFFECTS },
    { k: "awb", label: "AWB Enable", type: "toggle" },
    { k: "awb_gain", label: "Advanced AWB", type: "toggle" },
    { k: "aec", label: "AEC Enable", type: "toggle" },
    { k: "aec2", label: "Night Mode", type: "toggle" },
    { k: "agc", label: "AGC", type: "toggle" },
    { k: "raw_gma", label: "GMA Enable", type: "toggle" },
    { k: "lenc", label: "Lens Correction", type: "toggle" },
    { k: "hmirror", label: "H-Mirror", type: "toggle" },
    { k: "vflip", label: "V-Flip", type: "toggle" },
    { k: "bpc", label: "BPC", type: "toggle" },
    { k: "wpc", label: "WPC", type: "toggle" },
    { k: "colorbar", label: "Color Bar", type: "toggle" },
    { k: "led_intensity", label: "LED Intensity", type: "range", min: 0, max: 255 }
  ];

  const css = `
  #camfab{position:fixed;right:18px;bottom:18px;z-index:9998;background:#3b82f6;color:#fff;border:0;
    border-radius:999px;padding:12px 18px;font:600 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 18px #0006}
  #campanel{position:fixed;top:0;right:0;height:100%;width:min(420px,100vw);z-index:9997;background:#0f1a3a;
    color:#e8eefc;font:15px system-ui,sans-serif;box-shadow:-8px 0 24px #0008;transform:translateX(105%);
    transition:transform .2s;display:flex;flex-direction:column}
  #campanel.open{transform:none}
  #campanel header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;
    border-bottom:1px solid #ffffff22;font-weight:700}
  #campanel header button{background:none;border:0;color:#e8eefc;font-size:20px;cursor:pointer}
  #camrows{overflow-y:auto;padding:6px 16px 80px;flex:1}
  .camrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;
    border-bottom:1px solid #ffffff14}
  .camrow label{flex:0 0 130px}
  .camrow .ctl{flex:1;display:flex;align-items:center;gap:8px;justify-content:flex-end}
  .camrow input[type=range]{flex:1;min-width:0}
  .camrow select,.camrow input[type=number]{background:#16244d;color:#e8eefc;border:1px solid #ffffff33;
    border-radius:6px;padding:6px 8px;font:inherit}
  .camrow input[type=number]{width:80px}
  .camrow select{flex:1}
  .camrow .val{width:36px;text-align:right}
  .camrow .setbtn{background:#3b82f6;color:#fff;border:0;border-radius:6px;padding:6px 14px;
    font:600 14px system-ui;cursor:pointer}
  .camrow .hint{font-size:12px;opacity:.6;margin-top:4px;text-align:right}
  .camtoggle{position:relative;width:46px;height:24px;flex:none}
  .camtoggle input{opacity:0;width:100%;height:100%;margin:0;cursor:pointer;position:absolute;inset:0;z-index:1}
  .camtoggle span{position:absolute;inset:0;background:#3a4468;border-radius:999px;transition:.15s}
  .camtoggle span:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;
    background:#fff;transition:.15s}
  .camtoggle input:checked+span{background:#3b82f6}
  .camtoggle input:checked+span:after{left:25px}
  #camtoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:#1d2b5a;
    border-left:4px solid #ef4444;color:#fff;padding:10px 16px;border-radius:8px;display:none;
    font:600 15px system-ui}
  #camtoast.ok{border-left-color:#22c55e}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const fab = document.createElement("button");
  fab.id = "camfab";
  fab.textContent = "📷 Camera Settings";
  const panel = document.createElement("aside");
  panel.id = "campanel";
  panel.innerHTML = `<header><span>📷 Camera Settings</span><button title="Close">✕</button></header>
    <div id="camrows"></div>`;
  const toast = document.createElement("div");
  toast.id = "camtoast";
  document.body.append(fab, panel, toast);

  const rows = panel.querySelector("#camrows");
  let toastTimer;
  function say(msg, ok) {
    toast.textContent = msg;
    toast.className = ok ? "ok" : "";
    toast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.style.display = "none"), 2500);
  }

  async function send(key, val) {
    try {
      const r = await fetch(`${API}/control?var=${encodeURIComponent(key)}&val=${encodeURIComponent(val)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "failed");
      return true;
    } catch (e) {
      say("Camera unreachable");
      return false;
    }
  }

  function build(status) {
    rows.innerHTML = "";
    CONTROLS.forEach(c => {
      const cur = status[c.k] !== undefined ? Number(status[c.k]) : c.def;
      const row = document.createElement("div");
      row.className = "camrow";
      const lab = document.createElement("label");
      lab.textContent = c.label;
      const ctl = document.createElement("div");
      ctl.className = "ctl";

      if (c.type === "xclk") {
        const input = document.createElement("input");
        input.type = "number"; input.min = c.min; input.max = c.max; input.step = 1;
        input.value = Number.isFinite(cur) ? cur : c.def;
        const btn = document.createElement("button");
        btn.className = "setbtn"; btn.textContent = "Set";
        const apply = async () => {
          const v = Math.round(Number(input.value));
          if (!Number.isFinite(v) || v < c.min || v > c.max) {
            say(`XCLK must be ${c.min}–${c.max} MHz`);
            return;
          }
          input.value = v;
          btn.disabled = true;
          if (await send("xclk", v)) say(`XCLK set to ${v} MHz`, true);
          btn.disabled = false;
        };
        btn.onclick = apply;
        input.addEventListener("keydown", e => { if (e.key === "Enter") apply(); });
        ctl.append(input, btn);
      } else if (c.type === "select") {
        const sel = document.createElement("select");
        c.options.forEach(([v, t]) => {
          const o = document.createElement("option");
          o.value = v; o.textContent = t;
          if (v === cur) o.selected = true;
          sel.appendChild(o);
        });
        sel.onchange = () => send(c.k, sel.value);
        ctl.appendChild(sel);
      } else if (c.type === "range") {
        const inp = document.createElement("input");
        inp.type = "range"; inp.min = c.min; inp.max = c.max; inp.step = 1;
        inp.value = Number.isFinite(cur) ? cur : c.min;
        const val = document.createElement("span");
        val.className = "val"; val.textContent = inp.value;
        inp.oninput = () => (val.textContent = inp.value);
        inp.onchange = () => send(c.k, inp.value);   // send once on release
        ctl.append(inp, val);
      } else {
        const wrap = document.createElement("div");
        wrap.className = "camtoggle";
        const inp = document.createElement("input");
        inp.type = "checkbox"; inp.checked = !!cur;
        inp.onchange = () => send(c.k, inp.checked ? 1 : 0);
        wrap.append(inp, document.createElement("span"));
        ctl.appendChild(wrap);
      }
      row.append(lab, ctl);
      rows.appendChild(row);
    });
  }

  async function load() {
    try {
      const r = await fetch(`${API}/status`);
      const s = await r.json();
      if (!r.ok || s.error) throw new Error(s.error || "failed");
      build(s);
    } catch (e) {
      build({});            // still show the panel (incl. XCLK) with defaults
      say("Camera unreachable");
    }
  }

  fab.onclick = () => {
    const open = panel.classList.toggle("open");
    if (open) load();
  };
  panel.querySelector("header button").onclick = () => panel.classList.remove("open");
})();
