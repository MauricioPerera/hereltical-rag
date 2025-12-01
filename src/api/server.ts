import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from '../config.js';
import { indexRouter } from './routes/index.js';
import { queryRouter } from './routes/query.js';
import { docsRouter } from './routes/docs.js';
import { healthRouter } from './routes/health.js';
import graphRouter from './routes/graph.js';
import monitoringRouter, { recordRequest } from './routes/monitoring.js';
import skillbankRouter from './routes/skillbank.js';
import analyticsRouter from './routes/analytics.js';
import { rateLimitPresets, initAuth, authenticate, getAuthStatus, getRateLimitStats } from '../middleware/index.js';
import { getAllCacheStats } from '../cache/queryCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
    const app = express();

    // Initialize authentication
    initAuth();

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting (relaxed for health checks)
    app.use(rateLimitPresets.relaxed());
    
    // Authentication (can be enabled via API_KEYS env var)
    app.use(authenticate);
    
    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, '../../public')));

    // Request logging with metrics
    app.use((req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            
            // Record metrics
            recordRequest(req.path, res.statusCode, duration);
        });
        next();
    });

    // Routes
    app.use('/health', healthRouter);
    app.use('/api/index', indexRouter);
    app.use('/api/query', queryRouter);
    app.use('/api/docs', docsRouter);
    app.use('/api/graph', graphRouter);
    app.use('/api/monitoring', monitoringRouter);
    app.use('/api/skillbank', skillbankRouter);
    app.use('/api/skillbank/analytics', analyticsRouter);
    
    // Status endpoint (quick overview)
    app.get('/api/status', (req: Request, res: Response) => {
        res.json({
            status: 'ok',
            auth: getAuthStatus(),
            rateLimit: getRateLimitStats(),
            cache: getAllCacheStats(),
            uptime: Math.floor(process.uptime()),
            memory: {
                heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        });
    });

    // Root endpoint - serve UI or API info
    app.get('/', (req: Request, res: Response) => {
        // Check if request accepts HTML (browser)
        if (req.accepts('html')) {
            res.sendFile(path.join(__dirname, '../../public/index.html'));
        } else {
            res.json({
                name: 'Hierarchical RAG API',
                version: '2.0.0',
                ui: '/',
                endpoints: {
                    health: '/health',
                    index: '/api/index',
                    query: '/api/query',
                    querySmartGraph: '/api/query/smart',
                    docs: '/api/docs',
                    graph: '/api/graph',
                    skillbank: '/api/skillbank'
                }
            });
        }
    });

    // Error handling
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('Error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    });

    // 404 handler
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            error: 'Not found',
            path: req.path
        });
    });

    return app;
}

export async function startServer(): Promise<void> {
    // Validate configuration
    const validation = validateConfig();
    if (!validation.valid) {
        console.error('❌ Configuration errors:');
        validation.errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
    }

    const app = createApp();
    const { port, host } = config.api;

    app.listen(port, host, () => {
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║          Hierarchical RAG API Server Started                  ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');
        console.log(`🚀 Server running at http://${host}:${port}`);
        console.log(`🌐 Web UI: http://${host}:${port}/`);
        console.log(`📊 Embedding service: ${config.embeddingService}`);
        console.log(`💾 Vector DB: ${config.db.vectorPath}`);
        console.log(`📄 JSON Store: ${config.db.jsonPath}`);
        console.log('\n📚 API Endpoints:');
        console.log(`   - GET  /health`);
        console.log(`   - POST /api/query/smart ⭐ (graph-aware RAG)`);
        console.log(`   - POST /api/query/classic (baseline)`);
        console.log(`   - POST /api/graph/extract-entities (NER)`);
        console.log(`   - GET  /api/graph/stats`);
        console.log(`   - GET  /api/docs`);
        console.log(`   - POST /api/skillbank/discover ⭐ (skill discovery)`);
        console.log(`   - POST /api/skillbank/execute (run tool/skill)`);
        console.log('\n Press Ctrl+C to stop\n');
    });
}

