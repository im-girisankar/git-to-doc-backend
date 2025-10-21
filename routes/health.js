import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Check Ollama connection
    const ollamaResponse = await axios.get(
      `${process.env.OLLAMA_BASE_URL}/api/tags`,
      { timeout: 5000 }
    );

    const hasModel = ollamaResponse.data.models.some(
      m => m.name.includes(process.env.OLLAMA_MODEL.split(':')[0])
    );

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        server: 'running',
        ollama: {
          status: 'connected',
          url: process.env.OLLAMA_BASE_URL,
          model: process.env.OLLAMA_MODEL,
          modelAvailable: hasModel
        },
        github: {
          status: process.env.GITHUB_TOKEN ? 'authenticated' : 'public',
          rateLimit: process.env.GITHUB_TOKEN ? '5000/hour' : '60/hour'
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Ollama service unavailable',
      details: error.message,
      instructions: [
        'Ensure Ollama is running: ollama serve',
        `Pull the model: ollama pull ${process.env.OLLAMA_MODEL}`
      ]
    });
  }
});

export default router;
