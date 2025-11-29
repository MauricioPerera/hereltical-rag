import { loadDocument, getAllDocuments } from '../db/jsonStore.js';
import { upsertEdges, type Edge } from '../db/graphStore.js';

/**
 * Markdown link patterns
 */
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

/**
 * Configuration for link detection
 */
export interface LinkDetectionConfig {
  detectMarkdownLinks: boolean;    // [text](url)
  detectWikiLinks: boolean;         // [[page]]
  crossDocumentOnly: boolean;       // Only create edges between different documents
  createBidirectional: boolean;     // Create reverse edges too
}

/**
 * Parse a markdown/wiki link to extract target
 */
interface ParsedLink {
  text: string;           // Link text
  target: string;         // Link target (url, path, or page name)
  type: 'markdown' | 'wiki';
}

/**
 * Extract all links from text
 */
function extractLinks(text: string, config: LinkDetectionConfig): ParsedLink[] {
  const links: ParsedLink[] = [];
  
  // Markdown links: [text](url)
  if (config.detectMarkdownLinks) {
    const markdownMatches = text.matchAll(MARKDOWN_LINK_PATTERN);
    for (const match of markdownMatches) {
      links.push({
        text: match[1],
        target: match[2],
        type: 'markdown'
      });
    }
  }
  
  // Wiki links: [[page]]
  if (config.detectWikiLinks) {
    const wikiMatches = text.matchAll(WIKILINK_PATTERN);
    for (const match of wikiMatches) {
      links.push({
        text: match[1],
        target: match[1],  // In wiki links, text = target
        type: 'wiki'
      });
    }
  }
  
  return links;
}

/**
 * Resolve a link target to a node ID
 * 
 * Supports:
 * - Internal anchors: #section-id
 * - Document references: doc-id#section-id
 * - Relative paths: ./other-doc.md#section
 * - Wiki-style: [[Document Title]] or [[Document Title#Section]]
 */
function resolveLink(target: string, currentDocId: string): string | null {
  // Remove .md extension if present
  target = target.replace(/\.md$/i, '');
  
  // Case 1: Just an anchor #section-id (within current document)
  if (target.startsWith('#')) {
    return `${currentDocId}${target}`;
  }
  
  // Case 2: doc-id#section-id
  if (target.includes('#')) {
    // Could be relative path or absolute
    // For now, treat everything after removing ./ as doc-id
    return target.replace(/^\.\//, '');
  }
  
  // Case 3: Just doc-id (points to document root)
  // Try to find document by ID or title
  return target;
}

/**
 * Check if a node exists in the database
 */
async function nodeExists(nodeId: string): Promise<boolean> {
  // Extract doc_id from node_id (format: doc-id#section or just doc-id)
  const [docId] = nodeId.split('#');
  
  const doc = await loadDocument(docId);
  if (!doc) return false;
  
  // If no section specified, node exists if document exists
  if (!nodeId.includes('#')) return true;
  
  // Check if specific node exists in document
  return !!doc.nodes[nodeId];
}

/**
 * Find node by title (fuzzy match)
 */
async function findNodeByTitle(title: string, currentDocId?: string): Promise<string | null> {
  const allDocs = await getAllDocuments();
  
  // Normalize title for comparison
  const normalizedTarget = title.toLowerCase().trim();
  
  for (const doc of allDocs) {
    // Skip current document if looking for cross-document links
    if (currentDocId && doc.docId === currentDocId) continue;
    
    // Check document title
    if (doc.title.toLowerCase().trim() === normalizedTarget) {
      return doc.docId;
    }
    
    // Check section titles
    function findInTree(node: any): string | null {
      if (node.title?.toLowerCase().trim() === normalizedTarget) {
        return node.id;
      }
      
      for (const child of node.children || []) {
        const found = findInTree(child);
        if (found) return found;
      }
      
      return null;
    }
    
    const found = findInTree(doc.root);
    if (found) return found;
  }
  
  return null;
}

/**
 * Detect REFERS_TO edges from markdown links in a single document
 */
export async function detectLinksInDocument(
  docId: string,
  config: Partial<LinkDetectionConfig> = {}
): Promise<Edge[]> {
  const defaultConfig: LinkDetectionConfig = {
    detectMarkdownLinks: true,
    detectWikiLinks: true,
    crossDocumentOnly: false,
    createBidirectional: false,
    ...config
  };
  
  const doc = await loadDocument(docId);
  if (!doc) {
    console.warn(`Document not found: ${docId}`);
    return [];
  }
  
  const edges: Edge[] = [];
  
  // Walk the document tree
  async function processNode(node: any) {
    const content = (node.content || []).join('\n');
    const links = extractLinks(content, defaultConfig);
    
    for (const link of links) {
      // Try to resolve the link
      let targetNodeId = resolveLink(link.target, docId);
      
      if (!targetNodeId) {
        // Try fuzzy match by title
        targetNodeId = await findNodeByTitle(link.target, docId);
      }
      
      if (!targetNodeId) {
        console.debug(`Could not resolve link: ${link.target} in ${node.id}`);
        continue;
      }
      
      // Check if node exists
      const exists = await nodeExists(targetNodeId);
      if (!exists) {
        console.debug(`Target node does not exist: ${targetNodeId}`);
        continue;
      }
      
      // Extract doc IDs
      const [sourceDoc] = node.id.split('#');
      const [targetDoc] = targetNodeId.split('#');
      
      // Skip if same document and crossDocumentOnly
      if (defaultConfig.crossDocumentOnly && sourceDoc === targetDoc) {
        continue;
      }
      
      // Create edge
      edges.push({
        from_node_id: node.id,
        to_node_id: targetNodeId,
        type: 'REFERS_TO',
        metadata: {
          linkText: link.text,
          linkType: link.type,
          originalTarget: link.target
        }
      });
      
      // Create bidirectional edge if configured
      if (defaultConfig.createBidirectional) {
        edges.push({
          from_node_id: targetNodeId,
          to_node_id: node.id,
          type: 'REFERS_TO',
          metadata: {
            linkText: link.text,
            linkType: link.type,
            originalTarget: link.target,
            bidirectional: true
          }
        });
      }
    }
    
    // Process children
    for (const child of node.children || []) {
      await processNode(child);
    }
  }
  
  // Start from root
  await processNode(doc.root);
  
  return edges;
}

/**
 * Detect REFERS_TO edges across all documents
 */
export async function detectLinksInAllDocuments(
  config: Partial<LinkDetectionConfig> = {}
): Promise<number> {
  console.log('🔍 Detecting REFERS_TO edges from markdown links...');
  
  const allDocs = await getAllDocuments();
  console.log(`   Processing ${allDocs.length} documents`);
  
  let totalEdges = 0;
  
  for (const doc of allDocs) {
    const edges = await detectLinksInDocument(doc.docId, config);
    
    if (edges.length > 0) {
      console.log(`   ${doc.docId}: Found ${edges.length} links`);
      upsertEdges(edges);
      totalEdges += edges.length;
    }
  }
  
  console.log(`✅ Created ${totalEdges} REFERS_TO edges`);
  
  return totalEdges;
}

/**
 * Get statistics about links in documents
 */
export async function getLinkStatistics(): Promise<{
  totalDocuments: number;
  documentsWithLinks: number;
  totalLinks: number;
  linksByType: Record<string, number>;
  crossDocumentLinks: number;
}> {
  const allDocs = await getAllDocuments();
  
  let documentsWithLinks = 0;
  let totalLinks = 0;
  const linksByType: Record<string, number> = {
    markdown: 0,
    wiki: 0
  };
  let crossDocumentLinks = 0;
  
  for (const doc of allDocs) {
    const edges = await detectLinksInDocument(doc.docId, {
      detectMarkdownLinks: true,
      detectWikiLinks: true,
      crossDocumentOnly: false,
      createBidirectional: false
    });
    
    if (edges.length > 0) {
      documentsWithLinks++;
      totalLinks += edges.length;
      
      for (const edge of edges) {
        const linkType = edge.metadata?.linkType;
        if (linkType) {
          linksByType[linkType] = (linksByType[linkType] || 0) + 1;
        }
        
        // Check if cross-document
        const [sourceDoc] = edge.from_node_id.split('#');
        const [targetDoc] = edge.to_node_id.split('#');
        if (sourceDoc !== targetDoc) {
          crossDocumentLinks++;
        }
      }
    }
  }
  
  return {
    totalDocuments: allDocs.length,
    documentsWithLinks,
    totalLinks,
    linksByType,
    crossDocumentLinks
  };
}

