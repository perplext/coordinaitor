import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Fab,
  Tabs,
  Tab,
  Chip,
  Paper,
} from '@mui/material';
import {
  Add,
  TrendingUp,
  Visibility,
  ThumbUp,
  Schedule,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { KnowledgeSearch, KnowledgeSearchFilters } from '@/components/KnowledgeSearch';
import { KnowledgeCard } from '@/components/KnowledgeCard';
import { KnowledgeEditor } from '@/components/KnowledgeEditor';
import { KnowledgeEntry, KnowledgeStats } from '@/types';
import toast from 'react-hot-toast';

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
      id={`knowledge-tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export function Knowledge() {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState<KnowledgeSearchFilters>({
    query: '',
    tags: [],
    sortBy: 'relevance',
    sortOrder: 'desc',
    viewMode: 'grid',
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Fetch knowledge entries
  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['knowledge', 'entries', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.query) params.append('q', filters.query);
      if (filters.type) params.append('type', filters.type);
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','));
      if (filters.language) params.append('language', filters.language);
      if (filters.framework) params.append('framework', filters.framework);
      if (filters.difficulty) params.append('difficulty', filters.difficulty);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);
      
      const response = await apiService.axios.get(`/knowledge/search?${params}`);
      return response.data;
    },
  });

  // Fetch knowledge stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['knowledge', 'stats'],
    queryFn: async () => {
      const response = await apiService.axios.get('/knowledge/stats');
      return response.data as KnowledgeStats;
    },
  });

  // Create/Update entry mutation
  const saveMutation = useMutation({
    mutationFn: async (entry: Partial<KnowledgeEntry>) => {
      if (entry.id) {
        const response = await apiService.axios.put(`/knowledge/${entry.id}`, entry);
        return response.data;
      } else {
        const response = await apiService.axios.post('/knowledge', entry);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      toast.success(editingEntry ? 'Entry updated' : 'Entry created');
      setEditorOpen(false);
      setEditingEntry(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save entry');
    },
  });

  // Delete entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await apiService.axios.delete(`/knowledge/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      toast.success('Entry deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete entry');
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ entryId, value }: { entryId: string; value: 1 | -1 }) => {
      await apiService.axios.post(`/knowledge/${entryId}/vote`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'entries'] });
    },
  });

  const handleSearch = () => {
    queryClient.invalidateQueries({ queryKey: ['knowledge', 'entries'] });
  };

  const handleCreateNew = () => {
    setEditingEntry(null);
    setEditorOpen(true);
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  };

  const handleVote = (entryId: string, value: 1 | -1) => {
    voteMutation.mutate({ entryId, value });
  };

  const handleBookmark = (entryId: string) => {
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(entryId)) {
        newBookmarks.delete(entryId);
      } else {
        newBookmarks.add(entryId);
      }
      return newBookmarks;
    });
  };

  const entries = entriesData?.entries || [];
  const stats = statsData;

  const myEntries = entries.filter((e: KnowledgeEntry) => e.createdBy === user?.id);
  const bookmarkedEntries = entries.filter((e: KnowledgeEntry) => bookmarks.has(e.id));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Knowledge Base</Typography>
        {hasPermission('knowledge:create') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateNew}
          >
            Create Entry
          </Button>
        )}
      </Box>

      {/* Stats Overview */}
      {stats && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4">{stats.totalEntries}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Entries
                    </Typography>
                  </Box>
                  <TrendingUp color="primary" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box>
                  <Typography variant="h6">Top Languages</Typography>
                  <Box mt={1}>
                    {Object.entries(stats.entriesByLanguage)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([lang, count]) => (
                        <Chip
                          key={lang}
                          label={`${lang} (${count})`}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box>
                  <Typography variant="h6">Top Tags</Typography>
                  <Box mt={1}>
                    {stats.topTags.slice(0, 3).map(({ tag, count }) => (
                      <Chip
                        key={tag}
                        label={`${tag} (${count})`}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box>
                  <Typography variant="h6">Entry Types</Typography>
                  <Box mt={1}>
                    {Object.entries(stats.entriesByType)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([type, count]) => (
                        <Typography key={type} variant="caption" display="block">
                          {type}: {count}
                        </Typography>
                      ))}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <KnowledgeSearch
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
          popularTags={stats?.topTags}
        />
      </Paper>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
        <Tab label={`All Entries (${entries.length})`} />
        <Tab label={`My Entries (${myEntries.length})`} />
        <Tab label={`Bookmarked (${bookmarkedEntries.length})`} />
        <Tab label="Recently Viewed" />
        <Tab label="Top Rated" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {entriesLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : entries.length === 0 ? (
          <Alert severity="info">
            No entries found. Try adjusting your search filters.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {entries.map((entry: KnowledgeEntry) => (
              <Grid
                key={entry.id}
                item
                xs={12}
                md={filters.viewMode === 'grid' ? 6 : 12}
                lg={filters.viewMode === 'grid' ? 4 : 12}
              >
                <KnowledgeCard
                  entry={entry}
                  onVote={handleVote}
                  onEdit={handleEdit}
                  onDelete={deleteMutation.mutate}
                  onBookmark={handleBookmark}
                  isBookmarked={bookmarks.has(entry.id)}
                  expanded={filters.viewMode === 'list'}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          {myEntries.map((entry: KnowledgeEntry) => (
            <Grid
              key={entry.id}
              item
              xs={12}
              md={filters.viewMode === 'grid' ? 6 : 12}
              lg={filters.viewMode === 'grid' ? 4 : 12}
            >
              <KnowledgeCard
                entry={entry}
                onVote={handleVote}
                onEdit={handleEdit}
                onDelete={deleteMutation.mutate}
                onBookmark={handleBookmark}
                isBookmarked={bookmarks.has(entry.id)}
                expanded={filters.viewMode === 'list'}
              />
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
          {bookmarkedEntries.map((entry: KnowledgeEntry) => (
            <Grid
              key={entry.id}
              item
              xs={12}
              md={filters.viewMode === 'grid' ? 6 : 12}
              lg={filters.viewMode === 'grid' ? 4 : 12}
            >
              <KnowledgeCard
                entry={entry}
                onVote={handleVote}
                onEdit={handleEdit}
                onDelete={deleteMutation.mutate}
                onBookmark={handleBookmark}
                isBookmarked={true}
                expanded={filters.viewMode === 'list'}
              />
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {stats?.recentlyViewed && (
          <Grid container spacing={2}>
            {stats.recentlyViewed.map((entry: KnowledgeEntry) => (
              <Grid
                key={entry.id}
                item
                xs={12}
                md={filters.viewMode === 'grid' ? 6 : 12}
                lg={filters.viewMode === 'grid' ? 4 : 12}
              >
                <KnowledgeCard
                  entry={entry}
                  onVote={handleVote}
                  onEdit={handleEdit}
                  onDelete={deleteMutation.mutate}
                  onBookmark={handleBookmark}
                  isBookmarked={bookmarks.has(entry.id)}
                  expanded={filters.viewMode === 'list'}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        {stats?.highestRated && (
          <Grid container spacing={2}>
            {stats.highestRated.map((entry: KnowledgeEntry) => (
              <Grid
                key={entry.id}
                item
                xs={12}
                md={filters.viewMode === 'grid' ? 6 : 12}
                lg={filters.viewMode === 'grid' ? 4 : 12}
              >
                <KnowledgeCard
                  entry={entry}
                  onVote={handleVote}
                  onEdit={handleEdit}
                  onDelete={deleteMutation.mutate}
                  onBookmark={handleBookmark}
                  isBookmarked={bookmarks.has(entry.id)}
                  expanded={filters.viewMode === 'list'}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {hasPermission('knowledge:create') && (
        <Fab
          color="primary"
          aria-label="add"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          onClick={handleCreateNew}
        >
          <Add />
        </Fab>
      )}

      <KnowledgeEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingEntry(null);
        }}
        onSave={saveMutation.mutate}
        entry={editingEntry}
        mode={editingEntry ? 'edit' : 'create'}
      />
    </Box>
  );
}