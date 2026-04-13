import { ItemView, WorkspaceLeaf } from "obsidian";
import type { DiffResult } from "../types";

export const DIFF_VIEW_TYPE = "doc-learner-diff-view";

export class DiffDetailView extends ItemView {
  private diffData: DiffResult | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return DIFF_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Doc Learner - 差分";
  }

  getIcon(): string {
    return "git-compare";
  }

  setDiff(diff: DiffResult): void {
    this.diffData = diff;
    this.render();
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("doc-learner-diff-view");

    if (!this.diffData) {
      container.createEl("p", { text: "差分を選択してください", cls: "dl-empty" });
      return;
    }

    const d = this.diffData;

    const header = container.createDiv({ cls: "dl-diff-header" });
    header.createEl("h3", { text: d.section });
    header.createEl("small", { text: `${d.siteName} / ${d.page}`, cls: "dl-muted" });

    const badge = header.createSpan({ cls: `dl-badge dl-badge-${d.changeType}` });
    badge.textContent = changeLabel(d.changeType);

    if (d.pageUrl) {
      const link = header.createEl("a", {
        text: "ソースを開く →",
        href: d.pageUrl,
        cls: "dl-source-link",
      });
      link.setAttr("target", "_blank");
    }

    const body = container.createDiv({ cls: "dl-diff-body" });

    if (d.changeType === "modified" && d.before && d.after) {
      const split = body.createDiv({ cls: "dl-split-view" });

      const leftPane = split.createDiv({ cls: "dl-pane dl-pane-before" });
      leftPane.createEl("h5", { text: "Before" });
      const leftCode = leftPane.createEl("pre");
      leftCode.createEl("code", { text: d.before });

      const rightPane = split.createDiv({ cls: "dl-pane dl-pane-after" });
      rightPane.createEl("h5", { text: "After" });
      const rightCode = rightPane.createEl("pre");
      rightCode.createEl("code", { text: d.after });
    } else if (d.after) {
      body.createEl("h5", { text: "追加コンテンツ" });
      const code = body.createEl("pre", { cls: "dl-added" });
      code.createEl("code", { text: d.after });
    } else if (d.before) {
      body.createEl("h5", { text: "削除コンテンツ" });
      const code = body.createEl("pre", { cls: "dl-removed" });
      code.createEl("code", { text: d.before });
    }

    const meta = container.createDiv({ cls: "dl-diff-meta" });
    meta.createEl("small", {
      text: `検出日時: ${new Date(d.detectedAt).toLocaleString("ja-JP")}`,
      cls: "dl-muted",
    });
  }

  async onClose(): Promise<void> {
    this.diffData = null;
  }
}

function changeLabel(ct: string): string {
  switch (ct) {
    case "added": return "追加";
    case "modified": return "変更";
    case "removed": return "削除";
    default: return ct;
  }
}
