#!/bin/bash
# Script to verify demo file paths in production
# Usage: ./verify-demo-paths.sh [servername]

# Set server name
SERVER=${1:-noyesdemos}
echo "Using server: $SERVER"

echo "==== Checking file paths on server ===="
ssh $SERVER << 'ENDSSH'
  # Check process.cwd() in standalone mode
  echo -e "\n==== Checking process.cwd() in standalone mode ===="
  cd /home/ec2-user/app/.next/standalone
  node -e 'console.log(`process.cwd(): ${process.cwd()}`)'
  
  # Check if public directory exists in standalone mode
  echo -e "\n==== Checking public directory in standalone mode ===="
  if [ -d "/home/ec2-user/app/.next/standalone/public" ]; then
    echo "✓ /home/ec2-user/app/.next/standalone/public exists"
    ls -la /home/ec2-user/app/.next/standalone/public
  else
    echo "✗ /home/ec2-user/app/.next/standalone/public does not exist"
  fi
  
  # Check if demos directory exists in standalone mode
  echo -e "\n==== Checking demos directory in standalone mode ===="
  if [ -d "/home/ec2-user/app/.next/standalone/public/demos" ]; then
    echo "✓ /home/ec2-user/app/.next/standalone/public/demos exists"
    ls -la /home/ec2-user/app/.next/standalone/public/demos
  else
    echo "✗ /home/ec2-user/app/.next/standalone/public/demos does not exist"
  fi
  
  # Check if markdown directory exists in standalone mode
  echo -e "\n==== Checking markdown directory in standalone mode ===="
  if [ -d "/home/ec2-user/app/.next/standalone/public/markdown" ]; then
    echo "✓ /home/ec2-user/app/.next/standalone/public/markdown exists"
    ls -la /home/ec2-user/app/.next/standalone/public/markdown
  else
    echo "✗ /home/ec2-user/app/.next/standalone/public/markdown does not exist"
  fi
  
  # Check permissions on directories
  echo -e "\n==== Checking directory permissions ===="
  if [ -d "/home/ec2-user/app/.next/standalone/public/demos" ]; then
    echo "Demos directory permissions:"
    ls -la /home/ec2-user/app/.next/standalone/public/demos | head -1
  fi
  
  if [ -d "/home/ec2-user/app/.next/standalone/public/markdown" ]; then
    echo "Markdown directory permissions:"
    ls -la /home/ec2-user/app/.next/standalone/public/markdown | head -1
  fi
  
  # Check API file
  echo -e "\n==== Checking API routes ===="
  if [ -f "/home/ec2-user/app/.next/standalone/.next/server/app/api/demos/route.js" ]; then
    echo "✓ Route file exists at /home/ec2-user/app/.next/standalone/.next/server/app/api/demos/route.js"
  else
    echo "✗ Route file not found"
  fi
  
  # Check debug endpoint
  echo -e "\n==== Testing debug endpoint ===="
  curl -s http://localhost:3000/api/debug | jq . || echo "Failed to access debug endpoint"
  
  echo -e "\n==== Verification Complete ===="
ENDSSH

echo "==== Script Completed ====" 