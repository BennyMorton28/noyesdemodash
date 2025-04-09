#!/bin/bash
mkdir -p /etc/cron.d
echo "0 0,12 * * * root python3 -c \"import random; import time; time.sleep(random.random() * 3600)\" && certbot renew -q" > /etc/cron.d/certbot-renewal
chmod 644 /etc/cron.d/certbot-renewal
