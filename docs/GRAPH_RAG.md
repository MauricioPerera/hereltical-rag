# Graph-Aware RAG: Hybrid Vector + Graph Retrieval

## Overview

**Graph-Aware RAG** combines traditional vector similarity search with graph traversal to create richer, more contextual retrievals. Instead of being limited to the top K most similar chunks, the system can explore relationships between documents to find related content that might not be lexically similar but is semantically connected.

## The Problem with Pure Vector Search

Traditional RAG systems rely solely on vector similarity:

```
Query: "How do neural networks work?"
  ↓
Vector Search (top 3):
  1. Section: "Neural Networks" (score: 0.95)
  2. Section: "Deep Learning Intro" (score: 0.82)
  3. Section: "Activation Functions" (score: 0.76)
```

**Limitations:**
- ❌ Misses related content in other documents
- ❌ No understanding of cross-document relationships
- ❌ Can't follow conceptual connections
- ❌ Limited to K most similar chunks

## The Solution: Graph Expansion

Graph-Aware RAG adds graph traversal:

```
Query: "How do neural networks work?"
  ↓
Vector Search (seeds):
  1. Section: "Neural Networks" (score: 0.95)
  ↓
Graph Expansion (from seed):
  → SAME_TOPIC → "History of Neural Nets" (other doc)
  → PARENT_OF → "Machine Learning" (context)
  → REFERS_TO → "Backpropagation" (referenced)
  ↓
Final Context:
  • Original match + definition
  • Historical perspective
  • Broader ML context
  • Technical details
```

**Benefits:**
- ✅ Cross-document reasoning
- ✅ Richer, multi-perspective context
- ✅ Discovers non-obvious connections
- ✅ Better topic coverage

---

## How It Works

### 1. Hybrid Retrieval Pipeline

```typescript
// Traditional RAG
POST /api/query
{
  "query": "deep learning",
  "k": 3
}
// Returns: Top 3 similar sections

// Graph-Aware RAG
POST /api/query/graph
{
  "query": "deep learning",
  "k": 3,
  "graphConfig": {
    "useGraph": true,
    "maxHops": 2,
    "maxGraphNodes": 10,
    "edgeTypes": ["SAME_TOPIC", "PARENT_OF"]
  }
}
// Returns: 3 seeds + up to 10 related nodes via graph
```

### 2. Graph Expansion Algorithm

The system uses **Breadth-First Search (BFS)** to expand from seed nodes:

```
Seeds: [A, B]  (from vector search)
  │
  ├─ Hop 0: A, B (seeds)
  │
  ├─ Hop 1: 
  │    A → SAME_TOPIC → C (cross-doc)
  │    A → PARENT_OF → D (context)
  │    B → REFERS_TO → E (reference)
  │
  └─ Hop 2:
       C → CHILD_OF → F (drill-down)
       D → SAME_TOPIC → G (related)

Final nodes: [A, B, C, D, E, F, G]
```

### 3. Scoring Strategy

Nodes are scored differently based on how they were found:

| Source | Score Calculation | Example |
|--------|-------------------|---------|
| **Seed (vector)** | Vector distance | 0.05 (very similar) |
| **Graph (with weight)** | 1 - edge_weight | 0.15 (0.85 similarity) |
| **Graph (hop-based)** | hop × 0.3 | 0.3 (1 hop away) |

Lower score = better match.

---

## Configuration

### GraphRagConfig

```typescript
interface GraphRagConfig {
  useGraph: boolean;           // Enable graph expansion
  maxHops: number;             // How far to traverse (1-3)
  maxGraphNodes: number;       // Max nodes to add
  edgeTypes: EdgeType[];       // Which edges to follow
  minEdgeWeight?: number;      // Min similarity for edges
  combineStrategy: 'union' | 'rerank';  // How to combine results
}
```

### Default Configuration

```typescript
{
  useGraph: true,
  maxHops: 1,
  maxGraphNodes: 10,
  edgeTypes: ['SAME_TOPIC', 'PARENT_OF', 'CHILD_OF'],
  minEdgeWeight: 0.7,
  combineStrategy: 'union'
}
```

### Recommended Configurations

#### Conservative (Fast, Precise)
```json
{
  "useGraph": true,
  "maxHops": 1,
  "maxGraphNodes": 5,
  "edgeTypes": ["SAME_TOPIC"],
  "minEdgeWeight": 0.85
}
```
- Use when: You want only highly related content
- Speed: Fast
- Quality: High precision, moderate recall

#### Balanced (Default)
```json
{
  "useGraph": true,
  "maxHops": 2,
  "maxGraphNodes": 10,
  "edgeTypes": ["SAME_TOPIC", "PARENT_OF"],
  "minEdgeWeight": 0.7
}
```
- Use when: General purpose queries
- Speed: Medium
- Quality: Balanced precision/recall

#### Exploratory (Comprehensive)
```json
{
  "useGraph": true,
  "maxHops": 2,
  "maxGraphNodes": 20,
  "edgeTypes": ["SAME_TOPIC", "PARENT_OF", "CHILD_OF", "REFERS_TO"],
  "minEdgeWeight": 0.6
}
```
- Use when: You want comprehensive coverage
- Speed: Slower
- Quality: High recall, lower precision

---

## API Usage

### Endpoint: POST /api/query/graph

**Request:**
```json
{
  "query": "What is regularization in machine learning?",
  "k": 2,
  "graphConfig": {
    "useGraph": true,
    "maxHops": 1,
    "maxGraphNodes": 8,
    "edgeTypes": ["SAME_TOPIC", "PARENT_OF"],
    "minEdgeWeight": 0.75
  }
}
```

**Response:**
```json
{
  "query": "What is regularization in machine learning?",
  "answer": "Found 2 direct matches and 4 related nodes via graph expansion.",
  "sources": [
    {
      "nodeId": "ml-guide#regularization",
      "docId": "ml-guide",
      "score": 0.03,
      "context": "## Regularization\nRegularization techniques...",
      "graph": {
        "hop": 0,
        "edgeType": null,
        "edgeWeight": null
      }
    },
    {
      "nodeId": "deep-learning#dropout",
      "docId": "deep-learning",
      "score": 0.18,
      "context": "## Dropout\nA regularization technique...",
      "graph": {
        "hop": 1,
        "edgeType": "SAME_TOPIC",
        "edgeWeight": 0.82
      }
    },
    {
      "nodeId": "ml-guide#overfitting",
      "docId": "ml-guide",
      "score": 0.25,
      "context": "## Overfitting\nWhen a model...",
      "graph": {
        "hop": 1,
        "edgeType": "PARENT_OF",
        "edgeWeight": null
      }
    }
  ],
  "metadata": {
    "resultsCount": 3,
    "seedCount": 2,
    "graphCount": 1,
    "timestamp": "2024-11-29T08:00:00.000Z"
  }
}
```

### Understanding the Response

- **`sources`**: All retrieved nodes (seeds + graph)
- **`sources[].graph.hop`**: 
  - `0` or `null` = Seed node (from vector search)
  - `1` = 1 hop away via graph
  - `2` = 2 hops away
- **`sources[].graph.edgeType`**: How we reached this node
- **`sources[].graph.edgeWeight`**: Similarity score of the edge (if SAME_TOPIC)

---

## Use Cases & Examples

### Use Case 1: Multi-Document Knowledge Base

**Scenario:** Technical docs split across multiple files

**Problem:** Vector search only finds matches in one document

**Solution:**
```bash
curl -X POST http://localhost:3000/api/query/graph \
  -H "Content-Type: application/json" \
  -d '{
    "query": "JWT authentication",
    "k": 1,
    "graphConfig": {
      "maxHops": 2,
      "edgeTypes": ["SAME_TOPIC", "REFERS_TO"]
    }
  }'
```

**Result:**
- Seed: `security.md#jwt` (definition)
- +1 hop: `api-guide.md#authentication` (how to use)
- +1 hop: `examples.md#jwt-example` (code example)
- +2 hops: `troubleshooting.md#jwt-errors` (common issues)

### Use Case 2: Conceptual Exploration

**Scenario:** User learning a new topic

**Problem:** Needs multiple perspectives and context

**Solution:**
```json
{
  "query": "What is gradient descent?",
  "graphConfig": {
    "maxHops": 2,
    "edgeTypes": ["SAME_TOPIC", "PARENT_OF", "CHILD_OF"]
  }
}
```

**Result:**
- Seed: Definition of gradient descent
- PARENT_OF: Optimization algorithms (broader context)
- SAME_TOPIC: Stochastic gradient descent (variant)
- CHILD_OF: Learning rate (specific parameter)
- SAME_TOPIC: Backpropagation (related concept)

### Use Case 3: Historical Context

**Scenario:** Understanding evolution of a technology

**Solution:**
```json
{
  "query": "neural networks",
  "graphConfig": {
    "maxHops": 1,
    "edgeTypes": ["SAME_TOPIC"],
    "minEdgeWeight": 0.8
  }
}
```

**Result:**
- `ml-guide.md#neural-networks` (current definition)
- `ai-history.md#perceptron` (historical origin)
- `ai-history.md#deep-learning` (modern development)

---

## Performance Considerations

### Time Complexity

- **Vector search:** O(n × d) where n = docs, d = dimensions
- **Graph expansion:** O(k × e) where k = nodes, e = avg edges per node
- **Total:** O(n × d + k × e)

With good indexing and limits, this is very fast:
- Vector search: ~10-50ms
- Graph expansion (1 hop): ~5-20ms
- **Total: ~15-70ms**

### Memory Usage

- Each edge: ~100 bytes
- 1000 nodes, 5 edges each: ~500 KB
- Negligible compared to embeddings

### Optimization Tips

1. **Limit hops:** Use 1-2 hops max
   ```json
   { "maxHops": 1 }  // Fast
   { "maxHops": 3 }  // Slow
   ```

2. **Restrict edge types:** Only use relevant edges
   ```json
   { "edgeTypes": ["SAME_TOPIC"] }  // Focused
   { "edgeTypes": ["SAME_TOPIC", "PARENT_OF", "CHILD_OF", "REFERS_TO"] }  // Exploratory
   ```

3. **Set minEdgeWeight:** Filter weak connections
   ```json
   { "minEdgeWeight": 0.85 }  // High quality only
   ```

4. **Limit maxGraphNodes:** Cap total expansion
   ```json
   { "maxGraphNodes": 5 }   // Conservative
   { "maxGraphNodes": 20 }  // Comprehensive
   ```

---

## Comparison: Traditional vs Graph-Aware RAG

### Traditional RAG

```bash
POST /api/query
{ "query": "regularization", "k": 3 }
```

**Returns:**
1. ml-guide.md#regularization (0.95)
2. ml-guide.md#l2-regularization (0.82)
3. ml-guide.md#dropout (0.76)

**Context:** 3 sections, all from same document, all lexically similar

### Graph-Aware RAG

```bash
POST /api/query/graph
{ "query": "regularization", "k": 3, "graphConfig": { "maxHops": 1 } }
```

**Returns:**
1. ml-guide.md#regularization (0.95) [seed]
2. deep-learning.md#regularization (0.88) [SAME_TOPIC]
3. ml-guide.md#overfitting (0.30) [PARENT_OF - context]
4. examples.md#dropout-example (0.45) [REFERS_TO]
5. ml-guide.md#l2-regularization (0.82) [seed]

**Context:** 5 sections, cross-document, multiple perspectives (definition + context + examples + related concepts)

**Winner:** Graph-Aware RAG (more comprehensive)

---

## Building Your Graph

Before using graph-aware RAG, you need to build the graph:

### Step 1: Index Documents
```bash
npx tsx src/cli/indexFile.ts --dir ./docs
```

### Step 2: Build SAME_TOPIC Edges
```bash
# CLI
npx tsx src/cli/buildGraph.ts same-topic --min-similarity 0.80

# Or via API
curl -X POST http://localhost:3000/api/graph/build/same-topic \
  -H "Content-Type: application/json" \
  -d '{"minSimilarity": 0.80, "maxConnections": 5}'
```

### Step 3: Verify Graph
```bash
npx tsx src/cli/buildGraph.ts stats
```

### Step 4: Query with Graph
```bash
curl -X POST http://localhost:3000/api/query/graph \
  -H "Content-Type: application/json" \
  -d '{"query": "your question", "graphConfig": {"useGraph": true}}'
```

---

## Troubleshooting

### No graph expansion happening

**Symptom:** `graphCount: 0` in response

**Causes:**
1. Graph not built: Run `buildGraph.ts same-topic`
2. minEdgeWeight too high: Lower to 0.6-0.7
3. No SAME_TOPIC edges: Check `graph/stats`

**Fix:**
```bash
# Check graph
curl http://localhost:3000/api/graph/stats

# Rebuild with lower threshold
npx tsx src/cli/buildGraph.ts same-topic --min-similarity 0.70
```

### Too many irrelevant results

**Symptom:** Low-quality nodes in results

**Causes:**
1. maxHops too high
2. minEdgeWeight too low
3. Too many edgeTypes

**Fix:**
```json
{
  "maxHops": 1,           // Reduce from 2-3
  "minEdgeWeight": 0.85,  // Increase from 0.6-0.7
  "edgeTypes": ["SAME_TOPIC"]  // Remove PARENT_OF, etc.
}
```

### Slow queries

**Symptom:** >200ms response time

**Causes:**
1. maxGraphNodes too high
2. maxHops too high
3. Many documents

**Fix:**
```json
{
  "maxGraphNodes": 5,  // Reduce from 20
  "maxHops": 1,        // Reduce from 2-3
  "edgeTypes": ["SAME_TOPIC"]  // Limit types
}
```

---

## Best Practices

### 1. Start Conservative

Begin with minimal graph expansion:
```json
{
  "useGraph": true,
  "maxHops": 1,
  "maxGraphNodes": 5,
  "edgeTypes": ["SAME_TOPIC"],
  "minEdgeWeight": 0.80
}
```

Then expand as needed.

### 2. Monitor Graph Quality

Regularly check graph statistics:
```bash
curl http://localhost:3000/api/graph/stats
```

Ideal stats:
- Average degree: 3-7 connections/node
- Edge quality: >80% with weight >0.75

### 3. Rebuild Graph After Major Updates

When adding many new documents:
```bash
# Clear old SAME_TOPIC edges (manual: delete from edges where type='SAME_TOPIC')
# Rebuild
npx tsx src/cli/buildGraph.ts same-topic
```

### 4. Use Different Configs for Different Queries

**Factual queries:** Conservative config
```json
{ "maxHops": 1, "edgeTypes": ["SAME_TOPIC"], "minEdgeWeight": 0.85 }
```

**Exploratory queries:** Comprehensive config
```json
{ "maxHops": 2, "edgeTypes": ["SAME_TOPIC", "PARENT_OF"], "minEdgeWeight": 0.70 }
```

---

## Future Enhancements

Planned for Phase 2.0+:
- [ ] Automatic REFERS_TO detection (markdown links)
- [ ] Query-time edge creation (dynamic graph)
- [ ] Personalized graph (user-specific edges)
- [ ] Temporal edges (time-based relationships)
- [ ] Weighted multi-hop (path scoring)
- [ ] Graph attention (learn edge importance)

---

## Conclusion

Graph-Aware RAG transforms hierarchical-rag from a simple vector search system into a **knowledge graph reasoning engine**. By combining vector similarity with graph traversal, it provides:

✅ **Richer context** from multiple documents  
✅ **Better coverage** of complex topics  
✅ **Cross-document reasoning** capabilities  
✅ **Flexible exploration** strategies

All while maintaining:

✅ **Simple stack** (SQLite + Node.js)  
✅ **Fast performance** (<100ms)  
✅ **Easy configuration**  
✅ **Backward compatibility**

Start with traditional queries, add graph expansion when you need it, and scale to a full knowledge graph over time.

---

**Document:** `docs/GRAPH_RAG.md`  
**Version:** 1.0  
**Date:** November 2024  
**Status:** Production Ready ✅

