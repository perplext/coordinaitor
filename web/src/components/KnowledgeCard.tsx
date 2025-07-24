import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ThumbUp,
  ThumbDown,
  Visibility,
  Code,
  Description,
  BugReport,
  Psychology,
  Lightbulb,
  Error,
  MoreVert,
  Edit,
  Delete,
  Share,
  BookmarkBorder,
  Bookmark,
  ContentCopy,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { KnowledgeEntry } from '@/types';
import { error as logError } from '@/utils/logger';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  onVote: (entryId: string, value: 1 | -1) => void;
  onEdit: (entry: KnowledgeEntry) => void;
  onDelete: (entryId: string) => void;
  onBookmark: (entryId: string) => void;
  isBookmarked: boolean;
  expanded?: boolean;
}

const typeIcons: Record<KnowledgeEntry['type'], React.ReactNode> = {
  solution: <Lightbulb />,
  pattern: <Psychology />,
  snippet: <Code />,
  documentation: <Description />,
  error: <BugReport />,
  'best-practice': <Error />,
};

const typeColors: Record<KnowledgeEntry['type'], string> = {
  solution: '#4CAF50',
  pattern: '#2196F3',
  snippet: '#FF9800',
  documentation: '#9C27B0',
  error: '#F44336',
  'best-practice': '#00BCD4',
};

export const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
  entry,
  onVote,
  onEdit,
  onDelete,
  onBookmark,
  isBookmarked,
  expanded: initialExpanded = false,
}) => {
  const { user } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const isOwner = user?.id === entry.createdBy;
  const canEdit = isOwner || user?.roles.some(r => r.id === 'admin');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      logError('Failed to copy knowledge entry content', {
        entryId: entry.id,
        operation: 'copyContent'
      }, err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/knowledge/${entry.id}`;
    navigator.clipboard.writeText(url);
    handleMenuClose();
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'info';
      case 'hard': return 'warning';
      case 'expert': return 'error';
      default: return 'default';
    }
  };

  const renderContent = () => {
    const content = entry.content;
    const isCode = entry.type === 'snippet' || 
                   content.includes('```') || 
                   entry.metadata.language;

    if (isCode && entry.metadata.language) {
      return (
        <Box sx={{ position: 'relative' }}>
          <SyntaxHighlighter
            language={entry.metadata.language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: 4,
              fontSize: '0.875rem',
              maxHeight: expanded ? 'none' : 300,
              overflow: 'auto',
            }}
          >
            {content}
          </SyntaxHighlighter>
          <Tooltip title={copySuccess ? 'Copied!' : 'Copy code'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'background.paper',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      );
    }

    const truncated = !expanded && content.length > 500;
    const displayContent = truncated ? content.substring(0, 500) + '...' : content;

    return (
      <Box>
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {displayContent}
        </Typography>
        {truncated && (
          <Button
            size="small"
            onClick={() => setExpanded(true)}
            startIcon={<ExpandMore />}
            sx={{ mt: 1 }}
          >
            Show More
          </Button>
        )}
        {expanded && content.length > 500 && (
          <Button
            size="small"
            onClick={() => setExpanded(false)}
            startIcon={<ExpandLess />}
            sx={{ mt: 1 }}
          >
            Show Less
          </Button>
        )}
      </Box>
    );
  };

  return (
    <>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s',
          '&:hover': {
            boxShadow: 3,
          },
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  color: typeColors[entry.type],
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {typeIcons[entry.type]}
              </Box>
              <Typography variant="h6" component="h3">
                {entry.title}
              </Typography>
            </Box>
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>
          </Box>

          <Box display="flex" gap={0.5} mb={2} flexWrap="wrap">
            <Chip
              label={entry.type}
              size="small"
              sx={{
                bgcolor: typeColors[entry.type],
                color: 'white',
              }}
            />
            {entry.metadata.language && (
              <Chip
                label={entry.metadata.language}
                size="small"
                variant="outlined"
              />
            )}
            {entry.metadata.framework && (
              <Chip
                label={entry.metadata.framework}
                size="small"
                variant="outlined"
              />
            )}
            {entry.metadata.difficulty && (
              <Chip
                label={entry.metadata.difficulty}
                size="small"
                color={getDifficultyColor(entry.metadata.difficulty)}
              />
            )}
            {!entry.isPublic && (
              <Chip
                label="Private"
                size="small"
                color="warning"
              />
            )}
          </Box>

          {renderContent()}

          {entry.tags.length > 0 && (
            <Box mt={2}>
              {entry.tags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              ))}
            </Box>
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(entry.createdAt), 'MMM d, yyyy')}
              {entry.source?.author && ` by ${entry.source.author}`}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Visibility fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {entry.metadata.views || 0}
              </Typography>
            </Box>
          </Box>
        </CardContent>

        <Divider />

        <CardActions sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" gap={1}>
            <Tooltip title="Upvote">
              <IconButton
                size="small"
                onClick={() => onVote(entry.id, 1)}
                color={entry.userVote === 1 ? 'primary' : 'default'}
              >
                <ThumbUp fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
              {entry.metadata.votes || 0}
            </Typography>
            <Tooltip title="Downvote">
              <IconButton
                size="small"
                onClick={() => onVote(entry.id, -1)}
                color={entry.userVote === -1 ? 'primary' : 'default'}
              >
                <ThumbDown fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Tooltip title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
            <IconButton
              size="small"
              onClick={() => onBookmark(entry.id)}
              color={isBookmarked ? 'primary' : 'default'}
            >
              {isBookmarked ? <Bookmark /> : <BookmarkBorder />}
            </IconButton>
          </Tooltip>
        </CardActions>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleShare}>
          <Share fontSize="small" sx={{ mr: 1 }} />
          Share
        </MenuItem>
        {canEdit && (
          <MenuItem onClick={() => { onEdit(entry); handleMenuClose(); }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {canEdit && (
          <MenuItem onClick={() => { setShowDeleteDialog(true); handleMenuClose(); }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete Knowledge Entry</DialogTitle>
        <DialogContent>
          Are you sure you want to delete "{entry.title}"? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onDelete(entry.id);
              setShowDeleteDialog(false);
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};