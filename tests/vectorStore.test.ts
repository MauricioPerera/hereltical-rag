import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { upsertSection, searchKnn, getSectionMeta, deleteSection, getDocNodeIds, SectionRow, setDbPath, closeDb } from '../src/db/vectorStore';
import { embed } from '../src/embeddings';
import fs from 'node:fs';

const TEST_DB_PATH = 'test-rag.db';

describe('vectorStore', () => {
    beforeEach(() => {
        // Close any existing connection and set test path
        closeDb();
        setDbPath(TEST_DB_PATH);

        // Clean up any existing test database
        try {
            if (fs.existsSync(TEST_DB_PATH)) {
                fs.unlinkSync(TEST_DB_PATH);
            }
        } catch (error) {
            // Ignore if file is locked (Windows issue)
        }
    });

    afterEach(() => {
        // Close connection before cleanup
        closeDb();

        // Clean up test database
        try {
            if (fs.existsSync(TEST_DB_PATH)) {
                fs.unlinkSync(TEST_DB_PATH);
            }
        } catch (error) {
            // Ignore if file is locked
        }

        // Reset to default path
        setDbPath('rag.db');
    });

    describe('upsertSection', () => {
        it('should insert a new section', async () => {
            const meta: SectionRow = {
                node_id: 'test-1',
                doc_id: 'doc-1',
                level: 1,
                title: 'Test Section',
                is_leaf: 1,
                path: JSON.stringify(['Doc', 'Test Section']),
                hash: 'test-hash-123'
            };

            const embedding = await embed('Test content');
            upsertSection(meta, embedding);

            const retrieved = getSectionMeta('test-1');
            expect(retrieved).toBeDefined();
            expect(retrieved?.node_id).toBe('test-1');
            expect(retrieved?.title).toBe('Test Section');
            expect(retrieved?.hash).toBe('test-hash-123');
        });

        it('should update an existing section', async () => {
            const meta: SectionRow = {
                node_id: 'test-2',
                doc_id: 'doc-1',
                level: 1,
                title: 'Original Title',
                is_leaf: 1,
                path: JSON.stringify(['Doc', 'Original']),
                hash: 'hash-1'
            };

            const embedding1 = await embed('Version 1');
            upsertSection(meta, embedding1);

            // Update
            const updatedMeta: SectionRow = {
                ...meta,
                title: 'Updated Title',
                hash: 'hash-2'
            };

            const embedding2 = await embed('Version 2');
            upsertSection(updatedMeta, embedding2);

            const retrieved = getSectionMeta('test-2');
            expect(retrieved?.title).toBe('Updated Title');
            expect(retrieved?.hash).toBe('hash-2');
        });
    });

    describe('searchKnn', () => {
        it('should find exact matches with distance 0', async () => {
            const text = 'Unique test content for exact match';
            const embedding = await embed(text);

            const meta: SectionRow = {
                node_id: 'exact-match',
                doc_id: 'doc-1',
                level: 1,
                title: 'Exact Match',
                is_leaf: 1,
                path: JSON.stringify(['Doc', 'Exact']),
                hash: 'hash-exact'
            };

            upsertSection(meta, embedding);

            // Search with same text
            const queryEmbedding = await embed(text);
            const results = searchKnn(queryEmbedding, 1);

            expect(results.length).toBe(1);
            expect(results[0].node_id).toBe('exact-match');
            expect(results[0].distance).toBe(0);
        });

        it('should filter by doc_id', async () => {
            const emb1 = await embed('Content 1');
            const emb2 = await embed('Content 2');

            upsertSection({
                node_id: 'node-1',
                doc_id: 'doc-A',
                level: 1,
                title: 'Node 1',
                is_leaf: 1,
                path: '[]',
                hash: 'h1'
            }, emb1);

            upsertSection({
                node_id: 'node-2',
                doc_id: 'doc-B',
                level: 1,
                title: 'Node 2',
                is_leaf: 1,
                path: '[]',
                hash: 'h2'
            }, emb2);

            const queryEmb = await embed('Content 1');
            const results = searchKnn(queryEmb, 5, { doc_id: 'doc-A' });

            expect(results.every(r => r.doc_id === 'doc-A')).toBe(true);
            expect(results.some(r => r.node_id === 'node-1')).toBe(true);
        });

        it('should filter by level', async () => {
            const emb1 = await embed('Level 1 content');
            const emb2 = await embed('Level 2 content');

            upsertSection({
                node_id: 'l1-node',
                doc_id: 'doc-1',
                level: 1,
                title: 'Level 1',
                is_leaf: 0,
                path: '[]',
                hash: 'h1'
            }, emb1);

            upsertSection({
                node_id: 'l2-node',
                doc_id: 'doc-1',
                level: 2,
                title: 'Level 2',
                is_leaf: 1,
                path: '[]',
                hash: 'h2'
            }, emb2);

            const queryEmb = await embed('Level 1 content');
            const results = searchKnn(queryEmb, 5, { level: 1 });

            // Should find at least the level 1 node
            expect(results.length).toBeGreaterThan(0);
            const l1Node = results.find(r => r.node_id === 'l1-node');
            expect(l1Node).toBeDefined();
            // Ensure no level 2 nodes
            const l2Node = results.find(r => r.node_id === 'l2-node');
            expect(l2Node).toBeUndefined();
        });

        it('should filter by is_leaf', async () => {
            const emb1 = await embed('Leaf content');
            const emb2 = await embed('Branch content');

            upsertSection({
                node_id: 'leaf',
                doc_id: 'doc-1',
                level: 1,
                title: 'Leaf',
                is_leaf: 1,
                path: '[]',
                hash: 'h1'
            }, emb1);

            upsertSection({
                node_id: 'branch',
                doc_id: 'doc-1',
                level: 1,
                title: 'Branch',
                is_leaf: 0,
                path: '[]',
                hash: 'h2'
            }, emb2);

            const queryEmb = await embed('Leaf content');
            const results = searchKnn(queryEmb, 5, { is_leaf: 1 });

            // Should find at least the leaf node
            expect(results.length).toBeGreaterThan(0);
            const leafNode = results.find(r => r.node_id === 'leaf');
            expect(leafNode).toBeDefined();
            // Ensure no branch nodes  
            const branchNode = results.find(r => r.node_id === 'branch');
            expect(branchNode).toBeUndefined();
        });
    });

    describe('deleteSection', () => {
        it('should delete a section and its vector', async () => {
            const meta: SectionRow = {
                node_id: 'to-delete',
                doc_id: 'doc-1',
                level: 1,
                title: 'Will be deleted',
                is_leaf: 1,
                path: '[]',
                hash: 'hash'
            };

            const embedding = await embed('Delete me');
            upsertSection(meta, embedding);

            let retrieved = getSectionMeta('to-delete');
            expect(retrieved).toBeDefined();

            deleteSection('to-delete');

            retrieved = getSectionMeta('to-delete');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('getDocNodeIds', () => {
        it('should return all node IDs for a document', async () => {
            const emb = await embed('Test');

            for (let i = 1; i <= 3; i++) {
                upsertSection({
                    node_id: `node-${i}`,
                    doc_id: 'doc-test',
                    level: 1,
                    title: `Node ${i}`,
                    is_leaf: 1,
                    path: '[]',
                    hash: `h${i}`
                }, emb);
            }

            const nodeIds = getDocNodeIds('doc-test');

            expect(nodeIds.length).toBe(3);
            expect(nodeIds).toContain('node-1');
            expect(nodeIds).toContain('node-2');
            expect(nodeIds).toContain('node-3');
        });

        it('should return empty array for non-existent document', () => {
            const nodeIds = getDocNodeIds('non-existent-doc');
            expect(nodeIds.length).toBe(0);
        });
    });
});
