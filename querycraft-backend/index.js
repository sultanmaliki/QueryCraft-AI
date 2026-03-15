// index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const queryRoutes = require('./routes/query'); // keep your existing main query routes
const dbRoutes = require('./routes/db');       // new db routes (upload & execute)
const chatRoutes = require('./routes/chat');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const responseTime = require('response-time');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/querycraft';

app.use(express.json()); // parse JSON bodies

// Basic CORS you can customize
const cors = require('cors');
app.use(cors());

app.use(express.json({ limit: '1mb' }));          // parse application/json
app.use(express.urlencoded({ extended: true }));  // parse application/x-www-form-urlencoded

morgan.token('rt', (req, res) => res.getHeader('X-Response-Time') || '-');
const apiLogFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" :rt';
app.use('/api', morgan(apiLogFormat));

app.use(responseTime());

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  skip: (req) => req.originalUrl && req.originalUrl.startsWith('/api/query/demo')
});
app.use(globalLimiter);

app.use(helmet());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/query', queryRoutes); // main existing query routes stay here
app.use('/api/db', dbRoutes);       // new DB routes for upload & execute
app.use('/api/chat', chatRoutes);

// Health check
app.get('/', async (req, res) => {
  const mongoState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'QueryCraft backend is up', mongo: mongoState });
});

// Connect to Mongo and start
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Mongo connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await mongoose.disconnect();
      process.exit(0);
    });
  })
  .catch(err => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});
