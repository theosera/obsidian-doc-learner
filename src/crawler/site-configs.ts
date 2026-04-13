import type { SiteConfig } from "../types";

/**
 * Parse an llms.txt index file and extract markdown page URLs.
 * llms.txt typically contains lines like:
 *   - [Page Title](https://example.com/docs/page.md)
 * or plain URLs.
 */
export function parseLlmsTxt(content: string, baseUrl?: string): string[] {
  const urls: string[] = [];
  const mdLinkRe = /\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const plainUrlRe = /^(https?:\/\/\S+\.md)\s*$/gm;

  let m: RegExpExecArray | null;
  while ((m = mdLinkRe.exec(content)) !== null) {
    urls.push(m[1]);
  }
  while ((m = plainUrlRe.exec(content)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  if (urls.length === 0 && baseUrl) {
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("/") || trimmed.startsWith("http")) {
        try {
          const resolved = new URL(trimmed, baseUrl).href;
          urls.push(resolved);
        } catch {
          // skip malformed
        }
      }
    }
  }

  return urls;
}

/**
 * Parse a sitemap.xml and extract page URLs.
 */
export function parseSitemap(xml: string): string[] {
  const urls: string[] = [];
  const locRe = /<loc>\s*(.*?)\s*<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = locRe.exec(xml)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

/**
 * Resolve page URLs from a site configuration.
 */
export async function resolvePageUrls(
  site: SiteConfig,
  fetchFn: (url: string) => Promise<string>
): Promise<string[]> {
  switch (site.type) {
    case "llms-txt": {
      if (!site.indexUrl) return [];
      const txt = await fetchFn(site.indexUrl);
      return parseLlmsTxt(txt, site.baseUrl ?? site.indexUrl);
    }
    case "sitemap": {
      if (!site.indexUrl) return [];
      const xml = await fetchFn(site.indexUrl);
      return parseSitemap(xml);
    }
    case "url-list":
      return site.urls ?? [];
  }
}
