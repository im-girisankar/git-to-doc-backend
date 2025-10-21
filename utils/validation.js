export function validateGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
  
  if (!githubPattern.test(url)) {
    return { 
      isValid: false, 
      error: 'Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)' 
    };
  }

  return { isValid: true };
}
