# Quick Ollama Setup Example

This example shows how to set up and use Ollama embeddings in 5 minutes.

## Prerequisites

- Node.js 20+
- Hierarchical RAG project cloned

## Step-by-Step Setup

### 1. Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download and install from [https://ollama.ai/download](https://ollama.ai/download)

### 2. Start Ollama Server

```bash
ollama serve
```

Keep this terminal open. You should see:
```
Ollama is running
```

### 3. Pull an Embedding Model

Open a new terminal:

```bash
# Recommended: Good balance of quality and speed
ollama pull nomic-embed-text

# Alternative: Higher quality, slower
ollama pull mxbai-embed-large

# Alternative: Faster, smaller
ollama pull all-minilm
```

### 4. Verify Installation

```bash
ollama list
```

You should see your model listed:
```
NAME                    ID              SIZE      MODIFIED
nomic-embed-text:latest abcd1234        274 MB    2 minutes ago
```

### 5. Configure Your Project

In your Hierarchical RAG project directory:

```bash
cat > .env << 'EOF'
# Ollama Embeddings
EMBEDDING_SERVICE=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# API Settings
API_PORT=3000
API_HOST=localhost
EOF
```

### 6. Test the Setup

```bash
# Create a test document
cat > test-doc.md << 'EOF'
# Test Document

## Introduction
This is a test document for Ollama embeddings.

## Features
Ollama provides local, privacy-preserving embeddings.

## Conclusion
It's fast and free!
EOF

# Index the document
npx tsx src/cli/indexFile.ts test-doc.md test-ollama

# Start the server
npm run server
```

### 7. Query Your Document

In another terminal:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the features?",
    "k": 3
  }' | jq .
```

You should get a response with the relevant section about features!

## Verification

### Check Ollama is Working

```bash
# Test Ollama directly
curl http://localhost:11434/api/embeddings \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "test"
  }' | jq '.embedding | length'
```

You should see `768` (the dimension of nomic-embed-text embeddings).

### Check API Health

```bash
curl http://localhost:3000/health | jq .
```

You should see:
```json
{
  "status": "healthy",
  "embedding": {
    "service": "ollama",
    "model": "nomic-embed-text",
    "dimensions": 768,
    "url": "http://localhost:11434"
  }
}
```

## Common Issues

### "Cannot connect to Ollama"

**Problem:** Ollama server is not running

**Solution:**
```bash
ollama serve
```

### "Model not found"

**Problem:** Model not pulled

**Solution:**
```bash
ollama pull nomic-embed-text
ollama list  # Verify it's there
```

### "Slow embeddings"

**Problem:** CPU is busy or model is large

**Solutions:**
1. Use a smaller model:
   ```bash
   ollama pull all-minilm
   ```

2. Check system resources:
   ```bash
   top
   ```

3. Close other applications

## Next Steps

1. **Index your documentation:**
   ```bash
   npx tsx src/cli/indexFile.ts --dir ./docs
   ```

2. **Try different models:**
   ```bash
   # Pull another model
   ollama pull mxbai-embed-large
   
   # Update .env
   OLLAMA_EMBEDDING_MODEL=mxbai-embed-large
   
   # Re-index (different dimensions!)
   rm rag.db
   npx tsx src/cli/indexFile.ts --dir ./docs
   ```

3. **Integrate with your app:**
   ```typescript
   import { embed } from './src/embeddings/index.js';
   
   const embedding = await embed('Your text here');
   console.log('Embedding dimensions:', embedding.length);
   ```

## Performance Tips

1. **Keep Ollama running:** Add to system startup
2. **Use appropriate model:** 
   - Fast: all-minilm
   - Balanced: nomic-embed-text
   - Quality: mxbai-embed-large
3. **Monitor resources:** Ollama uses CPU/RAM
4. **Batch when possible:** Use `embedBatch()` for multiple texts

## Comparison

| Aspect | Mock | Ollama | OpenAI |
|--------|------|--------|--------|
| Setup | None | Medium | Easy |
| Speed | Instant | Fast | Variable |
| Quality | Low | Good | Excellent |
| Privacy | ✅ | ✅ | ❌ |
| Cost | Free | Free | Paid |
| Offline | ✅ | ✅ | ❌ |

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Full Ollama Guide](../docs/OLLAMA.md)
- [Available Models](https://ollama.ai/library)

---

**Time to complete:** ~5 minutes  
**Difficulty:** Easy  
**Result:** Local, privacy-preserving embeddings! 🎉

