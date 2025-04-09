# Deployment Guide for AI Demo Platform

This guide provides instructions for deploying the AI Demo Platform on a Linux server.

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Git
- Linux server with at least 1GB RAM
- Proper firewall configuration to allow HTTP/HTTPS traffic

## Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/BennyMorton28/noyesdemodash.git
   cd noyesdemodash
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Create or edit the `.env` file and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Building for Production

1. Build the application:
   ```bash
   npm run build
   ```

2. Test the production build locally:
   ```bash
   npm run start
   ```

## Production Deployment

1. Ensure required directories exist with proper permissions:
   ```bash
   mkdir -p public/demos public/markdown
   chmod 755 public/demos public/markdown
   ```

2. Install PM2 process manager:
   ```bash
   npm install -g pm2
   ```

3. Create a PM2 ecosystem file:
   ```bash
   cat > ecosystem.config.js << 'EOL'
   module.exports = {
     apps: [{
       name: "noyesdemodash",
       script: "node_modules/next/dist/bin/next",
       args: "start",
       instances: 1,
       autorestart: true,
       watch: false,
       max_memory_restart: "1G",
       env: {
         NODE_ENV: "production",
         PORT: 3000
       }
     }]
   }
   EOL
   ```

4. Start the application with PM2:
   ```bash
   pm2 start ecosystem.config.js
   ```

5. Configure PM2 to start on system boot:
   ```bash
   pm2 save
   pm2 startup
   ```

## Nginx Configuration

For production deployment, it's recommended to use Nginx as a reverse proxy:

1. Install Nginx:
   ```bash
   # For Amazon Linux
   sudo yum install -y nginx
   
   # For Ubuntu/Debian
   sudo apt install -y nginx
   ```

2. Create Nginx configuration:
   ```bash
   sudo bash -c 'cat > /etc/nginx/conf.d/noyesdemodash.conf << EOL
   server {
       listen 80;
       server_name _;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host \$host;
           proxy_set_header X-Real-IP \$remote_addr;
           proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto \$scheme;
           proxy_set_header X-Forwarded-Host \$host;
           proxy_set_header X-Forwarded-Port \$server_port;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOL'
   ```

3. Start and enable Nginx:
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

## Setting Up HTTPS with Let's Encrypt

1. Install Certbot:
   ```bash
   # For Amazon Linux
   sudo yum install -y certbot python3-certbot-nginx
   
   # For Ubuntu/Debian
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. Obtain SSL certificate (replace yourdomain.com with your actual domain):
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. Set up auto-renewal:
   ```bash
   sudo systemctl status certbot.timer
   ```

## Firewall Configuration

On EC2 or other cloud instances, configure security groups to allow HTTP (80) and HTTPS (443) traffic. For systems with local firewalls:

```bash
# For systems with firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# For systems with ufw (Ubuntu)
sudo ufw allow http
sudo ufw allow https
sudo ufw reload
```

## Monitoring and Maintenance

1. Set up application monitoring:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

2. Set up regular backups of the data directories:
   ```bash
   sudo yum install -y rsync # or apt install for Ubuntu
   # Add a cron job for regular backups
   echo "0 2 * * * rsync -a /path/to/app/public/demos /path/to/backup/" | sudo tee -a /etc/crontab
   ```

## Troubleshooting

- **File permissions issues**: Ensure the user running the Node.js process has write access to the `public/demos` and `public/markdown` directories.
- **API key errors**: Verify that the OPENAI_API_KEY environment variable is correctly set.
- **Port conflicts**: If port 3000 is already in use, modify the PORT environment variable in the ecosystem.config.js file.
- **Nginx errors**: Check Nginx logs with `sudo tail -f /var/log/nginx/error.log`
- **Application errors**: Check PM2 logs with `pm2 logs noyesdemodash`

## Security Considerations

1. Never commit `.env` files with real API keys to version control
2. Consider setting up API key rotation
3. Implement rate limiting if your application receives high traffic
4. Regularly update dependencies with `npm audit fix`

## Performance Optimization

1. Enable Gzip compression in your web server
2. Set up a CDN for static assets
3. Consider enabling browser caching for static files 