# Ollama Integration Guide

This guide explains how to use Ollama for local, privacy-preserving embeddings in the Hierarchical RAG system.

## What is Ollama?

[Ollama](https://ollama.ai) is a tool that allows you to run large language models locally on your machine. It provides:

- **Privacy**: All data stays on your machine
- **No costs**: No API fees
- **Offline**: Works without internet
- **Fast**: Local processing
- **Customizable**: Choice of models

## Installation

### 1. Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from [https://ollama.ai/download](https://ollama.ai/download)

**Verify installation:**
```bash
ollama --version
```

### 2. Start Ollama Server

```bash
ollama serve
```

The server will start on `http://localhost:11434` by default.

### 3. Pull an Embedding Model

**Recommended: nomic-embed-text**
```bash
ollama pull nomic-embed-text
```

**Other options:**
```bash
# Google's embeddinggemma (768 dims, excellent quality)
ollama pull embeddinggemma

# High quality, larger
ollama pull mxbai-embed-large

# Fast and lightweight
ollama pull all-minilm
```

### 4. Verify Model is Available

```bash
ollama list
```

You should see your embedding model listed.

## Configuration

### Environment Variables

Create or update your `.env` file:

```env
# Use Ollama for embeddings
EMBEDDING_SERVICE=ollama

# Ollama configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Optional: API configuration
API_PORT=3000
API_HOST=localhost
```

## Supported Models

### nomic-embed-text (Recommended)
- **Dimensions**: 768
- **Size**: ~274 MB
- **Best for**: General purpose, good balance of quality and speed
- **Context length**: 8192 tokens

```bash
ollama pull nomic-embed-text
```

### embeddinggemma
- **Dimensions**: 768
- **Size**: ~621 MB
- **Best for**: High quality embeddings, Google's matryoshka-trained model
- **Context length**: 2048 tokens
- **Special**: Trained with matryoshka representation learning (excellent for truncation)

```bash
ollama pull embeddinggemma
```

**Tested configuration with matryoshka:**
```env
EMBEDDING_SERVICE=ollama
OLLAMA_EMBEDDING_MODEL=embeddinggemma
MATRYOSHKA_ENABLED=true
MATRYOSHKA_DIMENSIONS=384  # 50% reduction, ~80% quality retention
```

**Performance results:**
- Search scores: 0.62-0.93 (excellent relevance)
- Speed: < 100ms per query
- Storage: 50% reduction with matryoshka
- Quality: ~80% retention at 384 dims

See `PRUEBAS_GEMMA.md` for detailed test results.

### mxbai-embed-large
- **Dimensions**: 1024
- **Size**: ~669 MB
- **Best for**: High quality embeddings
- **Context length**: 512 tokens

```bash
ollama pull mxbai-embed-large
```

### all-minilm
- **Dimensions**: 384
- **Size**: ~45 MB
- **Best for**: Fast processing, limited resources
- **Context length**: 256 tokens

```bash
ollama pull all-minilm
```

## Usage Examples

### Basic Usage

```bash
# 1. Start Ollama
ollama serve

# 2. Index documents
npm run server

# 3. Index a document
npx tsx src/cli/indexFile.ts docs/example.md
```

### Testing Ollama Connection

```typescript
import { checkOllamaAvailability, listOllamaModels } from './src/embeddings/ollamaEmbeddings.js';

// Check if Ollama is available
const available = await checkOllamaAvailability();
console.log('Ollama available:', available);

// List available models
if (available) {
  const models = await listOllamaModels();
  console.log('Available models:', models);
}
```

### Generate Embeddings

```typescript
import { embed } from './src/embeddings/index.js';

// Make sure EMBEDDING_SERVICE=ollama in .env
const embedding = await embed('This is a test document');
console.log('Embedding dimensions:', embedding.length);
```

## Performance Comparison

| Service | Speed | Quality | Cost | Privacy | Offline |
|---------|-------|---------|------|---------|---------|
| **Mock** | ⚡⚡⚡ Instant | ⭐ Low | ✅ Free | ✅ Yes | ✅ Yes |
| **Ollama** | ⚡⚡ Fast | ⭐⭐⭐ Good | ✅ Free | ✅ Yes | ✅ Yes |
| **OpenAI** | ⚡ Depends | ⭐⭐⭐⭐ Excellent | ❌ Paid | ❌ No | ❌ No |

### Benchmarks (Approximate)

**On M1 Mac with nomic-embed-text:**
- Single embedding: ~50-100ms
- Batch of 10: ~500-800ms
- Indexing 100 paragraphs: ~1-2 minutes

**On Intel i7 with nomic-embed-text:**
- Single embedding: ~100-200ms
- Batch of 10: ~1-1.5s
- Indexing 100 paragraphs: ~2-3 minutes

## Troubleshooting

### Ollama Server Not Running

**Error:** `Cannot connect to Ollama at http://localhost:11434`

**Solution:**
```bash
# Start Ollama server
ollama serve
```

### Model Not Found

**Error:** `Model 'nomic-embed-text' not found`

**Solution:**
```bash
# Pull the model
ollama pull nomic-embed-text

# Verify it's installed
ollama list
```

### Wrong Port

If Ollama is running on a different port:

```env
OLLAMA_URL=http://localhost:YOUR_PORT
```

### Connection Refused

1. Check if Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Restart Ollama:
   ```bash
   pkill ollama
   ollama serve
   ```

### Slow Performance

1. **Use a smaller model:**
   ```bash
   ollama pull all-minilm
   ```

2. **Check system resources:**
   - Ollama uses CPU/GPU
   - Close other heavy applications
   - Consider upgrading RAM

3. **Batch processing** (if supported):
   ```typescript
   import { embedBatch } from './src/embeddings/index.js';
   const embeddings = await embedBatch(['text1', 'text2', 'text3']);
   ```

## Advanced Configuration

### Custom Ollama URL

If running Ollama on a different machine:

```env
OLLAMA_URL=http://192.168.1.100:11434
```

### Using Different Models for Different Tasks

You can create multiple configurations and switch between them:

```bash
# For high quality
OLLAMA_EMBEDDING_MODEL=mxbai-embed-large

# For speed
OLLAMA_EMBEDDING_MODEL=all-minilm
```

### Docker Deployment

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    
  rag-api:
    build: .
    environment:
      - EMBEDDING_SERVICE=ollama
      - OLLAMA_URL=http://ollama:11434
      - OLLAMA_EMBEDDING_MODEL=nomic-embed-text
    depends_on:
      - ollama

volumes:
  ollama_data:
```

## Migration Guide

### From Mock to Ollama

1. **Install Ollama** (see above)

2. **Update `.env`:**
   ```env
   EMBEDDING_SERVICE=ollama
   OLLAMA_EMBEDDING_MODEL=nomic-embed-text
   ```

3. **Re-index documents:**
   ```bash
   # Delete old embeddings
   rm rag.db
   
   # Re-index with Ollama
   npx tsx src/cli/indexFile.ts --dir ./docs
   ```

### From OpenAI to Ollama

**Considerations:**
- Embedding dimensions may differ
- Quality may vary (OpenAI is generally higher quality)
- Need to re-index all documents

**Steps:**
1. Backup current database:
   ```bash
   cp rag.db rag.db.backup
   cp documents.json documents.json.backup
   ```

2. Update `.env`:
   ```env
   EMBEDDING_SERVICE=ollama
   ```

3. Re-index documents

## Best Practices

### 1. Choose the Right Model

- **General use**: `nomic-embed-text` (768 dims)
- **High quality**: `mxbai-embed-large` (1024 dims)
- **Fast/limited resources**: `all-minilm` (384 dims)

### 2. Keep Ollama Running

Add Ollama to system startup for convenience.

**macOS/Linux:**
```bash
# Add to ~/.bashrc or ~/.zshrc
ollama serve &
```

### 3. Monitor Resource Usage

```bash
# Check Ollama process
ps aux | grep ollama

# Monitor resource usage
top -p $(pgrep ollama)
```

### 4. Update Models Regularly

```bash
# Check for updates
ollama pull nomic-embed-text
```

## Comparison with Other Services

| Feature | Ollama | OpenAI | Mock |
|---------|--------|--------|------|
| **Setup** | Medium | Easy | None |
| **Cost** | Free | Pay-per-use | Free |
| **Quality** | Good | Excellent | Low |
| **Speed** | Fast (local) | Variable (network) | Instant |
| **Privacy** | ✅ Complete | ❌ Data sent to API | ✅ Complete |
| **Offline** | ✅ Yes | ❌ No | ✅ Yes |
| **Customization** | ✅ High | ⚠️ Limited | ❌ None |

## Resources

- **Ollama Website**: https://ollama.ai
- **Ollama GitHub**: https://github.com/ollama/ollama
- **Ollama Models**: https://ollama.ai/library
- **nomic-embed-text**: https://ollama.ai/library/nomic-embed-text
- **Community**: https://discord.gg/ollama

## Support

For issues specific to Ollama integration:

1. Check this guide first
2. Verify Ollama is running: `curl http://localhost:11434/api/tags`
3. Check Ollama logs: `ollama logs`
4. Open an issue on GitHub with:
   - Ollama version
   - Model being used
   - Error messages
   - Steps to reproduce

---

**Last Updated:** December 2024  
**Ollama Version Tested:** 0.1.x  
**Status:** ✅ Production Ready

