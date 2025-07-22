FROM node:20-alpine

RUN apk add --no-cache python3 make g++ git curl bash

WORKDIR /agent

RUN npm install -g @google/gemini-cli

COPY config/gemini-agent.json /agent/config.json

ENV GOOGLE_GEMINI_API_KEY=""
ENV AGENT_NAME="gemini-agent"
ENV AGENT_PORT=5002

EXPOSE 5002

CMD ["gemini-cli", "serve", "--config", "/agent/config.json", "--port", "$AGENT_PORT"]