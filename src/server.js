require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📅 Scheduler configured for: ${process.env.CRON_SCHEDULE || '0 4 * * 1-5'}`);
  
  // Start the automated scheduler
  startScheduler();
});

module.exports = app;


