import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type DocLearnerPlugin from "../main";

export const SIDEBAR_VIEW_TYPE = "doc-learner-sidebar";

export class DocLearnerSidebar extends ItemView {
  plugin: DocLearnerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: DocLearnerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return SIDEBAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Doc Learner";
  }

  getIcon(): string {
    return "book-open";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("doc-learner-sidebar");

    const header = container.createDiv({ cls: "dl-sidebar-header" });
    header.createEl("h4", { text: "Doc Learner" });

    const actions = header.createDiv({ cls: "dl-sidebar-actions" });
    const checkBtn = actions.createEl("button", {
      cls: "dl-btn",
      text: "更新チェック",
    });
    setIcon(checkBtn.createSpan(), "refresh-cw");
    checkBtn.addEventListener("click", async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = "チェック中...";
      try {
        await this.plugin.runCheck();
        await this.render();
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = "更新チェック";
      }
    });

    const statusEl = container.createDiv({ cls: "dl-sidebar-status" });
    const lastCheck = this.plugin.lastCheckTime;
    if (lastCheck) {
      statusEl.createEl("small", {
        text: `最終チェック: ${new Date(lastCheck).toLocaleString("ja-JP")}`,
        cls: "dl-muted",
      });
    }

    const sites = this.plugin.settings.sites.filter((s) => s.enabled);
    if (sites.length === 0) {
      container.createEl("p", {
        text: "監視サイトが設定されていません。設定画面からサイトを追加してください。",
        cls: "dl-empty",
      });
      return;
    }

    const pending = this.plugin.pendingDiffs;
    if (pending.length === 0) {
      container.createEl("p", {
        text: "新しい変更はありません。",
        cls: "dl-empty",
      });
      return;
    }

    const grouped = new Map<string, typeof pending>();
    for (const d of pending) {
      const key = d.siteName;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(d);
    }

    for (const [site, diffs] of grouped) {
      const siteSection = container.createDiv({ cls: "dl-site-section" });
      siteSection.createEl("h5", { text: `${site} (${diffs.length})` });

      for (const d of diffs) {
        const item = siteSection.createDiv({ cls: "dl-diff-item" });
        const badge = item.createSpan({ cls: `dl-badge dl-badge-${d.changeType}` });
        badge.textContent = d.changeType === "added" ? "+" : d.changeType === "removed" ? "-" : "~";
        item.createSpan({ text: ` ${d.section}`, cls: "dl-diff-title" });
        item.createEl("small", { text: d.page, cls: "dl-muted dl-block" });

        item.addEventListener("click", () => {
          this.plugin.showDiffDetail(d);
        });
      }
    }
  }

  async onClose(): Promise<void> {
    // cleanup
  }
}
