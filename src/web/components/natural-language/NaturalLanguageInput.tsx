import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Autocomplete,
  Fade
} from '@mui/material';
import {
  Send as SendIcon,
  Lightbulb as LightbulbIcon,
  Help as HelpIcon,
  Clear as ClearIcon,
  Check as CheckIcon,
  Schedule as ScheduleIcon,
  Category as CategoryIcon,
  PriorityHigh as PriorityIcon,
  Group as GroupIcon,
  Psychology as PsychologyIcon,
  SmartToy as SmartToyIcon,
  Chat as ChatIcon,
  Code as CodeIcon,
  DataObject as DataIcon,
  Description as DocIcon,
  BugReport as BugIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface NLParseResult {
  intent: {
    action: string;
    taskType: string;
    priority: string;
    confidence: number;
    suggestedAgent?: string;
    collaborationNeeded?: boolean;
    entities: any;
  };
  task: any;
  suggestions?: string[];
  clarificationNeeded?: boolean;
  clarificationQuestions?: string[];
}

interface NaturalLanguageInputProps {
  onTaskCreate?: (task: any) => void;
  onParse?: (result: NLParseResult) => void;
  initialValue?: string;
  autoExecute?: boolean;
  showExamples?: boolean;
  showChat?: boolean;
}

const NaturalLanguageInput: React.FC<NaturalLanguageInputProps> = ({
  onTaskCreate,
  onParse,
  initialValue = '',
  autoExecute = false,
  showExamples = true,
  showChat = false
}) => {
  const [input, setInput] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<NLParseResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [autoComplete, setAutoComplete] = useState<string[]>([]);
  const [examples, setExamples] = useState<any[]>([]);
  const [chatMode, setChatMode] = useState(showChat);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string>('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Task type icons
  const taskTypeIcons: Record<string, React.ReactNode> = {
    'code-generation': <CodeIcon />,
    'data-analysis': <DataIcon />,
    'documentation': <DocIcon />,
    'testing': <BugIcon />,
    'review': <SecurityIcon />,
    'general': <PsychologyIcon />
  };

  useEffect(() => {
    if (showExamples) {
      fetchExamples();
    }
  }, [showExamples]);

  useEffect(() => {
    // Fetch autocomplete suggestions as user types
    if (input.length > 3) {
      const timer = setTimeout(() => {
        fetchSuggestions(input);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [input]);

  const fetchExamples = async () => {
    try {
      const response = await fetch('/api/nl/examples');
      const data = await response.json();
      if (data.success) {
        setExamples(data.examples);
      }
    } catch (error) {
      console.error('Failed to fetch examples:', error);
    }
  };

  const fetchSuggestions = async (partial: string) => {
    try {
      const response = await fetch('/api/nl/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partial })
      });
      const data = await response.json();
      if (data.success) {
        setAutoComplete(data.suggestions.map((s: any) => s.completion));
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const handleParse = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/nl/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      });

      const data = await response.json();

      if (data.success) {
        setParseResult(data);
        if (onParse) {
          onParse(data);
        }

        // If high confidence and no clarification needed, show confirmation
        if (!data.clarificationNeeded && data.intent.confidence > 0.8) {
          setShowConfirmDialog(true);
        }
      } else {
        setError(data.error || 'Failed to parse input');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (confirmed: boolean = false) => {
    if (!parseResult) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/nl/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          execute: autoExecute,
          confirmIntent: !confirmed
        })
      });

      const data = await response.json();

      if (data.success) {
        if (onTaskCreate) {
          onTaskCreate(data.task);
        }
        // Clear input after successful creation
        setInput('');
        setParseResult(null);
        setShowConfirmDialog(false);
      } else if (data.needsClarification) {
        setParseResult(data.parseResult);
      } else {
        setError(data.error || 'Failed to create task');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setChatHistory([...chatHistory, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/nl/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationId,
          history: chatHistory
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: data.response,
          action: data.action,
          task: data.task
        };
        setChatHistory([...chatHistory, userMessage, assistantMessage]);
        setConversationId(data.conversationId);

        if (data.action === 'create' && data.task) {
          setParseResult({
            intent: data.task.context,
            task: data.task,
            suggestions: data.suggestions
          });
        }
      }
    } catch (error) {
      setError('Failed to process message');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatMode) {
        handleChat();
      } else {
        handleParse();
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <SmartToyIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
            Natural Language Task Creation
          </Typography>
          <Tooltip title="Toggle chat mode">
            <IconButton
              onClick={() => setChatMode(!chatMode)}
              color={chatMode ? 'primary' : 'default'}
            >
              <ChatIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Show examples">
            <IconButton onClick={() => setShowAdvanced(!showAdvanced)}>
              <HelpIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Autocomplete
          freeSolo
          options={autoComplete}
          value={input}
          onChange={(event, newValue) => {
            setInput(newValue || '');
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth
              multiline
              rows={3}
              placeholder={chatMode 
                ? "Chat with me about your task..." 
                : "Describe what you want to do in natural language..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              inputRef={inputRef}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {params.InputProps.endAdornment}
                    {input && (
                      <IconButton size="small" onClick={() => setInput('')}>
                        <ClearIcon />
                      </IconButton>
                    )}
                  </>
                )
              }}
            />
          )}
        />

        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
          <Box>
            {parseResult && (
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip
                  icon={taskTypeIcons[parseResult.intent.taskType] || <CategoryIcon />}
                  label={parseResult.intent.taskType}
                  size="small"
                />
                <Chip
                  icon={<PriorityIcon />}
                  label={parseResult.intent.priority}
                  color={getPriorityColor(parseResult.intent.priority)}
                  size="small"
                />
                {parseResult.intent.suggestedAgent && (
                  <Chip
                    icon={<SmartToyIcon />}
                    label={parseResult.intent.suggestedAgent}
                    color="secondary"
                    size="small"
                  />
                )}
                {parseResult.intent.collaborationNeeded && (
                  <Chip
                    icon={<GroupIcon />}
                    label="Multi-agent"
                    color="info"
                    size="small"
                  />
                )}
                <Chip
                  label={`${Math.round(parseResult.intent.confidence * 100)}% confidence`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}
          </Box>

          <Box>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={chatMode ? handleChat : handleParse}
              disabled={!input.trim() || loading}
            >
              {chatMode ? 'Send' : 'Parse'}
            </Button>
          </Box>
        </Box>

        {/* Examples Section */}
        <Collapse in={showAdvanced}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Examples (click to use):
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {examples.slice(0, 5).map((example, index) => (
              <Chip
                key={index}
                label={example.input.length > 50 
                  ? example.input.substring(0, 50) + '...' 
                  : example.input}
                onClick={() => handleExampleClick(example.input)}
                clickable
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Collapse>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Parse Result Details */}
        {parseResult && !chatMode && (
          <Fade in>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Parsed Task Details:
                </Typography>
                
                {parseResult.clarificationNeeded && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Clarification needed:
                    </Typography>
                    {parseResult.clarificationQuestions?.map((question, index) => (
                      <Typography key={index} variant="body2">
                        • {question}
                      </Typography>
                    ))}
                  </Alert>
                )}

                {parseResult.suggestions && parseResult.suggestions.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      <LightbulbIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                      Suggestions:
                    </Typography>
                    {parseResult.suggestions.map((suggestion, index) => (
                      <Typography key={index} variant="body2" color="text.secondary">
                        • {suggestion}
                      </Typography>
                    ))}
                  </Box>
                )}

                <Typography variant="body2">
                  <strong>Prompt:</strong> {parseResult.task?.prompt}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {parseResult.task?.type}
                </Typography>
                <Typography variant="body2">
                  <strong>Priority:</strong> {parseResult.task?.priority}
                </Typography>
              </CardContent>

              {!parseResult.clarificationNeeded && (
                <CardActions>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<CheckIcon />}
                    onClick={() => handleCreateTask(true)}
                    disabled={loading}
                  >
                    Create Task
                  </Button>
                </CardActions>
              )}
            </Card>
          </Fade>
        )}

        {/* Chat History */}
        {chatMode && chatHistory.length > 0 && (
          <Paper sx={{ mt: 2, p: 2, maxHeight: 400, overflow: 'auto' }}>
            <List>
              {chatHistory.map((message, index) => (
                <ListItem key={index} alignItems="flex-start">
                  <ListItemIcon>
                    {message.role === 'user' ? <SendIcon /> : <SmartToyIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={message.role === 'user' ? 'You' : 'Assistant'}
                    secondary={message.content}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Confirm Task Creation</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to create this task?
          </Typography>
          {parseResult && (
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                <strong>Type:</strong> {parseResult.intent.taskType}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Priority:</strong> {parseResult.intent.priority}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Description:</strong> {parseResult.task?.prompt}
              </Typography>
              {autoExecute && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This task will be executed immediately after creation.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleCreateTask(true)}
            startIcon={<CheckIcon />}
          >
            Create Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NaturalLanguageInput;