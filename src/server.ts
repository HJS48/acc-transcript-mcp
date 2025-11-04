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

console.error('[LOAD] Module loading started');

dotenv.config();

console.error('[LOAD] dotenv configured');

const app = express();

console.error('[LOAD] Express app created');
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'User-Agent'],
  credentials: true
}));
app.use(express.json());

console.error('[LOAD] Middleware configured');

// Add IMMEDIATE health checks (before any heavy initialization)
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'ACC Transcript MCP', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ACC Transcript MCP' });
});

app.get('/mcp/ready', (req, res) => {
  res.json({
    ready: mcpReady,
    mcpServerExists: !!mcpServer,
    message: mcpReady ? 'MCP server ready' : 'MCP server still initializing'
  });
});

console.error('[LOAD] Health routes added');

// START LISTENING IMMEDIATELY (before MCP initialization)
const PORT = parseInt(process.env.PORT || '3400', 10);
const HOST = '0.0.0.0';

console.error(`[LOAD] Starting server on ${HOST}:${PORT} IMMEDIATELY...`);

const server = app.listen(PORT, HOST, () => {
  console.error(`[SERVER] ✅ LISTENING on ${HOST}:${PORT} - Railway can now connect!`);
  console.error(`[SERVER] Now initializing MCP server in background...`);

  // Initialize MCP AFTER server is listening
  initializeMCP().catch(err => {
    console.error(`[SERVER] ❌ MCP initialization failed:`, err);
  });
});

server.on('error', (error: any) => {
  console.error(`[SERVER] ❌ Listen failed:`, error);
  process.exit(1);
});

// MCP Server variable (initialized later)
let mcpServer: Server | null = null;
let mcpReady = false; // Set to true after all handlers are registered

// Initialize MCP server AFTER HTTP server is listening
async function initializeMCP() {
  console.error('[MCP] Creating MCP server instance...');

  // Create MCP server instance (used for both HTTP and stdio)
  mcpServer = new Server(
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

console.error('[LOAD] MCP server created, registering tools...');

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
      {
        name: 'echo',
        description: 'Simple echo test - returns your input text immediately',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Text to echo back',
              default: 'Hello from MCP!',
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

      console.error(`[TOOL] Returning ${results.length} transcripts as structured JSON`);

      return {
        content: [
          {
            type: 'json',
            json: results,
          },
        ],
      };
    }

    case 'getTranscriptDetails': {
      const detailArgs = args as GetTranscriptDetailsArgs | undefined;

      console.error(`[TOOL] Searching for transcript ID: ${detailArgs?.transcriptId}`);

      const transcript = detailArgs?.transcriptId
        ? getMockTranscripts().find(t => t.id === detailArgs.transcriptId)
        : null;

      console.error(`[TOOL] Transcript found: ${transcript ? 'YES' : 'NO'}`);

      if (!transcript) {
        return {
          content: [
            {
              type: 'text',
              text: 'Transcript not found',
            },
          ],
        };
      }

      console.error(`[TOOL] Returning transcript as structured JSON`);

      return {
        content: [
          {
            type: 'json',
            json: transcript,
          },
        ],
      };
    }

    case 'listRecentCalls': {
      const listArgs = (args as any) ?? {};
      const limit = Math.max(1, Math.min(100, Number(listArgs.limit) || 10));
      const recent = getMockTranscripts().slice(0, limit);

      console.error('[TOOL] listRecentCalls limit=', limit, ' returning=', recent.length, 'as structured JSON');

      return {
        content: [
          { type: 'json', json: recent }
        ]
      };
    }

    case 'echo': {
      const echoArgs = (args as any) ?? {};
      const message = echoArgs.message || 'Hello from MCP!';

      console.error('[TOOL] echo called with message:', message);

      return {
        content: [
          {
            type: 'text',
            text: `Echo: ${message}`
          }
        ]
      };
    }

    default:
      console.error(`[TOOL] ERROR: Unknown tool requested: ${name}`);
      throw new Error(`Unknown tool: ${name}`);
  }
});

  console.error('[MCP] ✅ MCP server fully initialized and ready!');
  mcpReady = true;
  console.error('[MCP] ✅ All handlers registered - accepting requests!');
}

console.error('[LOAD] Setting up remaining routes...');

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

  // WORKAROUND: Normalize Accept header for clients that only want JSON
  // The SDK requires both application/json and text/event-stream even when
  // enableJsonResponse: true means we'll only ever return JSON
  const acceptHeader = req.headers.accept;
  if (acceptHeader && acceptHeader.includes('application/json') && !acceptHeader.includes('text/event-stream')) {
    req.headers.accept = 'application/json, text/event-stream';
    console.error(`[MCP] Normalized Accept header from "${acceptHeader}" to "${req.headers.accept}"`);
  }

  console.error(`[MCP] ========== Incoming Request ==========`);
  console.error(`[MCP] Timestamp: ${new Date().toISOString()}`);
  console.error(`[MCP] Method: ${method}`);
  console.error(`[MCP] Request ID: ${requestId}`);
  console.error(`[MCP] User-Agent: ${req.headers['user-agent'] || 'none'}`);
  console.error(`[MCP] Content-Type: ${req.headers['content-type'] || 'none'}`);
  console.error(`[MCP] Accept: ${req.headers['accept'] || 'none'}`);
  console.error(`[MCP] Body: ${JSON.stringify(req.body, null, 2)}`);
  console.error(`[MCP] All Headers: ${JSON.stringify(req.headers, null, 2)}`);

  // Check if MCP server is ready
  if (!mcpServer || !mcpReady) {
    console.error(`[MCP] Server not yet ready for request ${requestId} (mcpServer: ${!!mcpServer}, mcpReady: ${mcpReady})`);
    return res.status(503).json({
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32000,
        message: 'MCP server is still registering handlers, please try again in a moment'
      }
    });
  }

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
    await mcpServer!.connect(transport);

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

console.error('[LOAD] All routes registered, ready to listen...');

// Global error handler - catch JSON parse errors and other issues
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR] Global error handler caught:', err);
  console.error('[ERROR] Error type:', err.type);
  console.error('[ERROR] Error message:', err.message);

  // For MCP endpoint, return JSON-RPC error format
  if (req.path === '/mcp' || req.path.startsWith('/mcp/')) {
    const requestId = req.body?.id || 'unknown';
    return res.status(err.status || 500).json({
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: err.status === 400 ? -32700 : -32603, // -32700 = Parse error, -32603 = Internal error
        message: err.type === 'entity.parse.failed' ? 'Invalid JSON in request body' : 'Internal server error',
        data: process.env.NODE_ENV === 'development' ? err.message : undefined
      }
    });
  }

  // For other endpoints, return standard JSON error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: err.status || 500
  });
});

// For direct MCP stdio connections (only if not running as HTTP server)
if (process.argv.includes('--stdio')) {
  console.error('[STDIO] Starting stdio MCP server...');

  // Wait for MCP initialization
  const waitForMCP = setInterval(() => {
    if (mcpServer) {
      clearInterval(waitForMCP);
      const transport = new StdioServerTransport();
      mcpServer.connect(transport);
      console.error('[STDIO] MCP stdio server connected');
    }
  }, 100);
}