import { App, normalizePath } from "obsidian";
import type { AIAnalysis, DiffResult, DocLearnerSettings, LearningNote, RelatedNote } from "../types";
import type { MediaResult } from "./media-finder";
import { buildFrontmatter, buildLearningNoteBody, formatFrontmatter } from "./templates";

export class NoteGenerator {
  constructor(
    private app: App,
    private settings: DocLearnerSettings
  ) {}

  generate(
    analysis: AIAnalysis,
    diffs: DiffResult[],
    relatedNotes: RelatedNote[],
    media: MediaResult[] = []
  ): LearningNote {
    const representative = diffs[0];
    const frontmatter = buildFrontmatter(analysis, representative);
    const body = buildLearningNoteBody(analysis, diffs, relatedNotes, media);

    const date = representative.detectedAt.split("T")[0];
    const slug = this.slugify(analysis.title);
    const filename = `${date}_${slug}.md`;
    const folder = normalizePath(
      `${this.settings.outputRoot}/${representative.siteId}`
    );

    return { frontmatter, body, filename, folder };
  }

  async write(note: LearningNote): Promise<string> {
    const dir = normalizePath(note.folder);
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }

    const filePath = normalizePath(`${dir}/${note.filename}`);
    const content = `${formatFrontmatter(note.frontmatter)}\n\n${note.body}`;
    await this.app.vault.adapter.write(filePath, content);
    return filePath;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\sぁ-んァ-ヶ亜-熙ー-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 60)
      .replace(/-+$/, "");
  }
}
