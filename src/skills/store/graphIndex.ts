/**
 * Graph Index - Expansion de grafo con BFS
 */

import {
  EdgeType,
  ExpandedGraphNode,
  GraphExpansionConfig
} from '../types.js';
import { getEdgesFrom, getEntity } from './unifiedStore.js';

/**
 * Expandir grafo desde nodos semilla usando BFS
 */
export function expandGraph(
  seedIds: string[],
  config: GraphExpansionConfig
): ExpandedGraphNode[] {
  const visited = new Set<string>();
  const results: ExpandedGraphNode[] = [];
  
  // Queue: [entityId, currentHop, path]
  const queue: Array<[string, number, string[]]> = seedIds.map(id => [id, 0, [id]]);
  
  while (queue.length > 0) {
    const [currentId, currentHop, path] = queue.shift()!;
    
    // Skip si ya visitado
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    // Verificar que la entidad existe
    const entity = getEntity(currentId);
    if (!entity) continue;
    
    // Añadir a resultados
    results.push({
      entityId: currentId,
      type: entity.type,
      hop: currentHop,
      path: path
    });
    
    // Parar si llegamos al limite de nodos
    if (results.length >= config.maxNodes) break;
    
    // Parar expansion si llegamos al max hops
    if (currentHop >= config.maxHops) continue;
    
    // Obtener edges desde este nodo
    const edges = getEdgesFrom(currentId, config.edgeTypes);
    
    for (const edge of edges) {
      // Filtrar por peso minimo si esta configurado
      if (config.minWeight && edge.weight && edge.weight < config.minWeight) {
        continue;
      }
      
      // Solo añadir a queue si no visitado
      if (!visited.has(edge.toId)) {
        queue.push([
          edge.toId,
          currentHop + 1,
          [...path, edge.toId]
        ]);
      }
    }
  }
  
  return results;
}

/**
 * Sugerir flujo de skills basado en el grafo
 * 
 * Busca patrones PRODUCES_INPUT_FOR y REQUIRES para sugerir secuencia
 */
export function suggestWorkflow(skillIds: string[]): string[] {
  // Mapa de dependencias: skillId -> [dependencias]
  const dependencies = new Map<string, Set<string>>();
  const allSkills = new Set(skillIds);
  
  // Construir grafo de dependencias
  for (const skillId of skillIds) {
    const edges = getEdgesFrom(skillId, ['REQUIRES', 'PRODUCES_INPUT_FOR']);
    
    for (const edge of edges) {
      if (!allSkills.has(edge.toId)) continue;
      
      // Si A REQUIRES B, entonces B debe ir antes que A
      if (edge.type === 'REQUIRES') {
        if (!dependencies.has(skillId)) {
          dependencies.set(skillId, new Set());
        }
        dependencies.get(skillId)!.add(edge.toId);
      }
    }
  }
  
  // Topological sort
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(skillId: string): boolean {
    if (visited.has(skillId)) return true;
    if (visiting.has(skillId)) return false; // Ciclo detectado
    
    visiting.add(skillId);
    
    const deps = dependencies.get(skillId);
    if (deps) {
      for (const dep of deps) {
        if (!visit(dep)) return false;
      }
    }
    
    visiting.delete(skillId);
    visited.add(skillId);
    sorted.push(skillId);
    
    return true;
  }
  
  for (const skillId of skillIds) {
    if (!visited.has(skillId)) {
      if (!visit(skillId)) {
        // Ciclo detectado, retornar orden original
        return skillIds;
      }
    }
  }
  
  return sorted;
}

