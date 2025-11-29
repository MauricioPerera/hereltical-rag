import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveDocument, loadDocument, getNode, getParent, getSiblings, Document, SectionNode, setJsonPath, resetDb } from '../src/db/jsonStore';
import fs from 'node:fs';

const TEST_DB_PATH = 'test-documents.json';

describe('jsonStore', () => {
    beforeEach(() => {
        // Reset and configure JSON store with test path
        resetDb();
        setJsonPath(TEST_DB_PATH);

        // Clean up any existing test database
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    afterEach(() => {
        // Reset JSON store
        resetDb();

        // Clean up test database
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }

        // Reset to default path
        setJsonPath('documents.json');
    });

    describe('saveDocument and loadDocument', () => {
        it('should save and load a simple document', async () => {
            const doc: Document = {
                docId: 'test-doc-1',
                title: 'Test Document',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Test Document',
                    content: [],
                    children: []
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: [], level: 0 }
                }
            };

            await saveDocument(doc);
            const loaded = await loadDocument('test-doc-1');

            expect(loaded).toBeDefined();
            expect(loaded?.docId).toBe('test-doc-1');
            expect(loaded?.title).toBe('Test Document');
        });

        it('should handle documents with nested sections', async () => {
            const doc: Document = {
                docId: 'test-doc-2',
                title: 'Nested Document',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Nested Document',
                    content: [],
                    children: [
                        {
                            id: 'sec-1',
                            type: 'section',
                            level: 1,
                            title: 'Section 1',
                            content: ['Content 1'],
                            children: []
                        },
                        {
                            id: 'sec-2',
                            type: 'section',
                            level: 1,
                            title: 'Section 2',
                            content: ['Content 2'],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['sec-1', 'sec-2'], level: 0 },
                    'sec-1': { id: 'sec-1', parentId: 'root', childrenIds: [], level: 1 },
                    'sec-2': { id: 'sec-2', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            const loaded = await loadDocument('test-doc-2');

            expect(loaded?.root.children.length).toBe(2);
            expect(loaded?.root.children[0].id).toBe('sec-1');
            expect(loaded?.root.children[1].id).toBe('sec-2');
        });
    });

    describe('getNode', () => {
        it('should retrieve a specific node', async () => {
            const doc: Document = {
                docId: 'test-doc-3',
                title: 'Node Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Node Test',
                    content: [],
                    children: [
                        {
                            id: 'target',
                            type: 'section',
                            level: 1,
                            title: 'Target Section',
                            content: ['Target content'],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['target'], level: 0 },
                    target: { id: 'target', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            const node = await getNode('test-doc-3', 'target');

            expect(node).toBeDefined();
            expect(node?.id).toBe('target');
            expect(node?.title).toBe('Target Section');
        });

        it('should return undefined for non-existent node', async () => {
            const doc: Document = {
                docId: 'test-doc-4',
                title: 'Empty Doc',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Empty Doc',
                    content: [],
                    children: []
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: [], level: 0 }
                }
            };

            await saveDocument(doc);
            const node = await getNode('test-doc-4', 'non-existent');

            expect(node).toBeUndefined();
        });
    });

    describe('getParent', () => {
        it('should retrieve the parent node', async () => {
            const doc: Document = {
                docId: 'test-doc-5',
                title: 'Parent Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Parent Test',
                    content: [],
                    children: [
                        {
                            id: 'child',
                            type: 'section',
                            level: 1,
                            title: 'Child Section',
                            content: [],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['child'], level: 0 },
                    child: { id: 'child', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            const parent = await getParent('test-doc-5', 'child');

            expect(parent).toBeDefined();
            expect(parent?.id).toBe('root');
        });

        it('should return undefined for root node', async () => {
            const doc: Document = {
                docId: 'test-doc-6',
                title: 'Root Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Root Test',
                    content: [],
                    children: []
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: [], level: 0 }
                }
            };

            await saveDocument(doc);
            const parent = await getParent('test-doc-6', 'root');

            expect(parent).toBeUndefined();
        });
    });

    describe('getSiblings', () => {
        it('should retrieve all siblings of a node', async () => {
            const doc: Document = {
                docId: 'test-doc-7',
                title: 'Siblings Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Siblings Test',
                    content: [],
                    children: [
                        {
                            id: 'sib-1',
                            type: 'section',
                            level: 1,
                            title: 'Sibling 1',
                            content: [],
                            children: []
                        },
                        {
                            id: 'target',
                            type: 'section',
                            level: 1,
                            title: 'Target',
                            content: [],
                            children: []
                        },
                        {
                            id: 'sib-2',
                            type: 'section',
                            level: 1,
                            title: 'Sibling 2',
                            content: [],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['sib-1', 'target', 'sib-2'], level: 0 },
                    'sib-1': { id: 'sib-1', parentId: 'root', childrenIds: [], level: 1 },
                    target: { id: 'target', parentId: 'root', childrenIds: [], level: 1 },
                    'sib-2': { id: 'sib-2', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            const siblings = await getSiblings('test-doc-7', 'target');

            expect(siblings.length).toBe(2);
            expect(siblings.map(s => s.id)).toContain('sib-1');
            expect(siblings.map(s => s.id)).toContain('sib-2');
            expect(siblings.map(s => s.id)).not.toContain('target');
        });

        it('should return empty array for node with no siblings', async () => {
            const doc: Document = {
                docId: 'test-doc-8',
                title: 'Only Child Test',
                version: 1,
                root: {
                    id: 'root',
                    type: 'document',
                    level: 0,
                    title: 'Only Child Test',
                    content: [],
                    children: [
                        {
                            id: 'only-child',
                            type: 'section',
                            level: 1,
                            title: 'Only Child',
                            content: [],
                            children: []
                        }
                    ]
                },
                nodes: {
                    root: { id: 'root', parentId: null, childrenIds: ['only-child'], level: 0 },
                    'only-child': { id: 'only-child', parentId: 'root', childrenIds: [], level: 1 }
                }
            };

            await saveDocument(doc);
            const siblings = await getSiblings('test-doc-8', 'only-child');

            expect(siblings.length).toBe(0);
        });
    });
});
