#!/usr/bin/env node
/**
 * Demo del Skill Bank
 * 
 * Registra tools y skills de ejemplo, luego prueba el descubrimiento
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';
import { Tool, Skill } from '../src/skills/types.js';
import { upsertTool, upsertSkill, setDbPath, getGraphStats, addEdge } from '../src/skills/store/unifiedStore.js';
import { skillBank } from '../src/skills/skillBank.js';
import { embed } from '../src/embeddings/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Usar DB de test
setDbPath('skillbank-demo.db');

async function loadTools() {
  console.log('\n📦 Cargando tools de ejemplo...\n');
  
  const toolsDir = path.join(__dirname, '../data/tools');
  const files = fs.readdirSync(toolsDir);
  
  for (const file of files) {
    if (!file.endsWith('.yaml')) continue;
    
    const filePath = path.join(toolsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const tool = yaml.parse(content) as Tool;
    
    console.log(`   🔧 Registrando tool: ${tool.name}`);
    
    // Generar embedding
    let embeddingText = `${tool.name}\n${tool.description}\n`;
    embeddingText += `Category: ${tool.category}\n`;
    
    const embedding = await embed(embeddingText);
    upsertTool(tool, embedding);
  }
  
  console.log('\n   ✅ Tools cargadas exitosamente');
}

async function loadSkills() {
  console.log('\n📚 Cargando skills de ejemplo...\n');
  
  const skillsDir = path.join(__dirname, '../data/skills');
  const files = fs.readdirSync(skillsDir);
  
  for (const file of files) {
    if (!file.endsWith('.yaml')) continue;
    
    const filePath = path.join(skillsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const skill = yaml.parse(content) as Skill;
    
    console.log(`   📖 Registrando skill: ${skill.name}`);
    console.log(`      Usa tools: ${skill.usesTools.join(', ')}`);
    
    // Generar embedding
    let embeddingText = `${skill.name}\n${skill.overview}\n\n`;
    embeddingText += 'Instructions:\n';
    embeddingText += skill.instructions.steps.join('\n');
    
    const embedding = await embed(embeddingText);
    upsertSkill(skill, embedding);
  }
  
  console.log('\n   ✅ Skills cargadas exitosamente');
}

async function addExtraRelations() {
  console.log('\n🔗 Creando relaciones adicionales en el grafo...\n');
  
  // pdf_report_generator REQUIRES data_fetcher (primero obtener datos, luego reportar)
  addEdge({
    fromId: 'pdf_report_generator',
    toId: 'data_fetcher',
    type: 'REQUIRES',
    weight: 0.9
  });
  console.log('   ✅ pdf_report_generator REQUIRES data_fetcher');
  
  // stripe_api_handler PRODUCES_INPUT_FOR pdf_report_generator
  addEdge({
    fromId: 'stripe_api_handler',
    toId: 'pdf_report_generator',
    type: 'PRODUCES_INPUT_FOR',
    weight: 0.85
  });
  console.log('   ✅ stripe_api_handler PRODUCES_INPUT_FOR pdf_report_generator');
  
  // data_fetcher COMPLEMENTS stripe_api_handler
  addEdge({
    fromId: 'data_fetcher',
    toId: 'stripe_api_handler',
    type: 'SIMILAR_TO',
    weight: 0.7
  });
  console.log('   ✅ data_fetcher SIMILAR_TO stripe_api_handler');
  
  // email_sender COMPLEMENTS pdf_report_generator (enviar reportes)
  addEdge({
    fromId: 'email_sender',
    toId: 'pdf_report_generator',
    type: 'COMPLEMENTS',
    weight: 0.8
  });
  console.log('   ✅ email_sender COMPLEMENTS pdf_report_generator');
}

async function testDiscovery() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                 PROBANDO DESCUBRIMIENTO                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  // Test 1: Descubrir skills para pagos en Stripe
  console.log('\n[TEST 1] Query: "verificar pagos en stripe y generar reporte"\n');
  
  const result1 = await skillBank.discover({
    query: 'verificar pagos en stripe y generar reporte',
    mode: 'all',
    expandGraph: true,
    k: 5
  });
  
  console.log(`📊 Resultados (${result1.metadata.resultsCount} total):\n`);
  
  console.log('🔧 Tools encontradas:');
  for (const discovered of result1.tools) {
    console.log(`   - ${discovered.tool.name} (relevancia: ${discovered.relevance.toFixed(2)}, source: ${discovered.source})`);
  }
  
  console.log('\n📖 Skills encontradas:');
  for (const discovered of result1.skills) {
    console.log(`   - ${discovered.skill.name} (relevancia: ${discovered.relevance.toFixed(2)}, compatibility: ${(discovered.compatibility * 100).toFixed(0)}%)`);
    console.log(`     Usa: ${discovered.skill.usesTools.join(', ')}`);
  }
  
  if (result1.suggestedFlow) {
    console.log('\n🔀 Flujo sugerido:');
    for (const step of result1.suggestedFlow.steps) {
      console.log(`   ${step.order + 1}. ${step.entityId}`);
    }
  }
  
  // Test 2: Buscar solo tools de API
  console.log('\n\n[TEST 2] Query: "hacer requests HTTP" (solo tools)\n');
  
  const result2 = await skillBank.discover({
    query: 'hacer requests HTTP a APIs externas',
    mode: 'tools',
    k: 3
  });
  
  console.log('🔧 Tools encontradas:');
  for (const discovered of result2.tools) {
    console.log(`   - ${discovered.tool.name} (${discovered.tool.category})`);
    console.log(`     ${discovered.tool.description.split('\n')[0]}`);
  }
  
  // Test 3: Buscar skills de comunicacion
  console.log('\n\n[TEST 3] Query: "enviar notificaciones" (solo skills)\n');
  
  const result3 = await skillBank.discover({
    query: 'enviar notificaciones por email',
    mode: 'skills',
    k: 3
  });
  
  console.log('📖 Skills encontradas:');
  for (const discovered of result3.skills) {
    console.log(`   - ${discovered.skill.name}`);
    console.log(`     Overview: ${discovered.skill.overview.split('\n')[0]}`);
  }
}

async function showStats() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  ESTADISTICAS DEL GRAFO                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const stats = getGraphStats();
  
  console.log(`📊 Total entidades: ${stats.totalEntities}`);
  console.log(`   - Tools: ${stats.totalTools}`);
  console.log(`   - Skills: ${stats.totalSkills}`);
  console.log(`\n🔗 Total edges: ${stats.totalEdges}`);
  console.log('   Por tipo:');
  for (const [type, count] of Object.entries(stats.edgesByType)) {
    console.log(`   - ${type}: ${count}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              Skill Bank - Demo Completo                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  try {
    await loadTools();
    await loadSkills();
    await addExtraRelations();
    await showStats();
    await testDiscovery();
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ DEMO COMPLETADO                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    console.log('💡 Proximo paso: Iniciar el servidor API');
    console.log('   npm run server');
    console.log('\n   Endpoints disponibles:');
    console.log('   POST /api/skillbank/discover');
    console.log('   POST /api/skillbank/execute');
    console.log('   GET  /api/skillbank/tools');
    console.log('   GET  /api/skillbank/skills\n');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

