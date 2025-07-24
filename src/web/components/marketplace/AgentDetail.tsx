import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Rating,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Paper,
  LinearProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  Star as StarIcon,
  Verified as VerifiedIcon,
  Security as SecurityIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  Review as ReviewIcon,
  Code as CodeIcon,
  Documentation as DocumentationIcon,
  Support as SupportIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface AgentDetail {
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  version: string;
  author: {
    name: string;
    email: string;
    organization?: string;
    website?: string;
  };
  category: string;
  tags: string[];
  capabilities: string[];
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'subscription';
    pricePerTask?: number;
    monthlyPrice?: number;
    yearlyPrice?: number;
    trialPeriod?: number;
  };
  compatibility: {
    minPlatformVersion: string;
    supportedLanguages: string[];
    requiredFeatures: string[];
  };
  installation: {
    type: 'native' | 'docker' | 'api' | 'webhook';
    packageUrl?: string;
    dockerImage?: string;
    apiEndpoint?: string;
    webhookUrl?: string;
  };
  permissions: {
    requiredScopes: string[];
    dataAccess: 'none' | 'read' | 'write' | 'admin';
    networkAccess: boolean;
    fileSystemAccess: boolean;
  };
  metrics: {
    downloads: number;
    activeInstallations: number;
    averageRating: number;
    totalReviews: number;
  };
  verification: {
    isVerified: boolean;
    securityScanPassed: boolean;
  };
  documentation: {
    readme: string;
    changelog: string;
    examples: Array<{
      title: string;
      description: string;
      code: string;
      expectedOutput?: string;
    }>;
  };
  support: {
    website?: string;
    documentation?: string;
    issueTracker?: string;
    email?: string;
  };
}

interface AgentReview {
  id: string;
  rating: number;
  title: string;
  review: string;
  pros: string[];
  cons: string[];
  useCase: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

const AgentDetail: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [installations, setInstallations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [configuration, setConfiguration] = useState<any>({});
  const [secrets, setSecrets] = useState<any>({});

  useEffect(() => {
    if (agentId) {
      fetchAgentDetails();
    }
  }, [agentId]);

  const fetchAgentDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/marketplace/agents/${agentId}`);
      const data = await response.json();

      if (data.success) {
        setAgent(data.agent);
        setReviews(data.reviews);
        setInstallations(data.installations);
      } else {
        setError(data.error || 'Failed to fetch agent details');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setInstallError(null);

    try {
      const response = await fetch(`/api/marketplace/agents/${agentId}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configuration,
          secrets
        })
      });

      const data = await response.json();

      if (data.success) {
        setInstallSuccess(true);
        setInstallDialogOpen(false);
        // Refresh agent details to update installation count
        await fetchAgentDetails();
      } else {
        setInstallError(data.error || 'Installation failed');
      }
    } catch (err) {
      setInstallError('Network error occurred');
    } finally {
      setInstalling(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getPricingDisplay = () => {
    if (!agent) return null;
    
    switch (agent.pricing.type) {
      case 'free':
        return <Chip label="Free" color="success" />;
      case 'freemium':
        return <Chip label="Freemium" color="info" />;
      case 'paid':
        return <Chip label={`$${agent.pricing.pricePerTask} per task`} color="warning" />;
      case 'subscription':
        return (
          <Box>
            <Chip label={`$${agent.pricing.monthlyPrice}/month`} color="error" />
            {agent.pricing.yearlyPrice && (
              <Chip 
                label={`$${agent.pricing.yearlyPrice}/year`} 
                color="error" 
                variant="outlined" 
                sx={{ ml: 1 }} 
              />
            )}
          </Box>
        );
      default:
        return <Chip label="Free" color="success" />;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !agent) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          {error || 'Agent not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={8}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ width: 64, height: 64, mr: 2, bgcolor: 'primary.main' }}>
                    {agent.displayName.charAt(0)}
                  </Avatar>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h4" component="h1" fontWeight="bold">
                        {agent.displayName}
                      </Typography>
                      {agent.verification.isVerified && (
                        <VerifiedIcon color="primary" />
                      )}
                      {agent.verification.securityScanPassed && (
                        <SecurityIcon color="success" />
                      )}
                    </Box>
                    <Typography variant="subtitle1" color="text.secondary">
                      by {agent.author.name}
                      {agent.author.organization && ` • ${agent.author.organization}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Version {agent.version}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body1" mb={2}>
                  {agent.description}
                </Typography>

                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Rating value={agent.metrics.averageRating} precision={0.1} readOnly />
                  <Typography variant="body2">
                    {agent.metrics.averageRating.toFixed(1)} ({agent.metrics.totalReviews} reviews)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <DownloadIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                    {formatNumber(agent.metrics.downloads)} downloads
                  </Typography>
                </Box>

                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip label={agent.category} color="primary" />
                  {agent.tags.map(tag => (
                    <Chip key={tag} label={tag} variant="outlined" size="small" />
                  ))}
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box display="flex" flexDirection="column" gap={2}>
                  {getPricingDisplay()}
                  
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<DownloadIcon />}
                    onClick={() => setInstallDialogOpen(true)}
                    disabled={installing}
                  >
                    {installing ? 'Installing...' : 'Install Agent'}
                  </Button>

                  {installSuccess && (
                    <Alert severity="success">
                      Agent installed successfully!
                    </Alert>
                  )}

                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    {installations} active installations
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </motion.div>

      {/* Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)}>
          <Tab label="Overview" icon={<DocumentationIcon />} iconPosition="start" />
          <Tab label="Configuration" icon={<SettingsIcon />} iconPosition="start" />
          <Tab label="Reviews" icon={<ReviewIcon />} iconPosition="start" />
          <Tab label="Examples" icon={<CodeIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {selectedTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  About this Agent
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 3 }}>
                  {agent.longDescription || agent.description}
                </Typography>

                <Typography variant="h6" gutterBottom>
                  Capabilities
                </Typography>
                <List dense>
                  {agent.capabilities.map((capability, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={capability} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Technical Details
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><StorageIcon /></ListItemIcon>
                    <ListItemText 
                      primary="Installation Type" 
                      secondary={agent.installation.type.toUpperCase()} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><LanguageIcon /></ListItemIcon>
                    <ListItemText 
                      primary="Supported Languages" 
                      secondary={agent.compatibility.supportedLanguages.join(', ')} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><SecurityIcon /></ListItemIcon>
                    <ListItemText 
                      primary="Data Access" 
                      secondary={agent.permissions.dataAccess} 
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {agent.support && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Support & Resources
                  </Typography>
                  <List dense>
                    {agent.support.website && (
                      <ListItem button component="a" href={agent.support.website} target="_blank">
                        <ListItemIcon><SupportIcon /></ListItemIcon>
                        <ListItemText primary="Website" />
                      </ListItem>
                    )}
                    {agent.support.documentation && (
                      <ListItem button component="a" href={agent.support.documentation} target="_blank">
                        <ListItemIcon><DocumentationIcon /></ListItemIcon>
                        <ListItemText primary="Documentation" />
                      </ListItem>
                    )}
                    {agent.support.issueTracker && (
                      <ListItem button component="a" href={agent.support.issueTracker} target="_blank">
                        <ListItemIcon><ErrorIcon /></ListItemIcon>
                        <ListItemText primary="Issue Tracker" />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {selectedTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configuration Requirements
            </Typography>
            
            <Typography variant="body1" color="text.secondary" mb={3}>
              This agent requires the following configuration and permissions:
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Required Permissions
                </Typography>
                <List dense>
                  {agent.permissions.requiredScopes.map((scope, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={scope} />
                    </ListItem>
                  ))}
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon color={agent.permissions.networkAccess ? "primary" : "disabled"} fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Network Access" secondary={agent.permissions.networkAccess ? "Required" : "Not required"} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon color={agent.permissions.fileSystemAccess ? "primary" : "disabled"} fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="File System Access" secondary={agent.permissions.fileSystemAccess ? "Required" : "Not required"} />
                  </ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Platform Requirements
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Minimum Platform Version" 
                      secondary={agent.compatibility.minPlatformVersion} 
                    />
                  </ListItem>
                  {agent.compatibility.requiredFeatures.map((feature, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={feature} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {selectedTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              User Reviews ({reviews.length})
            </Typography>
            
            {reviews.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No reviews yet. Be the first to review this agent!
              </Typography>
            ) : (
              reviews.map((review) => (
                <Box key={review.id} sx={{ mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Rating value={review.rating} size="small" readOnly />
                    <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 'bold' }}>
                      {review.title}
                    </Typography>
                    {review.isVerifiedPurchase && (
                      <Chip label="Verified" color="success" size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                  
                  <Typography variant="body2" mb={1}>
                    {review.review}
                  </Typography>

                  {review.pros.length > 0 && (
                    <Box mb={1}>
                      <Typography variant="caption" color="success.main" fontWeight="bold">
                        Pros:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {review.pros.join(', ')}
                      </Typography>
                    </Box>
                  )}

                  {review.cons.length > 0 && (
                    <Box mb={1}>
                      <Typography variant="caption" color="error.main" fontWeight="bold">
                        Cons:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {review.cons.join(', ')}
                      </Typography>
                    </Box>
                  )}

                  <Typography variant="caption" color="text.secondary">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {selectedTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Usage Examples
            </Typography>
            
            {agent.documentation.examples.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No examples available for this agent.
              </Typography>
            ) : (
              agent.documentation.examples.map((example, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    {example.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {example.description}
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white', fontFamily: 'monospace' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {example.code}
                    </pre>
                  </Paper>
                  {example.expectedOutput && (
                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        Expected Output:
                      </Typography>
                      <Paper sx={{ p: 1, mt: 0.5, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {example.expectedOutput}
                      </Paper>
                    </Box>
                  )}
                </Paper>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Installation Dialog */}
      <Dialog 
        open={installDialogOpen} 
        onClose={() => setInstallDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Install {agent.displayName}
        </DialogTitle>
        <DialogContent>
          {installError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {installError}
            </Alert>
          )}
          
          <Typography variant="body2" color="text.secondary" mb={3}>
            Configure the agent settings before installation.
          </Typography>

          {/* Configuration would be dynamically generated based on agent.configuration.schema */}
          <TextField
            fullWidth
            label="Configuration (JSON)"
            multiline
            rows={4}
            value={JSON.stringify(configuration, null, 2)}
            onChange={(e) => {
              try {
                setConfiguration(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, keep as string for now
              }
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Secrets (JSON)"
            multiline
            rows={3}
            value={JSON.stringify(secrets, null, 2)}
            onChange={(e) => {
              try {
                setSecrets(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, keep as string for now
              }
            }}
            helperText="API keys and other sensitive configuration"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstallDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleInstall} 
            variant="contained"
            disabled={installing}
          >
            {installing ? <CircularProgress size={20} /> : 'Install'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AgentDetail;