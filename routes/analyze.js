import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateGitHubUrl } from '../utils/validation.js';
import * as githubService from '../services/githubService.js';
import * as codeAnalyzer from '../services/codeAnalyzer.js';
import * as ollamaService from '../services/ollamaService.js';
import * as jobManager from '../services/jobManager.js';
import { generateMarkdown } from '../utils/markdownGenerator.js';
import * as pythonAnalyzer from '../services/pythonAnalyzer.js';
import { PROGRESS_STAGES, JOB_STATUS } from '../config/constants.js';

const router = express.Router();

router.post('/analyze', async (req, res) => {
  const { repoUrl, context } = req.body;

  console.log('📝 Analyzing repository:', repoUrl);

  // Validate GitHub URL
  const validation = validateGitHubUrl(repoUrl);
  if (!validation.isValid) {
    console.log('❌ Validation failed:', validation.error);
    return res.status(400).json({ error: validation.error });
  }

  const jobId = uuidv4();
  console.log('🆔 Job ID created:', jobId);
  
  // Create job
  jobManager.createJob(jobId, {
    repoUrl,
    context,
    status: JOB_STATUS.PROCESSING,
    progress: PROGRESS_STAGES.CLONING
  });

  // Start async processing
  processRepository(jobId, repoUrl, context).catch(error => {
    console.error('❌ Repository processing failed:', error.message);
    jobManager.updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      error: error.message
    });
  });

  res.json({
    jobId,
    status: JOB_STATUS.PROCESSING,
    message: 'Repository analysis started'
  });
});

async function processRepository(jobId, repoUrl, context) {
  try {
    // Stage 1: Parse URL and fetch repository info FIRST
    jobManager.updateJob(jobId, { progress: PROGRESS_STAGES.FETCHING });
    
    let files, repoInfo, owner, repo, readme;
    try {
      // Parse URL first
      const parsed = githubService.parseGitHubUrl(repoUrl);
      owner = parsed.owner;
      repo = parsed.repo;
      console.log(`📦 Repository: ${owner}/${repo}`);
      
      // Fetch repo info
      repoInfo = await githubService.fetchRepositoryInfo(owner, repo);
      console.log(`✅ Repository info fetched: ${repoInfo.fullName}`);
      
      // Fetch README
      readme = await githubService.fetchReadme(owner, repo);
      
      // Then fetch contents
      files = await githubService.fetchRepositoryContents(repoUrl);
      console.log(`📁 Found ${files.length} files`);
      
    } catch (error) {
      throw new Error(`GitHub Error: ${error.message}`);
    }

    if (!files || files.length === 0) {
      throw new Error('No supported code files found in repository. Looking for .js, .ts, .jsx, .tsx, .py files.');
    }

    // Stage 2: Analyze code
    jobManager.updateJob(jobId, { progress: PROGRESS_STAGES.ANALYZING });
    const analysisResults = {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      apiEndpoints: []
    };

    console.log('🔍 Starting code analysis...');
    for (const file of files) {
      jobManager.updateJob(jobId, {
        progress: { ...PROGRESS_STAGES.ANALYZING, currentFile: file.path }
      });

      try {
        if (file.language === 'JavaScript' || file.language === 'TypeScript') {
          const analysis = await codeAnalyzer.parseJavaScriptFile(file.content, file.path);
          analysisResults.functions.push(...analysis.functions);
          analysisResults.classes.push(...analysis.classes);
          analysisResults.apiEndpoints.push(...analysis.apiEndpoints);
        } else if (file.language === 'Python') {
          const analysis = pythonAnalyzer.parsePythonFile(file.content, file.path);
          analysisResults.functions.push(...analysis.functions);
          analysisResults.classes.push(...analysis.classes);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to analyze ${file.path}:`, error.message);
      }
    }

    console.log(`✅ Analysis complete: ${analysisResults.functions.length} functions, ${analysisResults.classes.length} classes, ${analysisResults.apiEndpoints.length} endpoints`);

    // Stage 3: Generate summaries and instructions
    jobManager.updateJob(jobId, { progress: PROGRESS_STAGES.GENERATING });

    console.log('🤖 Generating AI overview...');
    const overview = await ollamaService.generateProjectOverview(
      repoInfo,
      analysisResults,
      context,
      readme
    );

    console.log('🤖 Generating installation instructions...');
    const installInstructions = await ollamaService.generateInstallationInstructions(
      repoInfo,
      files,
      readme
    );

    console.log('🤖 Generating usage instructions...');
    const usageInstructions = await ollamaService.generateUsageInstructions(
      repoInfo,
      files,
      readme,
      analysisResults.functions,
      analysisResults.apiEndpoints
    );

    // Generate function summaries (limit to top 20 for performance)
    const topFunctions = analysisResults.functions.slice(0, 20);
    console.log(`🤖 Generating summaries for ${topFunctions.length} functions...`);

    // Stage 4: Format markdown
    jobManager.updateJob(jobId, { progress: PROGRESS_STAGES.FORMATTING });
    console.log('📝 Formatting markdown...');
    const markdown = generateMarkdown({
      repoInfo,
      overview,
      context,
      readme,
      files,
      functions: topFunctions,
      classes: analysisResults.classes.slice(0, 10),
      apiEndpoints: analysisResults.apiEndpoints
    });

    console.log('✅ Documentation generation complete!');

    // Complete
    jobManager.updateJob(jobId, {
      status: JOB_STATUS.COMPLETED,
      progress: PROGRESS_STAGES.COMPLETED,
      markdown,
      metadata: {
        filesAnalyzed: files.length,
        functionsFound: analysisResults.functions.length,
        classesFound: analysisResults.classes.length,
        endpointsDetected: analysisResults.apiEndpoints.length
      },
      repoInfo
    });

  } catch (error) {
    console.error('❌ Processing error:', error.message);
    jobManager.updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      error: error.message || 'Unknown error occurred'
    });
    throw error;
  }
}

export default router;
