FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN echo 'window.API_BASE="http://localhost:4000";' > /usr/share/nginx/html/config.js
EXPOSE 80
