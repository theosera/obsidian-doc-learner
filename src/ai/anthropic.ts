import { BaseAIProvider } from "./provider";

export class AnthropicProvider extends BaseAIProvider {
  protected async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const body = {
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };

    const raw = await this.httpPost(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body
    );

    const resp = JSON.parse(raw);
    if (resp.content && resp.content.length > 0) {
      return resp.content[0].text;
    }
    throw new Error(`Anthropic API error: ${raw.substring(0, 200)}`);
  }
}
