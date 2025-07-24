import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  AlertTitle,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  Assignment,
  Code,
  Brush,
  BugReport,
  CloudUpload,
  RateReview,
  Timeline,
  Flag,
  Add,
  Delete,
  Edit,
  Link as LinkIcon,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { Project, Task, Requirement, Milestone } from '@/types';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface PRDDecompositionProps {
  project: Project;
  onUpdate?: (project: Project) => void;
}

interface DecompositionPreview {
  requirements: Requirement[];
  tasks: Task[];
  milestones: Milestone[];
  estimatedDuration: number;
  riskFactors: string[];
  tasksByType: Record<string, number>;
  tasksByPriority: Record<string, number>;
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  requirement: <Assignment />,
  design: <Brush />,
  implementation: <Code />,
  test: <BugReport />,
  deployment: <CloudUpload />,
  review: <RateReview />,
};

const priorityColors: Record<string, string> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

export const PRDDecomposition: React.FC<PRDDecompositionProps> = ({ project, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DecompositionPreview | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showRefineDialog, setShowRefineDialog] = useState(false);
  const [refinements, setRefinements] = useState({
    tasksToAdd: [] as any[],
    tasksToRemove: [] as string[],
  });

  const steps = [
    'Analyze PRD',
    'Extract Requirements',
    'Generate Tasks',
    'Create Milestones',
    'Review & Approve'
  ];

  const handlePreview = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/projects/${project.id}/decompose/preview`);
      setPreview(response.data.preview);
      setActiveStep(4); // Jump to review step
      toast.success('PRD analysis complete!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to analyze PRD');
    } finally {
      setLoading(false);
    }
  };

  const handleDecompose = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/projects/${project.id}/decompose`);
      toast.success(`Created ${response.data.tasks.length} tasks from PRD`);
      onUpdate?.(response.data.project);
      setPreview(null);
      setActiveStep(0);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to decompose PRD');
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/projects/${project.id}/decompose/refine`, refinements);
      toast.success('Decomposition refined successfully');
      onUpdate?.(response.data.project);
      setShowRefineDialog(false);
      setRefinements({ tasksToAdd: [], tasksToRemove: [] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to refine decomposition');
    } finally {
      setLoading(false);
    }
  };

  const renderTaskTypeChart = () => {
    if (!preview) return null;

    const total = Object.values(preview.tasksByType).reduce((sum, count) => sum + count, 0);

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Task Distribution by Type
        </Typography>
        {Object.entries(preview.tasksByType).map(([type, count]) => (
          <Box key={type} display="flex" alignItems="center" gap={1} mb={1}>
            <Box display="flex" alignItems="center" gap={0.5} width={120}>
              {taskTypeIcons[type]}
              <Typography variant="body2" textTransform="capitalize">
                {type}
              </Typography>
            </Box>
            <Box flexGrow={1}>
              <LinearProgress
                variant="determinate"
                value={(count / total) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" width={40}>
              {count}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  const renderRequirements = () => {
    if (!preview) return null;

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Requirements ({preview.requirements.length})
        </Typography>
        <List dense>
          {preview.requirements.slice(0, 5).map((req) => (
            <ListItem key={req.id}>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText
                primary={req.title}
                secondary={
                  <Box display="flex" gap={1} mt={0.5}>
                    <Chip
                      label={req.type}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={req.priority}
                      size="small"
                      color={priorityColors[req.priority] as any}
                    />
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
        {preview.requirements.length > 5 && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
            +{preview.requirements.length - 5} more requirements
          </Typography>
        )}
      </Box>
    );
  };

  const renderTasks = () => {
    if (!preview) return null;

    const tasksByType = preview.tasks.reduce((acc, task) => {
      if (!acc[task.type]) acc[task.type] = [];
      acc[task.type].push(task);
      return acc;
    }, {} as Record<string, Task[]>);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Generated Tasks ({preview.tasks.length})
        </Typography>
        {Object.entries(tasksByType).map(([type, tasks]) => (
          <Accordion key={type}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center" gap={1}>
                {taskTypeIcons[type]}
                <Typography textTransform="capitalize">
                  {type} ({tasks.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {tasks.slice(0, 3).map((task) => (
                  <ListItem key={task.id}>
                    <ListItemText
                      primary={task.title}
                      secondary={
                        <Box>
                          <Typography variant="caption" component="div">
                            {task.description.substring(0, 100)}...
                          </Typography>
                          <Box display="flex" gap={0.5} mt={0.5}>
                            <Chip
                              label={task.priority}
                              size="small"
                              color={priorityColors[task.priority] as any}
                            />
                            {task.metadata?.estimatedHours && (
                              <Chip
                                label={`${task.metadata.estimatedHours}h`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
                {tasks.length > 3 && (
                  <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                    +{tasks.length - 3} more {type} tasks
                  </Typography>
                )}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  const renderMilestones = () => {
    if (!preview) return null;

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Milestones ({preview.milestones.length})
        </Typography>
        <List>
          {preview.milestones.map((milestone, index) => (
            <ListItem key={milestone.id}>
              <ListItemIcon>
                <Flag color={milestone.status === 'completed' ? 'success' : 'action'} />
              </ListItemIcon>
              <ListItemText
                primary={milestone.name}
                secondary={
                  <Box>
                    <Typography variant="caption" component="div">
                      {milestone.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Due: {format(new Date(milestone.dueDate), 'MMM d, yyyy')}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  const renderRiskFactors = () => {
    if (!preview || preview.riskFactors.length === 0) return null;

    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        <AlertTitle>Risk Factors Identified</AlertTitle>
        <List dense>
          {preview.riskFactors.map((risk, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <Warning color="warning" />
              </ListItemIcon>
              <ListItemText primary={risk} />
            </ListItem>
          ))}
        </List>
      </Alert>
    );
  };

  if (!project.prd && !project.description) {
    return (
      <Alert severity="info">
        <AlertTitle>No PRD Available</AlertTitle>
        This project doesn't have a Product Requirements Document (PRD) to analyze.
        Add a PRD to enable automatic task decomposition.
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h2">
            PRD Decomposition
          </Typography>
          {project.tasks.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => setShowRefineDialog(true)}
            >
              Refine Tasks
            </Button>
          )}
        </Box>

        {project.tasks.length === 0 ? (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>Ready to Analyze</AlertTitle>
              The PRD will be analyzed to automatically generate requirements, tasks, and milestones.
            </Alert>

            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((label, index) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary">
                      {index === 0 && 'Parse and understand the PRD content'}
                      {index === 1 && 'Extract functional and technical requirements'}
                      {index === 2 && 'Generate development tasks with dependencies'}
                      {index === 3 && 'Create project milestones and timeline'}
                      {index === 4 && 'Review generated tasks and approve'}
                    </Typography>
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            <Box mt={3} display="flex" gap={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handlePreview}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <Timeline />}
              >
                {loading ? 'Analyzing...' : 'Analyze PRD'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>Decomposition Complete</AlertTitle>
              Generated {project.tasks.length} tasks from the PRD
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Project Overview
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Tasks
                      </Typography>
                      <Typography variant="h4">
                        {project.tasks.length}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Estimated Duration
                      </Typography>
                      <Typography variant="h6">
                        {project.metadata?.estimatedDuration || 'N/A'} days
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Requirements
                      </Typography>
                      <Typography variant="h6">
                        {project.requirements?.length || 0}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2 }}>
                  {renderTaskTypeChart()}
                </Paper>
              </Grid>
            </Grid>

            {project.metadata?.riskFactors && project.metadata.riskFactors.length > 0 && (
              <Alert severity="warning" sx={{ mt: 3 }}>
                <AlertTitle>Risk Factors</AlertTitle>
                <List dense>
                  {project.metadata.riskFactors.map((risk: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Warning color="warning" />
                      </ListItemIcon>
                      <ListItemText primary={risk} />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}
          </Box>
        )}

        {preview && (
          <Dialog
            open={Boolean(preview)}
            onClose={() => setPreview(null)}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              PRD Analysis Preview
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Alert severity="info">
                    <AlertTitle>Summary</AlertTitle>
                    Estimated Duration: <strong>{preview.estimatedDuration} days</strong> | 
                    Tasks: <strong>{preview.tasks.length}</strong> | 
                    Requirements: <strong>{preview.requirements.length}</strong> | 
                    Milestones: <strong>{preview.milestones.length}</strong>
                  </Alert>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  {renderRequirements()}
                </Grid>
                
                <Grid item xs={12} md={6}>
                  {renderTaskTypeChart()}
                </Grid>
                
                <Grid item xs={12}>
                  {renderTasks()}
                </Grid>
                
                <Grid item xs={12}>
                  {renderMilestones()}
                </Grid>
                
                <Grid item xs={12}>
                  {renderRiskFactors()}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleDecompose}
                disabled={loading}
              >
                Apply Decomposition
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {showRefineDialog && (
          <Dialog
            open={showRefineDialog}
            onClose={() => setShowRefineDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Refine Task Decomposition
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Add or remove tasks to refine the decomposition
              </Typography>
              
              {/* Add task form would go here */}
              <Alert severity="info" sx={{ mt: 2 }}>
                Task refinement UI coming soon...
              </Alert>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowRefineDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleRefine}
                disabled={loading || (refinements.tasksToAdd.length === 0 && refinements.tasksToRemove.length === 0)}
              >
                Apply Changes
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};