#!/bin/bash

# This script simplifies the Nginx configuration to use a single location for demo files

# Create a temporary file for our simplified location block
cat > /tmp/new_location_blocks.txt << "EOF"
    # DIRECT ACCESS TO DEMOS (SIMPLIFIED VERSION)
    # Only uses the standard public directory location
    location /demos/ {
        # Serve demos from the standard deployed demo directory
        root /home/ec2-user/app/public;
        
        try_files $uri $uri/ =404;
        
        access_log off;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
    }
EOF

# Backup the current configuration
sudo cp /etc/nginx/conf.d/demos.noyesai.com.conf /etc/nginx/conf.d/demos.noyesai.com.conf.bak.$(date +%s)

# Use awk to replace the /demos/ location block with our new block
sudo awk '
BEGIN { print_next = 1; found = 0; }
/location \/demos\/ {/ { 
    found = 1; 
    print_next = 0; 
    system("cat /tmp/new_location_blocks.txt"); 
}
/location \/public\/ {/ { 
    if (found) print_next = 1; 
}
/location \/standalone\/ {/,/}/ { 
    if (found) next; 
}
/location @standalone {/,/}/ { 
    if (found) next; 
}
{ if (print_next) print $0; }
' /etc/nginx/conf.d/demos.noyesai.com.conf > /tmp/new_nginx.conf

# Replace the old config with the new one
sudo mv /tmp/new_nginx.conf /etc/nginx/conf.d/demos.noyesai.com.conf

# Test the new configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# If the test is successful, reload Nginx
if [ $? -eq 0 ]; then
    echo "Reloading Nginx..."
    sudo systemctl reload nginx
    echo "Nginx configuration updated successfully."
else
    echo "Nginx configuration test failed. Restoring backup..."
    sudo cp "$(ls -t /etc/nginx/conf.d/demos.noyesai.com.conf.bak.* | head -1)" /etc/nginx/conf.d/demos.noyesai.com.conf
fi

# Clean up
rm -f /tmp/new_location_blocks.txt 