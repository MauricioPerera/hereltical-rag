import { getVectorDb } from './vectorStore.js';

/**
 * Edge types for the knowledge graph
 */
export type EdgeType = 
  | 'PARENT_OF'      // Hierarchy: parent -> child
  | 'CHILD_OF'       // Hierarchy: child -> parent
  | 'NEXT_SIBLING'   // Navigation: sibling -> next
  | 'PREV_SIBLING'   // Navigation: sibling -> previous
  | 'SAME_TOPIC'     // Semantic: section ~ section (cross-doc)
  | 'REFERS_TO';     // Reference: section -> section

export interface Edge {
  from_node_id: string;
  to_node_id: string;
  type: EdgeType;
  weight?: number;      // For similarity scores
  metadata?: any;       // Additional data (stored as JSON)
}

export interface EdgeRow extends Edge {
  created_at: string;
}

/**
 * Create or update an edge in the graph
 */
export function upsertEdge(edge: Edge): void {
  const db = getVectorDb();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO edges (from_node_id, to_node_id, type, weight, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const metadataJson = edge.metadata ? JSON.stringify(edge.metadata) : null;
  
  stmt.run(
    edge.from_node_id,
    edge.to_node_id,
    edge.type,
    edge.weight ?? null,
    metadataJson
  );
}

/**
 * Create multiple edges in a transaction
 */
export function upsertEdges(edges: Edge[]): void {
  const db = getVectorDb();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO edges (from_node_id, to_node_id, type, weight, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction(() => {
    for (const edge of edges) {
      const metadataJson = edge.metadata ? JSON.stringify(edge.metadata) : null;
      stmt.run(
        edge.from_node_id,
        edge.to_node_id,
        edge.type,
        edge.weight ?? null,
        metadataJson
      );
    }
  });
  
  transaction();
}

/**
 * Get outgoing edges from a node
 */
export function getOutgoingEdges(nodeId: string, type?: EdgeType): EdgeRow[] {
  const db = getVectorDb();
  
  let query = 'SELECT * FROM edges WHERE from_node_id = ?';
  const params: any[] = [nodeId];
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  const rows = db.prepare(query).all(...params) as any[];
  
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }));
}

/**
 * Get incoming edges to a node
 */
export function getIncomingEdges(nodeId: string, type?: EdgeType): EdgeRow[] {
  const db = getVectorDb();
  
  let query = 'SELECT * FROM edges WHERE to_node_id = ?';
  const params: any[] = [nodeId];
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  const rows = db.prepare(query).all(...params) as any[];
  
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }));
}

/**
 * Get all edges of a specific type
 */
export function getEdgesByType(type: EdgeType): EdgeRow[] {
  const db = getVectorDb();
  
  const rows = db.prepare('SELECT * FROM edges WHERE type = ?').all(type) as any[];
  
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }));
}

/**
 * Delete an edge
 */
export function deleteEdge(fromNodeId: string, toNodeId: string, type: EdgeType): void {
  const db = getVectorDb();
  
  db.prepare(`
    DELETE FROM edges 
    WHERE from_node_id = ? AND to_node_id = ? AND type = ?
  `).run(fromNodeId, toNodeId, type);
}

/**
 * Delete all edges related to a node
 */
export function deleteNodeEdges(nodeId: string): void {
  const db = getVectorDb();
  
  db.prepare('DELETE FROM edges WHERE from_node_id = ? OR to_node_id = ?')
    .run(nodeId, nodeId);
}

/**
 * Get neighbors of a node (nodes connected by edges)
 */
export interface Neighbor {
  node_id: string;
  edge_type: EdgeType;
  weight?: number;
  direction: 'outgoing' | 'incoming';
}

export function getNeighbors(nodeId: string, types?: EdgeType[]): Neighbor[] {
  const neighbors: Neighbor[] = [];
  
  // Outgoing edges
  const outgoing = types 
    ? types.flatMap(t => getOutgoingEdges(nodeId, t))
    : getOutgoingEdges(nodeId);
  
  for (const edge of outgoing) {
    neighbors.push({
      node_id: edge.to_node_id,
      edge_type: edge.type,
      weight: edge.weight,
      direction: 'outgoing'
    });
  }
  
  // Incoming edges
  const incoming = types
    ? types.flatMap(t => getIncomingEdges(nodeId, t))
    : getIncomingEdges(nodeId);
  
  for (const edge of incoming) {
    neighbors.push({
      node_id: edge.from_node_id,
      edge_type: edge.type,
      weight: edge.weight,
      direction: 'incoming'
    });
  }
  
  return neighbors;
}

/**
 * Expand from a set of seed nodes in the graph
 */
export interface GraphExpansionConfig {
  maxHops: number;              // Maximum number of hops (1-3)
  maxNodes: number;             // Maximum nodes to retrieve
  edgeTypes: EdgeType[];        // Types of edges to follow
  minWeight?: number;           // Minimum edge weight (for SAME_TOPIC, etc.)
}

export interface ExpandedNode {
  node_id: string;
  hop: number;                  // Distance from seed (0 = seed)
  edge_type?: EdgeType;         // How we reached this node
  weight?: number;              // Edge weight used to reach this node
  path: string[];              // Path of node_ids from seed to this node
}

export function expandGraph(
  seedNodeIds: string[], 
  config: GraphExpansionConfig
): ExpandedNode[] {
  const visited = new Set<string>();
  const result: ExpandedNode[] = [];
  
  // Add seeds
  for (const seedId of seedNodeIds) {
    result.push({
      node_id: seedId,
      hop: 0,
      path: [seedId]
    });
    visited.add(seedId);
  }
  
  // BFS expansion
  let currentHop = 0;
  let currentLevel = [...seedNodeIds];
  
  while (currentHop < config.maxHops && result.length < config.maxNodes) {
    const nextLevel: ExpandedNode[] = [];
    
    for (const nodeId of currentLevel) {
      const neighbors = getNeighbors(nodeId, config.edgeTypes);
      
      for (const neighbor of neighbors) {
        // Skip if already visited
        if (visited.has(neighbor.node_id)) continue;
        
        // Skip if weight too low
        if (config.minWeight && neighbor.weight && neighbor.weight < config.minWeight) {
          continue;
        }
        
        // Add to results
        const seedPath = result.find(n => n.node_id === nodeId)?.path || [nodeId];
        const expandedNode: ExpandedNode = {
          node_id: neighbor.node_id,
          hop: currentHop + 1,
          edge_type: neighbor.edge_type,
          weight: neighbor.weight,
          path: [...seedPath, neighbor.node_id]
        };
        
        result.push(expandedNode);
        nextLevel.push(expandedNode);
        visited.add(neighbor.node_id);
        
        // Stop if max nodes reached
        if (result.length >= config.maxNodes) break;
      }
      
      if (result.length >= config.maxNodes) break;
    }
    
    currentLevel = nextLevel.map(n => n.node_id);
    currentHop++;
  }
  
  return result;
}

/**
 * Get graph statistics
 */
export interface GraphStats {
  totalEdges: number;
  edgesByType: Record<EdgeType, number>;
  totalNodes: number;      // Nodes with at least one edge
  avgDegree: number;       // Average connections per node
}

export function getGraphStats(): GraphStats {
  const db = getVectorDb();
  
  // Total edges
  const totalEdges = (db.prepare('SELECT COUNT(*) as count FROM edges').get() as any).count;
  
  // Edges by type
  const edgesByType: Record<string, number> = {};
  const typeRows = db.prepare('SELECT type, COUNT(*) as count FROM edges GROUP BY type').all() as any[];
  
  for (const row of typeRows) {
    edgesByType[row.type] = row.count;
  }
  
  // Total nodes with edges
  const totalNodes = (db.prepare(`
    SELECT COUNT(DISTINCT node_id) as count FROM (
      SELECT from_node_id as node_id FROM edges
      UNION
      SELECT to_node_id as node_id FROM edges
    )
  `).get() as any).count;
  
  // Average degree
  const avgDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;
  
  return {
    totalEdges,
    edgesByType: edgesByType as Record<EdgeType, number>,
    totalNodes,
    avgDegree: Math.round(avgDegree * 100) / 100
  };
}

