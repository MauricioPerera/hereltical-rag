import { type EdgeType } from '../db/graphStore.js';

/**
 * Configuration for edge-based reranking
 */
export interface RerankerConfig {
  // Weight multipliers for each edge type (higher = more important)
  edgeWeights: Partial<Record<EdgeType, number>>;
  
  // How much to boost seed nodes (hop 0)
  seedBoost: number;
  
  // Decay factor per hop (e.g., 0.8 means each hop reduces score by 20%)
  hopDecay: number;
  
  // Minimum score threshold (filter out low scores)
  minScore: number;
  
  // Combine strategy
  strategy: 'multiplicative' | 'additive' | 'weighted';
}

/**
 * Source with reranking metadata
 */
export interface RankedSource {
  nodeId: string;
  docId: string;
  originalScore: number;      // Vector similarity score
  hopDistance: number;        // Hops from seed (0 = seed)
  edgeType?: EdgeType;        // How we reached this node
  edgeWeight?: number;        // Edge weight (for SAME_TOPIC)
  
  // Computed scores
  finalScore: number;         // After reranking
  scoreBreakdown: {
    vectorComponent: number;
    edgeComponent: number;
    hopComponent: number;
    total: number;
  };
}

/**
 * Default reranker configuration
 */
export const DEFAULT_RERANKER_CONFIG: RerankerConfig = {
  edgeWeights: {
    'SAME_TOPIC': 1.0,      // Semantic similarity - high value
    'REFERS_TO': 0.9,       // Explicit reference - very high
    'PARENT_OF': 0.7,       // Broader context
    'CHILD_OF': 0.6,        // More specific
    'NEXT_SIBLING': 0.4,    // Adjacent
    'PREV_SIBLING': 0.4     // Adjacent
  },
  seedBoost: 1.2,           // Seeds get 20% boost
  hopDecay: 0.85,           // Each hop loses 15%
  minScore: 0.1,            // Filter very low scores
  strategy: 'multiplicative'
};

/**
 * Calculate the edge type component of the score
 */
function calculateEdgeScore(
  edgeType: EdgeType | undefined,
  edgeWeight: number | undefined,
  config: RerankerConfig
): number {
  if (!edgeType) {
    // Seed node (no edge)
    return config.seedBoost;
  }
  
  const typeWeight = config.edgeWeights[edgeType] || 0.5;
  
  // For SAME_TOPIC, also consider the edge weight (similarity)
  if (edgeType === 'SAME_TOPIC' && edgeWeight !== undefined) {
    return typeWeight * edgeWeight;
  }
  
  // For REFERS_TO, full weight (explicit reference)
  if (edgeType === 'REFERS_TO') {
    return typeWeight;
  }
  
  return typeWeight;
}

/**
 * Calculate the hop decay component
 */
function calculateHopScore(hopDistance: number, config: RerankerConfig): number {
  if (hopDistance === 0) {
    return 1.0; // No decay for seeds
  }
  
  return Math.pow(config.hopDecay, hopDistance);
}

/**
 * Rerank sources based on edge types and hops
 */
export function rerankSources(
  sources: Array<{
    nodeId: string;
    docId: string;
    score: number;
    hopDistance?: number;
    edgeType?: EdgeType;
    edgeWeight?: number;
    context?: string;
  }>,
  config: Partial<RerankerConfig> = {}
): RankedSource[] {
  const finalConfig = { ...DEFAULT_RERANKER_CONFIG, ...config };
  
  const ranked: RankedSource[] = sources.map(source => {
    const hopDistance = source.hopDistance ?? 0;
    const edgeType = source.edgeType;
    const edgeWeight = source.edgeWeight;
    
    // Calculate components
    const vectorComponent = 1 - source.score; // Convert distance to similarity
    const edgeComponent = calculateEdgeScore(edgeType, edgeWeight, finalConfig);
    const hopComponent = calculateHopScore(hopDistance, finalConfig);
    
    // Combine based on strategy
    let finalScore: number;
    
    switch (finalConfig.strategy) {
      case 'multiplicative':
        finalScore = vectorComponent * edgeComponent * hopComponent;
        break;
      
      case 'additive':
        finalScore = (vectorComponent + edgeComponent + hopComponent) / 3;
        break;
      
      case 'weighted':
        // 50% vector, 30% edge, 20% hop
        finalScore = vectorComponent * 0.5 + edgeComponent * 0.3 + hopComponent * 0.2;
        break;
      
      default:
        finalScore = vectorComponent * edgeComponent * hopComponent;
    }
    
    return {
      nodeId: source.nodeId,
      docId: source.docId,
      originalScore: source.score,
      hopDistance,
      edgeType,
      edgeWeight,
      finalScore,
      scoreBreakdown: {
        vectorComponent,
        edgeComponent,
        hopComponent,
        total: finalScore
      }
    };
  });
  
  // Filter by minimum score
  const filtered = ranked.filter(r => r.finalScore >= finalConfig.minScore);
  
  // Sort by final score (descending)
  filtered.sort((a, b) => b.finalScore - a.finalScore);
  
  return filtered;
}

/**
 * Rerank with diversity (avoid too many from same document)
 */
export function rerankWithDiversity(
  sources: RankedSource[],
  maxPerDocument: number = 3
): RankedSource[] {
  const docCounts = new Map<string, number>();
  const diverse: RankedSource[] = [];
  
  for (const source of sources) {
    const count = docCounts.get(source.docId) || 0;
    
    if (count < maxPerDocument) {
      diverse.push(source);
      docCounts.set(source.docId, count + 1);
    }
  }
  
  return diverse;
}

/**
 * Create a reranker with custom configuration
 */
export function createReranker(config: Partial<RerankerConfig> = {}) {
  const finalConfig = { ...DEFAULT_RERANKER_CONFIG, ...config };
  
  return {
    rerank: (sources: Parameters<typeof rerankSources>[0]) => 
      rerankSources(sources, finalConfig),
    
    rerankWithDiversity: (sources: RankedSource[], maxPerDoc?: number) =>
      rerankWithDiversity(sources, maxPerDoc),
    
    config: finalConfig
  };
}

/**
 * Explain why a source was ranked where it is
 */
export function explainRanking(source: RankedSource): string {
  const parts: string[] = [];
  
  // Vector similarity
  const simPercent = (source.scoreBreakdown.vectorComponent * 100).toFixed(1);
  parts.push(`Vector similarity: ${simPercent}%`);
  
  // Edge contribution
  if (source.edgeType) {
    const edgePercent = (source.scoreBreakdown.edgeComponent * 100).toFixed(1);
    parts.push(`Edge (${source.edgeType}): ${edgePercent}%`);
    
    if (source.edgeType === 'SAME_TOPIC' && source.edgeWeight) {
      parts.push(`  Similarity weight: ${(source.edgeWeight * 100).toFixed(1)}%`);
    }
  } else {
    parts.push('Seed node (direct match)');
  }
  
  // Hop distance
  if (source.hopDistance > 0) {
    const hopPercent = (source.scoreBreakdown.hopComponent * 100).toFixed(1);
    parts.push(`Hop decay (${source.hopDistance} hops): ${hopPercent}%`);
  }
  
  // Final score
  const finalPercent = (source.finalScore * 100).toFixed(1);
  parts.push(`Final score: ${finalPercent}%`);
  
  return parts.join('\n');
}
