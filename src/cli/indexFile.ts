#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseMarkdownFile } from '../markdownParser.js';
import { saveDocument, Document } from '../db/jsonStore.js';
import { syncDocument } from '../indexer.js';

/**
 * Index a markdown file from the filesystem
 * @param filePath - Path to the markdown file
 * @param docId - Optional custom document ID (defaults to filename without extension)
 */
export async function indexMarkdownFile(filePath: string, docId?: string): Promise<void> {
    try {
        // Check if file exists
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            throw new Error(`${filePath} is not a file`);
        }

        // Generate docId from filename if not provided
        const fileName = path.basename(filePath, path.extname(filePath));
        const documentId = docId || fileName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        console.log(`\n📄 Indexing file: ${filePath}`);
        console.log(`🆔 Document ID: ${documentId}\n`);

        // Parse the markdown file
        const root = await parseMarkdownFile(filePath);

        // Build nodes map
        const nodes: Document['nodes'] = {};

        function buildNodesMap(node: typeof root, parentId: string | null = null) {
            nodes[node.id] = {
                id: node.id,
                parentId,
                childrenIds: node.children.map(c => c.id),
                level: node.level
            };

            node.children.forEach(child => buildNodesMap(child, node.id));
        }

        buildNodesMap(root);

        // Create document
        const doc: Document = {
            docId: documentId,
            title: root.title,
            version: 1,
            root,
            nodes
        };

        // Save to JSON store
        await saveDocument(doc);
        console.log(`💾 Saved to JSON store`);

        // Sync to vector store
        await syncDocument(doc);

        console.log(`\n✅ Successfully indexed document:`);
        console.log(`   Title: ${doc.title}`);
        console.log(`   Sections: ${Object.keys(nodes).length}`);
        console.log(`   DocID: ${documentId}\n`);

    } catch (error) {
        console.error(`\n❌ Error indexing file:`, error);
        throw error;
    }
}

/**
 * Index all markdown files in a directory
 * @param dirPath - Path to directory containing markdown files
 */
export async function indexDirectory(dirPath: string): Promise<void> {
    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            throw new Error(`${dirPath} is not a directory`);
        }

        const files = await fs.readdir(dirPath);
        const markdownFiles = files.filter(f => 
            f.endsWith('.md') || f.endsWith('.markdown')
        );

        if (markdownFiles.length === 0) {
            console.log(`No markdown files found in ${dirPath}`);
            return;
        }

        console.log(`\n📁 Found ${markdownFiles.length} markdown file(s) in ${dirPath}\n`);

        for (const file of markdownFiles) {
            const filePath = path.join(dirPath, file);
            await indexMarkdownFile(filePath);
        }

        console.log(`\n✅ Indexed all ${markdownFiles.length} file(s)\n`);

    } catch (error) {
        console.error(`\n❌ Error indexing directory:`, error);
        throw error;
    }
}

// CLI usage - run if this file is being executed directly
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Usage:
  Index a single file:
    tsx src/cli/indexFile.ts <file-path> [doc-id]

  Index a directory:
    tsx src/cli/indexFile.ts --dir <directory-path>

Examples:
  tsx src/cli/indexFile.ts ./docs/guide.md
  tsx src/cli/indexFile.ts ./docs/guide.md custom-doc-id
  tsx src/cli/indexFile.ts --dir ./docs
        `);
        process.exit(1);
    }

    if (args[0] === '--dir') {
        if (args.length < 2) {
            console.error('Error: Directory path required');
            process.exit(1);
        }
        await indexDirectory(args[1]);
    } else {
        const filePath = args[0];
        const docId = args[1];
        await indexMarkdownFile(filePath, docId);
    }
}

// Check if running as main module
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
    main().catch(error => {
        console.error('\nFatal error:', error);
        process.exit(1);
    });
}

