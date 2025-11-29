#!/bin/bash

# Quick Start Script for Hierarchical RAG API
echo "🚀 Hierarchical RAG - Quick Start"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000"

echo -e "${BLUE}Step 1: Health Check${NC}"
curl -s $BASE_URL/health | jq '.'
echo ""
echo ""

echo -e "${BLUE}Step 2: Index the Example Document${NC}"
curl -s -X POST $BASE_URL/api/index \
  -H "Content-Type: application/json" \
  -d @- << 'EOF' | jq '.'
{
  "docId": "quick-start-doc",
  "title": "Quick Start Guide",
  "content": "# Quick Start\n\n## Introduction\n\nThis is a quick start guide for the Hierarchical RAG system.\n\n### Features\n\nThe system provides semantic search with hierarchical context.\n\n### Installation\n\nRun npm install to get started.\n\n## Usage\n\n### Indexing\n\nIndex documents using the API or CLI.\n\n### Querying\n\nPerform semantic searches with filters.",
  "version": 1
}
EOF
echo ""
echo ""

echo -e "${BLUE}Step 3: List All Documents${NC}"
curl -s $BASE_URL/api/docs | jq '.'
echo ""
echo ""

echo -e "${BLUE}Step 4: Query the System${NC}"
curl -s -X POST $BASE_URL/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I index documents?",
    "k": 2
  }' | jq '.'
echo ""
echo ""

echo -e "${BLUE}Step 5: Get Document Structure${NC}"
curl -s $BASE_URL/api/docs/quick-start-doc/structure | jq '.'
echo ""
echo ""

echo -e "${GREEN}✅ Quick start complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Try indexing a markdown file: tsx src/cli/indexFile.ts docs/example.md"
echo "  2. Query with different parameters"
echo "  3. Explore other API endpoints"
echo ""

