import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

// ─── Provider Detection ───────────────────────────────────────────────────────

type AIProvider = "openai" | "claude" | "bedrock" | "none";

function detectProvider(): AIProvider {
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-")) return "claude";
  if (process.env.AWS_BEDROCK_ACCESS_KEY && process.env.AWS_BEDROCK_SECRET_KEY && process.env.AWS_BEDROCK_REGION) return "bedrock";
  return "none";
}

// ─── OpenAI Client ────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const apiKey = process.env.AZURE_OPENAI_API_KEY!;
  openaiClient = new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
    defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview" },
    defaultHeaders: { "api-key": apiKey },
  });
  return openaiClient;
}

// ─── Claude Client ────────────────────────────────────────────────────────────

let claudeClient: Anthropic | null = null;

function getClaude(): Anthropic {
  if (claudeClient) return claudeClient;
  claudeClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
  return claudeClient;
}

// ─── AWS Bedrock Client ───────────────────────────────────────────────────────

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrock(): BedrockRuntimeClient {
  if (bedrockClient) return bedrockClient;
  bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_BEDROCK_REGION || "ap-southeast-2",
    credentials: {
      accessKeyId: process.env.AWS_BEDROCK_ACCESS_KEY!,
      secretAccessKey: process.env.AWS_BEDROCK_SECRET_KEY!,
    },
  });
  return bedrockClient;
}

// ─── Unified Chat Completion ──────────────────────────────────────────────────

export async function chatCompletion(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}): Promise<string> {
  const provider = detectProvider();

  if (provider === "openai") {
    return chatCompletionOpenAI(opts);
  }
  if (provider === "claude") {
    return chatCompletionClaude(opts);
  }
  if (provider === "bedrock") {
    return chatCompletionBedrock(opts);
  }

  throw new Error("AI_NOT_CONFIGURED");
}

async function chatCompletionOpenAI(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}): Promise<string> {
  const ai = getOpenAI();
  const res = await ai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 4096,
    response_format: opts.responseFormat,
  });

  const content = res.choices[0]?.message?.content ?? "";
  trackUsage(res.usage?.total_tokens ?? 0);
  return content;
}

async function chatCompletionClaude(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}): Promise<string> {
  const claude = getClaude();

  let systemPrompt = opts.system;
  if (opts.responseFormat?.type === "json_object") {
    systemPrompt += "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no code blocks.";
  }

  const res = await claude.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.3,
    system: systemPrompt,
    messages: [
      { role: "user", content: opts.user },
    ],
  });

  const content = res.content[0]?.type === "text" ? res.content[0].text : "";
  trackUsage(res.usage.input_tokens + res.usage.output_tokens);
  return content;
}

async function chatCompletionBedrock(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}): Promise<string> {
  const bedrock = getBedrock();
  const modelId = process.env.AWS_BEDROCK_MODEL || "amazon.nova-pro-v1:0";

  let systemPrompt = opts.system;
  if (opts.responseFormat?.type === "json_object") {
    systemPrompt += "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no code blocks.";
  }

  const params = {
    modelId,
    messages: [{ role: "user" as const, content: [{ text: opts.user }] }],
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.3,
    },
  };

  const command = new ConverseCommand(params);
  const res = await bedrock.send(command);

  const content = res.output?.message?.content?.[0]?.text ?? "";
  const inputTokens = res.usage?.inputTokens ?? 0;
  const outputTokens = res.usage?.outputTokens ?? 0;
  trackUsage(inputTokens + outputTokens);
  return content;
}

// ─── JSON Completion Helper ───────────────────────────────────────────────────

export async function chatCompletionJSON<T>(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const raw = await chatCompletion({
    ...opts,
    responseFormat: { type: "json_object" },
  });

  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1);
    }
  }

  return JSON.parse(jsonStr) as T;
}

// ─── Provider Info ────────────────────────────────────────────────────────────

export function isAIConfigured(): boolean {
  return detectProvider() !== "none";
}

export function getAIProvider(): string {
  return detectProvider();
}

// ─── Cost tracking ────────────────────────────────────────────────────────────

let totalTokensUsed = 0;
let totalAPICalls = 0;

export function getAIUsage() {
  return { totalTokensUsed, totalAPICalls, provider: getAIProvider() };
}

export function trackUsage(tokens: number) {
  totalTokensUsed += tokens;
  totalAPICalls++;
}
