/* ==========================================
   AXION SAFETY ROVER
   ESP32 CAMERA MONITOR
========================================== */

(function () {

    "use strict";

    const R = window.Rover;
    const S = R.S;
    const $ = R.$;

    /* ==========================================
       CAMERA CONFIGURATION
    ========================================== */

    // Exact URL provided by the user.
    // >>> PASTE THE CAMERA LINK HERE (the only line you need to edit) <<<
    const CAMERA_URL = "http://10.119.183.243";

    // Derived from the link above. The ESP32 serves live video on port 81.
    const STREAM_URL = CAMERA_URL.replace(/\/+$/, "") + ":81/stream";

    let retryTimer = null;
    let failCount = 0;
    let pageFrame = null;

    let camera = null;
    let currentMode = "normal";

    /* ==========================================
       CAMERA CONNECTION
    ========================================== */

    function setCameraStatus(status) {

        const statusElement = $("cameraStatus");

        if (statusElement) {
            statusElement.textContent = status;
        }

    }

    function connectCamera() {

        if (!camera) return;

        clearTimeout(retryTimer);

        if (pageFrame) pageFrame.hidden = true;
        camera.hidden = false;

        setCameraStatus("LOADING");

        // Timestamp forces a fresh stream connection.
        camera.src = STREAM_URL + "?t=" + Date.now();

        console.log(
            "Opening ESP32 stream:",
            STREAM_URL
        );

    }

    function reconnectCamera() {

        if (!camera) return;

        setCameraStatus("RECONNECTING");

        failCount = 0;
        camera.removeAttribute("src");

        // The ESP32 only serves one viewer at a time,
        // so give it a moment to release the old stream.
        setTimeout(connectCamera, 500);

    }

    /* ==========================================
       CAMERA VIEW MODES
    ========================================== */

    function changeCameraMode(mode) {

        if (!camera) return;

        currentMode = mode;
        S.mode = mode;

        const names = {
            normal: "Normal view",
            thermal: "Thermal-style view",
            night: "Low-light view"
        };

        document
            .querySelectorAll("[data-mode]")
            .forEach(button => {

                button.classList.toggle(
                    "on",
                    button.dataset.mode === mode
                );

            });

        const modeLabel = $("camMode");

        if (modeLabel) {

            modeLabel.textContent =
                names[mode] + " · Coach B, Zone 3";

        }

        camera.style.filter = "none";

        if (mode === "thermal") {

            camera.style.filter =
                "contrast(1.5) saturate(2) hue-rotate(150deg)";

        }

        if (mode === "night") {

            camera.style.filter =
                "brightness(1.8) contrast(1.3) sepia(1) hue-rotate(60deg)";

        }

        /*
         * These filters only modify the appearance
         * of the embedded camera webpage.
         *
         * They do not provide actual thermal
         * imaging or night vision.
         */

    }

    /* ==========================================
       SNAPSHOT
    ========================================== */

    async function snapshot(tag = "manual") {

        /*
         * The camera is embedded using an iframe.
         *
         * Browsers do not allow JavaScript to read
         * pixels from a cross-origin iframe.
         *
         * A real snapshot requires a separate
         * ESP32 capture endpoint.
         */

        console.warn(
            "Snapshot requires an ESP32 capture endpoint."
        );

        if (typeof R.toast === "function") {

            R.toast(
                "Snapshot requires ESP32 capture support"
            );

        }

        return false;

    }

    /* ==========================================
       EVIDENCE GALLERY
    ========================================== */

    function renderSnaps() {

        const box = $("snaps");

        if (!box) return;

        box.replaceChildren();

        if (!S.snaps || !S.snaps.length) {

            const empty = document.createElement("div");

            empty.className = "empty";
            empty.style.gridColumn = "1 / -1";

            empty.textContent =
                "Captured snapshots will appear here.";

            box.appendChild(empty);

            return;

        }

        S.snaps.forEach((snap, index) => {

            const card = document.createElement("div");
            card.className = "snapshot-card";

            const img = document.createElement("img");

            img.src = snap.src;
            img.alt = snap.title || "Camera snapshot";
            img.title = snap.title || "Camera snapshot";

            const button = document.createElement("button");

            button.type = "button";
            button.textContent = "⬇ Download";

            button.addEventListener("click", () => {
                downloadSnapshot(index);
            });

            card.appendChild(img);
            card.appendChild(button);

            box.appendChild(card);

        });

    }

    /* ==========================================
       DOWNLOAD SNAPSHOT
    ========================================== */

    function downloadSnapshot(index) {

        const snap = S.snaps?.[index];

        if (!snap) return;

        const link = document.createElement("a");

        link.href = snap.src;

        link.download =
            `AXION-Snapshot-${Date.now()}.jpg`;

        document.body.appendChild(link);

        link.click();

        link.remove();

    }

    /* ==========================================
       EVENT HISTORY
    ========================================== */

    function renderHist() {

        const history = $("history");

        if (!history) return;

        history.replaceChildren();

        if (!S.history || !S.history.length) {

            const empty = document.createElement("div");

            empty.className = "empty";
            empty.textContent = "No events yet.";

            history.appendChild(empty);

            return;

        }

        S.history.forEach(event => {

            const item = document.createElement("div");

            item.className = "item low";

            item.appendChild(
                document.createTextNode(event.m || "")
            );

            const time = document.createElement("span");

            time.textContent = event.t || "";

            item.appendChild(time);

            history.appendChild(item);

        });

    }

    /* ==========================================
       TIMESTAMP
    ========================================== */

    function updateTimestamp() {

        const timestamp = $("camTs");

        if (!timestamp) return;

        timestamp.textContent =
            new Date().toLocaleTimeString();

    }

    /* ==========================================
       LED CONTROL
    ========================================== */

    function setupLEDControl() {

        const lights = $("lights");

        if (!lights) return;

        lights.addEventListener("click", () => {

            S.lights = !S.lights;

            lights.classList.toggle(
                "on",
                S.lights
            );

            lights.textContent =
                "LED lights: " +
                (S.lights ? "on" : "off");

            /*
             * UI control only.
             *
             * Actual ESP32 LED control requires
             * a firmware endpoint.
             */

        });

    }

    /* ==========================================
       EXTERNAL ROVER HOOKS
    ========================================== */

    // Disable the old simulated Canvas renderer.
    R.drawFeed = () => {};

    // Preserve the snapshot hook used by alerts.
    R.snapshot = snapshot;

    R.renderHist = renderHist;

    /* ==========================================
       INITIALIZATION
    ========================================== */

    R.ready(() => {

        camera = $("feed");

        // Replace the old canvas (Dashboard) or iframe (Camera Monitor)
        // with an <img>, which can play the ESP32 MJPEG stream.
        if (camera && camera.tagName !== "IMG") {

            const img = document.createElement("img");

            img.className = "feed";
            img.id = "feed";
            img.alt = "AXION ESP32 Live Camera";

            img.style.cssText =
                "width:100%;height:100%;display:block;" +
                "object-fit:contain;background:#000;";

            camera.replaceWith(img);
            camera = img;

        }

        renderSnaps();
        renderHist();

        updateTimestamp();

        setInterval(updateTimestamp, 1000);

        if (!camera) {

            console.error(
                "Camera iframe not found."
            );

            return;

        }

        /* STREAM EVENTS */

        camera.addEventListener("load", () => {

            failCount = 0;
            setCameraStatus("LIVE");

        });

        camera.addEventListener("error", () => {

            failCount++;

            // Stream did not start: show the camera's own page instead.
            if (failCount >= 3) {

                if (!pageFrame) {

                    pageFrame = document.createElement("iframe");

                    pageFrame.className = "feed";
                    pageFrame.title = "AXION ESP32 Camera Page";
                    pageFrame.allowFullscreen = true;

                    pageFrame.style.cssText =
                        "width:100%;height:100%;display:block;" +
                        "border:none;background:#000;";

                    camera.after(pageFrame);

                }

                camera.hidden = true;
                pageFrame.hidden = false;
                pageFrame.src = CAMERA_URL;

                setCameraStatus("CAMERA PAGE");

                return;

            }

            setCameraStatus("OFFLINE - retrying");

            clearTimeout(retryTimer);
            retryTimer = setTimeout(connectCamera, 3000);

        });

        /* CAMERA VIEW BUTTONS */

        document
            .querySelectorAll("[data-mode]")
            .forEach(button => {

                button.addEventListener("click", () => {

                    changeCameraMode(
                        button.dataset.mode
                    );

                });

            });

        /* SNAPSHOT BUTTON */

        const snapBtn = $("snapBtn");

        if (snapBtn) {

            snapBtn.addEventListener("click", async () => {

                snapBtn.disabled = true;

                try {
                    await snapshot("manual");
                } finally {
                    snapBtn.disabled = false;
                }

            });

        }

        /* RECONNECT BUTTON */

        const reconnectBtn = $("reconnectBtn");

        if (reconnectBtn) {

            reconnectBtn.addEventListener(
                "click",
                reconnectCamera
            );

        }

        /* LED BUTTON */

        setupLEDControl();

        /* INITIAL MODE */

        changeCameraMode(
            S.mode || "normal"
        );

        /* START CAMERA */

        connectCamera();

    });

})();
