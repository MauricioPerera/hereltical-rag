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

## Usage

The project includes a verification script that demonstrates the full pipeline:

```bash
npx tsx src/index.ts
```

This script will:
1.  Create a sample document structure.
2.  Index it (generating deterministic mock embeddings).
3.  Perform a hierarchical search (Topic -> Detail).
4.  Demonstrate the sync logic by modifying, adding, and deleting nodes.

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

### Core Modules

-   **`src/db/jsonStore.ts`**: Manages the document structure in `documents.json`. Provides navigation methods (`getParent`, `getSiblings`).
-   **`src/db/vectorStore.ts`**: Manages embeddings in `rag.db` using `sqlite-vec`. Supports filtered KNN search.
-   **`src/indexer.ts`**: Handles the synchronization logic. It traverses the document tree, hashes content to detect changes, and updates the vector store accordingly.
-   **`src/ragEngine.ts`**: Orchestrates the retrieval process, combining vector search results with structural context from the JSON store.
-   **`src/embeddings.ts`**: Provides embedding generation. Currently uses deterministic mock embeddings for testing. **For production**, replace with OpenAI API or local model while maintaining the same signature: `async embed(text: string): Promise<number[]>`.

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

## Next Steps / Roadmap

### Recently Completed ✅

1.  ✅ **Markdown Parser** - Parse H1/H2/H3 headings as tree structure
2.  ✅ **Real Embeddings** - OpenAI API integration with configurable models
3.  ✅ **HTTP API** - Full REST API with index, query, and document management
4.  ✅ **CLI Tools** - Command-line utilities for indexing files and directories

### Future Enhancements

1.  **Hybrid Search**
    - Combine vector similarity with keyword matching
    - Full-text search on `title` and `content` fields
    - Reranking based on both signals

2.  **Result Diversity**
    - Limit results from same document branch
    - MMR (Maximal Marginal Relevance) for diverse sections

3.  **Performance Optimizations**
    - Batch embedding generation (already supported for OpenAI)
    - Incremental indexing for large documents
    - Query caching

4.  **Additional Features**
    - Document versioning and updates
    - Delete operations for documents
    - Bulk indexing with progress tracking
    - Web UI for visualization and testing

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
