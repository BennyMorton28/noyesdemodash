#!/bin/bash

# This script will fix the server by stopping any existing standalone instances,
# setting up the proper Next.js standalone deployment, and restarting the application

# First, stop and remove any running PM2 instances
echo "Stopping and removing any existing PM2 instances..."
ssh noyesdemos "pm2 stop all && pm2 delete all" || echo "No PM2 instances to stop"

# Check if the latest deployment directory exists
echo "Finding the latest deployment directory..."
LATEST_DEPLOY=$(ssh noyesdemos "find /home/ec2-user/deployments -maxdepth 1 -mindepth 1 -type d | sort -r | head -1")
echo "Latest deployment directory: $LATEST_DEPLOY"

# Ensure the Next.js standalone directory has the proper structure
echo "Setting up the Next.js standalone structure..."
ssh noyesdemos "
# Create required directories
mkdir -p /home/ec2-user/app/.next/standalone
mkdir -p /home/ec2-user/app/.next/standalone/.next/static
mkdir -p /home/ec2-user/app/.next/standalone/public/demos

# Copy static files
cp -r ${LATEST_DEPLOY}/.next/static/* /home/ec2-user/app/.next/standalone/.next/static/
cp -r ${LATEST_DEPLOY}/public/* /home/ec2-user/app/.next/standalone/public/

# Copy .env file
cp ${LATEST_DEPLOY}/.env /home/ec2-user/app/.next/standalone/.env 2>/dev/null || echo 'No .env file found'

# Create a proper server.js file for standalone mode
cat > /home/ec2-user/app/.next/standalone/server.js << 'EOF'
// This is a modified server.js for Next.js standalone mode
const path = require('path');
process.env.NODE_ENV = 'production';
process.chdir(__dirname);

// Import the Next.js server from the compiled standalone build
const NextServer = require('next/dist/server/next-server').default;
const nextServer = new NextServer({
  dir: path.resolve(__dirname),
  dev: false,
  customServer: false,
  conf: {
    env: {},
    experimental: {},
    basePath: '',
    headers: [],
    rewrites: [],
    redirects: []
  }
});

const handler = nextServer.getRequestHandler();
const { createServer } = require('http');

const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('Error handling request:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}).listen(port, hostname, (err) => {
  if (err) throw err;
  console.log(`> Ready on http://${hostname}:${port}`);
});
EOF
"

# Create the ecosystem config file in the home directory
echo "Creating a new ecosystem.config.js file..."
ssh noyesdemos "cat > /home/ec2-user/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: "noyesdemodash",
    cwd: "/home/ec2-user/app/.next/standalone",
    script: "server.js",
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
EOF

# Make sure necessary modules are available
echo "Ensuring required node modules are available..."
ssh noyesdemos "cd /home/ec2-user/app/.next/standalone && npm init -y && npm install next@latest --no-save"

# Set correct permissions
echo "Setting correct permissions..."
ssh noyesdemos "chmod -R 755 /home/ec2-user/app/.next"

# Start the application with the new configuration
echo "Starting the application with new configuration..."
ssh noyesdemos "cd /home/ec2-user && pm2 start ecosystem.config.js && pm2 save"

# Wait a moment for the app to start
echo "Waiting for the app to start..."
sleep 5

# Verify the application is running
echo "Verifying the application is running..."
ssh noyesdemos "pm2 status && curl -I http://localhost:3000"

echo "Server fix completed successfully!" 