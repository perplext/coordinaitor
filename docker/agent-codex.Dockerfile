FROM node:20-alpine

RUN apk add --no-cache python3 make g++ git curl bash

WORKDIR /agent

RUN npm install -g @openai/codex

COPY config/codex-agent.json /agent/config.json

ENV OPENAI_API_KEY=""
ENV AGENT_NAME="codex-agent"
ENV AGENT_PORT=5003

EXPOSE 5003

CMD ["codex", "server", "--config", "/agent/config.json", "--port", "$AGENT_PORT"]