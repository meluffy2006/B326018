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
    const CAMERA_URL = "http://10.119.183.243";

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

        setCameraStatus("LOADING");

        camera.src = CAMERA_URL;

        console.log(
            "Opening ESP32 camera:",
            CAMERA_URL
        );

    }

    function reconnectCamera() {

        if (!camera) return;

        setCameraStatus("RECONNECTING");

        // Reload the exact URL without adding
        // a different endpoint or port.
        camera.src = "about:blank";

        setTimeout(() => {
            camera.src = CAMERA_URL;
        }, 150);

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

        /* IFRAME LOAD EVENT */

        camera.addEventListener("load", () => {

            /*
             * The load event does not prove that
             * the video is actually playing.
             *
             * It only indicates that iframe
             * navigation has completed.
             */

            setCameraStatus("CAMERA");

            console.log(
                "Camera iframe load event received."
            );

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
