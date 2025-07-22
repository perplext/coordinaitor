# Multi-Agent Orchestrator

Ultimate multi-agent dedicated environment system for orchestrating AI coding agents including Claude Code, Google Gemini, OpenAI Codex, AWS Kiro, Amazon Q Developer, and more.

## Features

- **Multi-Agent Integration**: Supports 10+ AI coding agents
- **Cloud-Native Architecture**: Kubernetes-based deployment
- **Task Orchestration**: Intelligent task decomposition and agent assignment
- **Inter-Agent Communication**: MCP and A2A protocol support
- **Project Lifecycle Management**: From PRD to production deployment

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Orchestration Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Task Decomposer │ Agent Registry │ Coordination Engine     │
├─────────────────────────────────────────────────────────────┤
│                     Communication Layer                      │
│         MCP Server │ REST API │ WebSocket │ Queue           │
├─────────────────────────────────────────────────────────────┤
│                       Agent Layer                            │
│  Claude │ Gemini │ Codex │ Kiro │ Q Dev │ Bedrock │ ...    │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Run the orchestrator:
```bash
npm run dev
```

## Supported Agents

### CLI-Based Agents
- Claude Code (Anthropic)
- Google Gemini CLI
- OpenAI Codex CLI
- Amazon Q Developer CLI

### API-Based Agents
- AWS Kiro
- Amazon Bedrock
- Devin AI
- Mistral Agents
- Azure AI Foundry

## Configuration

See `config/agents.yaml` for agent configuration and capability definitions.

## Development

```bash
npm run build    # Build TypeScript
npm run test     # Run tests
npm run lint     # Lint code
```

## Deployment

See `k8s/` directory for Kubernetes deployment manifests.

## License

MIT