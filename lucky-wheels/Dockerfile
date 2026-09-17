FROM node:22-alpine AS builder

WORKDIR /app

# Arguments for Vite build
ARG VITE_API_BASE_URL=https://luckyapi.wiai.vn/api/v1
ARG VITE_PARTICIPANT_AUTH_MODE=preview
ARG VITE_ZALO_OA_ID=1872524082920628490

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_PARTICIPANT_AUTH_MODE=$VITE_PARTICIPANT_AUTH_MODE
ENV VITE_ZALO_OA_ID=$VITE_ZALO_OA_ID

COPY package*.json ./
RUN (npm ci || npm install) && npm cache clean --force

COPY . .
RUN rm -f .env .env.local
RUN npm run build && ( [ -d dist ] && cp -r dist /app/output || cp -r www /app/output )

FROM nginx:alpine AS runner

COPY --from=builder /app/output /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
