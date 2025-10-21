import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateGitHubUrl } from '../utils/validation.js';
import * as githubService from '../services/githubService.js';
import * as codeAnalyzer from '../services/codeAnalyzer.js';
import * as ollamaService from '../services/ollamaService.js';
import * as jobManager from '../services/jobManager.js';
import * as pythonAnalyzer from '../services/pythonAnalyzer.js';
import { PROGRESS_STAGES, JOB_STATUS } from '../config/constants.js';

const router = express.Router();

router.post('/analyze', async (req, res) => {
  const { repoUrl, context } = req.body;

  console.log('📝 Analyzing repository:', repoUrl);

  const validation = validateGitHubUrl(repoUrl);
  if (!validation.isValid) {
    console.log('❌ Validation failed:', validation.error);
    return res.status(400).json({ error: validation.error });
  }

  const jobId = uuidv4();
  console.log('🆔 Job ID created:', jobId);
  
  jobManager.createJob(jobId, {
    repoUrl,
    context,
    status: JOB_STATUS.PROCESSING,
    progress: PROGRESS_STAGES.CLONING
  });

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
    // Stage 1: Fetch repository data
    jobManager.updateJob(jobId, { progress: PROGRESS_STAGES.FETCHING });
    
    let files, repoInfo, owner, repo, readme;
    try {
      const parsed = githubService.parseGitHubUrl(repoUrl);
      owner = parsed.owner;
      repo = parsed.repo;
      console.log(`📦 Repository: ${owner}/${repo}`);
      
      repoInfo = await githubService.fetchRepositoryInfo(owner, repo);
      console.log(`✅ Repository info fetched: ${repoInfo.fullName}`);
      
      readme = await githubService.fetchReadme(owner, repo);
      if (readme) {
        console.log(`📖 README fetched (${readme.length} characters)`);
      } else {
        console.log(`📖 No existing README - will generate from scratch`);
      }
      
      files = await githubService.fetchRepositoryContents(repoUrl);
      console.log(`📁 Found ${files.length} files`);
      
    } catch (error) {
      throw new Error(`GitHub Error: ${error.message}`);
    }

    if (!files || files.length === 0) {
      throw new Error('No supported code files found in repository.');
    }

    // Stage 2: Analyze code structure
    jobManager.updateJob(jobId, { progress: PROGRESS_STAGES.ANALYZING });
    const analysisResults = {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      apiEndpoints: []
    };

    console.log('🔍 Analyzing code structure...');
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

    console.log(`✅ Code analysis complete:`);
    console.log(`   - ${analysisResults.functions.length} functions`);
    console.log(`   - ${analysisResults.classes.length} classes`);
    console.log(`   - ${analysisResults.apiEndpoints.length} API endpoints`);

    // Stage 3: Generate comprehensive README with AI
    jobManager.updateJob(jobId, { 
      progress: { 
        name: '🤖 Generating README with AI', 
        percentage: 70 
      } 
    });

    console.log('\n' + '='.repeat(60));
    console.log('🤖 GENERATING ENHANCED README WITH AI (Ollama + Llama3)');
    console.log('   This may take 1-3 minutes for comprehensive output...');
    console.log('='.repeat(60) + '\n');

    // THIS IS THE KEY LINE - Use AI-generated README directly!
    const enhancedReadme = await ollamaService.generateEnhancedReadme(
      repoInfo,
      files,
      readme,
      analysisResults,
      context
    );

    console.log(`\n✅ README generation complete!`);
    console.log(`   Length: ${enhancedReadme.length} characters`);
    console.log(`   Lines: ${enhancedReadme.split('\n').length}\n`);

    // Store the AI-generated README directly - NO markdown generator!
    jobManager.updateJob(jobId, {
      status: JOB_STATUS.COMPLETED,
      progress: PROGRESS_STAGES.COMPLETED,
      markdown: enhancedReadme, // Direct AI output!
      metadata: {
        filesAnalyzed: files.length,
        functionsFound: analysisResults.functions.length,
        classesFound: analysisResults.classes.length,
        endpointsDetected: analysisResults.apiEndpoints.length,
        readmeLength: enhancedReadme.length,
        hadExistingReadme: !!readme
      },
      repoInfo
    });

    console.log('✅ Job completed successfully!\n');

  } catch (error) {
    console.error('❌ Processing error:', error.message);
    console.error('   Stack:', error.stack);
    jobManager.updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      error: error.message || 'Unknown error occurred'
    });
    throw error;
  }
}

export default router;
