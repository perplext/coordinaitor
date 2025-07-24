import { Router, Request, Response } from 'express';
import { OnboardingService } from '../services/onboarding-service';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const onboardingService = new OnboardingService();

// Apply auth middleware to all onboarding routes
router.use(authMiddleware);

/**
 * Get user's onboarding progress
 */
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let progress = await onboardingService.getUserProgress(userId);
    
    // If no progress exists, start onboarding
    if (!progress) {
      const userRole = req.user?.role || 'developer';
      progress = await onboardingService.startOnboarding(userId, userRole);
    }

    res.json({ progress });
  } catch (error) {
    console.error('Failed to get onboarding progress:', error);
    res.status(500).json({ error: 'Failed to get onboarding progress' });
  }
});

/**
 * Get onboarding steps for the current user
 */
router.get('/steps', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const steps = await onboardingService.getUserSteps(userId);
    res.json({ steps });
  } catch (error) {
    console.error('Failed to get onboarding steps:', error);
    res.status(500).json({ error: 'Failed to get onboarding steps' });
  }
});

/**
 * Complete an onboarding step
 */
router.post('/steps/:stepId/complete', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { stepId } = req.params;
    const { data } = req.body;

    const progress = await onboardingService.completeStep(userId, stepId, data);
    res.json({ progress });
  } catch (error) {
    console.error('Failed to complete onboarding step:', error);
    res.status(500).json({ error: 'Failed to complete onboarding step' });
  }
});

/**
 * Skip an onboarding step
 */
router.post('/steps/:stepId/skip', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { stepId } = req.params;
    const progress = await onboardingService.skipStep(userId, stepId);
    res.json({ progress });
  } catch (error) {
    console.error('Failed to skip onboarding step:', error);
    res.status(500).json({ error: 'Failed to skip onboarding step' });
  }
});

/**
 * Reset onboarding progress
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await onboardingService.resetOnboarding(userId);
    res.json({ message: 'Onboarding reset successfully' });
  } catch (error) {
    console.error('Failed to reset onboarding:', error);
    res.status(500).json({ error: 'Failed to reset onboarding' });
  }
});

/**
 * Get onboarding statistics (admin only)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const stats = await onboardingService.getOnboardingStats(organizationId);
    res.json({ stats });
  } catch (error) {
    console.error('Failed to get onboarding stats:', error);
    res.status(500).json({ error: 'Failed to get onboarding stats' });
  }
});

export default router;