#!/usr/bin/env node
/**
 * CLI para registrar tools en el Skill Bank
 * 
 * Uso:
 *   npx tsx src/cli/registerTool.ts <archivo.yaml>
 *   npx tsx src/cli/registerTool.ts --dir <directorio>
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Tool } from '../skills/types.js';
import { upsertTool } from '../skills/store/unifiedStore.js';
import { embed } from '../embeddings/index.js';

async function registerTool(toolData: Tool): Promise<void> {
  console.log(`📝 Registrando tool: ${toolData.name} (${toolData.id})`);
  
  // Crear texto para embedding (descripcion + ejemplos)
  let embeddingText = `${toolData.name}\n${toolData.description}\n`;
  embeddingText += `Category: ${toolData.category}\n`;
  
  if (toolData.examples) {
    embeddingText += 'Examples:\n';
    for (const example of toolData.examples) {
      embeddingText += `- ${example.description}\n`;
    }
  }
  
  // Generar embedding
  console.log('   🔄 Generando embedding...');
  const embedding = await embed(embeddingText);
  
  // Guardar en store
  upsertTool(toolData, embedding);
  
  console.log(`   ✅ Tool registrada exitosamente`);
}

async function registerFromFile(filePath: string): Promise<void> {
  console.log(`\n📂 Procesando archivo: ${filePath}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);
  
  let toolData: Tool;
  
  if (ext === '.yaml' || ext === '.yml') {
    toolData = yaml.parse(content);
  } else if (ext === '.json') {
    toolData = JSON.parse(content);
  } else {
    throw new Error(`Formato no soportado: ${ext}. Use .yaml, .yml o .json`);
  }
  
  await registerTool(toolData);
}

async function registerFromDirectory(dirPath: string): Promise<void> {
  console.log(`\n📁 Procesando directorio: ${dirPath}`);
  
  const files = fs.readdirSync(dirPath);
  const toolFiles = files.filter(f => 
    f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
  );
  
  console.log(`   Encontrados ${toolFiles.length} archivos de tools\n`);
  
  for (const file of toolFiles) {
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
  npx tsx src/cli/registerTool.ts <archivo.yaml>
  npx tsx src/cli/registerTool.ts --dir <directorio>

Ejemplos:
  npx tsx src/cli/registerTool.ts data/tools/http_request.yaml
  npx tsx src/cli/registerTool.ts --dir data/tools
    `);
    process.exit(1);
  }
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Skill Bank - Registro de Tools                      ║');
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

