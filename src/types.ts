export interface SiteConfig {
  id: string;
  name: string;
  type: "llms-txt" | "sitemap" | "url-list";
  indexUrl?: string;
  baseUrl?: string;
  urls?: string[];
  outputFolder: string;
  schedule: "hourly" | "daily" | "weekly" | "manual";
  enabled: boolean;
}

export interface DocLearnerSettings {
  sites: SiteConfig[];
  aiProvider: AIProviderConfig;
  sourceVaultPattern: string;
  outputRoot: string;
  checkIntervalHours: number;
  language: "ja" | "en";
  maxRelatedNotes: number;
  relatedNoteMinScore: number;
}

export interface AIProviderConfig {
  primary: "anthropic" | "qwen" | "glm";
  model: string;
  fallback?: "anthropic" | "qwen" | "glm";
  fallbackModel?: string;
}

/**
 * Maps provider names to their expected environment variable names.
 * Keys are set in ~/.zshrc: export ANTHROPIC_API_KEY="sk-..."
 */
export const ENV_KEY_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  qwen: "QWEN_API_KEY",
  glm: "GLM_API_KEY",
};

export function resolveApiKey(provider: string): string | null {
  const envName = ENV_KEY_MAP[provider];
  if (!envName) return null;
  return process.env[envName] ?? null;
}

export interface CrawlResult {
  siteId: string;
  url: string;
  path: string;
  content: string;
  fetchedAt: string;
}

export interface Snapshot {
  siteId: string;
  timestamp: string;
  pages: SnapshotPage[];
}

export interface SnapshotPage {
  url: string;
  path: string;
  contentHash: string;
  content: string;
}

export interface MarkdownSection {
  heading: string;
  level: number;
  content: string;
  fullPath: string;
}

export type ChangeType = "added" | "modified" | "removed";

export interface DiffResult {
  siteId: string;
  siteName: string;
  page: string;
  pageUrl: string;
  section: string;
  changeType: ChangeType;
  before?: string;
  after?: string;
  detectedAt: string;
}

export interface AIAnalysis {
  category: "new_feature" | "improvement" | "bugfix" | "deprecation" | "doc_fix";
  impact: "high" | "medium" | "low";
  title: string;
  summaryJa: string;
  whatChanged: string;
  whyItMatters: string;
  learningActions: string[];
  youtubeQueries: string[];
  relatedTopics: string[];
}

export interface RelatedNote {
  path: string;
  title: string;
  score: number;
  snippet: string;
}

export interface LearningNote {
  frontmatter: Record<string, unknown>;
  body: string;
  filename: string;
  folder: string;
}

export const DEFAULT_SETTINGS: DocLearnerSettings = {
  sites: [
    {
      id: "claude-code-docs",
      name: "Claude Code Docs",
      type: "llms-txt",
      indexUrl: "https://docs.anthropic.com/en/docs/claude-code/llms.txt",
      outputFolder: "ClaudeCode/docs-changelog",
      schedule: "daily",
      enabled: true,
    },
  ],
  aiProvider: {
    primary: "anthropic",
    model: "claude-haiku-4-5-20251001",
  },
  sourceVaultPattern:
    "/Users/theosera/Library/Mobile Documents/iCloud~md~obsidian/Documents/iCloud Vault {year}",
  outputRoot: "06_Self_Discipline/doc-learner",
  checkIntervalHours: 24,
  language: "ja",
  maxRelatedNotes: 5,
  relatedNoteMinScore: 0.3,
};
