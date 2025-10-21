process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.js';
import analyzeRoutes from './routes/analyze.js';
import documentationRoutes from './routes/documentation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api', analyzeRoutes);
app.use('/api', documentationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 CodeDocs Backend Server Running`);
  console.log(`   ├─ Server: http://localhost:${PORT}`);
  console.log(`   ├─ Ollama: ${process.env.OLLAMA_BASE_URL}`);
  console.log(`   └─ Model: ${process.env.OLLAMA_MODEL}\n`);
});
