import { describe, it, expect } from 'vitest';
import { parseMarkdownContent, extractAllText, countSections } from '../src/markdownParser';

describe('markdownParser', () => {
    describe('parseMarkdownContent', () => {
        it('should parse a simple markdown with H1 and H2', () => {
            const markdown = `# Main Title

This is the introduction paragraph.

## Chapter 1

Intro to chapter 1.

### Section 1.1

Details about 1.1.

### Section 1.2

Details about 1.2.

## Chapter 2

Intro to chapter 2.`;

            const result = parseMarkdownContent(markdown);

            expect(result.children.length).toBe(2);
            expect(result.children[0].title).toBe('Chapter 1');
            expect(result.children[0].children.length).toBe(2);
            expect(result.children[0].children[0].title).toBe('Section 1.1');
            expect(result.children[0].children[1].title).toBe('Section 1.2');
            expect(result.children[1].title).toBe('Chapter 2');
        });

        it('should handle documents without H1', () => {
            const markdown = `## First Section

Some content here.

## Second Section

More content.`;

            const result = parseMarkdownContent(markdown, 'no-h1-doc');

            expect(result.title).toBe('no-h1-doc');
            expect(result.children.length).toBe(2);
        });

        it('should ignore headings deeper than H3', () => {
            const markdown = `# Title

## Section

### Subsection

#### Too Deep

This content should belong to Subsection.


## Another Section

With content.`;

            const result = parseMarkdownContent(markdown);

            expect(result.children.length).toBe(2);
            expect(result.children[0].children.length).toBe(1);
            expect(result.children[0].children[0].content).toContain('This content should belong to Subsection.');
            expect(result.children[1].content).toContain('With content.');
        });

        it('should preserve paragraph breaks', () => {
            const markdown = `# Doc

## Section

First paragraph.

Second paragraph after blank line.

Third paragraph.`;

            const result = parseMarkdownContent(markdown);

            const section = result.children[0];
            expect(section.content.length).toBe(3);
            expect(section.content[0]).toBe('First paragraph.');
            expect(section.content[1]).toBe('Second paragraph after blank line.');
            expect(section.content[2]).toBe('Third paragraph.');
        });
    });

    describe('extractAllText', () => {
        it('should extract all text from tree', () => {
            const markdown = `# Main

Root content.

## Child 1

Child 1 content.

## Child 2

Child 2 content.`;

            const tree = parseMarkdownContent(markdown);
            const text = extractAllText(tree);

            expect(text).toContain('Main');
            expect(text).toContain('Root content');
            expect(text).toContain('Child 1');
            expect(text).toContain('Child 1 content');
            expect(text).toContain('Child 2');
            expect(text).toContain('Child 2 content');
        });
    });

    describe('countSections', () => {
        it('should count all sections correctly', () => {
            const markdown = `# Doc

## Section 1

### Subsection 1.1

### Subsection 1.2

## Section 2`;

            const tree = parseMarkdownContent(markdown);
            const count = countSections(tree);

            // Should count: Section 1, Subsection 1.1, Subsection 1.2, Section 2 = 4
            expect(count).toBe(4);
        });

        it('should return 0 for document-only tree', () => {
            const markdown = `# Just a title

Some content.`;

            const tree = parseMarkdownContent(markdown);
            const count = countSections(tree);

            // Document root has content but no sections (H2/H3)
            // Since there's no H2 or H3, only the H1 which becomes the root document
            expect(count).toBe(0);
        });
    });
});
