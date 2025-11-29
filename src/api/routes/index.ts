import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { parseMarkdownContent } from '../../markdownParser.js';
import { saveDocument, Document } from '../../db/jsonStore.js';
import { syncDocument } from '../../indexer.js';

export const indexRouter = Router();

// Schema for indexing markdown content
const IndexMarkdownSchema = z.object({
    docId: z.string().min(1, 'docId is required'),
    title: z.string().optional(),
    content: z.string().min(1, 'content is required'),
    version: z.number().int().positive().optional().default(1)
});

/**
 * POST /api/index
 * Index a markdown document
 * 
 * Body:
 * {
 *   "docId": "unique-doc-id",
 *   "title": "Optional Document Title",
 *   "content": "# Markdown content here...",
 *   "version": 1
 * }
 */
indexRouter.post('/', async (req: Request, res: Response) => {
    try {
        // Validate request body
        const validation = IndexMarkdownSchema.safeParse(req.body);
        
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation error',
                details: validation.error.errors
            });
        }
        
        const { docId, title, content, version } = validation.data;
        
        // Parse markdown content
        const root = parseMarkdownContent(content, docId);
        
        // Override title if provided
        if (title) {
            root.title = title;
        }
        
        // Build nodes map for efficient navigation
        const nodes: Document['nodes'] = {};
        
        function buildNodesMap(node: typeof root, parentId: string | null = null) {
            nodes[node.id] = {
                id: node.id,
                parentId,
                childrenIds: node.children.map(c => c.id),
                level: node.level
            };
            
            node.children.forEach(child => buildNodesMap(child, node.id));
        }
        
        buildNodesMap(root);
        
        // Create document object
        const doc: Document = {
            docId,
            title: root.title,
            version,
            root,
            nodes
        };
        
        // Save to JSON store
        await saveDocument(doc);
        
        // Sync to vector store (generate embeddings)
        await syncDocument(doc);
        
        // Count sections
        const sectionCount = Object.keys(nodes).length;
        
        res.json({
            success: true,
            docId,
            title: doc.title,
            version,
            sectionsIndexed: sectionCount,
            message: 'Document indexed successfully'
        });
        
    } catch (error) {
        console.error('Error indexing document:', error);
        res.status(500).json({
            error: 'Failed to index document',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/index/status
 * Get indexing statistics
 */
indexRouter.get('/status', async (req: Request, res: Response) => {
    try {
        // This would require additional functionality to track stats
        // For now, return basic info
        res.json({
            status: 'operational',
            message: 'Indexing service is ready'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

