import { EventEmitter } from 'events';
import winston from 'winston';
import { DatabaseService } from '../database/database-service';
import { User } from '../database/entities/User';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string;
  completed: boolean;
  required: boolean;
  order: number;
  metadata?: Record<string, any>;
}

export interface OnboardingProgress {
  userId: string;
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  role: string;
  steps: OnboardingStep[];
}

export class OnboardingService extends EventEmitter {
  private logger: winston.Logger;
  private db: DatabaseService;
  private userProgress: Map<string, OnboardingProgress> = new Map();

  // Default onboarding templates
  private templates: OnboardingTemplate[] = [
    {
      id: 'developer',
      name: 'Developer Onboarding',
      description: 'Get started with creating and managing AI-powered tasks',
      role: 'developer',
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to Multi-Agent Orchestrator',
          description: 'Learn what you can do with our platform',
          component: 'WelcomeStep',
          completed: false,
          required: true,
          order: 1
        },
        {
          id: 'profile-setup',
          title: 'Complete Your Profile',
          description: 'Set up your profile and preferences',
          component: 'ProfileSetupStep',
          completed: false,
          required: true,
          order: 2
        },
        {
          id: 'create-project',
          title: 'Create Your First Project',
          description: 'Learn how to create and manage projects',
          component: 'CreateProjectStep',
          completed: false,
          required: true,
          order: 3
        },
        {
          id: 'create-task',
          title: 'Create Your First Task',
          description: 'Create a task and see AI agents in action',
          component: 'CreateTaskStep',
          completed: false,
          required: true,
          order: 4
        },
        {
          id: 'explore-agents',
          title: 'Explore AI Agents',
          description: 'Learn about different AI agents and their capabilities',
          component: 'ExploreAgentsStep',
          completed: false,
          required: false,
          order: 5
        },
        {
          id: 'collaboration',
          title: 'Multi-Agent Collaboration',
          description: 'See how agents work together on complex tasks',
          component: 'CollaborationStep',
          completed: false,
          required: false,
          order: 6
        },
        {
          id: 'integrations',
          title: 'Set Up Integrations',
          description: 'Connect your tools and services',
          component: 'IntegrationsStep',
          completed: false,
          required: false,
          order: 7
        }
      ]
    },
    {
      id: 'manager',
      name: 'Manager Onboarding',
      description: 'Learn to oversee projects and team productivity',
      role: 'manager',
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to Multi-Agent Orchestrator',
          description: 'Discover how AI can boost your team productivity',
          component: 'WelcomeStep',
          completed: false,
          required: true,
          order: 1
        },
        {
          id: 'profile-setup',
          title: 'Complete Your Profile',
          description: 'Set up your profile and team preferences',
          component: 'ProfileSetupStep',
          completed: false,
          required: true,
          order: 2
        },
        {
          id: 'team-setup',
          title: 'Set Up Your Team',
          description: 'Invite team members and assign roles',
          component: 'TeamSetupStep',
          completed: false,
          required: true,
          order: 3
        },
        {
          id: 'analytics-tour',
          title: 'Analytics Dashboard Tour',
          description: 'Learn to track team performance and AI usage',
          component: 'AnalyticsTourStep',
          completed: false,
          required: true,
          order: 4
        },
        {
          id: 'approval-workflow',
          title: 'Approval Workflows',
          description: 'Set up approval processes for critical tasks',
          component: 'ApprovalWorkflowStep',
          completed: false,
          required: false,
          order: 5
        }
      ]
    },
    {
      id: 'admin',
      name: 'Administrator Onboarding',
      description: 'Master system configuration and management',
      role: 'admin',
      steps: [
        {
          id: 'welcome',
          title: 'Administrator Overview',
          description: 'Understanding your administrative capabilities',
          component: 'WelcomeStep',
          completed: false,
          required: true,
          order: 1
        },
        {
          id: 'system-config',
          title: 'System Configuration',
          description: 'Configure agents, integrations, and security',
          component: 'SystemConfigStep',
          completed: false,
          required: true,
          order: 2
        },
        {
          id: 'user-management',
          title: 'User Management',
          description: 'Manage users, roles, and permissions',
          component: 'UserManagementStep',
          completed: false,
          required: true,
          order: 3
        },
        {
          id: 'monitoring',
          title: 'System Monitoring',
          description: 'Monitor system health and performance',
          component: 'MonitoringStep',
          completed: false,
          required: false,
          order: 4
        }
      ]
    }
  ];

  constructor() {
    super();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });
    this.db = DatabaseService.getInstance();
  }

  /**
   * Start onboarding for a new user
   */
  public async startOnboarding(userId: string, role: string = 'developer'): Promise<OnboardingProgress> {
    try {
      // Check if user already has onboarding progress
      const existingProgress = await this.getUserProgress(userId);
      if (existingProgress) {
        this.logger.info(`User ${userId} already has onboarding progress`);
        return existingProgress;
      }

      // Get template for role
      const template = this.templates.find(t => t.role === role) || this.templates[0];
      
      // Create new progress
      const progress: OnboardingProgress = {
        userId,
        currentStep: template.steps[0].id,
        completedSteps: [],
        skippedSteps: [],
        startedAt: new Date(),
        metadata: {
          templateId: template.id,
          role
        }
      };

      // Save to database
      await this.saveProgress(progress);
      this.userProgress.set(userId, progress);

      this.logger.info(`Started onboarding for user ${userId} with template ${template.id}`);
      this.emit('onboarding:started', { userId, template: template.id });

      return progress;
    } catch (error) {
      this.logger.error('Failed to start onboarding:', error);
      throw error;
    }
  }

  /**
   * Get onboarding progress for a user
   */
  public async getUserProgress(userId: string): Promise<OnboardingProgress | null> {
    // Check cache first
    if (this.userProgress.has(userId)) {
      return this.userProgress.get(userId)!;
    }

    // Load from database
    const user = await this.db.users.findById(userId);
    if (user && user.metadata?.onboarding) {
      const progress = user.metadata.onboarding as OnboardingProgress;
      this.userProgress.set(userId, progress);
      return progress;
    }

    return null;
  }

  /**
   * Get onboarding steps for a user
   */
  public async getUserSteps(userId: string): Promise<OnboardingStep[]> {
    const progress = await this.getUserProgress(userId);
    if (!progress) {
      throw new Error('No onboarding progress found for user');
    }

    const templateId = progress.metadata.templateId;
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error('Onboarding template not found');
    }

    // Update step completion status
    const steps = template.steps.map(step => ({
      ...step,
      completed: progress.completedSteps.includes(step.id)
    }));

    return steps;
  }

  /**
   * Complete an onboarding step
   */
  public async completeStep(userId: string, stepId: string, data?: any): Promise<OnboardingProgress> {
    const progress = await this.getUserProgress(userId);
    if (!progress) {
      throw new Error('No onboarding progress found for user');
    }

    // Mark step as completed
    if (!progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
    }

    // Store step data if provided
    if (data) {
      progress.metadata[`step_${stepId}_data`] = data;
    }

    // Move to next step
    const steps = await this.getUserSteps(userId);
    const currentIndex = steps.findIndex(s => s.id === stepId);
    const nextStep = steps.find((s, i) => i > currentIndex && !s.completed);
    
    if (nextStep) {
      progress.currentStep = nextStep.id;
    } else {
      // All steps completed
      progress.completedAt = new Date();
      this.emit('onboarding:completed', { userId });
    }

    // Save progress
    await this.saveProgress(progress);

    this.logger.info(`User ${userId} completed step ${stepId}`);
    this.emit('onboarding:step-completed', { userId, stepId, data });

    return progress;
  }

  /**
   * Skip an onboarding step
   */
  public async skipStep(userId: string, stepId: string): Promise<OnboardingProgress> {
    const progress = await this.getUserProgress(userId);
    if (!progress) {
      throw new Error('No onboarding progress found for user');
    }

    const steps = await this.getUserSteps(userId);
    const step = steps.find(s => s.id === stepId);
    
    if (step?.required) {
      throw new Error('Cannot skip required step');
    }

    // Mark step as skipped
    if (!progress.skippedSteps.includes(stepId)) {
      progress.skippedSteps.push(stepId);
    }

    // Move to next step
    const currentIndex = steps.findIndex(s => s.id === stepId);
    const nextStep = steps.find((s, i) => i > currentIndex && !s.completed && !progress.skippedSteps.includes(s.id));
    
    if (nextStep) {
      progress.currentStep = nextStep.id;
    }

    // Save progress
    await this.saveProgress(progress);

    this.logger.info(`User ${userId} skipped step ${stepId}`);
    this.emit('onboarding:step-skipped', { userId, stepId });

    return progress;
  }

  /**
   * Reset onboarding progress
   */
  public async resetOnboarding(userId: string): Promise<void> {
    const user = await this.db.users.findById(userId);
    if (user) {
      const metadata = { ...user.metadata };
      delete metadata.onboarding;
      await this.db.users.update(userId, { metadata });
    }

    this.userProgress.delete(userId);
    this.logger.info(`Reset onboarding for user ${userId}`);
    this.emit('onboarding:reset', { userId });
  }

  /**
   * Save progress to database
   */
  private async saveProgress(progress: OnboardingProgress): Promise<void> {
    const user = await this.db.users.findById(progress.userId);
    if (user) {
      const metadata = {
        ...user.metadata,
        onboarding: progress
      };
      await this.db.users.update(progress.userId, { metadata });
    }
  }

  /**
   * Get onboarding statistics
   */
  public async getOnboardingStats(organizationId: string): Promise<{
    totalUsers: number;
    completedOnboarding: number;
    inProgress: number;
    notStarted: number;
    averageCompletionTime: number;
    stepCompletionRates: Record<string, number>;
  }> {
    const users = await this.db.users.findByOrganization(organizationId);
    
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    const completionTimes: number[] = [];
    const stepCompletions: Record<string, { completed: number; total: number }> = {};

    for (const user of users) {
      const progress = user.metadata?.onboarding as OnboardingProgress;
      
      if (!progress) {
        notStartedCount++;
      } else if (progress.completedAt) {
        completedCount++;
        const duration = progress.completedAt.getTime() - progress.startedAt.getTime();
        completionTimes.push(duration);
      } else {
        inProgressCount++;
      }

      // Track step completions
      if (progress) {
        const template = this.templates.find(t => t.id === progress.metadata.templateId);
        if (template) {
          template.steps.forEach(step => {
            if (!stepCompletions[step.id]) {
              stepCompletions[step.id] = { completed: 0, total: 0 };
            }
            stepCompletions[step.id].total++;
            if (progress.completedSteps.includes(step.id)) {
              stepCompletions[step.id].completed++;
            }
          });
        }
      }
    }

    // Calculate step completion rates
    const stepCompletionRates: Record<string, number> = {};
    Object.entries(stepCompletions).forEach(([stepId, counts]) => {
      stepCompletionRates[stepId] = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;
    });

    return {
      totalUsers: users.length,
      completedOnboarding: completedCount,
      inProgress: inProgressCount,
      notStarted: notStartedCount,
      averageCompletionTime: completionTimes.length > 0 
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length 
        : 0,
      stepCompletionRates
    };
  }

  /**
   * Get template by role
   */
  public getTemplateByRole(role: string): OnboardingTemplate | undefined {
    return this.templates.find(t => t.role === role);
  }

  /**
   * Get all templates
   */
  public getAllTemplates(): OnboardingTemplate[] {
    return this.templates;
  }
}