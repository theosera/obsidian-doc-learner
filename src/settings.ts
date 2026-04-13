import { App, PluginSettingTab, Setting } from "obsidian";
import type DocLearnerPlugin from "./main";
import type { SiteConfig } from "./types";
import { ENV_KEY_MAP, resolveApiKey } from "./types";

export class DocLearnerSettingTab extends PluginSettingTab {
  plugin: DocLearnerPlugin;

  constructor(app: App, plugin: DocLearnerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Doc Learner 設定" });

    this.renderAISection(containerEl);
    this.renderVaultSection(containerEl);
    this.renderSitesSection(containerEl);
    this.renderGeneralSection(containerEl);
  }

  private renderAISection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "AI プロバイダー" });

    new Setting(containerEl)
      .setName("プロバイダー")
      .setDesc("差分分析・学習教材生成に使用する AI")
      .addDropdown((cb) =>
        cb
          .addOptions({
            anthropic: "Anthropic (Claude)",
            qwen: "Qwen",
            glm: "GLM",
          })
          .setValue(this.plugin.settings.aiProvider.primary)
          .onChange(async (v) => {
            this.plugin.settings.aiProvider.primary = v as "anthropic" | "qwen" | "glm";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("モデル")
      .setDesc("使用するモデル名")
      .addText((cb) =>
        cb
          .setPlaceholder("claude-haiku-4-5-20251001")
          .setValue(this.plugin.settings.aiProvider.model)
          .onChange(async (v) => {
            this.plugin.settings.aiProvider.model = v;
            await this.plugin.saveSettings();
          })
      );

    const envStatus = containerEl.createDiv({ cls: "dl-env-status" });
    envStatus.createEl("h4", { text: "環境変数ステータス（~/.zshrc）" });

    for (const [provider, envName] of Object.entries(ENV_KEY_MAP)) {
      const key = resolveApiKey(provider);
      const detected = key !== null && key.length > 0;
      const row = envStatus.createDiv({ cls: "dl-env-row" });
      const icon = detected ? "✅" : "❌";
      const masked = detected ? `${key!.substring(0, 6)}...${key!.slice(-4)}` : "未設定";
      row.createEl("span", {
        text: `${icon} ${envName}: ${masked}`,
        cls: detected ? "dl-env-ok" : "dl-env-missing",
      });
    }

    envStatus.createEl("small", {
      text: "API キーは ~/.zshrc の環境変数から読み取ります。設定後は Obsidian を再起動してください。",
      cls: "dl-muted",
    });
  }

  private renderVaultSection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Vault 設定" });

    new Setting(containerEl)
      .setName("情報収集 Vault パターン")
      .setDesc("{year} が年度に置換されます")
      .addText((cb) =>
        cb
          .setValue(this.plugin.settings.sourceVaultPattern)
          .onChange(async (v) => {
            this.plugin.settings.sourceVaultPattern = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("出力先フォルダ")
      .setDesc("学習教材の出力先（Vault 内相対パス）")
      .addText((cb) =>
        cb
          .setValue(this.plugin.settings.outputRoot)
          .onChange(async (v) => {
            this.plugin.settings.outputRoot = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("関連ノート最大数")
      .setDesc("学習教材に含める関連ノートの最大数")
      .addSlider((cb) =>
        cb
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.maxRelatedNotes)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.maxRelatedNotes = v;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderSitesSection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "監視サイト" });

    for (const site of this.plugin.settings.sites) {
      this.renderSiteEntry(containerEl, site);
    }

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("+ サイト追加").onClick(() => {
        this.plugin.settings.sites.push({
          id: `site-${Date.now()}`,
          name: "",
          type: "url-list",
          urls: [],
          outputFolder: "",
          schedule: "daily",
          enabled: true,
        });
        this.display();
      })
    );
  }

  private renderSiteEntry(containerEl: HTMLElement, site: SiteConfig): void {
    const wrapper = containerEl.createDiv({ cls: "doc-learner-site-entry" });

    new Setting(wrapper)
      .setName(site.name || "(未設定)")
      .setDesc(`${site.type} — ${site.schedule}`)
      .addToggle((cb) =>
        cb.setValue(site.enabled).onChange(async (v) => {
          site.enabled = v;
          await this.plugin.saveSettings();
        })
      )
      .addExtraButton((btn) =>
        btn.setIcon("trash").setTooltip("削除").onClick(async () => {
          this.plugin.settings.sites = this.plugin.settings.sites.filter(
            (s) => s.id !== site.id
          );
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(wrapper)
      .setName("サイト名")
      .addText((cb) =>
        cb.setValue(site.name).onChange(async (v) => {
          site.name = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(wrapper)
      .setName("タイプ")
      .addDropdown((cb) =>
        cb
          .addOptions({
            "llms-txt": "llms.txt",
            sitemap: "Sitemap",
            "url-list": "URL リスト",
          })
          .setValue(site.type)
          .onChange(async (v) => {
            site.type = v as SiteConfig["type"];
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (site.type === "llms-txt" || site.type === "sitemap") {
      new Setting(wrapper)
        .setName("インデックス URL")
        .addText((cb) =>
          cb.setValue(site.indexUrl ?? "").onChange(async (v) => {
            site.indexUrl = v;
            await this.plugin.saveSettings();
          })
        );
    }

    new Setting(wrapper)
      .setName("出力フォルダ")
      .setDesc("outputRoot からの相対パス")
      .addText((cb) =>
        cb.setValue(site.outputFolder).onChange(async (v) => {
          site.outputFolder = v;
          await this.plugin.saveSettings();
        })
      );
  }

  private renderGeneralSection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "一般設定" });

    new Setting(containerEl)
      .setName("チェック間隔（時間）")
      .addSlider((cb) =>
        cb
          .setLimits(1, 168, 1)
          .setValue(this.plugin.settings.checkIntervalHours)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.checkIntervalHours = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("言語")
      .addDropdown((cb) =>
        cb
          .addOptions({ ja: "日本語", en: "English" })
          .setValue(this.plugin.settings.language)
          .onChange(async (v) => {
            this.plugin.settings.language = v as "ja" | "en";
            await this.plugin.saveSettings();
          })
      );
  }
}
