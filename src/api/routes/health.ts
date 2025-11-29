import { Router, Request, Response } from 'express';
import { getEmbeddingServiceInfo } from '../../embeddings/index.js';
import { config } from '../../config.js';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
    const embeddingInfo = getEmbeddingServiceInfo();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'hierarchical-rag',
        version: '1.0.0',
        embedding: embeddingInfo,
        config: {
            vectorDb: config.db.vectorPath,
            jsonStore: config.db.jsonPath
        }
    });
});

