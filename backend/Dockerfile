FROM node:22-bookworm
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV NODE_ENV=production DB_FILE=/data/jobpilot.db
VOLUME /data
EXPOSE 4000
CMD ["node", "src/server.js"]
