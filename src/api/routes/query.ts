import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { answer } from '../../ragEngine.js';
import { searchKnn, SearchFilters } from '../../db/vectorStore.js';
import { embed } from '../../embeddings.js';

export const queryRouter = Router();

// Schema for query requests
const QuerySchema = z.object({
    query: z.string().min(1, 'query is required'),
    k: z.number().int().positive().optional().default(3),
    filters: z.object({
        doc_id: z.string().optional(),
        level: z.number().int().min(0).max(3).optional(),
        is_leaf: z.number().int().min(0).max(1).optional()
    }).optional()
});

/**
 * POST /api/query
 * Perform semantic search with hierarchical context
 * 
 * Body:
 * {
 *   "query": "What is regularization?",
 *   "k": 3,
 *   "filters": {
 *     "doc_id": "optional-doc-id",
 *     "level": 2,
 *     "is_leaf": 1
 *   }
 * }
 */
queryRouter.post('/', async (req: Request, res: Response) => {
    try {
        // Validate request body
        const validation = QuerySchema.safeParse(req.body);
        
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation error',
                details: validation.error.errors
            });
        }
        
        const { query, k, filters } = validation.data;
        
        // Use RAG engine to get answer with context
        const result = await answer(query);
        
        res.json({
            query,
            answer: result.answer,
            sources: result.sources.map(source => ({
                nodeId: source.nodeId,
                docId: source.docId,
                score: source.score,
                context: source.context
            })),
            metadata: {
                resultsCount: result.sources.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).json({
            error: 'Failed to process query',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/query/search
 * Perform raw vector search without context enrichment
 * 
 * Body:
 * {
 *   "query": "search text",
 *   "k": 5,
 *   "filters": { ... }
 * }
 */
queryRouter.post('/search', async (req: Request, res: Response) => {
    try {
        const validation = QuerySchema.safeParse(req.body);
        
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation error',
                details: validation.error.errors
            });
        }
        
        const { query, k, filters } = validation.data;
        
        // Generate query embedding
        const queryEmbedding = await embed(query);
        
        // Perform KNN search
        const results = searchKnn(queryEmbedding, k, filters as SearchFilters || {});
        
        res.json({
            query,
            results: results.map(r => ({
                nodeId: r.node_id,
                docId: r.doc_id,
                distance: r.distance
            })),
            metadata: {
                resultsCount: results.length,
                k,
                filters: filters || {},
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error performing search:', error);
        res.status(500).json({
            error: 'Failed to perform search',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

