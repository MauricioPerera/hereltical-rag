/**
 * Tool Executor - Ejecuta tools registradas
 */

import { Tool, ExecutionResult, ExecutionLog, ExecutionError } from '../types.js';
import { getTool } from '../store/unifiedStore.js';
import { logExecution } from '../store/executionStore.js';

/**
 * Ejecutor de tools
 */
export class ToolExecutor {
  private tools: Map<string, ToolHandler> = new Map();
  
  /**
   * Registrar handler para una tool
   */
  registerHandler(toolId: string, handler: ToolHandler): void {
    this.tools.set(toolId, handler);
  }
  
  /**
   * Ejecutar una tool
   */
  async execute(
    toolId: string,
    input: Record<string, any>,
    options: { timeout?: number; retries?: number; dryRun?: boolean } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: ExecutionLog[] = [];
    
    // Log inicial
    logs.push({
      level: 'info',
      message: `Executing tool: ${toolId}`,
      timestamp: new Date().toISOString(),
      context: { input }
    });
    
    // Obtener tool definition
    const tool = getTool(toolId);
    if (!tool) {
      return {
        success: false,
        output: null,
        toolsUsed: [],
        logs,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${toolId}' not found`,
          recoverable: false
        },
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Dry run
    if (options.dryRun) {
      logs.push({
        level: 'info',
        message: 'Dry run - not executing',
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        output: { dryRun: true, tool: toolId },
        toolsUsed: [toolId],
        logs,
        targetId: toolId,
        targetType: 'tool',
        dryRun: true,
        executedAt: new Date().toISOString(),
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Validar input contra schema
    const validationError = this.validateInput(input, tool);
    if (validationError) {
      return {
        success: false,
        output: null,
        toolsUsed: [],
        logs,
        error: validationError,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Obtener handler
    const handler = this.tools.get(toolId);
    if (!handler) {
      return {
        success: false,
        output: null,
        toolsUsed: [],
        logs,
        error: {
          code: 'NO_HANDLER',
          message: `No handler registered for tool '${toolId}'`,
          details: { availableHandlers: Array.from(this.tools.keys()) },
          recoverable: false
        },
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Ejecutar con timeout y retries
    const maxRetries = options.retries || 0;
    let attempt = 0;
    let lastError: any = null;
    
    while (attempt <= maxRetries) {
      try {
        logs.push({
          level: 'debug',
          message: `Attempt ${attempt + 1}/${maxRetries + 1}`,
          timestamp: new Date().toISOString()
        });
        
        const output = await this.executeWithTimeout(
          () => handler(input),
          options.timeout || 30000
        );
        
        logs.push({
          level: 'info',
          message: 'Tool executed successfully',
          timestamp: new Date().toISOString()
        });
        
        const result = {
          success: true,
          output,
          toolsUsed: [toolId],
          logs,
          targetId: toolId,
          targetType: 'tool',
          executedAt: new Date().toISOString(),
          metadata: {
            executionTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
        
        // Log execution
        logExecution({
          skillId: toolId,
          skillType: 'tool',
          input,
          output,
          success: true,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
        
        return result;
      } catch (error: any) {
        lastError = error;
        logs.push({
          level: 'error',
          message: `Execution failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          context: { attempt: attempt + 1, error: error.toString() }
        });
        
        attempt++;
        
        // Esperar antes de reintentar (exponential backoff)
        if (attempt <= maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Todos los intentos fallaron
    return {
      success: false,
      output: null,
      toolsUsed: [],
      logs,
      error: {
        code: 'EXECUTION_FAILED',
        message: lastError?.message || 'Unknown error',
        details: lastError,
        recoverable: maxRetries > 0
      },
      metadata: {
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * Ejecutar con timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  }
  
  /**
   * Validar input contra schema
   */
  private validateInput(input: Record<string, any>, tool: Tool): ExecutionError | null {
    const schema = tool.inputSchema;
    
    // Validar campos requeridos
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in input)) {
          return {
            code: 'VALIDATION_ERROR',
            message: `Missing required field: ${field}`,
            details: { field, schema },
            recoverable: true
          };
        }
      }
    }
    
    // Validacion basica de tipos
    if (schema.properties) {
      for (const [field, value] of Object.entries(input)) {
        const fieldSchema = schema.properties[field];
        if (!fieldSchema) continue;
        
        // Validar enum
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          return {
            code: 'VALIDATION_ERROR',
            message: `Invalid value for field '${field}': must be one of ${fieldSchema.enum.join(', ')}`,
            details: { field, value, allowedValues: fieldSchema.enum },
            recoverable: true
          };
        }
      }
    }
    
    return null;
  }
}

/**
 * Handler de una tool - funcion que ejecuta la logica
 */
export type ToolHandler = (input: Record<string, any>) => Promise<any>;

/**
 * Instancia global del executor
 */
export const toolExecutor = new ToolExecutor();

