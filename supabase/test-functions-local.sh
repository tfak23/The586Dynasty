#!/bin/bash

# Local Testing Script for Supabase Edge Functions
# This script helps test Edge Functions locally before deployment

set -e

echo "🚀 Supabase Edge Functions Local Testing"
echo "========================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed"
    echo "Install with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI is installed"
echo ""

# Check if Supabase is running locally
echo "📦 Starting Supabase local instance..."
supabase start || {
    echo "Note: Supabase may already be running"
}

echo ""
echo "🔧 Serving Edge Functions..."
echo "Note: Functions will be available at http://localhost:54321/functions/v1/"
echo ""

# Get the anon key from Supabase
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')

if [ -z "$ANON_KEY" ]; then
    echo "⚠️  Warning: Could not automatically detect anon key"
    echo "You can find it by running: supabase status"
    echo ""
fi

echo "To test the google-docs-read function, run:"
echo ""
echo "curl -i --location --request POST \\"
echo "  'http://localhost:54321/functions/v1/google-docs-read' \\"
echo "  --header 'Authorization: Bearer ${ANON_KEY}' \\"
echo "  --header 'Content-Type: application/json' \\"
echo "  --data '{\"documentId\":\"YOUR_DOC_ID\",\"operation\":\"read\"}'"
echo ""

# Start serving functions
supabase functions serve google-docs-read
