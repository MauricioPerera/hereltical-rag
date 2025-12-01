/**
 * Execution Store - Tracking de ejecuciones de skills
 * 
 * Foundation para Memory & Learning system
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import { getDb } from './unifiedStore.js';

export interface ExecutionRecord {
  id: string;
  skillId: string;
  skillType: string;
  input: Record<string, any>;
  output: any;
  success: boolean;
  executionTime: number;
  timestamp: string;
  error?: string;
}

export interface ExecutionStats {
  total: number;
  bySkill: Record<string, number>;
  byType: Record<string, number>;
  successRate: number;
  averageExecutionTime: number;
}

/**
 * Initialize execution history table
 */
export function initExecutionStore(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_history (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      skill_type TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      success INTEGER NOT NULL,
      execution_time INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      error TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_exec_history_skill 
      ON execution_history(skill_id);
    
    CREATE INDEX IF NOT EXISTS idx_exec_history_timestamp 
      ON execution_history(timestamp DESC);
    
    CREATE INDEX IF NOT EXISTS idx_exec_history_success 
      ON execution_history(success);
  `);
}

/**
 * Generate unique ID for execution
 */
function generateId(): string {
  return `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Log execution record
 */
export function logExecution(record: Omit<ExecutionRecord, 'id'>): string {
  const db = getDb();
  
  // Ensure table exists
  initExecutionStore();
  
  const id = generateId();
  
  const stmt = db.prepare(`
    INSERT INTO execution_history (
      id, skill_id, skill_type, input, output, success, 
      execution_time, timestamp, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    record.skillId,
    record.skillType,
    JSON.stringify(record.input),
    record.output ? JSON.stringify(record.output) : null,
    record.success ? 1 : 0,
    record.executionTime,
    record.timestamp,
    record.error || null
  );
  
  return id;
}

/**
 * Get execution history for a specific skill
 */
export function getExecutionHistory(
  skillId: string,
  limit: number = 10
): ExecutionRecord[] {
  const db = getDb();
  
  // Ensure table exists
  initExecutionStore();
  
  const stmt = db.prepare(`
    SELECT * FROM execution_history
    WHERE skill_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const rows = stmt.all(skillId, limit) as any[];
  
  return rows.map(parseExecutionRecord);
}

/**
 * Get recent executions (all skills)
 */
export function getRecentExecutions(limit: number = 10): ExecutionRecord[] {
  const db = getDb();
  
  // Ensure table exists
  initExecutionStore();
  
  const stmt = db.prepare(`
    SELECT * FROM execution_history
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const rows = stmt.all(limit) as any[];
  
  return rows.map(parseExecutionRecord);
}

/**
 * Get execution statistics
 */
export function getExecutionStats(): ExecutionStats {
  const db = getDb();
  
  // Ensure table exists
  initExecutionStore();
  
  // Total executions
  const totalRow = db.prepare(`
    SELECT COUNT(*) as count FROM execution_history
  `).get() as { count: number };
  
  const total = totalRow.count;
  
  // By skill
  const bySkillRows = db.prepare(`
    SELECT skill_id, COUNT(*) as count
    FROM execution_history
    GROUP BY skill_id
    ORDER BY count DESC
  `).all() as { skill_id: string; count: number }[];
  
  const bySkill: Record<string, number> = {};
  for (const row of bySkillRows) {
    bySkill[row.skill_id] = row.count;
  }
  
  // By type
  const byTypeRows = db.prepare(`
    SELECT skill_type, COUNT(*) as count
    FROM execution_history
    GROUP BY skill_type
  `).all() as { skill_type: string; count: number }[];
  
  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.skill_type] = row.count;
  }
  
  // Success rate
  const successRow = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(success) as successful
    FROM execution_history
  `).get() as { total: number; successful: number };
  
  const successRate = successRow.total > 0 
    ? successRow.successful / successRow.total 
    : 0;
  
  // Average execution time
  const avgTimeRow = db.prepare(`
    SELECT AVG(execution_time) as avg_time
    FROM execution_history
  `).get() as { avg_time: number };
  
  const averageExecutionTime = avgTimeRow.avg_time || 0;
  
  return {
    total,
    bySkill,
    byType,
    successRate,
    averageExecutionTime
  };
}

/**
 * Get top N most used skills
 */
export function getTopSkills(limit: number = 10): Array<{
  skillId: string;
  count: number;
  successRate: number;
  avgTime: number;
}> {
  const db = getDb();
  
  // Ensure table exists
  initExecutionStore();
  
  const stmt = db.prepare(`
    SELECT 
      skill_id,
      COUNT(*) as count,
      CAST(SUM(success) AS FLOAT) / COUNT(*) as success_rate,
      AVG(execution_time) as avg_time
    FROM execution_history
    GROUP BY skill_id
    ORDER BY count DESC
    LIMIT ?
  `);
  
  const rows = stmt.all(limit) as any[];
  
  return rows.map(row => ({
    skillId: row.skill_id,
    count: row.count,
    successRate: row.success_rate,
    avgTime: row.avg_time
  }));
}

/**
 * Delete old execution records (cleanup)
 */
export function cleanupOldExecutions(olderThanDays: number = 30): number {
  const db = getDb();
  
  // Ensure table exists
  initExecutionStore();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  const stmt = db.prepare(`
    DELETE FROM execution_history
    WHERE timestamp < ?
  `);
  
  const result = stmt.run(cutoffDate.toISOString());
  
  return result.changes;
}

/**
 * Parse execution record from DB row
 */
function parseExecutionRecord(row: any): ExecutionRecord {
  return {
    id: row.id,
    skillId: row.skill_id,
    skillType: row.skill_type,
    input: JSON.parse(row.input),
    output: row.output ? JSON.parse(row.output) : null,
    success: row.success === 1,
    executionTime: row.execution_time,
    timestamp: row.timestamp,
    error: row.error || undefined
  };
}

/**
 * Get execution by ID
 */
export function getExecution(id: string): ExecutionRecord | null {
  const db = getDb();
  
  // Ensure table exists
  initExecutionStore();
  
  const stmt = db.prepare(`
    SELECT * FROM execution_history
    WHERE id = ?
  `);
  
  const row = stmt.get(id) as any;
  
  if (!row) return null;
  
  return parseExecutionRecord(row);
}

