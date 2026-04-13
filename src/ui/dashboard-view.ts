import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type DocLearnerPlugin from "../main";
import { relativeTimeJa } from "../utils/date";

export const DASHBOARD_VIEW_TYPE = "doc-learner-dashboard";

interface DashboardEntry {
  path: string;
  title: string;
  status: string;
  impact: string;
  detected: string;
  site: string;
  category: string;
}

export class DashboardView extends ItemView {
  plugin: DocLearnerPlugin;
  private entries: DashboardEntry[] = [];
  private filterStatus: string = "all";
  private filterImpact: string = "all";

  constructor(leaf: WorkspaceLeaf, plugin: DocLearnerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Doc Learner ダッシュボード";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    await this.loadEntries();
    this.render();
  }

  async refresh(): Promise<void> {
    await this.loadEntries();
    this.render();
  }

  private async loadEntries(): Promise<void> {
    const root = this.plugin.settings.outputRoot;
    this.entries = [];
    await this.walkDir(root);
    this.entries.sort((a, b) => b.detected.localeCompare(a.detected));
  }

  private async walkDir(dir: string): Promise<void> {
    try {
      const listing = await this.app.vault.adapter.list(dir);
      for (const file of listing.files) {
        if (!file.endsWith(".md")) continue;
        if (file.includes("_dashboard") || file.includes("learning-path")) continue;

        const raw = await this.app.vault.adapter.read(file);
        const fm = this.parseFM(raw);
        if (fm && fm["tags"]?.toString().includes("doc-learner")) {
          this.entries.push({
            path: file,
            title: String(fm["title"] ?? file.split("/").pop()?.replace(".md", "")),
            status: String(fm["status"] ?? "unread"),
            impact: String(fm["impact"] ?? "medium"),
            detected: String(fm["detected"] ?? ""),
            site: String(fm["site"] ?? ""),
            category: String(fm["category"] ?? ""),
          });
        }
      }
      for (const sub of listing.folders) {
        await this.walkDir(sub);
      }
    } catch {
      // dir may not exist yet
    }
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("doc-learner-dashboard-view");

    const header = container.createDiv({ cls: "dl-dash-header" });
    header.createEl("h3", { text: "学習ダッシュボード" });

    const toolbar = header.createDiv({ cls: "dl-dash-toolbar" });

    const refreshBtn = toolbar.createEl("button", { cls: "dl-btn", text: "更新" });
    setIcon(refreshBtn.createSpan(), "refresh-cw");
    refreshBtn.addEventListener("click", () => this.refresh());

    this.renderFilters(toolbar);
    this.renderStats(container);
    this.renderEntryList(container);
  }

  private renderFilters(toolbar: HTMLElement): void {
    const statusSelect = toolbar.createEl("select", { cls: "dl-filter" });
    for (const [val, label] of [["all", "全ステータス"], ["unread", "未読"], ["in_progress", "学習中"], ["learned", "完了"]]) {
      const opt = statusSelect.createEl("option", { text: label });
      opt.value = val;
      if (val === this.filterStatus) opt.selected = true;
    }
    statusSelect.addEventListener("change", () => {
      this.filterStatus = statusSelect.value;
      this.render();
    });

    const impactSelect = toolbar.createEl("select", { cls: "dl-filter" });
    for (const [val, label] of [["all", "全影響度"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]) {
      const opt = impactSelect.createEl("option", { text: label });
      opt.value = val;
      if (val === this.filterImpact) opt.selected = true;
    }
    impactSelect.addEventListener("change", () => {
      this.filterImpact = impactSelect.value;
      this.render();
    });
  }

  private renderStats(container: HTMLElement): void {
    const stats = container.createDiv({ cls: "dl-dash-stats" });
    const total = this.entries.length;
    const unread = this.entries.filter((e) => e.status === "unread").length;
    const inProgress = this.entries.filter((e) => e.status === "in_progress").length;
    const learned = this.entries.filter((e) => e.status === "learned").length;

    this.renderStatCard(stats, "合計", String(total), "file-text");
    this.renderStatCard(stats, "未読", String(unread), "book-open");
    this.renderStatCard(stats, "学習中", String(inProgress), "loader");
    this.renderStatCard(stats, "完了", String(learned), "check-circle");
  }

  private renderStatCard(parent: HTMLElement, label: string, value: string, icon: string): void {
    const card = parent.createDiv({ cls: "dl-stat-card" });
    const iconEl = card.createSpan();
    setIcon(iconEl, icon);
    card.createEl("span", { text: value, cls: "dl-stat-value" });
    card.createEl("small", { text: label, cls: "dl-stat-label" });
  }

  private renderEntryList(container: HTMLElement): void {
    const filtered = this.entries.filter((e) => {
      if (this.filterStatus !== "all" && e.status !== this.filterStatus) return false;
      if (this.filterImpact !== "all" && e.impact !== this.filterImpact) return false;
      return true;
    });

    if (filtered.length === 0) {
      container.createEl("p", { text: "該当する学習ノートがありません。", cls: "dl-empty" });
      return;
    }

    const list = container.createDiv({ cls: "dl-dash-list" });

    for (const entry of filtered) {
      const row = list.createDiv({ cls: "dl-dash-row" });

      const impactBadge = row.createSpan({ cls: `dl-badge dl-badge-${entry.impact === "high" ? "removed" : entry.impact === "low" ? "added" : "modified"}` });
      impactBadge.textContent = entry.impact === "high" ? "H" : entry.impact === "medium" ? "M" : "L";

      const info = row.createDiv({ cls: "dl-dash-info" });
      const titleEl = info.createEl("span", { text: entry.title, cls: "dl-dash-title" });
      titleEl.addEventListener("click", () => {
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        if (file) this.app.workspace.getLeaf().openFile(file as any);
      });

      const meta = info.createDiv({ cls: "dl-dash-meta" });
      meta.createEl("small", { text: entry.site, cls: "dl-muted" });
      meta.createEl("small", { text: ` · ${entry.detected}`, cls: "dl-muted" });

      if (entry.detected) {
        const d = new Date(entry.detected);
        if (!isNaN(d.getTime())) {
          meta.createEl("small", { text: ` · ${relativeTimeJa(d)}`, cls: "dl-muted" });
        }
      }

      const statusEl = row.createEl("select", { cls: "dl-status-select" });
      for (const [val, label] of [["unread", "未読"], ["in_progress", "学習中"], ["learned", "完了"]]) {
        const opt = statusEl.createEl("option", { text: label });
        opt.value = val;
        if (val === entry.status) opt.selected = true;
      }
      statusEl.addEventListener("change", async () => {
        await this.updateNoteStatus(entry.path, statusEl.value);
        entry.status = statusEl.value;
        this.render();
      });
    }
  }

  private async updateNoteStatus(filePath: string, newStatus: string): Promise<void> {
    try {
      const raw = await this.app.vault.adapter.read(filePath);
      const updated = raw.replace(
        /^(status:\s*).+$/m,
        `$1${newStatus}`
      );
      await this.app.vault.adapter.write(filePath, updated);
    } catch (err) {
      console.error("[doc-learner] Failed to update status:", err);
    }
  }

  private parseFM(raw: string): Record<string, unknown> | null {
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

  async onClose(): Promise<void> {
    // cleanup
  }
}
