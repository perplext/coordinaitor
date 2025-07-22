FROM node:20-alpine

RUN apk add --no-cache python3 make g++ git curl bash

WORKDIR /agent

RUN npm install -g @anthropic-ai/claude-code

COPY config/claude-agent.json /agent/config.json

ENV ANTHROPIC_API_KEY=""
ENV AGENT_NAME="claude-agent"
ENV AGENT_PORT=5001

EXPOSE 5001

CMD ["claude-code", "--config", "/agent/config.json", "--server", "--port", "$AGENT_PORT"]