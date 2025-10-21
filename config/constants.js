export const SUPPORTED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.rb'
];

export const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '__pycache__',
  '.next',
  '.vercel'
];

export const MAX_FILES = parseInt(process.env.MAX_FILES) || 500;
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 1048576; // 1MB
export const ANALYSIS_TIMEOUT = parseInt(process.env.ANALYSIS_TIMEOUT) || 300000; // 5min

export const JOB_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const PROGRESS_STAGES = {
  CLONING: { name: 'Cloning Repository', percentage: 10 },
  FETCHING: { name: 'Fetching Files', percentage: 25 },
  ANALYZING: { name: 'Analyzing Code Structure', percentage: 50 },
  EXTRACTING: { name: 'Extracting Functions & Classes', percentage: 65 },
  GENERATING: { name: 'Generating Summaries', percentage: 80 },
  FORMATTING: { name: 'Formatting Markdown', percentage: 95 },
  COMPLETED: { name: 'Completed', percentage: 100 }
};
