import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getMockTranscripts } from './mock-data.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ACC Transcript MCP' });
});

// OAuth discovery endpoint (for later)
app.get('/mcp/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: 'https://localhost:3000',
    authorization_endpoint: 'https://localhost:3000/auth',
    token_endpoint: 'https://localhost:3000/token',
  });
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

// Define your three tools
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

// Handle tool execution
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'searchTranscripts': {
      // For now, return mock data
      const results = getMockTranscripts().filter(t => 
        t.content.toLowerCase().includes(args.query.toLowerCase())
      );
      
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
      const transcript = getMockTranscripts().find(
        t => t.id === args.transcriptId
      );
      
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
      const recent = getMockTranscripts().slice(0, args.limit || 10);
      
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

// HTTP endpoint for testing
app.post('/mcp/tools/:toolName', async (req, res) => {
  try {
    // This will later check Auth0 token
    console.log('Tool called:', req.params.toolName);
    console.log('Body:', req.body);
    
    // For now, just return mock response
    res.json({
      success: true,
      tool: req.params.toolName,
      result: 'Mock response - Auth not yet implemented',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start HTTP server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

// For direct MCP stdio connections (optional, for testing)
if (process.argv.includes('--stdio')) {
  const transport = new StdioServerTransport();
  mcpServer.connect(transport);
}
