#!/usr/bin/env npx ts-node
/**
 * Companion CLI for SPA site crawling via Playwright.
 * Invoked by the Doc Learner plugin when fetch-based crawling fails.
 *
 * Usage:
 *   npx ts-node companion/crawl.ts --url <url> --output <dir>
 *   npx ts-node companion/crawl.ts --urls <file> --output <dir>
 *
 * Dependencies (install separately):
 *   npm install playwright @playwright/test
 *
 * Output: one .md file per URL in the output directory.
 */
import * as fs from "fs";
import * as path from "path";

interface CrawlOptions {
  urls: string[];
  outputDir: string;
  waitMs: number;
}

function parseArgs(): CrawlOptions {
  const args = process.argv.slice(2);
  let urls: string[] = [];
  let outputDir = "./output";
  let waitMs = 3000;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--url":
        urls.push(args[++i]);
        break;
      case "--urls": {
        const file = args[++i];
        const content = fs.readFileSync(file, "utf-8");
        urls.push(...content.split("\n").map((l) => l.trim()).filter(Boolean));
        break;
      }
      case "--output":
        outputDir = args[++i];
        break;
      case "--wait":
        waitMs = parseInt(args[++i], 10);
        break;
    }
  }

  if (urls.length === 0) {
    console.error("Usage: crawl.ts --url <url> [--url <url2>] --output <dir>");
    process.exit(1);
  }

  return { urls, outputDir, waitMs };
}

async function crawlWithPlaywright(options: CrawlOptions): Promise<void> {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.error(
      "Playwright is not installed. Run: npm install playwright && npx playwright install chromium"
    );
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) DocLearner/1.0",
    });

    fs.mkdirSync(options.outputDir, { recursive: true });

    for (const url of options.urls) {
      console.log(`Crawling: ${url}`);
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(options.waitMs);

        const markdown = await page.evaluate(() => {
          const article =
            document.querySelector("article") ??
            document.querySelector("main") ??
            document.querySelector('[role="main"]') ??
            document.body;

          function nodeToMd(node: Node): string {
            if (node.nodeType === Node.TEXT_NODE) {
              return node.textContent ?? "";
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return "";

            const el = node as Element;
            const tag = el.tagName.toLowerCase();
            const children = Array.from(el.childNodes).map(nodeToMd).join("");

            switch (tag) {
              case "h1": return `# ${children}\n\n`;
              case "h2": return `## ${children}\n\n`;
              case "h3": return `### ${children}\n\n`;
              case "h4": return `#### ${children}\n\n`;
              case "p": return `${children}\n\n`;
              case "li": return `- ${children}\n`;
              case "code": return `\`${children}\``;
              case "pre": return `\`\`\`\n${el.textContent}\n\`\`\`\n\n`;
              case "a": {
                const href = el.getAttribute("href") ?? "";
                return `[${children}](${href})`;
              }
              case "strong":
              case "b":
                return `**${children}**`;
              case "em":
              case "i":
                return `*${children}*`;
              case "br":
                return "\n";
              case "script":
              case "style":
              case "nav":
              case "footer":
              case "header":
                return "";
              default:
                return children;
            }
          }

          return nodeToMd(article);
        });

        const filename = urlToFilename(url);
        const outPath = path.join(options.outputDir, filename);
        fs.writeFileSync(outPath, markdown.trim(), "utf-8");
        console.log(`  → ${outPath}`);

        await page.close();
      } catch (err) {
        console.error(`  Failed: ${url}`, err);
      }
    }
  } finally {
    await browser.close();
  }
}

function urlToFilename(url: string): string {
  const u = new URL(url);
  let p = u.pathname.replace(/^\//, "").replace(/\.(html?)$/, "");
  if (!p) p = "index";
  return p.replace(/\//g, "_") + ".md";
}

const options = parseArgs();
crawlWithPlaywright(options).catch((err) => {
  console.error("Crawl failed:", err);
  process.exit(1);
});
