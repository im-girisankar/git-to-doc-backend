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
    return ['package.json', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'pyproject.toml', 'Dockerfile'].includes(filename);
  });

  const configContent = configFiles.slice(0, 3).map(f => 
    `${f.path}:\n${f.content.slice(0, 800)}`
  ).join('\n\n');

  const existingReadme = readme ? `\n\nEXISTING README (Full Content):\n${readme}` : '\n\nNo existing README found.';

  const prompt = `You are an expert technical writer creating a comprehensive GitHub README.md file.

PROJECT INFORMATION:
- Name: ${repoInfo.fullName}
- Description: ${repoInfo.description || 'No description'}
- Language: ${repoInfo.language}
- Stars: ${repoInfo.stars}

CODE ANALYSIS:
- ${analysisResults.functions.length} functions found
- ${analysisResults.classes.length} classes found  
- ${analysisResults.apiEndpoints.length} API endpoints detected
- ${files.length} files analyzed

CONFIGURATION FILES:
${configContent}
${existingReadme}

${context ? `\nADDITIONAL CONTEXT:\n${context}` : ''}

TASK: Generate a complete, professional README.md for GitHub that includes:

## 1. PROJECT OVERVIEW
- Clear description of what the project does
- Key features and capabilities
- Problem it solves

## 2. HOW IT WORKS (Architecture/Structure)
- Explain the system architecture
- How components interact
- Key technologies and design patterns
- Data flow or processing pipeline

## 3. INSTALLATION
- Prerequisites (specific versions)
- Step-by-step installation commands
- Environment setup
- Dependencies

## 4. USAGE
- Basic usage examples with actual commands
- Configuration options
- Common use cases
- Code snippets where helpful

## 5. PROJECT STRUCTURE (if complex)
- Key directories and their purposes
- Important files

## 6. ADDITIONAL SECTIONS (if relevant)
- API Reference (if applicable)
- Contributing guidelines
- License
- Acknowledgments

IMPORTANT INSTRUCTIONS:
1. If an existing README was provided, IMPROVE and ENHANCE it by:
   - Keeping all good existing content
   - Adding missing sections
   - Clarifying unclear explanations
   - Making installation/usage more detailed
   - Improving structure and formatting

2. Write in clear, professional markdown
3. Use code blocks with proper syntax highlighting
4. Add emojis sparingly for visual appeal (📦 🚀 💡 ⚙️)
5. Be specific and detailed - this is the main documentation
6. Focus heavily on HOW IT WORKS, INSTALLATION, and USAGE
7. Make it beginner-friendly but technically accurate

Generate the complete README.md content now:`;

  try {
    console.log('📝 Generating enhanced README (no timeout, may take 1-3 minutes)...');
    
    const response = await axiosInstance.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.4, // Slightly lower for more factual output
          num_predict: 3000, // Much higher for complete README
          top_p: 0.9
        }
      }
    );

    const generatedReadme = response.data.response.trim();
    console.log(`✅ README generated successfully (${generatedReadme.length} characters)`);
    
    return generatedReadme;
  } catch (error) {
    console.error('❌ Failed to generate enhanced README:', error.message);
    
    // Fallback: Return enhanced version of existing README or basic template
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
