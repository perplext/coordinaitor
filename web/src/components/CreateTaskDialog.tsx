import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
import { TaskRequest } from '@/types';

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (task: TaskRequest) => void;
}

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({ open, onClose, onCreate }) => {
  const [task, setTask] = useState<TaskRequest>({
    prompt: '',
    type: 'implementation',
    priority: 'medium',
    context: {},
  });

  const handleCreate = () => {
    if (task.prompt.trim()) {
      onCreate(task);
      setTask({
        prompt: '',
        type: 'implementation',
        priority: 'medium',
        context: {},
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Task</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Task Description"
            multiline
            rows={4}
            value={task.prompt}
            onChange={(e) => setTask({ ...task, prompt: e.target.value })}
            fullWidth
            required
            helperText="Describe what needs to be done"
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Task Type"
              value={task.type}
              onChange={(e) => setTask({ ...task, type: e.target.value as any })}
              fullWidth
            >
              <MenuItem value="requirement">Requirement Analysis</MenuItem>
              <MenuItem value="design">Design</MenuItem>
              <MenuItem value="implementation">Implementation</MenuItem>
              <MenuItem value="test">Testing</MenuItem>
              <MenuItem value="deployment">Deployment</MenuItem>
              <MenuItem value="review">Code Review</MenuItem>
            </TextField>

            <TextField
              select
              label="Priority"
              value={task.priority}
              onChange={(e) => setTask({ ...task, priority: e.target.value as any })}
              fullWidth
            >
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </TextField>
          </Box>

          <Typography variant="body2" color="text.secondary">
            Additional Context (Optional)
          </Typography>

          <TextField
            label="Programming Language"
            value={task.context?.language || ''}
            onChange={(e) =>
              setTask({
                ...task,
                context: { ...task.context, language: e.target.value },
              })
            }
            fullWidth
            placeholder="e.g., TypeScript, Python, Go"
          />

          <TextField
            label="Framework/Library"
            value={task.context?.framework || ''}
            onChange={(e) =>
              setTask({
                ...task,
                context: { ...task.context, framework: e.target.value },
              })
            }
            fullWidth
            placeholder="e.g., React, Django, Express"
          />

          <TextField
            label="Special Requirements"
            multiline
            rows={2}
            value={task.context?.requirements || ''}
            onChange={(e) =>
              setTask({
                ...task,
                context: { ...task.context, requirements: e.target.value },
              })
            }
            fullWidth
            placeholder="Any specific requirements or constraints"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!task.prompt.trim()}
        >
          Create Task
        </Button>
      </DialogActions>
    </Dialog>
  );
};