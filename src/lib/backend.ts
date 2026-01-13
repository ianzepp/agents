// Model shortcuts to full provider/model names
const MODEL_SHORTCUTS: Record<string, string> = {
  sonnet: "claude-sonnet-4-5",
  opus: "claude-opus-4-5",
  haiku: "claude-haiku-4-5",
  qwen3: "opencode/qwen3-coder",
  deepseek: "openrouter/deepseek/deepseek-chat-v3.1",
  gpt4mini: "openrouter/openai/gpt-4o-mini",
};

export type Backend = "claude" | "opencode";

export function translateModel(model: string): string {
  if (model.includes("/")) return model;
  return MODEL_SHORTCUTS[model] ?? model;
}

export function detectBackend(model: string): Backend {
  // Models with "/" use opencode (multi-provider)
  return model.includes("/") ? "opencode" : "claude";
}

export function resolveModel(shortcut: string): { backend: Backend; model: string } {
  const model = translateModel(shortcut);
  const backend = detectBackend(model);
  return { backend, model };
}

export function listModelShortcuts(): Array<{ shortcut: string; model: string; backend: Backend }> {
  return Object.entries(MODEL_SHORTCUTS).map(([shortcut, model]) => ({
    shortcut,
    model,
    backend: detectBackend(model),
  }));
}
