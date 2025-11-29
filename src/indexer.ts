import { Document, SectionNode } from './db/jsonStore.js';
import { upsertSection, getSectionMeta, deleteSection, getDocNodeIds } from './db/vectorStore.js';
import { embed } from './embeddings.js';
import crypto from 'node:crypto';

function calculateHash(node: SectionNode): string {
    const content = `${node.title}\n${node.content.join('\n')}`;
    return crypto.createHash('sha256').update(content).digest('hex');
}

export async function syncDocument(doc: Document) {
    console.log(`🔄 Syncing document: ${doc.docId}`);

    // 1. Get all existing node IDs for this doc to track deletions
    const existingNodeIds = new Set(getDocNodeIds(doc.docId));
    const visitedNodeIds = new Set<string>();

    // 2. Traverse the new document structure
    const nodesToProcess: SectionNode[] = [doc.root];

    // Flatten tree for processing
    const allNodes: SectionNode[] = [];
    const traverse = (nodes: SectionNode[]) => {
        for (const node of nodes) {
            allNodes.push(node);
            traverse(node.children);
        }
    };
    traverse(doc.root.children);
    // Add root if needed, but usually we index content nodes.
    // Let's include root if it has content or title we care about.
    // For this logic, let's process all nodes in the flattened list.

    // Also add root to allNodes if it's not there (it wasn't in children)
    allNodes.push(doc.root);

    for (const node of allNodes) {
        visitedNodeIds.add(node.id);

        const newHash = calculateHash(node);
        const existingMeta = getSectionMeta(node.id);

        // Check if update is needed
        if (existingMeta && existingMeta.hash === newHash) {
            console.log(`   ⏭️  Skipping unchanged node: ${node.id}`);
            continue;
        }

        if (existingMeta) {
            console.log(`   📝 Updating changed node: ${node.id}`);
        } else {
            console.log(`   ➕ Indexing new node: ${node.id}`);
        }

        // Generate embedding
        const text = `${node.title}\n${node.content.join('\n')}`;
        const vector = await embed(text);

        // Upsert
        upsertSection({
            node_id: node.id,
            doc_id: doc.docId,
            level: node.level,
            title: node.title,
            is_leaf: node.children.length === 0 ? 1 : 0, // Simple heuristic for leaf
            path: JSON.stringify([doc.title, node.title]), // Simplified path
            hash: newHash
        }, vector);
    }

    // 3. Handle Deletions
    for (const id of existingNodeIds) {
        if (!visitedNodeIds.has(id)) {
            console.log(`   🗑️  Deleting stale node: ${id}`);
            deleteSection(id);
        }
    }

    console.log(`✅ Sync complete for ${doc.docId}`);
}
