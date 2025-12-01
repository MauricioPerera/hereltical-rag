/**
 * Skill Bank - Meta-Tool Unificada
 * 
 * Interface principal para que agentes descubran y ejecuten tools/skills
 */

import { embed } from '../embeddings/index.js';
import {
  DiscoverParams,
  DiscoveryResult,
  ExecuteParams,
  ExecutionResult,
  DiscoveredTool,
  DiscoveredSkill,
  Tool,
  Skill,
  SuggestedFlow
} from './types.js';
import {
  searchEntities,
  getTool,
  getSkill,
  listEntities
} from './store/unifiedStore.js';
import { expandGraph, suggestWorkflow } from './store/graphIndex.js';
import { toolExecutor } from './executor/toolExecutor.js';
import { skillExecutor } from './executor/skillExecutor.js';

/**
 * Skill Bank - La unica tool que necesita un agente
 */
export class SkillBank {
  /**
   * DISCOVER - Buscar tools y skills relevantes para una situacion
   */
  async discover(params: DiscoverParams): Promise<DiscoveryResult> {
    const {
      query,
      mode = 'all',
      expandGraph: shouldExpandGraph = true,
      k = 5,
      categories
    } = params;

    // Generar embedding de la query
    const queryEmbedding = await embed(query);

    // Busqueda vectorial
    const filters: any = {};
    if (mode !== 'all') {
      filters.type = mode === 'tools' ? 'tool' : 'skill';
    }
    if (categories && categories.length > 0) {
      filters.category = categories[0]; // Por ahora solo soportamos una categoria
    }

    const vectorResults = searchEntities(queryEmbedding, k, filters);

    // Separar resultados por tipo
    const toolResults = vectorResults.filter(r => r.type === 'tool');
    const skillResults = vectorResults.filter(r => r.type === 'skill');

    // Convertir a DiscoveredTool/DiscoveredSkill
    const discoveredTools: DiscoveredTool[] = [];
    const discoveredSkills: DiscoveredSkill[] = [];

    for (const result of toolResults) {
      const tool = getTool(result.entityId);
      if (tool) {
        // Convertir distancia a relevancia (0-1), distancias más pequeñas = mayor relevancia
        const relevance = 1.0 / (1.0 + result.distance);
        discoveredTools.push({
          tool,
          relevance,
          source: 'vector'
        });
      }
    }

    for (const result of skillResults) {
      const skill = getSkill(result.entityId);
      if (skill) {
        // Convertir distancia a relevancia (0-1)
        const relevance = 1.0 / (1.0 + result.distance);
        
        // Calcular compatibilidad (% de tools disponibles)
        const availableTools = listEntities('tool');
        const availableToolIds = new Set(availableTools.map(t => t.id));
        const requiredCount = skill.usesTools.length;
        const availableCount = skill.usesTools.filter(id => availableToolIds.has(id)).length;
        const compatibility = requiredCount > 0 ? availableCount / requiredCount : 1.0;
        
        const missingTools = skill.usesTools.filter(id => !availableToolIds.has(id));

        discoveredSkills.push({
          skill,
          relevance,
          compatibility,
          source: 'vector',
          missingTools: missingTools.length > 0 ? missingTools : undefined
        });
      }
    }

    // Expansion de grafo (si habilitado)
    let usedGraph = false;
    if (shouldExpandGraph && vectorResults.length > 0) {
      usedGraph = true;
      
      const seedIds = vectorResults.map(r => r.entityId);
      const expanded = expandGraph(seedIds, {
        maxHops: 1,
        maxNodes: k * 2,
        edgeTypes: ['ENABLES', 'USES', 'COMPLEMENTS', 'PRODUCES_INPUT_FOR'],
        minWeight: 0.5
      });

      // Añadir nodos expandidos que no estan en resultados vectoriales
      const existingIds = new Set(vectorResults.map(r => r.entityId));
      
      for (const node of expanded) {
        if (existingIds.has(node.entityId)) continue;
        if (node.hop === 0) continue; // Skip seeds
        
        if (node.type === 'tool') {
          const tool = getTool(node.entityId);
          if (tool) {
            discoveredTools.push({
              tool,
              relevance: 0.7 - (node.hop * 0.2), // Decaer por hop
              source: 'graph',
              hopDistance: node.hop,
              relatedTo: node.path[0]
            });
          }
        } else {
          const skill = getSkill(node.entityId);
          if (skill) {
            const availableTools = listEntities('tool');
            const availableToolIds = new Set(availableTools.map(t => t.id));
            const requiredCount = skill.usesTools.length;
            const availableCount = skill.usesTools.filter(id => availableToolIds.has(id)).length;
            const compatibility = requiredCount > 0 ? availableCount / requiredCount : 1.0;
            const missingTools = skill.usesTools.filter(id => !availableToolIds.has(id));

            discoveredSkills.push({
              skill,
              relevance: 0.7 - (node.hop * 0.2),
              compatibility,
              source: 'graph',
              hopDistance: node.hop,
              relatedTo: node.path[0],
              missingTools: missingTools.length > 0 ? missingTools : undefined
            });
          }
        }
      }
    }

    // Ordenar por relevancia
    discoveredTools.sort((a, b) => b.relevance - a.relevance);
    discoveredSkills.sort((a, b) => {
      // Priorizar por relevancia y compatibilidad
      const scoreA = a.relevance * 0.7 + a.compatibility * 0.3;
      const scoreB = b.relevance * 0.7 + b.compatibility * 0.3;
      return scoreB - scoreA;
    });

    // Limitar resultados
    const finalTools = discoveredTools.slice(0, k);
    const finalSkills = discoveredSkills.slice(0, k);

    // Sugerir flujo si hay skills
    let suggestedFlow: SuggestedFlow | undefined;
    if (finalSkills.length > 0) {
      const skillIds = finalSkills.map(s => s.skill.id);
      const orderedIds = suggestWorkflow(skillIds);
      
      suggestedFlow = {
        steps: orderedIds.map((id, index) => ({
          entityId: id,
          entityType: 'skill',
          order: index,
          reasoning: `Part of suggested workflow based on dependencies`
        })),
        confidence: 0.8 // TODO: Calcular confidence real
      };
    }

    return {
      query,
      tools: finalTools,
      skills: finalSkills,
      suggestedFlow,
      metadata: {
        timestamp: new Date().toISOString(),
        usedGraph,
        resultsCount: finalTools.length + finalSkills.length
      }
    };
  }

  /**
   * EXECUTE - Ejecutar una tool o skill
   */
  async execute(params: ExecuteParams): Promise<ExecutionResult> {
    const { targetId, targetType, input, options } = params;

    if (targetType === 'tool') {
      return toolExecutor.execute(targetId, input, options);
    } else {
      return skillExecutor.execute(targetId, input, options);
    }
  }

  /**
   * Helper: Obtener info de una tool
   */
  getTool(id: string): Tool | null {
    return getTool(id);
  }

  /**
   * Helper: Obtener info de una skill
   */
  getSkill(id: string): Skill | null {
    return getSkill(id);
  }

  /**
   * Helper: Listar todas las tools
   */
  listTools(): Tool[] {
    const entities = listEntities('tool');
    return entities.map(e => e.data as Tool);
  }

  /**
   * Helper: Listar todas las skills
   */
  listSkills(): Skill[] {
    const entities = listEntities('skill');
    return entities.map(e => e.data as Skill);
  }
}

/**
 * Instancia global del Skill Bank
 */
export const skillBank = new SkillBank();

