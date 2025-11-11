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
    },
    // Apply bearer auth to ALL endpoints by default; specific endpoints
    // can override to public by setting operation.security = []
    security: [{ bearerAuth: [] }]
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

          const skipPaths = new Set([
            '/api/v1/orders/momo/create',
            '/api/v1/orders/momo/ipn',
            '/api/v1/orders/momo/return'
          ]);
          if (skipPaths.has(fullPath) || fullPath.toLowerCase().includes('/ipn')) continue;

          if (!spec.paths[openapiPath]) spec.paths[openapiPath] = {};

          const operation = {
            summary: desc || `${method.toUpperCase()} ${openapiPath}`,
            tags: [requires[varName]],
            parameters: [],
            responses: {
              '200': { description: 'Successful response' }
            }
          };

          // Auto-generate path parameters from route (e.g., :id, :eventId)
          const pathParamMatches = [...routeSubPath.matchAll(/:([A-Za-z0-9_]+)/g)];
          if (pathParamMatches.length) {
            operation.parameters = pathParamMatches.map((pm) => ({
              name: pm[1],
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' }
            }));
          }

          // If explicitly declared Public in comments, clear security for this operation
          if (/Public/i.test(access)) {
            operation.security = [];
          } else if (/Private/i.test(access)) {
            // Kept for clarity; with global security this is redundant
            operation.security = [{ bearerAuth: [] }];
          }

          // Heuristic/requestBody mapping for well-known endpoints
          if (['post', 'put', 'patch'].includes(method)) {
            // Build absolute path as in spec (already computed in fullPath)
            const bodySchemas = {
              '/api/v1/auth/login': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', format: 'password' }
                  },
                  required: ['email', 'password']
                },
                example: { email: 'user@example.com', password: '123456' }
              },
              '/api/v1/auth/register': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', format: 'password' },
                    phone: { type: 'string' },
                    avatarUrl: { type: 'string' },
                    role: { type: 'string', enum: ['user', 'organizer', 'admin'] }
                  },
                  required: ['name', 'email', 'password']
                },
                example: {
                  name: 'John Doe',
                  email: 'john@example.com',
                  password: '123456',
                  phone: '+84901234567'
                }
              },
              '/api/v1/auth/forgot-password': {
                schema: {
                  type: 'object',
                  properties: { email: { type: 'string', format: 'email' } },
                  required: ['email']
                },
                example: { email: 'user@example.com' }
              },
              '/api/v1/auth/reset-password': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    newPassword: { type: 'string', format: 'password' },
                    autoLogin: { type: 'boolean' }
                  },
                  required: ['token', 'newPassword']
                },
                example: { token: 'reset-token', newPassword: 'NewPass123!', autoLogin: true }
              },

              // Venues
              '/api/v1/venues': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    address: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    country: { type: 'string' },
                    capacity: { type: 'integer', minimum: 1 },
                    description: { type: 'string' },
                    amenities: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string', enum: ['active', 'inactive'] }
                  },
                  required: ['name', 'address', 'capacity']
                },
                example: {
                  name: 'Saigon Hall',
                  address: '123 Le Loi, Q1',
                  city: 'Ho Chi Minh',
                  capacity: 500,
                  amenities: ['parking', 'wifi']
                }
              },
              '/api/v1/venues/:id': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    address: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    country: { type: 'string' },
                    capacity: { type: 'integer', minimum: 1 },
                    description: { type: 'string' },
                    amenities: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string', enum: ['active', 'inactive'] }
                  }
                },
                example: { name: 'New name', capacity: 600 }
              },

              // Events
              '/api/v1/events': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    venue: { type: 'string', description: 'venueId or venue snapshot', pattern: '^[a-fA-F0-9]{24}$' },
                    startDate: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time' },
                    capacity: { type: 'integer', minimum: 1 },
                    categories: { type: 'array', items: { type: 'string' } },
                    ticketTypes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          price: { type: 'number' },
                          quantity: { type: 'integer' }
                        },
                        required: ['name', 'price', 'quantity']
                      }
                    }
                  },
                  required: ['title', 'startDate', 'venue', 'ticketTypes']
                },
                example: {
                  title: 'Music Night',
                  description: 'Live show',
                  venue: '507f1f77bcf86cd799439023',
                  startDate: '2025-12-01T18:00:00Z',
                  capacity: 300,
                  categories: ['music'],
                  ticketTypes: [{ name: 'Standard', price: 10, quantity: 200 }]
                }
              },
              '/api/v1/events/:id': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    venue: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
                    startDate: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time' },
                    capacity: { type: 'integer' },
                    categories: { type: 'array', items: { type: 'string' } },
                    ticketTypes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          price: { type: 'number' },
                          quantity: { type: 'integer' }
                        }
                      }
                    }
                  }
                },
                example: { title: 'Updated title' }
              },

              // Tickets
              '/api/v1/tickets/checkin': {
                schema: {
                  type: 'object',
                  properties: { qrCode: { type: 'string' } },
                  required: ['qrCode']
                },
                example: { qrCode: 'QR-STRING' }
              },

              // Users self
              '/api/v1/users/me': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    phone: { type: 'string' },
                    avatarUrl: { type: 'string' }
                  }
                },
                example: { name: 'New Name', phone: '+840912345678' }
              },
              '/api/v1/users/me/password': {
                schema: {
                  type: 'object',
                  properties: {
                    oldPassword: { type: 'string', format: 'password' },
                    newPassword: { type: 'string', format: 'password' }
                  },
                  required: ['oldPassword', 'newPassword']
                },
                example: { oldPassword: 'Old123!', newPassword: 'New123!' }
              },

              // Orders
              '/api/v1/orders': {
                schema: {
                  type: 'object',
                  properties: {
                    event: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          ticketType: { type: 'string' },
                          quantity: { type: 'integer' }
                        },
                        required: ['ticketType', 'quantity']
                      }
                    },
                    buyerInfo: { type: 'object' }
                  },
                  required: ['event', 'items']
                },
                example: {
                  event: '507f1f77bcf86cd799439031',
                  items: [{ ticketType: 'Standard', quantity: 2 }],
                  buyerInfo: { name: 'John', email: 'john@example.com' }
                }
              },
              '/api/v1/orders/:id': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          ticketType: { type: 'string' },
                          quantity: { type: 'integer' }
                        },
                        required: ['ticketType', 'quantity']
                      }
                    },
                    buyerInfo: { type: 'object' }
                  },
                  additionalProperties: false
                },
                example: {
                  items: [
                    { ticketType: 'Standard', quantity: 2 }
                  ],
                  buyerInfo: { name: 'Nguyen Van B', email: 'buyer@example.com' }
                }
              },
              '/api/v1/orders/momo/pay': {
                schema: {
                  type: 'object',
                  properties: {
                    orderId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
                    amount: { type: 'number' }
                  },
                  required: ['orderId']
                },
                example: { orderId: '<ORDER_ID>' }
              },

              // Admin APIs
              '/api/v1/admin/users': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', format: 'password' },
                    role: { type: 'string' },
                    phone: { type: 'string' },
                    avatarUrl: { type: 'string' }
                  },
                  required: ['name', 'email', 'password']
                },
                example: {
                  name: 'Admin User',
                  email: 'admin@example.com',
                  password: 'Admin123!',
                  role: 'admin',
                  phone: '+84901234567',
                  avatarUrl: 'https://example.com/avatar.jpg'
                }
              },
              '/api/v1/admin/users/:id': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    role: { type: 'string' },
                    phone: { type: 'string' },
                    avatarUrl: { type: 'string' },
                    isVerified: { type: 'boolean' }
                  }
                },
                example: { 
                  name: 'Updated User',
                  email: 'updated@example.com',
                  role: 'organizer',
                  phone: '+84901234568',
                  avatarUrl: 'https://example.com/avatar.jpg',
                  isVerified: true 
                }
              },
              '/api/v1/admin/users/:id/password': {
                schema: {
                  type: 'object',
                  properties: { newPassword: { type: 'string', format: 'password', minLength: 6 } },
                  required: ['newPassword']
                },
                example: { newPassword: 'NewPass123!' }
              },
              '/api/v1/admin/events': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    venue: { type: 'string' },
                    startDate: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time' },
                    capacity: { type: 'integer' },
                    categories: { type: 'array', items: { type: 'string' } },
                    ticketTypes: { type: 'array', items: { type: 'object' } }
                  },
                  required: ['title', 'venue', 'startDate', 'ticketTypes']
                }
              },
              '/api/v1/admin/events/:id': {
                schema: { type: 'object', additionalProperties: true },
                example: { title: 'Updated by admin' }
              },
              '/api/v1/admin/events/:id/approve': {
                schema: { type: 'object', properties: { adminNote: { type: 'string' } } },
                example: { adminNote: 'Looks good' }
              },
              '/api/v1/admin/events/:id/reject': {
                schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
                example: { reason: 'Incomplete information' }
              },
              '/api/v1/admin/events/:id/cancel': {
                schema: { type: 'object', properties: { reason: { type: 'string' } } },
                example: { reason: 'Force majeure' }
              },
              '/api/v1/admin/venues': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    address: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    country: { type: 'string' },
                    capacity: { type: 'integer' },
                    description: { type: 'string' },
                    amenities: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['name', 'address', 'capacity']
                }
              },
              '/api/v1/admin/venues/:id': {
                schema: { type: 'object', additionalProperties: true },
                example: { capacity: 800 }
              }
            };

            const known = bodySchemas[fullPath];
            if (known) {
              operation.requestBody = {
                required: true,
                content: {
                  'application/json': {
                    schema: known.schema,
                    example: known.example
                  }
                }
              };
            }
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
