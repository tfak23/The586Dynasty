# The 586 - Dynasty Fantasy Football Companion App

## Deployment Guide

This guide walks you through deploying The 586 backend API to Google Cloud Platform.

### Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Node.js 20+** for local development

### GCP Setup

#### 1. Create a new GCP Project (or use existing)

```bash
# Set your project ID
export PROJECT_ID="the586-app"

# Create project (if new)
gcloud projects create $PROJECT_ID

# Set as current project
gcloud config set project $PROJECT_ID

# Enable billing (follow prompts)
gcloud billing accounts list
gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
```

#### 2. Enable Required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com
```

#### 3. Create Cloud SQL PostgreSQL Instance

```bash
# Create instance (this takes ~5 minutes)
gcloud sql instances create the586-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_ROOT_PASSWORD

# Create database
gcloud sql databases create the586 --instance=the586-db

# Create app user
gcloud sql users create the586_user \
  --instance=the586-db \
  --password=YOUR_USER_PASSWORD
```

#### 4. Set Up Database Schema

Connect to Cloud SQL and run the schema:

```bash
# Connect via Cloud SQL Proxy (recommended for local dev)
# Download: https://cloud.google.com/sql/docs/postgres/connect-instance-cloud-shell

# Or use gcloud
gcloud sql connect the586-db --user=postgres --database=the586

# Then paste contents of backend/src/db/schema.sql
```

#### 5. Configure Secrets

```bash
# Create DATABASE_URL secret
echo -n "postgres://the586_user:YOUR_USER_PASSWORD@/the586?host=/cloudsql/${PROJECT_ID}:us-central1:the586-db" | \
  gcloud secrets create DATABASE_URL --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 6. Grant Cloud Build Permissions

```bash
# Get Cloud Build service account
export CLOUDBUILD_SA=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@cloudbuild.gserviceaccount.com

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/cloudsql.client"
```

### Deploy Backend

```bash
# From project root
cd backend

# Deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Get the service URL
gcloud run services describe the586-api --region=us-central1 --format='value(status.url)'
```

### Initialize Your League

Once deployed, initialize your Sleeper league:

```bash
# Replace with your actual API URL
export API_URL="https://the586-api-xxxxx.run.app"

# Initialize league (this creates teams and syncs from Sleeper)
curl -X POST "$API_URL/api/sync/initialize" \
  -H "Content-Type: application/json" \
  -d '{"sleeper_league_id": "1315789488873553920"}'
```

### Import Existing Contracts from CSV

1. Export your Excel sheet as CSV
2. Use the import preview endpoint:

```bash
curl -X POST "$API_URL/api/import/preview/YOUR_LEAGUE_ID" \
  -H "Content-Type: application/json" \
  -d '{"csvData": "...your CSV content..."}'
```

3. If preview looks good, run actual import:

```bash
curl -X POST "$API_URL/api/import/csv/YOUR_LEAGUE_ID" \
  -H "Content-Type: application/json" \
  -d '{"csvData": "...your CSV content...", "dryRun": false}'
```

### Mobile App Configuration

Update the mobile app to point to your deployed API:

1. Create `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://the586-api-xxxxx.run.app
```

2. For development builds:
```bash
cd mobile
npm install
npx expo start
```

3. For production builds (App Store / Play Store):
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Monitoring & Logs

```bash
# View Cloud Run logs
gcloud run services logs read the586-api --region=us-central1

# Stream logs
gcloud run services logs tail the586-api --region=us-central1
```

### Cost Estimates

With the configurations above (minimal tier):
- **Cloud SQL**: ~$10-15/month (db-f1-micro)
- **Cloud Run**: Pay-per-use, likely <$5/month for a fantasy league
- **Container Registry**: ~$0.10/GB storage

**Total**: ~$15-25/month

To reduce costs further:
- Set Cloud Run min-instances to 0 (cold starts OK for a league app)
- Use Cloud SQL's "Pause instance" feature during off-season
