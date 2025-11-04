import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getMockTranscripts } from './mock-data.js';
import { validateApiKey, canAccessClient } from './auth.js';
import { SearchTranscriptsArgs, GetTranscriptDetailsArgs, ListRecentCallsArgs } from './types.js';
import { openapiSpec } from './openapi-spec.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
  origin: '*', // Allow all origins for now (ChatGPT, testing, etc.)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ACC Transcript MCP' });
});

// OpenAPI spec endpoint (no auth required for ChatGPT discovery)
app.get('/openapi.json', (req, res) => {
  res.json(openapiSpec);
});

// Alternative: Serve OpenAPI spec at /.well-known/openapi.json (ChatGPT standard)
app.get('/.well-known/openapi.json', (req, res) => {
  res.json(openapiSpec);
});

// OAuth discovery endpoint (keep for future OAuth upgrade)
app.get('/mcp/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: process.env.BASE_URL || 'https://localhost:3400',
    token_endpoint: 'Use Bearer token with API key',
    authentication: 'Bearer token',
    note: 'Using API key authentication for MVP'
  });
});

// MCP discovery endpoints (no auth required for ChatGPT to discover tools)
app.get('/mcp', (req, res) => {
  res.json({
    name: 'acc-transcript-server',
    version: '1.0.0',
    capabilities: {
      tools: {}
    }
  });
});

// Allow tool listing without auth for discovery
app.post('/mcp', (req, res) => {
  // Check if it's a tools/list request
  if (req.body?.method === 'tools/list') {
    res.json({
      tools: [
        {
          name: 'searchTranscripts',
          description: 'Search call transcripts',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            },
            required: ['query']
          }
        },
        {
          name: 'getTranscriptDetails',
          description: 'Get transcript details',
          inputSchema: {
            type: 'object',
            properties: {
              transcriptId: { type: 'string' }
            },
            required: ['transcriptId']
          }
        },
        {
          name: 'listRecentCalls',
          description: 'List recent calls',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number' }
            }
          }
        }
      ]
    });
  } else {
    // For actual tool calls, require auth
    res.status(401).json({ error: 'Authentication required for tool execution' });
  }
});

// Test endpoint to verify auth is working
app.get('/mcp/me', validateApiKey, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user
  });
});

// HTTP endpoints with authentication
app.post('/mcp/tools/:toolName', validateApiKey, async (req, res) => {
  try {
    const { toolName } = req.params;
    const user = req.user!;
    
    console.log(`[TOOL] ${user.email} calling ${toolName}`);
    
    switch (toolName) {
      case 'searchTranscripts': {
        let results = getMockTranscripts();
        
        // Filter by user's allowed clients
        if (!user.allowedClients.includes('*')) {
          results = results.filter(t => 
            canAccessClient(user, t.clientName)
          );
        }
        
        // Apply search query
        if (req.body.query) {
          results = results.filter(t => 
            t.content.toLowerCase().includes(req.body.query.toLowerCase())
          );
        }
        
        // Apply client filter if specified
        if (req.body.clientFilter) {
          if (!canAccessClient(user, req.body.clientFilter)) {
            return res.status(403).json({ 
              error: 'Access denied',
              message: `You don't have access to ${req.body.clientFilter}` 
            });
          }
          results = results.filter(t => t.clientName === req.body.clientFilter);
        }
        
        res.json({
          success: true,
          tool: toolName,
          resultCount: results.length,
          results: results
        });
        break;
      }
      
      case 'getTranscriptDetails': {
        const transcript = getMockTranscripts().find(
          t => t.id === req.body.transcriptId
        );
        
        if (!transcript) {
          return res.status(404).json({ error: 'Transcript not found' });
        }
        
        // Check user has access to this client
        if (!canAccessClient(user, transcript.clientName)) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: `You don't have access to ${transcript.clientName}` 
          });
        }
        
        res.json({
          success: true,
          tool: toolName,
          result: transcript
        });
        break;
      }
      
      case 'listRecentCalls': {
        let recent = getMockTranscripts();
        
        // Filter by user's allowed clients
        if (!user.allowedClients.includes('*')) {
          recent = recent.filter(t => 
            canAccessClient(user, t.clientName)
          );
        }
        
        recent = recent.slice(0, req.body.limit || 10);
        
        res.json({
          success: true,
          tool: toolName,
          resultCount: recent.length,
          results: recent
        });
        break;
      }
      
      default:
        res.status(404).json({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    console.error(`[ERROR] Tool execution failed:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Create MCP server
const mcpServer = new Server(
  {
    name: 'acc-transcript-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'searchTranscripts',
        description: 'Search call transcripts for specific topics or keywords',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for transcript content',
            },
            clientFilter: {
              type: 'string',
              description: 'Optional: Filter by client name',
            },
            dateFrom: {
              type: 'string',
              description: 'Optional: Start date (YYYY-MM-DD)',
            },
            dateTo: {
              type: 'string',
              description: 'Optional: End date (YYYY-MM-DD)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'getTranscriptDetails',
        description: 'Get full details of a specific transcript',
        inputSchema: {
          type: 'object',
          properties: {
            transcriptId: {
              type: 'string',
              description: 'ID of the transcript to retrieve',
            },
          },
          required: ['transcriptId'],
        },
      },
      {
        name: 'listRecentCalls',
        description: 'List recent client calls',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of recent calls to return (default: 10)',
              default: 10,
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution with typed arguments
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'searchTranscripts': {
      const searchArgs = args as SearchTranscriptsArgs | undefined;
      let results = getMockTranscripts();
      
      if (searchArgs?.query) {
        results = results.filter(t => 
          t.content.toLowerCase().includes(searchArgs.query.toLowerCase())
        );
      }
      
      if (searchArgs?.clientFilter) {
        results = results.filter(t => t.clientName === searchArgs.clientFilter);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }

    case 'getTranscriptDetails': {
      const detailArgs = args as GetTranscriptDetailsArgs | undefined;
      let transcript = null;
      
      if (detailArgs?.transcriptId) {
        transcript = getMockTranscripts().find(
          t => t.id === detailArgs.transcriptId
        );
      }
      
      return {
        content: [
          {
            type: 'text',
            text: transcript ? JSON.stringify(transcript, null, 2) : 'Transcript not found',
          },
        ],
      };
    }

    case 'listRecentCalls': {
      const listArgs = args as ListRecentCallsArgs | undefined;
      const limit = listArgs?.limit || 10;
      const recent = getMockTranscripts().slice(0, limit);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(recent, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start HTTP server
const PORT = process.env.PORT || 3400;
app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth required for /mcp/tools/* endpoints`);
  console.log(`📝 Test auth with: curl -H "Authorization: Bearer acc-demo-key-001" http://localhost:${PORT}/mcp/me`);
});

// For direct MCP stdio connections
if (process.argv.includes('--stdio')) {
  const transport = new StdioServerTransport();
  mcpServer.connect(transport);
}