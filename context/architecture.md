┌─────────────────────────────────────────────────────────────────┐

│                         CHATGPT INTERFACE                        │

│  • Custom GPT/Project with prompt starters                       │

│  • Developer Mode enabled                                        │

│  • OAuth2 connector configured                                   │

└────────────────────┬────────────────────────────────────────────┘

&nbsp;                    │ HTTPS + OAuth2 Bearer Token

&nbsp;                    ▼

┌─────────────────────────────────────────────────────────────────┐

│                    MCP SERVER (Railway/Node.js)                  │

│                                                                  │

│  ┌──────────────────────────────────────────────────────────┐  │

│  │ OAuth Discovery Endpoint                                 │  │

│  │ /.well-known/oauth-authorization-server                  │  │

│  └──────────────────────────────────────────────────────────┘  │

│                                                                  │

│  ┌──────────────────────────────────────────────────────────┐  │

│  │ Auth Middleware (JWT validation)                         │  │

│  │ • Validates Auth0 tokens                                 │  │

│  │ • Extracts user permissions                              │  │

│  │ • Audit logging                                          │  │

│  └──────────────────────────────────────────────────────────┘  │

│                                                                  │

│  ┌──────────────────────────────────────────────────────────┐  │

│  │ MCP Tools (3 endpoints)                                  │  │

│  │ • searchTranscripts(query, filters)                      │  │

│  │ • getTranscriptDetails(id)                               │  │

│  │ • listRecentCalls(limit)                                 │  │

│  └──────────────────────────────────────────────────────────┘  │

└────────┬──────────────────────┬─────────────────────────────────┘

&nbsp;        │                      │

&nbsp;        │ Auth0 API            │ Supabase Client (Service Key)

&nbsp;        ▼                      ▼

┌─────────────────┐    ┌──────────────────────────────────────────┐

│   AUTH0 (EU)    │    │           SUPABASE (EU)                  │

│                 │    │                                          │

│ • Tenant        │    │ ┌──────────────────────────────────────┐│

│ • User Store    │    │ │ Tables:                              ││

│ • DCR Endpoint  │    │ │ • transcripts (metadata)             ││

│ • JWKS          │    │ │ • transcript\_chunks (text + vectors) ││

│ • User Metadata │    │ │ • action\_items                       ││

│ │               │    │ │ • user\_access (RLS reference)       ││

│ └─allowed\_clients    │ └──────────────────────────────────────┘│

│   └─access\_level     │                                          │

│   └─department       │ ┌──────────────────────────────────────┐│

│                 │    │ │ Functions:                           ││

└─────────────────┘    │ │ • search\_chunks (vector similarity)  ││

&nbsp;                      │ │ • set\_user\_context                   ││

&nbsp;                      │ └──────────────────────────────────────┘│

&nbsp;                      │                                          │

&nbsp;                      │ ┌──────────────────────────────────────┐│

&nbsp;                      │ │ RLS Policies:                        ││

&nbsp;                      │ │ • Client-based access control        ││

&nbsp;                      │ │ • Service key bypasses RLS           ││

&nbsp;                      │ └──────────────────────────────────────┘│

&nbsp;                      └──────────────────────────────────────────┘

&nbsp;                                       ▲

&nbsp;                                       │ n8n webhooks

&nbsp;                      ┌────────────────┴─────────────────────┐

&nbsp;                      │         n8n WORKFLOWS                │

&nbsp;                      │ • Fireflies webhook receiver         │

&nbsp;                      │ • Transcript chunking (speaker turns)│

&nbsp;                      │ • OpenAI embeddings generation       │

&nbsp;                      │ • Metadata extraction                │

&nbsp;                      │ • Action items parsing              │

&nbsp;                      └──────────────────────────────────────┘

&nbsp;                                       ▲

&nbsp;                                       │ Webhook

&nbsp;                      ┌──────────────────────────────────────┐

&nbsp;                      │          FIREFLIES                   │

&nbsp;                      │ • Meeting recordings                 │

&nbsp;                      │ • Auto-transcription                 │

&nbsp;                      │ • Speaker identification             │

&nbsp;                      └──────────────────────────────────────┘

```



\## \*\*Flow 2: Information Flow - Data Journey\*\*



\### \*\*A. User Query Flow (Read Operation)\*\*

```

USER: "What did Client X say about forecasting last month?"

&nbsp;                    │

&nbsp;                    ▼

1\. CHATGPT PARSING ──────────────────────────────────────────────

&nbsp;  • Identifies intent: search + semantic + time filter

&nbsp;  • Formats MCP request with query parameters

&nbsp;                    │

&nbsp;                    ▼

2\. AUTH FLOW ────────────────────────────────────────────────────

&nbsp;  ChatGPT → Auth0 → Get token with metadata:

&nbsp;  {

&nbsp;    "email": "analyst@acc.com",

&nbsp;    "allowed\_clients": \["Client X", "Client Y", "Client Z"],

&nbsp;    "access\_level": "senior\_analyst"

&nbsp;  }

&nbsp;                    │

&nbsp;                    ▼

3\. MCP REQUEST ──────────────────────────────────────────────────

&nbsp;  POST /mcp/tools/searchTranscripts

&nbsp;  Headers: Bearer \[token]

&nbsp;  Body: {

&nbsp;    "query": "forecasting",

&nbsp;    "clientFilter": "Client X",

&nbsp;    "dateRange": {"start": "2024-10-01", "end": "2024-10-31"}

&nbsp;  }

&nbsp;                    │

&nbsp;                    ▼

4\. PERMISSION CHECK ─────────────────────────────────────────────

&nbsp;  MCP Server validates:

&nbsp;  ✓ Token valid?

&nbsp;  ✓ "Client X" in user's allowed\_clients?

&nbsp;  ✓ Access level permits search?

&nbsp;                    │

&nbsp;                    ▼

5\. QUERY ROUTER DECISION ────────────────────────────────────────

&nbsp;  • Semantic search needed? YES ("forecasting")

&nbsp;  • SQL filter needed? YES (client + date)

&nbsp;  • Decision: HYBRID SEARCH

&nbsp;                    │

&nbsp;                    ▼

6\. EMBEDDING GENERATION ─────────────────────────────────────────

&nbsp;  "forecasting" → OpenAI API → \[0.123, -0.456, 0.789...]

&nbsp;                    │

&nbsp;                    ▼

7\. SUPABASE QUERIES ─────────────────────────────────────────────

&nbsp;  a) Vector search:

&nbsp;     SELECT \* FROM transcript\_chunks 

&nbsp;     WHERE embedding <-> \[vector] < 0.3

&nbsp;     

&nbsp;  b) SQL filters:

&nbsp;     AND transcripts.client\_name = 'Client X'

&nbsp;     AND transcripts.meeting\_date BETWEEN dates

&nbsp;     AND transcripts.client\_name IN (user.allowed\_clients)

&nbsp;                    │

&nbsp;                    ▼

8\. RESULT AGGREGATION ───────────────────────────────────────────

&nbsp;  Found 5 chunks from 2 meetings:

&nbsp;  • Oct 15: "CFO concerned about Q4 forecasting accuracy"

&nbsp;  • Oct 22: "Need better forecasting models by year-end"

&nbsp;                    │

&nbsp;                    ▼

9\. RESPONSE FORMATTING ──────────────────────────────────────────

&nbsp;  MCP Server returns structured JSON with:

&nbsp;  • Matched chunks with context

&nbsp;  • Meeting metadata

&nbsp;  • Relevance scores

&nbsp;                    │

&nbsp;                    ▼

10\. CHATGPT PRESENTATION ────────────────────────────────────────

&nbsp;   "In your October calls with Client X, they expressed 

&nbsp;   concerns about Q4 forecasting accuracy. The CFO 

&nbsp;   specifically mentioned needing better models by year-end.

&nbsp;   

&nbsp;   \[View full transcript from Oct 15]

&nbsp;   \[View full transcript from Oct 22]"

```



\### \*\*B. Transcript Ingestion Flow (Write Operation)\*\*

```

MEETING ENDS ON ZOOM/TEAMS

&nbsp;                    │

&nbsp;                    ▼

1\. FIREFLIES CAPTURE ────────────────────────────────────────────

&nbsp;  • Records audio

&nbsp;  • Generates transcript

&nbsp;  • Identifies speakers

&nbsp;  • Creates timestamps

&nbsp;                    │

&nbsp;                    ▼

2\. WEBHOOK TRIGGER ──────────────────────────────────────────────

&nbsp;  POST to n8n webhook:

&nbsp;  {

&nbsp;    "transcript": "Full text...",

&nbsp;    "speakers": \["John (ACC)", "Sarah (Client X)"],

&nbsp;    "duration": 3600,

&nbsp;    "meeting\_title": "Q4 Planning Call"

&nbsp;  }

&nbsp;                    │

&nbsp;                    ▼

3\. n8n PROCESSING ───────────────────────────────────────────────

&nbsp;  a) Extract metadata:

&nbsp;     • Client name from title/participants

&nbsp;     • Meeting date/time

&nbsp;     • Key participants

&nbsp;  

&nbsp;  b) Clean transcript:

&nbsp;     • Remove filler words

&nbsp;     • Fix speaker labels

&nbsp;     • Add punctuation

&nbsp;                    │

&nbsp;                    ▼

4\. CHUNKING STRATEGY ────────────────────────────────────────────

&nbsp;  For each speaker turn:

&nbsp;  • If < 1000 tokens: Keep as one chunk

&nbsp;  • If > 1000 tokens: Split at sentence boundaries

&nbsp;  • Maintain 100 token overlap

&nbsp;                    │

&nbsp;                    ▼

5\. EMBEDDING GENERATION ─────────────────────────────────────────

&nbsp;  For each chunk → OpenAI Embeddings API:

&nbsp;  "Sarah: We're concerned about..." → \[0.234, -0.567...]

&nbsp;                    │

&nbsp;                    ▼

6\. PARALLEL PROCESSING ──────────────────────────────────────────

&nbsp;  ┌──────────────┬──────────────┬──────────────┐

&nbsp;  │ Full Insert  │ Chunk Insert │ AI Analysis  │

&nbsp;  └──────────────┴──────────────┴──────────────┘

&nbsp;          │              │              │

&nbsp;          ▼              ▼              ▼

&nbsp;  transcripts     transcript\_chunks   GPT-4:

&nbsp;  • id            • chunk\_text        Extract:

&nbsp;  • full\_text     • embedding         • Action items

&nbsp;  • client\_name   • speaker           • Key concerns

&nbsp;  • date          • timestamp         • Decisions

&nbsp;                    │

&nbsp;                    ▼

7\. SUPABASE STORAGE ─────────────────────────────────────────────

&nbsp;  BEGIN TRANSACTION:

&nbsp;  1. Insert transcript record

&nbsp;  2. Insert all chunks with FK

&nbsp;  3. Insert action\_items

&nbsp;  4. Update search indices

&nbsp;  COMMIT

&nbsp;                    │

&nbsp;                    ▼

8\. NOTIFICATION (Optional) ──────────────────────────────────────

&nbsp;  Email/Slack to account owner:

&nbsp;  "New transcript available: Q4 Planning with Client X"

```



\### \*\*C. Permission Update Flow\*\*

```

ACC ADMIN: "Grant new analyst access to Client X"

&nbsp;                    │

&nbsp;                    ▼

1\. AUTH0 DASHBOARD ──────────────────────────────────────────────

&nbsp;  Admin navigates to user profile

&nbsp;                    │

&nbsp;                    ▼

2\. UPDATE METADATA ──────────────────────────────────────────────

&nbsp;  app\_metadata.allowed\_clients:

&nbsp;  FROM: \["Client A", "Client B"]

&nbsp;  TO:   \["Client A", "Client B", "Client X"]

&nbsp;                    │

&nbsp;                    ▼

3\. IMMEDIATE EFFECT ─────────────────────────────────────────────

&nbsp;  Next token issued will contain new permissions

&nbsp;  (No MCP server restart needed)

&nbsp;                    │

&nbsp;                    ▼

4\. AUDIT LOG ────────────────────────────────────────────────────

&nbsp;  Auth0 logs:

&nbsp;  • Who made change

&nbsp;  • When

&nbsp;  • What changed

&nbsp;  • IP address

```



\## \*\*Key Security Checkpoints:\*\*

```

🔒 Security Gates in the Flow:

1\. ChatGPT → MCP: OAuth2 with PKCE

2\. MCP → Auth0: Token validation on EVERY request  

3\. MCP → Supabase: Permission filtering in EVERY query

4\. Supabase: Service key only, no direct user access

5\. n8n → Supabase: Webhook auth tokens

6\. Fireflies → n8n: Webhook signature validation

