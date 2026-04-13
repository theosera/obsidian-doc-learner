import { App, normalizePath } from "obsidian";
import type { DocLearnerSettings } from "../types";
import { toDateString } from "../utils/date";

interface PathEntry {
  path: string;
  title: string;
  category: string;
  impact: string;
  status: string;
  detected: string;
  site: string;
}

/**
 * Generates a learning-path.md roadmap for each monitored site.
 * Groups learning notes by category and orders by impact/date.
 */
export class LearningPathGenerator {
  constructor(
    private app: App,
    private settings: DocLearnerSettings
  ) {}

  async generate(): Promise<void> {
    for (const site of this.settings.sites) {
      if (!site.enabled) continue;
      const siteDir = normalizePath(`${this.settings.outputRoot}/${site.id}`);
      if (!(await this.app.vault.adapter.exists(siteDir))) continue;
      await this.generateForSite(site.name, site.id, siteDir);
    }
  }

  private async generateForSite(
    siteName: string,
    siteId: string,
    siteDir: string
  ): Promise<void> {
    const entries = await this.collectEntries(siteDir);
    if (entries.length === 0) return;

    const content = this.render(siteName, siteId, entries);
    const outPath = normalizePath(`${siteDir}/learning-path.md`);
    await this.app.vault.adapter.write(outPath, content);
  }

  private async collectEntries(dir: string): Promise<PathEntry[]> {
    const listing = await this.app.vault.adapter.list(dir);
    const entries: PathEntry[] = [];

    for (const file of listing.files) {
      if (!file.endsWith(".md")) continue;
      if (file.endsWith("learning-path.md") || file.endsWith("_dashboard.md")) continue;

      try {
        const raw = await this.app.vault.adapter.read(file);
        const fm = this.parseFrontmatter(raw);
        if (!fm) continue;
        entries.push({
          path: file,
          title: String(fm["title"] ?? file.split("/").pop()?.replace(".md", "")),
          category: String(fm["category"] ?? "doc_fix"),
          impact: String(fm["impact"] ?? "medium"),
          status: String(fm["status"] ?? "unread"),
          detected: String(fm["detected"] ?? ""),
          site: String(fm["site"] ?? ""),
        });
      } catch {
        // skip unreadable
      }
    }

    return entries;
  }

  private render(siteName: string, _siteId: string, entries: PathEntry[]): string {
    const fm = [
      "---",
      `title: "${siteName} 学習ロードマップ"`,
      `updated: ${toDateString()}`,
      "tags: [doc-learner, learning-path]",
      "---",
    ].join("\n");

    const sections: string[] = [fm, "", `# ${siteName} 学習ロードマップ\n`];

    const impactOrder = { high: 0, medium: 1, low: 2 };
    const categoryLabels: Record<string, string> = {
      new_feature: "新機能",
      improvement: "機能改善",
      bugfix: "バグ修正",
      deprecation: "非推奨化",
      doc_fix: "ドキュメント修正",
    };

    const byCategory = new Map<string, PathEntry[]>();
    for (const e of entries) {
      const cat = e.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(e);
    }

    const categoryOrder = ["new_feature", "improvement", "deprecation", "bugfix", "doc_fix"];

    for (const cat of categoryOrder) {
      const catEntries = byCategory.get(cat);
      if (!catEntries || catEntries.length === 0) continue;

      const label = categoryLabels[cat] ?? cat;
      sections.push(`## ${label}\n`);

      catEntries.sort((a, b) => {
        const ia = impactOrder[a.impact as keyof typeof impactOrder] ?? 1;
        const ib = impactOrder[b.impact as keyof typeof impactOrder] ?? 1;
        if (ia !== ib) return ia - ib;
        return b.detected.localeCompare(a.detected);
      });

      for (const e of catEntries) {
        const statusIcon = e.status === "learned" ? "✅" : e.status === "in_progress" ? "🔄" : "📖";
        const impactBadge = e.impact === "high" ? "🔴" : e.impact === "medium" ? "🟡" : "🟢";
        sections.push(`- ${statusIcon} ${impactBadge} [[${e.path}|${e.title}]] (${e.detected})`);
      }
      sections.push("");
    }

    const total = entries.length;
    const learned = entries.filter((e) => e.status === "learned").length;
    const progress = total > 0 ? Math.round((learned / total) * 100) : 0;
    sections.push(`## 進捗\n`);
    sections.push(`- 全体: ${learned}/${total} (${progress}%)`);
    sections.push(`- 未読: ${entries.filter((e) => e.status === "unread").length}`);
    sections.push(`- 学習中: ${entries.filter((e) => e.status === "in_progress").length}`);
    sections.push(`- 完了: ${learned}`);
    sections.push("");

    return sections.join("\n");
  }

  private parseFrontmatter(raw: string): Record<string, unknown> | null {
    if (!raw.startsWith("---")) return null;
    const end = raw.indexOf("---", 3);
    if (end === -1) return null;
    const block = raw.substring(3, end).trim();
    const result: Record<string, unknown> = {};
    for (const line of block.split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      result[key] = val;
    }
    return result;
  }
}
