import { App, normalizePath } from "obsidian";
import type { DocLearnerSettings } from "../types";

interface DashboardEntry {
  path: string;
  title: string;
  status: string;
  impact: string;
  detected: string;
  site: string;
}

export class DashboardGenerator {
  constructor(
    private app: App,
    private settings: DocLearnerSettings
  ) {}

  async regenerate(): Promise<void> {
    const entries = await this.collectEntries();
    const content = this.render(entries);
    const dashPath = normalizePath(`${this.settings.outputRoot}/_dashboard.md`);
    await this.app.vault.adapter.write(dashPath, content);
  }

  private async collectEntries(): Promise<DashboardEntry[]> {
    const root = normalizePath(this.settings.outputRoot);
    if (!(await this.app.vault.adapter.exists(root))) return [];

    const entries: DashboardEntry[] = [];
    await this.walkForNotes(root, entries);
    entries.sort((a, b) => b.detected.localeCompare(a.detected));
    return entries;
  }

  private async walkForNotes(dir: string, entries: DashboardEntry[]): Promise<void> {
    const listing = await this.app.vault.adapter.list(dir);

    for (const file of listing.files) {
      if (file.endsWith("_dashboard.md") || file.endsWith("_changelog.md")) continue;
      if (!file.endsWith(".md")) continue;

      try {
        const raw = await this.app.vault.adapter.read(file);
        const parsed = this.parseFrontmatter(raw);
        if (parsed) {
          entries.push({
            path: file,
            title: String(parsed["title"] ?? file.split("/").pop()?.replace(".md", "")),
            status: String(parsed["status"] ?? "unread"),
            impact: String(parsed["impact"] ?? "medium"),
            detected: String(parsed["detected"] ?? ""),
            site: String(parsed["site"] ?? ""),
          });
        }
      } catch {
        // skip
      }
    }

    for (const subdir of listing.folders) {
      await this.walkForNotes(subdir, entries);
    }
  }

  private render(entries: DashboardEntry[]): string {
    const fm = [
      "---",
      "title: Doc Learner Dashboard",
      `updated: ${new Date().toISOString().split("T")[0]}`,
      "tags: [doc-learner, dashboard]",
      "---",
    ].join("\n");

    const sections: string[] = [fm, "", "# Doc Learner ダッシュボード\n"];

    const unread = entries.filter((e) => e.status === "unread");
    const inProgress = entries.filter((e) => e.status === "in_progress");
    const learned = entries.filter((e) => e.status === "learned");

    if (unread.length > 0) {
      sections.push(`## 未読 (${unread.length})\n`);
      sections.push(this.renderTable(unread));
    }

    if (inProgress.length > 0) {
      sections.push(`## 学習中 (${inProgress.length})\n`);
      sections.push(this.renderTable(inProgress));
    }

    if (learned.length > 0) {
      sections.push(`## 完了 (${learned.length})\n`);
      sections.push(this.renderTable(learned));
    }

    if (entries.length === 0) {
      sections.push("> まだ変更が検出されていません。サイドパネルから手動チェックを実行するか、自動チェックをお待ちください。\n");
    }

    return sections.join("\n");
  }

  private renderTable(entries: DashboardEntry[]): string {
    const header = "| 日付 | サイト | タイトル | 影響度 |\n|---|---|---|---|\n";
    const rows = entries.map((e) => {
      const link = `[[${e.path}|${e.title}]]`;
      const badge = e.impact === "high" ? "🔴" : e.impact === "medium" ? "🟡" : "🟢";
      return `| ${e.detected} | ${e.site} | ${link} | ${badge} ${e.impact} |`;
    });
    return header + rows.join("\n") + "\n";
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
      if (val.startsWith("[") && val.endsWith("]")) {
        result[key] = val
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      } else {
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        result[key] = val;
      }
    }
    return result;
  }
}
