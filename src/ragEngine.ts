import { searchKnn } from './db/vectorStore.js';
import { getNode, getParent, getSiblings, getDocumentByNodeId } from './db/jsonStore.js';
import { embed } from './embeddings.js';

export interface RagResult {
    answer: string; // Constructed context for now
    sources: {
        nodeId: string;
        docId: string;
        score: number;
        context: string;
    }[];
}

export async function retrieveContext(docId: string, nodeId: string): Promise<string> {
    const node = await getNode(docId, nodeId);
    if (!node) return '';

    const parent = await getParent(docId, nodeId);
    const siblings = await getSiblings(docId, nodeId);

    let context = '';

    // 1. Parent Context (Breadcrumb/Topic)
    if (parent) {
        context += `[Context: ${parent.title}]\n`;
        // Optional: Add parent content summary if available
    }

    // 2. The Node Itself
    context += `## ${node.title}\n${node.content.join('\n')}\n`;

    // 3. Siblings (Adjacent context)
    if (siblings.length > 0) {
        context += `\n[Related Sections]:\n`;
        for (const sib of siblings) {
            context += `- ${sib.title}: ${sib.content.slice(0, 1).join(' ').substring(0, 100)}...\n`;
        }
    }

    return context;
}

export async function answer(query: string): Promise<RagResult> {
    const queryVec = await embed(query);
    const searchResults = searchKnn(queryVec, 3); // Top 3

    const sources = [];

    for (const res of searchResults) {
        const context = await retrieveContext(res.doc_id, res.node_id);
        sources.push({
            nodeId: res.node_id,
            docId: res.doc_id,
            score: res.distance,
            context
        });
    }

    // In a real RAG, we would send `sources` + `query` to an LLM here.
    // For now, we return the constructed context as the "answer".

    return {
        answer: "Context retrieved successfully. See sources.",
        sources
    };
}
