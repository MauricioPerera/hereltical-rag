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

The test suite includes:
-   **Embeddings**: 4 tests for deterministic mock embeddings
-   **Vector Store**: 9 tests covering CRUD operations, KNN search, and filtering
-   **JSON Store**: 8 tests for document management and tree navigation
-   **Indexer**: 4 tests for sync logic (change detection, updates, deletions)

**Total: 17 tests** covering all core functionality.

For watch mode during development:
```bash
npm run test:watch
```

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

## Next Steps / Roadmap

### Short-term (Ready to implement)

1.  **Markdown Parser**
    - Convert `.md` files to `SectionNode[]` hierarchy
    - Parse H1/H2/H3 headings as tree structure
    - Extract paragraph content for each section

2.  **Real Embeddings**
    - Replace mock embeddings with OpenAI API integration
    - Support for local models (e.g., sentence-transformers)
    - Configurable embedding dimensions

3.  **HTTP API**
    - `POST /index` - Upload and index documents
    - `POST /query` - Semantic search with hierarchical context
    - `GET /docs/:id` - Retrieve document structure

### Medium-term (Future enhancements)

4.  **Hybrid Search**
    - Combine vector similarity with keyword matching
    - Full-text search on `title` and `content` fields
    - Reranking based on both signals

5.  **Result Diversity**
    - Limit results from same document branch
    - MMR (Maximal Marginal Relevance) for diverse sections

6.  **Performance Optimizations**
    - Batch embedding generation
    - Incremental indexing for large documents
    - Query caching

## License

MIT
