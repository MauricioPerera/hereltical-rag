# Testing Guide

## ✅ Test Results

### Status: **ALL TESTS PASSING**

```
Test Files  5 passed (5)
     Tests  32 passed (32)
  Duration  ~10-12 seconds
```

## Test Suite Overview

### 1. Embeddings Tests (`tests/embeddings.test.ts`)
**4 tests** - Testing the embedding service

✅ **Passing Tests:**
- Returns vector of length 1536
- Deterministic (same text → same vector)
- Different vectors for different texts
- Produces numeric values

**Coverage:**
- Mock embedding generation
- Determinism validation
- Vector dimensions
- Data type validation

---

### 2. JSON Store Tests (`tests/jsonStore.test.ts`)
**8 tests** - Testing document storage and navigation

✅ **Passing Tests:**
- Save and load documents
- Get parent nodes
- Get children nodes
- Get siblings nodes
- Find documents by node ID
- Node existence validation
- Tree navigation edge cases

**Coverage:**
- Document CRUD operations
- Hierarchical navigation (parent/children/siblings)
- Node lookup and retrieval
- Edge cases (non-existent nodes)

---

### 3. Markdown Parser Tests (`tests/markdownParser.test.ts`)
**7 tests** - Testing markdown parsing

✅ **Passing Tests:**
- Parse simple markdown with H1 and H2
- Handle documents without H1
- Ignore headings deeper than H3
- Preserve paragraph breaks
- Extract all text from tree
- Count sections correctly
- Handle document-only trees

**Coverage:**
- H1/H2/H3 parsing
- Paragraph extraction
- Tree structure building
- Section counting
- Text extraction
- Edge cases (no H1, deep headings)

---

### 4. Indexer Tests (`tests/indexer.test.ts`)
**4 tests** - Testing document indexing and synchronization

✅ **Passing Tests:**
- Index a new document
- Skip unchanged nodes on re-sync
- Update changed nodes
- Delete removed nodes

**Coverage:**
- Initial indexing
- Change detection (SHA-256 hashing)
- Incremental updates
- Node deletion
- Sync logic

**Note:** Added small delays (50ms) to prevent SQLite lock issues on Windows

---

### 5. Vector Store Tests (`tests/vectorStore.test.ts`)
**9 tests** - Testing vector database operations

✅ **Passing Tests:**
- Insert a new section
- Update an existing section
- Find exact matches with distance 0
- Filter by doc_id
- Filter by level
- Filter by is_leaf
- Delete a section and its vector
- Return all node IDs for a document
- Return empty array for non-existent document

**Coverage:**
- Section CRUD operations
- Vector embedding storage
- KNN search
- Filtering (document, level, leaf status)
- Exact match detection
- Batch operations

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### TypeScript Validation
```bash
npx tsc --noEmit
```

## Test Configuration

**Framework:** Vitest v4.0.14  
**Environment:** Node.js  
**Databases:** Isolated test instances

Each test suite uses isolated database files:
- `test-rag.db` - Vector database
- `test-documents.json` - JSON document store

These files are automatically cleaned up before and after each test run.

## Coverage Areas

### ✅ Fully Tested
- [x] Embedding generation (mock service)
- [x] Document storage and retrieval
- [x] Hierarchical navigation
- [x] Markdown parsing
- [x] Vector search (KNN)
- [x] Document indexing
- [x] Change detection and sync
- [x] Section filtering

### 🔄 Integration Tests Needed
- [ ] OpenAI embedding service (requires API key)
- [ ] REST API endpoints
- [ ] CLI tools
- [ ] End-to-end workflows

### 📝 Manual Testing

#### CLI Indexing
```bash
# Test single file indexing
npx tsx src/cli/indexFile.ts docs/example.md test-doc

# Test directory indexing
npx tsx src/cli/indexFile.ts --dir ./docs
```

Expected output:
```
📄 Indexing file: docs/example.md
🆔 Document ID: test-doc

💾 Saved to JSON store
🔄 Syncing document: test-doc
   ➕ Indexing new node: ...
✅ Sync complete for test-doc

✅ Successfully indexed document:
   Title: Machine Learning Guide
   Sections: X
   DocID: test-doc
```

#### API Server
```bash
# Start server
npm run server

# Test health endpoint
curl http://localhost:3000/health

# Test document listing
curl http://localhost:3000/api/docs

# Test query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "k": 3}'
```

## Known Issues

### 1. Windows SQLite Locking
**Issue:** Occasional "database is locked" errors on Windows  
**Solution:** Added 50ms delays in tests to prevent concurrent access  
**Status:** ✅ Fixed

### 2. Dotenv Console Messages
**Issue:** Dotenv library prints tips to console  
**Impact:** Cosmetic only, doesn't affect functionality  
**Status:** 📝 Known, not critical

## Performance Benchmarks

Average test execution times:
- `embeddings.test.ts`: ~30-50ms
- `jsonStore.test.ts`: ~40-70ms
- `markdownParser.test.ts`: ~30-50ms
- `indexer.test.ts`: ~3-5 seconds (includes DB operations)
- `vectorStore.test.ts`: ~6-8 seconds (includes vector operations)

**Total:** ~10-12 seconds for full suite

## Continuous Integration

### Pre-commit Checklist
- [ ] Run `npm test` - All tests pass
- [ ] Run `npx tsc --noEmit` - No TypeScript errors
- [ ] Check `npm run test:watch` - No failing tests
- [ ] Manual API test (if API changes)

### CI/CD Recommendations

```yaml
# Example GitHub Actions workflow
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npx tsc --noEmit
```

## Debugging Tests

### Enable Verbose Logging
```bash
DEBUG=* npm test
```

### Run Single Test File
```bash
npx vitest run tests/embeddings.test.ts
```

### Run Specific Test
```bash
npx vitest run -t "should be deterministic"
```

### Watch Mode for Development
```bash
npm run test:watch
```

## Test Data

### Sample Documents
- `docs/example.md` - Machine Learning Guide (10 sections)

### Test Database Locations
- `test-rag.db` - Temporary vector database
- `test-documents.json` - Temporary JSON store
- Both are auto-cleaned before/after tests

## Adding New Tests

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { yourFunction } from '../src/yourModule.js';

describe('yourModule', () => {
    beforeEach(() => {
        // Setup code
    });

    afterEach(() => {
        // Cleanup code
    });

    it('should do something specific', () => {
        const result = yourFunction('input');
        expect(result).toBe('expected');
    });
});
```

### Best Practices
1. Use descriptive test names
2. One assertion per test (when possible)
3. Clean up resources in `afterEach`
4. Use isolated test data
5. Avoid test interdependencies

## Troubleshooting

### Tests Fail on First Run
**Cause:** Database files from previous runs  
**Solution:**
```bash
rm -f test-rag.db test-documents.json
npm test
```

### TypeScript Errors
**Cause:** Out of date type definitions  
**Solution:**
```bash
npm install
npx tsc --noEmit
```

### Port Already in Use (API tests)
**Cause:** Previous server instance still running  
**Solution:**
```bash
# Windows
taskkill /F /IM node.exe

# Linux/Mac
pkill -f node
```

## Test Quality Metrics

- **Test Count:** 32
- **Pass Rate:** 100%
- **Coverage:** High (core functionality)
- **Execution Time:** ~10-12 seconds
- **Flakiness:** None (after fixes)
- **Maintainability:** High

## Future Test Improvements

1. **API Integration Tests**
   - Full REST API endpoint coverage
   - Authentication/authorization tests
   - Error handling scenarios

2. **Load Testing**
   - Large document indexing
   - Concurrent query handling
   - Database performance under load

3. **OpenAI Integration Tests**
   - Real embedding generation
   - API error handling
   - Rate limiting behavior

4. **E2E Tests**
   - Complete user workflows
   - CLI to API interactions
   - Multi-document scenarios

---

**Last Updated:** December 2024  
**Test Framework:** Vitest 4.0.14  
**Node Version:** 20.x  
**Status:** ✅ All Systems Go

