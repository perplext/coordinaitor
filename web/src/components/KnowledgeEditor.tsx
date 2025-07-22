import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Autocomplete,
  Tab,
  Tabs,
} from '@mui/material';
import { KnowledgeEntry } from '@/types';
import MDEditor from '@uiw/react-md-editor';

interface KnowledgeEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: Partial<KnowledgeEntry>) => void;
  entry?: KnowledgeEntry | null;
  mode: 'create' | 'edit';
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
      id={`editor-tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const languageOptions = [
  'typescript', 'javascript', 'python', 'java', 'go', 'rust', 
  'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin'
];

const frameworkOptions = [
  'react', 'vue', 'angular', 'express', 'django', 'flask', 
  'spring', 'rails', 'laravel', 'nextjs', 'nuxtjs', 'gatsby'
];

const categoryOptions = [
  'frontend', 'backend', 'fullstack', 'mobile', 'devops', 
  'database', 'security', 'testing', 'architecture', 'performance'
];

export const KnowledgeEditor: React.FC<KnowledgeEditorProps> = ({
  open,
  onClose,
  onSave,
  entry,
  mode,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'solution' as KnowledgeEntry['type'],
    tags: [] as string[],
    language: '',
    framework: '',
    category: '',
    difficulty: '',
    isPublic: true,
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (entry && mode === 'edit') {
      setFormData({
        title: entry.title,
        content: entry.content,
        type: entry.type,
        tags: entry.tags,
        language: entry.metadata.language || '',
        framework: entry.metadata.framework || '',
        category: entry.metadata.category || '',
        difficulty: entry.metadata.difficulty || '',
        isPublic: entry.isPublic,
      });
    } else if (mode === 'create') {
      setFormData({
        title: '',
        content: '',
        type: 'solution',
        tags: [],
        language: '',
        framework: '',
        category: '',
        difficulty: '',
        isPublic: true,
      });
    }
  }, [entry, mode, open]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleAddTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      handleChange('tags', [...formData.tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }
    
    if (formData.tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const entryData: Partial<KnowledgeEntry> = {
      title: formData.title,
      content: formData.content,
      type: formData.type,
      tags: formData.tags,
      isPublic: formData.isPublic,
      metadata: {
        language: formData.language || undefined,
        framework: formData.framework || undefined,
        category: formData.category || undefined,
        difficulty: formData.difficulty as any || undefined,
      },
    };

    if (mode === 'edit' && entry) {
      entryData.id = entry.id;
    }

    onSave(entryData);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getPreviewContent = () => {
    let preview = `# ${formData.title}\n\n`;
    preview += `**Type:** ${formData.type}\n`;
    if (formData.language) preview += `**Language:** ${formData.language}\n`;
    if (formData.framework) preview += `**Framework:** ${formData.framework}\n`;
    if (formData.difficulty) preview += `**Difficulty:** ${formData.difficulty}\n`;
    preview += `\n${formData.content}\n\n`;
    preview += `**Tags:** ${formData.tags.join(', ')}`;
    return preview;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === 'create' ? 'Create Knowledge Entry' : 'Edit Knowledge Entry'}
      </DialogTitle>
      
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Content" />
          <Tab label="Metadata" />
          <Tab label="Preview" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TextField
            fullWidth
            label="Title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            margin="normal"
            required
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              label="Type"
            >
              <MenuItem value="solution">Solution</MenuItem>
              <MenuItem value="pattern">Pattern</MenuItem>
              <MenuItem value="snippet">Code Snippet</MenuItem>
              <MenuItem value="documentation">Documentation</MenuItem>
              <MenuItem value="error">Error Solution</MenuItem>
              <MenuItem value="best-practice">Best Practice</MenuItem>
            </Select>
          </FormControl>

          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Content *
            </Typography>
            <MDEditor
              value={formData.content}
              onChange={(value) => handleChange('content', value || '')}
              preview="edit"
              height={300}
            />
            {errors.content && (
              <Typography variant="caption" color="error">
                {errors.content}
              </Typography>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={languageOptions}
                value={formData.language}
                onChange={(_, value) => handleChange('language', value || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Language" margin="normal" />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={frameworkOptions}
                value={formData.framework}
                onChange={(_, value) => handleChange('framework', value || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Framework" margin="normal" />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">None</MenuItem>
                  {categoryOptions.map(cat => (
                    <MenuItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={formData.difficulty}
                  onChange={(e) => handleChange('difficulty', e.target.value)}
                  label="Difficulty"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                  <MenuItem value="expert">Expert</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              Tags *
            </Typography>
            <Box display="flex" gap={1} mb={1}>
              <TextField
                size="small"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
              />
              <Button
                size="small"
                onClick={() => handleAddTag(tagInput)}
                disabled={!tagInput}
              >
                Add
              </Button>
            </Box>
            {formData.tags.length > 0 && (
              <Box>
                {formData.tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            )}
            {errors.tags && (
              <Typography variant="caption" color="error">
                {errors.tags}
              </Typography>
            )}
          </Box>

          <Box mt={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPublic}
                  onChange={(e) => handleChange('isPublic', e.target.checked)}
                />
              }
              label="Public (visible to all users)"
            />
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              minHeight: 400,
              bgcolor: 'background.paper',
            }}
          >
            <MDEditor.Markdown source={getPreviewContent()} />
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};