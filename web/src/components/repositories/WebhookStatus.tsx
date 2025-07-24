import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Refresh,
  Visibility,
  Timeline,
  GitHub,
  GitBranch,
  Link as LinkIcon,
  PlayArrow,
  Schedule,
  Cancel
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface WebhookEvent {
  id: string;
  type: string;
  repository: string;
  timestamp: string;
  processed: boolean;
  success?: boolean;
  error?: string;
  data?: any;
}

interface WebhookStatus {
  integration: any;
  webhookUrl?: string;
  status: 'active' | 'inactive' | 'error';
  lastEvent?: string;
  eventCount: number;
  recentEvents: WebhookEvent[];
}

interface WebhookStatusProps {
  integrations: any[];
}

export const WebhookStatus: React.FC<WebhookStatusProps> = ({
  integrations
}) => {
  const [webhookStatuses, setWebhookStatuses] = useState<WebhookStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookStatus | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  useEffect(() => {
    loadWebhookStatuses();
    // Set up polling for real-time updates
    const interval = setInterval(loadWebhookStatuses, 30000);
    return () => clearInterval(interval);
  }, [integrations]);

  const loadWebhookStatuses = async () => {
    try {
      setLoading(true);
      setError(null);

      // For each integration, get webhook status and recent events
      const statuses = await Promise.all(
        integrations.map(async (integration) => {
          try {
            // Mock webhook status - in real implementation, this would
            // query the actual webhook status from GitHub/GitLab API
            const recentEvents = await loadRecentEvents(integration.repositoryName);
            
            return {
              integration,
              webhookUrl: integration.webhookUrl,
              status: integration.webhookUrl ? 'active' : 'inactive' as 'active' | 'inactive' | 'error',
              lastEvent: recentEvents[0]?.timestamp,
              eventCount: recentEvents.length,
              recentEvents
            };
          } catch (error) {
            return {
              integration,
              webhookUrl: integration.webhookUrl,
              status: 'error' as 'active' | 'inactive' | 'error',
              lastEvent: undefined,
              eventCount: 0,
              recentEvents: []
            };
          }
        })
      );

      setWebhookStatuses(statuses);
    } catch (error) {
      setError('Failed to load webhook statuses');
      console.error('Failed to load webhook statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentEvents = async (repository: string): Promise<WebhookEvent[]> => {
    // Mock implementation - in real app, this would query the database
    // for recent webhook events for this repository
    const mockEvents: WebhookEvent[] = [
      {
        id: '1',
        type: 'push',
        repository,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        processed: true,
        success: true
      },
      {
        id: '2',
        type: 'pull_request',
        repository,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        processed: true,
        success: true
      },
      {
        id: '3',
        type: 'issues',
        repository,
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        processed: false,
        error: 'Processing timeout'
      }
    ];

    return mockEvents.slice(0, Math.floor(Math.random() * 4));
  };

  const testWebhook = async (webhookStatus: WebhookStatus) => {
    if (!webhookStatus.webhookUrl) return;

    try {
      setTestingWebhook(webhookStatus.integration.id);
      
      // Send a test webhook event
      const testEvent = {
        action: 'ping',
        repository: {
          full_name: webhookStatus.integration.repositoryName
        },
        sender: {
          login: 'test-user'
        }
      };

      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Event': 'ping'
        },
        body: JSON.stringify(testEvent)
      });

      if (response.ok) {
        // Reload statuses to show the test event
        await loadWebhookStatuses();
      } else {
        throw new Error('Test webhook failed');
      }
    } catch (error) {
      setError('Failed to test webhook');
      console.error('Webhook test failed:', error);
    } finally {
      setTestingWebhook(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle />;
      case 'inactive': return <Warning />;
      case 'error': return <Error />;
      default: return null;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'push': return <PlayArrow />;
      case 'pull_request': return <GitBranch />;
      case 'issues': return <Warning />;
      default: return <Schedule />;
    }
  };

  const renderWebhookCard = (webhookStatus: WebhookStatus) => (
    <Grid item xs={12} md={6} lg={4} key={webhookStatus.integration.id}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        layout
      >
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {webhookStatus.integration.provider === 'github' ? (
                  <GitHub sx={{ mr: 2, color: 'primary.main' }} />
                ) : (
                  <GitBranch sx={{ mr: 2, color: 'primary.main' }} />
                )}
                <Box>
                  <Typography variant="h6" component="div" noWrap>
                    {webhookStatus.integration.repositoryName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {webhookStatus.integration.provider}
                  </Typography>
                </Box>
              </Box>
              <Chip
                size="small"
                label={webhookStatus.status}
                color={getStatusColor(webhookStatus.status)}
                icon={getStatusIcon(webhookStatus.status)}
              />
            </Box>

            {webhookStatus.webhookUrl ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" noWrap>
                  <LinkIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  {webhookStatus.webhookUrl}
                </Typography>
              </Box>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No webhook configured
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2">
                Events: {webhookStatus.eventCount}
              </Typography>
              {webhookStatus.lastEvent && (
                <Typography variant="caption" color="text.secondary">
                  Last: {new Date(webhookStatus.lastEvent).toLocaleString()}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Visibility />}
                onClick={() => {
                  setSelectedWebhook(webhookStatus);
                  setDetailsDialogOpen(true);
                }}
              >
                Details
              </Button>
              {webhookStatus.webhookUrl && (
                <Tooltip title="Test webhook">
                  <IconButton
                    size="small"
                    onClick={() => testWebhook(webhookStatus)}
                    disabled={testingWebhook === webhookStatus.integration.id}
                  >
                    {testingWebhook === webhookStatus.integration.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <PlayArrow />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Grid>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Webhook Status
        </Typography>
        <Button
          startIcon={<Refresh />}
          onClick={loadWebhookStatuses}
          disabled={loading}
        >
          {loading ? <CircularProgress size={16} /> : 'Refresh'}
        </Button>
      </Box>

      {/* Error Alert */}
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
      </AnimatePresence>

      {/* Webhook Cards */}
      {webhookStatuses.length > 0 ? (
        <Grid container spacing={3}>
          {webhookStatuses.map(renderWebhookCard)}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No webhook integrations found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure repository integrations to monitor webhook status
          </Typography>
        </Box>
      )}

      {/* Webhook Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Webhook Details: {selectedWebhook?.integration.repositoryName}
        </DialogTitle>
        <DialogContent>
          {selectedWebhook && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>URL:</strong> {selectedWebhook.webhookUrl || 'Not configured'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Status:</strong> {selectedWebhook.status}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Provider:</strong> {selectedWebhook.integration.provider}
                </Typography>
              </Box>

              <Typography variant="h6" gutterBottom>
                Recent Events
              </Typography>
              
              {selectedWebhook.recentEvents.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Event</TableCell>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedWebhook.recentEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {getEventIcon(event.type)}
                              <Typography variant="body2" sx={{ ml: 1 }}>
                                {event.type}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(event.timestamp).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {event.processed ? (
                              event.success ? (
                                <Chip size="small" label="Success" color="success" />
                              ) : (
                                <Chip size="small" label="Failed" color="error" />
                              )
                            ) : (
                              <Chip size="small" label="Pending" color="warning" />
                            )}
                            {event.error && (
                              <Typography variant="caption" color="error" display="block">
                                {event.error}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">
                  No recent webhook events found
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};