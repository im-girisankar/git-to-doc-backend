import express from 'express';
import * as jobManager from '../services/jobManager.js';

const router = express.Router();

router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId,
    status: job.status,
    progress: job.progress,
    error: job.error
  });
});

router.get('/documentation/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ 
      error: 'Documentation not ready',
      status: job.status 
    });
  }

  res.json({
    jobId,
    markdown: job.markdown,
    metadata: job.metadata
  });
});

router.get('/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job || job.status !== 'completed') {
    return res.status(404).json({ error: 'Documentation not available' });
  }

  const filename = `${job.repoInfo?.name || 'documentation'}.md`;
  
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(job.markdown);
});

export default router;
