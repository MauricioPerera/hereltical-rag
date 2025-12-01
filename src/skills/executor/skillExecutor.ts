/**
 * Skill Executor - Orquesta la ejecucion de skills
 * 
 * Las skills son recetas que usan tools. El SkillExecutor interpreta
 * las instrucciones de la skill y llama a las tools apropiadas.
 */

import { Skill, ExecutionResult, ExecutionLog } from '../types.js';
import { getSkill, getTool } from '../store/unifiedStore.js';
import { toolExecutor } from './toolExecutor.js';
import { queryRAGWithSkillConfig } from './ragIntegration.js';
import { logExecution } from '../store/executionStore.js';

/**
 * Ejecutor de skills
 */
export class SkillExecutor {
  /**
   * Ejecutar una skill
   * 
   * Por ahora, las skills son descriptivas (no ejecutables directamente).
   * Este metodo retorna la skill con sus instrucciones para que el agente las siga.
   * 
   * En una version futura, podria interpretar las skills automaticamente.
   */
  async execute(
    skillId: string,
    input: Record<string, any>,
    options: { timeout?: number; retries?: number; dryRun?: boolean } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: ExecutionLog[] = [];
    
    logs.push({
      level: 'info',
      message: `Executing skill: ${skillId}`,
      timestamp: new Date().toISOString(),
      context: { input }
    });
    
    // Obtener skill definition
    const skill = getSkill(skillId);
    if (!skill) {
      return {
        success: false,
        output: null,
        toolsUsed: [],
        logs,
        error: {
          code: 'SKILL_NOT_FOUND',
          message: `Skill '${skillId}' not found`,
          recoverable: false
        },
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Context-aware skill: buscar en RAG si tiene configuración
    if (skill.skillType === 'context_aware' && skill.ragIntegration) {
      logs.push({
        level: 'info',
        message: 'Context-aware skill - querying RAG',
        timestamp: new Date().toISOString()
      });
      
      try {
        const ragResults = await queryRAGWithSkillConfig(
          input.query || input.userQuery || '',
          skill.ragIntegration
        );
        
        logs.push({
          level: 'info',
          message: `RAG query returned ${ragResults.sources.length} results`,
          timestamp: new Date().toISOString()
        });
        
        const result = {
          success: true,
          output: {
            skill: {
              id: skill.id,
              name: skill.name,
              skillType: skill.skillType,
              instructions: skill.instructions
            },
            ragContext: ragResults.sources,
            contextSummary: ragResults.answer,
            referencedDocuments: skill.referencesDocuments,
            message: 'Use the RAG context and follow instructions to answer the query'
          },
          toolsUsed: [],
          logs,
          targetId: skillId,
          targetType: 'skill',
          dryRun: options.dryRun,
          executedAt: new Date().toISOString(),
          metadata: {
            executionTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            ragSourcesCount: ragResults.sources.length
          }
        };
        
        // Log execution (if not dry run)
        if (!options.dryRun) {
          logExecution({
            skillId: skill.id,
            skillType: skill.skillType || 'context_aware',
            input,
            output: result.output,
            success: true,
            executionTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          });
        }
        
        return result;
      } catch (error: any) {
        logs.push({
          level: 'error',
          message: `RAG query failed: ${error.message}`,
          timestamp: new Date().toISOString()
        });
        
        // Fall through to normal execution
      }
    }
    
    // Dry run - retornar skill info sin ejecutar
    if (options.dryRun) {
      logs.push({
        level: 'info',
        message: 'Dry run - returning skill instructions',
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        output: {
          dryRun: true,
          skill: {
            id: skill.id,
            name: skill.name,
            instructions: skill.instructions,
            usesTools: skill.usesTools,
            parameters: skill.parameters
          }
        },
        toolsUsed: skill.usesTools,
        logs,
        targetId: skillId,
        targetType: 'skill',
        dryRun: true,
        executedAt: new Date().toISOString(),
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Verificar que todas las tools requeridas estan disponibles
    const missingTools: string[] = [];
    for (const toolId of skill.usesTools) {
      const tool = getTool(toolId);
      if (!tool) {
        missingTools.push(toolId);
      }
    }
    
    if (missingTools.length > 0) {
      return {
        success: false,
        output: null,
        toolsUsed: [],
        logs,
        error: {
          code: 'MISSING_TOOLS',
          message: `Skill requires tools that are not available: ${missingTools.join(', ')}`,
          details: { missingTools, requiredTools: skill.usesTools },
          recoverable: false
        },
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Por ahora, retornar la skill completa con instrucciones para el agente
    // El agente decidira como ejecutarla siguiendo las instrucciones
    logs.push({
      level: 'info',
      message: 'Skill loaded successfully - agent should follow instructions',
      timestamp: new Date().toISOString()
    });
    
    const result = {
      success: true,
      output: {
        skill: {
          id: skill.id,
          name: skill.name,
          overview: skill.overview,
          instructions: skill.instructions,
          usesTools: skill.usesTools,
          parameters: skill.parameters,
          outputs: skill.outputs,
          examples: skill.examples,
          errorHandling: skill.errorHandling
        },
        message: 'Follow the instructions to complete this skill',
        availableTools: skill.usesTools
      },
      toolsUsed: skill.usesTools,
      logs,
      targetId: skillId,
      targetType: 'skill',
      executedAt: new Date().toISOString(),
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
    
    // Log execution
    logExecution({
      skillId: skill.id,
      skillType: skill.skillType || 'tool_based',
      input,
      output: result.output,
      success: true,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }
  
  /**
   * Ejecutar una skill de forma automatica (experimental)
   * 
   * Intenta interpretar las instrucciones de la skill y ejecutar
   * las tools correspondientes automaticamente.
   * 
   * NOTA: Esto requiere que las skills tengan formato estructurado
   * o que usemos un LLM para interpretar las instrucciones.
   */
  async executeAuto(
    skillId: string,
    input: Record<string, any>
  ): Promise<ExecutionResult> {
    // TODO: Implementar ejecucion automatica con LLM
    // Por ahora, delegar al modo manual
    return this.execute(skillId, input);
  }
}

/**
 * Instancia global del executor
 */
export const skillExecutor = new SkillExecutor();

