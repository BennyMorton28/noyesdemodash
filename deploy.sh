#!/bin/bash
# Noyes Demos Deployment Script

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== Noyes Demos Deployment Script =====${NC}"

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

# 5. SSH to server and deploy
echo -e "\n${GREEN}Deploying to server...${NC}"
ssh noyesdemos << 'ENDSSH'
  echo "Connected to server. Starting deployment..."
  
  # Navigate to the application directory (correct path)
  cd /home/ec2-user/app
  
  # Pull the latest changes
  echo "Pulling latest changes from GitHub..."
  git fetch origin
  git reset --hard origin/main
  
  # Install dependencies if needed
  echo "Installing dependencies..."
  npm ci
  
  # Build the application
  echo "Building the application..."
  npm run build
  
  # Update the PM2 configuration to include environment variables
  echo "Updating PM2 configuration..."
  OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
  cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "noyesdemodash",
    cwd: "/home/ec2-user/app",
    script: "./.next/standalone/server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
    }
  }]
}
EOL
  
  # Restart the application with PM2
  echo "Restarting the application..."
  pm2 reload ecosystem.config.js
  
  echo "Deployment completed successfully!"
ENDSSH

echo -e "\n${BLUE}===== Deployment Complete =====${NC}"
echo -e "${GREEN}Your changes are now live on https://demos.noyesai.com${NC}" 