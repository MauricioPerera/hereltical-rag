import { SectionNode } from './db/jsonStore.js';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

/**
 * Parses a markdown file and converts it to a hierarchical SectionNode tree.
 * 
 * @param filePath - Path to the markdown file
 * @returns Root SectionNode representing the document
 */
export async function parseMarkdownFile(filePath: string): Promise<SectionNode> {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseMarkdownContent(content, filePath);
}

/**
 * Parses markdown content string and converts it to a hierarchical SectionNode tree.
 * 
 * @param content - Markdown content as string
 * @param docId - Optional document identifier (defaults to hash of content)
 * @returns Root SectionNode representing the document
 */
export function parseMarkdownContent(content: string, docId?: string): SectionNode {
    // Normalize line endings (handle CRLF from Windows)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');

    // Detect document title (first H1 or use docId)
    const firstH1Match = content.match(/^#\s+(.+)$/m);
    const docTitle = firstH1Match ? firstH1Match[1] : (docId || 'Untitled Document');

    // Create root node
    const root: SectionNode = {
        id: docId || generateId(docTitle),
        type: 'document',
        level: 0,
        title: docTitle,
        content: [],
        children: []
    };

    // Stack to track current hierarchy
    const nodeStack: SectionNode[] = [root];
    let currentContent: string[] = [];
    let lineIndex = 0;
    let h1Found = false; // Track if we've seen the first H1

    while (lineIndex < lines.length) {
        const line = lines[lineIndex];
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {
            // Flush current content to the last node
            if (currentContent.length > 0) {
                const currentNode = nodeStack[nodeStack.length - 1];
                const paragraph = currentContent.join(' ');
                if (paragraph.trim()) {
                    currentNode.content.push(paragraph);
                }
                currentContent = [];
            }

            const level = headingMatch[1].length;
            const title = headingMatch[2].trim();

            // Skip the first H1 (it's used as document title)
            if (level === 1 && !h1Found) {
                h1Found = true;
                lineIndex++;
                continue;
            }

            // Only process H2, H3 (levels 2, 3)
            if (level === 2 || level === 3) {
                // Pop stack until we find the right parent
                while (nodeStack.length > 1 && nodeStack[nodeStack.length - 1].level >= level) {
                    nodeStack.pop();
                }

                // Create new section node
                const newNode: SectionNode = {
                    id: generateId(title),
                    type: 'section',
                    level,
                    title,
                    content: [],
                    children: []
                };

                // Add to parent
                const parent = nodeStack[nodeStack.length - 1];
                parent.children.push(newNode);

                // Push to stack
                nodeStack.push(newNode);
            }
        } else {
            // Accumulate content
            const trimmed = line.trim();
            if (trimmed) {
                currentContent.push(trimmed);
            } else if (currentContent.length > 0) {
                // Empty line marks paragraph break, flush current content
                const currentNode = nodeStack[nodeStack.length - 1];
                const paragraph = currentContent.join(' ');
                if (paragraph.trim()) {
                    currentNode.content.push(paragraph);
                }
                currentContent = [];
            }
        }

        lineIndex++;
    }

    // Flush any remaining content
    if (currentContent.length > 0) {
        const currentNode = nodeStack[nodeStack.length - 1];
        const paragraph = currentContent.join(' ');
        if (paragraph.trim()) {
            currentNode.content.push(paragraph);
        }
    }

    return root;
}

/**
 * Generates a stable ID from a title
 */
function generateId(title: string): string {
    // Create URL-safe slug
    const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

    // Add short hash for uniqueness
    const hash = crypto.createHash('md5').update(title).digest('hex').substring(0, 8);

    return `${slug}-${hash}`;
}

/**
 * Extracts all text content from a SectionNode tree (for full-text search)
 */
export function extractAllText(node: SectionNode): string {
    let text = `${node.title}\n${node.content.join('\n')}`;

    for (const child of node.children) {
        text += '\n' + extractAllText(child);
    }

    return text;
}

/**
 * Counts total sections in the tree
 */
export function countSections(node: SectionNode): number {
    let count = node.type === 'section' ? 1 : 0;

    for (const child of node.children) {
        count += countSections(child);
    }

    return count;
}
