#!/usr/bin/env node
/**
 * CLI para crear relaciones entre entities en el grafo
 * 
 * Uso:
 *   npx tsx src/cli/linkEntities.ts <from_id> <to_id> <edge_type>
 */

import { addEdge, getEntity } from '../skills/store/unifiedStore.js';
import { EdgeType } from '../skills/types.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
Uso:
  npx tsx src/cli/linkEntities.ts <from_id> <to_id> <edge_type> [weight]

Tipos de edge disponibles:
  - ENABLES              (tool enables skill)
  - USES                 (skill uses tool)
  - REQUIRES             (skill requires skill)
  - PRODUCES_INPUT_FOR   (skill produces input for skill)
  - SIMILAR_TO           (similar entities)
  - ALTERNATIVE_TO       (alternative entities)
  - COMPLEMENTS          (complementary entities)

Ejemplos:
  npx tsx src/cli/linkEntities.ts stripe_handler paypal_handler ALTERNATIVE_TO
  npx tsx src/cli/linkEntities.ts report_gen data_fetcher REQUIRES 0.9
    `);
    process.exit(1);
  }
  
  const [fromId, toId, edgeTypeStr, weightStr] = args;
  const edgeType = edgeTypeStr as EdgeType;
  const weight = weightStr ? parseFloat(weightStr) : 1.0;
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Skill Bank - Crear Relacion                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Verificar que las entidades existen
  const fromEntity = getEntity(fromId);
  if (!fromEntity) {
    console.error(`❌ Entidad origen no encontrada: ${fromId}`);
    process.exit(1);
  }
  
  const toEntity = getEntity(toId);
  if (!toEntity) {
    console.error(`❌ Entidad destino no encontrada: ${toId}`);
    process.exit(1);
  }
  
  console.log(`📌 Origen: ${fromEntity.name} (${fromEntity.type})`);
  console.log(`📌 Destino: ${toEntity.name} (${toEntity.type})`);
  console.log(`🔗 Relacion: ${edgeType}`);
  console.log(`⚖️  Peso: ${weight}\n`);
  
  try {
    addEdge({
      fromId,
      toId,
      type: edgeType,
      weight
    });
    
    console.log('✅ Relacion creada exitosamente\n');
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();

