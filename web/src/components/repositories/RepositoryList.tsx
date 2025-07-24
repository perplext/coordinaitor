import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Avatar,
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
  Checkbox,
  CircularProgress,
  Alert,
  Pagination,
  InputAdornment
} from '@mui/material';
import {
  GitHub,
  GitBranch,
  MoreVert,
  Search,
  Link as LinkIcon,
  Settings,
  Webhook,
  Star,
  Language,
  Public,
  Lock,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  description?: string;
  private: boolean;
  language?: string;
  topics?: string[];
  defaultBranch: string;
  updatedAt: string;
}

interface Integration {
  id: string;
  repositoryId: string;
  repositoryName: string;
  provider: string;
  autoCreateTasks: boolean;
  autoCreatePR: boolean;
  webhookUrl?: string;
}

interface RepositoryListProps {
  services: {
    github: boolean;
    gitlab: boolean;
  };
  onRefresh: () => void;
}

export const RepositoryList: React.FC<RepositoryListProps> = ({
  services,
  onRefresh
}) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitlab'>('github');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [integrateDialogOpen, setIntegrateDialogOpen] = useState(false);
  const [integrationSettings, setIntegrationSettings] = useState({
    autoCreateTasks: true,
    autoCreatePR: false,
    branchPrefix: 'ai-task-',
    enabledEvents: ['push', 'pull_request', 'issues'],
    taskCreationRules: {
      issueLabels: ['enhancement', 'bug', 'feature'],
      prLabels: ['review-needed'],
      autoAssign: true
    }
  });

  useEffect(() => {
    if (services.github || services.gitlab) {
      loadRepositories();
      loadIntegrations();
    }
  }, [selectedProvider, page, services]);

  const loadRepositories = async () => {
    if (!services[selectedProvider]) {
      setRepositories([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/repositories/${selectedProvider}/repos?page=${page}&per_page=10`
      );
      const data = await response.json();
      
      if (response.ok) {
        setRepositories(data.repositories || []);
        setTotalPages(Math.ceil((data.total || data.repositories?.length || 0) / 10));
      } else {
        setError(data.message || 'Failed to load repositories');
        setRepositories([]);
      }
    } catch (error) {
      setError('Failed to load repositories');
      setRepositories([]);
      console.error('Failed to load repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIntegrations = async () => {
    try {
      const response = await fetch('/api/repositories/integrations');
      const data = await response.json();
      
      if (response.ok) {
        setIntegrations(data.integrations || []);
      }
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  };

  const isRepositoryIntegrated = (repoId: string) => {
    return integrations.some(integration => integration.repositoryId === repoId);
  };

  const getRepositoryIntegration = (repoId: string) => {
    return integrations.find(integration => integration.repositoryId === repoId);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, repo: Repository) => {
    setAnchorEl(event.currentTarget);
    setSelectedRepo(repo);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRepo(null);
  };

  const handleIntegrateRepository = () => {
    if (selectedRepo) {
      setIntegrateDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleIntegrationSubmit = async () => {
    if (!selectedRepo) return;

    try {
      setLoading(true);
      const [owner, repo] = selectedRepo.fullName.split('/');
      
      const response = await fetch(
        `/api/repositories/${selectedProvider}/repos/${owner}/${repo}/integrate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(integrationSettings)
        }
      );

      const data = await response.json();

      if (response.ok) {
        setIntegrateDialogOpen(false);
        setSelectedRepo(null);
        loadIntegrations();
        onRefresh();
      } else {
        setError(data.message || 'Failed to create integration');
      }
    } catch (error) {
      setError('Failed to create integration');
      console.error('Integration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderRepositoryCard = (repo: Repository) => {
    const integrated = isRepositoryIntegrated(repo.id);
    const integration = getRepositoryIntegration(repo.id);

    return (
      <Grid item xs={12} md={6} lg={4} key={repo.id}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          layout
        >
          <Card sx={{ height: '100%', position: 'relative' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                    {selectedProvider === 'github' ? <GitHub /> : <GitBranch />}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="div" noWrap>
                      {repo.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {repo.owner}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {repo.private ? <Lock sx={{ mr: 1 }} /> : <Public sx={{ mr: 1 }} />}
                  <IconButton 
                    size="small"
                    onClick={(e) => handleMenuOpen(e, repo)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>

              {repo.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {repo.description}
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {repo.language && (
                  <Chip
                    size="small"
                    icon={<Language />}
                    label={repo.language}
                    variant="outlined"
                  />
                )}
                {repo.topics?.slice(0, 3).map(topic => (
                  <Chip
                    key={topic}
                    size="small"
                    label={topic}
                    variant="outlined"
                  />
                ))}
                {(repo.topics?.length || 0) > 3 && (
                  <Chip
                    size="small"
                    label={`+${repo.topics!.length - 3} more`}
                    variant="outlined"
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Updated {new Date(repo.updatedAt).toLocaleDateString()}
                </Typography>
                {integrated ? (
                  <Chip
                    size="small"
                    label="Integrated"
                    color="success"
                    icon={<Webhook />}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSelectedRepo(repo);
                      setIntegrateDialogOpen(true);
                    }}
                  >
                    Integrate
                  </Button>
                )}
              </Box>

              {integrated && integration && (
                <Box sx={{ mt: 2, p: 1, bgcolor: 'success.50', borderRadius: 1 }}>
                  <Typography variant="caption" display="block">
                    Auto Tasks: {integration.autoCreateTasks ? 'Enabled' : 'Disabled'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Auto PR: {integration.autoCreatePR ? 'Enabled' : 'Disabled'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </Grid>
    );
  };

  return (
    <Box>
      {/* Provider Selection and Search */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={selectedProvider === 'github' ? 'contained' : 'outlined'}
            startIcon={<GitHub />}
            onClick={() => setSelectedProvider('github')}
            disabled={!services.github}
          >
            GitHub
          </Button>
          <Button
            variant={selectedProvider === 'gitlab' ? 'contained' : 'outlined'}
            startIcon={<GitBranch />}
            onClick={() => setSelectedProvider('gitlab')}
            disabled={!services.gitlab}
          >
            GitLab
          </Button>
        </Box>
        
        <TextField
          size="small"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
          sx={{ flexGrow: 1, maxWidth: 400 }}
        />
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

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* No Service Configured */}
      {!services.github && !services.gitlab && (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No repository services configured
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure GitHub or GitLab integration to view repositories
          </Typography>
        </Box>
      )}

      {/* Repository Grid */}
      {!loading && filteredRepositories.length > 0 && (
        <>
          <Grid container spacing={3}>
            {filteredRepositories.map(renderRepositoryCard)}
          </Grid>
          
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {/* No Repositories */}
      {!loading && repositories.length === 0 && (services.github || services.gitlab) && (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No repositories found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try adjusting your search terms' : 'No repositories available'}
          </Typography>
        </Box>
      )}

      {/* Repository Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => window.open(selectedRepo?.url, '_blank')}>
          <LinkIcon sx={{ mr: 1 }} />
          Open Repository
        </MenuItem>
        <MenuItem onClick={handleIntegrateRepository}>
          <Settings sx={{ mr: 1 }} />
          {isRepositoryIntegrated(selectedRepo?.id || '') ? 'Configure Integration' : 'Integrate Repository'}
        </MenuItem>
      </Menu>

      {/* Integration Dialog */}
      <Dialog
        open={integrateDialogOpen}
        onClose={() => setIntegrateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Integrate Repository: {selectedRepo?.fullName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Automation Settings
            </Typography>
            
            <FormGroup sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={integrationSettings.autoCreateTasks}
                    onChange={(e) => setIntegrationSettings(prev => ({
                      ...prev,
                      autoCreateTasks: e.target.checked
                    }))}
                  />
                }
                label="Automatically create tasks from issues"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={integrationSettings.autoCreatePR}
                    onChange={(e) => setIntegrationSettings(prev => ({
                      ...prev,
                      autoCreatePR: e.target.checked
                    }))}
                  />
                }
                label="Automatically create pull requests for completed tasks"
              />
            </FormGroup>

            <TextField
              fullWidth
              label="Branch Prefix"
              value={integrationSettings.branchPrefix}
              onChange={(e) => setIntegrationSettings(prev => ({
                ...prev,
                branchPrefix: e.target.value
              }))}
              sx={{ mb: 3 }}
              helperText="Prefix for branches created by AI agents"
            />

            <Typography variant="h6" gutterBottom>
              Task Creation Rules
            </Typography>
            
            <TextField
              fullWidth
              label="Issue Labels (comma-separated)"
              value={integrationSettings.taskCreationRules.issueLabels.join(', ')}
              onChange={(e) => setIntegrationSettings(prev => ({
                ...prev,
                taskCreationRules: {
                  ...prev.taskCreationRules,
                  issueLabels: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                }
              }))}
              sx={{ mb: 2 }}
              helperText="Issues with these labels will automatically create tasks"
            />

            <TextField
              fullWidth
              label="PR Labels (comma-separated)"
              value={integrationSettings.taskCreationRules.prLabels.join(', ')}
              onChange={(e) => setIntegrationSettings(prev => ({
                ...prev,
                taskCreationRules: {
                  ...prev.taskCreationRules,
                  prLabels: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                }
              }))}
              sx={{ mb: 2 }}
              helperText="Pull requests with these labels will create review tasks"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIntegrateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleIntegrationSubmit}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Create Integration'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};