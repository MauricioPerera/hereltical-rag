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

## Architecture

### Core Modules

-   **`src/db/jsonStore.ts`**: Manages the document structure in `documents.json`. Provides navigation methods (`getParent`, `getSiblings`).
-   **`src/db/vectorStore.ts`**: Manages embeddings in `rag.db` using `sqlite-vec`. Supports filtered KNN search.
-   **`src/indexer.ts`**: Handles the synchronization logic. It traverses the document tree, hashes content to detect changes, and updates the vector store accordingly.
-   **`src/ragEngine.ts`**: Orchestrates the retrieval process, combining vector search results with structural context from the JSON store.

### Data Model

-   **Documents**: Stored as a tree of `SectionNode`s.
-   **Vectors**: Stored with metadata (`doc_id`, `node_id`, `level`, `is_leaf`, `hash`).

## Development Phases

1.  **Phase 1: Minimum Happy Path**: Basic setup of JSON and Vector stores.
2.  **Phase 2: Hierarchy & Context**: Added tree navigation to enrich search results with parent/sibling context.
3.  **Phase 3: Hierarchical Search**: Implemented filtering and multi-step search strategies.
4.  **Phase 4: Updates & Maintenance**: Added hashing for change detection and efficient syncing.

## License

MIT
