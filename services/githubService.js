import axios from 'axios';
import { SUPPORTED_EXTENSIONS, EXCLUDE_PATTERNS, MAX_FILES } from '../config/constants.js';

const GITHUB_API = 'https://api.github.com';

const headers = {
  'Accept': 'application/vnd.github.v3+json',
  ...(process.env.GITHUB_TOKEN && {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`
  })
};

export function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '')
  };
}

export async function fetchRepositoryInfo(owner, repo) {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}`,
      { headers }
    );
    
    return {
      name: response.data.name,
      fullName: response.data.full_name,
      description: response.data.description,
      language: response.data.language,
      stars: response.data.stargazers_count,
      defaultBranch: response.data.default_branch
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" not found. Please check the URL.`);
    } else if (error.response?.status === 403) {
      throw new Error(`Access forbidden. The repository might be private or rate limit exceeded.`);
    } else {
      throw new Error(`Failed to fetch repository: ${error.message}`);
    }
  }
}

export async function fetchReadme(owner, repo) {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      { 
        headers: {
          ...headers,
          'Accept': 'application/vnd.github.v3.raw' // Get raw markdown
        }
      }
    );
    
    console.log('📖 README fetched successfully');
    return response.data;
  } catch (error) {
    console.warn('⚠️  No README found');
    return null;
  }
}


export async function fetchRepositoryContents(repoUrl) {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  
  try {
    // First get repo info to get default branch
    const repoInfo = await fetchRepositoryInfo(owner, repo);
    
    // Use Git Trees API for recursive fetch
    const response = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${repoInfo.defaultBranch}?recursive=1`,
      { headers }
    );

    const tree = response.data.tree;
    const files = [];

    for (const item of tree) {
      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(pattern => item.path.includes(pattern))) {
        continue;
      }

      // Only process supported file types
      if (item.type === 'blob' && SUPPORTED_EXTENSIONS.some(ext => item.path.endsWith(ext))) {
        if (files.length >= MAX_FILES) {
          console.warn(`⚠️  Reached max files limit (${MAX_FILES})`);
          break;
        }

        try {
          const content = await fetchFileContent(owner, repo, item.sha);
          files.push({
            path: item.path,
            content,
            size: item.size,
            language: detectLanguage(item.path)
          });
        } catch (error) {
          console.warn(`⚠️  Failed to fetch ${item.path}:`, error.message);
        }
      }
    }

    if (files.length === 0) {
      throw new Error('No supported files found in repository. Looking for: ' + SUPPORTED_EXTENSIONS.join(', '));
    }

    return files;
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('No supported files')) {
      throw error;
    }
    throw new Error(`Failed to fetch repository contents: ${error.message}`);
  }
}

async function fetchFileContent(owner, repo, sha) {
  const response = await axios.get(
    `${GITHUB_API}/repos/${owner}/${repo}/git/blobs/${sha}`,
    { headers }
  );

  // Decode base64 content
  return Buffer.from(response.data.content, 'base64').toString('utf-8');
}

function detectLanguage(filepath) {
  const ext = filepath.split('.').pop();
  const languageMap = {
    'js': 'JavaScript',
    'jsx': 'JavaScript',
    'ts': 'TypeScript',
    'tsx': 'TypeScript',
    'py': 'Python',
    'java': 'Java',
    'go': 'Go',
    'rs': 'Rust',
    'rb': 'Ruby'
  };
  return languageMap[ext] || 'Unknown';
}
