import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormGroup,
  FormControlLabel,
  Switch,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  ExpandMore,
  PlayArrow,
  Pause,
  Schedule,
  CheckCircle,
  Error,
  Warning
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  repositoryPattern: string;
  enabled: boolean;
  triggers: {
    events: string[];
    conditions: {
      branchPattern?: string;
      labelPattern?: string;
      authorPattern?: string;
      pathPattern?: string;
      messagePattern?: string;
    };
  };
  actions: {
    createTask?: {
      title: string;
      description: string;
      type: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      assignedAgents?: string[];
      metadata?: Record<string, any>;
    };
    createPR?: {
      title: string;
      description: string;
      sourceBranch: string;
      targetBranch: string;
      draft?: boolean;
    };
    createIssue?: {
      title: string;
      description: string;
      labels?: string[];
      assignees?: string[];
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface AutomationExecution {
  id: string;
  ruleId: string;
  repositoryName: string;
  eventType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  results: {
    tasksCreated?: string[];
    prsCreated?: string[];
    issuesCreated?: string[];
    errors?: string[];
  };
}

interface AutomationRulesProps {
  onRefresh: () => void;
}

export const AutomationRules: React.FC<AutomationRulesProps> = ({
  onRefresh
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [formData, setFormData] = useState<Partial<AutomationRule>>({
    name: '',
    description: '',
    repositoryPattern: '.*',
    enabled: true,
    triggers: {
      events: ['push'],
      conditions: {}
    },
    actions: {}
  });

  useEffect(() => {
    loadAutomationRules();
    loadRecentExecutions();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadAutomationRules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data for now - in real implementation, this would call the API
      const mockRules: AutomationRule[] = [
        {
          id: 'rule-1',
          name: 'Auto-create task from issue',
          description: 'Automatically create a development task when an issue is labeled with "task"',
          organizationId: 'default',
          repositoryPattern: '.*',
          enabled: true,
          triggers: {
            events: ['issues'],
            conditions: {
              labelPattern: 'task|enhancement|feature'
            }
          },
          actions: {
            createTask: {
              title: 'Resolve issue: {{issue.title}}',
              description: '{{issue.description}}\n\nIssue URL: {{issue.url}}',
              type: 'development',
              priority: 'medium',
              metadata: {
                sourceType: 'issue',
                sourceId: '{{issue.id}}',
                repository: '{{repository}}'
              }
            }
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'rule-2',
          name: 'Auto-review pull request',
          description: 'Automatically create code review task for new pull requests',
          organizationId: 'default',
          repositoryPattern: '.*',
          enabled: true,
          triggers: {
            events: ['pull_request'],
            conditions: {}
          },
          actions: {
            createTask: {
              title: 'Review PR: {{pullRequest.title}}',
              description: 'Review pull request #{{pullRequest.number}}\n\n{{pullRequest.description}}\n\nPR URL: {{pullRequest.url}}',
              type: 'review',
              priority: 'medium',
              assignedAgents: ['github-copilot-001', 'codewhisperer-001']
            }
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      setRules(mockRules);
    } catch (error) {
      setError('Failed to load automation rules');
      console.error('Failed to load automation rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentExecutions = async () => {
    try {
      // Mock data for recent executions
      const mockExecutions: AutomationExecution[] = [
        {
          id: 'exec-1',
          ruleId: 'rule-1',
          repositoryName: 'example/repo',
          eventType: 'issues',
          status: 'completed',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3580000).toISOString(),
          results: {
            tasksCreated: ['task-123']
          }
        },
        {
          id: 'exec-2',
          ruleId: 'rule-2',
          repositoryName: 'example/repo',
          eventType: 'pull_request',
          status: 'running',
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          results: {}
        }
      ];

      setExecutions(mockExecutions);
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, rule: AutomationRule) => {
    setAnchorEl(event.currentTarget);
    setSelectedRule(rule);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRule(null);
  };

  const handleCreateRule = () => {
    setFormData({
      name: '',
      description: '',
      repositoryPattern: '.*',
      enabled: true,
      triggers: {
        events: ['push'],
        conditions: {}
      },
      actions: {}
    });
    setCreateDialogOpen(true);
  };

  const handleEditRule = () => {
    if (selectedRule) {
      setFormData(selectedRule);
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      setLoading(true);
      // Mock API call
      const updatedRule = { ...rule, enabled: !rule.enabled };
      setRules(prev => prev.map(r => r.id === rule.id ? updatedRule : r));
      setSuccess(`Rule ${updatedRule.enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      setError('Failed to toggle rule');
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const handleDeleteRule = async () => {
    if (!selectedRule) return;

    try {
      setLoading(true);
      // Mock API call
      setRules(prev => prev.filter(r => r.id !== selectedRule.id));
      setSuccess('Rule deleted successfully');
    } catch (error) {
      setError('Failed to delete rule');
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const handleSaveRule = async () => {
    try {
      setLoading(true);
      
      if (editDialogOpen && selectedRule) {
        // Update existing rule
        const updatedRule = { ...formData, updatedAt: new Date().toISOString() } as AutomationRule;
        setRules(prev => prev.map(r => r.id === selectedRule.id ? updatedRule : r));
        setSuccess('Rule updated successfully');
        setEditDialogOpen(false);
      } else {
        // Create new rule
        const newRule: AutomationRule = {
          ...formData,
          id: `rule-${Date.now()}`,
          organizationId: 'default',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as AutomationRule;
        setRules(prev => [...prev, newRule]);
        setSuccess('Rule created successfully');
        setCreateDialogOpen(false);
      }
      
      onRefresh();
    } catch (error) {
      setError('Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'failed': return 'error';
      default: return 'warning';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'running': return <Schedule />;
      case 'failed': return <Error />;
      default: return <Warning />;
    }
  };

  const renderRuleCard = (rule: AutomationRule) => {
    const recentExecutions = executions.filter(exec => exec.ruleId === rule.id);
    const lastExecution = recentExecutions[0];

    return (
      <Grid item xs={12} key={rule.id}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          layout
        >
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      {rule.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={rule.enabled ? 'Enabled' : 'Disabled'}
                      color={rule.enabled ? 'success' : 'default'}
                      sx={{ ml: 2 }}
                    />
                    {lastExecution && (
                      <Chip
                        size="small"
                        label={lastExecution.status}
                        color={getStatusColor(lastExecution.status)}
                        icon={getStatusIcon(lastExecution.status)}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {rule.description}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Chip size="small" label={`Pattern: ${rule.repositoryPattern}`} variant="outlined" />
                    {rule.triggers.events.map(event => (
                      <Chip key={event} size="small" label={event} variant="outlined" />
                    ))}
                  </Box>
                </Box>
                <IconButton onClick={(e) => handleMenuOpen(e, rule)}>
                  <MoreVert />
                </IconButton>
              </Box>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">Rule Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Triggers
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Events: {rule.triggers.events.join(', ')}
                      </Typography>
                      {rule.triggers.conditions.branchPattern && (
                        <Typography variant="body2" color="text.secondary">
                          Branch: {rule.triggers.conditions.branchPattern}
                        </Typography>
                      )}
                      {rule.triggers.conditions.labelPattern && (
                        <Typography variant="body2" color="text.secondary">
                          Labels: {rule.triggers.conditions.labelPattern}
                        </Typography>
                      )}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Actions
                      </Typography>
                      {rule.actions.createTask && (
                        <Typography variant="body2" color="text.secondary">
                          Create Task: {rule.actions.createTask.type} ({rule.actions.createTask.priority})
                        </Typography>
                      )}
                      {rule.actions.createPR && (
                        <Typography variant="body2" color="text.secondary">
                          Create PR: {rule.actions.createPR.sourceBranch} → {rule.actions.createPR.targetBranch}
                        </Typography>
                      )}
                      {rule.actions.createIssue && (
                        <Typography variant="body2" color="text.secondary">
                          Create Issue
                        </Typography>
                      )}
                    </Grid>
                  </Grid>

                  {recentExecutions.length > 0 && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Recent Executions
                      </Typography>
                      {recentExecutions.slice(0, 3).map(execution => (
                        <Box key={execution.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2">
                            {execution.repositoryName} - {execution.eventType}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              size="small"
                              label={execution.status}
                              color={getStatusColor(execution.status)}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {new Date(execution.startedAt).toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </>
                  )}
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>
    );
  };

  const renderRuleForm = () => (
    <Box>
      <TextField
        fullWidth
        label="Rule Name"
        value={formData.name || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        sx={{ mb: 2 }}
        required
      />

      <TextField
        fullWidth
        label="Description"
        value={formData.description || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        multiline
        rows={2}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Repository Pattern (Regex)"
        value={formData.repositoryPattern || ''}
        onChange={(e) => setFormData(prev => ({ ...prev, repositoryPattern: e.target.value }))}
        sx={{ mb: 2 }}
        helperText="Use .* for all repositories or specify a pattern like ^myorg/.*"
      />

      <FormControlLabel
        control={
          <Switch
            checked={formData.enabled || false}
            onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
          />
        }
        label="Enable rule"
        sx={{ mb: 3 }}
      />

      <Typography variant="h6" gutterBottom>
        Triggers
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Events</InputLabel>
        <Select
          multiple
          value={formData.triggers?.events || []}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            triggers: {
              ...prev.triggers,
              events: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
            }
          }))}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((value) => (
                <Chip key={value} label={value} size="small" />
              ))}
            </Box>
          )}
        >
          <MenuItem value="push">Push</MenuItem>
          <MenuItem value="pull_request">Pull Request</MenuItem>
          <MenuItem value="issues">Issues</MenuItem>
          <MenuItem value="release">Release</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Branch Pattern (optional)"
        value={formData.triggers?.conditions?.branchPattern || ''}
        onChange={(e) => setFormData(prev => ({
          ...prev,
          triggers: {
            ...prev.triggers,
            conditions: {
              ...prev.triggers?.conditions,
              branchPattern: e.target.value
            }
          }
        }))}
        sx={{ mb: 2 }}
        helperText="e.g., main|master|develop"
      />

      <TextField
        fullWidth
        label="Label Pattern (optional)"
        value={formData.triggers?.conditions?.labelPattern || ''}
        onChange={(e) => setFormData(prev => ({
          ...prev,
          triggers: {
            ...prev.triggers,
            conditions: {
              ...prev.triggers?.conditions,
              labelPattern: e.target.value
            }
          }
        }))}
        sx={{ mb: 3 }}
        helperText="e.g., bug|enhancement|feature"
      />

      <Typography variant="h6" gutterBottom>
        Actions
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={!!formData.actions?.createTask}
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData(prev => ({
                    ...prev,
                    actions: {
                      ...prev.actions,
                      createTask: {
                        title: 'Task: {{event.title}}',
                        description: '{{event.description}}',
                        type: 'development',
                        priority: 'medium'
                      }
                    }
                  }));
                } else {
                  const { createTask, ...rest } = formData.actions || {};
                  setFormData(prev => ({ ...prev, actions: rest }));
                }
              }}
            />
          }
          label="Create Task"
        />
      </FormGroup>

      {formData.actions?.createTask && (
        <Box sx={{ ml: 4, mb: 2 }}>
          <TextField
            fullWidth
            label="Task Title Template"
            value={formData.actions.createTask.title}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              actions: {
                ...prev.actions,
                createTask: {
                  ...prev.actions?.createTask!,
                  title: e.target.value
                }
              }
            }))}
            sx={{ mb: 1 }}
            size="small"
          />
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Task Type</InputLabel>
            <Select
              value={formData.actions.createTask.type}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                actions: {
                  ...prev.actions,
                  createTask: {
                    ...prev.actions?.createTask!,
                    type: e.target.value
                  }
                }
              }))}
            >
              <MenuItem value="development">Development</MenuItem>
              <MenuItem value="review">Review</MenuItem>
              <MenuItem value="testing">Testing</MenuItem>
              <MenuItem value="security">Security</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.actions.createTask.priority}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                actions: {
                  ...prev.actions,
                  createTask: {
                    ...prev.actions?.createTask!,
                    priority: e.target.value as 'low' | 'medium' | 'high' | 'critical'
                  }
                }
              }))}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Automation Rules
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateRule}
        >
          Create Rule
        </Button>
      </Box>

      {/* Status Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Rules Grid */}
      {rules.length > 0 ? (
        <Grid container spacing={3}>
          {rules.map(renderRuleCard)}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No automation rules found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create rules to automate tasks based on repository events
          </Typography>
        </Box>
      )}

      {/* Rule Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditRule}>
          <Edit sx={{ mr: 1 }} />
          Edit Rule
        </MenuItem>
        <MenuItem onClick={() => selectedRule && handleToggleRule(selectedRule)}>
          {selectedRule?.enabled ? <Pause sx={{ mr: 1 }} /> : <PlayArrow sx={{ mr: 1 }} />}
          {selectedRule?.enabled ? 'Disable' : 'Enable'} Rule
        </MenuItem>
        <MenuItem onClick={handleDeleteRule} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete Rule
        </MenuItem>
      </Menu>

      {/* Create Rule Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Automation Rule</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {renderRuleForm()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRule}
            disabled={loading || !formData.name}
          >
            {loading ? <CircularProgress size={20} /> : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Automation Rule</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {renderRuleForm()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRule}
            disabled={loading || !formData.name}
          >
            {loading ? <CircularProgress size={20} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};