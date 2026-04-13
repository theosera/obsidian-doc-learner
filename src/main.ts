import { Notice, Plugin } from "obsidian";
import type { DiffResult, DocLearnerSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { DocLearnerSettingTab } from "./settings";
import { FetchCrawler } from "./crawler/fetch-crawler";
import { SnapshotManager } from "./diff/snapshot-manager";
import { DiffEngine } from "./diff/diff-engine";
import { AnthropicProvider } from "./ai/anthropic";
import { QwenProvider } from "./ai/qwen";
import { GLMProvider } from "./ai/glm";
import type { IAIProvider } from "./ai/provider";
import { VaultSearch } from "./vault-search/vault-search";
import { NoteGenerator } from "./generator/note-generator";
import { DashboardGenerator } from "./generator/dashboard";
import { DocLearnerSidebar, SIDEBAR_VIEW_TYPE } from "./ui/sidebar";
import { DiffDetailView, DIFF_VIEW_TYPE } from "./ui/diff-view";

export default class DocLearnerPlugin extends Plugin {
  settings: DocLearnerSettings = DEFAULT_SETTINGS;
  lastCheckTime: number | null = null;
  pendingDiffs: DiffResult[] = [];

  private crawler!: FetchCrawler;
  private snapshotMgr!: SnapshotManager;
  private diffEngine!: DiffEngine;
  private vaultSearch!: VaultSearch;
  private noteGenerator!: NoteGenerator;
  private dashboardGenerator!: DashboardGenerator;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.crawler = new FetchCrawler();
    this.snapshotMgr = new SnapshotManager(this.app);
    this.diffEngine = new DiffEngine();
    this.vaultSearch = new VaultSearch(this.settings);
    this.noteGenerator = new NoteGenerator(this.app, this.settings);
    this.dashboardGenerator = new DashboardGenerator(this.app, this.settings);

    this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new DocLearnerSidebar(leaf, this));
    this.registerView(DIFF_VIEW_TYPE, (leaf) => new DiffDetailView(leaf));

    this.addRibbonIcon("book-open", "Doc Learner", () => this.activateSidebar());

    this.addCommand({
      id: "doc-learner-check",
      name: "ドキュメント更新チェック",
      callback: () => this.runCheck(),
    });

    this.addCommand({
      id: "doc-learner-generate",
      name: "学習教材を生成",
      callback: () => this.generateNotes(),
    });

    this.addCommand({
      id: "doc-learner-dashboard",
      name: "ダッシュボード更新",
      callback: () => this.dashboardGenerator.regenerate(),
    });

    this.addCommand({
      id: "doc-learner-sidebar",
      name: "サイドパネルを開く",
      callback: () => this.activateSidebar(),
    });

    this.addSettingTab(new DocLearnerSettingTab(this.app, this));

    this.scheduleAutoCheck();
  }

  onunload(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.vaultSearch = new VaultSearch(this.settings);
    this.noteGenerator = new NoteGenerator(this.app, this.settings);
    this.dashboardGenerator = new DashboardGenerator(this.app, this.settings);
    this.scheduleAutoCheck();
  }

  private scheduleAutoCheck(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    const ms = this.settings.checkIntervalHours * 60 * 60 * 1000;
    this.checkInterval = setInterval(() => this.runCheck(), ms);
  }

  async runCheck(): Promise<void> {
    const enabledSites = this.settings.sites.filter((s) => s.enabled);
    if (enabledSites.length === 0) {
      new Notice("Doc Learner: 有効な監視サイトがありません");
      return;
    }

    new Notice("Doc Learner: 更新チェック中...");
    const allDiffs: DiffResult[] = [];

    for (const site of enabledSites) {
      try {
        const results = await this.crawler.crawl(site);
        if (results.length === 0) continue;

        const prev = await this.snapshotMgr.getLatestSnapshot(site.id);
        const current = await this.snapshotMgr.saveSnapshot(site.id, results);
        const diffs = this.diffEngine.computeDiffs(current, prev, site);
        allDiffs.push(...diffs);

        await this.snapshotMgr.pruneOldSnapshots(site.id);
      } catch (err) {
        console.error(`[doc-learner] Check failed for ${site.name}:`, err);
        new Notice(`Doc Learner: ${site.name} のチェックに失敗しました`);
      }
    }

    this.pendingDiffs = allDiffs;
    this.lastCheckTime = Date.now();

    if (allDiffs.length > 0) {
      new Notice(`Doc Learner: ${allDiffs.length} 件の変更を検出しました`);
    } else {
      new Notice("Doc Learner: 新しい変更はありません");
    }

    this.refreshSidebar();
  }

  async generateNotes(): Promise<void> {
    if (this.pendingDiffs.length === 0) {
      new Notice("Doc Learner: 生成する差分がありません。先に更新チェックを実行してください。");
      return;
    }

    const provider = this.createAIProvider();
    if (!provider) {
      new Notice("Doc Learner: AI プロバイダーの設定を確認してください（API キーが未設定）");
      return;
    }

    new Notice("Doc Learner: 学習教材を生成中...");

    try {
      const analyses = await provider.analyze(this.pendingDiffs, this.settings.language);

      const grouped = new Map<string, DiffResult[]>();
      for (const d of this.pendingDiffs) {
        const key = `${d.siteId}/${d.page}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(d);
      }

      let written = 0;
      const keys = [...grouped.keys()];

      for (let i = 0; i < analyses.length && i < keys.length; i++) {
        const analysis = analyses[i];
        const diffs = grouped.get(keys[i])!;

        const relatedNotes = await this.vaultSearch.findRelated(analysis);
        const note = this.noteGenerator.generate(analysis, diffs, relatedNotes);
        await this.noteGenerator.write(note);
        written++;
      }

      await this.dashboardGenerator.regenerate();
      new Notice(`Doc Learner: ${written} 件の学習ノートを生成しました`);
      this.pendingDiffs = [];
    } catch (err) {
      console.error("[doc-learner] Note generation failed:", err);
      new Notice("Doc Learner: 教材生成に失敗しました。コンソールを確認してください。");
    }
  }

  showDiffDetail(diff: DiffResult): void {
    const leaves = this.app.workspace.getLeavesOfType(DIFF_VIEW_TYPE);
    if (leaves.length > 0) {
      const view = leaves[0].view as DiffDetailView;
      view.setDiff(diff);
      this.app.workspace.revealLeaf(leaves[0]);
    } else {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        leaf.setViewState({ type: DIFF_VIEW_TYPE, active: true }).then(() => {
          const view = leaf.view as DiffDetailView;
          view.setDiff(diff);
        });
      }
    }
  }

  private createAIProvider(): IAIProvider | null {
    const cfg = this.settings.aiProvider;
    if (!cfg.apiKey) return null;

    switch (cfg.primary) {
      case "anthropic":
        return new AnthropicProvider(cfg.apiKey, cfg.model);
      case "qwen":
        return new QwenProvider(cfg.apiKey, cfg.model);
      case "glm":
        return new GLMProvider(cfg.apiKey, cfg.model);
    }
  }

  private async activateSidebar(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  private refreshSidebar(): void {
    const leaves = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
    for (const leaf of leaves) {
      (leaf.view as DocLearnerSidebar).render();
    }
  }
}
