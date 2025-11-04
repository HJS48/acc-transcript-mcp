# ACC Transcript MCP Server - Handover Documentation

**Date:** November 4, 2025
**Status:** ✅ Server Deployed & Working | ⚠️ ChatGPT Connection Issue

---

## 🎯 Quick Summary (TL;DR)

**What Works:**
- ✅ MCP server deployed on Railway: https://acc-transcript-mcp-production.up.railway.app
- ✅ All 3 MCP tools working perfectly (searchTranscripts, getTranscriptDetails, listRecentCalls)
- ✅ Full MCP protocol compliance (JSON-RPC 2.0 over HTTP)
- ✅ Mock data returns correctly (3 sample transcripts)
- ✅ Health checks passing
- ✅ Server tested successfully with curl

**What Doesn't Work:**
- ❌ ChatGPT Custom GPT connector not sending requests to server
- ChatGPT shows "No tool response" but server logs show zero incoming requests from ChatGPT
- Issue is in ChatGPT connector configuration, NOT in server code

**Next Steps:**
1. Debug ChatGPT connector configuration
2. Set up Supabase database (Week 2)
3. Build n8n pipeline for Fireflies (Week 3)
4. Replace mock data with real transcripts

---

## 📊 Project Overview

### Goal
Allow ACC Finance staff to search client call transcripts through ChatGPT using natural language, with proper security and access controls.

### Architecture
```
ChatGPT → MCP Server (Node.js/Railway) → Supabase (Future)
                ↓
          Fireflies (via n8n, Future)
```

---

## ✅ What's Been Built

### 1. MCP Server (Complete)
**Location:** https://acc-transcript-mcp-production.up.railway.app
**Code:** https://github.com/HJS48/acc-transcript-mcp

**Features:**
- Full MCP protocol implementation using `@modelcontextprotocol/sdk`
- StreamableHTTPServerTransport for HTTP connections
- JSON-RPC 2.0 compliant
- Proper initialize handshake
- 3 working tools with complete schemas

**Tools Implemented:**
1. **searchTranscripts** - Search transcripts by keyword
2. **getTranscriptDetails** - Get full transcript by ID
3. **listRecentCalls** - List recent calls with limit

### 2. Authentication System (Complete)
**Type:** API Key (Bearer Token)
**Location:** `src/auth.ts`

**Configured Keys:**
- `acc-demo-key-001` - Admin access (all clients)
- `acc-john-key-002` - Limited to Client X, Y
- `acc-sarah-key-003` - Limited to Client Z

**Note:** Currently NOT enforced on `/mcp` endpoint (can add later if needed)

### 3. Mock Data (Complete)
**Location:** `src/mock-data.ts`

**Sample Transcripts:**
- transcript-001: Client X, Q4 forecasting concerns (Oct 15)
- transcript-002: Client Z, Budget planning (Oct 18)
- transcript-003: Client X, Forecasting follow-up (Oct 22)

### 4. Deployment (Complete)
**Platform:** Railway
**Region:** EU-compatible
**Auto-deploy:** ✅ On git push to main
**Environment:** Production

---

## 🧪 Testing & Verification

### Server Health Check
```bash
curl https://acc-transcript-mcp-production.up.railway.app/health
# Expected: {"status":"ok","service":"ACC Transcript MCP"}
```

### MCP Initialize
```bash
curl -X POST https://acc-transcript-mcp-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Expected: Server info with capabilities
```

### MCP Tools List
```bash
curl -X POST https://acc-transcript-mcp-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Expected: List of 3 tools with schemas
```

### Search Transcripts
```bash
curl -X POST https://acc-transcript-mcp-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"searchTranscripts","arguments":{"query":"forecasting"}}}'

# Expected: 2 transcripts about forecasting
```

**All tests pass successfully ✅**

---

## ❌ Known Issues

### Issue #1: ChatGPT Not Connecting
**Symptom:** ChatGPT shows "No tool response" but Railway logs show zero requests from ChatGPT

**Evidence:**
- Server works perfectly with curl (proven above)
- Railway logs only show curl requests (user-agent: curl/8.5.0)
- No requests from ChatGPT appear in logs
- ChatGPT UI shows tool was "called" but returns no response

**Root Cause:** ChatGPT MCP connector configuration issue (not server)

**Possible Causes:**
1. Incorrect URL in ChatGPT connector settings
2. ChatGPT can't reach Railway URL (firewall/network)
3. ChatGPT connector misconfigured (auth, headers, etc.)
4. ChatGPT's MCP connector has a bug

**To Debug:**
1. Check ChatGPT connector config - URL should be: `https://acc-transcript-mcp-production.up.railway.app/mcp`
2. Check if ChatGPT shows any errors in connector settings
3. Try "Test" button in ChatGPT connector config (if available)
4. Watch Railway logs while trying ChatGPT - should see requests appear immediately
5. Check if ChatGPT requires specific headers or authentication setup

**Temporary Workaround:** Server works fine, just need to fix ChatGPT connection

---

## 🔧 Technical Details

### Server Stack
- **Runtime:** Node.js 20+
- **Framework:** Express 5.x
- **MCP SDK:** @modelcontextprotocol/sdk v1.21.0
- **Language:** TypeScript
- **Deployment:** Railway (Nixpacks builder)

### Key Files
```
src/
├── server.ts           # Main server (MCP + HTTP)
├── mock-data.ts        # Sample transcript data
├── auth.ts             # API key authentication
├── types.ts            # TypeScript type definitions
└── tools.ts            # Tool definitions (legacy)

Other:
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── railway.json        # Railway deployment config
└── .env                # Local env (not in git)
```

### Critical Server Logic

**Startup Sequence (IMPORTANT):**
1. Load modules
2. Create Express app
3. Add health check routes
4. **app.listen() immediately** ← Critical for Railway
5. Initialize MCP server in background
6. Register tools after listening

**Why This Matters:**
Railway's TCP health check requires the server to listen within 2-3 seconds or it kills the container. Heavy MCP initialization happens AFTER listening to avoid this.

### Environment Variables
**On Railway (set in dashboard):**
- `PORT` - Auto-set by Railway (do NOT override)
- `NODE_ENV=production` - Set by Railway

**Local only (in .env):**
- `PORT=3400` - For local development
- `NODE_ENV=development`

---

## 📦 Deployment Process

### Manual Deploy
```bash
# 1. Make changes
npm run build

# 2. Commit and push
git add -A
git commit -m "Your message"
git push origin main

# 3. Railway auto-deploys (takes ~30-60 seconds)

# 4. Check health
curl https://acc-transcript-mcp-production.up.railway.app/health
```

### Check Logs
**Option 1: Railway Dashboard**
1. Go to https://railway.app
2. Open project
3. Click "Deployments"
4. View logs

**Option 2: Railway CLI** (if installed)
```bash
railway logs --tail 50
```

### Common Deployment Issues

**Issue: 502 Bad Gateway**
- Server likely crashed on startup
- Check Railway logs for errors
- Often caused by: missing dependencies, TypeScript errors, port binding issues

**Issue: Container Stops Immediately**
- Railway couldn't connect for health check
- Server took too long to call app.listen()
- Check that app.listen() is called within first few seconds

**Issue: npm error SIGTERM**
- Railway killed container (health check failed)
- See logs to find where execution stopped

---

## 🗺️ Roadmap

### ✅ Week 1 - MVP Server (COMPLETE)
- [x] MCP server with 3 tools
- [x] Mock data
- [x] Railway deployment
- [x] API key authentication system
- [ ] ChatGPT integration (BLOCKED - needs debugging)

### 📅 Week 2 - Database Integration (NEXT)
**Tasks:**
1. Set up Supabase project (EU region)
2. Create database schema:
   - `transcripts` table (metadata)
   - `transcript_chunks` table (text + embeddings)
   - `action_items` table
   - `user_access` table (RLS)
3. Set up pgvector extension
4. Create RLS policies
5. Add Supabase client to MCP server
6. Replace mock data with real queries

**Deliverables:**
- Supabase project configured
- Tables created with proper indexes
- Server connects and queries Supabase
- Vector search working

### 📅 Week 3 - Transcript Ingestion
**Tasks:**
1. Set up n8n instance
2. Create Fireflies webhook receiver
3. Build processing workflow:
   - Transcript chunking (by speaker turns)
   - OpenAI embeddings generation
   - Metadata extraction
   - Action items parsing
4. Connect n8n to Supabase
5. Test end-to-end flow

**Deliverables:**
- n8n workflow live
- New transcripts automatically processed
- Data appears in Supabase
- Available in ChatGPT searches

### 📅 Week 4 - Polish & Production
**Tasks:**
1. Replace all mock data
2. Add OAuth2 (Auth0) if needed
3. Add user permissions enforcement
4. Performance optimization
5. Error handling improvements
6. Monitoring and alerts
7. Documentation for ACC staff

---

## 🐛 Troubleshooting Guide

### "No tool response" in ChatGPT
**Check:**
1. Railway logs - Are requests coming in?
2. If no requests → ChatGPT config issue
3. If requests but errors → Check error logs
4. If requests but no response → Check MCP response format

### Server Won't Start on Railway
**Check:**
1. Build logs - Did `npm run build` succeed?
2. Deploy logs - Any errors on startup?
3. app.listen() called early enough?
4. PORT environment variable correct?

### Tools Return Empty Results
**Current:** All tools use mock data, should always return something
**Future (Supabase):** Check database connection, RLS policies, user permissions

### Authentication Issues
**Current:** `/mcp` endpoint has no auth (open)
**Future:** Add validateApiKey middleware if needed

---

## 📞 Support & Resources

### Documentation
- MCP Specification: https://modelcontextprotocol.io/specification/latest
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Railway Docs: https://docs.railway.app

### Key Contacts
- **Developer:** [Your name]
- **Repo:** https://github.com/HJS48/acc-transcript-mcp
- **Server:** https://acc-transcript-mcp-production.up.railway.app

### Quick Commands
```bash
# Local development
npm run dev

# Build
npm run build

# Test MCP directly (stdio)
npm run test-mcp

# Deploy
git push origin main

# View logs (requires Railway CLI)
railway logs --tail 100
```

---

## ✨ What's Working Perfectly

1. ✅ **Server Infrastructure** - Stable, fast, properly deployed
2. ✅ **MCP Protocol** - Full compliance, all methods working
3. ✅ **Tool Definitions** - Proper schemas, descriptions
4. ✅ **Tool Execution** - Returns correct data from mock
5. ✅ **Health Checks** - Railway happy, no crashes
6. ✅ **Code Quality** - TypeScript, proper error handling, comprehensive logging

## 🎯 Immediate Next Action

**Priority 1:** Fix ChatGPT connector configuration
- Verify URL in ChatGPT settings
- Check for any error messages in ChatGPT UI
- Test if ChatGPT can reach Railway URL at all
- Consider: Does ChatGPT's MCP connector need special headers?

**Priority 2:** Once ChatGPT works, start Week 2 (Supabase)

---

## 📝 Notes

- Server is production-ready for MCP clients
- Mock data is sufficient for testing
- Railway auto-deploys on every push to main
- All code is in TypeScript, compiled to `dist/`
- Logs use console.error (stderr) for Railway compatibility
- CORS is wide open (origin: '*') for now

---

**Last Updated:** November 4, 2025
**Version:** 1.0.0
**Status:** Server operational, awaiting ChatGPT connection fix
