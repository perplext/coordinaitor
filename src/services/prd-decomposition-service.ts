import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { Task, Project, Requirement, Milestone } from '../interfaces/task.interface';
import { AgentRegistry } from '../agents/agent-registry';
import { PatternLearningService } from './pattern-learning';

export interface PRDSection {
  title: string;
  content: string;
  type: 'overview' | 'requirements' | 'user-stories' | 'technical' | 'timeline' | 'acceptance-criteria';
}

export interface DecompositionResult {
  requirements: Requirement[];
  tasks: Task[];
  milestones: Milestone[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number; // in days
  riskFactors: string[];
}

export interface TaskTemplate {
  title: string;
  description: string;
  type: Task['type'];
  priority: Task['priority'];
  estimatedHours?: number;
  skills?: string[];
  dependencies?: string[];
}

export class PRDDecompositionService {
  private logger: winston.Logger;
  private taskTemplates: Map<string, TaskTemplate[]> = new Map();

  constructor(
    private agentRegistry: AgentRegistry,
    private patternLearning?: PatternLearningService
  ) {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.initializeTaskTemplates();
  }

  private initializeTaskTemplates(): void {
    // Web Application Templates
    this.taskTemplates.set('web-app', [
      {
        title: 'Requirements Analysis',
        description: 'Analyze PRD and create detailed technical requirements',
        type: 'requirement',
        priority: 'high',
        estimatedHours: 8,
        skills: ['analysis', 'documentation']
      },
      {
        title: 'System Architecture Design',
        description: 'Design system architecture and component structure',
        type: 'design',
        priority: 'high',
        estimatedHours: 16,
        skills: ['architecture', 'system-design'],
        dependencies: ['Requirements Analysis']
      },
      {
        title: 'Database Schema Design',
        description: 'Design database schema and relationships',
        type: 'design',
        priority: 'high',
        estimatedHours: 8,
        skills: ['database', 'sql'],
        dependencies: ['System Architecture Design']
      },
      {
        title: 'API Design',
        description: 'Design RESTful API endpoints and contracts',
        type: 'design',
        priority: 'high',
        estimatedHours: 12,
        skills: ['api-design', 'rest'],
        dependencies: ['Database Schema Design']
      },
      {
        title: 'UI/UX Design',
        description: 'Create UI mockups and user flow diagrams',
        type: 'design',
        priority: 'medium',
        estimatedHours: 24,
        skills: ['ui-design', 'ux']
      },
      {
        title: 'Backend Implementation',
        description: 'Implement backend services and API',
        type: 'implementation',
        priority: 'high',
        estimatedHours: 40,
        skills: ['backend', 'nodejs', 'typescript'],
        dependencies: ['API Design']
      },
      {
        title: 'Frontend Implementation',
        description: 'Implement frontend application',
        type: 'implementation',
        priority: 'high',
        estimatedHours: 40,
        skills: ['frontend', 'react', 'typescript'],
        dependencies: ['UI/UX Design', 'API Design']
      },
      {
        title: 'Authentication & Authorization',
        description: 'Implement user authentication and authorization',
        type: 'implementation',
        priority: 'high',
        estimatedHours: 16,
        skills: ['security', 'authentication'],
        dependencies: ['Backend Implementation']
      },
      {
        title: 'Unit Tests',
        description: 'Write unit tests for all components',
        type: 'test',
        priority: 'high',
        estimatedHours: 24,
        skills: ['testing', 'jest'],
        dependencies: ['Backend Implementation', 'Frontend Implementation']
      },
      {
        title: 'Integration Tests',
        description: 'Write integration tests for API endpoints',
        type: 'test',
        priority: 'high',
        estimatedHours: 16,
        skills: ['testing', 'integration'],
        dependencies: ['Backend Implementation']
      },
      {
        title: 'E2E Tests',
        description: 'Write end-to-end tests for critical user flows',
        type: 'test',
        priority: 'medium',
        estimatedHours: 20,
        skills: ['testing', 'e2e', 'playwright'],
        dependencies: ['Frontend Implementation']
      },
      {
        title: 'Deployment Setup',
        description: 'Setup CI/CD pipeline and deployment configuration',
        type: 'deployment',
        priority: 'high',
        estimatedHours: 12,
        skills: ['devops', 'ci-cd'],
        dependencies: ['Unit Tests']
      },
      {
        title: 'Documentation',
        description: 'Write technical documentation and user guides',
        type: 'implementation',
        priority: 'medium',
        estimatedHours: 16,
        skills: ['documentation'],
        dependencies: ['Frontend Implementation', 'Backend Implementation']
      }
    ]);

    // Mobile App Templates
    this.taskTemplates.set('mobile-app', [
      {
        title: 'Requirements Analysis',
        description: 'Analyze PRD and platform-specific requirements',
        type: 'requirement',
        priority: 'high',
        estimatedHours: 8,
        skills: ['analysis', 'mobile']
      },
      {
        title: 'Mobile Architecture Design',
        description: 'Design mobile app architecture and navigation',
        type: 'design',
        priority: 'high',
        estimatedHours: 12,
        skills: ['mobile-architecture'],
        dependencies: ['Requirements Analysis']
      },
      {
        title: 'UI/UX Mobile Design',
        description: 'Create mobile-specific UI designs and prototypes',
        type: 'design',
        priority: 'high',
        estimatedHours: 24,
        skills: ['mobile-ui', 'ux']
      },
      {
        title: 'Mobile App Implementation',
        description: 'Implement mobile application',
        type: 'implementation',
        priority: 'high',
        estimatedHours: 60,
        skills: ['mobile', 'react-native', 'flutter'],
        dependencies: ['Mobile Architecture Design', 'UI/UX Mobile Design']
      },
      {
        title: 'Platform Integration',
        description: 'Integrate platform-specific features (push notifications, etc)',
        type: 'implementation',
        priority: 'medium',
        estimatedHours: 16,
        skills: ['mobile', 'platform-apis'],
        dependencies: ['Mobile App Implementation']
      },
      {
        title: 'Mobile Testing',
        description: 'Test on various devices and OS versions',
        type: 'test',
        priority: 'high',
        estimatedHours: 20,
        skills: ['mobile-testing'],
        dependencies: ['Mobile App Implementation']
      },
      {
        title: 'App Store Preparation',
        description: 'Prepare for app store submission',
        type: 'deployment',
        priority: 'high',
        estimatedHours: 8,
        skills: ['mobile', 'app-store'],
        dependencies: ['Mobile Testing']
      }
    ]);

    // API/Microservice Templates
    this.taskTemplates.set('api-service', [
      {
        title: 'API Requirements Analysis',
        description: 'Define API requirements and use cases',
        type: 'requirement',
        priority: 'high',
        estimatedHours: 6,
        skills: ['api-design', 'analysis']
      },
      {
        title: 'API Contract Design',
        description: 'Design API contracts and OpenAPI specification',
        type: 'design',
        priority: 'high',
        estimatedHours: 8,
        skills: ['api-design', 'openapi'],
        dependencies: ['API Requirements Analysis']
      },
      {
        title: 'Service Architecture',
        description: 'Design service architecture and data flow',
        type: 'design',
        priority: 'high',
        estimatedHours: 8,
        skills: ['architecture', 'microservices'],
        dependencies: ['API Requirements Analysis']
      },
      {
        title: 'API Implementation',
        description: 'Implement API endpoints and business logic',
        type: 'implementation',
        priority: 'high',
        estimatedHours: 32,
        skills: ['backend', 'api'],
        dependencies: ['API Contract Design', 'Service Architecture']
      },
      {
        title: 'API Testing',
        description: 'Write comprehensive API tests',
        type: 'test',
        priority: 'high',
        estimatedHours: 16,
        skills: ['testing', 'api-testing'],
        dependencies: ['API Implementation']
      },
      {
        title: 'API Documentation',
        description: 'Generate and review API documentation',
        type: 'implementation',
        priority: 'medium',
        estimatedHours: 8,
        skills: ['documentation', 'api'],
        dependencies: ['API Implementation']
      }
    ]);
  }

  public async decomposePRD(project: Project): Promise<DecompositionResult> {
    this.logger.info(`Starting PRD decomposition for project: ${project.name}`);

    // Parse PRD sections
    const sections = this.parsePRDSections(project.prd || project.description);
    
    // Extract requirements
    const requirements = await this.extractRequirements(sections, project);
    
    // Determine project type and get appropriate templates
    const projectType = this.detectProjectType(sections, project);
    const templates = this.taskTemplates.get(projectType) || this.taskTemplates.get('web-app')!;
    
    // Generate tasks based on templates and requirements
    const tasks = await this.generateTasks(templates, requirements, project);
    
    // Create milestones
    const milestones = this.generateMilestones(tasks, requirements);
    
    // Build dependency graph
    const dependencies = this.buildDependencyGraph(tasks);
    
    // Calculate estimated duration
    const estimatedDuration = this.calculateProjectDuration(tasks, dependencies);
    
    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(requirements, tasks, project);

    // Learn from this decomposition if pattern learning is available
    if (this.patternLearning) {
      this.recordDecompositionPattern(project, tasks, projectType);
    }

    return {
      requirements,
      tasks,
      milestones,
      dependencies,
      estimatedDuration,
      riskFactors
    };
  }

  private parsePRDSections(prd: string): PRDSection[] {
    const sections: PRDSection[] = [];
    
    // Common PRD section patterns
    const sectionPatterns = [
      { regex: /#+\s*(?:executive\s*)?(?:overview|summary)/i, type: 'overview' as const },
      { regex: /#+\s*(?:functional\s*)?requirements/i, type: 'requirements' as const },
      { regex: /#+\s*user\s*stories/i, type: 'user-stories' as const },
      { regex: /#+\s*technical\s*(?:requirements|details|specifications)/i, type: 'technical' as const },
      { regex: /#+\s*(?:timeline|schedule|milestones)/i, type: 'timeline' as const },
      { regex: /#+\s*(?:acceptance\s*criteria|success\s*metrics)/i, type: 'acceptance-criteria' as const }
    ];

    const lines = prd.split('\n');
    let currentSection: PRDSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      let sectionFound = false;
      
      for (const pattern of sectionPatterns) {
        if (pattern.regex.test(line)) {
          if (currentSection) {
            currentSection.content = currentContent.join('\n').trim();
            sections.push(currentSection);
          }
          
          currentSection = {
            title: line.replace(/#+\s*/, '').trim(),
            content: '',
            type: pattern.type
          };
          currentContent = [];
          sectionFound = true;
          break;
        }
      }
      
      if (!sectionFound && currentSection) {
        currentContent.push(line);
      } else if (!sectionFound && !currentSection) {
        // First section is overview by default
        currentSection = {
          title: 'Overview',
          content: '',
          type: 'overview'
        };
        currentContent.push(line);
      }
    }

    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  private async extractRequirements(sections: PRDSection[], project: Project): Promise<Requirement[]> {
    const requirements: Requirement[] = [];
    let requirementCounter = 1;

    // Extract from requirements sections
    const reqSections = sections.filter(s => 
      s.type === 'requirements' || s.type === 'user-stories' || s.type === 'acceptance-criteria'
    );

    for (const section of reqSections) {
      const items = this.extractListItems(section.content);
      
      for (const item of items) {
        const requirement: Requirement = {
          id: uuidv4(),
          projectId: project.id,
          type: section.type === 'user-stories' ? 'user-story' : 'functional',
          title: `REQ-${requirementCounter}: ${this.extractRequirementTitle(item)}`,
          description: item,
          priority: this.detectRequirementPriority(item),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        requirements.push(requirement);
        requirementCounter++;
      }
    }

    // Extract technical requirements
    const techSections = sections.filter(s => s.type === 'technical');
    for (const section of techSections) {
      const items = this.extractListItems(section.content);
      
      for (const item of items) {
        const requirement: Requirement = {
          id: uuidv4(),
          projectId: project.id,
          type: 'technical',
          title: `TECH-${requirementCounter}: ${this.extractRequirementTitle(item)}`,
          description: item,
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        requirements.push(requirement);
        requirementCounter++;
      }
    }

    return requirements;
  }

  private extractListItems(content: string): string[] {
    const items: string[] = [];
    const lines = content.split('\n');
    let currentItem = '';

    for (const line of lines) {
      if (/^[\s]*[-*•]\s+/.test(line) || /^[\s]*\d+\.\s+/.test(line)) {
        if (currentItem) {
          items.push(currentItem.trim());
        }
        currentItem = line.replace(/^[\s]*[-*•]\s+/, '').replace(/^[\s]*\d+\.\s+/, '');
      } else if (currentItem && line.trim()) {
        currentItem += ' ' + line.trim();
      }
    }

    if (currentItem) {
      items.push(currentItem.trim());
    }

    return items;
  }

  private extractRequirementTitle(requirement: string): string {
    // Extract first sentence or up to 50 characters
    const firstSentence = requirement.match(/^[^.!?]+/);
    if (firstSentence) {
      return firstSentence[0].substring(0, 50).trim();
    }
    return requirement.substring(0, 50).trim();
  }

  private detectRequirementPriority(requirement: string): 'critical' | 'high' | 'medium' | 'low' {
    const lowerReq = requirement.toLowerCase();
    
    if (lowerReq.includes('must') || lowerReq.includes('critical') || lowerReq.includes('essential')) {
      return 'critical';
    }
    if (lowerReq.includes('should') || lowerReq.includes('important') || lowerReq.includes('high priority')) {
      return 'high';
    }
    if (lowerReq.includes('could') || lowerReq.includes('nice to have') || lowerReq.includes('low priority')) {
      return 'low';
    }
    
    return 'medium';
  }

  private detectProjectType(sections: PRDSection[], project: Project): string {
    const content = sections.map(s => s.content).join(' ').toLowerCase();
    const title = project.name.toLowerCase();
    const description = project.description.toLowerCase();
    
    const allContent = `${content} ${title} ${description}`;
    
    if (allContent.includes('mobile') || allContent.includes('ios') || allContent.includes('android')) {
      return 'mobile-app';
    }
    if (allContent.includes('api') || allContent.includes('microservice') || allContent.includes('backend only')) {
      return 'api-service';
    }
    if (allContent.includes('web') || allContent.includes('dashboard') || allContent.includes('portal')) {
      return 'web-app';
    }
    
    return 'web-app'; // default
  }

  private async generateTasks(
    templates: TaskTemplate[], 
    requirements: Requirement[], 
    project: Project
  ): Promise<Task[]> {
    const tasks: Task[] = [];
    const taskMap = new Map<string, string>(); // template title -> task id

    // Generate tasks from templates
    for (const template of templates) {
      const task: Task = {
        id: uuidv4(),
        projectId: project.id,
        type: template.type,
        title: template.title,
        description: this.enrichTaskDescription(template, requirements),
        dependencies: [],
        status: 'pending',
        priority: template.priority,
        assignedTo: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          estimatedHours: template.estimatedHours,
          requiredSkills: template.skills
        }
      };

      tasks.push(task);
      taskMap.set(template.title, task.id);
    }

    // Set up dependencies
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const task = tasks[i];
      
      if (template.dependencies) {
        task.dependencies = template.dependencies
          .map(dep => taskMap.get(dep))
          .filter(id => id !== undefined) as string[];
      }
    }

    // Generate additional tasks based on specific requirements
    const additionalTasks = await this.generateRequirementSpecificTasks(requirements, project);
    tasks.push(...additionalTasks);

    return tasks;
  }

  private enrichTaskDescription(template: TaskTemplate, requirements: Requirement[]): string {
    let description = template.description;
    
    // Add relevant requirements to the task description
    const relevantReqs = requirements.filter(req => 
      this.isRequirementRelevantToTask(req, template)
    );

    if (relevantReqs.length > 0) {
      description += '\n\nRelated Requirements:\n';
      relevantReqs.forEach(req => {
        description += `- ${req.title}: ${req.description.substring(0, 100)}...\n`;
      });
    }

    return description;
  }

  private isRequirementRelevantToTask(requirement: Requirement, template: TaskTemplate): boolean {
    const reqLower = requirement.description.toLowerCase();
    const templateLower = `${template.title} ${template.description}`.toLowerCase();
    
    // Check for keyword matches
    const keywords = ['auth', 'api', 'database', 'ui', 'test', 'deploy', 'security'];
    
    for (const keyword of keywords) {
      if (reqLower.includes(keyword) && templateLower.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  private async generateRequirementSpecificTasks(
    requirements: Requirement[], 
    project: Project
  ): Promise<Task[]> {
    const additionalTasks: Task[] = [];
    
    // Check for specific requirement patterns that need custom tasks
    for (const req of requirements) {
      const reqLower = req.description.toLowerCase();
      
      // Third-party integration requirements
      if (reqLower.includes('integrate') || reqLower.includes('integration')) {
        const integrationMatch = reqLower.match(/integrate\s+(?:with\s+)?(\w+)/);
        if (integrationMatch) {
          additionalTasks.push({
            id: uuidv4(),
            projectId: project.id,
            type: 'implementation',
            title: `${integrationMatch[1]} Integration`,
            description: `Implement integration with ${integrationMatch[1]} as specified in ${req.title}`,
            dependencies: [],
            status: 'pending',
            priority: req.priority === 'critical' ? 'high' : 'medium',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              requirementId: req.id,
              estimatedHours: 16
            }
          });
        }
      }
      
      // Performance requirements
      if (reqLower.includes('performance') || reqLower.includes('optimization')) {
        additionalTasks.push({
          id: uuidv4(),
          projectId: project.id,
          type: 'implementation',
          title: 'Performance Optimization',
          description: `Optimize application performance to meet requirements in ${req.title}`,
          dependencies: [],
          status: 'pending',
          priority: 'high',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            requirementId: req.id,
            estimatedHours: 24
          }
        });
      }
      
      // Security requirements
      if (reqLower.includes('security') || reqLower.includes('encryption') || reqLower.includes('compliance')) {
        additionalTasks.push({
          id: uuidv4(),
          projectId: project.id,
          type: 'implementation',
          title: 'Security Implementation',
          description: `Implement security measures for ${req.title}`,
          dependencies: [],
          status: 'pending',
          priority: 'critical',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            requirementId: req.id,
            estimatedHours: 20
          }
        });
      }
    }
    
    return additionalTasks;
  }

  private generateMilestones(tasks: Task[], requirements: Requirement[]): Milestone[] {
    const milestones: Milestone[] = [];
    
    // Group tasks by type
    const tasksByType = new Map<string, Task[]>();
    tasks.forEach(task => {
      const type = task.type;
      if (!tasksByType.has(type)) {
        tasksByType.set(type, []);
      }
      tasksByType.get(type)!.push(task);
    });

    // Create milestones based on project phases
    const phases = [
      { type: 'requirement', name: 'Requirements Complete', order: 1 },
      { type: 'design', name: 'Design Complete', order: 2 },
      { type: 'implementation', name: 'Implementation Complete', order: 3 },
      { type: 'test', name: 'Testing Complete', order: 4 },
      { type: 'deployment', name: 'Deployment Complete', order: 5 }
    ];

    for (const phase of phases) {
      const phaseTasks = tasksByType.get(phase.type) || [];
      if (phaseTasks.length > 0) {
        const milestone: Milestone = {
          id: uuidv4(),
          name: phase.name,
          description: `All ${phase.type} tasks completed`,
          dueDate: this.calculateMilestoneDueDate(phase.order, tasks.length),
          status: 'pending',
          tasks: phaseTasks.map(t => t.id)
        };
        milestones.push(milestone);
      }
    }

    // Add final milestone
    milestones.push({
      id: uuidv4(),
      name: 'Project Complete',
      description: 'All project tasks completed and delivered',
      dueDate: this.calculateMilestoneDueDate(6, tasks.length),
      status: 'pending',
      tasks: tasks.map(t => t.id)
    });

    return milestones;
  }

  private calculateMilestoneDueDate(phaseOrder: number, totalTasks: number): Date {
    // Simple calculation: assume 2 days per task average, distribute across phases
    const totalDays = totalTasks * 2;
    const daysPerPhase = Math.ceil(totalDays / 6);
    const daysFromNow = phaseOrder * daysPerPhase;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysFromNow);
    
    return dueDate;
  }

  private buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    
    tasks.forEach(task => {
      if (task.dependencies && task.dependencies.length > 0) {
        dependencies.set(task.id, task.dependencies);
      }
    });
    
    return dependencies;
  }

  private calculateProjectDuration(tasks: Task[], dependencies: Map<string, string[]>): number {
    // Calculate critical path
    const taskDurations = new Map<string, number>();
    
    tasks.forEach(task => {
      const hours = task.metadata?.estimatedHours || 16; // default 2 days
      taskDurations.set(task.id, hours / 8); // convert to days
    });

    // Find tasks with no dependencies (starting points)
    const startTasks = tasks.filter(task => 
      !task.dependencies || task.dependencies.length === 0
    );

    // Calculate longest path from each start task
    let maxDuration = 0;
    
    for (const startTask of startTasks) {
      const duration = this.calculatePathDuration(
        startTask.id, 
        taskDurations, 
        dependencies, 
        new Set()
      );
      maxDuration = Math.max(maxDuration, duration);
    }

    // Add buffer for coordination and reviews (20%)
    return Math.ceil(maxDuration * 1.2);
  }

  private calculatePathDuration(
    taskId: string,
    durations: Map<string, number>,
    dependencies: Map<string, string[]>,
    visited: Set<string>
  ): number {
    if (visited.has(taskId)) {
      return 0; // Avoid cycles
    }
    
    visited.add(taskId);
    const taskDuration = durations.get(taskId) || 0;
    
    // Find all tasks that depend on this task
    const dependentTasks = Array.from(dependencies.entries())
      .filter(([_, deps]) => deps.includes(taskId))
      .map(([id, _]) => id);
    
    if (dependentTasks.length === 0) {
      return taskDuration;
    }
    
    const maxDependentDuration = Math.max(
      ...dependentTasks.map(depId => 
        this.calculatePathDuration(depId, durations, dependencies, visited)
      )
    );
    
    return taskDuration + maxDependentDuration;
  }

  private identifyRiskFactors(
    requirements: Requirement[], 
    tasks: Task[], 
    project: Project
  ): string[] {
    const risks: string[] = [];
    
    // Check for common risk indicators
    const allContent = `${project.prd} ${project.description} ${requirements.map(r => r.description).join(' ')}`.toLowerCase();
    
    if (allContent.includes('real-time') || allContent.includes('realtime')) {
      risks.push('Real-time requirements may add complexity and require specialized expertise');
    }
    
    if (allContent.includes('scale') || allContent.includes('high volume') || allContent.includes('million')) {
      risks.push('Scalability requirements may require additional architecture considerations');
    }
    
    if (allContent.includes('integration') && tasks.filter(t => t.title.includes('Integration')).length > 2) {
      risks.push('Multiple third-party integrations increase complexity and potential points of failure');
    }
    
    if (allContent.includes('compliance') || allContent.includes('regulatory')) {
      risks.push('Compliance requirements may extend timeline and require specialized knowledge');
    }
    
    if (allContent.includes('machine learning') || allContent.includes('ai') || allContent.includes('ml')) {
      risks.push('ML/AI components add uncertainty to timeline and require specialized skills');
    }
    
    // Check task complexity
    const criticalTasks = tasks.filter(t => t.priority === 'critical');
    if (criticalTasks.length > tasks.length * 0.3) {
      risks.push('High percentage of critical tasks indicates limited flexibility in prioritization');
    }
    
    // Check for tight dependencies
    const highlyDependentTasks = tasks.filter(t => 
      t.dependencies && t.dependencies.length > 3
    );
    if (highlyDependentTasks.length > 0) {
      risks.push('Complex task dependencies may create bottlenecks and delay project completion');
    }
    
    return risks;
  }

  private recordDecompositionPattern(project: Project, tasks: Task[], projectType: string): void {
    if (!this.patternLearning) return;
    
    // Record successful decomposition pattern
    const pattern = {
      projectType,
      taskCount: tasks.length,
      taskTypes: tasks.reduce((acc, task) => {
        acc[task.type] = (acc[task.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgDependencies: tasks.reduce((sum, task) => 
        sum + (task.dependencies?.length || 0), 0
      ) / tasks.length,
      metadata: {
        projectName: project.name,
        timestamp: new Date()
      }
    };
    
    // This would be stored for future learning
    this.logger.info('Recorded decomposition pattern:', pattern);
  }

  public async refineDecomposition(
    result: DecompositionResult,
    feedback: {
      tasksToAdd?: TaskTemplate[];
      tasksToRemove?: string[];
      dependenciesToAdd?: Array<{ from: string; to: string }>;
      dependenciesToRemove?: Array<{ from: string; to: string }>;
    }
  ): Promise<DecompositionResult> {
    // Add new tasks
    if (feedback.tasksToAdd) {
      for (const template of feedback.tasksToAdd) {
        const task: Task = {
          id: uuidv4(),
          projectId: result.tasks[0]?.projectId || '',
          type: template.type,
          title: template.title,
          description: template.description,
          dependencies: template.dependencies?.map(dep => 
            result.tasks.find(t => t.title === dep)?.id
          ).filter(id => id !== undefined) as string[] || [],
          status: 'pending',
          priority: template.priority,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            estimatedHours: template.estimatedHours,
            requiredSkills: template.skills
          }
        };
        result.tasks.push(task);
      }
    }
    
    // Remove tasks
    if (feedback.tasksToRemove) {
      result.tasks = result.tasks.filter(t => !feedback.tasksToRemove!.includes(t.id));
      // Clean up dependencies
      result.tasks.forEach(task => {
        if (task.dependencies) {
          task.dependencies = task.dependencies.filter(dep => 
            !feedback.tasksToRemove!.includes(dep)
          );
        }
      });
    }
    
    // Update dependencies
    if (feedback.dependenciesToAdd) {
      feedback.dependenciesToAdd.forEach(({ from, to }) => {
        const task = result.tasks.find(t => t.id === to);
        if (task && !task.dependencies?.includes(from)) {
          task.dependencies = [...(task.dependencies || []), from];
        }
      });
    }
    
    if (feedback.dependenciesToRemove) {
      feedback.dependenciesToRemove.forEach(({ from, to }) => {
        const task = result.tasks.find(t => t.id === to);
        if (task && task.dependencies) {
          task.dependencies = task.dependencies.filter(dep => dep !== from);
        }
      });
    }
    
    // Recalculate dependencies and duration
    result.dependencies = this.buildDependencyGraph(result.tasks);
    result.estimatedDuration = this.calculateProjectDuration(result.tasks, result.dependencies);
    
    return result;
  }
}