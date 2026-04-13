import { App, normalizePath } from "obsidian";
import type { CrawlResult, Snapshot, SnapshotPage } from "../types";
import { toSafeTimestamp, fromSafeTimestamp } from "../utils/date";

const SNAPSHOT_DIR = ".doc-learner/snapshots";

export class SnapshotManager {
  constructor(private app: App) {}

  async saveSnapshot(siteId: string, results: CrawlResult[]): Promise<Snapshot> {
    if (results.length === 0) {
      return { siteId, timestamp: new Date().toISOString(), pages: [] };
    }

    const timestamp = results[0].fetchedAt;
    const pages: SnapshotPage[] = results.map((r) => ({
      url: r.url,
      path: r.path,
      contentHash: this.simpleHash(r.content),
      content: r.content,
    }));

    const snapshot: Snapshot = { siteId, timestamp, pages };
    const dir = normalizePath(`${SNAPSHOT_DIR}/${siteId}/${toSafeTimestamp(new Date(timestamp))}`);

    await this.ensureDir(dir);

    for (const page of pages) {
      const filePath = normalizePath(`${dir}/${page.path}`);
      await this.app.vault.adapter.write(filePath, page.content);
    }

    const metaPath = normalizePath(`${dir}/_meta.json`);
    const meta = pages.map((p) => ({
      url: p.url,
      path: p.path,
      contentHash: p.contentHash,
    }));
    await this.app.vault.adapter.write(metaPath, JSON.stringify(meta, null, 2));

    return snapshot;
  }

  async getLatestSnapshot(siteId: string): Promise<Snapshot | null> {
    const baseDir = normalizePath(`${SNAPSHOT_DIR}/${siteId}`);
    if (!(await this.app.vault.adapter.exists(baseDir))) return null;

    const listing = await this.app.vault.adapter.list(baseDir);
    const dirs = listing.folders.sort().reverse();

    if (dirs.length === 0) return null;
    return this.loadSnapshot(siteId, dirs[0]);
  }

  async getPreviousSnapshot(siteId: string): Promise<Snapshot | null> {
    const baseDir = normalizePath(`${SNAPSHOT_DIR}/${siteId}`);
    if (!(await this.app.vault.adapter.exists(baseDir))) return null;

    const listing = await this.app.vault.adapter.list(baseDir);
    const dirs = listing.folders.sort().reverse();

    if (dirs.length < 2) return null;
    return this.loadSnapshot(siteId, dirs[1]);
  }

  private async loadSnapshot(siteId: string, dir: string): Promise<Snapshot> {
    const metaPath = normalizePath(`${dir}/_meta.json`);
    const timestamp = fromSafeTimestamp(dir.split("/").pop()!);

    let pageMetas: { url: string; path: string; contentHash: string }[] = [];
    if (await this.app.vault.adapter.exists(metaPath)) {
      const raw = await this.app.vault.adapter.read(metaPath);
      pageMetas = JSON.parse(raw);
    }

    const pages: SnapshotPage[] = [];
    for (const meta of pageMetas) {
      const filePath = normalizePath(`${dir}/${meta.path}`);
      let content = "";
      if (await this.app.vault.adapter.exists(filePath)) {
        content = await this.app.vault.adapter.read(filePath);
      }
      pages.push({ ...meta, content });
    }

    return { siteId, timestamp, pages };
  }

  async pruneOldSnapshots(siteId: string, keepCount: number = 5): Promise<void> {
    const baseDir = normalizePath(`${SNAPSHOT_DIR}/${siteId}`);
    if (!(await this.app.vault.adapter.exists(baseDir))) return;

    const listing = await this.app.vault.adapter.list(baseDir);
    const dirs = listing.folders.sort().reverse();

    for (let i = keepCount; i < dirs.length; i++) {
      await this.removeDirRecursive(dirs[i]);
    }
  }

  private async removeDirRecursive(dir: string): Promise<void> {
    const listing = await this.app.vault.adapter.list(dir);
    for (const file of listing.files) {
      await this.app.vault.adapter.remove(file);
    }
    for (const subdir of listing.folders) {
      await this.removeDirRecursive(subdir);
    }
    await this.app.vault.adapter.rmdir(dir, false);
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
  }

  private simpleHash(str: string): string {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h = ((h << 5) - h + ch) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
}
