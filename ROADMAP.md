# Roadmap & Future Improvements

This document tracks planned improvements and feature requests for the Hierarchical RAG system.

## 🆕 Graph Evolution: From Hierarchy to Knowledge Graph

**Status:** Phase 1.5 - COMPLETED ✅ | Phase 2.0 - COMPLETED ✅ | Phase 3.0 - Next 📋

hereltical-rag has evolved from a pure hierarchical system to a **knowledge graph** with **hybrid retrieval** (vector + graph). A tree is a special case of graph, and this evolution adds powerful cross-document reasoning capabilities.

**See:**
- `docs/GRAPH_EVOLUTION.md` - Complete design and architecture
- `docs/GRAPH_RAG.md` - Usage guide and API documentation
- `examples/test-graph-rag.sh` - Interactive demo

### Evolution Phases

**Phase 1.0** ✅ Hierarchical (Current)
- Tree structure per document
- Parent/child/sibling relationships
- Context limited to single document tree

**Phase 1.5** ✅ Basic Graph (COMPLETED)
- [x] Edges table in SQLite
- [x] Graph store API
- [x] SAME_TOPIC detection (cross-document similarity)
- [x] Graph expansion (BFS, multi-hop)
- [x] Graph API endpoints
- [x] Graph-aware RAG engine
- [x] POST /api/query/graph endpoint
- [x] Hybrid retrieval (vector + graph)
- [x] Documentation and examples

**Phase 2.0** ✅ Advanced Graph (COMPLETED)
- [x] REFERS_TO detection (markdown links) ✅
- [x] Reranking by edge types ✅
- [x] Graph visualization ✅
- [x] Multi-hop reasoning (1-3 hops with decay) ✅

**Phase 3.0** 🔮 Entities & Concepts (Future)
- [ ] Named Entity Recognition
- [ ] Concept extraction
- [ ] MENTIONS, DEFINES edges
- [ ] Graph embeddings

---

## Current Status: v2.0.0 ✅

### Fully Implemented Features

**Core System:**
- [x] Hierarchical document storage (lowdb)
- [x] Vector embeddings (SQLite + sqlite-vec)
- [x] Mock embeddings (deterministic, for testing)
- [x] OpenAI embeddings integration with batch processing
- [x] Ollama embeddings integration (local AI)
  - [x] nomic-embed-text support
  - [x] embeddinggemma tested and validated
  - [x] mxbai-embed-large support
- [x] Matryoshka embeddings support (storage optimization)
  - [x] Tested with embeddinggemma (768 → 384 dims)
  - [x] Performance validated: 50% storage reduction, ~80% quality
- [x] Change detection and incremental sync (SHA-256 hashing)
- [x] Markdown parser (H1/H2/H3 hierarchy)

**API & Tools:**
- [x] REST API (10 endpoints: health, docs, index, query)
- [x] CLI tools for indexing files and directories
- [x] Configuration system (environment variables, validation)
- [x] Error handling and logging

**Quality & Documentation:**
- [x] 32 unit tests with 100% pass rate
- [x] TypeScript strict mode, no errors
- [x] 11 comprehensive documentation files
- [x] Code examples and quick start guide
- [x] System architecture diagrams

### What's NOT Yet Implemented

**High Priority (Needed for Production):**
- [ ] Authentication & authorization
- [ ] Rate limiting
- [ ] Query caching
- [ ] Monitoring dashboard

**Medium Priority (Quality Improvements):**
- [x] **Graph Evolution (Phase 1.5)** - Basic graph infrastructure ✨ NEW
  - [x] Edges table in SQLite
  - [x] Graph store API (create, query, expand edges)
  - [x] SAME_TOPIC detection (embedding similarity)
  - [x] Graph expansion algorithm (BFS, multi-hop)
  - [x] Graph API endpoints
  - [ ] Graph-aware RAG engine (next step)
- [ ] Hybrid search (vector + keyword / BM25)
- [ ] Web UI
- [ ] LLM integration for answer generation
- [ ] Advanced markdown parsing (H4+, tables, code blocks)

**Low Priority (Nice to Have):**
- [x] ~~Graph Phase 2.0: Advanced features~~ ✅ COMPLETED
  - [x] Automatic REFERS_TO detection (markdown links) ✅
  - [x] Multi-hop reasoning (1-3 hops) ✅
  - [x] Reranking by edge type ✅
  - [x] Graph visualization endpoint ✅
- [ ] Graph Phase 3.0: Entities & Concepts
  - [ ] NER (Named Entity Recognition)
  - [ ] Concept nodes
  - [ ] MENTIONS, DEFINES edges
  - [ ] Graph embeddings
- [ ] PDF/HTML parsing
- [ ] Multi-language support
- [ ] Advanced RAG techniques

---

## Short-Term Improvements

### 1. Enhanced Markdown Parsing 🔄
**Priority:** Medium  
**Status:** Partially Implemented

**✅ Currently Supported:**
- [x] H1, H2, H3 hierarchy parsing
- [x] Paragraph extraction
- [x] Basic document structure
- [x] Title detection

**⏳ Pending:**
- [ ] Support H4, H5, H6 headings
- [ ] Parse code blocks with language detection
- [ ] Handle tables and preserve structure
- [ ] Parse ordered/unordered lists with nesting
- [ ] Preserve inline formatting (bold, italic, links)
- [ ] Handle images and media references

**Rationale:** More accurate document representation for technical documentation.

---

### 2. Advanced Search Features 🔍
**Priority:** High  
**Status:** Planned

- [ ] **Hybrid Search**: Combine vector similarity with keyword matching (BM25)
- [ ] **Reranking**: Score results by both vector similarity and text match
- [ ] **Query expansion**: Automatic synonym expansion
- [ ] **Multi-query search**: Combine results from multiple query variants
- [ ] **Faceted search**: Filter by document metadata (author, date, tags)

**Implementation Ideas:**
```typescript
// Example API
POST /api/query/hybrid
{
  "query": "machine learning",
  "mode": "hybrid",  // 'vector' | 'keyword' | 'hybrid'
  "weights": {
    "vector": 0.7,
    "keyword": 0.3
  }
}
```

---

### 3. Result Diversity & Quality 📊
**Priority:** Medium  
**Status:** Planned

- [ ] **MMR (Maximal Marginal Relevance)**: Ensure diverse results
- [ ] **Branch limiting**: Max results per document branch
- [ ] **Duplicate detection**: Remove semantically identical results
- [ ] **Confidence scores**: Estimate answer quality
- [ ] **Source attribution**: Clear provenance for each result

---

### 4. Performance Optimizations ⚡
**Priority:** High  
**Status:** Partially Implemented

**✅ Currently Implemented:**
- [x] **Batch embedding generation**: OpenAI batch processing support (`embedBatch()`)
- [x] **Change detection**: Only re-embeds modified sections (SHA-256 hashing)
- [x] **Efficient sync**: Skips unchanged nodes

**⏳ Pending:**
- [ ] **Query caching**: Cache frequent queries (Redis integration)
- [ ] **Lazy loading**: Stream results for large result sets
- [ ] **Index optimization**: SQLite vacuum and optimize
- [ ] **Connection pooling**: Reuse database connections
- [ ] **Async processing**: Background indexing for large documents

**Benchmarks to Track:**
- Indexing speed (docs/second)
- Query latency (p50, p95, p99)
- Memory usage
- Database size growth

---

## Medium-Term Features

### 5. Advanced Document Management 📚
**Priority:** Medium  
**Status:** Partially Implemented

**✅ Currently Implemented:**
- [x] **Basic versioning**: Document has `version` field
- [x] **Update detection**: Hash-based change detection
- [x] **Node deletion**: Clean removal from both stores

**⏳ Pending:**
- [ ] **Full version history**: Track all changes over time
- [ ] **Rollback capability**: Revert to previous versions
- [ ] **Diff visualization**: Show what changed between versions
- [ ] **Merge conflicts**: Handle concurrent edits
- [ ] **Soft delete**: Archive instead of permanent deletion
- [ ] **Bulk operations**: Batch index/delete/update via API

---

### 6. Multi-Format Support 📄
**Priority:** Low  
**Status:** Partially Implemented

**✅ Currently Supported:**
- [x] **Markdown files**: Full H1/H2/H3 hierarchy parsing
- [x] **Directory indexing**: Batch process multiple markdown files
- [x] **Local AI models**: Ollama integration for embeddings

**⏳ Pending:**
- [ ] **PDF parsing**: Extract text and structure from PDFs
- [ ] **HTML parsing**: Convert web pages to hierarchy
- [ ] **Word documents**: Support .docx files
- [ ] **Jupyter notebooks**: Parse .ipynb with code/output
- [ ] **Custom parsers**: Plugin system for new formats

---

### 7. Monitoring & Analytics 📈
**Priority:** Medium  
**Status:** Basic Implementation

**✅ Currently Implemented:**
- [x] **Request logging**: Basic request/response logging in API
- [x] **Health endpoint**: `/health` with system status
- [x] **Error handling**: Centralized error handling in API

**⏳ Pending:**
- [ ] **Query analytics**: Track popular queries
- [ ] **Performance metrics**: Latency, throughput, error rates
- [ ] **Usage tracking**: Documents indexed, queries per day
- [ ] **Cost tracking**: OpenAI API usage and costs
- [ ] **Health dashboard**: Real-time system status UI
- [ ] **Alerts**: Notify on errors or performance degradation

**Tools to Consider:**
- Grafana for dashboards
- Prometheus for metrics
- Sentry for error tracking

---

### 8. Authentication & Authorization 🔐
**Priority:** High (for production)  
**Status:** Not Implemented

**✅ Current Security:**
- [x] **CORS enabled**: Cross-origin resource sharing configured
- [x] **Input validation**: Zod schema validation on API endpoints
- [x] **Error handling**: Sanitized error messages

**⏳ Pending (Required for Production):**
- [ ] **API key authentication**: Secure API endpoints
- [ ] **User management**: Multi-user support
- [ ] **Role-based access**: Admin/user/readonly roles
- [ ] **Document-level permissions**: Control who can access what
- [ ] **Rate limiting**: Prevent abuse
- [ ] **Audit logs**: Track all operations

**Implementation:**
```typescript
// Example middleware
app.use('/api', requireAuth);
app.use('/api/admin', requireRole('admin'));
```

**Note:** Currently suitable for development/internal use only. Production deployment requires authentication.

---

## Long-Term Vision

### 9. Web UI 🖥️
**Priority:** Medium  
**Status:** Ideas

**Features:**
- [ ] Document upload and preview
- [ ] Interactive hierarchy visualization (tree view)
- [ ] Search interface with filters
- [ ] Result highlighting and context display
- [ ] Document editing and re-indexing
- [ ] Analytics dashboard
- [ ] Admin panel

**Tech Stack Options:**
- React + TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- D3.js for tree visualization

---

### 10. LLM Integration 🤖
**Priority:** High  
**Status:** Planned

- [ ] **OpenAI integration**: Direct LLM calls with retrieved context
- [ ] **Local LLMs**: Ollama, LM Studio support
- [ ] **Streaming responses**: Real-time answer generation
- [ ] **Citation generation**: Link answers to source sections
- [ ] **Follow-up questions**: Conversational interface
- [ ] **Prompt templates**: Customizable system prompts

**Example Flow:**
```
Query → Retrieve Context → Build Prompt → LLM → Stream Response
```

---

### 11. Advanced RAG Techniques 🎯
**Priority:** Medium  
**Status:** Research

- [ ] **Parent Document Retrieval**: Retrieve small chunks, return large context
- [ ] **Hypothetical Document Embeddings (HyDE)**: Generate hypothetical answers first
- [ ] **Multi-hop reasoning**: Chain multiple retrieval steps
- [ ] **Self-reflection**: LLM evaluates its own answers
- [ ] **Active retrieval**: Dynamic context gathering based on partial answers

---

### 12. Multi-Language Support 🌍
**Priority:** Low  
**Status:** Ideas

- [ ] **Language detection**: Auto-detect document language
- [ ] **Multi-lingual embeddings**: Use models like mBERT
- [ ] **Cross-lingual search**: Query in one language, find in another
- [ ] **Translation integration**: Auto-translate results

---

## Community & Ecosystem

### 13. Developer Experience 🛠️
**Priority:** Medium  
**Status:** Partially Implemented

**✅ Currently Available:**
- [x] **TypeScript project**: Full TypeScript support with strict mode
- [x] **REST API**: Well-documented HTTP API (can be used from any language)
- [x] **CLI tools**: Command-line utilities for indexing
- [x] **Example documents**: Sample markdown files in `docs/`
- [x] **Code examples**: In `examples/` directory
- [x] **Comprehensive docs**: 11 documentation files

**⏳ Pending:**
- [ ] **TypeScript SDK**: Dedicated client library for TypeScript/JavaScript
- [ ] **Python SDK**: Client library for Python
- [ ] **Docker Compose**: One-command deployment
- [ ] **Kubernetes manifests**: Production-ready K8s setup
- [ ] **Video tutorials**: Getting started screencasts
- [ ] **Interactive playground**: Web-based API testing

---

### 14. Testing & Quality 🧪
**Priority:** High  
**Status:** Well Established

**✅ Currently Implemented:**
- [x] **Unit tests**: 32 tests covering all core modules (100% passing)
- [x] **Test framework**: Vitest with TypeScript support
- [x] **Test isolation**: Clean setup/teardown for each test
- [x] **Mock data**: Deterministic mock embeddings for testing
- [x] **CI-ready**: Fast test execution (~10s)
- [x] **Type safety**: TypeScript strict mode, no errors

**⏳ Pending:**
- [ ] **Integration tests**: Full end-to-end API workflows
- [ ] **Load testing**: Performance under load (k6, Artillery)
- [ ] **Chaos testing**: Resilience to failures
- [ ] **Security testing**: Penetration testing, vulnerability scans
- [ ] **Accessibility testing**: WCAG compliance (for UI)
- [ ] **Browser testing**: Cross-browser compatibility (for UI)

---

### 15. Documentation Improvements 📖
**Priority:** Medium  
**Status:** Excellent Foundation

**✅ Currently Available:**
- [x] **Comprehensive README**: Complete project overview with examples
- [x] **Quick Start guide**: 5-minute getting started
- [x] **Testing documentation**: Full testing guide with results
- [x] **Deployment guide**: Production deployment instructions
- [x] **API documentation**: All endpoints documented with examples
- [x] **Changelog**: Version history and changes
- [x] **Roadmap**: This document with feature planning
- [x] **Contributing guide**: How to contribute to the project
- [x] **Code examples**: Multiple working examples
- [x] **System diagrams**: Architecture flow diagrams
- [x] **Validation report**: Technical validation details

**⏳ Pending:**
- [ ] **Interactive tutorials**: Step-by-step guided tours
- [ ] **Video walkthroughs**: YouTube channel
- [ ] **Architecture decision records (ADRs)**: Document key decisions
- [ ] **API playground**: Interactive API testing (like Swagger UI)
- [ ] **Community examples**: User-contributed use cases
- [ ] **Translated docs**: Spanish, Chinese, Japanese, etc.

---

## Research & Experimentation

### Ideas to Explore

1. **Graph-based retrieval**: Model documents as knowledge graphs
2. **Multi-modal RAG**: Combine text, images, and code
3. **Federated RAG**: Query across multiple independent instances
4. **Incremental learning**: Update embeddings without full re-index
5. **Explainability**: Why was this result retrieved?
6. **Privacy-preserving RAG**: Encrypted embeddings, differential privacy

---

## How to Contribute

### Suggesting Improvements

1. Check if the feature is already listed here
2. Open an issue on GitHub with:
   - **Title**: Clear, concise description
   - **Motivation**: Why is this needed?
   - **Proposal**: How should it work?
   - **Alternatives**: Other approaches considered
3. Tag the issue appropriately (`enhancement`, `bug`, `documentation`)

### Implementing Features

1. Comment on the issue to claim it
2. Fork the repository
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Implement with tests and documentation
5. Submit a pull request
6. Address review feedback

---

## Priority Legend

- **High**: Core functionality, blocking issues, or high user demand
- **Medium**: Important but not urgent, quality-of-life improvements
- **Low**: Nice to have, experimental features

---

## Timeline (Tentative)

### ✅ Completed (2024)
- [x] ~~Core RAG system~~ (v1.0.0)
- [x] ~~OpenAI integration~~ (v2.0.0)
- [x] ~~REST API~~ (v2.0.0)
- [x] ~~CLI tools~~ (v2.0.0)
- [x] ~~Comprehensive documentation~~ (v2.0.0)
- [x] ~~Markdown parser~~ (v2.0.0)

### Q1 2025 (High Priority)
- [ ] Authentication & authorization ⚠️ **Required for production**
- [ ] Rate limiting
- [ ] Hybrid search implementation
- [ ] Query caching (Redis)
- [ ] Performance monitoring

### Q2 2025 (Feature Expansion)
- [ ] LLM integration (OpenAI/Ollama)
- [ ] Web UI (MVP)
- [ ] Advanced document management
- [ ] Docker Compose setup
- [ ] Integration tests

### Q3 2025 (Enhancement)
- [ ] Multi-format support (PDF, HTML)
- [ ] Analytics dashboard
- [ ] Python SDK
- [ ] Load testing & optimization
- [ ] Advanced markdown parsing

### Q4 2025 (Advanced Features)
- [ ] Advanced RAG techniques (HyDE, multi-hop)
- [ ] Kubernetes manifests
- [ ] Multi-language support
- [ ] Video tutorials
- [ ] Community showcase

---

**Last Updated:** December 2024  
**Version:** 2.0.0  
**Status:** Living document (subject to change)

**Contributions welcome!** See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

