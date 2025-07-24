import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ExpandMore,
  Person,
  Group,
  Security,
  VpnKey,
  Save,
  Cancel,
  Preview,
  Sync,
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth2';
  provider?: string;
  enabled: boolean;
  attributeMapping?: AttributeMapping;
  userProvisioning?: UserProvisioning;
}

interface AttributeMapping {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string;
  department?: string;
  title?: string;
  phone?: string;
  manager?: string;
  customAttributes?: Record<string, string>;
}

interface UserProvisioning {
  autoCreate: boolean;
  autoUpdate: boolean;
  autoSuspend: boolean;
  defaultRole: string;
  allowedDomains?: string[];
  groupMappings?: GroupMapping[];
  roleMappings?: RoleMapping[];
}

interface GroupMapping {
  id: string;
  sourceGroup: string;
  targetGroup: string;
  enabled: boolean;
}

interface RoleMapping {
  id: string;
  sourceValue: string;
  sourceAttribute: string;
  targetRole: string;
  enabled: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`mapping-tabpanel-${index}`}
      aria-labelledby={`mapping-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface SSOUserMappingProps {
  providers: SSOProvider[];
  onRefresh: () => void;
}

export const SSOUserMapping: React.FC<SSOUserMappingProps> = ({ providers, onRefresh }) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [currentTab, setCurrentTab] = useState(0);
  const [attributeMapping, setAttributeMapping] = useState<AttributeMapping>({
    email: '',
    firstName: '',
    lastName: '',
    displayName: '',
    groups: '',
    department: '',
    title: '',
    phone: '',
    manager: '',
    customAttributes: {}
  });
  const [userProvisioning, setUserProvisioning] = useState<UserProvisioning>({
    autoCreate: true,
    autoUpdate: true,
    autoSuspend: false,
    defaultRole: 'org_member',
    allowedDomains: [],
    groupMappings: [],
    roleMappings: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);

  const enabledProviders = providers.filter(p => p.enabled);

  useEffect(() => {
    if (selectedProvider) {
      loadProviderMappings(selectedProvider);
    }
  }, [selectedProvider]);

  const loadProviderMappings = async (providerId: string) => {
    try {
      setLoading(true);
      setError(null);

      const provider = providers.find(p => p.id === providerId);
      if (!provider) return;

      const endpoint = provider.type === 'saml' 
        ? `/api/sso/saml/providers/${providerId}/mapping`
        : `/api/sso/oauth2/providers/${providerId}/mapping`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (response.ok) {
        setAttributeMapping(data.attributeMapping || {
          email: provider.type === 'saml' 
            ? 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
            : 'email',
          firstName: provider.type === 'saml'
            ? 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'
            : 'given_name',
          lastName: provider.type === 'saml'
            ? 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'
            : 'family_name',
          displayName: provider.type === 'saml'
            ? 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
            : 'name',
          groups: provider.type === 'saml'
            ? 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
            : 'groups',
          customAttributes: {}
        });

        setUserProvisioning(data.userProvisioning || {
          autoCreate: true,
          autoUpdate: true,
          autoSuspend: false,
          defaultRole: 'org_member',
          allowedDomains: [],
          groupMappings: [],
          roleMappings: []
        });
      } else {
        setError(data.message || 'Failed to load mapping configuration');
      }
    } catch (error) {
      setError('Failed to load mapping configuration');
      console.error('Mapping load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMapping = async () => {
    if (!selectedProvider) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const provider = providers.find(p => p.id === selectedProvider);
      if (!provider) return;

      const endpoint = provider.type === 'saml' 
        ? `/api/sso/saml/providers/${selectedProvider}/mapping`
        : `/api/sso/oauth2/providers/${selectedProvider}/mapping`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attributeMapping,
          userProvisioning
        })
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Mapping configuration saved successfully');
        onRefresh();
      } else {
        setError(result.message || 'Failed to save mapping configuration');
      }
    } catch (error) {
      setError('Failed to save mapping configuration');
      console.error('Mapping save failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const testMapping = async () => {
    if (!selectedProvider) return;

    try {
      setLoading(true);
      setError(null);

      const provider = providers.find(p => p.id === selectedProvider);
      if (!provider) return;

      const endpoint = provider.type === 'saml' 
        ? `/api/sso/saml/providers/${selectedProvider}/test-mapping`
        : `/api/sso/oauth2/providers/${selectedProvider}/test-mapping`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attributeMapping,
          userProvisioning
        })
      });

      const result = await response.json();
      setTestResults(result);

    } catch (error) {
      setError('Failed to test mapping configuration');
      console.error('Mapping test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAttributeChange = (field: string, value: string) => {
    setAttributeMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomAttributeChange = (key: string, value: string) => {
    setAttributeMapping(prev => ({
      ...prev,
      customAttributes: {
        ...prev.customAttributes,
        [key]: value
      }
    }));
  };

  const addCustomAttribute = () => {
    const key = prompt('Enter attribute name:');
    if (key) {
      handleCustomAttributeChange(key, '');
    }
  };

  const removeCustomAttribute = (key: string) => {
    setAttributeMapping(prev => {
      const newCustomAttributes = { ...prev.customAttributes };
      delete newCustomAttributes[key];
      return {
        ...prev,
        customAttributes: newCustomAttributes
      };
    });
  };

  const addGroupMapping = () => {
    setEditingMapping(null);
    setGroupDialogOpen(true);
  };

  const addRoleMapping = () => {
    setEditingMapping(null);
    setRoleDialogOpen(true);
  };

  const saveGroupMapping = (mapping: Omit<GroupMapping, 'id'>) => {
    const newMapping: GroupMapping = {
      ...mapping,
      id: editingMapping?.id || Date.now().toString()
    };

    setUserProvisioning(prev => ({
      ...prev,
      groupMappings: editingMapping 
        ? prev.groupMappings?.map(m => m.id === editingMapping.id ? newMapping : m) || []
        : [...(prev.groupMappings || []), newMapping]
    }));

    setGroupDialogOpen(false);
    setEditingMapping(null);
  };

  const saveRoleMapping = (mapping: Omit<RoleMapping, 'id'>) => {
    const newMapping: RoleMapping = {
      ...mapping,
      id: editingMapping?.id || Date.now().toString()
    };

    setUserProvisioning(prev => ({
      ...prev,
      roleMappings: editingMapping 
        ? prev.roleMappings?.map(m => m.id === editingMapping.id ? newMapping : m) || []
        : [...(prev.roleMappings || []), newMapping]
    }));

    setRoleDialogOpen(false);
    setEditingMapping(null);
  };

  const deleteGroupMapping = (id: string) => {
    setUserProvisioning(prev => ({
      ...prev,
      groupMappings: prev.groupMappings?.filter(m => m.id !== id) || []
    }));
  };

  const deleteRoleMapping = (id: string) => {
    setUserProvisioning(prev => ({
      ...prev,
      roleMappings: prev.roleMappings?.filter(m => m.id !== id) || []
    }));
  };

  const selectedProviderObj = providers.find(p => p.id === selectedProvider);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          User Attribute Mapping
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure how user attributes from SSO providers are mapped to your application
        </Typography>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>SSO Provider</InputLabel>
          <Select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            label="SSO Provider"
          >
            {enabledProviders.map((provider) => (
              <MenuItem key={provider.id} value={provider.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {provider.type === 'saml' ? <Security fontSize="small" /> : <VpnKey fontSize="small" />}
                  {provider.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
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
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {selectedProvider && (
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
              <Tab label="Attribute Mapping" />
              <Tab label="User Provisioning" />
              <Tab label="Group Mapping" />
              <Tab label="Role Mapping" />
            </Tabs>
          </Box>

          <TabPanel value={currentTab} index={0}>
            <Typography variant="subtitle1" gutterBottom>
              Attribute Mapping Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Map SSO attributes to user properties in your application
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="Email Attribute"
                value={attributeMapping.email}
                onChange={(e) => handleAttributeChange('email', e.target.value)}
                required
                helperText="The attribute containing the user's email address"
              />
              <TextField
                fullWidth
                label="First Name Attribute"
                value={attributeMapping.firstName}
                onChange={(e) => handleAttributeChange('firstName', e.target.value)}
                helperText="The attribute containing the user's first name"
              />
              <TextField
                fullWidth
                label="Last Name Attribute"
                value={attributeMapping.lastName}
                onChange={(e) => handleAttributeChange('lastName', e.target.value)}
                helperText="The attribute containing the user's last name"
              />
              <TextField
                fullWidth
                label="Display Name Attribute"
                value={attributeMapping.displayName}
                onChange={(e) => handleAttributeChange('displayName', e.target.value)}
                helperText="The attribute containing the user's display name"
              />
              <TextField
                fullWidth
                label="Groups Attribute"
                value={attributeMapping.groups}
                onChange={(e) => handleAttributeChange('groups', e.target.value)}
                helperText="The attribute containing user groups/roles"
              />
              <TextField
                fullWidth
                label="Department Attribute"
                value={attributeMapping.department}
                onChange={(e) => handleAttributeChange('department', e.target.value)}
                helperText="The attribute containing the user's department"
              />
            </Box>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2">
                  Custom Attributes ({Object.keys(attributeMapping.customAttributes || {}).length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={addCustomAttribute}
                  >
                    Add Custom Attribute
                  </Button>
                </Box>
                {Object.entries(attributeMapping.customAttributes || {}).map(([key, value]) => (
                  <Box key={key} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      label="Attribute Name"
                      value={key}
                      disabled
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Source Attribute"
                      value={value}
                      onChange={(e) => handleCustomAttributeChange(key, e.target.value)}
                      sx={{ flex: 2 }}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeCustomAttribute(key)}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <Typography variant="subtitle1" gutterBottom>
              User Provisioning Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure how users are created and managed through SSO
            </Typography>

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userProvisioning.autoCreate}
                    onChange={(e) => setUserProvisioning(prev => ({ ...prev, autoCreate: e.target.checked }))}
                  />
                }
                label="Automatically create new users"
              />
              <Typography variant="caption" display="block" color="text.secondary">
                Create user accounts automatically when users sign in for the first time
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userProvisioning.autoUpdate}
                    onChange={(e) => setUserProvisioning(prev => ({ ...prev, autoUpdate: e.target.checked }))}
                  />
                }
                label="Automatically update user information"
              />
              <Typography variant="caption" display="block" color="text.secondary">
                Update user profiles with the latest information from the SSO provider
              </Typography>
            </Box>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Default Role</InputLabel>
              <Select
                value={userProvisioning.defaultRole}
                onChange={(e) => setUserProvisioning(prev => ({ ...prev, defaultRole: e.target.value }))}
                label="Default Role"
              >
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="org_member">Organization Member</MenuItem>
                <MenuItem value="developer">Developer</MenuItem>
                <MenuItem value="org_admin">Organization Admin</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Allowed Email Domains"
              value={userProvisioning.allowedDomains?.join(', ') || ''}
              onChange={(e) => setUserProvisioning(prev => ({ 
                ...prev, 
                allowedDomains: e.target.value.split(',').map(d => d.trim()).filter(Boolean)
              }))}
              helperText="Comma-separated list of allowed email domains (leave empty to allow all)"
              sx={{ mb: 3 }}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Group Mapping
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Map SSO groups to application groups
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={addGroupMapping}
              >
                Add Group Mapping
              </Button>
            </Box>

            {userProvisioning.groupMappings && userProvisioning.groupMappings.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Source Group</TableCell>
                      <TableCell>Target Group</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userProvisioning.groupMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>{mapping.sourceGroup}</TableCell>
                        <TableCell>{mapping.targetGroup}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={mapping.enabled ? 'Enabled' : 'Disabled'}
                            color={mapping.enabled ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingMapping(mapping);
                              setGroupDialogOpen(true);
                            }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteGroupMapping(mapping.id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                No group mappings configured. Add mappings to automatically assign users to groups based on their SSO group membership.
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Role Mapping
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Map SSO attributes to application roles
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={addRoleMapping}
              >
                Add Role Mapping
              </Button>
            </Box>

            {userProvisioning.roleMappings && userProvisioning.roleMappings.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Source Attribute</TableCell>
                      <TableCell>Source Value</TableCell>
                      <TableCell>Target Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userProvisioning.roleMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>{mapping.sourceAttribute}</TableCell>
                        <TableCell>{mapping.sourceValue}</TableCell>
                        <TableCell>{mapping.targetRole}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={mapping.enabled ? 'Enabled' : 'Disabled'}
                            color={mapping.enabled ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingMapping(mapping);
                              setRoleDialogOpen(true);
                            }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteRoleMapping(mapping.id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                No role mappings configured. Add mappings to automatically assign roles to users based on their SSO attributes.
              </Alert>
            )}
          </TabPanel>

          <Divider />
          <Box sx={{ p: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<Preview />}
              onClick={testMapping}
              disabled={loading}
            >
              Test Mapping
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={saveMapping}
              disabled={loading}
            >
              Save Configuration
            </Button>
          </Box>
        </Card>
      )}

      {enabledProviders.length === 0 && (
        <Alert severity="info">
          No enabled SSO providers found. Enable at least one provider to configure user mapping.
        </Alert>
      )}

      {/* Test Results */}
      {testResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mapping Test Results
              </Typography>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Group Mapping Dialog - Simplified for brevity */}
      <Dialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingMapping ? 'Edit' : 'Add'} Group Mapping
        </DialogTitle>
        <DialogContent>
          {/* Group mapping form would go here */}
          <Alert severity="info">
            Group mapping dialog implementation would include form fields for source group, target group, and enabled status.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Role Mapping Dialog - Simplified for brevity */}
      <Dialog
        open={roleDialogOpen}
        onClose={() => setRoleDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingMapping ? 'Edit' : 'Add'} Role Mapping
        </DialogTitle>
        <DialogContent>
          {/* Role mapping form would go here */}
          <Alert severity="info">
            Role mapping dialog implementation would include form fields for source attribute, source value, target role, and enabled status.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};