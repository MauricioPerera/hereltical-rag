import { getVectorDb, getSectionMeta } from '../db/vectorStore.js';
import { upsertEdges, type Edge } from '../db/graphStore.js';

/**
 * Configuration for SAME_TOPIC edge detection
 */
export interface SameTopicConfig {
  minSimilarity: number;      // Minimum cosine similarity (0.7-0.9)
  maxConnections: number;     // Max connections per node (to avoid dense graph)
  crossDocOnly: boolean;      // Only create edges between different documents
  titleSimilarity: boolean;   // Consider title similarity as well
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

/**
 * Get embedding vector for a node
 */
function getEmbedding(nodeId: string): number[] | null {
  const db = getVectorDb();
  
  try {
    // Get rowid for the node
    const section = db.prepare('SELECT rowid FROM sections WHERE node_id = ?').get(nodeId) as any;
    
    if (!section) return null;
    
    // Get embedding from vec_sections
    const vec = db.prepare('SELECT embedding FROM vec_sections WHERE rowid = ?').get(section.rowid) as any;
    
    if (!vec || !vec.embedding) return null;
    
    // Convert Buffer to Float32Array to regular array
    const float32 = new Float32Array(vec.embedding.buffer);
    return Array.from(float32);
  } catch (error) {
    console.error(`Error getting embedding for ${nodeId}:`, error);
    return null;
  }
}

/**
 * Calculate title similarity (simple Jaccard similarity on words)
 */
function titleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/));
  const words2 = new Set(title2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  
  return intersection.size / union.size;
}

/**
 * Get all sections with their embeddings
 */
interface SectionWithEmbedding {
  node_id: string;
  doc_id: string;
  title: string;
  embedding: number[];
}

function getAllSectionsWithEmbeddings(): SectionWithEmbedding[] {
  const db = getVectorDb();
  
  // Get all sections
  const sections = db.prepare(`
    SELECT node_id, doc_id, title 
    FROM sections 
    ORDER BY doc_id, node_id
  `).all() as any[];
  
  const result: SectionWithEmbedding[] = [];
  
  for (const section of sections) {
    const embedding = getEmbedding(section.node_id);
    
    if (embedding && embedding.length > 0) {
      result.push({
        node_id: section.node_id,
        doc_id: section.doc_id,
        title: section.title || '',
        embedding
      });
    }
  }
  
  return result;
}

/**
 * Limit connections per node (keep only top K by weight)
 */
function limitConnectionsPerNode(edges: Edge[], maxPerNode: number): Edge[] {
  // Group edges by from_node_id
  const byNode = new Map<string, Edge[]>();
  
  for (const edge of edges) {
    if (!byNode.has(edge.from_node_id)) {
      byNode.set(edge.from_node_id, []);
    }
    byNode.get(edge.from_node_id)!.push(edge);
  }
  
  // For each node, keep only top K by weight
  const limited: Edge[] = [];
  
  for (const [nodeId, nodeEdges] of byNode.entries()) {
    // Sort by weight descending
    const sorted = nodeEdges.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    
    // Keep top K
    limited.push(...sorted.slice(0, maxPerNode));
  }
  
  return limited;
}

/**
 * Detect SAME_TOPIC edges between sections based on embedding similarity
 */
export async function detectSameTopicEdges(config: SameTopicConfig): Promise<Edge[]> {
  console.log('🔍 Detecting SAME_TOPIC edges...');
  console.log(`   Min similarity: ${config.minSimilarity}`);
  console.log(`   Max connections per node: ${config.maxConnections}`);
  console.log(`   Cross-doc only: ${config.crossDocOnly}`);
  
  const sections = getAllSectionsWithEmbeddings();
  console.log(`   Found ${sections.length} sections with embeddings`);
  
  const edges: Edge[] = [];
  let comparisons = 0;
  
  // Compare each pair of sections
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const s1 = sections[i];
      const s2 = sections[j];
      
      // Skip if same document and config.crossDocOnly
      if (config.crossDocOnly && s1.doc_id === s2.doc_id) {
        continue;
      }
      
      comparisons++;
      
      // Calculate embedding similarity
      const embeddingSim = cosineSimilarity(s1.embedding, s2.embedding);
      
      // Optionally boost with title similarity
      let finalSimilarity = embeddingSim;
      if (config.titleSimilarity && s1.title && s2.title) {
        const titleSim = titleSimilarity(s1.title, s2.title);
        // Weighted average: 80% embedding, 20% title
        finalSimilarity = embeddingSim * 0.8 + titleSim * 0.2;
      }
      
      // If similarity exceeds threshold, create bidirectional edges
      if (finalSimilarity >= config.minSimilarity) {
        edges.push({
          from_node_id: s1.node_id,
          to_node_id: s2.node_id,
          type: 'SAME_TOPIC',
          weight: Math.round(finalSimilarity * 1000) / 1000,
          metadata: {
            embeddingSimilarity: Math.round(embeddingSim * 1000) / 1000,
            titleSimilarity: config.titleSimilarity ? Math.round(titleSimilarity(s1.title, s2.title) * 1000) / 1000 : undefined
          }
        });
        
        edges.push({
          from_node_id: s2.node_id,
          to_node_id: s1.node_id,
          type: 'SAME_TOPIC',
          weight: Math.round(finalSimilarity * 1000) / 1000,
          metadata: {
            embeddingSimilarity: Math.round(embeddingSim * 1000) / 1000,
            titleSimilarity: config.titleSimilarity ? Math.round(titleSimilarity(s1.title, s2.title) * 1000) / 1000 : undefined
          }
        });
      }
    }
  }
  
  console.log(`   Performed ${comparisons} comparisons`);
  console.log(`   Found ${edges.length / 2} similar pairs (${edges.length} directed edges)`);
  
  // Limit connections per node
  const limited = limitConnectionsPerNode(edges, config.maxConnections);
  console.log(`   After limiting: ${limited.length} edges`);
  
  return limited;
}

/**
 * Build SAME_TOPIC edges and save to database
 */
export async function buildSameTopicGraph(config?: Partial<SameTopicConfig>): Promise<number> {
  const defaultConfig: SameTopicConfig = {
    minSimilarity: 0.80,
    maxConnections: 5,
    crossDocOnly: true,
    titleSimilarity: false
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  
  const edges = await detectSameTopicEdges(finalConfig);
  
  if (edges.length > 0) {
    console.log(`💾 Saving ${edges.length} SAME_TOPIC edges to database...`);
    upsertEdges(edges);
    console.log('✅ SAME_TOPIC edges saved');
  } else {
    console.log('ℹ️  No SAME_TOPIC edges found with current config');
  }
  
  return edges.length;
}

/**
 * Detect hierarchical edges from document structure
 * (These should already exist implicitly, but we can make them explicit)
 */
export async function buildHierarchicalEdges(): Promise<number> {
  console.log('🔍 Building hierarchical edges from document structure...');
  
  const db = getVectorDb();
  
  // Get all documents
  const docs = db.prepare('SELECT DISTINCT doc_id FROM sections').all() as any[];
  
  let totalEdges = 0;
  
  for (const { doc_id } of docs) {
    // This would require reading the document structure from lowdb
    // For now, we skip this as the hierarchy is already in the JSON
    // In a full implementation, we'd read from lowdb and create explicit edges
    console.log(`   Skipping ${doc_id} (hierarchy already in JSON)`);
  }
  
  console.log(`✅ Hierarchical edges: ${totalEdges} (using implicit JSON structure)`);
  
  return totalEdges;
}

