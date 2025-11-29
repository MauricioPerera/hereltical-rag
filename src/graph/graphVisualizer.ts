import { getGraphStats, getEdgesByType, type EdgeRow } from '../db/graphStore.js';
import { getSectionMeta } from '../db/vectorStore.js';
import { loadDocument, getAllDocuments } from '../db/jsonStore.js';

/**
 * Node for visualization
 */
export interface VisNode {
  id: string;
  label: string;
  docId: string;
  level: number;
  type: 'document' | 'section';
  title?: string;
  metadata?: {
    is_leaf: boolean;
    path?: string;
  };
}

/**
 * Edge for visualization
 */
export interface VisEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
  metadata?: any;
}

/**
 * Complete graph data for visualization
 */
export interface GraphData {
  nodes: VisNode[];
  edges: VisEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    edgesByType: Record<string, number>;
  };
}

/**
 * Configuration for graph export
 */
export interface GraphExportConfig {
  includeDocuments?: boolean;      // Include document nodes
  includeSections?: boolean;        // Include section nodes
  edgeTypes?: string[];             // Filter by edge types
  maxNodes?: number;                // Limit number of nodes
  docIds?: string[];                // Filter by document IDs
  minDegree?: number;               // Minimum connections per node
}

/**
 * Get all nodes from the database
 */
async function getAllNodes(config: GraphExportConfig): Promise<VisNode[]> {
  const nodes: VisNode[] = [];
  const allDocs = await getAllDocuments();
  
  for (const doc of allDocs) {
    // Filter by doc IDs if specified
    if (config.docIds && !config.docIds.includes(doc.docId)) {
      continue;
    }
    
    // Add document node if enabled
    if (config.includeDocuments !== false) {
      nodes.push({
        id: doc.docId,
        label: doc.title,
        docId: doc.docId,
        level: 0,
        type: 'document',
        title: doc.title
      });
    }
    
    // Add section nodes if enabled
    if (config.includeSections !== false) {
      function extractNodes(node: any, path: string = '') {
        const currentPath = path ? `${path} > ${node.title}` : node.title;
        
        nodes.push({
          id: node.id,
          label: node.title,
          docId: doc.docId,
          level: node.level,
          type: 'section',
          title: node.title,
          metadata: {
            is_leaf: !node.children || node.children.length === 0,
            path: currentPath
          }
        });
        
        // Process children
        for (const child of node.children || []) {
          extractNodes(child, currentPath);
        }
      }
      
      extractNodes(doc.root);
    }
  }
  
  return nodes;
}

/**
 * Get all edges from the database
 */
async function getAllEdges(config: GraphExportConfig): Promise<VisEdge[]> {
  const edges: VisEdge[] = [];
  const edgeTypes = config.edgeTypes || ['SAME_TOPIC', 'REFERS_TO', 'PARENT_OF', 'CHILD_OF'];
  
  for (const type of edgeTypes) {
    const dbEdges = getEdgesByType(type as any);
    
    for (const edge of dbEdges) {
      edges.push({
        source: edge.from_node_id,
        target: edge.to_node_id,
        type: edge.type,
        weight: edge.weight || undefined,
        metadata: edge.metadata ? JSON.parse(edge.metadata as any) : undefined
      });
    }
  }
  
  return edges;
}

/**
 * Filter nodes by minimum degree (connections)
 */
function filterByDegree(
  nodes: VisNode[],
  edges: VisEdge[],
  minDegree: number
): { nodes: VisNode[]; edges: VisEdge[] } {
  // Count degree for each node
  const degree = new Map<string, number>();
  
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  
  // Filter nodes
  const filteredNodes = nodes.filter(node => {
    const nodeDegree = degree.get(node.id) || 0;
    return nodeDegree >= minDegree;
  });
  
  // Filter edges (keep only edges between remaining nodes)
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(edge => 
    nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );
  
  return {
    nodes: filteredNodes,
    edges: filteredEdges
  };
}

/**
 * Export complete graph for visualization
 */
export async function exportGraph(config: GraphExportConfig = {}): Promise<GraphData> {
  console.log('📊 Exporting graph for visualization...');
  
  // Get all nodes and edges
  let nodes = await getAllNodes(config);
  let edges = await getAllEdges(config);
  
  console.log(`   Initial: ${nodes.length} nodes, ${edges.length} edges`);
  
  // Filter by minimum degree if specified
  if (config.minDegree && config.minDegree > 0) {
    const filtered = filterByDegree(nodes, edges, config.minDegree);
    nodes = filtered.nodes;
    edges = filtered.edges;
    console.log(`   After degree filter (min ${config.minDegree}): ${nodes.length} nodes, ${edges.length} edges`);
  }
  
  // Limit nodes if specified
  if (config.maxNodes && nodes.length > config.maxNodes) {
    // Keep nodes with highest degree
    const degree = new Map<string, number>();
    for (const edge of edges) {
      degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    }
    
    nodes = nodes
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
      .slice(0, config.maxNodes);
    
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    
    console.log(`   After max nodes limit: ${nodes.length} nodes, ${edges.length} edges`);
  }
  
  // Calculate statistics
  const edgesByType: Record<string, number> = {};
  for (const edge of edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
  }
  
  console.log('✅ Graph export complete');
  
  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      edgesByType
    }
  };
}

/**
 * Export subgraph around specific nodes
 */
export async function exportSubgraph(
  seedNodeIds: string[],
  maxHops: number = 1,
  maxNodes: number = 50
): Promise<GraphData> {
  console.log(`📊 Exporting subgraph from ${seedNodeIds.length} seeds...`);
  
  const { expandGraph } = await import('../db/graphStore.js');
  
  // Expand from seeds
  const expanded = expandGraph(seedNodeIds, {
    maxHops,
    maxNodes,
    edgeTypes: ['SAME_TOPIC', 'REFERS_TO', 'PARENT_OF', 'CHILD_OF']
  });
  
  // Get unique node IDs
  const nodeIds = new Set(expanded.map(n => n.node_id));
  
  // Get node data
  const nodes: VisNode[] = [];
  for (const nodeId of nodeIds) {
    const [docId] = nodeId.split('#');
    const doc = await loadDocument(docId);
    
    if (!doc) continue;
    
    // Find node in tree
    function findNode(tree: any): any {
      if (tree.id === nodeId) return tree;
      for (const child of tree.children || []) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    }
    
    const node = findNode(doc.root);
    if (!node) continue;
    
    nodes.push({
      id: nodeId,
      label: node.title,
      docId,
      level: node.level,
      type: nodeId.includes('#') ? 'section' : 'document',
      title: node.title,
      metadata: {
        is_leaf: !node.children || node.children.length === 0
      }
    });
  }
  
  // Get edges between these nodes
  const edges: VisEdge[] = [];
  const edgeTypes = ['SAME_TOPIC', 'REFERS_TO', 'PARENT_OF', 'CHILD_OF'];
  
  for (const type of edgeTypes) {
    const dbEdges = getEdgesByType(type as any);
    
    for (const edge of dbEdges) {
      if (nodeIds.has(edge.from_node_id) && nodeIds.has(edge.to_node_id)) {
        edges.push({
          source: edge.from_node_id,
          target: edge.to_node_id,
          type: edge.type,
          weight: edge.weight || undefined
        });
      }
    }
  }
  
  // Statistics
  const edgesByType: Record<string, number> = {};
  for (const edge of edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
  }
  
  console.log(`✅ Subgraph export complete: ${nodes.length} nodes, ${edges.length} edges`);
  
  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      edgesByType
    }
  };
}

/**
 * Export graph in different formats
 */
export async function exportGraphFormat(
  format: 'cytoscape' | 'd3' | 'vis' | 'graphml',
  config: GraphExportConfig = {}
): Promise<any> {
  const graphData = await exportGraph(config);
  
  switch (format) {
    case 'cytoscape':
      return {
        elements: {
          nodes: graphData.nodes.map(n => ({
            data: {
              id: n.id,
              label: n.label,
              docId: n.docId,
              level: n.level,
              type: n.type,
              ...n.metadata
            }
          })),
          edges: graphData.edges.map((e, i) => ({
            data: {
              id: `e${i}`,
              source: e.source,
              target: e.target,
              type: e.type,
              weight: e.weight,
              ...e.metadata
            }
          }))
        }
      };
    
    case 'd3':
      return {
        nodes: graphData.nodes,
        links: graphData.edges.map(e => ({
          source: e.source,
          target: e.target,
          type: e.type,
          weight: e.weight,
          ...e.metadata
        }))
      };
    
    case 'vis':
      return {
        nodes: graphData.nodes.map(n => ({
          id: n.id,
          label: n.label,
          group: n.docId,
          level: n.level,
          title: n.metadata?.path || n.label
        })),
        edges: graphData.edges.map((e, i) => ({
          id: i,
          from: e.source,
          to: e.target,
          label: e.type,
          value: e.weight
        }))
      };
    
    case 'graphml':
      // GraphML XML format
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
      xml += '  <graph id="G" edgedefault="directed">\n';
      
      // Nodes
      for (const node of graphData.nodes) {
        xml += `    <node id="${node.id}">\n`;
        xml += `      <data key="label">${node.label}</data>\n`;
        xml += `      <data key="type">${node.type}</data>\n`;
        xml += `    </node>\n`;
      }
      
      // Edges
      for (let i = 0; i < graphData.edges.length; i++) {
        const edge = graphData.edges[i];
        xml += `    <edge id="e${i}" source="${edge.source}" target="${edge.target}">\n`;
        xml += `      <data key="type">${edge.type}</data>\n`;
        if (edge.weight) {
          xml += `      <data key="weight">${edge.weight}</data>\n`;
        }
        xml += `    </edge>\n`;
      }
      
      xml += '  </graph>\n';
      xml += '</graphml>';
      
      return xml;
    
    default:
      return graphData;
  }
}

