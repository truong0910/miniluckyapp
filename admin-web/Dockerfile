FROM node:22-alpine AS builder

WORKDIR /app

# Accept Vite API Base URL as build argument
ARG VITE_API_BASE_URL=https://luckyapi.wiai.vn/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci || npm install

COPY . .
RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
