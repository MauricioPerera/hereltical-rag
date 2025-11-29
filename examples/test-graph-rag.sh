#!/bin/bash

# Test script for Graph-aware RAG
# Demonstrates the power of graph expansion in queries

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Graph-Aware RAG Demo                                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API endpoint
API="http://localhost:3000"

echo -e "${BLUE}Step 1: Build SAME_TOPIC graph${NC}"
echo "───────────────────────────────────────────────────────────────"
echo ""

curl -s -X POST "$API/api/graph/build/same-topic" \
  -H "Content-Type: application/json" \
  -d '{
    "minSimilarity": 0.75,
    "maxConnections": 5,
    "crossDocOnly": true
  }' | jq '.'

echo ""
echo ""

echo -e "${BLUE}Step 2: View graph statistics${NC}"
echo "───────────────────────────────────────────────────────────────"
echo ""

curl -s "$API/api/graph/stats" | jq '.'

echo ""
echo ""

echo -e "${BLUE}Step 3: Traditional query (NO graph)${NC}"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Query: 'neural networks and deep learning'"
echo ""

curl -s -X POST "$API/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "neural networks and deep learning",
    "k": 2
  }' | jq '{
    query: .query,
    answer: .answer,
    resultsCount: .metadata.resultsCount,
    sources: .sources | map({
      docId,
      nodeId,
      score
    })
  }'

echo ""
echo ""

echo -e "${BLUE}Step 4: Graph-aware query (WITH graph expansion)${NC}"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Query: 'neural networks and deep learning'"
echo "Config: 1 hop, SAME_TOPIC edges"
echo ""

curl -s -X POST "$API/api/query/graph" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "neural networks and deep learning",
    "k": 2,
    "graphConfig": {
      "useGraph": true,
      "maxHops": 1,
      "maxGraphNodes": 5,
      "edgeTypes": ["SAME_TOPIC"],
      "minEdgeWeight": 0.7
    }
  }' | jq '{
    query: .query,
    answer: .answer,
    metadata: {
      totalResults: .metadata.resultsCount,
      seedCount: .metadata.seedCount,
      graphCount: .metadata.graphCount
    },
    sources: .sources | map({
      docId,
      nodeId,
      score,
      graphHop: .graph.hop,
      edgeType: .graph.edgeType,
      edgeWeight: .graph.edgeWeight
    })
  }'

echo ""
echo ""

echo -e "${BLUE}Step 5: Multi-hop graph query${NC}"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Query: 'machine learning'"
echo "Config: 2 hops, SAME_TOPIC + PARENT_OF edges"
echo ""

curl -s -X POST "$API/api/query/graph" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "k": 1,
    "graphConfig": {
      "useGraph": true,
      "maxHops": 2,
      "maxGraphNodes": 8,
      "edgeTypes": ["SAME_TOPIC", "PARENT_OF", "CHILD_OF"],
      "minEdgeWeight": 0.6
    }
  }' | jq '{
    query: .query,
    answer: .answer,
    metadata: {
      totalResults: .metadata.resultsCount,
      seedCount: .metadata.seedCount,
      graphCount: .metadata.graphCount
    },
    sources: .sources | map({
      docId,
      nodeId: (.nodeId | split("#")[1] // .nodeId),
      score: (.score | tonumber | . * 100 | round / 100),
      hop: .graph.hop,
      via: .graph.edgeType
    })
  }'

echo ""
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Graph-Aware RAG Demo Complete!                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "📊 Key Observations:"
echo "  • Traditional query: Limited to top K vector matches"
echo "  • Graph-aware query: Finds related content across documents"
echo "  • Multi-hop: Discovers connections 2+ steps away"
echo ""

echo "💡 Benefits:"
echo "  ✓ Cross-document reasoning"
echo "  ✓ Richer context from related sections"
echo "  ✓ Discovery of non-obvious connections"
echo "  ✓ Better coverage of topic"
echo ""

echo "🔗 Next steps:"
echo "  • Try different edge types"
echo "  • Adjust similarity thresholds"
echo "  • Experiment with hop counts"
echo "  • Build custom graphs for your domain"
echo ""

