export function parsePythonFile(content, filePath) {
  const functions = [];
  const classes = [];
  const imports = [];

  // Simple regex-based parsing for Python
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect function definitions
    const funcMatch = line.match(/^def\s+(\w+)\s*\((.*?)\):/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const params = funcMatch[2].split(',').map(p => p.trim()).filter(p => p);
      
      // Get docstring if exists
      let docstring = '';
      if (lines[i + 1] && lines[i + 1].trim().startsWith('"""')) {
        let j = i + 1;
        while (j < lines.length && !lines[j].includes('"""', 3)) {
          docstring += lines[j] + '\n';
          j++;
        }
      }
      
      // Extract function body (up to 20 lines)
      const bodyLines = [];
      let j = i;
      while (j < Math.min(i + 20, lines.length) && j < lines.length) {
        bodyLines.push(lines[j]);
        j++;
        if (lines[j] && !lines[j].startsWith(' ') && !lines[j].startsWith('\t') && lines[j].trim() !== '') {
          break;
        }
      }
      
      functions.push({
        name: funcName,
        params: params,
        async: line.includes('async def'),
        lineStart: i + 1,
        code: bodyLines.join('\n'),
        docstring: docstring.trim()
      });
    }
    
    // Detect class definitions
    const classMatch = line.match(/^class\s+(\w+)(?:\(.*?\))?:/);
    if (classMatch) {
      classes.push({
        name: classMatch[1],
        lineStart: i + 1
      });
    }
    
    // Detect imports
    const importMatch = line.match(/^(?:from\s+[\w.]+\s+)?import\s+(.*)/);
    if (importMatch) {
      imports.push(importMatch[1].split(',').map(m => m.trim()));
    }
  }
  
  return { functions, classes, imports, apiEndpoints: [] };
}
