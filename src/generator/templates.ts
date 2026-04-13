import type { AIAnalysis, DiffResult, RelatedNote } from "../types";
import type { MediaResult } from "./media-finder";

export function buildFrontmatter(analysis: AIAnalysis, diff: DiffResult): Record<string, unknown> {
  return {
    title: analysis.title,
    source: diff.pageUrl,
    site: diff.siteName,
    detected: diff.detectedAt.split("T")[0],
    category: analysis.category,
    impact: analysis.impact,
    status: "unread",
    tags: ["doc-learner", diff.siteId, analysis.category],
  };
}

export function formatFrontmatter(fm: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, val] of Object.entries(fm)) {
    if (Array.isArray(val)) {
      lines.push(`${key}: [${val.map((v) => `"${v}"`).join(", ")}]`);
    } else if (typeof val === "string" && val.includes(":")) {
      lines.push(`${key}: "${val}"`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

export function buildLearningNoteBody(
  analysis: AIAnalysis,
  diffs: DiffResult[],
  relatedNotes: RelatedNote[],
  media: MediaResult[] = []
): string {
  const sections: string[] = [];

  sections.push(`# ${analysis.title}\n`);

  sections.push(`## 変更サマリー\n${analysis.summaryJa}\n`);

  sections.push(`## 何が変わったか\n${analysis.whatChanged}\n`);

  sections.push(`## なぜ重要か\n${analysis.whyItMatters}\n`);

  const diffBlocks = diffs
    .filter((d) => d.before || d.after)
    .map((d) => {
      const parts: string[] = [`### ${d.section} (${changeTypeLabel(d.changeType)})`];
      if (d.changeType === "modified" && d.before && d.after) {
        parts.push("```diff");
        const oldLines = d.before.split("\n").slice(0, 15);
        const newLines = d.after.split("\n").slice(0, 15);
        for (const l of oldLines) parts.push(`- ${l}`);
        parts.push("---");
        for (const l of newLines) parts.push(`+ ${l}`);
        parts.push("```");
      } else if (d.after) {
        parts.push(`> [!info]+ 追加されたコンテンツ`);
        for (const line of d.after.split("\n").slice(0, 15)) {
          parts.push(`> ${line}`);
        }
      } else if (d.before) {
        parts.push(`> [!warning]- 削除されたコンテンツ`);
        for (const line of d.before.split("\n").slice(0, 15)) {
          parts.push(`> ${line}`);
        }
      }
      return parts.join("\n");
    });

  if (diffBlocks.length > 0) {
    sections.push(`## 差分ハイライト\n${diffBlocks.join("\n\n")}\n`);
  }

  if (analysis.learningActions.length > 0) {
    const actions = analysis.learningActions.map((a) => `- [ ] ${a}`).join("\n");
    sections.push(`## 実践課題\n${actions}\n`);
  }

  if (media.length > 0) {
    const mediaLines = media.map((m) => {
      if (m.type === "youtube" && m.url.includes("watch?v=")) {
        return `- ${m.title}\n  ${m.embedCode}`;
      }
      return `- [${m.title}](${m.url})`;
    }).join("\n");
    sections.push(`## 学習リソース\n${mediaLines}\n`);
  } else if (analysis.youtubeQueries.length > 0) {
    const queries = analysis.youtubeQueries
      .map((q) => `- [YouTube: "${q}"](https://www.youtube.com/results?search_query=${encodeURIComponent(q)})`)
      .join("\n");
    sections.push(`## 関連動画\n${queries}\n`);
  }

  if (relatedNotes.length > 0) {
    const links = relatedNotes
      .map((n) => `- [[${n.path}|${n.title}]] (relevance: ${(n.score * 100).toFixed(0)}%)${n.snippet ? ` — ${n.snippet}` : ""}`)
      .join("\n");
    sections.push(`## 関連ノート（iCloud Vault）\n${links}\n`);
  }

  return sections.join("\n");
}

function changeTypeLabel(ct: string): string {
  switch (ct) {
    case "added": return "追加";
    case "modified": return "変更";
    case "removed": return "削除";
    default: return ct;
  }
}
