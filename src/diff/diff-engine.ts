import type { DiffResult, MarkdownSection, Snapshot, SiteConfig } from "../types";

export class DiffEngine {
  computeDiffs(
    current: Snapshot,
    previous: Snapshot | null,
    siteConfig: SiteConfig
  ): DiffResult[] {
    if (!previous) {
      return current.pages.map((page) => ({
        siteId: current.siteId,
        siteName: siteConfig.name,
        page: page.path,
        pageUrl: page.url,
        section: "(全体)",
        changeType: "added" as const,
        after: page.content,
        detectedAt: current.timestamp,
      }));
    }

    const results: DiffResult[] = [];
    const prevMap = new Map(previous.pages.map((p) => [p.path, p]));
    const currMap = new Map(current.pages.map((p) => [p.path, p]));

    for (const curr of current.pages) {
      const prev = prevMap.get(curr.path);
      if (!prev) {
        results.push({
          siteId: current.siteId,
          siteName: siteConfig.name,
          page: curr.path,
          pageUrl: curr.url,
          section: "(新規ページ)",
          changeType: "added",
          after: curr.content,
          detectedAt: current.timestamp,
        });
        continue;
      }

      if (prev.contentHash === curr.contentHash) continue;

      const sectionDiffs = this.diffSections(
        this.parseSections(prev.content),
        this.parseSections(curr.content),
        current.siteId,
        siteConfig.name,
        curr.path,
        curr.url,
        current.timestamp
      );
      results.push(...sectionDiffs);
    }

    for (const prev of previous.pages) {
      if (!currMap.has(prev.path)) {
        results.push({
          siteId: current.siteId,
          siteName: siteConfig.name,
          page: prev.path,
          pageUrl: prev.url,
          section: "(ページ削除)",
          changeType: "removed",
          before: prev.content,
          detectedAt: current.timestamp,
        });
      }
    }

    return results;
  }

  parseSections(markdown: string): MarkdownSection[] {
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

  private diffSections(
    oldSections: MarkdownSection[],
    newSections: MarkdownSection[],
    siteId: string,
    siteName: string,
    page: string,
    pageUrl: string,
    detectedAt: string
  ): DiffResult[] {
    const results: DiffResult[] = [];
    const oldMap = new Map(oldSections.map((s) => [s.fullPath, s]));
    const newMap = new Map(newSections.map((s) => [s.fullPath, s]));

    for (const [path, newSec] of newMap) {
      const oldSec = oldMap.get(path);
      if (!oldSec) {
        results.push({
          siteId,
          siteName,
          page,
          pageUrl,
          section: path,
          changeType: "added",
          after: newSec.content.trim(),
          detectedAt,
        });
      } else if (this.normalizeWhitespace(oldSec.content) !== this.normalizeWhitespace(newSec.content)) {
        results.push({
          siteId,
          siteName,
          page,
          pageUrl,
          section: path,
          changeType: "modified",
          before: oldSec.content.trim(),
          after: newSec.content.trim(),
          detectedAt,
        });
      }
    }

    for (const [path, oldSec] of oldMap) {
      if (!newMap.has(path)) {
        results.push({
          siteId,
          siteName,
          page,
          pageUrl,
          section: path,
          changeType: "removed",
          before: oldSec.content.trim(),
          detectedAt,
        });
      }
    }

    return results;
  }

  private normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, " ").trim();
  }
}
