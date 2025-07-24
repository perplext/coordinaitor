import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Tab,
  Tabs,
  Badge,
} from '@mui/material';
import {
  Refresh,
  CheckCircle,
  Cancel,
  Timer,
  Pending,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { ApprovalCard } from '@/components/ApprovalCard';
import { ApprovalSummary } from '@/types/approval';
import { useAuthStore } from '@/store/authStore';

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
      id={`approval-tabpanel-${index}`}
      aria-labelledby={`approval-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const Approvals: React.FC = () => {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalSummary[]>([]);
  const [allApprovals, setAllApprovals] = useState<ApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const { user } = useAuthStore();
  
  const isAdmin = user?.roles.some(role => role.id === 'admin');

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch pending approvals for current user
      const pendingResponse = await api.get('/approvals/pending');
      setPendingApprovals(pendingResponse.data.approvals);

      // If admin, fetch all approvals
      if (isAdmin) {
        const allResponse = await api.get('/approvals');
        setAllApprovals(allResponse.data.approvals);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDecision = () => {
    // Refresh approvals after a decision is made
    fetchApprovals();
  };

  if (loading && pendingApprovals.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  const pendingCount = pendingApprovals.length;
  const allPendingCount = allApprovals.length;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Approvals
        </Typography>
        <Button
          startIcon={<Refresh />}
          onClick={fetchApprovals}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="approval tabs">
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <span>My Approvals</span>
                <Badge badgeContent={pendingCount} color="primary">
                  <Pending />
                </Badge>
              </Box>
            }
          />
          {isAdmin && (
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <span>All Approvals</span>
                  <Badge badgeContent={allPendingCount} color="secondary">
                    <Pending />
                  </Badge>
                </Box>
              }
            />
          )}
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        {pendingApprovals.length === 0 ? (
          <Alert severity="info">
            You have no pending approval requests.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {pendingApprovals.map((approval) => (
              <Grid item xs={12} md={6} lg={4} key={approval.id}>
                <ApprovalCard approval={approval} onDecision={handleDecision} />
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {isAdmin && (
        <TabPanel value={tabValue} index={1}>
          {allApprovals.length === 0 ? (
            <Alert severity="info">
              There are no pending approval requests in the system.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {allApprovals.map((approval) => (
                <Grid item xs={12} md={6} lg={4} key={approval.id}>
                  <ApprovalCard approval={approval} onDecision={handleDecision} />
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};