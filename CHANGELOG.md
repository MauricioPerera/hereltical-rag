# Changelog

## [Unreleased]

### Added
- **Graph Evolution (Phase 1.5)** 🎯 - Basic knowledge graph infrastructure
  - Added `edges` table in SQLite for explicit relationships
  - New `graphStore.ts` with full graph API:
    - Create/update/delete edges
    - Query neighbors (incoming/outgoing)
    - Graph expansion algorithm (BFS, multi-hop)
    - Graph statistics
  - New `relationsDetector.ts` for automatic edge detection:
    - `detectSameTopicEdges()` using embedding similarity
    - Cosine similarity calculation
    - Configurable thresholds and limits
  - Graph API endpoints (`/api/graph/*`):
    - `GET /api/graph/stats` - Graph statistics
    - `GET /api/graph/neighbors/:nodeId` - Get neighbors
    - `GET /api/graph/edges/:nodeId` - Get edges
    - `POST /api/graph/expand` - Expand from seed nodes
    - `POST /api/graph/build/same-topic` - Build SAME_TOPIC edges
  - CLI tool `buildGraph.ts`:
    - Build SAME_TOPIC edges from command line
    - View graph statistics
    - Configurable similarity thresholds
  - Complete design document: `docs/GRAPH_EVOLUTION.md`
  - Edge types: PARENT_OF, CHILD_OF, NEXT_SIBLING, PREV_SIBLING, SAME_TOPIC, REFERS_TO

### Changed
- Updated `vectorStore.ts` to create edges table on initialization
- Updated API server to include graph routes
- Expanded ROADMAP with 3-phase graph evolution plan

### Documentation
- Created `docs/GRAPH_EVOLUTION.md` - Complete graph design and architecture
- Updated `ROADMAP.md` with graph evolution phases
- Documented graph API endpoints

### Tested
- **embeddinggemma Model** ✅ - Comprehensive testing with Ollama
  - Tested with Google's embeddinggemma (768 dimensions)
  - Validated matryoshka truncation (768 → 384 dims)
  - Performance verified: 0.62-0.93 search scores, < 100ms queries
  - Multi-document search validated across 2 indexed documents
  - Full test report available in `PRUEBAS_GEMMA.md`
  - Created example document `docs/ai-history.md` for testing
  - Automated test script `test-gemma.sh` for easy validation

### Added
- **Matryoshka Embeddings Support** 🪆 - Storage & speed optimization
  - Truncate embeddings to reduce storage by 50-75%
  - Improve search speed by 2-6x while maintaining 70-95% quality
  - New configuration options: `MATRYOSHKA_ENABLED`, `MATRYOSHKA_DIMENSIONS`
  - Support for OpenAI (text-embedding-3-*) and Ollama (nomic-embed-text, mxbai-embed-large) models
  - Utility functions: `truncateEmbedding()`, `getRecommendedDimensions()`, `estimateQualityRetention()`, `getStorageSavings()`
  - Comprehensive matryoshka guide in `docs/MATRYOSHKA.md`
  - Dynamic dimension tracking in vector store (added `dimensions` column)
  
- **Ollama Integration** 🎉 - Local AI embeddings support
  - New embedding service: `ollama`
  - Support for local embedding models (nomic-embed-text, mxbai-embed-large, all-minilm)
  - Privacy-preserving, offline embeddings
  - No API costs
  - Configuration via `OLLAMA_URL` and `OLLAMA_EMBEDDING_MODEL`
  - Comprehensive Ollama documentation in `docs/OLLAMA.md`
  - Helper functions: `checkOllamaAvailability()`, `listOllamaModels()`

### Changed
- Updated vector store to support dynamic embedding dimensions (max 2048)
- Enhanced embedding service info endpoint to report matryoshka status and effective dimensions
- Updated embedding facade to apply matryoshka truncation when enabled
- Added automatic padding for embeddings smaller than table dimensions
- Updated `EMBEDDING_SERVICE` config to support 'mock' | 'openai' | 'ollama'
- Enhanced embedding service info to include model dimensions and URL
- Updated Quick Start guide with Ollama and Matryoshka options
- Updated README with matryoshka section and configuration examples

## Version 2.0.0 - Major Feature Release

### ✨ New Features

#### 1. Real Embeddings Support
- **OpenAI Integration**: Full integration with OpenAI's embedding API
  - Support for `text-embedding-3-small` (default) and configurable models
  - Automatic batch processing for efficient embedding generation
  - Graceful fallback to mock embeddings for development

- **Dual Embedding Services**: 
  - `mock`: Deterministic embeddings for testing (no API key required)
  - `openai`: Production-ready embeddings via OpenAI API

#### 2. HTTP REST API
- **Complete API Server** built with Express.js
  - CORS support for cross-origin requests
  - JSON request/response handling
  - Comprehensive error handling and logging

- **Health Endpoint** (`GET /health`)
  - Server status and configuration information
  - Embedding service details

- **Index Endpoints** (`POST /api/index`)
  - Index markdown documents via API
  - Automatic parsing and hierarchical structure extraction
  - Status endpoint for monitoring

- **Query Endpoints**
  - `POST /api/query`: Semantic search with hierarchical context
  - `POST /api/query/search`: Raw vector search without context enrichment
  - Flexible filtering by document, level, and leaf status

- **Document Management Endpoints**
  - `GET /api/docs`: List all indexed documents
  - `GET /api/docs/:docId`: Get complete document
  - `GET /api/docs/:docId/structure`: Get document structure without content
  - `GET /api/docs/:docId/sections`: Get all sections with metadata

#### 3. CLI Tools
- **File Indexing** (`src/cli/indexFile.ts`)
  - Index single markdown files
  - Batch index entire directories
  - Custom document ID support
  - Progress logging and error handling

#### 4. Configuration System
- **Environment-based Configuration** (`src/config.ts`)
  - `.env` file support via dotenv
  - Configurable API keys and service selection
  - Validation with helpful error messages
  - Type-safe configuration object

### 🏗️ Architecture Improvements

#### Modular Embedding System
```
src/embeddings/
├── index.ts           # Main facade
├── mockEmbeddings.ts  # Deterministic mock service
└── openaiEmbeddings.ts # OpenAI API integration
```

#### API Structure
```
src/api/
├── server.ts          # Express app setup
└── routes/
    ├── health.ts      # Health checks
    ├── index.ts       # Document indexing
    ├── query.ts       # Search operations
    └── docs.ts        # Document management
```

### 📚 Documentation

- **Updated README.md** with:
  - API endpoint documentation
  - Configuration guide
  - OpenAI integration instructions
  - CLI usage examples

- **Example Files**:
  - `docs/example.md`: Sample ML guide document
  - `examples/test-api.md`: API testing guide
  - `examples/quick-start.sh`: Quick start script

### 🔧 Configuration

New environment variables:
```env
OPENAI_API_KEY=        # Your OpenAI API key
OPENAI_EMBEDDING_MODEL # Model to use (default: text-embedding-3-small)
EMBEDDING_SERVICE=     # 'mock' or 'openai'
API_PORT=              # Server port (default: 3000)
API_HOST=              # Server host (default: localhost)
DB_PATH=               # Vector database path
JSON_PATH=             # JSON store path
```

### 📦 New Dependencies

**Production**:
- `openai@^6.9.1` - OpenAI API client
- `express@^5.1.0` - Web framework
- `cors@^2.8.5` - CORS middleware
- `dotenv@^17.2.3` - Environment configuration

**Development**:
- `@types/express@^5.0.5`
- `@types/cors@^2.8.19`

### 🚀 New Scripts

```json
{
  "server": "tsx src/server.ts",  // Start API server
  "dev": "tsx watch src/server.ts" // Development mode with auto-reload
}
```

### ✅ Testing

- All 32 existing tests pass
- No breaking changes to existing functionality
- TypeScript compilation successful with no errors

### 📊 Performance

- Batch embedding support for OpenAI (process multiple texts in one API call)
- Efficient request handling with Express
- Graceful error handling and recovery

### 🔄 Backward Compatibility

- Existing `embed()` function maintained for backward compatibility
- All original tests continue to pass
- Mock embeddings remain the default (no API key required)

### 🎯 Usage Examples

#### Start the Server
```bash
npm run server
```

#### Index a Document via CLI
```bash
tsx src/cli/indexFile.ts docs/example.md ml-guide
```

#### Query via API
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is supervised learning?", "k": 3}'
```

### 🐛 Bug Fixes

- Fixed Windows file locking issues in tests
- Fixed markdown parser H1 handling
- Fixed TypeScript strict mode errors

---

## Version 1.0.0 - Initial Release

- Hierarchical RAG system with SQLite + lowdb
- Mock embeddings for testing
- Document indexing and sync
- Vector search with KNN
- Hierarchical context retrieval
- Comprehensive test suite (32 tests)

