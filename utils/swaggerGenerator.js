const fs = require('fs');
const path = require('path');

function buildSpec() {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Event Ticket API',
      version: '1.0.0',
      description: 'Auto-generated OpenAPI spec (basic) for Event Ticket Project',
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 5000}` }
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  };

  // Read server.js to find route variable -> file and mount path mapping
  try {
    const serverPath = path.resolve(__dirname, '..', 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    const requireRegex = /const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/(\w+)['"]\);/g;
    const requires = {};
    let m;
    while ((m = requireRegex.exec(serverContent)) !== null) {
      requires[m[1]] = m[2];
    }

    const mountRegex = /app\.use\(['"]([^'"]+)['"]\s*,\s*(\w+)\)/g;
    const mounts = {};
    while ((m = mountRegex.exec(serverContent)) !== null) {
      mounts[m[2]] = m[1];
    }

    // For each required route variable, parse its route file
    for (const varName of Object.keys(requires)) {
      const routeFileName = requires[varName] + '.js';
      const routePath = path.resolve(__dirname, '..', 'routes', routeFileName);
      if (!fs.existsSync(routePath)) continue;
      const routeContent = fs.readFileSync(routePath, 'utf8');
      const lines = routeContent.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
        if (routeMatch) {
          const method = routeMatch[1];
          let routeSubPath = routeMatch[2];

          // look up to 6 lines above for @desc and @access
          let desc = '';
          let access = '';
          for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
            const l = lines[j].trim();
            const descMatch = l.match(/@desc\s+(.*)/);
            if (descMatch && !desc) desc = descMatch[1].trim();
            const accessMatch = l.match(/@access\s+(.*)/);
            if (accessMatch && !access) access = accessMatch[1].trim();
          }

          const mount = mounts[varName] || '';
          const fullPath = (mount + '/' + routeSubPath).replace(/\/+/g, '/').replace(/\/$/, '');
          const openapiPath = fullPath.replace(/:([^/]+)/g, '{$1}');

          if (!spec.paths[openapiPath]) spec.paths[openapiPath] = {};

          const operation = {
            summary: desc || `${method.toUpperCase()} ${openapiPath}`,
            tags: [requires[varName]],
            responses: {
              '200': { description: 'Successful response' }
            }
          };

          if (/Private/i.test(access)) {
            operation.security = [{ bearerAuth: [] }];
          }

          spec.paths[openapiPath][method] = operation;
        }
      }
    }
  } catch (err) {
    // if anything fails, return minimal spec
    console.error('Failed to auto-generate paths for Swagger:', err.message);
  }

  return spec;
}

module.exports = { buildSpec };
