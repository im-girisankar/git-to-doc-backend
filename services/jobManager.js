// In-memory job storage (use Redis/DB in production)
const jobs = new Map();

export function createJob(jobId, data) {
  jobs.set(jobId, {
    ...data,
    createdAt: new Date().toISOString()
  });
  console.log(`✅ Job created: ${jobId}`);
  console.log(`   Total jobs in memory: ${jobs.size}`);
}

export function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    console.warn(`❌ Job not found: ${jobId}`);
    console.log(`   Available jobs: ${Array.from(jobs.keys()).join(', ')}`);
  }
  return job;
}

export function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) {
    jobs.set(jobId, { ...job, ...updates, updatedAt: new Date().toISOString() });
    console.log(`📝 Job updated: ${jobId} - Status: ${updates.status || job.status}`);
  } else {
    console.error(`❌ Cannot update - Job not found: ${jobId}`);
  }
}

export function deleteJob(jobId) {
  const deleted = jobs.delete(jobId);
  console.log(`🗑️  Job deleted: ${jobId} - Success: ${deleted}`);
}

export function getAllJobs() {
  return Array.from(jobs.entries()).map(([id, job]) => ({ id, ...job }));
}

// Add function to list all jobs for debugging
export function listJobs() {
  console.log(`\n📋 Current jobs in memory: ${jobs.size}`);
  jobs.forEach((job, id) => {
    console.log(`   ${id}: ${job.status} (${job.repoUrl})`);
  });
  console.log('');
}
