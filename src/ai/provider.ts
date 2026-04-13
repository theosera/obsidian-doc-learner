import { requestUrl } from "obsidian";
import type { AIAnalysis, DiffResult } from "../types";

export interface IAIProvider {
  analyze(diffs: DiffResult[], language: string): Promise<AIAnalysis[]>;
}

export abstract class BaseAIProvider implements IAIProvider {
  constructor(
    protected apiKey: string,
    protected model: string
  ) {}

  async analyze(diffs: DiffResult[], language: string): Promise<AIAnalysis[]> {
    const grouped = this.groupDiffsByPage(diffs);
    const results: AIAnalysis[] = [];

    for (const [_page, pageDiffs] of grouped) {
      try {
        const analysis = await this.analyzeSingle(pageDiffs, language);
        results.push(analysis);
      } catch (err) {
        console.error("[doc-learner] AI analysis failed:", err);
      }
    }

    return results;
  }

  protected abstract callAPI(systemPrompt: string, userPrompt: string): Promise<string>;

  private async analyzeSingle(diffs: DiffResult[], language: string): Promise<AIAnalysis> {
    const systemPrompt = this.buildSystemPrompt(language);
    const userPrompt = this.buildUserPrompt(diffs);
    const raw = await this.callAPI(systemPrompt, userPrompt);
    return this.parseResponse(raw, diffs);
  }

  private buildSystemPrompt(language: string): string {
    const lang = language === "ja" ? "日本語" : "English";
    return `You are a documentation change analyzer. You analyze diffs from technical documentation and produce structured learning materials.

ALWAYS respond in ${lang}.
Output valid JSON only, no markdown fences. The schema:
{
  "category": "new_feature" | "improvement" | "bugfix" | "deprecation" | "doc_fix",
  "impact": "high" | "medium" | "low",
  "title": "short title for the change",
  "summaryJa": "2-3 sentence summary",
  "whatChanged": "detailed description of what changed",
  "whyItMatters": "why this matters to developers",
  "learningActions": ["action 1", "action 2"],
  "youtubeQueries": ["search query 1"],
  "relatedTopics": ["topic keyword 1", "topic keyword 2"]
}`;
  }

  private buildUserPrompt(diffs: DiffResult[]): string {
    const site = diffs[0].siteName;
    const page = diffs[0].page;
    const sections = diffs
      .map((d) => {
        let block = `[${d.changeType.toUpperCase()}] Section: ${d.section}\n`;
        if (d.before) block += `--- Before ---\n${d.before.substring(0, 800)}\n`;
        if (d.after) block += `+++ After +++\n${d.after.substring(0, 800)}\n`;
        return block;
      })
      .join("\n---\n");

    return `Analyze these documentation changes:
Site: ${site}
Page: ${page}

${sections}`;
  }

  private parseResponse(raw: string, diffs: DiffResult[]): AIAnalysis {
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned) as AIAnalysis;
    } catch {
      return {
        category: "doc_fix",
        impact: "medium",
        title: `${diffs[0].siteName}: ${diffs[0].page} の変更`,
        summaryJa: raw.substring(0, 300),
        whatChanged: raw.substring(0, 500),
        whyItMatters: "AI の応答をパースできませんでした。上記の生テキストを参照してください。",
        learningActions: [],
        youtubeQueries: [],
        relatedTopics: [],
      };
    }
  }

  private groupDiffsByPage(diffs: DiffResult[]): Map<string, DiffResult[]> {
    const map = new Map<string, DiffResult[]>();
    for (const d of diffs) {
      const key = `${d.siteId}/${d.page}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }

  protected async httpPost(
    url: string,
    headers: Record<string, string>,
    body: unknown
  ): Promise<string> {
    const resp = await requestUrl({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return resp.text;
  }
}
