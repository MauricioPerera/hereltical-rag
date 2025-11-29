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

export default router;

