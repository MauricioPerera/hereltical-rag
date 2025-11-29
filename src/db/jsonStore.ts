import { JSONFilePreset } from 'lowdb/node';

export interface SectionNode {
    id: string;
    type: 'document' | 'section';
    level: number;
    title: string;
    content: string[];
    children: SectionNode[];
}

export interface NodeMeta {
    id: string;
    parentId: string | null;
    childrenIds: string[];
    level: number;
}

export interface Document {
    docId: string;
    title: string;
    version: number;
    root: SectionNode;
    nodes: Record<string, NodeMeta>;
}

export interface Data {
    documents: Document[];
}

const defaultData: Data = { documents: [] };

let JSON_PATH = 'documents.json';

// Initialize the database
// We use a singleton pattern for simplicity in this phase
let dbInstance: Awaited<ReturnType<typeof JSONFilePreset<Data>>> | null = null;

/**
 * Set a custom JSON file path (useful for testing)
 * Must be called before any database operations
 */
export function setJsonPath(path: string) {
    if (dbInstance) {
        throw new Error('Cannot change JSON path after database is initialized. Call resetDb() first.');
    }
    JSON_PATH = path;
}

/**
 * Reset the database instance
 * Useful for cleanup in tests
 */
export function resetDb() {
    dbInstance = null;
}

export async function getDb() {
    if (!dbInstance) {
        dbInstance = await JSONFilePreset<Data>(JSON_PATH, defaultData);
    }
    return dbInstance;
}

export async function saveDocument(doc: Document) {
    const db = await getDb();
    const index = db.data.documents.findIndex((d) => d.docId === doc.docId);

    if (index >= 0) {
        db.data.documents[index] = doc;
    } else {
        db.data.documents.push(doc);
    }

    await db.write();
}

export async function loadDocument(docId: string): Promise<Document | undefined> {
    const db = await getDb();
    return db.data.documents.find((d) => d.docId === docId);
}

export async function getDocumentByNodeId(nodeId: string): Promise<Document | undefined> {
    const db = await getDb();
    return db.data.documents.find(d => d.nodes[nodeId]);
}

export async function getNode(docId: string, nodeId: string): Promise<SectionNode | undefined> {
    const doc = await loadDocument(docId);
    if (!doc) return undefined;

    // Helper to find node recursively in the tree
    const findInTree = (nodes: SectionNode[]): SectionNode | undefined => {
        for (const node of nodes) {
            if (node.id === nodeId) return node;
            const found = findInTree(node.children);
            if (found) return found;
        }
        return undefined;
    };

    if (doc.root.id === nodeId) return doc.root;
    return findInTree(doc.root.children);
}

export async function getParent(docId: string, nodeId: string): Promise<SectionNode | undefined> {
    const doc = await loadDocument(docId);
    if (!doc) return undefined;

    const meta = doc.nodes[nodeId];
    if (!meta || !meta.parentId) return undefined;

    return getNode(docId, meta.parentId);
}

export async function getChildren(docId: string, nodeId: string): Promise<SectionNode[]> {
    const doc = await loadDocument(docId);
    if (!doc) return [];

    const meta = doc.nodes[nodeId];
    if (!meta) return [];

    const children: SectionNode[] = [];
    for (const childId of meta.childrenIds) {
        const node = await getNode(docId, childId);
        if (node) children.push(node);
    }
    return children;
}

export async function getSiblings(docId: string, nodeId: string): Promise<SectionNode[]> {
    const doc = await loadDocument(docId);
    if (!doc) return [];

    const meta = doc.nodes[nodeId];
    if (!meta || !meta.parentId) return [];

    const parentMeta = doc.nodes[meta.parentId];
    if (!parentMeta) return [];

    const siblings: SectionNode[] = [];
    for (const siblingId of parentMeta.childrenIds) {
        if (siblingId !== nodeId) {
            const node = await getNode(docId, siblingId);
            if (node) siblings.push(node);
        }
    }
    return siblings;
}

/**
 * Get all documents in the database
 */
export async function getAllDocuments(): Promise<Document[]> {
    const db = await getDb();
    return db.data.documents;
}

/**
 * Get all document IDs
 */
export async function getAllDocumentIds(): Promise<string[]> {
    const db = await getDb();
    return db.data.documents.map(d => d.docId);
}