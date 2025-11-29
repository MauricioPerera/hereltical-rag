import { Router, Request, Response } from 'express';
import { loadDocument, getDb } from '../../db/jsonStore.js';
import { getDocNodeIds, getSectionMeta } from '../../db/vectorStore.js';

export const docsRouter = Router();

/**
 * GET /api/docs
 * List all indexed documents
 */
docsRouter.get('/', async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const documents = db.data.documents.map(doc => ({
            docId: doc.docId,
            title: doc.title,
            version: doc.version,
            sectionsCount: Object.keys(doc.nodes).length
        }));
        
        res.json({
            documents,
            count: documents.length
        });
        
    } catch (error) {
        console.error('Error listing documents:', error);
        res.status(500).json({
            error: 'Failed to list documents',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/docs/:docId
 * Get a specific document by ID
 */
docsRouter.get('/:docId', async (req: Request, res: Response) => {
    try {
        const { docId } = req.params;
        const doc = await loadDocument(docId);
        
        if (!doc) {
            return res.status(404).json({
                error: 'Document not found',
                docId
            });
        }
        
        res.json({
            docId: doc.docId,
            title: doc.title,
            version: doc.version,
            root: doc.root,
            nodes: doc.nodes,
            sectionsCount: Object.keys(doc.nodes).length
        });
        
    } catch (error) {
        console.error('Error loading document:', error);
        res.status(500).json({
            error: 'Failed to load document',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/docs/:docId/structure
 * Get only the structure (without full content) of a document
 */
docsRouter.get('/:docId/structure', async (req: Request, res: Response) => {
    try {
        const { docId } = req.params;
        const doc = await loadDocument(docId);
        
        if (!doc) {
            return res.status(404).json({
                error: 'Document not found',
                docId
            });
        }
        
        // Simplified structure without content
        type SectionNodeType = typeof doc.root;
        
        function simplifyNode(node: SectionNodeType): any {
            return {
                id: node.id,
                type: node.type,
                level: node.level,
                title: node.title,
                hasContent: node.content.length > 0,
                children: node.children.map(simplifyNode)
            };
        }
        
        res.json({
            docId: doc.docId,
            title: doc.title,
            version: doc.version,
            structure: simplifyNode(doc.root)
        });
        
    } catch (error) {
        console.error('Error loading document structure:', error);
        res.status(500).json({
            error: 'Failed to load document structure',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/docs/:docId/sections
 * Get all sections with their metadata for a document
 */
docsRouter.get('/:docId/sections', async (req: Request, res: Response) => {
    try {
        const { docId } = req.params;
        const nodeIds = getDocNodeIds(docId);
        
        if (nodeIds.length === 0) {
            return res.status(404).json({
                error: 'Document not found or has no indexed sections',
                docId
            });
        }
        
        const sections = nodeIds.map(nodeId => {
            const meta = getSectionMeta(nodeId);
            return {
                nodeId,
                ...meta
            };
        });
        
        res.json({
            docId,
            sections,
            count: sections.length
        });
        
    } catch (error) {
        console.error('Error loading document sections:', error);
        res.status(500).json({
            error: 'Failed to load document sections',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * DELETE /api/docs/:docId
 * Delete a document (placeholder - to be implemented)
 */
docsRouter.delete('/:docId', async (req: Request, res: Response) => {
    // TODO: Implement document deletion
    res.status(501).json({
        error: 'Not implemented',
        message: 'Document deletion is not yet implemented'
    });
});

