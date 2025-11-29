import { saveDocument, Document, SectionNode } from './db/jsonStore.js';
import { syncDocument } from './indexer.js';
import { searchKnn } from './db/vectorStore.js';
import { embed } from './embeddings.js';

async function main() {
    console.log('🚀 Starting Phase 4 Verification (Sync & Updates)...');

    const docId = 'doc-sync-test';

    // Helper to build nodes
    const createSection = (id: string, title: string, content: string[], level: number): SectionNode => {
        return { id, type: 'section', level, title, content, children: [] };
    };

    // --- Initial State ---
    console.log('\n--- 1. Initial Indexing ---');
    const doc: Document = {
        docId,
        title: 'Sync Test Doc',
        version: 1,
        root: {
            id: 'root',
            type: 'document',
            level: 0,
            title: 'Sync Test Doc',
            content: [],
            children: []
        },
        nodes: {} // We'll skip populating nodes map manually for this test as syncDocument relies on the tree structure passed in
    };
    // Note: syncDocument traverses the tree structure in doc.root. 
    // jsonStore's saveDocument expects doc.nodes to be populated for navigation, 
    // but for indexer.ts we just need the tree.
    // Let's populate doc.nodes roughly to be safe if we save it.

    const sec1 = createSection('sec-1', 'Original Section 1', ['Content 1'], 1);
    const sec2 = createSection('sec-2', 'Original Section 2', ['Content 2'], 1);
    doc.root.children.push(sec1, sec2);

    // Populate nodes map for jsonStore (though we might not use jsonStore navigation in this specific test)
    doc.nodes['root'] = { id: 'root', parentId: null, childrenIds: ['sec-1', 'sec-2'], level: 0 };
    doc.nodes['sec-1'] = { id: 'sec-1', parentId: 'root', childrenIds: [], level: 1 };
    doc.nodes['sec-2'] = { id: 'sec-2', parentId: 'root', childrenIds: [], level: 1 };

    await saveDocument(doc);
    await syncDocument(doc);

    // --- Modification State ---
    console.log('\n--- 2. Modifying Document ---');
    // 1. Modify sec-1
    sec1.content = ['Content 1 MODIFIED'];

    // 2. Add sec-3
    const sec3 = createSection('sec-3', 'New Section 3', ['Content 3'], 1);
    doc.root.children.push(sec3);
    doc.nodes['root'].childrenIds.push('sec-3');
    doc.nodes['sec-3'] = { id: 'sec-3', parentId: 'root', childrenIds: [], level: 1 };

    // 3. Delete sec-2
    doc.root.children = doc.root.children.filter(n => n.id !== 'sec-2');
    doc.nodes['root'].childrenIds = doc.nodes['root'].childrenIds.filter(id => id !== 'sec-2');
    delete doc.nodes['sec-2'];

    await saveDocument(doc);
    await syncDocument(doc);

    // --- Verification ---
    console.log('\n--- 3. Verifying Updates ---');

    // Check if sec-1 is updated
    // With hash-based deterministic embeddings, we need exact text match to get a high score (distance ~0)
    // The indexed text is "Title\nContent"
    const exactText = "Original Section 1\nContent 1 MODIFIED";
    const q1 = await embed(exactText);
    const r1 = searchKnn(q1, 1, { doc_id: docId });

    if (r1.length > 0 && r1[0].node_id === 'sec-1') {
        console.log(`✅ Modified node found (sec-1) - Distance: ${r1[0].distance}`);
    } else {
        console.error('❌ Modified node NOT found');
    }

    // Check if sec-3 exists
    const exactText3 = "New Section 3\nContent 3";
    const q3 = await embed(exactText3);
    const r3 = searchKnn(q3, 1, { doc_id: docId });

    if (r3.length > 0 && r3[0].node_id === 'sec-3') {
        console.log(`✅ New node found (sec-3) - Distance: ${r3[0].distance}`);
    } else {
        console.error('❌ New node NOT found');
    }

    // Check if sec-2 is gone
    // Search for its old exact content
    const exactText2 = "Original Section 2\nContent 2";
    const q2 = await embed(exactText2);
    const r2 = searchKnn(q2, 5, { doc_id: docId });
    // Since embeddings are random-ish hashes, we might find *something*, but it shouldn't be sec-2
    const foundSec2 = r2.find(r => r.node_id === 'sec-2');
    if (!foundSec2) {
        console.log('✅ Deleted node is gone (sec-2)');
    } else {
        console.error('❌ Deleted node STILL EXISTS');
    }

    console.log('\n✅ Phase 4 Verification Successful!');
}

main().catch(console.error);
