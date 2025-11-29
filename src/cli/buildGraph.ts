#!/usr/bin/env node

import { buildSameTopicGraph } from '../graph/relationsDetector.js';
import { getGraphStats } from '../db/graphStore.js';

/**
 * CLI tool to build graph edges
 * 
 * Usage:
 *   npx tsx src/cli/buildGraph.ts same-topic
 *   npx tsx src/cli/buildGraph.ts same-topic --min-similarity 0.85
 *   npx tsx src/cli/buildGraph.ts concepts --doc <docId>
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
    console.log('  refers-to        Build REFERS_TO edges from markdown links');
    console.log('  concepts         Build MENTIONS/DEFINES edges from entity extraction ⭐ NEW');
    console.log('  stats            Show graph statistics');
    console.log('');
    console.log('Options for same-topic:');
    console.log('  --min-similarity <value>   Minimum similarity threshold (default: 0.80)');
    console.log('  --max-connections <value>  Max connections per node (default: 5)');
    console.log('  --include-same-doc         Include same-document connections (default: cross-doc only)');
    console.log('  --use-title-sim            Use title similarity as well (default: false)');
    console.log('');
    console.log('Options for refers-to:');
    console.log('  --cross-doc-only           Only create cross-document links (default: false)');
    console.log('  --bidirectional            Create reverse edges too (default: false)');
    console.log('  --no-markdown              Disable markdown link detection (default: enabled)');
    console.log('  --no-wiki                  Disable wiki link detection (default: enabled)');
    console.log('');
    console.log('Options for concepts:');
    console.log('  --doc <docId>              Process specific document');
    console.log('  --all                      Process all indexed documents');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/cli/buildGraph.ts same-topic');
    console.log('  npx tsx src/cli/buildGraph.ts same-topic --min-similarity 0.85');
    console.log('  npx tsx src/cli/buildGraph.ts refers-to');
    console.log('  npx tsx src/cli/buildGraph.ts concepts --doc my-document');
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

  if (command === 'refers-to') {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           Building REFERS_TO Edges (Markdown Links)           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Parse options
    let crossDocOnly = false;
    let bidirectional = false;
    let markdownLinks = true;
    let wikiLinks = true;

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--cross-doc-only') {
        crossDocOnly = true;
      } else if (arg === '--bidirectional') {
        bidirectional = true;
      } else if (arg === '--no-markdown') {
        markdownLinks = false;
      } else if (arg === '--no-wiki') {
        wikiLinks = false;
      }
    }

    console.log('⚙️  Configuration:');
    console.log(`   Markdown links [text](url): ${markdownLinks}`);
    console.log(`   Wiki links [[page]]: ${wikiLinks}`);
    console.log(`   Cross-doc only: ${crossDocOnly}`);
    console.log(`   Bidirectional: ${bidirectional}`);
    console.log('');

    const { detectLinksInAllDocuments } = await import('../graph/linkDetector.js');
    
    const edgeCount = await detectLinksInAllDocuments({
      detectMarkdownLinks: markdownLinks,
      detectWikiLinks: wikiLinks,
      crossDocumentOnly: crossDocOnly,
      createBidirectional: bidirectional
    });

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      Build Complete                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Created ${edgeCount} REFERS_TO edges`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - View stats: npx tsx src/cli/buildGraph.ts stats');
    console.log('   - Query with graph: POST /api/query/smart');
    console.log('');

    process.exit(0);
  }

  if (command === 'concepts') {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         Building Concept Graph (NER + MENTIONS/DEFINES)        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    const { persistConceptGraph, getConceptStats } = await import('../graph/conceptGraph.js');
    
    // Parse options
    let docId: string | undefined;
    let processAll = false;

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--doc' && args[i + 1]) {
        docId = args[i + 1];
        i++;
      } else if (arg === '--all') {
        processAll = true;
      }
    }

    if (!docId && !processAll) {
      console.error('❌ Please specify --doc <docId> or --all');
      process.exit(1);
    }

    if (docId) {
      console.log(`📄 Processing document: ${docId}`);
      console.log('');

      try {
        // First show concept stats
        const stats = await getConceptStats(docId);
        console.log('📊 Concept Statistics:');
        console.log(`   Technologies: ${stats.summary.technologies}`);
        console.log(`   Concepts: ${stats.summary.concepts}`);
        console.log(`   Code refs: ${stats.summary.codeRefs}`);
        console.log(`   Acronyms: ${stats.summary.acronyms}`);
        console.log('');

        // Show top concepts
        const topConcepts = stats.concepts.slice(0, 10);
        if (topConcepts.length > 0) {
          console.log('🔝 Top Concepts:');
          for (const c of topConcepts) {
            console.log(`   ${c.name} (${c.type}) - ${c.frequency}x`);
          }
          console.log('');
        }

        // Build and persist
        console.log('🔨 Building graph edges...');
        const result = await persistConceptGraph(docId);
        
        console.log('');
        console.log('✅ Complete!');
        console.log(`   Concepts: ${result.conceptsCreated}`);
        console.log(`   Edges: ${result.edgesCreated}`);
      } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
      }
    }

    console.log('');
    console.log('💡 Next steps:');
    console.log('   - View stats: npx tsx src/cli/buildGraph.ts stats');
    console.log('   - API: GET /api/graph/concepts/:docId');
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

