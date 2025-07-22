import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';
import { ProjectRequest } from '@/types';
import { useProjects } from '@/hooks/useProjects';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ open, onClose }) => {
  const { createProject, isCreating } = useProjects();
  const [tabValue, setTabValue] = useState(0);
  const [project, setProject] = useState<ProjectRequest>({
    name: '',
    description: '',
    prd: '',
  });

  const handleCreate = () => {
    if (project.name.trim() && project.description.trim()) {
      createProject(project);
      setProject({ name: '', description: '', prd: '' });
      onClose();
    }
  };

  const prdTemplate = `# Project Requirements Document

## Overview
[Provide a brief overview of the project]

## Objectives
- [Objective 1]
- [Objective 2]
- [Objective 3]

## Functional Requirements
### Feature 1
- [Requirement 1.1]
- [Requirement 1.2]

### Feature 2
- [Requirement 2.1]
- [Requirement 2.2]

## Non-Functional Requirements
- Performance: [Specify performance requirements]
- Security: [Specify security requirements]
- Scalability: [Specify scalability requirements]

## Technical Stack
- Frontend: [Technologies]
- Backend: [Technologies]
- Database: [Technologies]
- Infrastructure: [Technologies]

## Timeline
- Phase 1: [Description] - [Duration]
- Phase 2: [Description] - [Duration]
- Phase 3: [Description] - [Duration]

## Success Criteria
- [Criterion 1]
- [Criterion 2]
- [Criterion 3]`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Project</DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="Basic Information" />
            <Tab label="PRD (Optional)" />
          </Tabs>
        </Box>

        {tabValue === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Project Name"
              value={project.name}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              fullWidth
              required
              autoFocus
              helperText="Give your project a clear, descriptive name"
            />

            <TextField
              label="Project Description"
              multiline
              rows={4}
              value={project.description}
              onChange={(e) => setProject({ ...project, description: e.target.value })}
              fullWidth
              required
              helperText="Describe the project's goals and scope"
            />

            <Typography variant="body2" color="text.secondary">
              After creating the project, the AI will automatically decompose it into tasks based on your description.
            </Typography>
          </Box>
        )}

        {tabValue === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Add a Product Requirements Document (PRD) for more detailed task decomposition.
            </Typography>

            <Button
              variant="outlined"
              onClick={() => setProject({ ...project, prd: prdTemplate })}
              disabled={!!project.prd}
            >
              Use PRD Template
            </Button>

            <TextField
              label="Product Requirements Document"
              multiline
              rows={12}
              value={project.prd}
              onChange={(e) => setProject({ ...project, prd: e.target.value })}
              fullWidth
              placeholder="Enter your PRD in markdown format..."
              sx={{ fontFamily: 'monospace' }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!project.name.trim() || !project.description.trim() || isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};