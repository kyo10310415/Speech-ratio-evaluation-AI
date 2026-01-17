#!/bin/bash

# Quick Fix Script for Monthly Summary Issue
# Run on Render Shell: bash quick-fix-monthly.sh

echo "🔧 Quick Fix for Monthly Summary Issue"
echo "======================================"
echo ""

# Step 1: Check current directory
echo "📍 Step 1: Checking current directory..."
cd /opt/render/project/src || { echo "❌ Failed to cd to project directory"; exit 1; }
echo "✅ Current directory: $(pwd)"
echo ""

# Step 2: Remove lock file
echo "🔓 Step 2: Removing lock file..."
if [ -f temp/monthly-job.lock ]; then
  rm -f temp/monthly-job.lock
  echo "✅ Lock file removed"
else
  echo "ℹ️  No lock file found (this is OK)"
fi
echo ""

# Step 3: Run debug script
echo "🔍 Step 3: Running debug script..."
node debug-monthly-summary.js
echo ""

# Step 4: Ask user if they want to run monthly job
echo "======================================"
echo "📊 Debug complete. Next steps:"
echo ""
echo "Option 1: Manual cleanup (RECOMMENDED)"
echo "  1. Open Google Sheets: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID"
echo "  2. Go to 'monthly_tutors' sheet"
echo "  3. Delete all data rows (keep header)"
echo "  4. Then run: node src/jobs/monthly.js 2026-01-15"
echo ""
echo "Option 2: Auto cleanup (delete and recreate)"
echo "  - Delete 'monthly_tutors' sheet in Google Sheets"
echo "  - Then run: node src/jobs/monthly.js 2026-01-15"
echo ""
echo "======================================"
echo ""
read -p "Do you want to run monthly job now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🚀 Starting monthly job..."
  echo "⏱️  This will take 2-3 hours (46 lessons)"
  echo "📝 Logs will be saved to: /tmp/monthly-job.log"
  echo ""
  
  nohup node src/jobs/monthly.js 2026-01-15 > /tmp/monthly-job.log 2>&1 &
  JOB_PID=$!
  
  echo "✅ Monthly job started (PID: $JOB_PID)"
  echo ""
  echo "Monitor progress:"
  echo "  tail -f /tmp/monthly-job.log"
  echo ""
  echo "Check completion:"
  echo "  grep 'COMPLETED' /tmp/monthly-job.log"
  echo ""
  echo "Check process:"
  echo "  ps aux | grep $JOB_PID"
  echo ""
else
  echo "ℹ️  Monthly job not started."
  echo "Run manually when ready:"
  echo "  cd /opt/render/project/src"
  echo "  node src/jobs/monthly.js 2026-01-15"
  echo ""
fi

echo "======================================"
echo "✅ Quick fix script complete"
echo "======================================"
