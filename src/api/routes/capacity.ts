import express, { Request, Response } from 'express';
import { TaskOrchestrator } from '../../orchestration/task-orchestrator';
import { z } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Validation schemas
const updateCapacitySchema = z.object({
  maxConcurrentTasks: z.number().int().positive().max(100)
});

export function createCapacityRoutes(orchestrator: TaskOrchestrator) {
  const router = express.Router();

  /**
   * Get capacity metrics for all agents
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = orchestrator.getCapacityMetrics();
      res.json({ 
        success: true, 
        metrics 
      });
    } catch (error: any) {
      logger.error('Failed to get capacity metrics:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get capacity metrics' 
      });
    }
  });

  /**
   * Get capacity info for a specific agent
   */
  router.get('/agents/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const capacity = orchestrator.getAgentCapacity(agentId);
      
      if (!capacity) {
        return res.status(404).json({ 
          success: false, 
          error: 'Agent not found' 
        });
      }

      res.json({ 
        success: true, 
        capacity 
      });
    } catch (error: any) {
      logger.error('Failed to get agent capacity:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get agent capacity' 
      });
    }
  });

  /**
   * Update an agent's max concurrent tasks
   */
  router.put('/agents/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const validatedBody = updateCapacitySchema.parse(req.body);
      
      orchestrator.updateAgentCapacity(agentId, validatedBody.maxConcurrentTasks);
      
      res.json({ 
        success: true, 
        message: 'Agent capacity updated successfully' 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid request data', 
          details: error.errors 
        });
      }
      
      logger.error('Failed to update agent capacity:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to update agent capacity' 
      });
    }
  });

  /**
   * Get load balancing recommendations
   */
  router.get('/recommendations', async (req: Request, res: Response) => {
    try {
      const recommendations = orchestrator.getLoadBalancingRecommendations();
      res.json({ 
        success: true, 
        recommendations 
      });
    } catch (error: any) {
      logger.error('Failed to get recommendations:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get recommendations' 
      });
    }
  });

  /**
   * Trigger manual task rebalancing
   */
  router.post('/rebalance', async (req: Request, res: Response) => {
    try {
      await orchestrator.rebalanceTasks();
      res.json({ 
        success: true, 
        message: 'Task rebalancing initiated' 
      });
    } catch (error: any) {
      logger.error('Failed to rebalance tasks:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to rebalance tasks' 
      });
    }
  });

  return router;
}