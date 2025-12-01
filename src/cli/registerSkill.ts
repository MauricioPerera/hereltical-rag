#!/usr/bin/env node
/**
 * CLI para registrar skills en el Skill Bank
 * 
 * Uso:
 *   npx tsx src/cli/registerSkill.ts <archivo.yaml>
 *   npx tsx src/cli/registerSkill.ts --dir <directorio>
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Skill } from '../skills/types.js';
import { upsertSkill } from '../skills/store/unifiedStore.js';
import { embed } from '../embeddings/index.js';

async function registerSkill(skillData: Skill): Promise<void> {
  console.log(`📝 Registrando skill: ${skillData.name} (${skillData.id})`);
  
  // Crear texto rico para embedding
  let embeddingText = `${skillData.name}\n${skillData.overview}\n\n`;
  
  embeddingText += 'Instructions:\n';
  embeddingText += skillData.instructions.steps.join('\n') + '\n\n';
  
  if (skillData.instructions.bestPractices.length > 0) {
    embeddingText += 'Best Practices:\n';
    embeddingText += skillData.instructions.bestPractices.join('\n') + '\n\n';
  }
  
  if (skillData.examples.length > 0) {
    embeddingText += 'Examples:\n';
    for (const example of skillData.examples) {
      embeddingText += `- ${example.situation}\n`;
    }
  }
  
  // Generar embedding
  console.log('   🔄 Generando embedding...');
  const embedding = await embed(embeddingText);
  
  // Guardar en store
  upsertSkill(skillData, embedding);
  
  console.log(`   ✅ Skill registrada exitosamente`);
  console.log(`   🔗 Usa tools: ${skillData.usesTools.join(', ')}`);
}

async function registerFromFile(filePath: string): Promise<void> {
  console.log(`\n📂 Procesando archivo: ${filePath}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);
  
  let skillData: Skill;
  
  if (ext === '.yaml' || ext === '.yml') {
    skillData = yaml.parse(content);
  } else if (ext === '.json') {
    skillData = JSON.parse(content);
  } else {
    throw new Error(`Formato no soportado: ${ext}. Use .yaml, .yml o .json`);
  }
  
  await registerSkill(skillData);
}

async function registerFromDirectory(dirPath: string): Promise<void> {
  console.log(`\n📁 Procesando directorio: ${dirPath}`);
  
  const files = fs.readdirSync(dirPath);
  const skillFiles = files.filter(f => 
    f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
  );
  
  console.log(`   Encontrados ${skillFiles.length} archivos de skills\n`);
  
  for (const file of skillFiles) {
    const filePath = path.join(dirPath, file);
    try {
      await registerFromFile(filePath);
    } catch (error: any) {
      console.error(`   ❌ Error procesando ${file}: ${error.message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Uso:
  npx tsx src/cli/registerSkill.ts <archivo.yaml>
  npx tsx src/cli/registerSkill.ts --dir <directorio>

Ejemplos:
  npx tsx src/cli/registerSkill.ts data/skills/stripe_api_handler.yaml
  npx tsx src/cli/registerSkill.ts --dir data/skills
    `);
    process.exit(1);
  }
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Skill Bank - Registro de Skills                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  try {
    if (args[0] === '--dir') {
      if (args.length < 2) {
        console.error('❌ Error: Especifica el directorio');
        process.exit(1);
      }
      await registerFromDirectory(args[1]);
    } else {
      await registerFromFile(args[0]);
    }
    
    console.log('\n✅ Registro completado exitosamente\n');
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();

