#!/bin/bash
# Simple Manual Deployment Script for Noyes Demos

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== Noyes Demos Manual Deployment Script =====${NC}"

# 1. Get commit message from user
if [ -z "$1" ]; then
  echo -e "${YELLOW}Enter commit message:${NC}"
  read commit_message
else
  commit_message="$1"
fi

# 2. Add all changes
echo -e "\n${GREEN}Adding all changes to git...${NC}"
git add .

# 3. Commit changes
echo -e "\n${GREEN}Committing changes with message: '${commit_message}'${NC}"
git commit -m "$commit_message"

# 4. Push to GitHub
echo -e "\n${GREEN}Pushing to GitHub...${NC}"
git push

# 5. SSH to server and deploy directly
echo -e "\n${GREEN}Connecting to server for manual deployment...${NC}"
ssh noyesdemos << 'ENDSSH'
  echo "Connected to server. Starting manual deployment..."
  
  # Navigate to the application directory
  cd /home/ec2-user/app
  
  # Stop the current application
  echo "Stopping the current application..."
  pm2 stop noyesdemodash || true
  
  # Pull the latest changes
  echo "Pulling latest changes from GitHub..."
  git fetch origin
  git reset --hard origin/main
  
  # Install dependencies
  echo "Installing dependencies..."
  npm ci
  
  # Build the application
  echo "Building the application..."
  npm run build
  
  # Ensure directories exist
  echo "Setting up directories..."
  mkdir -p .next/standalone/public
  mkdir -p .next/standalone/.next/static
  
  # Copy necessary files
  echo "Copying static files..."
  cp -r public/* .next/standalone/public/ || true
  cp -r .next/static/* .next/standalone/.next/static/ || true
  cp .env .next/standalone/ || true
  
  # Update the PM2 configuration
  echo "Updating PM2 configuration..."
  cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "noyesdemodash",
    cwd: "/home/ec2-user/app/.next/standalone",
    script: "./server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      HOST: "0.0.0.0"
    }
  }]
}
EOL
  
  # Start the application with PM2
  echo "Starting the application..."
  pm2 start ecosystem.config.js
  pm2 save
  
  # Verify the application is running
  echo "Verifying application status..."
  pm2 status
  
  echo "Manual deployment completed!"
ENDSSH

echo -e "\n${BLUE}===== Deployment Complete =====${NC}"
echo -e "${GREEN}Your changes should now be live on https://demos.noyesai.com${NC}" 