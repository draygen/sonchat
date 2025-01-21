# Use an Nginx image to serve static files
FROM nginx:alpine

# Copy your static files to the default Nginx directory
COPY . /usr/share/nginx/html

# Expose port 80 for the Nginx server
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
