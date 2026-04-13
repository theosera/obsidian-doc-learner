import { requestUrl } from "obsidian";
import type { AIAnalysis } from "../types";

export interface MediaResult {
  type: "youtube" | "gif";
  title: string;
  url: string;
  embedCode: string;
}

/**
 * Finds related YouTube videos and GIF resources for a learning note.
 * Uses YouTube search links by default; optionally integrates with
 * YouTube Data API v3 when YOUTUBE_API_KEY is available.
 */
export class MediaFinder {
  private youtubeApiKey: string | null;

  constructor() {
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY ?? null;
  }

  async findMedia(analysis: AIAnalysis): Promise<MediaResult[]> {
    const results: MediaResult[] = [];

    for (const query of analysis.youtubeQueries) {
      const videos = await this.searchYouTube(query);
      results.push(...videos);
    }

    return results;
  }

  private async searchYouTube(query: string): Promise<MediaResult[]> {
    if (this.youtubeApiKey) {
      return this.searchYouTubeAPI(query);
    }
    return this.searchYouTubeFallback(query);
  }

  /**
   * YouTube Data API v3 search.
   * Requires YOUTUBE_API_KEY environment variable.
   */
  private async searchYouTubeAPI(query: string): Promise<MediaResult[]> {
    try {
      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        maxResults: "3",
        relevanceLanguage: "ja",
        key: this.youtubeApiKey!,
      });

      const resp = await requestUrl({
        url: `https://www.googleapis.com/youtube/v3/search?${params}`,
        method: "GET",
      });

      const data = JSON.parse(resp.text);
      if (!data.items) return [];

      return data.items.map((item: YouTubeSearchItem) => {
        const videoId = item.id.videoId;
        return {
          type: "youtube" as const,
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          embedCode: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
        };
      });
    } catch (err) {
      console.warn("[doc-learner] YouTube API search failed:", err);
      return this.searchYouTubeFallback(query);
    }
  }

  /**
   * Fallback: generate YouTube search links without API key.
   */
  private searchYouTubeFallback(query: string): MediaResult[] {
    const encoded = encodeURIComponent(query);
    return [
      {
        type: "youtube",
        title: `YouTube: "${query}"`,
        url: `https://www.youtube.com/results?search_query=${encoded}`,
        embedCode: `[YouTube: "${query}"](https://www.youtube.com/results?search_query=${encoded})`,
      },
    ];
  }
}

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: { title: string; description: string };
}
