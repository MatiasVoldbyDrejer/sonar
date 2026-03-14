export type ModelId = 'sonnet' | 'opus' | 'gemini-flash' | 'gemini-flash-lite';
export const DEFAULT_MODEL: ModelId = 'gemini-flash';
export const DEFAULT_TELEGRAM_MODEL: ModelId = 'gemini-flash-lite';

export const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: 'sonnet', label: 'Claude Sonnet' },
  { value: 'opus', label: 'Claude Opus' },
  { value: 'gemini-flash', label: 'Gemini 3 Flash' },
  { value: 'gemini-flash-lite', label: 'Gemini 3.1 Flash Lite' },
];