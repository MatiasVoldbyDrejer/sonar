"use client";

import { RecurringTaskBlock } from "./recurring-task-block";
import { ChartBlock } from "./chart-block";

// Registry of UI block types → components
const blockComponents: Record<string, React.ComponentType<{ data: any }>> = {
  "recurring-task": RecurringTaskBlock,
  "chart": ChartBlock,
};

export interface UIBlockData {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Renders a sonar-ui block if the type is registered, otherwise returns null.
 */
export function UIBlock({ block }: { block: UIBlockData }) {
  const Component = blockComponents[block.type];
  if (!Component) return null;
  return <Component data={block.data} />;
}

/**
 * Attempts to parse a code block's content as a sonar-ui JSON block.
 * Returns the parsed block if valid, or null if not a sonar-ui block.
 */
export function parseSonarUIBlock(content: string): UIBlockData | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.type === "string" && parsed.data) {
      return parsed as UIBlockData;
    }
  } catch {
    // Not valid JSON — not a UI block
  }
  return null;
}
