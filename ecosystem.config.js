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
      HOST: "0.0.0.0"
    }
  }]
}
