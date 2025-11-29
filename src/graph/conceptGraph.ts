/**
 * Concept Graph Builder
 * 
 * Creates MENTIONS and DEFINES edges between sections and concepts.
 * This enriches the knowledge graph with semantic relationships.
 */

import { extractEntities, extractConceptsFromTexts, type Entity, type EntityType } from './entityExtractor.js';
import { upsertEdges, getGraphStats, type Edge, type EdgeType } from '../db/graphStore.js';
import { loadDocument } from '../db/jsonStore.js';
import { getSectionMeta, type SectionRow } from '../db/vectorStore.js';

export interface ConceptNode {
  id: string;           // Normalized concept name as ID
  name: string;         // Display name
  type: EntityType;
  frequency: number;    // Total mentions
  documents: string[];  // Documents where it appears
  sections: string[];   // Sections where it appears
}

export interface ConceptEdge {
  from: string;         // Section node_id or concept_id
  to: string;           // Concept_id or section node_id
  type: 'MENTIONS' | 'DEFINES' | 'RELATED_TO';
  weight: number;
  metadata?: {
    frequency?: number;
    confidence?: number;
    context?: string;
  };
}

export interface ConceptGraphResult {
  concepts: ConceptNode[];
  edges: ConceptEdge[];
  stats: {
    totalConcepts: number;
    totalMentions: number;
    totalDefines: number;
    topConcepts: Array<{ name: string; mentions: number }>;
  };
}

/**
 * Build concept graph for a document
 */
export async function buildConceptGraph(docId: string): Promise<ConceptGraphResult> {
  const doc = await loadDocument(docId);
  if (!doc) {
    throw new Error(`Document not found: ${docId}`);
  }
  
  const conceptMap = new Map<string, ConceptNode>();
  const edges: ConceptEdge[] = [];
  let totalMentions = 0;
  let totalDefines = 0;
  
  // Process all sections in the document
  const sections = collectSections(doc.root);
  
  for (const section of sections) {
    const text = [section.title, ...(section.content || [])].join(' ');
    const result = extractEntities(text);
    
    for (const entity of result.entities) {
      // Create or update concept node
      const conceptId = `concept:${entity.normalized}`;
      let concept = conceptMap.get(conceptId);
      
      if (!concept) {
        concept = {
          id: conceptId,
          name: entity.text,
          type: entity.type,
          frequency: 0,
          documents: [],
          sections: []
        };
        conceptMap.set(conceptId, concept);
      }
      
      concept.frequency += entity.frequency;
      if (!concept.documents.includes(docId)) {
        concept.documents.push(docId);
      }
      if (!concept.sections.includes(section.id)) {
        concept.sections.push(section.id);
      }
      
      // Determine edge type: DEFINES if in title, MENTIONS if in content
      const isInTitle = section.title.toLowerCase().includes(entity.normalized);
      const edgeType: 'MENTIONS' | 'DEFINES' = isInTitle ? 'DEFINES' : 'MENTIONS';
      
      if (edgeType === 'DEFINES') {
        totalDefines++;
      } else {
        totalMentions++;
      }
      
      edges.push({
        from: section.id,
        to: conceptId,
        type: edgeType,
        weight: entity.confidence,
        metadata: {
          frequency: entity.frequency,
          confidence: entity.confidence
        }
      });
    }
  }
  
  // Add RELATED_TO edges between concepts that co-occur in sections
  const conceptsArray = Array.from(conceptMap.values());
  for (let i = 0; i < conceptsArray.length; i++) {
    for (let j = i + 1; j < conceptsArray.length; j++) {
      const c1 = conceptsArray[i];
      const c2 = conceptsArray[j];
      
      // Find common sections
      const commonSections = c1.sections.filter(s => c2.sections.includes(s));
      
      if (commonSections.length > 0) {
        // Weight based on co-occurrence
        const weight = Math.min(1, commonSections.length * 0.2);
        
        edges.push({
          from: c1.id,
          to: c2.id,
          type: 'RELATED_TO',
          weight,
          metadata: {
            frequency: commonSections.length
          }
        });
      }
    }
  }
  
  // Build stats
  const topConcepts = conceptsArray
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)
    .map(c => ({ name: c.name, mentions: c.frequency }));
  
  return {
    concepts: conceptsArray,
    edges,
    stats: {
      totalConcepts: conceptsArray.length,
      totalMentions,
      totalDefines,
      topConcepts
    }
  };
}

/**
 * Build and persist concept edges to the graph store
 */
export async function persistConceptGraph(docId: string): Promise<{
  conceptsCreated: number;
  edgesCreated: number;
}> {
  const result = await buildConceptGraph(docId);
  
  // Convert to graph store edges
  const graphEdges: Edge[] = result.edges.map(e => ({
    from_node_id: e.from,
    to_node_id: e.to,
    type: e.type as EdgeType,
    weight: e.weight,
    metadata: e.metadata ? JSON.stringify(e.metadata) : undefined
  }));
  
  // Persist to graph store
  upsertEdges(graphEdges);
  
  return {
    conceptsCreated: result.concepts.length,
    edgesCreated: result.edges.length
  };
}

/**
 * Build concept graph for all documents
 */
export async function buildConceptGraphForAll(docIds: string[]): Promise<{
  totalConcepts: number;
  totalEdges: number;
  byDocument: Array<{ docId: string; concepts: number; edges: number }>;
}> {
  const byDocument: Array<{ docId: string; concepts: number; edges: number }> = [];
  let totalConcepts = 0;
  let totalEdges = 0;
  
  for (const docId of docIds) {
    try {
      const result = await persistConceptGraph(docId);
      byDocument.push({
        docId,
        concepts: result.conceptsCreated,
        edges: result.edgesCreated
      });
      totalConcepts += result.conceptsCreated;
      totalEdges += result.edgesCreated;
    } catch (error) {
      console.error(`Error processing ${docId}:`, error);
    }
  }
  
  return { totalConcepts, totalEdges, byDocument };
}

/**
 * Find sections that define a concept
 */
export function findDefinitions(conceptName: string): string[] {
  // This would query the graph store for DEFINES edges
  // For now, return empty (would need graph query)
  return [];
}

/**
 * Find related concepts based on co-occurrence
 */
export function findRelatedConcepts(conceptName: string, limit: number = 10): ConceptNode[] {
  // This would query the graph store for RELATED_TO edges
  // For now, return empty (would need graph query)
  return [];
}

// Helper to collect all sections from document tree
function collectSections(node: any): Array<{
  id: string;
  title: string;
  content: string[];
  level: number;
}> {
  const sections: Array<{
    id: string;
    title: string;
    content: string[];
    level: number;
  }> = [];
  
  sections.push({
    id: node.id,
    title: node.title || '',
    content: node.content || [],
    level: node.level || 0
  });
  
  if (node.children) {
    for (const child of node.children) {
      sections.push(...collectSections(child));
    }
  }
  
  return sections;
}

/**
 * Get concept statistics for a document
 */
export async function getConceptStats(docId: string): Promise<{
  concepts: Array<{
    name: string;
    type: EntityType;
    frequency: number;
    defines: boolean;
  }>;
  summary: {
    technologies: number;
    concepts: number;
    codeRefs: number;
    acronyms: number;
  };
}> {
  const doc = await loadDocument(docId);
  if (!doc) {
    throw new Error(`Document not found: ${docId}`);
  }
  
  const sections = collectSections(doc.root);
  const allTexts = sections.map(s => [s.title, ...(s.content || [])].join(' '));
  const result = extractConceptsFromTexts(allTexts);
  
  const concepts = result.entities.map(e => ({
    name: e.text,
    type: e.type,
    frequency: e.frequency,
    defines: false // Would need to check titles
  }));
  
  return {
    concepts,
    summary: {
      technologies: result.stats.byType.TECHNOLOGY,
      concepts: result.stats.byType.CONCEPT,
      codeRefs: result.stats.byType.CODE_REFERENCE,
      acronyms: result.stats.byType.ACRONYM
    }
  };
}

