import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';

export async function parseJavaScriptFile(content, filePath) {
  const functions = [];
  const classes = [];
  const apiEndpoints = [];

  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy']
    });

    traverse.default(ast, {
      FunctionDeclaration(path) {
        functions.push(extractFunctionInfo(path, content));
      },
      ArrowFunctionExpression(path) {
        if (path.parent.type === 'VariableDeclarator') {
          functions.push(extractFunctionInfo(path, content, path.parent.id.name));
        }
      },
      ClassDeclaration(path) {
        classes.push({
          name: path.node.id.name,
          lineStart: path.node.loc.start.line,
          lineEnd: path.node.loc.end.line
        });
      },
      CallExpression(path) {
        const endpoint = detectAPIEndpoint(path);
        if (endpoint) {
          apiEndpoints.push({ ...endpoint, file: filePath });
        }
      }
    });
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error.message);
  }

  return { functions, classes, apiEndpoints };
}

function extractFunctionInfo(path, content, name = null) {
  const node = path.node;
  const funcName = name || node.id?.name || 'anonymous';
  
  const params = node.params.map(param => {
    if (param.type === 'Identifier') return param.name;
    if (param.type === 'RestElement') return `...${param.argument.name}`;
    return 'param';
  });

  const lines = content.split('\n');
  const funcCode = lines
    .slice(node.loc.start.line - 1, Math.min(node.loc.end.line, node.loc.start.line + 20))
    .join('\n');

  return {
    name: funcName,
    params,
    async: node.async || false,
    lineStart: node.loc.start.line,
    lineEnd: node.loc.end.line,
    code: funcCode
  };
}

function detectAPIEndpoint(path) {
  const callee = path.node.callee;
  
  // Detect Express: app.get(), router.post(), etc.
  if (callee.type === 'MemberExpression') {
    const method = callee.property.name;
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
    
    if (httpMethods.includes(method)) {
      const args = path.node.arguments;
      if (args.length > 0 && args[0].type === 'StringLiteral') {
        return {
          method: method.toUpperCase(),
          path: args[0].value,
          handler: args[1]?.name || 'handler'
        };
      }
    }
  }
  
  return null;
}
