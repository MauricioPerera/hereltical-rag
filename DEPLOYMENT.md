# Deployment Guide

## Prerequisites

- Node.js 18+ (tested with Node.js 20)
- npm or yarn
- (Optional) OpenAI API key for production embeddings

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# Use mock embeddings (no API key needed)
EMBEDDING_SERVICE=mock

# API Configuration
API_PORT=3000
API_HOST=localhost

# Database paths (relative to project root)
DB_PATH=rag.db
JSON_PATH=documents.json
```

### 3. Run Tests

```bash
npm test
```

### 4. Index Sample Documents

```bash
# Index a single file
tsx src/cli/indexFile.ts docs/example.md

# Index all files in a directory
tsx src/cli/indexFile.ts --dir ./docs
```

### 5. Start the Server

```bash
npm run server
```

The API will be available at `http://localhost:3000`.

### 6. Test the API

```bash
# Health check
curl http://localhost:3000/health

# List documents
curl http://localhost:3000/api/docs

# Query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "k": 3}'
```

## Production Deployment

### Using OpenAI Embeddings

1. Get an OpenAI API key from https://platform.openai.com/api-keys

2. Update `.env`:

```env
OPENAI_API_KEY=sk-your-key-here
EMBEDDING_SERVICE=openai
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

3. The system will now use real OpenAI embeddings

### Performance Considerations

**Embedding Costs**:
- `text-embedding-3-small`: $0.020 / 1M tokens
- `text-embedding-3-large`: $0.130 / 1M tokens

**Recommendations**:
- Use mock embeddings for development/testing
- Use `text-embedding-3-small` for production (good quality, low cost)
- Implement caching for frequently queried documents

### Database Management

**SQLite Database** (`rag.db`):
- Stores vector embeddings and metadata
- Safe to delete to reset the index
- Backup regularly in production

**JSON Store** (`documents.json`):
- Stores document structure and content
- Human-readable format
- Can be version controlled for small datasets

### Scaling

**For larger datasets**:

1. **Batch Indexing**:
```bash
# Index multiple files
tsx src/cli/indexFile.ts --dir ./large-docs
```

2. **Database Optimization**:
   - SQLite works well up to 100GB+
   - Consider increasing `PRAGMA cache_size`
   - Use WAL mode for better concurrency

3. **API Performance**:
   - Add caching layer (Redis)
   - Implement rate limiting
   - Use PM2 or similar for process management

## Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose API port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV DB_PATH=/app/data/rag.db
ENV JSON_PATH=/app/data/documents.json

# Start server
CMD ["npm", "run", "server"]
```

Build and run:

```bash
# Build
docker build -t hierarchical-rag .

# Run with environment file
docker run -d \
  --name rag-api \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  hierarchical-rag
```

## Cloud Deployment

### Railway / Render / Fly.io

1. Create a new service
2. Connect your GitHub repository
3. Set environment variables:
   - `OPENAI_API_KEY`
   - `EMBEDDING_SERVICE=openai`
4. Deploy!

These platforms auto-detect Node.js and run `npm run server`.

### AWS / GCP / Azure

1. **Compute**: EC2 / Compute Engine / VM
2. **Storage**: EBS volume for databases
3. **Secrets**: Use secrets manager for API keys

Example systemd service (`/etc/systemd/system/rag-api.service`):

```ini
[Unit]
Description=Hierarchical RAG API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/hierarchical-rag
ExecStart=/usr/bin/npm run server
Restart=always
Environment="NODE_ENV=production"
EnvironmentFile=/opt/hierarchical-rag/.env

[Install]
WantedBy=multi-user.target
```

## Monitoring

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Monitor with uptime check service (e.g., UptimeRobot)
```

### Logging

The server logs to stdout. Use a log aggregation service:

```bash
# PM2
pm2 start src/server.ts --name rag-api --interpreter tsx

# View logs
pm2 logs rag-api

# Docker logs
docker logs -f rag-api
```

### Metrics

Consider adding:
- Request count and latency
- Embedding API usage
- Database size and query performance
- Error rates

## Security

### API Security

1. **Add Authentication**:
```typescript
// src/api/middleware/auth.ts
export function requireApiKey(req, res, next) {
  const apiKey = req.header('X-API-Key');
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

2. **Rate Limiting**:
```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

3. **CORS Configuration**:
```typescript
// Only allow specific origins
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

### Secrets Management

Never commit `.env` to git:

```bash
# .gitignore
.env
*.db
documents.json
```

Use environment variables in production:

```bash
# Set in hosting platform
export OPENAI_API_KEY=sk-...
export API_KEY=your-secret-api-key
```

## Backup & Recovery

### Automated Backups

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"

mkdir -p "$BACKUP_DIR"

# Backup databases
cp rag.db "$BACKUP_DIR/"
cp documents.json "$BACKUP_DIR/"

# Upload to S3 (optional)
aws s3 sync "$BACKUP_DIR" s3://your-bucket/backups/$DATE/

echo "Backup completed: $BACKUP_DIR"
```

Schedule with cron:
```cron
0 2 * * * /path/to/backup.sh
```

### Recovery

```bash
# Stop server
pm2 stop rag-api

# Restore from backup
cp backups/20240115_020000/rag.db .
cp backups/20240115_020000/documents.json .

# Restart server
pm2 restart rag-api
```

## Troubleshooting

### Common Issues

**1. "OPENAI_API_KEY is required"**
- Set `EMBEDDING_SERVICE=mock` for development
- Or provide a valid OpenAI API key

**2. "EBUSY: resource busy or locked"**
- SQLite database is locked (Windows issue)
- Close all connections before deleting
- Wait a few seconds and retry

**3. "Module not found"**
- Run `npm install`
- Check that you're using Node.js 18+

**4. Port already in use**
- Change `API_PORT` in `.env`
- Or kill the process using the port

### Debug Mode

Enable verbose logging:

```env
NODE_ENV=development
DEBUG=*
```

## Support

- **Issues**: https://github.com/your-repo/issues
- **Documentation**: See README.md
- **Examples**: See `examples/` directory

