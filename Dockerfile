FROM nginx:alpine

# Copy static website files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY lonelyguyanimatedv1.gif /usr/share/nginx/html/
COPY SE1.jpg /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
