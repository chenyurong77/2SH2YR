const disruption = {
  recommended: [
    [1.3521, 103.9446], [1.3485, 103.9310], [1.3404, 103.9081],
    [1.3312, 103.8684], [1.3207, 103.8438], [1.3062, 103.8327],
    [1.3001, 103.8417], [1.2868, 103.8514]
  ],
  usual: [
    [1.3521, 103.9446], [1.3434, 103.9533], [1.3272, 103.9464],
    [1.3203, 103.9032], [1.3180, 103.8931], [1.3008, 103.8559],
    [1.2868, 103.8514]
  ]
};

let map;
let routeLayers = [];
let isDisrupted = true;
let toastTimer;

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function makeMarker(letter, label) {
  return L.marker([0, 0], {
    icon: L.divIcon({
      className: '',
      html: `<div aria-label="${label}" style="width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:white;border:3px solid #0c2c43;color:#0c2130;font:800 11px 'DM Sans',sans-serif;box-shadow:0 3px 9px rgba(4,20,31,.24)">${letter}</div>`,
      iconSize: [30, 30], iconAnchor: [15, 15]
    })
  });
}

function drawRoutes() {
  if (!map) return;
  routeLayers.forEach(layer => layer.remove());
  routeLayers = [];

  const usual = L.polyline(disruption.usual, {
    color: isDisrupted ? '#cf665e' : '#079447',
    weight: 6,
    opacity: .82,
    dashArray: isDisrupted ? '7 8' : null,
    lineCap: 'round'
  }).addTo(map);

  routeLayers.push(usual);

  if (isDisrupted) {
    const alternative = L.polyline(disruption.recommended, {
      color: '#123f5c', weight: 7, opacity: .95, lineCap: 'round'
    }).addTo(map);
    routeLayers.push(alternative);
  }

  const start = makeMarker('T', 'Tampines').setLatLng(disruption.usual[0]).addTo(map);
  const end = makeMarker('R', 'Raffles Place').setLatLng(disruption.usual.at(-1)).addTo(map);
  routeLayers.push(start, end);
  map.fitBounds(L.featureGroup(routeLayers).getBounds(), { padding: [28, 28] });
}

function initMap() {
  if (!window.L) return;
  map = L.map('map', { zoomControl: false, scrollWheelZoom: false, attributionControl: true });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  drawRoutes();
}

function setScenario(disrupted) {
  isDisrupted = disrupted;
  const toggle = document.getElementById('scenarioToggle');
  const card = document.getElementById('alertCard');
  const rec = document.getElementById('recommendedRoute');
  const usual = document.getElementById('usualRoute');
  const legendRecommended = document.querySelector('.map-legend span:first-child');

  toggle.classList.toggle('is-on', disrupted);
  toggle.setAttribute('aria-checked', String(disrupted));
  card.classList.toggle('normal', !disrupted);
  document.getElementById('scenarioLabel').textContent = disrupted ? 'EWL disruption' : 'Normal service';

  if (disrupted) {
    card.querySelector('.status-chip').innerHTML = '<span class="pulse"></span> ACTION NEEDED';
    card.querySelector('.alert-icon').innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>';
    document.getElementById('recommendationTitle').textContent = 'Leave 10 minutes earlier.';
    document.getElementById('recommendationText').innerHTML = 'Take Bus 23 → DTL. You’ll arrive around <strong>08:37</strong>, before your 08:45 deadline.';
    document.getElementById('useRouteButton').style.display = 'flex';
    rec.hidden = false;
    usual.classList.add('disrupted');
    usual.querySelector('.warning-tag').textContent = 'Disrupted';
    usual.querySelector('.warning-tag').style.display = 'inline-block';
    usual.querySelector('time').textContent = '08:54';
    usual.querySelector('time').dateTime = '08:54';
    usual.querySelector('.route-meta').innerHTML = '<span><strong>69 min</strong> estimated</span><span>High crowding</span>';
    legendRecommended.style.display = 'flex';
  } else {
    card.querySelector('.status-chip').innerHTML = '<span class="pulse"></span> ON TRACK';
    card.querySelector('.alert-icon').innerHTML = '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>';
    document.getElementById('recommendationTitle').textContent = 'Your usual route is on time.';
    document.getElementById('recommendationText').innerHTML = 'Leave at <strong>07:40</strong> as planned. You should arrive around <strong>08:36</strong>.';
    document.getElementById('useRouteButton').style.display = 'none';
    rec.hidden = true;
    usual.classList.remove('disrupted');
    usual.querySelector('.warning-tag').style.display = 'none';
    usual.querySelector('time').textContent = '08:36';
    usual.querySelector('time').dateTime = '08:36';
    usual.querySelector('.route-meta').innerHTML = '<span><strong>56 min</strong> total</span><span>Moderate crowding</span>';
    legendRecommended.style.display = 'none';
  }
  drawRoutes();
}

document.getElementById('scenarioToggle').addEventListener('click', () => setScenario(!isDisrupted));

document.getElementById('whyToggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  document.getElementById('whyDetails').hidden = expanded;
});

document.getElementById('useRouteButton').addEventListener('click', (event) => {
  event.currentTarget.querySelector('span').textContent = 'Route selected';
  showToast('Recommended route saved for this morning.');
});

document.getElementById('notificationButton').addEventListener('click', () => showToast('1 travel alert: EWL delay affects your commute.'));
document.getElementById('editJourneyButton').addEventListener('click', () => showToast('Journey editing will connect to saved preferences next.'));
document.getElementById('journeysNav').addEventListener('click', () => showToast('Saved journeys are the next frontend screen.'));
document.getElementById('settingsNav').addEventListener('click', () => showToast('Notification settings are coming next.'));

window.addEventListener('load', initMap);
