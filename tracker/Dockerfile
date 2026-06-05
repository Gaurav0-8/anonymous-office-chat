# Nginx static server for Protiviti Tracker
FROM nginx:alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy tracker files
COPY . /usr/share/nginx/html/

# Nginx config — serve index.html for all routes
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    # Security headers\n\
    add_header X-Frame-Options "SAMEORIGIN";\n\
    add_header X-Content-Type-Options "nosniff";\n\
    add_header Referrer-Policy "strict-origin-when-cross-origin";\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript;\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
