# Quick Start Guide

Get up and running with Hierarchical RAG in 5 minutes!

## Prerequisites

- Node.js 18+ (recommended: 20.x)
- npm or yarn

## Installation

```bash
# Clone or navigate to the project
cd hierarchical-rag

# Install dependencies
npm install

# Verify installation
npm test
```

Expected output:
```
✓ Test Files  5 passed (5)
✓      Tests  32 passed (32)
```

## Option 1: Quick Demo (No API Key Required)

### Step 1: Index a Sample Document

```bash
# Index the example ML guide
npx tsx src/cli/indexFile.ts docs/example.md ml-guide
```

Output:
```
📄 Indexing file: docs/example.md
🆔 Document ID: ml-guide
💾 Saved to JSON store
🔄 Syncing document: ml-guide
✅ Successfully indexed document
```

### Step 2: Start the API Server

```bash
npm run server
```

Output:
```
╔════════════════════════════════════════════════════════════════╗
║          Hierarchical RAG API Server Started                  ║
╚════════════════════════════════════════════════════════════════╝

🚀 Server running at http://localhost:3000
📊 Embedding service: mock
💾 Vector DB: rag.db
📄 JSON Store: documents.json
```

### Step 3: Query Your Documents

Open a new terminal and test the API:

```bash
# Health check
curl http://localhost:3000/health

# List indexed documents
curl http://localhost:3000/api/docs

# Perform a semantic search
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the types of machine learning?",
    "k": 3
  }'
```

Response:
```json
{
  "query": "What are the types of machine learning?",
  "answer": "Context retrieved successfully. See sources.",
  "sources": [
    {
      "nodeId": "...",
      "docId": "ml-guide",
      "score": 0.0,
      "context": "[Context: Machine Learning Guide]\n## Introduction to Machine Learning\n..."
    }
  ]
}
```

## Option 2: Production Setup with OpenAI

### Step 1: Get an OpenAI API Key

Sign up at [platform.openai.com](https://platform.openai.com/) and create an API key.

### Step 2: Configure Environment

Create a `.env` file:

```bash
cat > .env << 'EOF'
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
EMBEDDING_SERVICE=openai
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# API Configuration
API_PORT=3000
API_HOST=localhost

# Database Paths
DB_PATH=rag.db
JSON_PATH=documents.json
EOF
```

### Step 3: Index Documents

```bash
# Index a single file
npx tsx src/cli/indexFile.ts docs/example.md ml-guide

# Or index an entire directory
npx tsx src/cli/indexFile.ts --dir ./docs
```

### Step 4: Start Server

```bash
npm run server
```

Now you're using real OpenAI embeddings! 🎉

## Common Use Cases

### 1. Index Your Documentation

```bash
# Create a docs directory
mkdir -p my-docs

# Add your markdown files
cp /path/to/your/docs/*.md my-docs/

# Index all of them
npx tsx src/cli/indexFile.ts --dir ./my-docs
```

### 2. Search Programmatically

```javascript
// Using fetch (browser or Node.js 18+)
const response = await fetch('http://localhost:3000/api/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'How do I deploy this?',
    k: 5
  })
});

const result = await response.json();
console.log(result.sources);
```

### 3. Filter Searches

```bash
# Search only in specific document
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "neural networks",
    "k": 3,
    "filters": {
      "doc_id": "ml-guide"
    }
  }'

# Search only H2 sections
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "deep learning",
    "k": 3,
    "filters": {
      "level": 2
    }
  }'

# Search only leaf nodes (most specific content)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "implementation details",
    "k": 3,
    "filters": {
      "is_leaf": 1
    }
  }'
```

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status |
| `/api/docs` | GET | List all documents |
| `/api/docs/:id` | GET | Get document by ID |
| `/api/docs/:id/structure` | GET | Get document structure |
| `/api/index` | POST | Index a document |
| `/api/query` | POST | Semantic search with context |
| `/api/query/search` | POST | Raw vector search |

## Development Workflow

### Development Mode (Auto-reload)

```bash
# Start server with auto-reload on file changes
npm run dev
```

### Testing While Developing

```bash
# Run tests in watch mode
npm run test:watch

# Or run tests once
npm test
```

### Adding New Documents

```bash
# Method 1: CLI
npx tsx src/cli/indexFile.ts path/to/document.md doc-id

# Method 2: API
curl -X POST http://localhost:3000/api/index \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "docId": "new-doc",
  "title": "New Document",
  "content": "# Title\n\n## Section 1\n\nContent here...",
  "version": 1
}
EOF
```

## Troubleshooting

### Issue: "Module not found"
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Port 3000 already in use"
```bash
# Solution 1: Change port in .env
echo "API_PORT=3001" >> .env

# Solution 2: Kill process on port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill
```

### Issue: "OPENAI_API_KEY is required"
```bash
# Solution: Use mock embeddings for development
echo "EMBEDDING_SERVICE=mock" > .env
```

### Issue: Database locked errors
```bash
# Solution: Close all connections and restart
rm -f rag.db documents.json
npm run server
```

## Next Steps

1. **Read the Full Documentation**
   - [README.md](README.md) - Complete API reference
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
   - [TESTING.md](TESTING.md) - Testing documentation

2. **Try Advanced Features**
   - Hierarchical search strategies
   - Custom filtering
   - Batch indexing

3. **Integrate with Your App**
   - Use the REST API
   - Build a custom UI
   - Add authentication

4. **Optimize for Production**
   - Configure OpenAI embeddings
   - Set up monitoring
   - Deploy to cloud

## Example Projects

### CLI-Based Knowledge Base

```bash
# 1. Create docs folder
mkdir -p knowledge-base

# 2. Add markdown files
echo "# Product FAQ\n\n## How to install?\n\n..." > knowledge-base/faq.md
echo "# API Guide\n\n## Authentication\n\n..." > knowledge-base/api.md

# 3. Index everything
npx tsx src/cli/indexFile.ts --dir ./knowledge-base

# 4. Query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "how to authenticate", "k": 3}'
```

### Programmatic Usage

```typescript
// index-docs.ts
import { indexMarkdownFile } from './src/cli/indexFile.js';

async function indexMyDocs() {
  await indexMarkdownFile('./docs/guide.md', 'guide');
  await indexMarkdownFile('./docs/tutorial.md', 'tutorial');
  console.log('Indexing complete!');
}

indexMyDocs();
```

## Resources

- **Documentation**: See `/docs` folder
- **Examples**: See `/examples` folder  
- **Tests**: See `/tests` folder
- **Issues**: Open an issue on GitHub

## Getting Help

1. Check [TROUBLESHOOTING](#troubleshooting)
2. Read [TESTING.md](TESTING.md)
3. Review [DEPLOYMENT.md](DEPLOYMENT.md)
4. Open an issue with:
   - Node.js version
   - Error messages
   - Steps to reproduce

---

**🎉 You're ready to build with Hierarchical RAG!**

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

