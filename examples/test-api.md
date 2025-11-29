# Testing the RAG API

This document explains how to test the Hierarchical RAG API.

## Setup

Start the server:

```bash
npm run server
```

The API will be available at `http://localhost:3000`.

## Example Requests

### 1. Index a Document

```bash
curl -X POST http://localhost:3000/api/index \
  -H "Content-Type: application/json" \
  -d '{
    "docId": "ml-guide",
    "title": "Machine Learning Guide",
    "content": "# ML Guide\n\n## Introduction\n\nMachine learning is...",
    "version": 1
  }'
```

### 2. Query the System

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is supervised learning?",
    "k": 3
  }'
```

### 3. List All Documents

```bash
curl http://localhost:3000/api/docs
```

### 4. Get Document Structure

```bash
curl http://localhost:3000/api/docs/ml-guide/structure
```

## Testing with the Example Document

1. Index the example document:

```bash
tsx src/cli/indexFile.ts docs/example.md ml-guide
```

2. Start the server:

```bash
npm run server
```

3. Query for information:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main types of machine learning?",
    "k": 5
  }'
```

## Response Format

### Query Response

```json
{
  "query": "What is supervised learning?",
  "answer": "Context retrieved successfully. See sources.",
  "sources": [
    {
      "nodeId": "supervised-learning-abc123",
      "docId": "ml-guide",
      "score": 0.0,
      "context": "[Context: Machine Learning Guide]\n## Supervised Learning\n..."
    }
  ],
  "metadata": {
    "resultsCount": 3,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Using OpenAI Embeddings

To use real OpenAI embeddings instead of mock embeddings:

1. Create a `.env` file:

```env
OPENAI_API_KEY=sk-your-key-here
EMBEDDING_SERVICE=openai
```

2. Restart the server

The system will now use OpenAI's `text-embedding-3-small` model for generating embeddings.

