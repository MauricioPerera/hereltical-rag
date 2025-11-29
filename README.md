# Hierarchical RAG System

A lightweight, local-first Hierarchical Retrieval-Augmented Generation (RAG) system built with Node.js, SQLite (`sqlite-vec`), and `lowdb`.

This project demonstrates how to build a RAG system that understands document structure (Parent/Child/Sibling relationships) to provide richer context to LLMs, rather than just retrieving isolated text chunks.

## Features

-   **Hybrid Storage**:
    -   **Structure**: `lowdb` (JSON) stores the full document tree, preserving hierarchy.
    -   **Embeddings**: `SQLite` + `sqlite-vec` stores vector embeddings for fast similarity search.
-   **Hierarchical Context**: Retrieves not just the matching node, but its **Parent** (for broad context) and **Siblings** (for adjacent details).
-   **Multi-Level Search**: Supports filtering by document level (e.g., find a "Topic" first, then search for "Details" within it).
-   **Efficient Sync**: Implements change detection (hashing) to only re-embed modified sections, handling updates and deletions gracefully.
-   **Local & Fast**: Runs entirely locally without external vector DB dependencies.

## Requirements

-   **Node.js** 18+ (recommended: 20.x)
-   **npm** or **yarn**
-   **SQLite** with `sqlite-vec` extension (automatically loaded via npm package)

The project uses:
-   **ESM** (ES Modules) - requires Node.js with native ESM support
-   **TypeScript** 5.6+ with strict mode
-   **sqlite-vec** 0.1.1+ for vector operations (installed via npm, no manual setup needed)

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/MauricioPerera/hereltical-rag.git
    cd hereltical-rag
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Verify installation:
    ```bash
    npm test
    ```
    
    You should see all 32 tests passing.

## Usage

### Demo Script

The project includes a verification script that demonstrates the full pipeline:

```bash
npx tsx src/index.ts
```

This script will:
1.  Create a sample document structure.
2.  Index it (generating deterministic mock embeddings).
3.  Perform a hierarchical search (Topic -> Detail).
4.  Demonstrate the sync logic by modifying, adding, and deleting nodes.

**Example Output:**

```
╔════════════════════════════════════════════════════════════════╗
║     Hierarchical RAG Demo - Phase 4 (Sync & Updates)         ║
╚════════════════════════════════════════════════════════════════╝

[STEP 1] Initial Document Creation & Indexing
─────────────────────────────────────────────────
🔄 Syncing document: doc-sync-test
   ➕ Indexing new node: sec-1
   ➕ Indexing new node: root
✅ Sync complete for doc-sync-test

[STEP 2] Document Modifications
─────────────────────────────────────────────────
  • Modifying sec-1 content
  • Adding new sec-3
  • Deleting sec-2

🔄 Syncing document: doc-sync-test
   📝 Updating changed node: sec-1
   ➕ Indexing new node: sec-3
   🗑️  Deleting stale node: sec-2
✅ Sync complete for doc-sync-test

[STEP 3] Verification - Testing Change Detection
─────────────────────────────────────────────────
✅ Modified node found (sec-1) - Distance: 0.0
✅ New node found (sec-3) - Distance: 0.0
✅ Deleted node is gone (sec-2)

╔════════════════════════════════════════════════════════════════╗
║              ✅ Phase 4 Verification Successful!              ║
╚════════════════════════════════════════════════════════════════╝
```

This demonstrates:
- **Hierarchical context**: Retrieves parent and sibling nodes for richer context
- **Change detection**: Only re-embeds modified sections (via SHA-256 hashing)
- **Incremental sync**: Handles additions, modifications, and deletions efficiently

## Testing

Run the comprehensive test suite:

```bash
npm test
```

### Test Suite Results ✅

**Status:** All tests passing (100%)

The test suite includes:
-   **Embeddings**: 4 tests for deterministic mock embeddings
-   **Vector Store**: 9 tests covering CRUD operations, KNN search, and filtering
-   **JSON Store**: 8 tests for document management and tree navigation
-   **Indexer**: 4 tests for sync logic (change detection, updates, deletions)
-   **Markdown Parser**: 7 tests for H1/H2/H3 parsing and tree building

**Total: 32 tests** covering all core functionality.

```
Test Files  5 passed (5)
     Tests  32 passed (32)
  Duration  ~10-12 seconds
```

For watch mode during development:
```bash
npm run test:watch
```

For detailed testing information, see [TESTING.md](TESTING.md).

## Architecture

### System Flow

```
┌─────────────┐
│  Markdown   │
│   Document  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Markdown Parser │  Extracts H1/H2/H3 hierarchy
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  SectionNode    │  Tree structure built
│     Tree        │
└──────┬──────────┘
       │
       ├──────────────────────────┐
       │                          │
       ▼                          ▼
┌─────────────┐          ┌─────────────────┐
│   lowdb     │          │    Indexer      │
│ (JSON Store)│          │                 │
│             │          │ • Hash content  │
│ • Structure │          │ • Detect changes│
│ • Metadata  │          │ • Generate      │
│ • Relations │          │   embeddings    │
└─────────────┘          └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   sqlite-vec    │
                         │  (Vector Store) │
                         │                 │
                         │ • Embeddings    │
                         │ • Metadata      │
                         │ • KNN Search    │
                         └────────┬────────┘
                                  │
       ┌──────────────────────────┘
       │
       ▼
┌─────────────────┐
│  Query Vector   │  User query embedded
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   KNN Search    │  Find top-k similar sections
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   node_id(s)    │  Retrieved from vector search
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  JSON Lookup    │  Get node + parent + siblings
│   (lowdb)       │  from document tree
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Hierarchical   │  Rich context with structure
│    Context      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│      LLM        │  Generate answer with context
│   (Future)      │
└─────────────────┘
```

**Key Insight:** The `node_id` is the bridge between the vector search (similarity) and the hierarchical structure (context). This allows us to find relevant content via embeddings, then enrich it with parent/sibling context from the JSON tree.

### Core Modules

-   **`src/db/jsonStore.ts`**: Manages the document structure in `documents.json`. Provides navigation methods (`getParent`, `getSiblings`).
-   **`src/db/vectorStore.ts`**: Manages embeddings in `rag.db` using `sqlite-vec`. Supports filtered KNN search.
-   **`src/indexer.ts`**: Handles the synchronization logic. It traverses the document tree, hashes content to detect changes, and updates the vector store accordingly.
-   **`src/ragEngine.ts`**: Orchestrates the retrieval process, combining vector search results with structural context from the JSON store.
-   **`src/embeddings/`**: Modular embedding system with support for mock and OpenAI embeddings.

### Using Real Embeddings

The system currently uses **deterministic mock embeddings** for testing and development (no API key required). To use **real OpenAI embeddings** in production:

1. **Set your API key:**
   ```bash
   echo "OPENAI_API_KEY=sk-your-key-here" > .env
   echo "EMBEDDING_SERVICE=openai" >> .env
   ```

2. **The system automatically switches** to OpenAI's `text-embedding-3-small` model (1536 dimensions).

3. **Configuration options** (`.env`):
   ```env
   OPENAI_API_KEY=sk-...              # Your OpenAI API key
   EMBEDDING_SERVICE=openai           # 'mock' or 'openai'
   OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Model to use
   ```

**For local models** (e.g., sentence-transformers), implement a new service in `src/embeddings/` following the same interface:

```typescript
// src/embeddings/localEmbeddings.ts
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  // Your local model implementation
  // Must return array of 1536 numbers (or configure different dimension)
  return embeddings;
}
```

Then update `src/embeddings/index.ts` to add your service option.

### Data Model

#### Document Structure (JSON)

Each document is represented as a tree of `SectionNode`s:

```typescript
interface SectionNode {
  id: string              // Stable anchor (used as node_id in vector store)
  type: 'document' | 'section'
  level: number           // 0 = document, 1 = H1, 2 = H2, etc.
  title: string
  content: string[]       // Paragraphs within this section
  children: SectionNode[] // Child sections
}

interface Document {
  docId: string
  title: string
  version: number
  root: SectionNode
  nodes: Record<string, NodeMeta>  // Fast lookup map
}
```

**Example `SectionNode` tree:**

```typescript
{
  id: "sec-2",
  type: "section",
  level: 1,
  title: "Regularización L2",
  content: [],
  children: [
    {
      id: "sec-2-1",
      type: "section",
      level: 2,
      title: "Definición",
      content: ["La regularización L2 agrega un término λ||w||² al loss..."],
      children: []
    },
    {
      id: "sec-2-2",
      type: "section",
      level: 2,
      title: "Implementación práctica",
      content: ["En la práctica, L2 suele implementarse como weight decay..."],
      children: []
    }
  ]
}
```

**Key point:** The `id` field (e.g., `"sec-2-1"`) is the **stable anchor** that links:
- JSON structure (lowdb) ↔ Vector embeddings (SQLite)
- This allows updates without breaking references

The `nodes` map provides O(1) access to parent/children relationships:

```typescript
interface NodeMeta {
  id: string
  parentId: string | null
  childrenIds: string[]
  level: number
}
```

#### Vector Store (SQLite)

Embeddings and metadata are stored in two linked tables:

```sql
-- Section metadata
CREATE TABLE sections (
  rowid      INTEGER PRIMARY KEY,
  node_id    TEXT UNIQUE NOT NULL,  -- Links to SectionNode.id
  doc_id     TEXT NOT NULL,
  level      INTEGER NOT NULL,      -- 0=doc, 1=H1, 2=H2...
  is_leaf    INTEGER NOT NULL,      -- 1 if no children, 0 otherwise
  title      TEXT,
  hash       TEXT,                   -- SHA-256 of content for change detection
  path       TEXT,                   -- JSON array of title breadcrumbs
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Vector embeddings (sqlite-vec virtual table)
CREATE VIRTUAL TABLE vec_sections USING vec0(
  rowid INTEGER PRIMARY KEY,         -- Links to sections.rowid
  embedding FLOAT[1536]
);
```

**Key relationships:**
- `vec_sections.rowid` = `sections.rowid` (1:1 link)
- `sections.node_id` = `SectionNode.id` (links vector ↔ JSON hierarchy)

## Development Phases

1.  **Phase 1: Minimum Happy Path**: Basic setup of JSON and Vector stores.
2.  **Phase 2: Hierarchy & Context**: Added tree navigation to enrich search results with parent/sibling context.
3.  **Phase 3: Hierarchical Search**: Implemented filtering and multi-step search strategies.
4.  **Phase 4: Updates & Maintenance**: Added hashing for change detection and efficient syncing.

## HTTP API

The project now includes a REST API for indexing and querying documents.

### Starting the Server

```bash
npm run server
```

The server will start on `http://localhost:3000` by default.

### Configuration

Create a `.env` file in the project root:

```env
# OpenAI Configuration (optional - uses mock embeddings by default)
OPENAI_API_KEY=your_api_key_here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Embedding Service: 'mock' or 'openai'
EMBEDDING_SERVICE=mock

# API Configuration
API_PORT=3000
API_HOST=localhost

# Database Paths
DB_PATH=rag.db
JSON_PATH=documents.json
```

### API Endpoints

#### Health Check
```bash
GET /health
```

Returns server status and configuration info.

#### Index a Document
```bash
POST /api/index
Content-Type: application/json

{
  "docId": "my-doc",
  "title": "My Document",
  "content": "# Main Title\n\n## Section 1\n\nContent here...",
  "version": 1
}
```

#### Query with Hierarchical Context
```bash
POST /api/query
Content-Type: application/json

{
  "query": "What is regularization?",
  "k": 3,
  "filters": {
    "doc_id": "ml-guide",
    "level": 2,
    "is_leaf": 1
  }
}
```

#### Raw Vector Search
```bash
POST /api/query/search
Content-Type: application/json

{
  "query": "machine learning",
  "k": 5
}
```

#### List All Documents
```bash
GET /api/docs
```

#### Get Document by ID
```bash
GET /api/docs/:docId
```

#### Get Document Structure
```bash
GET /api/docs/:docId/structure
```

#### Get Document Sections
```bash
GET /api/docs/:docId/sections
```

## CLI Tools

### Index a Markdown File

```bash
# Index a single file
tsx src/cli/indexFile.ts ./path/to/document.md

# Index with custom doc ID
tsx src/cli/indexFile.ts ./path/to/document.md custom-id

# Index all markdown files in a directory
tsx src/cli/indexFile.ts --dir ./docs
```

## OpenAI Integration

The system now supports real OpenAI embeddings:

1. Set your OpenAI API key in `.env`:
   ```env
   OPENAI_API_KEY=sk-...
   EMBEDDING_SERVICE=openai
   ```

2. The system will automatically use OpenAI's `text-embedding-3-small` model (or configure with `OPENAI_EMBEDDING_MODEL`)

3. For development/testing, use `EMBEDDING_SERVICE=mock` for deterministic mock embeddings

## Next Steps

See [ROADMAP.md](ROADMAP.md) for detailed feature plans and timeline.

### Recently Completed ✅

1.  ✅ **Markdown Parser** - Parse H1/H2/H3 headings as tree structure
2.  ✅ **Real Embeddings** - OpenAI API integration with configurable models
3.  ✅ **HTTP API** - Full REST API with index, query, and document management
4.  ✅ **CLI Tools** - Command-line utilities for indexing files and directories
5.  ✅ **Configuration System** - Environment-based config with validation
6.  ✅ **Comprehensive Docs** - 11 documentation files covering all aspects

### High Priority (Next Quarter)

1.  **🔍 Hybrid Search** - Combine vector similarity with keyword matching (BM25)
2.  **🔐 Authentication** - API key auth, user management, rate limiting
3.  **⚡ Performance** - Query caching, batch processing, connection pooling
4.  **🤖 LLM Integration** - Direct OpenAI/Ollama integration for answer generation
5.  **📊 Monitoring** - Metrics, analytics, health dashboard

### Medium Priority

6.  **🖥️ Web UI** - Interactive document viewer, search interface, admin panel
7.  **📚 Advanced Docs** - PDF parsing, HTML support, multi-format indexing
8.  **🎯 Result Quality** - MMR diversity, reranking, confidence scores
9.  **📈 Analytics** - Query patterns, usage tracking, cost monitoring

### Experimental / Research

10. **🌐 Multi-language** - Cross-lingual search and embeddings
11. **🔗 Graph RAG** - Knowledge graph integration
12. **🔒 Privacy** - Encrypted embeddings, local-only mode

**Want to contribute?** Check [ROADMAP.md](ROADMAP.md) for details on planned features and how to help!

## Documentation

This project includes comprehensive documentation:

- **[QUICK_START.md](QUICK_START.md)** - Get started in 5 minutes
- **[TESTING.md](TESTING.md)** - Complete testing guide and results
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Executive summary
- **[examples/test-api.md](examples/test-api.md)** - API testing guide
- **[examples/quick-start.sh](examples/quick-start.sh)** - Quick start script

## License

MIT
