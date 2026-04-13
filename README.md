# Doc Learner

> **個人利用専用** — 本プラグインは作者個人の学習ワークフロー向けに設計・開発されたものです。汎用的な OSS としての公開・配布を目的としていません。コードは参考として公開していますが、サポート・機能リクエスト・互換性の保証は行いません。Fork や再配布はご遠慮ください。

技術ドキュメントサイトの更新を自動検出し、AI で分析した構造化学習教材を Obsidian Vault に生成する BRAT 互換プラグインです。

## 概要

Doc Learner は以下のワークフローを自動化します：

1. **クロール** — 登録したドキュメントサイト（Claude Code docs、Cursor docs 等）を定期的にフェッチ
2. **差分検出** — 前回スナップショットとセクション（見出し）レベルで比較
3. **AI 分析** — 変更内容を AI（Anthropic / Qwen / GLM）で分類・要約
4. **関連ノート検索** — iCloud Vault を走査し、関連性の高い既存ノートを自動リンク
5. **学習教材生成** — YAML フロントマター付きの構造化された Markdown ノートを出力
6. **ダッシュボード** — 未読 / 学習中 / 完了をライブビューで管理

## インストール

### BRAT 経由（推奨）

1. Obsidian の Community Plugins から [BRAT](https://github.com/TfTHacker/obsidian42-brat) をインストール
2. BRAT 設定 → **Add Beta Plugin** → `theosera/obsidian-doc-learner` を入力
3. プラグインを有効化

### 手動インストール

1. [Releases](https://github.com/theosera/obsidian-doc-learner/releases) から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. Vault の `.obsidian/plugins/doc-learner/` に配置
3. Obsidian を再起動し、プラグインを有効化

## 環境変数の設定

API キーはセキュリティのため環境変数から読み取ります。`~/.zshrc` に以下を追加してください：

```bash
# 必須: 使用する AI プロバイダーのキー
export ANTHROPIC_API_KEY="sk-ant-..."

# 任意: 代替プロバイダー
export QWEN_API_KEY="sk-..."
export GLM_API_KEY="..."

# 任意: YouTube Data API v3（動画検索に使用、なくても動作します）
export YOUTUBE_API_KEY="..."
```

設定後：
```bash
source ~/.zshrc
open -a Obsidian   # ターミナルから起動すると環境変数が反映されます
```

> **macOS の注意**: Dock から起動した Obsidian はシェルの環境変数を継承しません。
> `launchctl setenv ANTHROPIC_API_KEY "sk-..."` で GUI アプリにも反映できます。

設定画面の「環境変数ステータス」で検出状況を確認できます。

## 使い方

### コマンドパレット

| コマンド | 説明 |
|---|---|
| `Doc Learner: ドキュメント更新チェック` | 全有効サイトをクロールし差分を検出 |
| `Doc Learner: 学習教材を生成` | 検出済み差分を AI で分析し学習ノートを出力 |
| `Doc Learner: ダッシュボードを開く` | ライブダッシュボードビューを表示 |
| `Doc Learner: 学習ロードマップ更新` | サイトごとの学習進捗ロードマップを再生成 |
| `Doc Learner: サイドパネルを開く` | 差分一覧のサイドパネルを表示 |

### 典型的なフロー

1. リボンアイコン（本マーク）をクリック → サイドパネルが開く
2. 「更新チェック」ボタンをクリック → ドキュメントをフェッチし差分を検出
3. 差分が見つかったら「学習教材を生成」コマンドを実行
4. `06_Self_Discipline/doc-learner/` に学習ノートが生成される
5. ダッシュボードで未読 → 学習中 → 完了とステータスを管理

## 監視サイトの設定

設定画面から監視サイトを追加できます。3 つのタイプに対応：

### llms.txt（推奨）

`llms.txt` を提供するサイト向け。Markdown を直接取得するため HTML パース不要。

```
タイプ: llms.txt
インデックス URL: https://docs.anthropic.com/en/docs/claude-code/llms.txt
```

### Sitemap

`sitemap.xml` から URL を自動収集。

```
タイプ: Sitemap
インデックス URL: https://example.com/sitemap.xml
```

### URL リスト

手動で URL を登録。

## 出力される学習ノート

全ノートに必ず YAML フロントマターが付きます：

```markdown
---
title: "MCP Server API の新しい認証方式"
source: "https://docs.anthropic.com/en/docs/claude-code/mcp.md"
site: Claude Code Docs
detected: 2026-04-13
category: new_feature
impact: high
status: unread
tags: ["doc-learner", "claude-code-docs", "new_feature"]
---

# MCP Server API の新しい認証方式

## 変更サマリー
...

## 何が変わったか
...

## なぜ重要か
...

## 差分ハイライト
### Authentication > OAuth Support (追加)
> [!info]+ 追加されたコンテンツ
> ...

## 実践課題
- [ ] 新しい認証フローでサーバーを起動する
- [ ] 既存プロジェクトを移行する

## 学習リソース
- [YouTube: "Claude Code MCP OAuth tutorial"](https://www.youtube.com/results?search_query=...)

## 関連ノート（iCloud Vault）
- [[Engineer/AGENT_assistant_AgenticEngineering/MCP|MCP]] (relevance: 78%)
- [[Engineer/セキュリティ(生成AI関連)/ガードレール実装|ガードレール実装]] (relevance: 45%)
```

## アーキテクチャ

```
obsidian-doc-learner/
├── manifest.json              # BRAT 互換マニフェスト
├── versions.json
├── package.json               # esbuild ビルド
├── esbuild.config.mjs
├── tsconfig.json
├── styles.css                 # プラグイン UI スタイル
├── src/
│   ├── main.ts                # Plugin エントリポイント
│   ├── types.ts               # 型定義・デフォルト設定
│   ├── settings.ts            # 設定画面 UI
│   ├── crawler/
│   │   ├── base.ts            # ICrawler インターフェース
│   │   ├── fetch-crawler.ts   # Obsidian requestUrl ベースのクローラー
│   │   └── site-configs.ts    # llms.txt / sitemap パーサー
│   ├── diff/
│   │   ├── snapshot-manager.ts # タイムスタンプ付きスナップショット管理
│   │   └── diff-engine.ts     # セクションレベル Markdown 差分検出
│   ├── ai/
│   │   ├── provider.ts        # IAIProvider 抽象化
│   │   ├── anthropic.ts       # Anthropic Claude API
│   │   ├── qwen.ts            # Qwen (DashScope) API
│   │   └── glm.ts             # GLM (Zhipu) API
│   ├── vault-search/
│   │   ├── vault-resolver.ts  # クロス Vault パス解決（{year} 自動検出）
│   │   └── vault-search.ts    # iCloud Vault 関連ノート検索
│   ├── generator/
│   │   ├── note-generator.ts  # 学習ノート生成（フロントマター必須）
│   │   ├── templates.ts       # テンプレートエンジン
│   │   ├── dashboard.ts       # _dashboard.md 生成
│   │   ├── learning-path.ts   # 学習ロードマップ生成
│   │   └── media-finder.ts    # YouTube 動画検索
│   ├── ui/
│   │   ├── sidebar.ts         # サイドパネル（差分一覧）
│   │   ├── diff-view.ts       # Before/After 分割差分ビューア
│   │   └── dashboard-view.ts  # ライブダッシュボード（フィルター・ステータス変更）
│   └── utils/
│       ├── markdown-parser.ts # セクション分割・見出し抽出
│       └── date.ts            # 日付ユーティリティ
└── companion/
    └── crawl.ts               # SPA フォールバック用 Playwright CLI
```

### 設計方針

| 項目 | 方式 | 理由 |
|---|---|---|
| クローリング | fetch API 優先 + Playwright CLI フォールバック | llms.txt や SSR サイトは fetch で十分。SPA のみ CLI |
| AI 統合 | API 直接呼び出し（環境変数からキー取得） | プラグイン単体で完結。設定ファイルにキーを保存しない |
| 差分粒度 | Markdown セクションレベル | 行レベルは粗すぎ、文字レベルは細かすぎ |
| クロス Vault | `{year}` パターン + 自動検出 | 年度切り替え時に設定変更不要 |
| 関連ノート | キーワードマッチング（パス・タイトル・見出し） | 高関連性のもののみリンク |

## 年次運用

iCloud Vault は年次ローテーション（`iCloud Vault 2026` → `iCloud Vault 2027`）を前提としています。

- **自動対応**: `sourceVaultPattern` の `{year}` プレースホルダーにより、最新年度の Vault を自動検出
- **フォールバック**: 過去 2 年分の Vault も検索対象
- **手動作業**: 年末に新 Vault を作成するだけ。プラグイン設定の変更は不要

## Companion CLI（SPA サイト用）

SPA サイトのクロールが必要な場合：

```bash
cd ~/dev/doc-learner

# Playwright をインストール
npm install playwright
npx playwright install chromium

# クロール実行
npx ts-node companion/crawl.ts --url https://spa-site.com/docs --output ./output
```

## 開発

```bash
git clone https://github.com/theosera/obsidian-doc-learner.git
cd obsidian-doc-learner
npm install
npm run dev    # 開発モード（ファイル監視）
npm run build  # プロダクションビルド
```

## 注意事項

- **個人利用専用**: 本プラグインは作者（[@theosera](https://github.com/theosera)）の個人学習環境に特化して設計されています。Vault パス、フォルダ構成、AI プロバイダーの選定など、すべて個人のワークフローに最適化されています。
- **サポート対象外**: Issue や Pull Request による機能リクエスト・バグ報告への対応は保証しません。
- **互換性非保証**: 設定スキーマや出力フォーマットは予告なく変更される場合があります。
- **Fork・再配布禁止**: 本リポジトリのコードを Fork して別のプラグインとして公開・配布することはご遠慮ください。個人的な学習目的でのコード参照は歓迎します。
- **API 利用料**: AI プロバイダーおよび YouTube Data API の利用にはそれぞれの料金体系が適用されます。ご自身の API キーで発生する費用は自己責任です。

## 関連プロジェクト

- [obsidian-ai-pipeline](https://github.com/theosera/obsidian-ai-pipeline) — OneTab / Web クリッピングの AI 分類パイプライン

## ライセンス

本リポジトリのコードは個人利用を前提として公開しています。ライセンスの詳細については作者にお問い合わせください。
