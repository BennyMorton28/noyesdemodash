#!/bin/bash

# This script will fix the server by creating a basic server.js file
# and restarting the application

# Create the server.js file
cat > server.js << 'EOF'
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, dir: __dirname, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
EOF

# Create the ecosystem config file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: "noyesdemodash",
    cwd: "/home/ec2-user/app",
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