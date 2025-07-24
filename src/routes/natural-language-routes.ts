import express, { Request, Response } from 'express';
import { NaturalLanguageService } from '../services/natural-language-service';
import { TaskOrchestrator } from '../orchestration/task-orchestrator';
import { AgentRegistry } from '../agents/agent-registry';
import { authMiddleware } from '../middleware/auth-middleware';
import { tenantIsolationMiddleware } from '../middleware/tenant-isolation-middleware';
import { validateRequest } from '../middleware/validation-middleware';
import { body, query } from 'express-validator';
import winston from 'winston';

const router = express.Router();

// Services
let nlService: NaturalLanguageService;
let taskOrchestrator: TaskOrchestrator;
let logger: winston.Logger;

// Initialize services
export const initializeNaturalLanguageRoutes = (
  agentRegistry: AgentRegistry,
  orchestrator: TaskOrchestrator
) => {
  nlService = new NaturalLanguageService(agentRegistry);
  taskOrchestrator = orchestrator;
  
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({ format: winston.format.simple() }),
      new winston.transports.File({ filename: 'logs/natural-language-routes.log' })
    ]
  });
};

// Apply middleware
router.use(authMiddleware);
router.use(tenantIsolationMiddleware().isolate());

/**
 * @swagger
 * /api/nl/parse:
 *   post:
 *     summary: Parse natural language input
 *     tags: [Natural Language]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - input
 *             properties:
 *               input:
 *                 type: string
 *                 description: Natural language task description
 *                 example: "Create a React component for user profile with TypeScript by tomorrow"
 *               context:
 *                 type: object
 *                 description: Additional context for parsing
 *     responses:
 *       200:
 *         description: Parsed task information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 intent:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [create, update, query, analyze, execute]
 *                     taskType:
 *                       type: string
 *                     priority:
 *                       type: string
 *                     confidence:
 *                       type: number
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 clarificationNeeded:
 *                   type: boolean
 *                 clarificationQuestions:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.post('/parse',
  validateRequest([
    body('input').isString().trim().isLength({ min: 1, max: 1000 })
      .withMessage('Input must be between 1 and 1000 characters'),
    body('context').optional().isObject()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { input, context } = req.body;
      const organizationId = req.tenant?.organization.id;
      
      // Add organization context
      const enrichedContext = {
        ...context,
        organizationId,
        userId: req.user?.id
      };
      
      const parseResult = await nlService.parseNaturalLanguageInput(input, enrichedContext);
      
      // Enhance task with additional context
      if (parseResult.task) {
        parseResult.task = await nlService.enhanceTaskWithContext(parseResult.task);
      }
      
      res.json({
        success: true,
        ...parseResult
      });
    } catch (error) {
      logger.error('Error parsing natural language input:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to parse input'
      });
    }
  }
);

/**
 * @swagger
 * /api/nl/create-task:
 *   post:
 *     summary: Create task from natural language
 *     tags: [Natural Language]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - input
 *             properties:
 *               input:
 *                 type: string
 *                 description: Natural language task description
 *               execute:
 *                 type: boolean
 *                 description: Execute task immediately after creation
 *                 default: false
 *               confirmIntent:
 *                 type: boolean
 *                 description: Require confirmation before task creation
 *                 default: true
 *     responses:
 *       200:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *                 result:
 *                   type: object
 *                   description: Execution result if execute was true
 *                 parseResult:
 *                   type: object
 *                   description: Natural language parsing details
 */
router.post('/create-task',
  validateRequest([
    body('input').isString().trim().isLength({ min: 1, max: 1000 }),
    body('execute').optional().isBoolean(),
    body('confirmIntent').optional().isBoolean()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { input, execute = false, confirmIntent = true } = req.body;
      const organizationId = req.tenant?.organization.id;
      
      // Parse natural language input
      const parseResult = await nlService.parseNaturalLanguageInput(input, {
        organizationId,
        userId: req.user?.id
      });
      
      // Check if clarification is needed
      if (parseResult.clarificationNeeded && confirmIntent) {
        return res.json({
          success: false,
          needsClarification: true,
          clarificationQuestions: parseResult.clarificationQuestions,
          parseResult
        });
      }
      
      // Create task from parsed result
      const task = await taskOrchestrator.createTask({
        ...parseResult.task,
        organizationId,
        createdBy: req.user?.id,
        metadata: {
          source: 'natural-language',
          nlConfidence: parseResult.intent.confidence,
          requiresCollaboration: parseResult.intent.collaborationNeeded
        }
      });
      
      let result;
      if (execute) {
        // Execute task with suggested agent or collaboration
        result = await taskOrchestrator.executeTask(
          task.id, 
          parseResult.intent.collaborationNeeded || false
        );
      }
      
      res.json({
        success: true,
        task,
        result,
        parseResult
      });
    } catch (error) {
      logger.error('Error creating task from natural language:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create task'
      });
    }
  }
);

/**
 * @swagger
 * /api/nl/examples:
 *   get:
 *     summary: Get natural language examples
 *     tags: [Natural Language]
 *     parameters:
 *       - in: query
 *         name: taskType
 *         schema:
 *           type: string
 *           enum: [code-generation, data-analysis, documentation, testing, review, general]
 *         description: Filter examples by task type
 *     responses:
 *       200:
 *         description: List of example inputs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 examples:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       input:
 *                         type: string
 *                       taskType:
 *                         type: string
 *                       description:
 *                         type: string
 */
router.get('/examples',
  validateRequest([
    query('taskType').optional().isIn(['code-generation', 'data-analysis', 'documentation', 'testing', 'review', 'general'])
  ]),
  async (req: Request, res: Response) => {
    try {
      const { taskType } = req.query;
      
      const examples = nlService.getTaskExamples(taskType as any);
      
      // Format examples with additional metadata
      const formattedExamples = examples.map(example => ({
        input: example,
        taskType: taskType || 'auto-detect',
        description: `Example of ${taskType || 'natural language'} task input`
      }));
      
      res.json({
        success: true,
        examples: formattedExamples
      });
    } catch (error) {
      logger.error('Error getting examples:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get examples'
      });
    }
  }
);

/**
 * @swagger
 * /api/nl/suggest:
 *   post:
 *     summary: Get task suggestions based on partial input
 *     tags: [Natural Language]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partial
 *             properties:
 *               partial:
 *                 type: string
 *                 description: Partial natural language input
 *                 example: "Create a React"
 *     responses:
 *       200:
 *         description: Suggestions for completing the task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       completion:
 *                         type: string
 *                       taskType:
 *                         type: string
 *                       confidence:
 *                         type: number
 */
router.post('/suggest',
  validateRequest([
    body('partial').isString().trim().isLength({ min: 1, max: 500 })
  ]),
  async (req: Request, res: Response) => {
    try {
      const { partial } = req.body;
      
      // Get common completions based on partial input
      const suggestions = [];
      
      if (partial.toLowerCase().includes('create')) {
        suggestions.push(
          { completion: `${partial} component for user authentication`, taskType: 'code-generation', confidence: 0.9 },
          { completion: `${partial} REST API with Express`, taskType: 'code-generation', confidence: 0.8 },
          { completion: `${partial} unit tests for the service`, taskType: 'testing', confidence: 0.7 }
        );
      } else if (partial.toLowerCase().includes('analyze')) {
        suggestions.push(
          { completion: `${partial} the performance metrics from last week`, taskType: 'data-analysis', confidence: 0.9 },
          { completion: `${partial} user behavior patterns`, taskType: 'data-analysis', confidence: 0.8 },
          { completion: `${partial} code quality and suggest improvements`, taskType: 'review', confidence: 0.7 }
        );
      } else if (partial.toLowerCase().includes('fix')) {
        suggestions.push(
          { completion: `${partial} the authentication bug in login flow`, taskType: 'debugging', confidence: 0.9 },
          { completion: `${partial} the performance issues in the dashboard`, taskType: 'performance', confidence: 0.8 },
          { completion: `${partial} security vulnerabilities`, taskType: 'security', confidence: 0.7 }
        );
      } else {
        // Generic suggestions
        suggestions.push(
          { completion: `Create a ${partial || 'new feature'}`, taskType: 'code-generation', confidence: 0.6 },
          { completion: `Analyze ${partial || 'data'}`, taskType: 'data-analysis', confidence: 0.6 },
          { completion: `Document ${partial || 'the API'}`, taskType: 'documentation', confidence: 0.6 }
        );
      }
      
      res.json({
        success: true,
        suggestions: suggestions.slice(0, 5)
      });
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get suggestions'
      });
    }
  }
);

/**
 * @swagger
 * /api/nl/convert:
 *   post:
 *     summary: Convert task to natural language
 *     tags: [Natural Language]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - task
 *             properties:
 *               task:
 *                 $ref: '#/components/schemas/Task'
 *     responses:
 *       200:
 *         description: Natural language description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 description:
 *                   type: string
 *                 summary:
 *                   type: string
 */
router.post('/convert',
  validateRequest([
    body('task').isObject().withMessage('Task object is required')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { task } = req.body;
      
      const description = nlService.taskToNaturalLanguage(task);
      
      // Create a brief summary
      const summary = description.length > 100 
        ? description.substring(0, 97) + '...'
        : description;
      
      res.json({
        success: true,
        description,
        summary
      });
    } catch (error) {
      logger.error('Error converting task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to convert task'
      });
    }
  }
);

/**
 * @swagger
 * /api/nl/chat:
 *   post:
 *     summary: Interactive chat for task creation
 *     tags: [Natural Language]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message in conversation
 *               conversationId:
 *                 type: string
 *                 description: Conversation ID for context
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Chat response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 action:
 *                   type: string
 *                   enum: [clarify, confirm, create, none]
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.post('/chat',
  validateRequest([
    body('message').isString().trim().isLength({ min: 1, max: 1000 }),
    body('conversationId').optional().isString(),
    body('history').optional().isArray()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { message, conversationId, history = [] } = req.body;
      
      // Build context from conversation history
      const context = {
        conversationId: conversationId || `conv-${Date.now()}`,
        history,
        organizationId: req.tenant?.organization.id,
        userId: req.user?.id
      };
      
      // Parse the message
      const parseResult = await nlService.parseNaturalLanguageInput(message, context);
      
      let response = '';
      let action: 'clarify' | 'confirm' | 'create' | 'none' = 'none';
      let task = null;
      const suggestions: string[] = [];
      
      // Determine response based on parse result
      if (parseResult.clarificationNeeded) {
        response = parseResult.clarificationQuestions?.[0] || 'Can you provide more details about what you need?';
        action = 'clarify';
        suggestions.push(...(parseResult.suggestions || []));
      } else if (parseResult.intent.confidence < 0.7) {
        response = `I understand you want to ${parseResult.intent.taskType} something. Let me confirm: "${message}". Is this correct?`;
        action = 'confirm';
        task = parseResult.task;
      } else {
        // High confidence - create task
        response = `I'll create a ${parseResult.intent.taskType} task for you: "${parseResult.task.prompt}". `;
        
        if (parseResult.intent.suggestedAgent) {
          response += `I recommend using ${parseResult.intent.suggestedAgent} for this task. `;
        }
        
        if (parseResult.intent.collaborationNeeded) {
          response += 'This task will benefit from multi-agent collaboration. ';
        }
        
        response += 'Should I proceed?';
        action = 'create';
        task = await nlService.enhanceTaskWithContext(parseResult.task);
      }
      
      res.json({
        success: true,
        response,
        action,
        task,
        suggestions,
        conversationId: context.conversationId
      });
    } catch (error) {
      logger.error('Error in chat:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process message'
      });
    }
  }
);

export default router;