/**
 * Analytics API Routes - Execution history and stats
 */

import { Router } from 'express';
import {
  getExecutionHistory,
  getRecentExecutions,
  getExecutionStats,
  getTopSkills,
  getExecution,
  cleanupOldExecutions
} from '../../skills/store/executionStore.js';

const router = Router();

// ============================================================================
// EXECUTION HISTORY
// ============================================================================

/**
 * GET /api/skillbank/analytics/executions
 * Get recent executions (optionally filtered by skill)
 */
router.get('/executions', (req, res) => {
  try {
    const { skillId, limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);
    
    const history = skillId
      ? getExecutionHistory(skillId as string, limitNum)
      : getRecentExecutions(limitNum);
    
    res.json({
      executions: history,
      count: history.length
    });
  } catch (error: any) {
    console.error('Error in GET /analytics/executions:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/skillbank/analytics/executions/:id
 * Get specific execution by ID
 */
router.get('/executions/:id', (req, res) => {
  try {
    const execution = getExecution(req.params.id);
    
    if (!execution) {
      return res.status(404).json({
        error: 'Execution not found'
      });
    }
    
    res.json(execution);
  } catch (error: any) {
    console.error('Error in GET /analytics/executions/:id:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * GET /api/skillbank/analytics/stats
 * Get overall execution statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getExecutionStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error in GET /analytics/stats:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/skillbank/analytics/top-skills
 * Get top N most used skills
 */
router.get('/top-skills', (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);
    
    const topSkills = getTopSkills(limitNum);
    
    res.json({
      skills: topSkills,
      count: topSkills.length
    });
  } catch (error: any) {
    console.error('Error in GET /analytics/top-skills:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================================================
// MAINTENANCE
// ============================================================================

/**
 * DELETE /api/skillbank/analytics/cleanup
 * Cleanup old execution records
 */
router.delete('/cleanup', (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);
    
    const deletedCount = cleanupOldExecutions(daysNum);
    
    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} execution records older than ${daysNum} days`
    });
  } catch (error: any) {
    console.error('Error in DELETE /analytics/cleanup:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;

