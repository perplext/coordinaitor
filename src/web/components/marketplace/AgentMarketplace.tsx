import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Rating,
  Pagination,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Star as StarIcon,
  Verified as VerifiedIcon,
  Category as CategoryIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface MarketplaceAgent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  author: {
    name: string;
    organization?: string;
  };
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'subscription';
    pricePerTask?: number;
    monthlyPrice?: number;
  };
  metrics: {
    downloads: number;
    activeInstallations: number;
    averageRating: number;
    totalReviews: number;
  };
  verification: {
    isVerified: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface SearchCriteria {
  query: string;
  category: string;
  pricing: string;
  verified: boolean | null;
  minRating: number | null;
  sortBy: string;
  sortOrder: string;
}

const AgentMarketplace: React.FC = () => {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    query: '',
    category: '',
    pricing: 'all',
    verified: null,
    minRating: null,
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  const pageSize = 12;
  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'llm', label: 'Large Language Models' },
    { value: 'specialized', label: 'Specialized AI' },
    { value: 'integration', label: 'Integrations' },
    { value: 'workflow', label: 'Workflow Automation' },
    { value: 'utility', label: 'Utilities' }
  ];

  const pricingOptions = [
    { value: 'all', label: 'All Pricing' },
    { value: 'free', label: 'Free Only' },
    { value: 'paid', label: 'Paid Only' }
  ];

  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'rating', label: 'Rating' },
    { value: 'downloads', label: 'Downloads' },
    { value: 'updated', label: 'Recently Updated' },
    { value: 'name', label: 'Name' }
  ];

  useEffect(() => {
    fetchAgents();
  }, [searchCriteria, currentPage, selectedTab]);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      let endpoint = '/api/marketplace/agents';
      
      // Handle special tabs
      if (selectedTab === 1) {
        endpoint = '/api/marketplace/popular';
      } else if (selectedTab === 2) {
        endpoint = '/api/marketplace/trending';
      }

      const params = new URLSearchParams();
      
      if (selectedTab === 0) {
        // Regular search
        if (searchCriteria.query) params.append('query', searchCriteria.query);
        if (searchCriteria.category) params.append('category', searchCriteria.category);
        if (searchCriteria.pricing !== 'all') params.append('pricing', searchCriteria.pricing);
        if (searchCriteria.verified !== null) params.append('verified', String(searchCriteria.verified));
        if (searchCriteria.minRating) params.append('minRating', String(searchCriteria.minRating));
        params.append('sortBy', searchCriteria.sortBy);
        params.append('sortOrder', searchCriteria.sortOrder);
        params.append('offset', String((currentPage - 1) * pageSize));
        params.append('limit', String(pageSize));
      } else {
        // Popular/trending with basic pagination
        params.append('limit', String(pageSize));
      }

      const response = await fetch(`${endpoint}?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setAgents(data.agents);
        setTotalAgents(data.total || data.agents.length);
      } else {
        setError(data.error || 'Failed to fetch agents');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (field: keyof SearchCriteria, value: any) => {
    setSearchCriteria(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    setCurrentPage(1);
  };

  const getPricingDisplay = (pricing: MarketplaceAgent['pricing']) => {
    switch (pricing.type) {
      case 'free':
        return <Chip label="Free" color="success" size="small" />;
      case 'freemium':
        return <Chip label="Freemium" color="info" size="small" />;
      case 'paid':
        return <Chip label={`$${pricing.pricePerTask}/task`} color="warning" size="small" />;
      case 'subscription':
        return <Chip label={`$${pricing.monthlyPrice}/mo`} color="error" size="small" />;
      default:
        return <Chip label="Free" color="success" size="small" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          Agent Marketplace
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Discover and install AI agents to supercharge your workflows
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={selectedTab} onChange={handleTabChange}>
          <Tab 
            label="All Agents" 
            icon={<CategoryIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Popular" 
            icon={<DownloadIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Trending" 
            icon={<TrendingIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Search and Filters */}
      {selectedTab === 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search agents..."
                  value={searchCriteria.query}
                  onChange={(e) => handleSearchChange('query', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={searchCriteria.category}
                    label="Category"
                    onChange={(e) => handleSearchChange('category', e.target.value)}
                  >
                    {categories.map(cat => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Pricing</InputLabel>
                  <Select
                    value={searchCriteria.pricing}
                    label="Pricing"
                    onChange={(e) => handleSearchChange('pricing', e.target.value)}
                  >
                    {pricingOptions.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={searchCriteria.sortBy}
                    label="Sort By"
                    onChange={(e) => handleSearchChange('sortBy', e.target.value)}
                  >
                    {sortOptions.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <Button
                  fullWidth
                  variant={searchCriteria.verified ? "contained" : "outlined"}
                  onClick={() => handleSearchChange('verified', !searchCriteria.verified)}
                  startIcon={<VerifiedIcon />}
                  size="small"
                >
                  Verified
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Agent Grid */}
      <AnimatePresence>
        <Grid container spacing={3}>
          {agents.map((agent, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={agent.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 8
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Typography variant="h6" component="h3" fontWeight="bold" sx={{ flexGrow: 1 }}>
                        {agent.displayName}
                      </Typography>
                      {agent.verification.isVerified && (
                        <VerifiedIcon color="primary" fontSize="small" />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      by {agent.author.name}
                      {agent.author.organization && ` • ${agent.author.organization}`}
                    </Typography>

                    <Typography variant="body2" sx={{ mb: 2, minHeight: '40px' }}>
                      {agent.description}
                    </Typography>

                    <Box display="flex" alignItems="center" mb={2}>
                      <Rating 
                        value={agent.metrics.averageRating} 
                        precision={0.1} 
                        size="small" 
                        readOnly 
                      />
                      <Typography variant="body2" color="text.secondary" ml={1}>
                        ({agent.metrics.totalReviews})
                      </Typography>
                    </Box>

                    <Box display="flex" gap={0.5} mb={2} flexWrap="wrap">
                      <Chip 
                        label={agent.category} 
                        size="small" 
                        variant="outlined"
                      />
                      {agent.tags.slice(0, 2).map(tag => (
                        <Chip 
                          key={tag} 
                          label={tag} 
                          size="small" 
                          variant="outlined"
                        />
                      ))}
                    </Box>

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      {getPricingDisplay(agent.pricing)}
                      <Typography variant="body2" color="text.secondary">
                        <DownloadIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                        {formatNumber(agent.metrics.downloads)}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => {
                        // Navigate to agent details
                        window.location.href = `/marketplace/agents/${agent.id}`;
                      }}
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </AnimatePresence>

      {/* Empty State */}
      {!loading && agents.length === 0 && (
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          py={8}
        >
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No agents found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Try adjusting your search criteria or filters
          </Typography>
        </Box>
      )}

      {/* Pagination */}
      {totalAgents > pageSize && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={Math.ceil(totalAgents / pageSize)}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
          />
        </Box>
      )}
    </Container>
  );
};

export default AgentMarketplace;