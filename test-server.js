const express = require('express');
const app = express();
const port = 3001;

// Middleware
app.use(express.json());

// Test endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Start server
app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET /health');
  console.log('  GET /api/test');
});