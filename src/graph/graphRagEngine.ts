import { searchKnn, getSectionMeta } from '../db/vectorStore.js';
import { loadDocument } from '../db/jsonStore.js';
import { embed } from '../embeddings/index.js';
import { expandGraph, type EdgeType, type ExpandedNode } from '../db/graphStore.js';
import { rerankSources, rerankWithDiversity, type RerankerConfig, type RankedSource } from './reranker.js';

/**
 * Configuration for graph-aware RAG queries
 */
export interface GraphRagConfig {
  k: number;                    // Number of initial seeds from vector search
  expandGraph?: boolean;        // Whether to expand using graph (default: false)
  graphConfig?: {
    maxHops: number;            // Maximum hops in graph expansion (1-3)
    maxNodes: number;           // Maximum nodes to retrieve from graph
    edgeTypes: EdgeType[];      // Types of edges to follow
    minWeight?: number;         // Minimum edge weight for SAME_TOPIC
  };
  includeContext?: boolean;     // Include parent/siblings in context (default: true)
  rerank?: boolean;             // Whether to rerank results (default: true)
  rerankConfig?: Partial<RerankerConfig>;  // Reranking configuration
  maxPerDocument?: number;      // Max results per document for diversity (default: no limit)
}

/**
 * Result from graph-aware RAG query
 */
export interface GraphRagResult {
  query: string;
  answer: string;
  sources: RagSource[];
  graphExpansion?: {
    seedNodes: string[];
    expandedNodes: ExpandedNode[];
    totalNodesRetrieved: number;
  };
  metadata: {
    resultsCount: number;
    timestamp: string;
    usedGraph: boolean;
  };
}

export interface RagSource {
  nodeId: string;
  docId: string;
  score: number;
  context: string;
  hopDistance?: number;         // Distance from seed (0 = seed)
  edgeType?: EdgeType;          // How we reached this node
  pathFromSeed?: string[];      // Path of node IDs from seed
}

/**
 * Build context string from a node with hierarchical information
 */
async function buildContextForNode(
  nodeId: string,
  docId: string,
  includeContext: boolean = true
): Promise<string> {
  const doc = await loadDocument(docId);
  if (!doc) return '';

  const node = doc.nodes[nodeId];
  if (!node) return '';

  // Get the actual section content from the tree
  function findNodeInTree(root: any, targetId: string): any {
    if (root.id === targetId) return root;
    for (const child of root.children || []) {
      const found = findNodeInTree(child, targetId);
      if (found) return found;
    }
    return null;
  }

  const sectionNode = findNodeInTree(doc.root, nodeId);
  if (!sectionNode) return '';

  let context = '';

  // Document title
  context += `[Document: ${doc.title}]\n\n`;

  if (includeContext) {
    // Parent context (if exists)
    const parentId = node.parentId;
    if (parentId) {
      const parentNode = findNodeInTree(doc.root, parentId);
      if (parentNode) {
        context += `[Parent Section: ${parentNode.title}]\n`;
        if (parentNode.content && parentNode.content.length > 0) {
          context += parentNode.content.slice(0, 2).join('\n') + '\n\n';
        }
      }
    }
  }

  // Current section
  context += `## ${sectionNode.title}\n`;
  if (sectionNode.content && sectionNode.content.length > 0) {
    context += sectionNode.content.join('\n') + '\n';
  }

  // Child sections (titles only, for overview)
  if (sectionNode.children && sectionNode.children.length > 0) {
    context += '\n[Subsections: ';
    context += sectionNode.children.map((c: any) => c.title).join(', ');
    context += ']\n';
  }

  return context;
}

/**
 * Execute a graph-aware RAG query
 */
export async function graphRagQuery(
  query: string,
  config: GraphRagConfig
): Promise<GraphRagResult> {
  const startTime = Date.now();

  // Step 1: Vector search to get initial seeds
  const queryEmbedding = await embed(query);
  const vectorResults = searchKnn(queryEmbedding, config.k);

  if (vectorResults.length === 0) {
    return {
      query,
      answer: 'No relevant documents found.',
      sources: [],
      metadata: {
        resultsCount: 0,
        timestamp: new Date().toISOString(),
        usedGraph: false
      }
    };
  }

  const seedNodeIds = vectorResults.map(r => r.node_id);
  const sources: RagSource[] = [];
  let graphExpansion: GraphRagResult['graphExpansion'] | undefined;

  // Add seed nodes as sources
  for (const result of vectorResults) {
    const meta = getSectionMeta(result.node_id);
    if (!meta) continue;

    const context = await buildContextForNode(
      result.node_id,
      meta.doc_id,
      config.includeContext !== false
    );

    sources.push({
      nodeId: result.node_id,
      docId: meta.doc_id,
      score: result.distance,
      context,
      hopDistance: 0  // Seed nodes have distance 0
    });
  }

  // Step 2: Graph expansion (if enabled)
  if (config.expandGraph && config.graphConfig) {
    console.log(`🔍 Expanding graph from ${seedNodeIds.length} seeds...`);
    
    const expanded = expandGraph(seedNodeIds, config.graphConfig);
    
    // Filter out seed nodes (already included)
    const newNodes = expanded.filter(n => n.hop > 0);
    
    console.log(`   Found ${newNodes.length} additional nodes via graph expansion`);

    // Add expanded nodes as sources
    for (const expandedNode of newNodes) {
      const meta = getSectionMeta(expandedNode.node_id);
      if (!meta) continue;

      const context = await buildContextForNode(
        expandedNode.node_id,
        meta.doc_id,
        config.includeContext !== false
      );

      sources.push({
        nodeId: expandedNode.node_id,
        docId: meta.doc_id,
        score: 1.0 - (expandedNode.weight || 0), // Invert weight to score
        context,
        hopDistance: expandedNode.hop,
        edgeType: expandedNode.edge_type,
        pathFromSeed: expandedNode.path
      });
    }

    graphExpansion = {
      seedNodes: seedNodeIds,
      expandedNodes: expanded,
      totalNodesRetrieved: expanded.length
    };
  }

  // Step 3: Rank and deduplicate sources
  // Remove duplicates (can happen if multiple paths lead to same node)
  const uniqueSources = new Map<string, RagSource>();
  for (const source of sources) {
    if (!uniqueSources.has(source.nodeId) || 
        (uniqueSources.get(source.nodeId)!.score > source.score)) {
      uniqueSources.set(source.nodeId, source);
    }
  }

  // Convert to array for reranking
  let rankedSources: RagSource[];
  
  // Apply reranking if enabled (default: true)
  if (config.rerank !== false) {
    // Convert to format expected by reranker
    const sourcesForRanking = Array.from(uniqueSources.values()).map(s => ({
      nodeId: s.nodeId,
      docId: s.docId,
      score: s.score,
      hopDistance: s.hopDistance,
      edgeType: s.edgeType,
      edgeWeight: s.edgeType === 'SAME_TOPIC' ? (1 - s.score) : undefined
    }));
    
    // Apply reranking
    let reranked = rerankSources(sourcesForRanking, config.rerankConfig);
    
    // Apply diversity filter if configured
    if (config.maxPerDocument) {
      reranked = rerankWithDiversity(reranked, config.maxPerDocument);
    }
    
    // Map back to RagSource with updated scores
    rankedSources = reranked.map(r => {
      const original = uniqueSources.get(r.nodeId)!;
      return {
        ...original,
        score: r.finalScore // Use reranked score
      };
    });
  } else {
    // Legacy sorting (by hop distance, then score)
    rankedSources = Array.from(uniqueSources.values()).sort((a, b) => {
      if (a.hopDistance !== b.hopDistance) {
        return (a.hopDistance || 0) - (b.hopDistance || 0);
      }
      return a.score - b.score;
    });
  }

  const answer = rankedSources.length > 0
    ? `Found ${rankedSources.length} relevant sections${config.expandGraph ? ' using graph expansion' : ''}. See sources for context.`
    : 'No relevant information found.';

  return {
    query,
    answer,
    sources: rankedSources,
    graphExpansion,
    metadata: {
      resultsCount: rankedSources.length,
      timestamp: new Date().toISOString(),
      usedGraph: config.expandGraph || false
    }
  };
}

/**
 * Helper: Default graph-aware query with sensible defaults
 */
export async function smartGraphQuery(
  query: string,
  k: number = 3
): Promise<GraphRagResult> {
  return graphRagQuery(query, {
    k,
    expandGraph: true,
    graphConfig: {
      maxHops: 1,
      maxNodes: 10,
      edgeTypes: ['SAME_TOPIC', 'PARENT_OF', 'CHILD_OF'],
      minWeight: 0.75
    },
    includeContext: true
  });
}

/**
 * Helper: Query without graph expansion (classic RAG)
 */
export async function classicRagQuery(
  query: string,
  k: number = 3
): Promise<GraphRagResult> {
  return graphRagQuery(query, {
    k,
    expandGraph: false,
    includeContext: true
  });
}

