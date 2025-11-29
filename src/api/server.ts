import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config, validateConfig } from '../config.js';
import { indexRouter } from './routes/index.js';
import { queryRouter } from './routes/query.js';
import { docsRouter } from './routes/docs.js';
import { healthRouter } from './routes/health.js';
import graphRouter from './routes/graph.js';

export function createApp(): Express {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
        });
        next();
    });

    // Routes
    app.use('/health', healthRouter);
    app.use('/api/index', indexRouter);
    app.use('/api/query', queryRouter);
    app.use('/api/docs', docsRouter);
    app.use('/api/graph', graphRouter);

    // Root endpoint
    app.get('/', (req: Request, res: Response) => {
        res.json({
            name: 'Hierarchical RAG API',
            version: '1.0.0',
            endpoints: {
                health: '/health',
                index: '/api/index',
                query: '/api/query',
                docs: '/api/docs',
                graph: '/api/graph'
            }
        });
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
        console.log(`📊 Embedding service: ${config.embeddingService}`);
        console.log(`💾 Vector DB: ${config.db.vectorPath}`);
        console.log(`📄 JSON Store: ${config.db.jsonPath}`);
        console.log('\n📚 Available endpoints:');
        console.log(`   - GET  http://${host}:${port}/health`);
        console.log(`   - POST http://${host}:${port}/api/index`);
        console.log(`   - POST http://${host}:${port}/api/query`);
        console.log(`   - GET  http://${host}:${port}/api/docs/:docId`);
        console.log(`   - GET  http://${host}:${port}/api/graph/stats`);
        console.log(`   - POST http://${host}:${port}/api/graph/build/same-topic`);
        console.log('\n Press Ctrl+C to stop\n');
    });
}

