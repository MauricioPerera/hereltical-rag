import { Router } from 'express';
import { 
  getGraphStats, 
  getNeighbors, 
  getOutgoingEdges, 
  getIncomingEdges,
  expandGraph,
  type EdgeType,
  type GraphExpansionConfig
} from '../../db/graphStore.js';
import { buildSameTopicGraph, type SameTopicConfig } from '../../graph/relationsDetector.js';
import { detectLinksInAllDocuments, getLinkStatistics, type LinkDetectionConfig } from '../../graph/linkDetector.js';
import { exportGraph, exportSubgraph, exportGraphFormat, type GraphExportConfig } from '../../graph/graphVisualizer.js';
import { extractEntities } from '../../graph/entityExtractor.js';
import { buildConceptGraph, persistConceptGraph, getConceptStats } from '../../graph/conceptGraph.js';

const router = Router();

/**
 * GET /api/graph/stats
 * Get graph statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getGraphStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/graph/neighbors/:nodeId
 * Get neighbors of a node
 */
router.get('/neighbors/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const { types } = req.query;
    
    let edgeTypes: EdgeType[] | undefined;
    if (types && typeof types === 'string') {
      edgeTypes = types.split(',') as EdgeType[];
    }
    
    const neighbors = getNeighbors(nodeId, edgeTypes);
    
    res.json({
      node_id: nodeId,
      neighbors,
      count: neighbors.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/graph/edges/:nodeId
 * Get edges for a node
 */
router.get('/edges/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const { direction, type } = req.query;
    
    const edgeType = type as EdgeType | undefined;
    
    let edges;
    if (direction === 'incoming') {
      edges = getIncomingEdges(nodeId, edgeType);
    } else if (direction === 'outgoing') {
      edges = getOutgoingEdges(nodeId, edgeType);
    } else {
      edges = {
        outgoing: getOutgoingEdges(nodeId, edgeType),
        incoming: getIncomingEdges(nodeId, edgeType)
      };
    }
    
    res.json({
      node_id: nodeId,
      edges
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/graph/expand
 * Expand from seed nodes in the graph
 */
router.post('/expand', (req, res) => {
  try {
    const { seeds, config } = req.body;
    
    if (!seeds || !Array.isArray(seeds)) {
      return res.status(400).json({ error: 'seeds must be an array of node IDs' });
    }
    
    const expansionConfig: GraphExpansionConfig = {
      maxHops: config?.maxHops || 1,
      maxNodes: config?.maxNodes || 20,
      edgeTypes: config?.edgeTypes || ['PARENT_OF', 'CHILD_OF', 'SAME_TOPIC'],
      minWeight: config?.minWeight
    };
    
    const expanded = expandGraph(seeds, expansionConfig);
    
    res.json({
      seeds,
      config: expansionConfig,
      nodes: expanded,
      count: expanded.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/graph/build/same-topic
 * Build SAME_TOPIC edges based on embedding similarity
 */
router.post('/build/same-topic', async (req, res) => {
  try {
    const config: Partial<SameTopicConfig> = req.body;
    
    const edgeCount = await buildSameTopicGraph(config);
    
    res.json({
      message: 'SAME_TOPIC edges built successfully',
      edgeCount,
      config: {
        minSimilarity: config.minSimilarity || 0.80,
        maxConnections: config.maxConnections || 5,
        crossDocOnly: config.crossDocOnly !== undefined ? config.crossDocOnly : true,
        titleSimilarity: config.titleSimilarity || false
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/graph/build/refers-to
 * Build REFERS_TO edges from markdown links
 */
router.post('/build/refers-to', async (req, res) => {
  try {
    const config: Partial<LinkDetectionConfig> = req.body;
    
    const edgeCount = await detectLinksInAllDocuments(config);
    
    res.json({
      message: 'REFERS_TO edges built successfully',
      edgeCount,
      config: {
        detectMarkdownLinks: config.detectMarkdownLinks !== false,
        detectWikiLinks: config.detectWikiLinks !== false,
        crossDocumentOnly: config.crossDocumentOnly || false,
        createBidirectional: config.createBidirectional || false
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/graph/link-stats
 * Get statistics about markdown links in documents
 */
router.get('/link-stats', async (req, res) => {
  try {
    const stats = await getLinkStatistics();
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/graph/export
 * Export complete graph for visualization
 * 
 * Query parameters:
 * - format: cytoscape | d3 | vis | graphml (default: d3)
 * - includeDocuments: true | false (default: true)
 * - includeSections: true | false (default: true)
 * - edgeTypes: comma-separated list (default: all)
 * - maxNodes: number (default: unlimited)
 * - docIds: comma-separated list of doc IDs
 * - minDegree: minimum connections per node
 */
router.get('/export', async (req, res) => {
  try {
    const {
      format = 'd3',
      includeDocuments,
      includeSections,
      edgeTypes,
      maxNodes,
      docIds,
      minDegree
    } = req.query;
    
    const config: GraphExportConfig = {};
    
    if (includeDocuments !== undefined) {
      config.includeDocuments = includeDocuments === 'true';
    }
    
    if (includeSections !== undefined) {
      config.includeSections = includeSections === 'true';
    }
    
    if (edgeTypes && typeof edgeTypes === 'string') {
      config.edgeTypes = edgeTypes.split(',');
    }
    
    if (maxNodes && typeof maxNodes === 'string') {
      config.maxNodes = parseInt(maxNodes, 10);
    }
    
    if (docIds && typeof docIds === 'string') {
      config.docIds = docIds.split(',');
    }
    
    if (minDegree && typeof minDegree === 'string') {
      config.minDegree = parseInt(minDegree, 10);
    }
    
    const graphData = await exportGraphFormat(format as any, config);
    
    // Set content type based on format
    if (format === 'graphml') {
      res.type('application/xml');
    } else {
      res.type('application/json');
    }
    
    res.send(graphData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/graph/subgraph
 * Export subgraph around specific nodes
 * 
 * Body:
 * {
 *   "seeds": ["node-id-1", "node-id-2"],
 *   "maxHops": 2,
 *   "maxNodes": 50,
 *   "format": "d3"
 * }
 */
router.post('/subgraph', async (req, res) => {
  try {
    const {
      seeds,
      maxHops = 1,
      maxNodes = 50,
      format = 'd3'
    } = req.body;
    
    if (!seeds || !Array.isArray(seeds) || seeds.length === 0) {
      return res.status(400).json({
        error: 'seeds is required and must be a non-empty array'
      });
    }
    
    const subgraph = await exportSubgraph(seeds, maxHops, maxNodes);
    
    // Format if requested
    if (format === 'd3') {
      res.json(subgraph);
    } else {
      // Convert to requested format
      const formatted = await exportGraphFormat(format, {
        // Filter nodes/edges from subgraph
      });
      res.json(formatted);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/graph/extract-entities
 * Extract entities from text (NER)
 */
router.post('/extract-entities', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    
    const result = extractEntities(text);
    
    res.json({
      entities: result.entities,
      concepts: result.concepts,
      technologies: result.technologies,
      stats: result.stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/graph/concepts/:docId
 * Get concept statistics for a document
 */
router.get('/concepts/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const stats = await getConceptStats(docId);
    
    res.json({
      docId,
      ...stats
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/graph/build/concepts
 * Build and persist concept graph for a document
 */
router.post('/build/concepts', async (req, res) => {
  try {
    const { docId } = req.body;
    
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' });
    }
    
    console.log(`🧠 Building concept graph for ${docId}...`);
    const result = await persistConceptGraph(docId);
    console.log(`   Created ${result.conceptsCreated} concepts, ${result.edgesCreated} edges`);
    
    res.json({
      success: true,
      docId,
      ...result
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/graph/build/concepts-all
 * Build concept graph for all specified documents
 */
router.post('/build/concepts-all', async (req, res) => {
  try {
    const { docIds } = req.body;
    
    if (!docIds || !Array.isArray(docIds)) {
      return res.status(400).json({ error: 'docIds array is required' });
    }
    
    console.log(`🧠 Building concept graph for ${docIds.length} documents...`);
    
    const results = [];
    let totalConcepts = 0;
    let totalEdges = 0;
    
    for (const docId of docIds) {
      try {
        const result = await persistConceptGraph(docId);
        results.push({ docId, ...result, success: true });
        totalConcepts += result.conceptsCreated;
        totalEdges += result.edgesCreated;
      } catch (error: any) {
        results.push({ docId, success: false, error: error.message });
      }
    }
    
    console.log(`   Total: ${totalConcepts} concepts, ${totalEdges} edges`);
    
    res.json({
      success: true,
      totalConcepts,
      totalEdges,
      results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

