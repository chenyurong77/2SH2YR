const STORAGE_KEY = 'wayahead-demo-state-v2';

const defaultState = {
  activeView: 'today',
  disrupted: true,
  routeSelected: false,
  notificationsRead: false,
  journey: {
    origin: 'Tampines',
    destination: 'Raffles Place',
    departure: '07:40',
    deadline: '08:45'
  },
  settings: {
    proactive: true,
    crowding: true,
    weather: true,
    threshold: '10'
  }
};

const routeCoordinates = {
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

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(defaultState);
    return {
      ...structuredClone(defaultState),
      ...saved,
      journey: { ...defaultState.journey, ...saved.journey },
      settings: { ...defaultState.settings, ...saved.settings }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();
let map;
let routeLayers = [];
let toastTimer;

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private browsing can block storage */ }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function switchView(viewName) {
  const nextView = document.querySelector(`[data-view="${viewName}"]`);
  if (!nextView) return;
  state.activeView = viewName;
  saveState();
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-active', view === nextView));
  document.querySelectorAll('.bottom-nav [data-view-target]').forEach(button => {
    const active = button.dataset.viewTarget === viewName;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  closeNotifications();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (viewName === 'today' && map) setTimeout(() => map.invalidateSize(), 80);
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
  const usual = L.polyline(routeCoordinates.usual, {
    color: state.disrupted ? '#cf665e' : '#079447', weight: 6, opacity: .82,
    dashArray: state.disrupted ? '7 8' : null, lineCap: 'round'
  }).addTo(map);
  routeLayers.push(usual);
  if (state.disrupted) {
    routeLayers.push(L.polyline(routeCoordinates.recommended, {
      color: '#123f5c', weight: 7, opacity: .95, lineCap: 'round'
    }).addTo(map));
  }
  routeLayers.push(
    makeMarker('T', state.journey.origin).setLatLng(routeCoordinates.usual[0]).addTo(map),
    makeMarker('R', state.journey.destination).setLatLng(routeCoordinates.usual.at(-1)).addTo(map)
  );
  map.fitBounds(L.featureGroup(routeLayers).getBounds(), { padding: [28, 28] });
}

function initMap() {
  if (!window.L || map) return;
  map = L.map('map', { zoomControl: false, scrollWheelZoom: false, attributionControl: true });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  drawRoutes();
}

function renderJourney() {
  document.querySelectorAll('.originText').forEach(node => { node.textContent = state.journey.origin; });
  document.querySelectorAll('.destinationText').forEach(node => { node.textContent = state.journey.destination; });
  document.querySelectorAll('.departureText').forEach(node => { node.textContent = state.journey.departure; });
  document.querySelectorAll('.deadlineText').forEach(node => { node.textContent = state.journey.deadline; });
  if (map) drawRoutes();
}

async function setScenario(disrupted, persist = true) {
  state.disrupted = disrupted;
  state.routeSelected = disrupted ? state.routeSelected : false;

  if (persist) saveState();

  const toggle = document.getElementById('scenarioToggle');
  const card = document.getElementById('alertCard');
  const recommended = document.getElementById('recommendedRoute');
  const usual = document.getElementById('usualRoute');
  const legendRecommended = document.querySelector('.map-legend span:first-child');
  const routeButton = document.getElementById('useRouteButton');

  toggle.classList.toggle('is-on', disrupted);
  toggle.setAttribute('aria-checked', String(disrupted));

  card.classList.toggle('normal', !disrupted);

  document.getElementById('scenarioLabel').textContent =
    disrupted ? 'EWL disruption' : 'Normal service';

  // ----------------------------------------------------------
  // Ask the FastAPI backend for the actual decision
  // ----------------------------------------------------------

  try {
    const scenario = disrupted ? 'disruption' : 'normal';

    const response = await fetch(
      `/api/scenario/${scenario}`
    );

    if (!response.ok) {
      throw new Error(
        `Backend returned ${response.status}`
      );
    }

    const data = await response.json();

    const recommendation = data.recommendation;

    const recommendedRoute =
      recommendation.recommended_route;

    const usualRoute =
      recommendation.usual_route;

    // --------------------------------------------------------
    // DISRUPTION
    // --------------------------------------------------------

    if (disrupted) {

      card.querySelector('.status-chip').innerHTML =
        '<span class="pulse"></span> ACTION NEEDED';

      card.querySelector('.alert-icon').innerHTML =
        '<svg viewBox="0 0 24 24">' +
        '<path d="M12 3 2 21h20L12 3Z"/>' +
        '<path d="M12 9v5m0 3h.01"/>' +
        '</svg>';

      document.getElementById('recommendationTitle').textContent =
        `Switch to ${recommendedRoute.name}.`;

      const saved =
        recommendation.time_saved;

      document.getElementById('recommendationText').innerHTML =
        `${recommendedRoute.name} is currently estimated to save ` +
        `<strong>${saved} minutes</strong>. ` +
        `You should arrive before your ` +
        `<span class="deadlineText">${state.journey.deadline}</span> deadline.`;

      routeButton.style.display = 'flex';

      routeButton.querySelector('span').textContent =
        state.routeSelected
          ? 'Route selected'
          : 'Use this route';

      recommended.hidden = false;

      usual.querySelector('.warning-tag').style.display =
        'inline-block';

      // ------------------------------------------------------
      // Usual route
      // ------------------------------------------------------

      const usualMinutes =
        usualRoute.estimated_time;

      const usualArrival =
        calculateArrivalTime(
          state.journey.departure,
          usualMinutes
        );

      usual.querySelector('time').textContent =
        usualArrival;

      usual.querySelector('time').dateTime =
        usualArrival;

      usual.querySelector('.route-meta').innerHTML =
        `<span><strong>${usualMinutes} min</strong> estimated</span>` +
        `<span>${recommendation.conditions.crowding} crowding</span>`;

      // ------------------------------------------------------
      // Recommended route card
      // ------------------------------------------------------

      const recommendedTime =
        recommendedRoute.estimated_time;

      const recommendedArrival =
        calculateArrivalTime(
          state.journey.departure,
          recommendedTime
        );

      const recommendedTimeElement =
        recommended.querySelector('time');

      if (recommendedTimeElement) {
        recommendedTimeElement.textContent =
          recommendedArrival;

        recommendedTimeElement.dateTime =
          recommendedArrival;
      }

      const recommendedMeta =
        recommended.querySelector('.route-meta');

      if (recommendedMeta) {
        recommendedMeta.innerHTML =
          `<span><strong>${recommendedTime} min</strong> estimated</span>` +
          `<span>${recommendedRoute.transfers} transfer` +
          `${recommendedRoute.transfers === 1 ? '' : 's'}</span>`;
      }

      legendRecommended.style.display =
        'flex';

      // ------------------------------------------------------
      // WHY?
      // ------------------------------------------------------

      const whyDetails =
        document.getElementById('whyDetails');

      if (whyDetails) {

        whyDetails.innerHTML = `
          <div>
            <strong>Why we changed your route</strong>
          </div>

          <ul>
            ${recommendation.reasons
              .map(reason => `<li>${reason}</li>`)
              .join('')}
          </ul>

          <p>
            Estimated saving:
            <strong>${recommendation.time_saved} minutes</strong>
          </p>

          <p>
            Confidence:
            <strong>${recommendation.confidence}</strong>
          </p>

          <p>
            Uncertainty:
            approximately
            <strong>±${recommendation.uncertainty_minutes} minutes</strong>
          </p>
        `;
      }

    }

    // --------------------------------------------------------
    // NORMAL SERVICE
    // --------------------------------------------------------

    else {

      card.querySelector('.status-chip').innerHTML =
        '<span class="pulse"></span> ON TRACK';

      card.querySelector('.alert-icon').innerHTML =
        '<svg viewBox="0 0 24 24">' +
        '<path d="m5 12 4 4L19 6"/>' +
        '</svg>';

      document.getElementById('recommendationTitle').textContent =
        'Your usual route is on track.';

      const arrival =
        calculateArrivalTime(
          state.journey.departure,
          usualRoute.estimated_time
        );

      document.getElementById('recommendationText').innerHTML =
        `Leave at <strong>${state.journey.departure}</strong> as planned. ` +
        `You should arrive around <strong>${arrival}</strong>.`;

      routeButton.style.display =
        'none';

      recommended.hidden =
        true;

      usual.querySelector('.warning-tag').style.display =
        'none';

      usual.querySelector('time').textContent =
        arrival;

      usual.querySelector('time').dateTime =
        arrival;

      usual.querySelector('.route-meta').innerHTML =
        `<span><strong>${usualRoute.estimated_time} min</strong> total</span>` +
        `<span>${recommendation.conditions.crowding} crowding</span>`;

      legendRecommended.style.display =
        'none';

      const whyDetails =
        document.getElementById('whyDetails');

      if (whyDetails) {

        whyDetails.innerHTML = `
          <div>
            <strong>No route change needed</strong>
          </div>

          <p>
            Your usual route is currently estimated at
            <strong>${usualRoute.estimated_time} minutes</strong>.
          </p>

          <p>
            Confidence:
            <strong>${recommendation.confidence}</strong>
          </p>
        `;
      }
    }

    // Update the map after receiving the backend decision
    drawRoutes();

  } catch (error) {

    console.error(
      'Could not connect to ayAhead backend:',
      error
    );

    // Keep the existing UI usable if the backend
    // temporarily cannot be reached.

    document.getElementById('recommendationTitle').textContent =
      'Unable to update route information.';

    document.getElementById('recommendationText').innerHTML =
      'Please check the backend connection and try again.';

  }
}


// ------------------------------------------------------------
// Convert minutes after departure into HH:MM
// ------------------------------------------------------------

function calculateArrivalTime(
  departure,
  minutes
) {

  const [
    hours,
    mins
  ] = departure
    .split(':')
    .map(Number);

  const date =
    new Date();

  date.setHours(
    hours,
    mins + minutes,
    0,
    0
  );

  return date
    .toTimeString()
    .slice(0, 5);
}

function renderSettings() {
  document.getElementById('proactiveToggle').checked = state.settings.proactive;
  document.getElementById('crowdingToggle').checked = state.settings.crowding;
  document.getElementById('weatherToggle').checked = state.settings.weather;
  const threshold = document.querySelector(`input[name="threshold"][value="${state.settings.threshold}"]`);
  if (threshold) threshold.checked = true;
}

function openJourneyDialog(blank = false) {
  const dialog = document.getElementById('journeyDialog');
  document.getElementById('dialogTitle').textContent = blank ? 'Add a saved journey' : 'Edit weekday commute';
  document.getElementById('originInput').value = blank ? '' : state.journey.origin;
  document.getElementById('destinationInput').value = blank ? '' : state.journey.destination;
  document.getElementById('departureInput').value = blank ? '07:40' : state.journey.departure;
  document.getElementById('deadlineInput').value = blank ? '08:45' : state.journey.deadline;
  dialog.showModal();
  setTimeout(() => document.getElementById('originInput').focus(), 20);
}

function openNotifications() {
  const panel = document.getElementById('notificationPanel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  document.getElementById('notificationButton').setAttribute('aria-expanded', 'true');
  document.getElementById('scrim').hidden = false;
}

function closeNotifications() {
  const panel = document.getElementById('notificationPanel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  document.getElementById('notificationButton').setAttribute('aria-expanded', 'false');
  document.getElementById('scrim').hidden = true;
}

function initializeEvents() {
  document.querySelectorAll('[data-view-target]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.viewTarget)));
  document.getElementById('scenarioToggle').addEventListener('click', () => setScenario(!state.disrupted));
  document.getElementById('whyToggle').addEventListener('click', event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    document.getElementById('whyDetails').hidden = expanded;
  });
  document.getElementById('useRouteButton').addEventListener('click', event => {
    state.routeSelected = true;
    saveState();
    event.currentTarget.querySelector('span').textContent = 'Route selected';
    showToast('Recommended route saved for this morning.');
  });
  document.querySelectorAll('.editJourneyButton').forEach(button => button.addEventListener('click', () => openJourneyDialog(false)));
  document.getElementById('addJourneyButton').addEventListener('click', () => openJourneyDialog(true));
  document.getElementById('journeyForm').addEventListener('submit', event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    state.journey = {
      origin: document.getElementById('originInput').value.trim(),
      destination: document.getElementById('destinationInput').value.trim(),
      departure: document.getElementById('departureInput').value,
      deadline: document.getElementById('deadlineInput').value
    };
    saveState();
    renderJourney();
    setScenario(state.disrupted, false);
    document.getElementById('journeyDialog').close();
    showToast('Journey saved on this device.');
  });
  document.getElementById('notificationButton').addEventListener('click', openNotifications);
  document.getElementById('closeNotifications').addEventListener('click', closeNotifications);
  document.getElementById('scrim').addEventListener('click', closeNotifications);
  document.getElementById('markReadButton').addEventListener('click', () => {
    state.notificationsRead = true;
    saveState();
    document.getElementById('notificationDot').hidden = true;
    document.querySelectorAll('.notification-item').forEach(item => item.classList.remove('unread'));
    showToast('Notifications marked as read.');
  });
  ['proactiveToggle', 'crowdingToggle', 'weatherToggle'].forEach(id => {
    document.getElementById(id).addEventListener('change', event => {
      const key = id.replace('Toggle', '');
      state.settings[key] = event.target.checked;
      saveState();
      showToast('Preference saved.');
    });
  });
  document.querySelectorAll('input[name="threshold"]').forEach(input => input.addEventListener('change', event => {
    state.settings.threshold = event.target.value;
    saveState();
    showToast(`Alerts will start at ${event.target.value} minutes.`);
  }));
  document.getElementById('resetButton').addEventListener('click', () => {
    state = structuredClone(defaultState);
    saveState();
    renderJourney();
    renderSettings();
    setScenario(true, false);
    switchView('settings');
    document.getElementById('notificationDot').hidden = false;
    document.querySelector('.notification-item').classList.add('unread');
    showToast('Demo preferences reset.');
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeNotifications(); });
}

window.addEventListener('DOMContentLoaded', () => {
  renderJourney();
  renderSettings();
  setScenario(state.disrupted, false);
  if (state.notificationsRead) document.getElementById('notificationDot').hidden = true;
  initializeEvents();
  initMap();
  switchView(state.activeView);
});
