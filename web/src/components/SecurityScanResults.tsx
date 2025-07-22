import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore,
  Security,
  Error,
  Warning,
  Info,
  CheckCircle,
  BugReport,
  VpnKey,
  Code,
  Refresh,
  Download,
  Shield,
} from '@mui/icons-material';
import { api } from '@/services/api';

interface SecurityFinding {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  package?: string;
  version?: string;
  fixedVersion?: string;
  cve?: string;
  cwe?: string;
  owasp?: string;
  remediation?: string;
  references?: string[];
}

interface SecurityScanResult {
  id: string;
  taskId?: string;
  scanType: 'dependency' | 'code' | 'secrets' | 'container' | 'infrastructure';
  tool: string;
  timestamp: Date;
  duration: number;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  status: 'success' | 'failed' | 'partial';
  error?: string;
}

interface SecurityScanResultsProps {
  taskId: string;
  autoScan?: boolean;
}

export function SecurityScanResults({ taskId, autoScan = true }: SecurityScanResultsProps) {
  const [scanResults, setScanResults] = useState<SecurityScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | false>('');

  React.useEffect(() => {
    if (autoScan) {
      fetchSecurityScans();
    }
  }, [taskId]);

  const fetchSecurityScans = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/security/scans?taskId=${taskId}`);
      setScanResults(response.data.results);
      setError(null);
    } catch (err) {
      setError('Failed to fetch security scan results');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runSecurityScan = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/tasks/${taskId}/security-scan`);
      setScanResults(response.data.results);
      setError(null);
    } catch (err) {
      setError('Failed to run security scan');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    try {
      const response = await api.get(`/security/scans/${taskId}/report`, {
        responseType: 'text'
      });
      
      const blob = new Blob([response.data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-report-${taskId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download report:', err);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <Error color="error" />;
      case 'high': return <Warning color="error" />;
      case 'medium': return <Warning color="warning" />;
      case 'low': return <Info color="info" />;
      default: return <Info color="action" />;
    }
  };

  const getScanTypeIcon = (type: string) => {
    switch (type) {
      case 'dependency': return <BugReport />;
      case 'code': return <Code />;
      case 'secrets': return <VpnKey />;
      default: return <Security />;
    }
  };

  const getTotalFindings = () => {
    return scanResults.reduce((total, result) => 
      total + result.findings.length, 0
    );
  };

  const getSummaryBySeverity = () => {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    scanResults.forEach(result => {
      summary.critical += result.summary.critical;
      summary.high += result.summary.high;
      summary.medium += result.summary.medium;
      summary.low += result.summary.low;
      summary.info += result.summary.info;
    });

    return summary;
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" p={3}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Running security scans...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const summary = getSummaryBySeverity();
  const hasFindings = getTotalFindings() > 0;
  const hasCritical = summary.critical > 0;
  const hasHigh = summary.high > 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Shield color="primary" />
            <Typography variant="h6">
              Security Scan Results
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Run Security Scan">
              <IconButton onClick={runSecurityScan} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            {hasFindings && (
              <Tooltip title="Download Report">
                <IconButton onClick={downloadReport}>
                  <Download />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {scanResults.length === 0 && !loading && (
          <Alert severity="info">
            <AlertTitle>No Security Scans</AlertTitle>
            No security scans have been run for this task yet.
            <Button 
              size="small" 
              onClick={runSecurityScan} 
              sx={{ mt: 1 }}
              variant="outlined"
            >
              Run Security Scan
            </Button>
          </Alert>
        )}

        {hasFindings && (
          <>
            {/* Summary Alert */}
            {hasCritical && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <AlertTitle>Critical Security Issues Found</AlertTitle>
                {summary.critical} critical vulnerabilities require immediate attention!
              </Alert>
            )}
            {!hasCritical && hasHigh && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <AlertTitle>High Security Issues Found</AlertTitle>
                {summary.high} high severity vulnerabilities detected.
              </Alert>
            )}

            {/* Summary Chips */}
            <Box display="flex" gap={1} mb={2} flexWrap="wrap">
              {summary.critical > 0 && (
                <Chip
                  icon={<Error />}
                  label={`${summary.critical} Critical`}
                  color="error"
                  size="small"
                />
              )}
              {summary.high > 0 && (
                <Chip
                  icon={<Warning />}
                  label={`${summary.high} High`}
                  color="error"
                  variant="outlined"
                  size="small"
                />
              )}
              {summary.medium > 0 && (
                <Chip
                  icon={<Warning />}
                  label={`${summary.medium} Medium`}
                  color="warning"
                  size="small"
                />
              )}
              {summary.low > 0 && (
                <Chip
                  icon={<Info />}
                  label={`${summary.low} Low`}
                  color="info"
                  size="small"
                />
              )}
              {summary.info > 0 && (
                <Chip
                  icon={<Info />}
                  label={`${summary.info} Info`}
                  color="default"
                  size="small"
                />
              )}
            </Box>
          </>
        )}

        {/* Scan Results by Tool */}
        {scanResults.map((result) => (
          <Accordion
            key={result.id}
            expanded={expanded === result.id}
            onChange={(_, isExpanded) => setExpanded(isExpanded ? result.id : false)}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center" gap={2} width="100%">
                {getScanTypeIcon(result.scanType)}
                <Box flexGrow={1}>
                  <Typography variant="subtitle1">
                    {result.tool.toUpperCase()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {result.findings.length} findings • {(result.duration / 1000).toFixed(1)}s
                  </Typography>
                </Box>
                {result.status === 'failed' && (
                  <Chip label="Failed" color="error" size="small" />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {result.findings.length === 0 ? (
                <Alert severity="success" icon={<CheckCircle />}>
                  No security issues found by {result.tool}
                </Alert>
              ) : (
                <List dense>
                  {result.findings.map((finding) => (
                    <ListItem key={finding.id} alignItems="flex-start">
                      <ListItemIcon>
                        {getSeverityIcon(finding.severity)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="body2" component="span">
                              {finding.title}
                            </Typography>
                            <Chip
                              label={finding.severity.toUpperCase()}
                              size="small"
                              sx={{ ml: 1 }}
                              color={
                                finding.severity === 'critical' || finding.severity === 'high' 
                                  ? 'error' 
                                  : finding.severity === 'medium' 
                                    ? 'warning' 
                                    : 'default'
                              }
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {finding.description}
                            </Typography>
                            {finding.file && (
                              <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace' }}>
                                {finding.file}:{finding.line || 0}
                              </Typography>
                            )}
                            {finding.package && (
                              <Typography variant="caption" display="block">
                                Package: {finding.package} {finding.version}
                                {finding.fixedVersion && ` → ${finding.fixedVersion}`}
                              </Typography>
                            )}
                            {finding.cve && (
                              <Typography variant="caption" display="block">
                                CVE: {finding.cve}
                              </Typography>
                            )}
                            {finding.remediation && (
                              <Alert severity="info" sx={{ mt: 1 }}>
                                <Typography variant="caption">
                                  <strong>Remediation:</strong> {finding.remediation}
                                </Typography>
                              </Alert>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </AccordionDetails>
          </Accordion>
        ))}

        {scanResults.length > 0 && !hasFindings && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mt: 2 }}>
            <AlertTitle>All Clear!</AlertTitle>
            No security vulnerabilities were detected in this task.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}