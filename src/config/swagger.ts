import swaggerJSDoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Multi-Agent Orchestrator API',
    version: '1.0.0',
    description: `
      A comprehensive API for managing AI agents, tasks, workflows, and enterprise features.
      
      ## Features
      - **Agent Management**: Register, configure, and monitor AI agents
      - **Task Orchestration**: Create, execute, and track tasks across multiple agents
      - **Project Management**: Organize tasks into projects with collaboration features
      - **SSO Authentication**: Enterprise SSO with SAML and OAuth2 support
      - **Repository Integration**: GitHub/GitLab webhooks and automation
      - **Analytics**: Performance metrics and insights
      - **Workflows**: Template-based task automation
      
      ## Authentication
      This API supports multiple authentication methods:
      - **JWT Tokens**: Bearer token authentication for API access
      - **Session Cookies**: Session-based authentication for web applications
      - **API Keys**: Long-lived API keys for integrations
      - **SSO**: SAML and OAuth2 single sign-on
      
      ## Rate Limiting
      API requests are rate-limited per user and organization.
      
      ## Error Handling
      All errors follow the standard HTTP status codes with detailed error messages in JSON format.
    `,
    contact: {
      name: 'Multi-Agent Orchestrator Team',
      email: 'support@multi-agent-orchestrator.com',
      url: 'https://github.com/multi-agent-orchestrator/api'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    },
    termsOfService: 'https://multi-agent-orchestrator.com/terms'
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Development server'
    },
    {
      url: 'https://api.multi-agent-orchestrator.com',
      description: 'Production server'
    },
    {
      url: 'https://staging-api.multi-agent-orchestrator.com',
      description: 'Staging server'
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management'
    },
    {
      name: 'SSO',
      description: 'Single Sign-On configuration and management'
    },
    {
      name: 'Agents',
      description: 'AI agent registration, configuration, and monitoring'
    },
    {
      name: 'Tasks',
      description: 'Task creation, execution, and management'
    },
    {
      name: 'Projects',
      description: 'Project management and organization'
    },
    {
      name: 'Workflows',
      description: 'Workflow templates and execution'
    },
    {
      name: 'Templates',
      description: 'Task and workflow templates'
    },
    {
      name: 'Analytics',
      description: 'Performance metrics and insights'
    },
    {
      name: 'Repository',
      description: 'Git repository integration and webhooks'
    },
    {
      name: 'Capacity',
      description: 'Agent capacity and load management'
    },
    {
      name: 'Onboarding',
      description: 'User onboarding and initial setup'
    },
    {
      name: 'Approvals',
      description: 'Task approval workflows'
    },
    {
      name: 'Security',
      description: 'Security scanning and compliance'
    },
    {
      name: 'Collaboration',
      description: 'Multi-agent collaboration features'
    },
    {
      name: 'Git',
      description: 'Git operations and repository management'
    },
    {
      name: 'Health',
      description: 'System health and monitoring'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for API authentication'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for service-to-service authentication'
      },
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sessionId',
        description: 'Session cookie for web application authentication'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Error message'
          },
          message: {
            type: 'string',
            description: 'Detailed error description'
          },
          code: {
            type: 'string',
            description: 'Error code for programmatic handling'
          },
          details: {
            type: 'object',
            description: 'Additional error details'
          }
        }
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'organizationId'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique user identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          name: {
            type: 'string',
            description: 'User display name'
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
            description: 'Organization identifier'
          },
          roles: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['super_admin', 'org_admin', 'org_member', 'developer', 'viewer']
            },
            description: 'User roles'
          },
          authMethod: {
            type: 'string',
            enum: ['local', 'saml', 'oauth2', 'oidc'],
            description: 'Authentication method used'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          lastLogin: {
            type: 'string',
            format: 'date-time',
            description: 'Last login timestamp'
          }
        }
      },
      Agent: {
        type: 'object',
        required: ['id', 'name', 'type', 'provider'],
        properties: {
          id: {
            type: 'string',
            description: 'Unique agent identifier'
          },
          name: {
            type: 'string',
            description: 'Agent display name'
          },
          type: {
            type: 'string',
            enum: ['llm', 'tool', 'workflow', 'custom'],
            description: 'Agent type'
          },
          provider: {
            type: 'string',
            enum: ['anthropic', 'openai', 'google', 'aws', 'azure', 'custom'],
            description: 'AI provider'
          },
          version: {
            type: 'string',
            description: 'Agent version'
          },
          status: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                enum: ['idle', 'busy', 'error', 'offline']
              },
              totalTasksCompleted: {
                type: 'integer'
              },
              successRate: {
                type: 'number',
                minimum: 0,
                maximum: 1
              },
              averageResponseTime: {
                type: 'number',
                description: 'Average response time in milliseconds'
              },
              lastActivity: {
                type: 'string',
                format: 'date-time'
              }
            }
          },
          capabilities: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['text-generation', 'code-generation', 'data-analysis', 'image-generation', 'function-calling']
            }
          },
          endpoint: {
            type: 'string',
            format: 'uri',
            description: 'Agent API endpoint'
          },
          maxConcurrentTasks: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum concurrent tasks'
          },
          cost: {
            type: 'object',
            properties: {
              inputTokens: {
                type: 'number',
                description: 'Cost per input token'
              },
              outputTokens: {
                type: 'number',
                description: 'Cost per output token'
              },
              currency: {
                type: 'string',
                default: 'USD'
              }
            }
          }
        }
      },
      Task: {
        type: 'object',
        required: ['id', 'prompt', 'type', 'status'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique task identifier'
          },
          prompt: {
            type: 'string',
            description: 'Task prompt or description'
          },
          type: {
            type: 'string',
            enum: ['general', 'code-generation', 'data-analysis', 'documentation', 'testing', 'review'],
            description: 'Task type'
          },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
            description: 'Task status'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium',
            description: 'Task priority'
          },
          assignedAgent: {
            type: 'string',
            description: 'ID of assigned agent'
          },
          projectId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated project ID'
          },
          context: {
            type: 'object',
            description: 'Additional task context and metadata'
          },
          result: {
            type: 'object',
            properties: {
              output: {
                type: 'string',
                description: 'Task output'
              },
              artifacts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['file', 'code', 'data', 'image']
                    },
                    name: {
                      type: 'string'
                    },
                    content: {
                      type: 'string'
                    },
                    path: {
                      type: 'string'
                    }
                  }
                }
              },
              metrics: {
                type: 'object',
                properties: {
                  executionTime: {
                    type: 'number',
                    description: 'Execution time in milliseconds'
                  },
                  tokensUsed: {
                    type: 'integer'
                  },
                  cost: {
                    type: 'number'
                  }
                }
              }
            }
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          startedAt: {
            type: 'string',
            format: 'date-time'
          },
          completedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Project: {
        type: 'object',
        required: ['id', 'name', 'status'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique project identifier'
          },
          name: {
            type: 'string',
            description: 'Project name'
          },
          description: {
            type: 'string',
            description: 'Project description'
          },
          status: {
            type: 'string',
            enum: ['active', 'completed', 'cancelled', 'on-hold'],
            description: 'Project status'
          },
          ownerId: {
            type: 'string',
            format: 'uuid',
            description: 'Project owner user ID'
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
            description: 'Organization ID'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Project tags'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium'
          },
          deadline: {
            type: 'string',
            format: 'date-time',
            description: 'Project deadline'
          },
          progress: {
            type: 'object',
            properties: {
              completed: {
                type: 'integer',
                description: 'Number of completed tasks'
              },
              total: {
                type: 'integer',
                description: 'Total number of tasks'
              },
              percentage: {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Completion percentage'
              }
            }
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      SSOProvider: {
        type: 'object',
        required: ['id', 'name', 'type', 'enabled'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique provider identifier'
          },
          name: {
            type: 'string',
            description: 'Provider display name'
          },
          type: {
            type: 'string',
            enum: ['saml', 'oauth2'],
            description: 'SSO provider type'
          },
          provider: {
            type: 'string',
            enum: ['google', 'microsoft', 'okta', 'auth0', 'github', 'custom'],
            description: 'OAuth2 provider (for OAuth2 type)'
          },
          enabled: {
            type: 'boolean',
            description: 'Whether provider is enabled'
          },
          entityId: {
            type: 'string',
            description: 'SAML entity ID (for SAML type)'
          },
          ssoUrl: {
            type: 'string',
            format: 'uri',
            description: 'SAML SSO URL (for SAML type)'
          },
          clientId: {
            type: 'string',
            description: 'OAuth2 client ID (for OAuth2 type)'
          },
          attributeMapping: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email attribute mapping'
              },
              firstName: {
                type: 'string',
                description: 'First name attribute mapping'
              },
              lastName: {
                type: 'string',
                description: 'Last name attribute mapping'
              },
              groups: {
                type: 'string',
                description: 'Groups attribute mapping'
              }
            }
          },
          userCount: {
            type: 'integer',
            description: 'Number of users using this provider'
          },
          lastUsed: {
            type: 'string',
            format: 'date-time',
            description: 'Last usage timestamp'
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'error'],
            description: 'Provider status'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    },
    {
      apiKey: []
    },
    {
      sessionAuth: []
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/api/routes/*.ts',
    './src/index.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;