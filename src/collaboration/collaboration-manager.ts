import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentRequest, AgentResponse } from '../interfaces/agent.interface';
import { Task } from '../interfaces/task.interface';
import { AgentRegistry } from '../agents/agent-registry';
import { CommunicationHubImplementation } from '../communication/communication-hub';
import winston from 'winston';

export interface CollaborationSession {
  id: string;
  taskId: string;
  agents: string[];
  lead: string;
  status: 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed';
  context: CollaborationContext;
  plan: CollaborationPlan;
  results: CollaborationResult[];
  createdAt: Date;
  completedAt?: Date;
}

export interface CollaborationContext {
  task: Task;
  sharedMemory: Map<string, any>;
  dependencies: Map<string, string[]>;
  constraints: string[];
  objectives: string[];
}

export interface CollaborationPlan {
  steps: CollaborationStep[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
}

export interface CollaborationStep {
  id: string;
  name: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  inputs: Record<string, any>;
  expectedOutputs: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface CollaborationResult {
  stepId: string;
  agentId: string;
  output: any;
  duration: number;
  timestamp: Date;
}

export interface CollaborationStrategy {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'consensus';
  config: Record<string, any>;
}

export class CollaborationManager extends EventEmitter {
  private sessions: Map<string, CollaborationSession> = new Map();
  private logger: winston.Logger;

  constructor(
    private agentRegistry: AgentRegistry,
    private communicationHub: CommunicationHubImplementation
  ) {
    super();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.setupCommunicationHandlers();
  }

  private setupCommunicationHandlers(): void {
    // Listen for agent collaboration requests
    this.communicationHub.on('collaboration:request', (data) => {
      this.handleCollaborationRequest(data);
    });

    // Listen for collaboration updates
    this.communicationHub.on('collaboration:update', (data) => {
      this.handleCollaborationUpdate(data);
    });
  }

  public async createCollaborationSession(
    task: Task,
    strategy: CollaborationStrategy = { type: 'sequential', config: {} }
  ): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: uuidv4(),
      taskId: task.id,
      agents: [],
      lead: '',
      status: 'planning',
      context: {
        task,
        sharedMemory: new Map(),
        dependencies: new Map(),
        constraints: [],
        objectives: this.extractObjectives(task)
      },
      plan: {
        steps: [],
        dependencies: new Map(),
        estimatedDuration: 0
      },
      results: [],
      createdAt: new Date()
    };

    // Select agents for collaboration
    const selectedAgents = await this.selectAgentsForCollaboration(task, strategy);
    session.agents = selectedAgents.map(a => a.id);
    session.lead = this.selectLeadAgent(selectedAgents, task);

    // Create collaboration plan
    session.plan = await this.createCollaborationPlan(task, selectedAgents, strategy);

    this.sessions.set(session.id, session);
    this.logger.info(`Created collaboration session ${session.id} for task ${task.id}`);
    this.emit('session:created', session);

    return session;
  }

  public async executeCollaborationSession(sessionId: string): Promise<CollaborationResult[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Collaboration session not found');
    }

    session.status = 'executing';
    this.emit('session:started', session);

    try {
      const results = await this.executeCollaborationPlan(session);
      
      session.status = 'reviewing';
      const reviewedResults = await this.reviewResults(session, results);
      
      session.results = reviewedResults;
      session.status = 'completed';
      session.completedAt = new Date();
      
      this.logger.info(`Collaboration session ${sessionId} completed successfully`);
      this.emit('session:completed', session);
      
      return reviewedResults;
    } catch (error) {
      session.status = 'failed';
      this.logger.error(`Collaboration session ${sessionId} failed:`, error);
      this.emit('session:failed', { session, error });
      throw error;
    }
  }

  private async selectAgentsForCollaboration(
    task: Task,
    strategy: CollaborationStrategy
  ): Promise<Agent[]> {
    const agents: Agent[] = [];
    const requiredCapabilities = this.identifyRequiredCapabilities(task);

    for (const capability of requiredCapabilities) {
      const capableAgents = this.agentRegistry.getAgentsByCapability(capability);
      
      // Select best agent for each capability
      if (capableAgents.length > 0) {
        const scores = capableAgents.map(agent => ({
          agent,
          score: this.calculateAgentScore(agent, task, capability)
        }));
        
        scores.sort((a, b) => b.score - a.score);
        
        // Add top agent if not already selected
        const topAgent = scores[0].agent;
        if (!agents.find(a => a.id === topAgent.id)) {
          agents.push(topAgent);
        }
      }
    }

    // Ensure minimum number of agents based on strategy
    if (strategy.type === 'consensus' && agents.length < 3) {
      const additionalAgents = this.agentRegistry.getAvailableAgents()
        .filter(a => !agents.find(existing => existing.id === a.id))
        .slice(0, 3 - agents.length);
      agents.push(...additionalAgents);
    }

    return agents;
  }

  private selectLeadAgent(agents: Agent[], task: Task): string {
    // Select lead based on experience and capabilities
    let bestAgent = agents[0];
    let bestScore = 0;

    for (const agent of agents) {
      const score = this.calculateLeadershipScore(agent, task);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent.id;
  }

  private async createCollaborationPlan(
    task: Task,
    agents: Agent[],
    strategy: CollaborationStrategy
  ): Promise<CollaborationPlan> {
    const plan: CollaborationPlan = {
      steps: [],
      dependencies: new Map(),
      estimatedDuration: 0
    };

    switch (strategy.type) {
      case 'sequential':
        plan.steps = this.createSequentialPlan(task, agents);
        break;
      
      case 'parallel':
        plan.steps = this.createParallelPlan(task, agents);
        break;
      
      case 'hierarchical':
        plan.steps = this.createHierarchicalPlan(task, agents);
        break;
      
      case 'consensus':
        plan.steps = this.createConsensusPlan(task, agents);
        break;
    }

    // Calculate dependencies
    for (const step of plan.steps) {
      if (step.dependencies.length > 0) {
        plan.dependencies.set(step.id, step.dependencies);
      }
    }

    // Estimate duration
    plan.estimatedDuration = this.estimatePlanDuration(plan);

    return plan;
  }

  private createSequentialPlan(task: Task, agents: Agent[]): CollaborationStep[] {
    const steps: CollaborationStep[] = [];
    const taskPhases = this.identifyTaskPhases(task);

    let previousStepId: string | null = null;
    
    for (let i = 0; i < taskPhases.length; i++) {
      const phase = taskPhases[i];
      const agent = agents[i % agents.length];
      
      const step: CollaborationStep = {
        id: uuidv4(),
        name: phase.name,
        description: phase.description,
        assignedAgent: agent.id,
        dependencies: previousStepId ? [previousStepId] : [],
        inputs: {
          taskContext: task,
          phase: phase,
          previousResults: previousStepId ? `{{${previousStepId}.output}}` : null
        },
        expectedOutputs: phase.outputs,
        status: 'pending'
      };
      
      steps.push(step);
      previousStepId = step.id;
    }

    return steps;
  }

  private createParallelPlan(task: Task, agents: Agent[]): CollaborationStep[] {
    const steps: CollaborationStep[] = [];
    const subtasks = this.decomposeTaskForParallel(task);

    // Create parallel execution steps
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      const agent = agents[i % agents.length];
      
      steps.push({
        id: uuidv4(),
        name: `Parallel: ${subtask.name}`,
        description: subtask.description,
        assignedAgent: agent.id,
        dependencies: [],
        inputs: {
          taskContext: task,
          subtask: subtask
        },
        expectedOutputs: subtask.outputs,
        status: 'pending'
      });
    }

    // Add aggregation step
    const leadAgent = agents.find(a => a.id === agents[0].id)!;
    steps.push({
      id: uuidv4(),
      name: 'Aggregate Results',
      description: 'Combine and synthesize parallel execution results',
      assignedAgent: leadAgent.id,
      dependencies: steps.map(s => s.id),
      inputs: {
        parallelResults: steps.map(s => `{{${s.id}.output}}`)
      },
      expectedOutputs: ['aggregated_result', 'synthesis'],
      status: 'pending'
    });

    return steps;
  }

  private createHierarchicalPlan(task: Task, agents: Agent[]): CollaborationStep[] {
    const steps: CollaborationStep[] = [];
    
    // Lead agent creates high-level plan
    const leadAgent = agents[0];
    const planningStep: CollaborationStep = {
      id: uuidv4(),
      name: 'Create Execution Plan',
      description: 'Lead agent creates detailed execution plan',
      assignedAgent: leadAgent.id,
      dependencies: [],
      inputs: { task },
      expectedOutputs: ['execution_plan', 'task_assignments'],
      status: 'pending'
    };
    steps.push(planningStep);

    // Worker agents execute assigned tasks
    for (let i = 1; i < agents.length; i++) {
      const workerStep: CollaborationStep = {
        id: uuidv4(),
        name: `Execute Assigned Tasks - Worker ${i}`,
        description: 'Execute tasks assigned by lead agent',
        assignedAgent: agents[i].id,
        dependencies: [planningStep.id],
        inputs: {
          assignments: `{{${planningStep.id}.task_assignments[${i-1}]}}`
        },
        expectedOutputs: ['task_results'],
        status: 'pending'
      };
      steps.push(workerStep);
    }

    // Lead agent reviews and integrates
    const reviewStep: CollaborationStep = {
      id: uuidv4(),
      name: 'Review and Integrate',
      description: 'Lead agent reviews and integrates all results',
      assignedAgent: leadAgent.id,
      dependencies: steps.slice(1).map(s => s.id),
      inputs: {
        workerResults: steps.slice(1).map(s => `{{${s.id}.output}}`)
      },
      expectedOutputs: ['final_result', 'quality_report'],
      status: 'pending'
    };
    steps.push(reviewStep);

    return steps;
  }

  private createConsensusPlan(task: Task, agents: Agent[]): CollaborationStep[] {
    const steps: CollaborationStep[] = [];
    
    // Each agent independently analyzes the task
    const analysisSteps = agents.map(agent => ({
      id: uuidv4(),
      name: `Independent Analysis - ${agent.name}`,
      description: 'Analyze task and propose solution',
      assignedAgent: agent.id,
      dependencies: [],
      inputs: { task },
      expectedOutputs: ['analysis', 'proposed_solution'],
      status: 'pending' as const
    }));
    steps.push(...analysisSteps);

    // Consensus building step
    const consensusStep: CollaborationStep = {
      id: uuidv4(),
      name: 'Build Consensus',
      description: 'Agents discuss and reach consensus on approach',
      assignedAgent: agents[0].id, // Lead facilitates
      dependencies: analysisSteps.map(s => s.id),
      inputs: {
        proposals: analysisSteps.map(s => `{{${s.id}.proposed_solution}}`)
      },
      expectedOutputs: ['consensus_approach', 'dissenting_opinions'],
      status: 'pending'
    };
    steps.push(consensusStep);

    // Execute consensus approach
    const executionStep: CollaborationStep = {
      id: uuidv4(),
      name: 'Execute Consensus Approach',
      description: 'Implement the agreed-upon solution',
      assignedAgent: agents[1].id, // Different agent executes
      dependencies: [consensusStep.id],
      inputs: {
        approach: `{{${consensusStep.id}.consensus_approach}}`
      },
      expectedOutputs: ['implementation', 'results'],
      status: 'pending'
    };
    steps.push(executionStep);

    return steps;
  }

  private async executeCollaborationPlan(session: CollaborationSession): Promise<CollaborationResult[]> {
    const results: CollaborationResult[] = [];
    const { plan } = session;

    // Execute steps based on dependencies
    const executed = new Set<string>();
    
    while (executed.size < plan.steps.length) {
      const readySteps = plan.steps.filter(step => 
        !executed.has(step.id) &&
        step.dependencies.every(dep => executed.has(dep))
      );

      if (readySteps.length === 0) {
        throw new Error('Circular dependency detected in collaboration plan');
      }

      // Execute ready steps in parallel
      const stepResults = await Promise.all(
        readySteps.map(step => this.executeCollaborationStep(session, step))
      );

      for (const result of stepResults) {
        results.push(result);
        executed.add(result.stepId);
      }
    }

    return results;
  }

  private async executeCollaborationStep(
    session: CollaborationSession,
    step: CollaborationStep
  ): Promise<CollaborationResult> {
    const agent = this.agentRegistry.getAgent(step.assignedAgent);
    if (!agent) {
      throw new Error(`Agent ${step.assignedAgent} not found`);
    }

    step.status = 'in_progress';
    this.emit('step:started', { session, step });

    const startTime = Date.now();

    try {
      // Resolve input references
      const resolvedInputs = this.resolveInputReferences(step.inputs, session);

      // Create agent request
      const request: AgentRequest = {
        taskId: session.taskId,
        prompt: this.createStepPrompt(step, resolvedInputs),
        context: {
          collaborationSession: session.id,
          step: step,
          inputs: resolvedInputs,
          sharedMemory: Object.fromEntries(session.context.sharedMemory)
        },
        priority: session.context.task.priority
      };

      // Execute via agent
      const response = await agent.execute(request);

      if (!response.success) {
        throw new Error(response.error || 'Agent execution failed');
      }

      step.status = 'completed';
      step.result = response.result;

      // Update shared memory
      if (response.result && typeof response.result === 'object') {
        for (const output of step.expectedOutputs) {
          if (response.result[output]) {
            session.context.sharedMemory.set(
              `${step.id}.${output}`,
              response.result[output]
            );
          }
        }
      }

      const result: CollaborationResult = {
        stepId: step.id,
        agentId: agent.id,
        output: response.result,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      this.emit('step:completed', { session, step, result });
      return result;

    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('step:failed', { session, step, error });
      throw error;
    }
  }

  private async reviewResults(
    session: CollaborationSession,
    results: CollaborationResult[]
  ): Promise<CollaborationResult[]> {
    // Lead agent reviews all results
    const leadAgent = this.agentRegistry.getAgent(session.lead);
    if (!leadAgent) {
      return results; // Skip review if lead not available
    }

    const reviewRequest: AgentRequest = {
      taskId: session.taskId,
      prompt: `Review the collaboration results for task: ${session.context.task.description}
      
Objectives:
${session.context.objectives.map(o => `- ${o}`).join('\n')}

Results from collaboration:
${JSON.stringify(results, null, 2)}

Please:
1. Verify all objectives have been met
2. Check for consistency across results
3. Identify any issues or improvements
4. Provide a final synthesized result`,
      context: {
        session,
        results
      },
      priority: 'high'
    };

    const reviewResponse = await leadAgent.execute(reviewRequest);
    
    if (reviewResponse.success && reviewResponse.result.approved) {
      this.logger.info(`Collaboration results approved for session ${session.id}`);
      return results;
    } else {
      // Handle review feedback
      this.logger.warn(`Collaboration results require revision for session ${session.id}`);
      // Could implement revision logic here
      return results;
    }
  }

  private identifyRequiredCapabilities(task: Task): string[] {
    const capabilities: string[] = [];
    
    // Analyze task type
    switch (task.type) {
      case 'implementation':
        capabilities.push('code_generation', 'debugging', 'testing');
        break;
      case 'design':
        capabilities.push('system_design', 'architecture', 'ui_design');
        break;
      case 'requirement':
        capabilities.push('analysis', 'documentation', 'planning');
        break;
      case 'test':
        capabilities.push('testing', 'qa', 'automation');
        break;
      case 'deployment':
        capabilities.push('devops', 'ci_cd', 'infrastructure');
        break;
    }

    // Analyze task description for additional capabilities
    const description = task.description.toLowerCase();
    if (description.includes('api')) capabilities.push('api_design');
    if (description.includes('database')) capabilities.push('database_design');
    if (description.includes('security')) capabilities.push('security');
    if (description.includes('performance')) capabilities.push('optimization');
    if (description.includes('ui') || description.includes('frontend')) capabilities.push('frontend');
    if (description.includes('backend')) capabilities.push('backend');

    return [...new Set(capabilities)];
  }

  private calculateAgentScore(agent: Agent, task: Task, capability: string): number {
    let score = 0;
    
    // Check if agent has the capability
    const hasCapability = agent.capabilities.some(c => 
      c.name === capability || c.category === task.type
    );
    if (hasCapability) score += 50;

    // Consider agent performance
    score += agent.status.successRate * 0.3;
    
    // Consider agent availability
    if (agent.status.state === 'idle') score += 20;
    
    // Consider response time
    const avgResponseTime = agent.status.averageResponseTime;
    if (avgResponseTime < 5000) score += 10;
    else if (avgResponseTime < 10000) score += 5;

    return score;
  }

  private calculateLeadershipScore(agent: Agent, task: Task): number {
    let score = 0;
    
    // Experience (completed tasks)
    score += Math.min(agent.status.totalTasksCompleted * 0.1, 30);
    
    // Success rate
    score += agent.status.successRate * 0.4;
    
    // Has planning/coordination capabilities
    const hasLeadershipCaps = agent.capabilities.some(c => 
      ['planning', 'coordination', 'analysis'].includes(c.name)
    );
    if (hasLeadershipCaps) score += 30;

    return score;
  }

  private extractObjectives(task: Task): string[] {
    const objectives: string[] = [];
    
    // Primary objective from task
    objectives.push(`Complete ${task.type}: ${task.title}`);
    
    // Extract from description
    const descriptionLines = task.description.split('\n');
    descriptionLines.forEach(line => {
      if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
        objectives.push(line.replace(/^[-*\d.]\s+/, '').trim());
      }
    });

    // Add quality objectives
    objectives.push('Ensure high quality and maintainability');
    objectives.push('Follow best practices and standards');
    
    return objectives;
  }

  private identifyTaskPhases(task: Task): Array<{
    name: string;
    description: string;
    outputs: string[];
  }> {
    const phases = [];
    
    // Standard phases based on task type
    switch (task.type) {
      case 'implementation':
        phases.push(
          { name: 'Analysis', description: 'Analyze requirements and approach', outputs: ['analysis', 'approach'] },
          { name: 'Design', description: 'Design solution architecture', outputs: ['design', 'interfaces'] },
          { name: 'Implementation', description: 'Implement the solution', outputs: ['code', 'documentation'] },
          { name: 'Testing', description: 'Test the implementation', outputs: ['tests', 'test_results'] }
        );
        break;
      
      case 'design':
        phases.push(
          { name: 'Research', description: 'Research requirements and constraints', outputs: ['research', 'constraints'] },
          { name: 'Conceptualization', description: 'Create design concepts', outputs: ['concepts', 'alternatives'] },
          { name: 'Refinement', description: 'Refine and finalize design', outputs: ['final_design', 'specifications'] }
        );
        break;
      
      default:
        phases.push(
          { name: 'Planning', description: 'Plan approach', outputs: ['plan'] },
          { name: 'Execution', description: 'Execute the task', outputs: ['result'] },
          { name: 'Validation', description: 'Validate results', outputs: ['validation'] }
        );
    }
    
    return phases;
  }

  private decomposeTaskForParallel(task: Task): Array<{
    name: string;
    description: string;
    outputs: string[];
  }> {
    // Simple decomposition - in practice, this would be more sophisticated
    const subtasks = [];
    
    // Look for enumerated items in description
    const lines = task.description.split('\n');
    let currentSubtask = null;
    
    for (const line of lines) {
      if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
        if (currentSubtask) {
          subtasks.push(currentSubtask);
        }
        currentSubtask = {
          name: line.replace(/^[-*\d.]\s+/, '').trim(),
          description: line,
          outputs: ['result']
        };
      } else if (currentSubtask && line.trim()) {
        currentSubtask.description += '\n' + line;
      }
    }
    
    if (currentSubtask) {
      subtasks.push(currentSubtask);
    }
    
    // If no subtasks found, create generic ones
    if (subtasks.length === 0) {
      subtasks.push(
        { name: 'Component A', description: 'Handle first part of the task', outputs: ['component_a_result'] },
        { name: 'Component B', description: 'Handle second part of the task', outputs: ['component_b_result'] }
      );
    }
    
    return subtasks;
  }

  private estimatePlanDuration(plan: CollaborationPlan): number {
    // Simple estimation - sum of sequential steps, max of parallel
    let totalDuration = 0;
    const processed = new Set<string>();
    
    // Process in dependency order
    while (processed.size < plan.steps.length) {
      const readySteps = plan.steps.filter(step =>
        !processed.has(step.id) &&
        step.dependencies.every(dep => processed.has(dep))
      );
      
      if (readySteps.length === 0) break;
      
      // Parallel steps take the max duration
      const stepDuration = Math.max(...readySteps.map(() => 30000)); // 30s per step estimate
      totalDuration += stepDuration;
      
      readySteps.forEach(step => processed.add(step.id));
    }
    
    return totalDuration;
  }

  private resolveInputReferences(inputs: Record<string, any>, session: CollaborationSession): Record<string, any> {
    const resolved: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && value.match(/\{\{(.+?)\}\}/)) {
        // Resolve reference from shared memory
        const ref = value.match(/\{\{(.+?)\}\}/)?.[1];
        if (ref && session.context.sharedMemory.has(ref)) {
          resolved[key] = session.context.sharedMemory.get(ref);
        } else {
          resolved[key] = value; // Keep original if not found
        }
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  private createStepPrompt(step: CollaborationStep, inputs: Record<string, any>): string {
    return `${step.description}

Step: ${step.name}

Inputs:
${JSON.stringify(inputs, null, 2)}

Expected outputs:
${step.expectedOutputs.map(o => `- ${o}`).join('\n')}

Please complete this step and provide the expected outputs in your response.`;
  }

  private handleCollaborationRequest(data: any): void {
    // Handle incoming collaboration requests from agents
    this.logger.info('Received collaboration request:', data);
  }

  private handleCollaborationUpdate(data: any): void {
    // Handle collaboration updates from agents
    this.logger.info('Received collaboration update:', data);
  }

  public getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }
}