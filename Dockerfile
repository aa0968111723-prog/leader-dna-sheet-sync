FROM node:20-bookworm

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
RUN npx playwright@1.63.0 install --with-deps chromium

COPY src ./src

CMD ["npm", "run", "sync"]

