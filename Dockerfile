FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY lonelyguyanimatedv1.gif /usr/share/nginx/html/
COPY SE1.jpg /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
