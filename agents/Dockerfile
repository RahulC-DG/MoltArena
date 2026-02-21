FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY debate-agent.js .
CMD ["node", "debate-agent.js"]
