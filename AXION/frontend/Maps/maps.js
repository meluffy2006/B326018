const map = L.map('map').setView([13.1346, 77.5680], 17);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const icon = L.divIcon({ className: '', html: '<div class="rover-icon"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
const marker = L.marker([0, 0], { icon }).bindPopup('Safety Rover');
const trail = L.polyline([], { color: '#4aa3ff', weight: 4 }).addTo(map);
let follow = true, lastTime = 0, placed = false;

const $ = id => document.getElementById(id);

function update(p) {
  const pos = [p.lat, p.lng];
  if (!placed) { marker.addTo(map); map.setView(pos, 18); placed = true; }
  marker.setLatLng(pos);
  trail.addLatLng(pos);
  if (follow) map.panTo(pos, { animate: true });
  lastTime = p.time;
  $('lat').textContent = p.lat.toFixed(6);
  $('lng').textContent = p.lng.toFixed(6);
  $('spd').textContent = (p.speed * 3.6).toFixed(1) + ' km/h';
  $('hdg').textContent = Math.round(p.heading) + '°';
  $('upd').textContent = new Date(p.time).toLocaleTimeString();
}

function setStatus() {
  const live = lastTime && Date.now() - lastTime < 10000;
  const s = $('status');
  s.textContent = live ? 'Rover online' : (lastTime ? 'Signal lost' : 'Waiting for rover');
  s.className = 'badge ' + (live ? 'on' : 'off');
}
setInterval(setStatus, 1000);

// Load existing trail, then listen for live updates
fetch('/api/rover/history').then(r => r.json()).then(h => {
  h.forEach(update);
  setStatus();
}).catch(() => {});

const es = new EventSource('/api/rover/stream');
addEventListener('pagehide', () => es.close());   // free the connection before the next page loads
es.onmessage = e => { update(JSON.parse(e.data)); setStatus(); };

$('follow').onclick = e => { follow = !follow; e.target.classList.toggle('on', follow); };
$('clear').onclick = () => trail.setLatLngs([]);
map.on('dragstart', () => { follow = false; $('follow').classList.remove('on'); });