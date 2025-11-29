# Roadmap & Future Improvements

This document tracks planned improvements and feature requests for the Hierarchical RAG system.

## Current Status: v2.0.0 ✅

- [x] Hierarchical document storage (lowdb)
- [x] Vector embeddings (SQLite + sqlite-vec)
- [x] Mock embeddings (deterministic, for testing)
- [x] OpenAI embeddings integration
- [x] REST API (10 endpoints)
- [x] CLI tools for indexing
- [x] Change detection and incremental sync
- [x] Comprehensive documentation
- [x] 100% test coverage of core features

---

## Short-Term Improvements

### 1. Enhanced Markdown Parsing 🔄
**Priority:** Medium  
**Status:** Planned

- [ ] Support H4, H5, H6 headings (currently limited to H1-H3)
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
**Status:** Planned

- [ ] **Batch embedding generation**: Process multiple texts in parallel
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
**Status:** Planned

- [ ] **Document versioning**: Track changes over time
- [ ] **Rollback capability**: Revert to previous versions
- [ ] **Diff visualization**: Show what changed between versions
- [ ] **Merge conflicts**: Handle concurrent edits
- [ ] **Soft delete**: Archive instead of permanent deletion
- [ ] **Bulk operations**: Batch index/delete/update

---

### 6. Multi-Format Support 📄
**Priority:** Low  
**Status:** Ideas

- [ ] **PDF parsing**: Extract text and structure from PDFs
- [ ] **HTML parsing**: Convert web pages to hierarchy
- [ ] **Word documents**: Support .docx files
- [ ] **Jupyter notebooks**: Parse .ipynb with code/output
- [ ] **Custom parsers**: Plugin system for new formats

---

### 7. Monitoring & Analytics 📈
**Priority:** Medium  
**Status:** Planned

- [ ] **Query analytics**: Track popular queries
- [ ] **Performance metrics**: Latency, throughput, error rates
- [ ] **Usage tracking**: Documents indexed, queries per day
- [ ] **Cost tracking**: OpenAI API usage and costs
- [ ] **Health dashboard**: Real-time system status
- [ ] **Alerts**: Notify on errors or performance degradation

**Tools to Consider:**
- Grafana for dashboards
- Prometheus for metrics
- Sentry for error tracking

---

### 8. Authentication & Authorization 🔐
**Priority:** High (for production)  
**Status:** Planned

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
**Status:** Ongoing

- [ ] **TypeScript SDK**: Client library for TypeScript/JavaScript
- [ ] **Python SDK**: Client library for Python
- [ ] **Docker Compose**: One-command deployment
- [ ] **Kubernetes manifests**: Production-ready K8s setup
- [ ] **Example projects**: Showcase different use cases
- [ ] **Video tutorials**: Getting started screencasts

---

### 14. Testing & Quality 🧪
**Priority:** High  
**Status:** Ongoing

- [ ] **Integration tests**: Full end-to-end workflows
- [ ] **Load testing**: Performance under load (k6, Artillery)
- [ ] **Chaos testing**: Resilience to failures
- [ ] **Security testing**: Penetration testing, vulnerability scans
- [ ] **Accessibility testing**: WCAG compliance (for UI)
- [ ] **Browser testing**: Cross-browser compatibility (for UI)

---

### 15. Documentation Improvements 📖
**Priority:** Medium  
**Status:** Ongoing

- [ ] **Interactive tutorials**: Step-by-step guided tours
- [ ] **Video walkthroughs**: YouTube channel
- [ ] **Architecture decision records (ADRs)**: Document key decisions
- [ ] **API playground**: Interactive API testing (like Swagger)
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

### Q1 2025
- [ ] Hybrid search implementation
- [ ] Authentication & authorization
- [ ] Performance optimizations
- [ ] Basic monitoring

### Q2 2025
- [ ] LLM integration (OpenAI)
- [ ] Web UI (MVP)
- [ ] Advanced document management
- [ ] Docker & K8s deployment

### Q3 2025
- [ ] Multi-format support (PDF, HTML)
- [ ] Analytics dashboard
- [ ] Python SDK
- [ ] Load testing & optimization

### Q4 2025
- [ ] Advanced RAG techniques
- [ ] Multi-language support
- [ ] Community features
- [ ] Documentation overhaul

---

**Last Updated:** December 2024  
**Version:** 2.0.0  
**Status:** Living document (subject to change)

**Contributions welcome!** See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

