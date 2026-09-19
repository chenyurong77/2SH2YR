# Rachel Smart Commute — Frontend + Backend

This version moves the commute decision-making into a Flask backend.

## Backend API

### `GET /api/commute?scenario=normal`
Returns Rachel's normal commute and recommends her usual EWL route.

### `GET /api/commute?scenario=disruption`
Returns the demo Tanah Merah → Aljunied disruption, compares three routes,
checks the 08:45 deadline, and recommends the best safe route.

### `GET /api/commute?scenario=live`
Uses LTA DataMall if `LTA_ACCOUNT_KEY` is configured. If no key is available,
the app remains usable and reports that it is using fallback/demo data.

### `GET /api/backend-status`
Shows whether the LTA / OneMap environment variables are configured.

### `GET /health`
Simple health check for Cloud Run.

## What the backend decides

1. Whether Rachel's normal commute is disrupted.
2. Whether her normal ETA exceeds the 08:45 deadline.
3. Which route should be recommended.
4. Whether Rachel should be interrupted.
5. The one-line action shown in the UI.

Route ranking prioritises:
1. arriving before 08:45,
2. earlier ETA,
3. lower crowding,
4. fewer transfers.

## Live LTA support

The backend has optional integrations for:

- LTA `TrainServiceAlerts`
- LTA `PCDRealTime` for EWL station crowding

Do not put your LTA key inside the source code.

Set it in Cloud Run as an environment variable:

```bash
gcloud run services update rachel-commute \
  --region asia-southeast1 \
  --set-env-vars LTA_ACCOUNT_KEY="YOUR_KEY"
```

For OneMap, set:

```bash
gcloud run services update rachel-commute \
  --region asia-southeast1 \
  --set-env-vars ONEMAP_TOKEN="YOUR_TOKEN"
```

The OneMap token is reserved for the next step: replacing the demo alternative
routes with routes returned by the OneMap routing API.

## Run locally / Cloud Shell

```bash
pip3 install -r requirements.txt
python3 main.py
```

Then preview port 8080.

## Deploy to Cloud Run

From this folder:

```bash
gcloud run deploy rachel-commute \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated
```

## Secrets

Never commit API keys, AccountKeys, passwords, or `.env`.
Only `.env.example` with variable names is included.
