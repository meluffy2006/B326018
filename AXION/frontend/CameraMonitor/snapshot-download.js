/* Capture snapshot -> preview popup -> Download button.
   Works alongside the existing #snapBtn handler (evidence saving etc. is untouched). */
(function () {
  const css = `
  #snapmodal{position:fixed;inset:0;z-index:10000;background:#000a;display:none;align-items:center;
    justify-content:center;padding:16px}
  #snapmodal.open{display:flex}
  #snapmodal .box{background:#0f1a3a;color:#e8eefc;border:1px solid #ffffff33;border-radius:14px;
    padding:18px;max-width:min(640px,100%);font:15px system-ui,sans-serif;box-shadow:0 12px 40px #000a}
  #snapmodal h3{margin:0 0 4px;font-size:18px}
  #snapmodal p{margin:0 0 12px;opacity:.75}
  #snapmodal img{display:block;max-width:100%;max-height:55vh;border-radius:8px;margin:0 auto 14px;background:#000}
  #snapmodal .btns{display:flex;gap:10px;justify-content:flex-end}
  #snapmodal button{border:0;border-radius:8px;padding:10px 18px;font:600 15px system-ui;cursor:pointer}
  #snapmodal .dl{background:#3b82f6;color:#fff}
  #snapmodal .cancel{background:#26346a;color:#e8eefc}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const modal = document.createElement("div");
  modal.id = "snapmodal";
  modal.innerHTML = `<div class="box">
    <h3>📸 Snapshot captured</h3>
    <p>Do you want to download this snapshot?</p>
    <img alt="Snapshot preview">
    <div class="btns"><button class="cancel">Close</button><button class="dl">⬇ Download</button></div>
  </div>`;
  document.body.appendChild(modal);

  const preview = modal.querySelector("img");
  let currentUrl = null, currentName = "";

  function closeModal() {
    modal.classList.remove("open");
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
  }

  // Grab the current frame from whatever the live view is (canvas, img or video)
  function frameBlob() {
    return new Promise((resolve, reject) => {
      let src = document.getElementById("feed")
        || document.querySelector(".camwrap canvas, .camwrap img, .camwrap video");
      if (!src) return reject(new Error("no feed element"));
      let canvas = src;
      if (!(src instanceof HTMLCanvasElement)) {
        canvas = document.createElement("canvas");
        canvas.width = src.videoWidth || src.naturalWidth || src.width;
        canvas.height = src.videoHeight || src.naturalHeight || src.height;
        canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
      }
      try {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error("empty frame"))), "image/png");
      } catch (e) {
        reject(e);   // tainted canvas (cross-origin stream)
      }
    });
  }

  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  // Delegated + capture phase: grabs the frame at the moment of the click
  document.addEventListener("click", async e => {
    if (!e.target.closest("#snapBtn")) return;
    try {
      const blob = await frameBlob();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(blob);
      currentName = `rover-snapshot-${stamp()}.png`;
      preview.src = currentUrl;
      modal.classList.add("open");
    } catch (err) {
      alert("Couldn't capture the snapshot: the stream is blocked from being saved (cross-origin). " +
            "Load the camera through the /api/camera proxy instead of directly from the ESP32.");
    }
  }, true);

  modal.querySelector(".dl").onclick = () => {
    if (!currentUrl) return;
    const a = document.createElement("a");
    a.href = currentUrl;
    a.download = currentName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    closeModal();
  };
  modal.querySelector(".cancel").onclick = closeModal;
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
})();
