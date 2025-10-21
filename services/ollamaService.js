import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3:8b';
const TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT) || 60000;

const axiosInstance = axios.create();

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
  const configFiles = files.filter(f => {
    const filename = f.path.split('/').pop();
    return ['package.json', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'pyproject.toml', 'Dockerfile', '.env.example'].includes(filename);
  });

  const configContent = configFiles.slice(0, 3).map(f => 
    `${f.path}:\n${f.content.slice(0, 800)}`
  ).join('\n\n');

  // Include full README if it exists
  const existingReadme = readme ? `\n\nEXISTING README CONTENT:\n${readme}` : '\n\nNo existing README found. Generate a comprehensive one from scratch.';

  // Get sample of main files
  const mainFiles = files.filter(f => 
    f.path.match(/server\.|index\.|main\.|app\.|api\./i) && 
    (f.language === 'JavaScript' || f.language === 'TypeScript' || f.language === 'Python')
  ).slice(0, 3);

  const codeExamples = mainFiles.map(f => 
    `File: ${f.path}\n${f.content.slice(0, 1000)}`
  ).join('\n\n---\n\n');

  const prompt = `You are an expert technical writer creating a comprehensive, professional GitHub README.md file.

PROJECT DETAILS:
- Repository: ${repoInfo.fullName}
- Description: ${repoInfo.description || 'No description provided'}
- Primary Language: ${repoInfo.language}
- GitHub Stars: ${repoInfo.stars}

CODE ANALYSIS RESULTS:
- Total Files: ${files.length}
- Functions: ${analysisResults.functions.length}
- Classes: ${analysisResults.classes.length}
- API Endpoints: ${analysisResults.apiEndpoints.length}

KEY CONFIGURATION FILES:
${configContent || 'No configuration files found'}

SAMPLE CODE FROM MAIN FILES:
${codeExamples || 'No main entry files identified'}
${existingReadme}

${context ? `\nADDITIONAL USER CONTEXT:\n${context}` : ''}

TASK: Generate a complete, professional README.md for this GitHub repository.

CRITICAL REQUIREMENTS:
1. If an EXISTING README was provided above:
   - Read it completely and understand the project
   - Keep ALL good existing content
   - Enhance and improve unclear sections
   - Add any missing critical sections
   - Improve formatting and structure

2. If NO existing README (generate from scratch):
   - Analyze the code structure and configuration files
   - Create comprehensive documentation

REQUIRED SECTIONS (in this order):

# [Project Name]

## 📖 Overview
- Clear 2-3 sentence description of what this project does
- What problem it solves
- Key capabilities

## ✨ Features
- Bullet list of main features (3-8 items)
- What makes this project useful

## 🏗️ Architecture / How It Works
- Explain the system architecture in 2-3 paragraphs
- How components interact
- Key design patterns or technologies
- Data flow or request/response cycle
- Be technical but clear

## 🚀 Installation

### Prerequisites
- List required software, versions
- Required tools (Node.js, Python, Ollama, etc.)

### Setup Steps
\`\`\`bash
# Provide actual, working commands
# Include cloning, dependency installation, configuration
\`\`\`

## 📖 Usage

### Basic Usage
\`\`\`bash
# Show how to run/start the application
# Include actual commands with examples
\`\`\`

### Configuration
- Explain any .env variables
- Configuration options

### Examples (if applicable)
- Show common use cases with actual code/commands

## 📁 Project Structure (if relevant)
\`\`\`
# Show key directories and what they contain
\`\`\`

## 🔌 API Reference (if this is an API)
${analysisResults.apiEndpoints.length > 0 ? `
List the ${analysisResults.apiEndpoints.length} API endpoints with:
- Method and path
- Description
- Parameters
- Response format
` : '# Skip this section if not an API'}

## 🤝 Contributing (optional)
Brief note on how to contribute

## 📄 License (if known)
Mention license

## 🙏 Acknowledgments (if relevant)
Credit any dependencies or inspiration

FORMATTING RULES:
- Use proper markdown with code blocks
- Add emojis to section headers (📦 🚀 💡 ⚙️ 🔧 📖)
- Use \`\`\`bash, \`\`\`javascript, \`\`\`python for code blocks
- Make it visually appealing and scannable
- Be specific and detailed - don't be vague
- Focus especially on "How It Works", "Installation", and "Usage"

IMPORTANT: Generate the COMPLETE README now. Do not truncate. Write at least 200 lines of quality documentation.`;

  try {
    console.log('📝 Calling Ollama API for README generation...');
    console.log(`   Model: ${MODEL}`);
    console.log(`   No timeout set - will wait as long as needed`);
    
    const response = await axiosInstance.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 3500, // Increased even more
          top_p: 0.9,
          top_k: 50
        }
      }
    );

    const generatedReadme = response.data.response.trim();
    
    console.log(`✅ README generated successfully!`);
    console.log(`   Characters: ${generatedReadme.length}`);
    console.log(`   Lines: ${generatedReadme.split('\n').length}`);
    
    // Validate it's not too short
    if (generatedReadme.length < 500) {
      console.warn('⚠️  README seems too short, using fallback...');
      return generateBasicReadme(repoInfo, analysisResults, configContent);
    }
    
    return generatedReadme;
  } catch (error) {
    console.error('❌ Failed to generate enhanced README:', error.message);
    console.error('   Stack:', error.stack);
    
    // Fallback
    if (readme) {
      return `# ${repoInfo.name}\n\n${readme}`;
    }
    
    return generateBasicReadme(repoInfo, analysisResults, configContent);
  }
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
