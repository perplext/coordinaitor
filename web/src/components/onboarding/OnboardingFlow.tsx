import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  NavigateNext,
  NavigateBefore,
  Check,
  Close,
  Skip,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

// Import step components
import { WelcomeStep } from './steps/WelcomeStep';
import { ProfileSetupStep } from './steps/ProfileSetupStep';
import { CreateProjectStep } from './steps/CreateProjectStep';
import { CreateTaskStep } from './steps/CreateTaskStep';
import { ExploreAgentsStep } from './steps/ExploreAgentsStep';
import { CollaborationStep } from './steps/CollaborationStep';
import { IntegrationsStep } from './steps/IntegrationsStep';
import { TeamSetupStep } from './steps/TeamSetupStep';
import { AnalyticsTourStep } from './steps/AnalyticsTourStep';
import { ApprovalWorkflowStep } from './steps/ApprovalWorkflowStep';
import { SystemConfigStep } from './steps/SystemConfigStep';
import { UserManagementStep } from './steps/UserManagementStep';
import { MonitoringStep } from './steps/MonitoringStep';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string;
  completed: boolean;
  required: boolean;
  order: number;
  metadata?: Record<string, any>;
}

interface OnboardingProgress {
  userId: string;
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, any>;
}

const stepComponents: Record<string, React.ComponentType<any>> = {
  WelcomeStep,
  ProfileSetupStep,
  CreateProjectStep,
  CreateTaskStep,
  ExploreAgentsStep,
  CollaborationStep,
  IntegrationsStep,
  TeamSetupStep,
  AnalyticsTourStep,
  ApprovalWorkflowStep,
  SystemConfigStep,
  UserManagementStep,
  MonitoringStep,
};

export const OnboardingFlow: React.FC = () => {
  const { user } = useAuthStore();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);

  useEffect(() => {
    loadOnboardingData();
  }, []);

  const loadOnboardingData = async () => {
    try {
      setLoading(true);
      
      // Get user progress
      const progressRes = await api.get('/onboarding/progress');
      setProgress(progressRes.data.progress);
      
      // Get steps
      const stepsRes = await api.get('/onboarding/steps');
      setSteps(stepsRes.data.steps);
      
      // Find current step index
      const index = stepsRes.data.steps.findIndex(
        (s: OnboardingStep) => s.id === progressRes.data.progress.currentStep
      );
      setCurrentStepIndex(index >= 0 ? index : 0);
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
      toast.error('Failed to load onboarding data');
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = async (data?: any) => {
    if (!progress || !steps[currentStepIndex]) return;

    try {
      const currentStep = steps[currentStepIndex];
      await api.post(`/onboarding/steps/${currentStep.id}/complete`, { data });
      
      // Update local state
      const updatedSteps = [...steps];
      updatedSteps[currentStepIndex].completed = true;
      setSteps(updatedSteps);
      
      // Move to next step
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        // Onboarding completed
        toast.success('Onboarding completed!');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
      toast.error('Failed to complete step');
    }
  };

  const handleSkipStep = async () => {
    if (!progress || !steps[currentStepIndex]) return;

    const currentStep = steps[currentStepIndex];
    if (currentStep.required) {
      toast.error('This step is required and cannot be skipped');
      return;
    }

    try {
      await api.post(`/onboarding/steps/${currentStep.id}/skip`);
      
      // Move to next step
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } catch (error) {
      console.error('Failed to skip step:', error);
      toast.error('Failed to skip step');
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleExit = () => {
    setShowExitDialog(true);
  };

  const confirmExit = () => {
    window.location.href = '/dashboard';
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loading onboarding...
            </Typography>
            <LinearProgress />
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!progress || steps.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Typography>No onboarding data available</Typography>
      </Box>
    );
  }

  const currentStep = steps[currentStepIndex];
  const StepComponent = currentStep ? stepComponents[currentStep.component] : null;
  const progressPercentage = (steps.filter(s => s.completed).length / steps.length) * 100;

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      {/* Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          px: 3,
          py: 2,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">
            Getting Started with CoordinAItor
          </Typography>
          <IconButton onClick={handleExit}>
            <Close />
          </IconButton>
        </Box>
        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Progress: {Math.round(progressPercentage)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Step {currentStepIndex + 1} of {steps.length}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progressPercentage} />
        </Box>
      </Box>

      {/* Main Content */}
      <Box display="flex" sx={{ height: 'calc(100vh - 120px)' }}>
        {/* Sidebar - Step List */}
        <Box
          sx={{
            width: 300,
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            overflowY: 'auto',
          }}
        >
          <Stepper activeStep={currentStepIndex} orientation="vertical" sx={{ p: 3 }}>
            {steps.map((step, index) => (
              <Step key={step.id} completed={step.completed}>
                <StepLabel
                  optional={
                    !step.required && (
                      <Typography variant="caption">Optional</Typography>
                    )
                  }
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: step.completed
                          ? 'success.main'
                          : index === currentStepIndex
                          ? 'primary.main'
                          : 'grey.300',
                        color: 'white',
                      }}
                    >
                      {step.completed ? (
                        <Check />
                      ) : (
                        <Typography>{index + 1}</Typography>
                      )}
                    </Box>
                  )}
                >
                  <Typography
                    variant="subtitle1"
                    color={index === currentStepIndex ? 'primary' : 'text.primary'}
                  >
                    {step.title}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Step Content */}
        <Box flex={1} p={4} overflowY="auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {StepComponent ? (
                <StepComponent
                  onComplete={handleStepComplete}
                  onSkip={handleSkipStep}
                  metadata={currentStep.metadata}
                />
              ) : (
                <Typography>Step component not found</Typography>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mt={4}
            pt={4}
            borderTop={1}
            borderColor="divider"
          >
            <Button
              startIcon={<NavigateBefore />}
              onClick={handlePreviousStep}
              disabled={currentStepIndex === 0}
            >
              Previous
            </Button>

            <Box display="flex" gap={2}>
              {!currentStep.required && (
                <Button
                  variant="outlined"
                  startIcon={<Skip />}
                  onClick={handleSkipStep}
                >
                  Skip
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onClose={() => setShowExitDialog(false)}>
        <DialogTitle>Exit Onboarding?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to exit the onboarding process? You can always
            resume later from where you left off.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExitDialog(false)}>Cancel</Button>
          <Button onClick={confirmExit} color="primary">
            Exit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};