/**
 * RAG Integration for Context-Aware Skills
 * 
 * Provides integration between Skill Bank and the RAG engine
 */

import { queryRAG } from '../../ragEngine.js';
import type { SearchFilters } from '../types.js';

export interface RAGIntegrationConfig {
  queryFilters?: SearchFilters;
  contextExtraction?: string;
}

export interface RAGQueryResult {
  answer: string;
  sources: Array<{
    nodeId: string;
    docId: string;
    score: number;
    context: string;
    title?: string;
    level?: number;
  }>;
}

/**
 * Query RAG using skill's configuration
 */
export async function queryRAGWithSkillConfig(
  query: string,
  config: RAGIntegrationConfig
): Promise<RAGQueryResult> {
  const filters = config.queryFilters || {};
  
  // Build filter object for RAG query
  const ragFilters: any = {};
  
  if (filters.doc_id) {
    if (Array.isArray(filters.doc_id)) {
      ragFilters.doc_id = filters.doc_id;
    } else {
      ragFilters.doc_id = [filters.doc_id];
    }
  }
  
  if (filters.level !== undefined) {
    if (Array.isArray(filters.level)) {
      ragFilters.level = filters.level;
    } else {
      ragFilters.level = [filters.level];
    }
  }
  
  if (filters.is_leaf !== undefined) {
    ragFilters.is_leaf = filters.is_leaf;
  }
  
  // Query RAG engine
  const result = await queryRAG(query, {
    k: 5,
    filters: ragFilters,
    useGraph: true,
    maxHops: 1
  });
  
  return {
    answer: result.answer,
    sources: result.sources.map(source => ({
      nodeId: source.nodeId,
      docId: source.docId,
      score: source.score,
      context: source.context,
      title: extractTitleFromContext(source.context),
      level: extractLevelFromMetadata(source)
    }))
  };
}

/**
 * Extract title from context string
 */
function extractTitleFromContext(context: string): string {
  const lines = context.split('\n');
  for (const line of lines) {
    if (line.startsWith('##')) {
      return line.replace(/^##\s*/, '').trim();
    }
  }
  return 'Section';
}

/**
 * Extract level from source metadata
 */
function extractLevelFromMetadata(source: any): number | undefined {
  // Try to extract from metadata if available
  return source.level;
}

