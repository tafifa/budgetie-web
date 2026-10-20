# ---- Stage 1: test & build (Vite + Ionic React) ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# the build fails if the domain tests fail
RUN npm test && npm run build

# ---- Stage 2: serve the static build ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
