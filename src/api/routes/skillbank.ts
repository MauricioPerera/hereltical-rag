/**
 * Skill Bank API Routes
 */

import { Router } from 'express';
import { skillBank } from '../../skills/skillBank.js';
import { toolExecutor } from '../../skills/executor/toolExecutor.js';
import {
  upsertTool,
  upsertSkill,
  getEntity,
  listEntities,
  deleteEntity,
  addEdge,
  getEdgesFrom,
  getEdgesTo,
  getGraphStats
} from '../../skills/store/unifiedStore.js';
import { embed } from '../../embeddings/index.js';
import { Tool, Skill } from '../../skills/types.js';

const router = Router();

// ============================================================================
// DISCOVER - Buscar tools/skills
// ============================================================================

router.post('/discover', async (req, res) => {
  try {
    const {
      query,
      mode = 'all',
      expandGraph = true,
      k = 5,
      categories
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "query" parameter'
      });
    }

    const result = await skillBank.discover({
      query,
      mode,
      expandGraph,
      k,
      categories
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in /discover:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================================
// EXECUTE - Ejecutar tool/skill
// ============================================================================

router.post('/execute', async (req, res) => {
  try {
    const {
      targetId,
      targetType,
      input = {},
      options = {}
    } = req.body;

    if (!targetId || !targetType) {
      return res.status(400).json({
        error: 'Missing required parameters: targetId, targetType'
      });
    }

    if (targetType !== 'tool' && targetType !== 'skill') {
      return res.status(400).json({
        error: 'targetType must be "tool" or "skill"'
      });
    }

    const result = await skillBank.execute({
      targetId,
      targetType,
      input,
      options
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in /execute:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================================
// TOOLS - CRUD
// ============================================================================

router.get('/tools', (req, res) => {
  try {
    const tools = skillBank.listTools();
    res.json({
      tools,
      count: tools.length
    });
  } catch (error: any) {
    console.error('Error in GET /tools:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/tools/:id', (req, res) => {
  try {
    const tool = skillBank.getTool(req.params.id);
    
    if (!tool) {
      return res.status(404).json({
        error: 'Tool not found'
      });
    }
    
    res.json(tool);
  } catch (error: any) {
    console.error('Error in GET /tools/:id:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.post('/tools', async (req, res) => {
  try {
    const toolData = req.body as Tool;
    
    if (!toolData.id || !toolData.name || !toolData.description) {
      return res.status(400).json({
        error: 'Missing required fields: id, name, description'
      });
    }
    
    // Generar embedding
    let embeddingText = `${toolData.name}\n${toolData.description}\n`;
    embeddingText += `Category: ${toolData.category}\n`;
    
    const embedding = await embed(embeddingText);
    
    // Guardar
    upsertTool(toolData, embedding);
    
    res.json({
      success: true,
      tool: toolData
    });
  } catch (error: any) {
    console.error('Error in POST /tools:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.delete('/tools/:id', (req, res) => {
  try {
    deleteEntity(req.params.id);
    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Error in DELETE /tools/:id:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================================
// SKILLS - CRUD
// ============================================================================

router.get('/skills', (req, res) => {
  try {
    const skills = skillBank.listSkills();
    res.json({
      skills,
      count: skills.length
    });
  } catch (error: any) {
    console.error('Error in GET /skills:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/skills/:id', (req, res) => {
  try {
    const skill = skillBank.getSkill(req.params.id);
    
    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found'
      });
    }
    
    res.json(skill);
  } catch (error: any) {
    console.error('Error in GET /skills/:id:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.post('/skills', async (req, res) => {
  try {
    const skillData = req.body as Skill;
    
    if (!skillData.id || !skillData.name || !skillData.overview) {
      return res.status(400).json({
        error: 'Missing required fields: id, name, overview'
      });
    }
    
    // Generar embedding
    let embeddingText = `${skillData.name}\n${skillData.overview}\n\n`;
    embeddingText += 'Instructions:\n';
    embeddingText += skillData.instructions.steps.join('\n');
    
    const embedding = await embed(embeddingText);
    
    // Guardar
    upsertSkill(skillData, embedding);
    
    res.json({
      success: true,
      skill: skillData
    });
  } catch (error: any) {
    console.error('Error in POST /skills:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.delete('/skills/:id', (req, res) => {
  try {
    deleteEntity(req.params.id);
    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Error in DELETE /skills/:id:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================================
// GRAPH - Grafo de relaciones
// ============================================================================

router.get('/graph/stats', (req, res) => {
  try {
    const stats = getGraphStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error in GET /graph/stats:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.post('/graph/link', (req, res) => {
  try {
    const { fromId, toId, type, weight = 1.0, metadata } = req.body;
    
    if (!fromId || !toId || !type) {
      return res.status(400).json({
        error: 'Missing required parameters: fromId, toId, type'
      });
    }
    
    addEdge({
      fromId,
      toId,
      type,
      weight,
      metadata
    });
    
    res.json({
      success: true,
      edge: { fromId, toId, type, weight }
    });
  } catch (error: any) {
    console.error('Error in POST /graph/link:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/graph/edges/from/:id', (req, res) => {
  try {
    const edges = getEdgesFrom(req.params.id);
    res.json({
      entityId: req.params.id,
      edges,
      count: edges.length
    });
  } catch (error: any) {
    console.error('Error in GET /graph/edges/from/:id:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/graph/edges/to/:id', (req, res) => {
  try {
    const edges = getEdgesTo(req.params.id);
    res.json({
      entityId: req.params.id,
      edges,
      count: edges.length
    });
  } catch (error: any) {
    console.error('Error in GET /graph/edges/to/:id:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;

