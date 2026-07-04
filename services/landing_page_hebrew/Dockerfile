FROM nginx:alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de AS production

COPY index.html /usr/share/nginx/html/index.html
COPY logo.png /usr/share/nginx/html/logo.png
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
