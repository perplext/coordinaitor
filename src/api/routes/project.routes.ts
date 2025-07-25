import { Router, Request, Response } from 'express';
import { TaskOrchestrator } from '../../orchestration/task-orchestrator';
import { authenticate, authorize } from '../../middleware/auth';
import { AuthRequest } from '../../interfaces/auth.interface';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { PRDDecompositionService } from '../../services/prd-decomposition-service';

const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    prd: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })
});

const refineDecompositionSchema = z.object({
  body: z.object({
    tasksToAdd: z.array(z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(['requirement', 'design', 'implementation', 'test', 'deployment', 'review']),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      estimatedHours: z.number().optional(),
      skills: z.array(z.string()).optional(),
      dependencies: z.array(z.string()).optional()
    })).optional(),
    tasksToRemove: z.array(z.string()).optional(),
    dependenciesToAdd: z.array(z.object({
      from: z.string(),
      to: z.string()
    })).optional(),
    dependenciesToRemove: z.array(z.object({
      from: z.string(),
      to: z.string()
    })).optional()
  })
});

export function createProjectRoutes(
  taskOrchestrator: TaskOrchestrator,
  prdDecompositionService: PRDDecompositionService
): Router {
  const router = Router();

  // Get all projects
  router.get('/', authenticate, authorize(['projects:read']), async (req: Request, res: Response) => {
    try {
      const projects = taskOrchestrator.getAllProjects();
      res.json({ projects });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get project by ID
  router.get('/:id', authenticate, authorize(['projects:read']), async (req: Request, res: Response) => {
    try {
      const project = taskOrchestrator.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create new project
  router.post('/', authenticate, authorize(['projects:create']), validateRequest(createProjectSchema), async (req: Request, res: Response) => {
    try {
      const project = taskOrchestrator.createProject(req.body);
      res.status(201).json({ project });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Decompose project PRD
  router.post('/:id/decompose', authenticate, authorize(['projects:update']), async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const project = taskOrchestrator.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Perform decomposition
      const tasks = await taskOrchestrator.decomposeProject(projectId);
      
      // Get updated project with decomposition results
      const updatedProject = taskOrchestrator.getProject(projectId);
      
      res.json({
        project: updatedProject,
        tasks,
        summary: {
          totalTasks: tasks.length,
          estimatedDuration: updatedProject?.metadata?.estimatedDuration,
          riskFactors: updatedProject?.metadata?.riskFactors,
          requirementsCount: updatedProject?.requirements?.length || 0,
          milestonesCount: updatedProject?.milestones?.length || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get project tasks
  router.get('/:id/tasks', authenticate, authorize(['projects:read']), async (req: Request, res: Response) => {
    try {
      const tasks = taskOrchestrator.getTasksByProject(req.params.id);
      res.json({ tasks });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get project requirements
  router.get('/:id/requirements', authenticate, authorize(['projects:read']), async (req: Request, res: Response) => {
    try {
      const project = taskOrchestrator.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ requirements: project.requirements || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get project milestones
  router.get('/:id/milestones', authenticate, authorize(['projects:read']), async (req: Request, res: Response) => {
    try {
      const project = taskOrchestrator.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ milestones: project.milestones || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Preview PRD decomposition (without saving)
  router.post('/:id/decompose/preview', authenticate, authorize(['projects:read']), async (req: Request, res: Response) => {
    try {
      const project = taskOrchestrator.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Perform decomposition without saving
      const decompositionResult = await prdDecompositionService.decomposePRD(project);
      
      res.json({
        preview: {
          requirements: decompositionResult.requirements,
          tasks: decompositionResult.tasks,
          milestones: decompositionResult.milestones,
          estimatedDuration: decompositionResult.estimatedDuration,
          riskFactors: decompositionResult.riskFactors,
          tasksByType: decompositionResult.tasks.reduce((acc, task) => {
            acc[task.type] = (acc[task.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          tasksByPriority: decompositionResult.tasks.reduce((acc, task) => {
            acc[task.priority] = (acc[task.priority] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Refine project decomposition
  router.post('/:id/decompose/refine', authenticate, authorize(['projects:update']), validateRequest(refineDecompositionSchema), async (req: Request, res: Response) => {
    try {
      const project = taskOrchestrator.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Build current decomposition result
      const currentResult = {
        requirements: project.requirements || [],
        tasks: project.tasks || [],
        milestones: project.milestones || [],
        dependencies: new Map<string, string[]>(),
        estimatedDuration: project.metadata?.estimatedDuration || 0,
        riskFactors: project.metadata?.riskFactors || []
      };

      // Build dependencies map
      project.tasks.forEach(task => {
        if (task.dependencies && task.dependencies.length > 0) {
          currentResult.dependencies.set(task.id, task.dependencies);
        }
      });

      // Apply refinements
      const refinedResult = await prdDecompositionService.refineDecomposition(
        currentResult,
        req.body
      );

      // Update project with refined results
      project.requirements = refinedResult.requirements;
      project.tasks = refinedResult.tasks;
      project.milestones = refinedResult.milestones;
      project.metadata = {
        ...project.metadata,
        estimatedDuration: refinedResult.estimatedDuration,
        riskFactors: refinedResult.riskFactors,
        lastRefinedAt: new Date()
      };
      project.updatedAt = new Date();

      // Update tasks in orchestrator
      refinedResult.tasks.forEach(task => {
        taskOrchestrator.updateTask(task.id, task);
      });

      res.json({
        project,
        refinedTasks: refinedResult.tasks,
        summary: {
          totalTasks: refinedResult.tasks.length,
          estimatedDuration: refinedResult.estimatedDuration,
          tasksAdded: req.body.tasksToAdd?.length || 0,
          tasksRemoved: req.body.tasksToRemove?.length || 0,
          dependenciesAdded: req.body.dependenciesToAdd?.length || 0,
          dependenciesRemoved: req.body.dependenciesToRemove?.length || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete project
  router.delete('/:id', authenticate, authorize(['projects:delete']), async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const project = taskOrchestrator.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Delete all project tasks
      const tasks = taskOrchestrator.getTasksByProject(projectId);
      tasks.forEach(task => {
        taskOrchestrator.deleteTask(task.id);
      });

      // Delete project
      taskOrchestrator.deleteProject(projectId);
      
      res.json({ 
        message: 'Project deleted successfully',
        deletedTasks: tasks.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}