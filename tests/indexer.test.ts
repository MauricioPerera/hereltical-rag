import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncDocument } from '../src/indexer';
import { getSectionMeta, getDocNodeIds, setDbPath, closeDb } from '../src/db/vectorStore';
import { saveDocument, Document, setJsonPath, resetDb } from '../src/db/jsonStore';
import fs from 'node:fs';

const TEST_DB_PATH = 'test-rag.db';
const TEST_JSON_PATH = 'test-documents.json';

describe('indexer', () => {
    beforeEach(() => {
        // Close and configure vector store
        closeDb();
        setDbPath(TEST_DB_PATH);

        // Configure JSON store
        resetDb();
        setJsonPath(TEST_JSON_PATH);

        // Clean up any existing test files
        try {
            if (fs.existsSync(TEST_DB_PATH)) {
                fs.unlinkSync(TEST_DB_PATH);
            }
        } catch (error) {
            // Ignore if file is locked (Windows issue)
        }
        
        try {
            if (fs.existsSync(TEST_JSON_PATH)) {
                fs.unlinkSync(TEST_JSON_PATH);
            }
        } catch (error) {
            // Ignore if file is locked
        }
    });

    afterEach(() => {
        // Close vector store connection
        closeDb();

        // Reset JSON store
        resetDb();

        // Clean up test files with retry for Windows
        try {
            if (fs.existsSync(TEST_DB_PATH)) {
                fs.unlinkSync(TEST_DB_PATH);
            }
        } catch (error) {
            // File might be locked, ignore for now
            // In real scenarios, you might want to retry
        }
        
        try {
            if (fs.existsSync(TEST_JSON_PATH)) {
                fs.unlinkSync(TEST_JSON_PATH);
            }
        } catch (error) {
            // Ignore if file is locked
        }

        // Reset to default paths
        setDbPath('rag.db');
        setJsonPath('documents.json');
    });

    describe('syncDocument', () => {
        it('should index a new document', async () => {
            const doc: Document = {
                docId: 'sync-test-1',
                title: 'Sync Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Sync Test',
                    content: [],
                    children: [
                        {
                            id: 'sec-1',
                            type: 'section',
                            level: 1,
                            title: 'Section 1',
                            content: ['Content 1'],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['sec-1'], level: 0 },
                    'sec-1': { id: 'sec-1', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            await syncDocument(doc);

            const nodeIds = getDocNodeIds('sync-test-1');
            expect(nodeIds.length).toBeGreaterThan(0);
            expect(nodeIds).toContain('sec-1');

            const meta = getSectionMeta('sec-1');
            expect(meta).toBeDefined();
            expect(meta?.title).toBe('Section 1');
            expect(meta?.hash).toBeDefined();
        });

        it('should skip unchanged nodes on re-sync', async () => {
            const doc: Document = {
                docId: 'sync-test-2',
                title: 'Unchanged Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Unchanged Test',
                    content: [],
                    children: [
                        {
                            id: 'unchanged',
                            type: 'section',
                            level: 1,
                            title: 'Unchanged Section',
                            content: ['Same content'],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['unchanged'], level: 0 },
                    unchanged: { id: 'unchanged', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            await syncDocument(doc);

            const firstMeta = getSectionMeta('unchanged');
            const firstHash = firstMeta?.hash;

            // Re-sync without changes
            await syncDocument(doc);

            const secondMeta = getSectionMeta('unchanged');
            expect(secondMeta?.hash).toBe(firstHash);
        });

        it('should update changed nodes', async () => {
            const doc: Document = {
                docId: 'sync-test-3',
                title: 'Change Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Change Test',
                    content: [],
                    children: [
                        {
                            id: 'changing',
                            type: 'section',
                            level: 1,
                            title: 'Original Title',
                            content: ['Original content'],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['changing'], level: 0 },
                    changing: { id: 'changing', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            await syncDocument(doc);

            const firstMeta = getSectionMeta('changing');
            const firstHash = firstMeta?.hash;

            // Modify content
            doc.root.children[0].content = ['Modified content'];
            await saveDocument(doc);
            await syncDocument(doc);

            const secondMeta = getSectionMeta('changing');
            expect(secondMeta?.hash).not.toBe(firstHash);
        });

        it('should delete removed nodes', async () => {
            const doc: Document = {
                docId: 'sync-test-4',
                title: 'Deletion Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Deletion Test',
                    content: [],
                    children: [
                        {
                            id: 'to-keep',
                            type: 'section',
                            level: 1,
                            title: 'Keep This',
                            content: ['Keep'],
                            children: []
                        },
                        {
                            id: 'to-delete',
                            type: 'section',
                            level: 1,
                            title: 'Delete This',
                            content: ['Delete'],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['to-keep', 'to-delete'], level: 0 },
                    'to-keep': { id: 'to-keep', parentId: 'root', childrenIds: [], level: 1 },
                    'to-delete': { id: 'to-delete', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            await syncDocument(doc);

            // Small delay to ensure DB is not locked
            await new Promise(resolve => setTimeout(resolve, 50));

            let meta = getSectionMeta('to-delete');
            expect(meta).toBeDefined();

            // Remove the second child
            doc.root.children = doc.root.children.filter(c => c.id !== 'to-delete');
            doc.nodes.root.childrenIds = ['to-keep'];
            delete doc.nodes['to-delete'];

            await saveDocument(doc);
            
            // Small delay before sync to prevent DB lock
            await new Promise(resolve => setTimeout(resolve, 50));
            
            await syncDocument(doc);

            meta = getSectionMeta('to-delete');
            expect(meta).toBeUndefined();

            const keepMeta = getSectionMeta('to-keep');
            expect(keepMeta).toBeDefined();
        });
    });
});
