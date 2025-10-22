import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3:8b';

const axiosInstance = axios.create({
  timeout: 0  // No timeout
});

export async function generateProjectOverview(repoInfo, analysisResults, userContext, readme) {
  const contextInfo = userContext ? `\n\nUser Context: ${userContext}` : '';
  const readmeInfo = readme ? `\n\nREADME Content (first 1000 chars):\n${readme.slice(0, 1000)}` : '';
  
  const prompt = `You are a technical documentation expert. Generate a comprehensive 4-5 paragraph architectural overview of this project:

Project: ${repoInfo.fullName}
Description: ${repoInfo.description || 'No description provided'}
Primary Language: ${repoInfo.language}
Stars: ${repoInfo.stars}

Code Analysis:
- ${analysisResults.functions.length} functions found
- ${analysisResults.classes.length} classes found
- ${analysisResults.apiEndpoints.length} API endpoints detected${readmeInfo}${contextInfo}

Write a detailed architectural overview explaining:
1. What problem this project solves
2. Main components and how they work together
3. Key technologies and frameworks used
4. How users would typically interact with this project

Be specific and technical. Focus on architecture, not installation steps.`;

  try {
    const response = await axiosInstance.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.5,
          num_predict: 500
        }
      },
      { timeout: TIMEOUT }
    );

    return response.data.response.trim();
  } catch (error) {
    console.error('Failed to generate overview:', error.message);
    return readme ? readme.slice(0, 500) : `${repoInfo.description || 'A software project'} built primarily with ${repoInfo.language}.`;
  }
}

export async function generateEnhancedReadme(repoInfo, files, readme, analysisResults, context) {
  // Build prompt (same as before)
  const configFiles = files.filter(f => {
    const filename = f.path.split('/').pop();
    return ['package.json', 'requirements.txt', 'setup.py', 'pyproject.toml'].includes(filename);
  }).slice(0, 2);

  const configContent = configFiles.map(f => 
    `${f.path}:\n${f.content.slice(0, 400)}`
  ).join('\n\n');

  const readmeInfo = readme 
    ? `\n\nEXISTING README:\n${readme.slice(0, 1200)}` 
    : '\n\nNo existing README.';

  const filesList = files.slice(0, 10).map(f => f.path).join(', ');

  const prompt = `You are a technical writer creating a GitHub README.md.

PROJECT: ${repoInfo.fullName}
Language: ${repoInfo.language || 'Web/Frontend'}
Description: ${repoInfo.description || 'No description'}

FILES: ${filesList}

ANALYSIS:
- ${files.length} files analyzed${readmeInfo}

${context ? `\nNOTES: ${context}` : ''}

TASK: Write a complete README.md with:

# Project Name

## Overview (2-3 sentences)

## Features (3-5 bullet points)

## Installation
Show setup commands

## Usage
How to run/use it

## Project Structure
Brief overview

Write the complete README now:`;

  // Try up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`📝 Attempt ${attempt}/3 - Prompt: ${prompt.length} chars`);
      console.log(`🌊 Streaming from Ollama...`);
      
      const response = await axiosInstance.post(
        `${OLLAMA_BASE_URL}/api/generate`,
        {
          model: MODEL,
          prompt,
          stream: true,
          options: {
            temperature: 0.4,
            num_predict: 2000,  // Smaller
            num_ctx: 3072       // Smaller context
          }
        },
        {
          responseType: 'stream',
          timeout: 0,
          // Add connection keep-alive
          httpAgent: new (await import('http')).default.Agent({ 
            keepAlive: true,
            keepAliveMsecs: 30000
          })
        }
      );

      let fullResponse = '';
      let lastUpdate = Date.now();
      
      const result = await new Promise((resolve, reject) => {
        let timeoutHandle;
        
        // Reset timeout on each chunk
        const resetTimeout = () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          timeoutHandle = setTimeout(() => {
            console.error('⚠️  No data received for 30 seconds');
            reject(new Error('Stream timeout'));
          }, 30000); // 30 second inactivity timeout
        };
        
        resetTimeout();

        response.data.on('data', (chunk) => {
          resetTimeout(); // Reset on each chunk
          const lines = chunk.toString().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              
              if (json.response) {
                fullResponse += json.response;
                
                // Show progress every second
                const now = Date.now();
                if (now - lastUpdate > 1000) {
                  process.stdout.write('.');
                  lastUpdate = now;
                }
              }
              
              if (json.done) {
                clearTimeout(timeoutHandle);
                console.log(`\n✅ Complete: ${fullResponse.length} chars`);
                resolve(fullResponse.trim());
              }
              
            } catch (e) {
              // Skip invalid JSON
            }
          }
        });

        response.data.on('error', (error) => {
          clearTimeout(timeoutHandle);
          console.error(`❌ Stream error: ${error.message}`);
          reject(error);
        });

        response.data.on('end', () => {
          clearTimeout(timeoutHandle);
          if (fullResponse.length === 0) {
            reject(new Error('Stream ended with no data'));
          } else {
            resolve(fullResponse.trim());
          }
        });
      });

      // Success!
      if (result.length > 300) {
        return result;
      } else {
        console.warn(`⚠️  Response too short (${result.length} chars), retrying...`);
      }

    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < 3) {
        console.log(`⏳ Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // All attempts failed - use fallback
  console.log('💡 All AI attempts failed, using intelligent fallback');
  return generateFallbackReadme(repoInfo, readme, analysisResults, files);
}

function generateFallbackReadme(repoInfo, readme, analysisResults, files) {
  console.log('📝 Generating smart fallback README');
  
  // If existing README exists, enhance it
  if (readme && readme.length > 100) {
    let enhanced = `# ${repoInfo.name}\n\n${readme}\n\n`;
    
    // Add installation if missing
    if (!readme.toLowerCase().includes('install') && !readme.toLowerCase().includes('setup')) {
      enhanced += `## 🚀 Installation\n\n`;
      
      const hasPackageJson = files.some(f => f.path === 'package.json');
      const hasRequirements = files.some(f => f.path === 'requirements.txt');
      
      if (hasPackageJson) {
        enhanced += `\`\`\`bash\nnpm install\n\`\`\`\n\n`;
      } else if (hasRequirements) {
        enhanced += `\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n\n`;
      } else {
        enhanced += `Refer to the repository for setup instructions.\n\n`;
      }
    }
    
    // Add usage if missing
    if (!readme.toLowerCase().includes('usage') && !readme.toLowerCase().includes('how to')) {
      enhanced += `## 📖 Usage\n\n`;
      enhanced += `Please refer to the documentation or code comments for usage instructions.\n\n`;
    }
    
    return enhanced;
  }
  
  // Generate basic README
  const lang = repoInfo.language || 'Web';
  let markdown = `# ${repoInfo.name}\n\n`;
  
  if (repoInfo.description) {
    markdown += `${repoInfo.description}\n\n`;
  }
  
  markdown += `## 📊 Project Info\n\n`;
  markdown += `- **Language:** ${lang}\n`;
  markdown += `- **Files:** ${files.length}\n\n`;
  
  markdown += `## 🚀 Getting Started\n\n`;
  markdown += `\`\`\`bash\ngit clone https://github.com/${repoInfo.fullName}.git\n\`\`\`\n\n`;
  
  markdown += `Refer to the repository for detailed setup and usage instructions.\n\n`;
  markdown += `---\n*Generated by CodeDocs AI*\n`;
  
  return markdown;
}

// Fallback basic README generator
function generateBasicReadme(repoInfo, analysisResults, configContent) {
  return `# ${repoInfo.name}

${repoInfo.description || 'A software project'}

## 🏗️ Architecture

This project contains:
- ${analysisResults.functions.length} functions
- ${analysisResults.classes.length} classes
- ${analysisResults.apiEndpoints.length} API endpoints

Built with ${repoInfo.language}.

## 🚀 Installation

\`\`\`bash
# Clone repository
git clone https://github.com/${repoInfo.fullName}.git
cd ${repoInfo.name}

# Install dependencies (adjust based on your stack)
${repoInfo.language?.toLowerCase() === 'python' ? 'pip install -r requirements.txt' : 'npm install'}
\`\`\`

## 📖 Usage

Refer to the repository for detailed usage instructions.

## 📁 Project Structure

See code analysis for details.

---

*Generated by CodeDocs AI*
`;
}

// Keep other existing functions with increased limits
export async function generateSummary(code, type, name) {
  const prompt = `You are a technical documentation expert. Analyze this ${type} named "${name}" and provide a concise 1-2 sentence description of what it does.

Code:
\`\`\`
${code.slice(0, 1500)}
\`\`\`

Provide ONLY the description, no additional text.`;

  try {
    const response = await axiosInstance.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 200
        }
      }
    );

    return response.data.response.trim();
  } catch (error) {
    console.error(`Failed to generate summary for ${name}:`, error.message);
    return `A ${type} that performs ${name} operations.`;
  }
}


export async function generateInstallationInstructions(repoInfo, files, readme) {
  // Find relevant configuration files
  const configFiles = files.filter(f => {
    const filename = f.path.split('/').pop();
    return ['package.json', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json', 'pyproject.toml'].includes(filename);
  });

  const configContent = configFiles.slice(0, 3).map(f => `${f.path}:\n${f.content.slice(0, 500)}`).join('\n\n');
  const readmeExcerpt = readme ? readme.slice(0, 1000) : 'No README available';

  const prompt = `You are a technical documentation expert. Generate clear, accurate installation instructions for this project.

Project: ${repoInfo.fullName}
Language: ${repoInfo.language}
Description: ${repoInfo.description || 'No description'}

Configuration Files Found:
${configContent || 'No configuration files detected'}

README Excerpt:
${readmeExcerpt}

Generate installation instructions that include:
1. Prerequisites (languages, tools, versions)
2. Step-by-step installation commands
3. Any environment setup needed (virtual environments, etc.)
4. How to verify the installation

Format as markdown with code blocks. Be specific to THIS project based on the files you see. Keep it concise (max 15 lines).`;

  try {
    const response = await axiosInstance.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 400
        }
      },
      { timeout: TIMEOUT }
    );

    return response.data.response.trim();
  } catch (error) {
    console.error('Failed to generate installation instructions:', error.message);
    return getFallbackInstructions(repoInfo.language);
  }
}

export async function generateUsageInstructions(repoInfo, files, readme, functions, apiEndpoints) {
  const mainFiles = files.filter(f => 
    f.path.match(/main\.|app\.|index\.|__main__\.py|server\.|cli\./i)
  ).slice(0, 3);

  const mainFileInfo = mainFiles.map(f => 
    `${f.path}:\n${f.content.slice(0, 300)}`
  ).join('\n\n');

  const hasAPI = apiEndpoints && apiEndpoints.length > 0;
  const hasCLI = functions && functions.some(f => f.name.includes('main') || f.name.includes('cli'));

  const prompt = `You are a technical documentation expert. Generate clear usage instructions for this project.

Project: ${repoInfo.fullName}
Type: ${hasAPI ? 'API/Web Service' : hasCLI ? 'CLI Tool' : 'Library/Module'}
Language: ${repoInfo.language}

Main Entry Points:
${mainFileInfo || 'Not clearly identified'}

${hasAPI ? `API Endpoints Found: ${apiEndpoints.length}` : ''}
${functions ? `Functions Found: ${functions.length}` : ''}

Generate usage instructions that show:
1. How to run/start the project
2. Basic usage examples with actual commands
3. Common commands or API calls
4. Configuration options (if any)

Format as markdown with code blocks. Be specific based on the code structure. Keep it concise (max 15 lines).`;

  try {
    const response = await axiosInstance.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 400
        }
      },
      { timeout: TIMEOUT }
    );

    return response.data.response.trim();
  } catch (error) {
    console.error('Failed to generate usage instructions:', error.message);
    return 'Refer to the repository README for usage instructions.';
  }
}

function getFallbackInstructions(language) {
  const lang = language?.toLowerCase();
  
  if (lang === 'python') {
    return `\`\`\`bash\npip install -r requirements.txt\n\`\`\``;
  } else if (lang === 'javascript' || lang === 'typescript') {
    return `\`\`\`bash\nnpm install\n\`\`\``;
  } else if (lang === 'go') {
    return `\`\`\`bash\ngo mod download\n\`\`\``;
  } else if (lang === 'rust') {
    return `\`\`\`bash\ncargo build\n\`\`\``;
  } else {
    return `Refer to the repository README for installation instructions.`;
  }
}
