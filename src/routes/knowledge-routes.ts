import { Router, Request, Response } from 'express';
import { KnowledgeService, KnowledgeSearchQuery } from '../services/knowledge-service';
import { createAuthMiddleware } from '../middleware/auth-middleware';
import { AuthService } from '../services/auth-service';

export function createKnowledgeRoutes(
  knowledgeService: KnowledgeService,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Search knowledge entries
  router.get('/search', 
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const query: KnowledgeSearchQuery = {
          query: req.query.q as string,
          type: req.query.type as any,
          tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
          language: req.query.language as string,
          framework: req.query.framework as string,
          category: req.query.category as string,
          difficulty: req.query.difficulty as string,
          taskId: req.query.taskId as string,
          projectId: req.query.projectId as string,
          agentId: req.query.agentId as string,
          createdBy: req.query.createdBy as string,
          isPublic: req.query.isPublic === 'true',
          limit: parseInt(req.query.limit as string) || 50,
          offset: parseInt(req.query.offset as string) || 0,
          sortBy: req.query.sortBy as any,
          sortOrder: req.query.sortOrder as any
        };

        // Filter out undefined values
        Object.keys(query).forEach(key => {
          if ((query as any)[key] === undefined) {
            delete (query as any)[key];
          }
        });

        // Non-admin users can only see public entries or their own
        if (!authService.hasRole(req.user!, 'admin')) {
          query.isPublic = true;
          // Add user's own entries
          const userEntries = await knowledgeService.search({
            ...query,
            createdBy: req.user!.userId,
            isPublic: undefined
          });
          const publicEntries = await knowledgeService.search(query);
          
          // Merge and deduplicate
          const allEntries = [...publicEntries, ...userEntries];
          const uniqueEntries = Array.from(
            new Map(allEntries.map(e => [e.id, e])).values()
          );
          
          return res.json({ entries: uniqueEntries });
        }

        const entries = await knowledgeService.search(query);
        res.json({ entries });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Get knowledge stats
  router.get('/stats',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const stats = await knowledgeService.getStats();
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Create knowledge entry
  router.post('/',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const { title, content, type, metadata, tags, isPublic } = req.body;
        
        if (!title || !content || !type) {
          return res.status(400).json({ 
            error: 'Title, content, and type are required' 
          });
        }

        const entry = await knowledgeService.createEntry(
          title,
          content,
          type,
          req.user!.userId,
          metadata,
          tags,
          isPublic !== false // Default to public
        );

        res.json({ entry });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Get specific entry
  router.get('/:id',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const entries = await knowledgeService.search({ 
          query: req.params.id 
        });
        
        const entry = entries.find(e => e.id === req.params.id);
        
        if (!entry) {
          return res.status(404).json({ error: 'Entry not found' });
        }

        // Check access permissions
        if (!entry.isPublic && 
            entry.createdBy !== req.user!.userId && 
            !authService.hasRole(req.user!, 'admin')) {
          return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ entry });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Update knowledge entry
  router.put('/:id',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const entry = await knowledgeService.updateEntry(
          req.params.id,
          req.body,
          req.user!.userId
        );

        if (!entry) {
          return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ entry });
      } catch (error: any) {
        res.status(error.message.includes('Unauthorized') ? 403 : 500)
          .json({ error: error.message });
      }
    }
  );

  // Delete knowledge entry
  router.delete('/:id',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const success = await knowledgeService.deleteEntry(
          req.params.id,
          req.user!.userId
        );

        if (!success) {
          return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ success: true });
      } catch (error: any) {
        res.status(error.message.includes('Unauthorized') ? 403 : 500)
          .json({ error: error.message });
      }
    }
  );

  // Vote on entry
  router.post('/:id/vote',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const { value } = req.body;
        
        if (value !== 1 && value !== -1) {
          return res.status(400).json({ error: 'Vote value must be 1 or -1' });
        }

        await knowledgeService.vote(req.params.id, req.user!.userId, value);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Get related entries
  router.get('/:id/related',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 5;
        const related = await knowledgeService.getRelatedEntries(
          req.params.id,
          limit
        );
        
        // Filter based on access permissions
        const accessible = related.filter(entry => 
          entry.isPublic || 
          entry.createdBy === req.user!.userId ||
          authService.hasRole(req.user!, 'admin')
        );

        res.json({ entries: accessible });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Export knowledge
  router.get('/export/:format',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('knowledge:export'),
    async (req: Request, res: Response) => {
      try {
        const format = req.params.format as 'json' | 'markdown';
        
        if (format !== 'json' && format !== 'markdown') {
          return res.status(400).json({ error: 'Format must be json or markdown' });
        }

        const data = await knowledgeService.exportKnowledge(format);
        
        res.setHeader('Content-Type', 
          format === 'json' ? 'application/json' : 'text/markdown'
        );
        res.setHeader('Content-Disposition', 
          `attachment; filename="knowledge-export.${format === 'json' ? 'json' : 'md'}"`
        );
        
        res.send(data);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  return router;
}