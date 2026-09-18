# WayAhead — Smart Commuter Companion

A mobile-first frontend prototype for a Singapore smart commuter companion.
The demo follows Rachel's weekday commute from Tampines to Raffles Place and
shows how the app responds when an EWL disruption affects her trip.

## Features

- Mobile-first responsive layout
- OpenStreetMap map using Leaflet
- Usual and recommended route comparison
- Demo switch for normal service and an EWL disruption
- Arrival times, crowding and transfer information
- Working Today, Saved Journeys and Settings screens
- Editable commute details and notification panel
- Configurable 5, 10 or 15-minute alert threshold
- Preferences saved locally in the browser
- Interactive route-selection and information controls
- Clear labels showing that current disruption information is demo data

## Technology used

- HTML
- CSS
- JavaScript
- Leaflet
- OpenStreetMap

No installation or API key is required for this frontend prototype.

## Open the project locally

You can double-click `index.html` to open it in a browser. If the map does not
load when opened as a file, run a simple local web server instead:

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

If you use VS Code, the Live Server extension is another easy option.

## Upload it to GitHub

1. Create a new empty GitHub repository.
2. Extract this ZIP file.
3. Open the extracted `wayahead-frontend` folder in GitHub Desktop.
4. Choose **Add an Existing Repository from your Hard Drive**.
5. If asked, select **Create a Repository** for this folder.
6. Commit the files and choose **Publish repository**.

The important files should appear at the repository root:

```text
wayahead-frontend/
├── index.html
├── styles.css
├── app.js
├── README.md
├── .env.example
└── .gitignore
```

## Publish with GitHub Pages

After pushing the code:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder.
5. Click **Save**.

GitHub will display the published website URL after deployment finishes.

## Current data

Route coordinates, timings, weather, disruption and crowding values are demo
data. Replace them with responses from your backend when the LTA DataMall,
weather and routing APIs are connected.

Do not place real API keys in `app.js` or commit them to GitHub. Keep secrets in
the backend or your deployment platform's secret manager.
