"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  citations?: string[];
}

export function MarkdownContent({ content, citations }: MarkdownContentProps) {
  // Replace citation references [1], [2] etc. with links
  let processedContent = content;
  if (citations && citations.length > 0) {
    citations.forEach((url, index) => {
      const ref = `[${index + 1}]`;
      processedContent = processedContent.replaceAll(
        ref,
        `[\\[${index + 1}\\]](${url})`
      );
    });
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {processedContent}
      </ReactMarkdown>
      {citations && citations.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Sources
          </p>
          <ol className="text-xs text-muted-foreground space-y-1">
            {citations.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
