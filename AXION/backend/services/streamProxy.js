// Shared MJPEG relay for the ESP32 camera.
// The ESP32 serves only ONE viewer at a time, and a closed page keeps its
// connection alive for a while. So the server keeps a single upstream
// connection open and re-broadcasts it to every browser page. Changing pages
// no longer touches the camera, and the last frame is sent instantly on connect.
const CAMERA_URL = (process.env.CAMERA_URL || "http://10.92.125.243").replace(/\/+$/, "");
const UPSTREAM = process.env.CAMERA_STREAM_URL || CAMERA_URL + ":81/stream";
const IDLE_CLOSE_MS = 30000;   // keep the camera connection warm this long with no viewers
const RETRY_MS = 1000;
const BOUNDARY = "axionframe";

const clients = new Set();
let lastFrame = null;
let abort = null;
let running = false;
let idleTimer = null;

function writeFrame(res, frame) {
  res.write(`--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
  res.write(frame);
  res.write("\r\n");
}

async function pump() {
  if (running) return;
  running = true;
  while (clients.size > 0) {
    abort = new AbortController();
    try {
      const r = await fetch(UPSTREAM, { signal: abort.signal });
      if (!r.ok || !r.body) throw new Error("camera HTTP " + r.status);
      let buf = Buffer.alloc(0);
      for await (const chunk of r.body) {
        buf = Buffer.concat([buf, chunk]);
        for (;;) {                                   // cut out whole JPEGs (FFD8 ... FFD9)
          const s = buf.indexOf(Buffer.from([0xff, 0xd8]));
          if (s < 0) { buf = Buffer.alloc(0); break; }
          const e = buf.indexOf(Buffer.from([0xff, 0xd9]), s + 2);
          if (e < 0) { buf = buf.subarray(s); break; }
          lastFrame = buf.subarray(s, e + 2);
          buf = buf.subarray(e + 2);
          for (const c of clients) writeFrame(c, lastFrame);
        }
      }
    } catch (err) {
      if (abort.signal.aborted) break;
    }
    if (clients.size > 0) await new Promise(r => setTimeout(r, RETRY_MS));
  }
  running = false;
}

function handler(req, res) {
  clearTimeout(idleTimer);
  res.writeHead(200, {
    "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Connection": "keep-alive"
  });
  if (lastFrame) writeFrame(res, lastFrame);          // instant picture on page change
  clients.add(res);
  pump();
  req.on("close", () => {
    clients.delete(res);
    if (clients.size === 0) {
      idleTimer = setTimeout(() => { if (abort) abort.abort(); }, IDLE_CLOSE_MS);
    }
  });
}

module.exports = { handler };
