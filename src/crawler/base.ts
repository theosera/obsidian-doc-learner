import type { CrawlResult, SiteConfig } from "../types";

export interface ICrawler {
  crawl(site: SiteConfig): Promise<CrawlResult[]>;
}
