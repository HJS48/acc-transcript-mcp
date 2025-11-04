import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getMockTranscripts } from './mock-data.js';
import { validateApiKey, canAccessClient } from './auth.js';
import { SearchTranscriptsArgs, GetTranscriptDetailsArgs, ListRecentCallsArgs } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Create MCP server instance (used for both HTTP and stdio)
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

// Register tool list handler
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

// Register tool execution handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[TOOL] ========== Tool Execution ==========`);
  console.error(`[TOOL] Tool Name: ${name}`);
  console.error(`[TOOL] Arguments: ${JSON.stringify(args, null, 2)}`);

  switch (name) {
    case 'searchTranscripts': {
      const searchArgs = args as SearchTranscriptsArgs | undefined;
      let results = getMockTranscripts();

      console.error(`[TOOL] Initial results count: ${results.length}`);

      if (searchArgs?.query) {
        results = results.filter(t =>
          t.content.toLowerCase().includes(searchArgs.query.toLowerCase())
        );
        console.error(`[TOOL] After query filter: ${results.length} results`);
      }

      if (searchArgs?.clientFilter) {
        results = results.filter(t => t.clientName === searchArgs.clientFilter);
        console.error(`[TOOL] After client filter: ${results.length} results`);
      }

      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };

      console.error(`[TOOL] Response content length: ${response.content[0].text.length} chars`);
      console.error(`[TOOL] Returning ${results.length} transcripts`);

      return response;
    }

    case 'getTranscriptDetails': {
      const detailArgs = args as GetTranscriptDetailsArgs | undefined;
      let transcript = null;

      console.error(`[TOOL] Searching for transcript ID: ${detailArgs?.transcriptId}`);

      if (detailArgs?.transcriptId) {
        transcript = getMockTranscripts().find(
          t => t.id === detailArgs.transcriptId
        );
      }

      console.error(`[TOOL] Transcript found: ${transcript ? 'YES' : 'NO'}`);

      const response = {
        content: [
          {
            type: 'text',
            text: transcript ? JSON.stringify(transcript, null, 2) : 'Transcript not found',
          },
        ],
      };

      console.error(`[TOOL] Response content length: ${response.content[0].text.length} chars`);

      return response;
    }

    case 'listRecentCalls': {
      const listArgs = args as ListRecentCallsArgs | undefined;
      const limit = listArgs?.limit || 10;
      const recent = getMockTranscripts().slice(0, limit);

      console.error(`[TOOL] Limit: ${limit}`);
      console.error(`[TOOL] Returning ${recent.length} recent calls`);

      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(recent, null, 2),
          },
        ],
      };

      console.error(`[TOOL] Response content length: ${response.content[0].text.length} chars`);

      return response;
    }

    default:
      console.error(`[TOOL] ERROR: Unknown tool requested: ${name}`);
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Root endpoint for Railway health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ACC Transcript MCP',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      mcp: '/mcp'
    }
  });
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ACC Transcript MCP' });
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

// MCP endpoint - JSON-RPC 2.0 over HTTP using StreamableHTTPServerTransport
app.post('/mcp', async (req, res) => {
  const requestId = req.body?.id || 'unknown';
  const method = req.body?.method || 'unknown';

  console.error(`[MCP] ========== Incoming Request ==========`);
  console.error(`[MCP] Timestamp: ${new Date().toISOString()}`);
  console.error(`[MCP] Method: ${method}`);
  console.error(`[MCP] Request ID: ${requestId}`);
  console.error(`[MCP] Body: ${JSON.stringify(req.body, null, 2)}`);
  console.error(`[MCP] Headers: ${JSON.stringify(req.headers, null, 2)}`);

  try {
    // Create a new transport for each request (prevents request ID collisions)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    // Close transport when response finishes
    res.on('close', () => {
      console.error(`[MCP] Response closed for request ${requestId}`);
      transport.close();
    });

    res.on('finish', () => {
      console.error(`[MCP] Response finished for request ${requestId}`);
      console.error(`[MCP] Status: ${res.statusCode}`);
    });

    // Connect the MCP server to this transport and handle the request
    console.error(`[MCP] Connecting transport for request ${requestId}...`);
    await mcpServer.connect(transport);

    console.error(`[MCP] Handling request ${requestId}...`);
    await transport.handleRequest(req, res, req.body);

    console.error(`[MCP] Request ${requestId} completed successfully`);
  } catch (error: any) {
    console.error(`[MCP] ========== ERROR ==========`);
    console.error(`[MCP] Error handling request ${requestId}:`, error);
    console.error(`[MCP] Stack:`, error.stack);
    res.status(500).json({
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error.message
      }
    });
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

// Start HTTP server
console.error(`[STARTUP] ========== Server Initialization ==========`);
console.error(`[STARTUP] Environment PORT: ${process.env.PORT || 'not set'}`);
console.error(`[STARTUP] Node ENV: ${process.env.NODE_ENV || 'not set'}`);

const PORT = parseInt(process.env.PORT || '3400', 10);
const HOST = '0.0.0.0'; // Bind to all interfaces for Railway

console.error(`[STARTUP] Attempting to bind to ${HOST}:${PORT}...`);

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : PORT;

  console.error(`[STARTUP] ========== Server Started ==========`);
  console.error(`🚀 MCP Server running on http://${HOST}:${actualPort}`);
  console.error(`📍 Health check: http://${HOST}:${actualPort}/health`);
  console.error(`🔐 Auth required for /mcp/tools/* endpoints`);
  console.error(`📝 Test auth with: curl -H "Authorization: Bearer acc-demo-key-001" http://localhost:${actualPort}/mcp/me`);
  console.error(`✅ Server ready to accept connections from Railway`);
  console.error(`[STARTUP] Listening on ${typeof address === 'object' ? JSON.stringify(address) : address}`);
});

server.on('error', (error: any) => {
  console.error(`[STARTUP] ========== SERVER ERROR ==========`);
  console.error(`[STARTUP] Failed to start server:`, error);
  console.error(`[STARTUP] Error code: ${error.code}`);
  console.error(`[STARTUP] Port: ${PORT}`);
  process.exit(1);
});

// For direct MCP stdio connections
if (process.argv.includes('--stdio')) {
  const transport = new StdioServerTransport();
  mcpServer.connect(transport);
}