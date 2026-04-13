import type { MarkdownSection } from "../types";

/**
 * Split Markdown content into sections by heading hierarchy.
 * Tracks heading nesting to produce full paths like "## CLI > ### Flags".
 */
export function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split("\n");
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;
  const headingStack: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();

      while (headingStack.length >= level) headingStack.pop();
      headingStack.push(heading);
      const fullPath = headingStack.join(" > ");

      current = { heading, level, content: line + "\n", fullPath };
    } else if (current) {
      current.content += line + "\n";
    } else {
      if (line.trim()) {
        current = {
          heading: "(preamble)",
          level: 0,
          content: line + "\n",
          fullPath: "(preamble)",
        };
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * Extract the title from Markdown content.
 * Checks YAML frontmatter `title:` first, then falls back to the first `# ` heading.
 */
export function extractTitle(markdown: string): string | null {
  const fmMatch = markdown.match(/^---[\s\S]*?title:\s*["']?(.+?)["']?\s*$/m);
  if (fmMatch) return fmMatch[1];

  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  return null;
}

/**
 * Extract all headings from Markdown content up to a given depth.
 */
export function extractHeadings(markdown: string, maxLevel: number = 3): string[] {
  const headings: string[] = [];
  const re = new RegExp(`^(#{1,${maxLevel}})\\s+(.+)$`, "gm");
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    headings.push(m[2].trim());
  }
  return headings;
}

/**
 * Strip YAML frontmatter from Markdown content.
 */
export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("---", 3);
  if (end === -1) return markdown;
  return markdown.substring(end + 3).trim();
}
