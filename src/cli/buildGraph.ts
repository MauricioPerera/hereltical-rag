#!/usr/bin/env node

import { buildSameTopicGraph } from '../graph/relationsDetector.js';
import { getGraphStats } from '../db/graphStore.js';

/**
 * CLI tool to build graph edges
 * 
 * Usage:
 *   npx tsx src/cli/buildGraph.ts same-topic
 *   npx tsx src/cli/buildGraph.ts same-topic --min-similarity 0.85
 *   npx tsx src/cli/buildGraph.ts stats
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Usage: npx tsx src/cli/buildGraph.ts <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  same-topic       Build SAME_TOPIC edges based on embedding similarity');
    console.log('  stats            Show graph statistics');
    console.log('');
    console.log('Options for same-topic:');
    console.log('  --min-similarity <value>   Minimum similarity threshold (default: 0.80)');
    console.log('  --max-connections <value>  Max connections per node (default: 5)');
    console.log('  --include-same-doc         Include same-document connections (default: cross-doc only)');
    console.log('  --use-title-sim            Use title similarity as well (default: false)');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/cli/buildGraph.ts same-topic');
    console.log('  npx tsx src/cli/buildGraph.ts same-topic --min-similarity 0.85 --max-connections 3');
    console.log('  npx tsx src/cli/buildGraph.ts stats');
    process.exit(0);
  }

  if (command === 'stats') {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    Graph Statistics                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    const stats = getGraphStats();

    console.log('📊 Overall:');
    console.log(`   Total edges: ${stats.totalEdges}`);
    console.log(`   Total nodes (with edges): ${stats.totalNodes}`);
    console.log(`   Average degree: ${stats.avgDegree} connections/node`);
    console.log('');

    if (Object.keys(stats.edgesByType).length > 0) {
      console.log('📈 Edges by type:');
      for (const [type, count] of Object.entries(stats.edgesByType)) {
        const percentage = stats.totalEdges > 0 ? ((count / stats.totalEdges) * 100).toFixed(1) : '0';
        console.log(`   ${type}: ${count} (${percentage}%)`);
      }
    } else {
      console.log('ℹ️  No edges found. Build edges with: buildGraph.ts same-topic');
    }

    console.log('');
    process.exit(0);
  }

  if (command === 'same-topic') {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           Building SAME_TOPIC Edges                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Parse options
    let minSimilarity = 0.80;
    let maxConnections = 5;
    let crossDocOnly = true;
    let titleSimilarity = false;

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--min-similarity' && args[i + 1]) {
        minSimilarity = parseFloat(args[i + 1]);
        i++;
      } else if (arg === '--max-connections' && args[i + 1]) {
        maxConnections = parseInt(args[i + 1], 10);
        i++;
      } else if (arg === '--include-same-doc') {
        crossDocOnly = false;
      } else if (arg === '--use-title-sim') {
        titleSimilarity = true;
      }
    }

    console.log('⚙️  Configuration:');
    console.log(`   Min similarity: ${minSimilarity}`);
    console.log(`   Max connections per node: ${maxConnections}`);
    console.log(`   Cross-doc only: ${crossDocOnly}`);
    console.log(`   Use title similarity: ${titleSimilarity}`);
    console.log('');

    const edgeCount = await buildSameTopicGraph({
      minSimilarity,
      maxConnections,
      crossDocOnly,
      titleSimilarity
    });

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      Build Complete                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Created ${edgeCount} SAME_TOPIC edges`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - View stats: npx tsx src/cli/buildGraph.ts stats');
    console.log('   - Test graph expansion in API: POST /api/graph/expand');
    console.log('   - Query with graph context (coming soon)');
    console.log('');

    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  console.error('Run without arguments for usage information.');
  process.exit(1);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

