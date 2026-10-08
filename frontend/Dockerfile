# NoteTube AI -- frontend image
#
# Two stages: build the static React app with Node, then serve the built
# files with a tiny nginx image. The final image never contains Node,
# node_modules, or source -- just the compiled dist/ output, so it stays
# small and has a much smaller attack surface than shipping a Node server.

# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Bakes the backend URL into the built JS (see vite: import.meta.env).
# Passed in at build time via docker-compose.yml's `build.args`, or
# `docker build --build-arg VITE_API_BASE_URL=https://your-backend-url/api`.
ARG VITE_API_BASE_URL=http://localhost:8000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# A single-page app needs every unmatched path (e.g. a refresh on a deep
# link) to fall back to index.html, since there's no server-side router.
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
