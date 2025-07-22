import { v4 as uuidv4 } from 'uuid';
import { TaskTemplate, TemplateVariable } from '../interfaces/template.interface';
import { Task } from '../interfaces/task.interface';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TemplateService {
  private templates: Map<string, TaskTemplate> = new Map();
  private logger: winston.Logger;
  private templateDir: string;

  constructor(templateDir: string = './templates') {
    this.templateDir = templateDir;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    try {
      await fs.mkdir(this.templateDir, { recursive: true });
      
      // Load built-in templates
      this.loadBuiltInTemplates();
      
      // Load custom templates from disk
      const files = await fs.readdir(this.templateDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.templateDir, file), 'utf-8');
            const template = JSON.parse(content) as TaskTemplate;
            this.templates.set(template.id, template);
            this.logger.info(`Loaded template: ${template.name}`);
          } catch (error) {
            this.logger.error(`Failed to load template ${file}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to load templates:', error);
    }
  }

  private loadBuiltInTemplates(): void {
    // API Endpoint Template
    this.createTemplate({
      name: 'REST API Endpoint',
      description: 'Create a REST API endpoint with CRUD operations',
      category: 'backend',
      tags: ['api', 'rest', 'backend'],
      taskDefinition: {
        type: 'implementation',
        priority: 'medium'
      },
      variables: [
        {
          name: 'resourceName',
          type: 'string',
          label: 'Resource Name',
          description: 'Name of the resource (e.g., user, product)',
          required: true
        },
        {
          name: 'methods',
          type: 'multiselect',
          label: 'HTTP Methods',
          required: true,
          defaultValue: ['GET', 'POST', 'PUT', 'DELETE'],
          options: [
            { value: 'GET', label: 'GET - Read' },
            { value: 'POST', label: 'POST - Create' },
            { value: 'PUT', label: 'PUT - Update' },
            { value: 'DELETE', label: 'DELETE - Delete' },
            { value: 'PATCH', label: 'PATCH - Partial Update' }
          ]
        },
        {
          name: 'authentication',
          type: 'boolean',
          label: 'Require Authentication',
          defaultValue: true,
          required: true
        },
        {
          name: 'database',
          type: 'select',
          label: 'Database Type',
          required: true,
          options: [
            { value: 'postgresql', label: 'PostgreSQL' },
            { value: 'mongodb', label: 'MongoDB' },
            { value: 'mysql', label: 'MySQL' },
            { value: 'sqlite', label: 'SQLite' }
          ]
        }
      ]
    });

    // React Component Template
    this.createTemplate({
      name: 'React Component',
      description: 'Create a React component with TypeScript',
      category: 'frontend',
      tags: ['react', 'component', 'frontend', 'typescript'],
      taskDefinition: {
        type: 'implementation',
        priority: 'medium'
      },
      variables: [
        {
          name: 'componentName',
          type: 'string',
          label: 'Component Name',
          required: true,
          validation: {
            pattern: '^[A-Z][a-zA-Z0-9]*$'
          }
        },
        {
          name: 'componentType',
          type: 'select',
          label: 'Component Type',
          required: true,
          defaultValue: 'functional',
          options: [
            { value: 'functional', label: 'Functional Component' },
            { value: 'class', label: 'Class Component' }
          ]
        },
        {
          name: 'includeStyles',
          type: 'boolean',
          label: 'Include Styles',
          defaultValue: true,
          required: true
        },
        {
          name: 'includeTests',
          type: 'boolean',
          label: 'Include Tests',
          defaultValue: true,
          required: true
        }
      ]
    });

    // Bug Fix Template
    this.createTemplate({
      name: 'Bug Fix',
      description: 'Fix a bug in the codebase',
      category: 'maintenance',
      tags: ['bug', 'fix', 'maintenance'],
      taskDefinition: {
        type: 'implementation',
        priority: 'high'
      },
      variables: [
        {
          name: 'bugDescription',
          type: 'string',
          label: 'Bug Description',
          description: 'Describe the bug and its symptoms',
          required: true,
          validation: {
            minLength: 10
          }
        },
        {
          name: 'affectedFiles',
          type: 'string',
          label: 'Affected Files',
          description: 'List of files that might be affected',
          required: false
        },
        {
          name: 'severity',
          type: 'select',
          label: 'Severity',
          required: true,
          defaultValue: 'medium',
          options: [
            { value: 'low', label: 'Low - Minor issue' },
            { value: 'medium', label: 'Medium - Affects functionality' },
            { value: 'high', label: 'High - Major functionality broken' },
            { value: 'critical', label: 'Critical - System down' }
          ]
        }
      ]
    });

    // Security Audit Template
    this.createTemplate({
      name: 'Security Audit',
      description: 'Perform security audit on code or dependencies',
      category: 'security',
      tags: ['security', 'audit', 'compliance'],
      taskDefinition: {
        type: 'review',
        priority: 'high'
      },
      variables: [
        {
          name: 'auditScope',
          type: 'select',
          label: 'Audit Scope',
          required: true,
          options: [
            { value: 'code', label: 'Source Code' },
            { value: 'dependencies', label: 'Dependencies' },
            { value: 'infrastructure', label: 'Infrastructure' },
            { value: 'all', label: 'Full Audit' }
          ]
        },
        {
          name: 'standards',
          type: 'multiselect',
          label: 'Security Standards',
          required: true,
          defaultValue: ['owasp'],
          options: [
            { value: 'owasp', label: 'OWASP Top 10' },
            { value: 'cwe', label: 'CWE/SANS Top 25' },
            { value: 'pci', label: 'PCI DSS' },
            { value: 'hipaa', label: 'HIPAA' },
            { value: 'gdpr', label: 'GDPR' }
          ]
        }
      ]
    });

    // Documentation Template
    this.createTemplate({
      name: 'Documentation',
      description: 'Create or update documentation',
      category: 'documentation',
      tags: ['docs', 'documentation', 'readme'],
      taskDefinition: {
        type: 'implementation',
        priority: 'low'
      },
      variables: [
        {
          name: 'docType',
          type: 'select',
          label: 'Documentation Type',
          required: true,
          options: [
            { value: 'api', label: 'API Documentation' },
            { value: 'readme', label: 'README' },
            { value: 'tutorial', label: 'Tutorial' },
            { value: 'architecture', label: 'Architecture Docs' },
            { value: 'user-guide', label: 'User Guide' }
          ]
        },
        {
          name: 'format',
          type: 'select',
          label: 'Format',
          required: true,
          defaultValue: 'markdown',
          options: [
            { value: 'markdown', label: 'Markdown' },
            { value: 'asciidoc', label: 'AsciiDoc' },
            { value: 'rst', label: 'reStructuredText' }
          ]
        }
      ]
    });
  }

  public createTemplate(params: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): TaskTemplate {
    const template: TaskTemplate = {
      id: uuidv4(),
      ...params,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    };

    this.templates.set(template.id, template);
    this.saveTemplate(template);
    
    return template;
  }

  private async saveTemplate(template: TaskTemplate): Promise<void> {
    try {
      const filePath = path.join(this.templateDir, `${template.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(template, null, 2));
    } catch (error) {
      this.logger.error('Failed to save template:', error);
    }
  }

  public getTemplate(id: string): TaskTemplate | undefined {
    return this.templates.get(id);
  }

  public getAllTemplates(): TaskTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplatesByCategory(category: string): TaskTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  public getTemplatesByTag(tag: string): TaskTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.tags.includes(tag));
  }

  public applyTemplate(templateId: string, variables: Record<string, any>): Partial<Task> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate required variables
    for (const variable of template.variables || []) {
      if (variable.required && !(variable.name in variables)) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }

      // Validate variable values
      const value = variables[variable.name];
      if (value !== undefined && variable.validation) {
        this.validateVariable(variable, value);
      }
    }

    // Apply template with variable substitution
    const task = JSON.parse(JSON.stringify(template.taskDefinition));
    
    // Replace variables in string fields
    const replaceVariables = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          return variables[varName] || match;
        });
      } else if (Array.isArray(obj)) {
        return obj.map(replaceVariables);
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = replaceVariables(value);
        }
        return result;
      }
      return obj;
    };

    const processedTask = replaceVariables(task);

    // Generate task description based on template and variables
    if (!processedTask.description) {
      processedTask.description = this.generateDescription(template, variables);
    }

    // Update usage count
    template.usageCount++;
    template.updatedAt = new Date();
    this.saveTemplate(template);

    return processedTask;
  }

  private validateVariable(variable: TemplateVariable, value: any): void {
    const validation = variable.validation;
    if (!validation) return;

    switch (variable.type) {
      case 'string':
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          throw new Error(`${variable.name} does not match pattern: ${validation.pattern}`);
        }
        if (validation.minLength && value.length < validation.minLength) {
          throw new Error(`${variable.name} must be at least ${validation.minLength} characters`);
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          throw new Error(`${variable.name} must be at most ${validation.maxLength} characters`);
        }
        break;

      case 'number':
        if (validation.min !== undefined && value < validation.min) {
          throw new Error(`${variable.name} must be at least ${validation.min}`);
        }
        if (validation.max !== undefined && value > validation.max) {
          throw new Error(`${variable.name} must be at most ${validation.max}`);
        }
        break;
    }
  }

  private generateDescription(template: TaskTemplate, variables: Record<string, any>): string {
    let description = template.description;

    // Add variable information
    const varInfo: string[] = [];
    for (const variable of template.variables || []) {
      if (variables[variable.name]) {
        varInfo.push(`${variable.label}: ${variables[variable.name]}`);
      }
    }

    if (varInfo.length > 0) {
      description += '\n\nParameters:\n' + varInfo.map(v => `- ${v}`).join('\n');
    }

    return description;
  }

  public async deleteTemplate(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (template) {
      this.templates.delete(id);
      try {
        const filePath = path.join(this.templateDir, `${id}.json`);
        await fs.unlink(filePath);
      } catch (error) {
        this.logger.error('Failed to delete template file:', error);
      }
    }
  }

  public updateTemplate(id: string, updates: Partial<TaskTemplate>): TaskTemplate | undefined {
    const template = this.templates.get(id);
    if (template) {
      Object.assign(template, updates, {
        updatedAt: new Date()
      });
      this.saveTemplate(template);
      return template;
    }
    return undefined;
  }
}