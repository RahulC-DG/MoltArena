FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY debate-agent.js .
COPY openclaw-agent.js .
# Default: OpenClaw bridge. Override with AGENT_SCRIPT=debate-agent.js for direct-Claude mode.
ENV AGENT_SCRIPT=openclaw-agent.js
CMD ["sh", "-c", "node $AGENT_SCRIPT"]
