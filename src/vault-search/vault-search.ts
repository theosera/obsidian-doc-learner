import * as fs from "fs";
import * as path from "path";
import type { RelatedNote, AIAnalysis, DocLearnerSettings } from "../types";

/**
 * Scans iCloud Vault for notes related to a given AI analysis.
 * Uses keyword matching against file paths, frontmatter titles, and content headings.
 * Only returns notes above the minimum relevance score.
 */
export class VaultSearch {
  private indexCache: VaultEntry[] | null = null;
  private lastIndexTime = 0;
  private readonly INDEX_TTL_MS = 5 * 60 * 1000;

  constructor(private settings: DocLearnerSettings) {}

  async findRelated(analysis: AIAnalysis): Promise<RelatedNote[]> {
    const entries = await this.getIndex();
    const keywords = this.extractKeywords(analysis);
    if (keywords.length === 0) return [];

    const scored: RelatedNote[] = [];

    for (const entry of entries) {
      const score = this.computeScore(entry, keywords);
      if (score >= this.settings.relatedNoteMinScore) {
        scored.push({
          path: entry.relativePath,
          title: entry.title,
          score,
          snippet: entry.headings.slice(0, 3).join(" / ") || entry.relativePath,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.settings.maxRelatedNotes);
  }

  private extractKeywords(analysis: AIAnalysis): string[] {
    const raw = [
      analysis.title,
      ...analysis.relatedTopics,
      ...analysis.learningActions,
    ].join(" ");

    const tokens = raw
      .toLowerCase()
      .replace(/[^\w\sぁ-んァ-ヶ亜-熙ー]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const stopWords = new Set([
      "the", "and", "for", "with", "this", "that", "from", "have", "been",
      "will", "can", "are", "was", "were", "not", "but", "all", "use",
      "する", "ある", "いる", "なる", "れる", "られる", "こと", "もの", "ため",
    ]);

    const unique = [...new Set(tokens.filter((t) => !stopWords.has(t)))];
    return unique.slice(0, 20);
  }

  private computeScore(entry: VaultEntry, keywords: string[]): number {
    let score = 0;
    const pathLower = entry.relativePath.toLowerCase();
    const titleLower = entry.title.toLowerCase();
    const headingsLower = entry.headings.join(" ").toLowerCase();

    for (const kw of keywords) {
      if (pathLower.includes(kw)) score += 0.15;
      if (titleLower.includes(kw)) score += 0.25;
      if (headingsLower.includes(kw)) score += 0.10;
    }

    // Normalize by keyword count so single strong matches still score well
    return Math.min(score / Math.max(keywords.length * 0.1, 1), 1.0);
  }

  private async getIndex(): Promise<VaultEntry[]> {
    const now = Date.now();
    if (this.indexCache && now - this.lastIndexTime < this.INDEX_TTL_MS) {
      return this.indexCache;
    }

    const vaultRoot = this.resolveVaultRoot();
    if (!vaultRoot || !fs.existsSync(vaultRoot)) {
      console.warn("[doc-learner] Source vault not found:", vaultRoot);
      return [];
    }

    this.indexCache = await this.buildIndex(vaultRoot);
    this.lastIndexTime = now;
    return this.indexCache;
  }

  private resolveVaultRoot(): string | null {
    const pattern = this.settings.sourceVaultPattern;
    const currentYear = new Date().getFullYear();

    for (let y = currentYear; y >= currentYear - 2; y--) {
      const resolved = pattern.replace("{year}", String(y));
      if (fs.existsSync(resolved)) return resolved;
    }
    return null;
  }

  private async buildIndex(root: string): Promise<VaultEntry[]> {
    const entries: VaultEntry[] = [];
    const skipDirs = new Set([
      ".obsidian", ".trash", "_assets", "Excalidraw", "Templates",
      ".doc-learner", "__skills", "node_modules",
    ]);

    const walk = (dir: string): void => {
      let items: fs.Dirent[];
      try {
        items = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const item of items) {
        if (item.name.startsWith(".") && item.name !== ".md") continue;

        const full = path.join(dir, item.name);

        if (item.isDirectory()) {
          if (!skipDirs.has(item.name)) walk(full);
          continue;
        }

        if (!item.name.endsWith(".md")) continue;

        try {
          const entry = this.parseEntry(full, root);
          if (entry) entries.push(entry);
        } catch {
          // skip unreadable files
        }
      }
    };

    walk(root);
    return entries;
  }

  private parseEntry(filePath: string, root: string): VaultEntry | null {
    const stat = fs.statSync(filePath);
    if (stat.size > 500_000) return null; // skip very large files

    const relativePath = path.relative(root, filePath).replace(/\.md$/, "");
    const raw = fs.readFileSync(filePath, "utf-8");
    const first4k = raw.substring(0, 4096);

    let title = path.basename(filePath, ".md");
    const titleMatch = first4k.match(/^---[\s\S]*?title:\s*["']?(.+?)["']?\s*$/m);
    if (titleMatch) title = titleMatch[1];

    const headingMatch = first4k.match(/^#\s+(.+)$/m);
    if (!titleMatch && headingMatch) title = headingMatch[1];

    const headings: string[] = [];
    const headingRe = /^#{1,3}\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(first4k)) !== null) {
      headings.push(m[1].toLowerCase());
    }

    return { relativePath, title, headings };
  }

  clearCache(): void {
    this.indexCache = null;
    this.lastIndexTime = 0;
  }
}

interface VaultEntry {
  relativePath: string;
  title: string;
  headings: string[];
}
