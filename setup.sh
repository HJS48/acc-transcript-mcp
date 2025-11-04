#!/bin/bash

# Create project structure
mkdir -p acc-transcript-mcp/src
cd acc-transcript-mcp

# Create server.ts
cat > src/server.ts << 'EOF'
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
EOF

# Create tools.ts
cat > src/tools.ts << 'EOF'
// Tool definitions - will be expanded later
export const toolDefinitions = {
  searchTranscripts: {
    name: 'searchTranscripts',
    description: 'Search call transcripts for specific topics or keywords',
    parameters: {
      query: 'string',
      clientFilter: 'string?',
      dateFrom: 'string?',
      dateTo: 'string?',
    },
  },
  getTranscriptDetails: {
    name: 'getTranscriptDetails',
    description: 'Get full details of a specific transcript',
    parameters: {
      transcriptId: 'string',
    },
  },
  listRecentCalls: {
    name: 'listRecentCalls',
    description: 'List recent client calls',
    parameters: {
      limit: 'number?',
    },
  },
};
EOF

# Create mock-data.ts
cat > src/mock-data.ts << 'EOF'
export function getMockTranscripts() {
  return [
    {
      id: 'transcript-001',
      clientName: 'Client X',
      date: '2024-10-15',
      participants: ['John (ACC)', 'Sarah (Client X)'],
      content: 'Discussion about Q4 forecasting concerns. The CFO expressed worry about accuracy...',
      chunks: [
        {
          speaker: 'Sarah',
          text: 'We are concerned about forecasting accuracy for Q4',
          timestamp: '00:05:23',
        },
      ],
      actionItems: [
        'Review forecasting models by month-end',
        'Schedule follow-up for November',
      ],
    },
    {
      id: 'transcript-002',
      clientName: 'Client Y',
      date: '2024-10-20',
      participants: ['John (ACC)', 'Mike (Client Y)'],
      content: 'Pipeline review and cash flow planning for next quarter...',
      chunks: [
        {
          speaker: 'Mike',
          text: 'Our cash flow projections need adjustment based on new contracts',
          timestamp: '00:10:45',
        },
      ],
      actionItems: [
        'Update cash flow model',
        'Send revised projections by Friday',
      ],
    },
    {
      id: 'transcript-003',
      clientName: 'Client X',
      date: '2024-10-22',
      participants: ['John (ACC)', 'Sarah (Client X)', 'Tom (Client X CFO)'],
      content: 'Follow-up on forecasting models. CFO wants better predictive accuracy by year-end...',
      chunks: [
        {
          speaker: 'Tom',
          text: 'We need those improved forecasting models implemented before Q4 close',
          timestamp: '00:15:30',
        },
      ],
      actionItems: [
        'Implement new forecasting algorithm',
        'Training session for Client X team',
      ],
    },
  ];
}
EOF

# Create .env
cat > .env << 'EOF'
PORT=3000
NODE_ENV=development

# Auth0 (to be added)
# AUTH0_DOMAIN=https://acc-finance-eu.auth0.com
# AUTH0_AUDIENCE=https://acc-transcripts.railway.app/mcp

# Supabase (to be added)
# SUPABASE_URL=
# SUPABASE_SERVICE_KEY=

# OpenAI (to be added)
# OPENAI_API_KEY=
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "acc-transcript-mcp",
  "version": "1.0.0",
  "description": "MCP server for ACC Finance transcript search",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "dev": "nodemon --exec tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test-mcp": "tsx src/server.ts --stdio"
  },
  "keywords": ["mcp", "chatgpt", "transcripts"],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.21.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.5",
    "@types/node": "^24.10.0",
    "nodemon": "^3.1.10",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Project setup complete!"
echo ""
echo "To start the server, run:"
echo "  npm run dev"
echo ""
echo "To test the health endpoint:"
echo "  curl http://localhost:3000/health"