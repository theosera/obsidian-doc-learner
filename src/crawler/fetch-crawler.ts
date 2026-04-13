import { requestUrl } from "obsidian";
import type { ICrawler } from "./base";
import type { CrawlResult, SiteConfig } from "../types";
import { resolvePageUrls } from "./site-configs";

export class FetchCrawler implements ICrawler {
  private async fetchText(url: string): Promise<string> {
    const resp = await requestUrl({ url, method: "GET" });
    return resp.text;
  }

  async crawl(site: SiteConfig): Promise<CrawlResult[]> {
    const urls = await resolvePageUrls(site, (u) => this.fetchText(u));
    const results: CrawlResult[] = [];
    const now = new Date().toISOString();

    for (const url of urls) {
      try {
        const content = await this.fetchText(url);
        const path = this.urlToPath(url);
        const processed = this.isMarkdown(url) ? content : this.htmlToMarkdown(content, url);
        results.push({
          siteId: site.id,
          url,
          path,
          content: processed,
          fetchedAt: now,
        });
      } catch (err) {
        console.warn(`[doc-learner] Failed to fetch ${url}:`, err);
      }
    }

    return results;
  }

  private isMarkdown(url: string): boolean {
    const u = new URL(url);
    return u.pathname.endsWith(".md") || u.pathname.endsWith(".mdx");
  }

  private urlToPath(url: string): string {
    const u = new URL(url);
    let p = u.pathname.replace(/^\//, "").replace(/\.(html?|md|mdx)$/, "");
    if (!p || p === "/") p = "index";
    return p.replace(/\//g, "_") + ".md";
  }

  /**
   * Minimal HTML-to-Markdown for static doc sites.
   * Strips tags, preserves basic structure.
   * For advanced extraction, the companion CLI with Readability should be used.
   */
  private htmlToMarkdown(html: string, _url: string): string {
    let text = html;
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
    text = text.replace(/<header[\s\S]*?<\/header>/gi, "");

    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n");
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n");
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n");
    text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n\n");
    text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
    text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "```\n$1\n```\n\n");
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
    text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
    text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");

    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
  }
}
