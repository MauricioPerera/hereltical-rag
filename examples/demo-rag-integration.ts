/**
 * Demo: RAG Integration with Context-Aware Skills
 * 
 * Demonstrates:
 * 1. Context-aware skills using RAG
 * 2. Execution tracking
 * 3. Analytics
 */

import { skillBank } from '../src/skills/skillBank.js';
import { upsertSkill } from '../src/skills/store/unifiedStore.js';
import { getRecentExecutions, getExecutionStats } from '../src/skills/store/executionStore.js';
import { embed } from '../src/embeddings/index.js';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import type { Skill } from '../src/skills/types.js';

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║     Skill Bank + RAG Integration Demo                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

async function main() {
  try {
    // ========================================================================
    // STEP 1: Register context-aware skills
    // ========================================================================
    
    console.log('[STEP 1] Registering context-aware skills...');
    console.log('─────────────────────────────────────────────────────────');
    
    const skillFiles = [
      'data/skills/answer_from_legal_docs.yaml',
      'data/skills/extract_product_info.yaml',
      'data/skills/summarize_technical_docs.yaml'
    ];
    
    for (const file of skillFiles) {
      try {
        const yamlContent = readFileSync(file, 'utf8');
        const skill = load(yamlContent) as Skill;
        
        // Generate embedding
        const embeddingText = `${skill.name}\n${skill.overview}\n${skill.instructions.steps.join('\n')}`;
        const embedding = await embed(embeddingText);
        
        // Register skill
        upsertSkill(skill, embedding);
        
        console.log(`  ✓ Registered: ${skill.name} (${skill.skillType})`);
      } catch (error: any) {
        console.log(`  ⚠ Skipped: ${file} - ${error.message}`);
      }
    }
    
    console.log('');
    
    // ========================================================================
    // STEP 2: Discover skills for legal query
    // ========================================================================
    
    console.log('[STEP 2] Discovering skills for legal question...');
    console.log('─────────────────────────────────────────────────────────');
    
    const legalQuery = "¿Cuál es la política de cancelación del servicio?";
    console.log(`  Query: "${legalQuery}"`);
    console.log('');
    
    const discovery = await skillBank.discover({
      query: legalQuery,
      mode: 'all',
      expandGraph: false,
      k: 3
    });
    
    console.log(`  Found ${discovery.skills.length} relevant skills:`);
    for (const discovered of discovery.skills) {
      console.log(`    • ${discovered.skill.name} (relevance: ${discovered.relevance.toFixed(2)})`);
      console.log(`      Type: ${discovered.skill.skillType}`);
      console.log(`      Compatibility: ${(discovered.compatibility * 100).toFixed(0)}%`);
    }
    console.log('');
    
    // ========================================================================
    // STEP 3: Execute context-aware skill
    // ========================================================================
    
    console.log('[STEP 3] Executing context-aware skill...');
    console.log('─────────────────────────────────────────────────────────');
    
    const contextAwareSkill = discovery.skills.find(
      s => s.skill.skillType === 'context_aware'
    );
    
    if (contextAwareSkill) {
      console.log(`  Executing: ${contextAwareSkill.skill.name}`);
      console.log('');
      
      try {
        const result = await skillBank.execute({
          targetId: contextAwareSkill.skill.id,
          targetType: 'skill',
          input: {
            query: legalQuery,
            includeReferences: true
          },
          options: { dryRun: false }
        });
        
        if (result.success) {
          console.log('  ✓ Execution successful!');
          console.log('');
          
          // Show RAG context if available
          if (result.output.ragContext) {
            console.log(`  RAG Context: ${result.output.ragContext.length} sources found`);
            for (let i = 0; i < Math.min(2, result.output.ragContext.length); i++) {
              const source = result.output.ragContext[i];
              console.log(`    ${i + 1}. Doc: ${source.docId}, Score: ${source.score.toFixed(3)}`);
            }
            console.log('');
          }
          
          // Show instructions
          if (result.output.skill?.instructions) {
            console.log('  Instructions to follow:');
            const steps = result.output.skill.instructions.steps.slice(0, 3);
            for (const step of steps) {
              console.log(`    • ${step}`);
            }
            console.log('    ...');
            console.log('');
          }
          
          console.log(`  Execution time: ${result.metadata?.executionTime}ms`);
        } else {
          console.log('  ✗ Execution failed:', result.error?.message);
        }
      } catch (error: any) {
        console.log(`  ⚠ Execution error: ${error.message}`);
        console.log('     (This is expected if RAG documents are not indexed)');
      }
    } else {
      console.log('  ⚠ No context-aware skill found');
    }
    
    console.log('');
    
    // ========================================================================
    // STEP 4: Execute hybrid skill
    // ========================================================================
    
    console.log('[STEP 4] Testing hybrid skill (technical docs summarization)...');
    console.log('─────────────────────────────────────────────────────────');
    
    const technicalQuery = "summarize API documentation";
    
    const discovery2 = await skillBank.discover({
      query: technicalQuery,
      mode: 'skills',
      expandGraph: false,
      k: 3
    });
    
    const hybridSkill = discovery2.skills.find(
      s => s.skill.skillType === 'hybrid'
    );
    
    if (hybridSkill) {
      console.log(`  Found hybrid skill: ${hybridSkill.skill.name}`);
      console.log(`  Type: ${hybridSkill.skill.skillType}`);
      console.log('');
      
      try {
        const result = await skillBank.execute({
          targetId: hybridSkill.skill.id,
          targetType: 'skill',
          input: {
            topic: 'REST API Authentication',
            detailLevel: 'standard',
            audience: 'intermediate'
          },
          options: { dryRun: false }
        });
        
        if (result.success) {
          console.log('  ✓ Hybrid skill executed successfully');
          console.log(`  Execution time: ${result.metadata?.executionTime}ms`);
        }
      } catch (error: any) {
        console.log(`  ⚠ Execution note: ${error.message}`);
      }
    }
    
    console.log('');
    
    // ========================================================================
    // STEP 5: Show execution history
    // ========================================================================
    
    console.log('[STEP 5] Execution History & Analytics');
    console.log('─────────────────────────────────────────────────────────');
    
    const history = getRecentExecutions(5);
    
    console.log(`  Recent executions: ${history.length}`);
    for (const exec of history) {
      const status = exec.success ? '✓' : '✗';
      const time = new Date(exec.timestamp).toLocaleTimeString();
      console.log(`    ${status} ${exec.skillId} - ${exec.executionTime}ms (${time})`);
    }
    console.log('');
    
    // ========================================================================
    // STEP 6: Show statistics
    // ========================================================================
    
    console.log('[STEP 6] Execution Statistics');
    console.log('─────────────────────────────────────────────────────────');
    
    const stats = getExecutionStats();
    
    console.log(`  Total executions: ${stats.total}`);
    console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Average time: ${stats.averageExecutionTime.toFixed(0)}ms`);
    console.log('');
    
    if (Object.keys(stats.bySkill).length > 0) {
      console.log('  Most used skills:');
      const sortedSkills = Object.entries(stats.bySkill)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      for (const [skillId, count] of sortedSkills) {
        console.log(`    • ${skillId}: ${count} executions`);
      }
      console.log('');
    }
    
    if (Object.keys(stats.byType).length > 0) {
      console.log('  By skill type:');
      for (const [type, count] of Object.entries(stats.byType)) {
        console.log(`    • ${type}: ${count}`);
      }
    }
    
    console.log('');
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              Demo Completed Successfully! ✓                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('What we demonstrated:');
    console.log('  ✓ Context-aware skills that use RAG for knowledge');
    console.log('  ✓ Hybrid skills (RAG + LLM + structured output)');
    console.log('  ✓ Automatic execution tracking');
    console.log('  ✓ Analytics and statistics');
    console.log('');
    console.log('Next steps:');
    console.log('  • Index some documents to see RAG in action');
    console.log('  • Try via API: POST /api/skillbank/discover');
    console.log('  • Check analytics: GET /api/skillbank/analytics/stats');
    console.log('  • Start server: npm run server');
    console.log('');
    
  } catch (error: any) {
    console.error('Error in demo:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

