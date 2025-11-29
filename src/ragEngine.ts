import { searchKnn } from './db/vectorStore.js';
import { getNode, getParent, getSiblings, getDocumentByNodeId } from './db/jsonStore.js';
import { embed } from './embeddings.js';
import { expandGraph, type GraphExpansionConfig, type EdgeType } from './db/graphStore.js';

export interface RagResult {
    answer: string; // Constructed context for now
    sources: {
        nodeId: string;
        docId: string;
        score: number;
        context: string;
        graphHop?: number;       // NEW: Distance from seed in graph
        edgeType?: EdgeType;     // NEW: How we reached this node
        edgeWeight?: number;     // NEW: Edge weight
    }[];
}

export interface GraphRagConfig {
    useGraph: boolean;           // Enable graph expansion
    maxHops: number;             // Graph expansion hops (1-3)
    maxGraphNodes: number;       // Max nodes from graph
    edgeTypes: EdgeType[];       // Edge types to follow
    minEdgeWeight?: number;      // Min edge weight
    combineStrategy: 'union' | 'rerank';  // How to combine vector + graph results
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

/**
 * Query with graph expansion (hybrid vector + graph)
 * 
 * This implements the hybrid RAG strategy:
 * 1. Vector search → seed nodes
 * 2. Graph expansion → related nodes
 * 3. Combine contexts
 */
export async function queryWithGraph(
    query: string,
    k: number = 3,
    graphConfig?: Partial<GraphRagConfig>
): Promise<RagResult> {
    // Default graph config
    const config: GraphRagConfig = {
        useGraph: true,
        maxHops: 1,
        maxGraphNodes: 10,
        edgeTypes: ['SAME_TOPIC', 'PARENT_OF', 'CHILD_OF'],
        minEdgeWeight: 0.7,
        combineStrategy: 'union',
        ...graphConfig
    };

    // Step 1: Vector search for seed nodes
    const queryVec = await embed(query);
    const seedResults = searchKnn(queryVec, k);

    if (seedResults.length === 0) {
        return {
            answer: "No results found.",
            sources: []
        };
    }

    // Seeds with their scores
    const seedNodes = seedResults.map(r => r.node_id);
    const seedScores = new Map<string, number>();
    for (const res of seedResults) {
        seedScores.set(res.node_id, res.distance);
    }

    // Step 2: Graph expansion (if enabled)
    let allNodeIds = [...seedNodes];
    const graphNodeInfo = new Map<string, { hop: number; edgeType?: EdgeType; weight?: number }>();

    if (config.useGraph && seedNodes.length > 0) {
        const expansionConfig: GraphExpansionConfig = {
            maxHops: config.maxHops,
            maxNodes: config.maxGraphNodes,
            edgeTypes: config.edgeTypes,
            minWeight: config.minEdgeWeight
        };

        const expanded = expandGraph(seedNodes, expansionConfig);

        // Add expanded nodes
        for (const expNode of expanded) {
            if (!allNodeIds.includes(expNode.node_id)) {
                allNodeIds.push(expNode.node_id);
            }
            graphNodeInfo.set(expNode.node_id, {
                hop: expNode.hop,
                edgeType: expNode.edge_type,
                weight: expNode.weight
            });
        }
    }

    // Step 3: Retrieve context for all nodes
    const sources = [];

    for (const nodeId of allNodeIds) {
        // Get doc_id for this node
        const doc = await getDocumentByNodeId(nodeId);
        if (!doc) continue;

        const context = await retrieveContext(doc.docId, nodeId);

        // Calculate score
        let score: number;
        const graphInfo = graphNodeInfo.get(nodeId);

        if (seedScores.has(nodeId)) {
            // Seed node: use vector score
            score = seedScores.get(nodeId)!;
        } else if (graphInfo) {
            // Graph node: use edge weight or hop-based score
            if (graphInfo.weight !== undefined) {
                score = 1 - graphInfo.weight; // Convert similarity to distance
            } else {
                // Hop-based scoring: further = higher distance
                score = graphInfo.hop * 0.3; // 0.3 per hop
            }
        } else {
            score = 1.0; // Unknown
        }

        sources.push({
            nodeId,
            docId: doc.docId,
            score,
            context,
            graphHop: graphInfo?.hop,
            edgeType: graphInfo?.edgeType,
            edgeWeight: graphInfo?.weight
        });
    }

    // Step 4: Sort by score (lower is better for distance)
    sources.sort((a, b) => a.score - b.score);

    // Step 5: Construct answer
    const seedCount = seedNodes.length;
    const graphCount = sources.length - seedCount;
    const answer = config.useGraph
        ? `Found ${seedCount} direct matches and ${graphCount} related nodes via graph expansion.`
        : "Context retrieved successfully. See sources.";

    return {
        answer,
        sources
    };
}
