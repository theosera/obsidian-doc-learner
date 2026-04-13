import { BaseAIProvider } from "./provider";

export class GLMProvider extends BaseAIProvider {
  protected async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048,
    };

    const raw = await this.httpPost(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      { Authorization: `Bearer ${this.apiKey}` },
      body
    );

    const resp = JSON.parse(raw);
    if (resp.choices?.[0]?.message?.content) {
      return resp.choices[0].message.content;
    }
    throw new Error(`GLM API error: ${raw.substring(0, 200)}`);
  }
}
