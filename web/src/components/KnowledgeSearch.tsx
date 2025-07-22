import React, { useState } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  Button,
} from '@mui/material';
import {
  Search,
  Clear,
  FilterList,
  ViewList,
  ViewModule,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';

export interface KnowledgeSearchFilters {
  query: string;
  type?: string;
  tags: string[];
  language?: string;
  framework?: string;
  difficulty?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  viewMode: 'list' | 'grid';
}

interface KnowledgeSearchProps {
  filters: KnowledgeSearchFilters;
  onFiltersChange: (filters: KnowledgeSearchFilters) => void;
  onSearch: () => void;
  popularTags?: Array<{ tag: string; count: number }>;
}

export const KnowledgeSearch: React.FC<KnowledgeSearchProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  popularTags = [],
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, query: e.target.value });
  };

  const handleTypeChange = (e: any) => {
    onFiltersChange({ ...filters, type: e.target.value });
  };

  const handleLanguageChange = (e: any) => {
    onFiltersChange({ ...filters, language: e.target.value });
  };

  const handleFrameworkChange = (e: any) => {
    onFiltersChange({ ...filters, framework: e.target.value });
  };

  const handleDifficultyChange = (e: any) => {
    onFiltersChange({ ...filters, difficulty: e.target.value });
  };

  const handleSortByChange = (e: any) => {
    onFiltersChange({ ...filters, sortBy: e.target.value });
  };

  const handleSortOrderChange = () => {
    onFiltersChange({
      ...filters,
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleViewModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: 'list' | 'grid' | null
  ) => {
    if (newMode !== null) {
      onFiltersChange({ ...filters, viewMode: newMode });
    }
  };

  const handleAddTag = (tag: string) => {
    if (tag && !filters.tags.includes(tag)) {
      onFiltersChange({ ...filters, tags: [...filters.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onFiltersChange({
      ...filters,
      tags: filters.tags.filter(tag => tag !== tagToRemove),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (tagInput && e.currentTarget === document.activeElement) {
        handleAddTag(tagInput);
      } else {
        onSearch();
      }
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      query: '',
      tags: [],
      sortBy: 'relevance',
      sortOrder: 'desc',
      viewMode: filters.viewMode,
    });
  };

  return (
    <Box>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            placeholder="Search knowledge base..."
            value={filters.query}
            onChange={handleQueryChange}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: filters.query && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => onFiltersChange({ ...filters, query: '' })}
                  >
                    <Clear />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Sort By</InputLabel>
            <Select
              value={filters.sortBy}
              onChange={handleSortByChange}
              label="Sort By"
            >
              <MenuItem value="relevance">Relevance</MenuItem>
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="views">Most Viewed</MenuItem>
              <MenuItem value="votes">Highest Rated</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button
              startIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              Advanced
            </Button>
            <ToggleButtonGroup
              value={filters.viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
            >
              <ToggleButton value="list">
                <ViewList />
              </ToggleButton>
              <ToggleButton value="grid">
                <ViewModule />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Grid>
      </Grid>

      <Collapse in={showAdvanced}>
        <Box mt={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type || ''}
                  onChange={handleTypeChange}
                  label="Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="solution">Solution</MenuItem>
                  <MenuItem value="pattern">Pattern</MenuItem>
                  <MenuItem value="snippet">Code Snippet</MenuItem>
                  <MenuItem value="documentation">Documentation</MenuItem>
                  <MenuItem value="error">Error Solution</MenuItem>
                  <MenuItem value="best-practice">Best Practice</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Language</InputLabel>
                <Select
                  value={filters.language || ''}
                  onChange={handleLanguageChange}
                  label="Language"
                >
                  <MenuItem value="">All Languages</MenuItem>
                  <MenuItem value="typescript">TypeScript</MenuItem>
                  <MenuItem value="javascript">JavaScript</MenuItem>
                  <MenuItem value="python">Python</MenuItem>
                  <MenuItem value="java">Java</MenuItem>
                  <MenuItem value="go">Go</MenuItem>
                  <MenuItem value="rust">Rust</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Framework</InputLabel>
                <Select
                  value={filters.framework || ''}
                  onChange={handleFrameworkChange}
                  label="Framework"
                >
                  <MenuItem value="">All Frameworks</MenuItem>
                  <MenuItem value="react">React</MenuItem>
                  <MenuItem value="vue">Vue</MenuItem>
                  <MenuItem value="angular">Angular</MenuItem>
                  <MenuItem value="express">Express</MenuItem>
                  <MenuItem value="django">Django</MenuItem>
                  <MenuItem value="flask">Flask</MenuItem>
                  <MenuItem value="spring">Spring</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={filters.difficulty || ''}
                  onChange={handleDifficultyChange}
                  label="Difficulty"
                >
                  <MenuItem value="">All Levels</MenuItem>
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                  <MenuItem value="expert">Expert</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Box>
                <TextField
                  size="small"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag(tagInput);
                    }
                  }}
                  sx={{ mb: 1, mr: 1 }}
                />
                <Button
                  size="small"
                  onClick={() => handleAddTag(tagInput)}
                  disabled={!tagInput}
                >
                  Add Tag
                </Button>
                {filters.tags.length > 0 && (
                  <Button size="small" onClick={clearFilters} sx={{ ml: 1 }}>
                    Clear All
                  </Button>
                )}
              </Box>
              
              {filters.tags.length > 0 && (
                <Box mt={1}>
                  {filters.tags.map(tag => (
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

              {popularTags.length > 0 && (
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Popular tags:
                  </Typography>
                  {popularTags.slice(0, 10).map(({ tag, count }) => (
                    <Chip
                      key={tag}
                      label={`${tag} (${count})`}
                      onClick={() => handleAddTag(tag)}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 0.5, mb: 0.5, ml: 0.5 }}
                    />
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </Box>
      </Collapse>

      <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
        <Button variant="contained" onClick={onSearch} startIcon={<Search />}>
          Search
        </Button>
        {(filters.query || filters.tags.length > 0 || filters.type || 
          filters.language || filters.framework || filters.difficulty) && (
          <Typography variant="caption" color="text.secondary">
            Active filters: {
              [
                filters.query && 'query',
                filters.tags.length > 0 && `${filters.tags.length} tags`,
                filters.type,
                filters.language,
                filters.framework,
                filters.difficulty,
              ].filter(Boolean).join(', ')
            }
          </Typography>
        )}
      </Box>
    </Box>
  );
};