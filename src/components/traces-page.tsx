"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, ListTree, Search, X, Maximize2, ChevronRight, ChevronDown } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import type { Trace, TraceSummary } from "@/lib/db";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(input: number, output: number): string {
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return `${fmt(input)} / ${fmt(output)}`;
}

function modelBadgeColor(modelId: string): string {
  if (modelId.includes("opus")) return "#a78bfa";
  if (modelId.includes("sonnet")) return "#60a5fa";
  if (modelId.includes("gemini")) return "#34d399";
  if (modelId.includes("flash-lite")) return "#6ee7b7";
  return "var(--muted-foreground)";
}

function modelLabel(modelId: string): string {
  if (modelId.includes("opus")) return "opus";
  if (modelId.includes("sonnet")) return "sonnet";
  if (modelId.includes("flash-lite")) return "flash-lite";
  if (modelId.includes("gemini") || modelId.includes("flash")) return "gemini-flash";
  return modelId;
}

function CollapsibleSection({ label, defaultOpen = false, children }: { label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 32 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
          color: "var(--muted-foreground)", padding: 0, marginBottom: open ? 8 : 0,
        }}
      >
        {open ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRight style={{ width: 12, height: 12 }} />}
        {label}
      </button>
      {open && children}
    </div>
  );
}

function CollapsibleJSON({ label, data, defaultOpen = false }: { label: string; data: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const json = JSON.stringify(data, null, 2) ?? "null";
  const isLong = json.length > 500;

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--muted-foreground)", fontSize: 12, padding: "2px 0",
        }}
      >
        {open ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRight style={{ width: 12, height: 12 }} />}
        {label}
      </button>
      {open && (
        <pre style={{
          fontSize: 11, lineHeight: 1.4, padding: "8px 12px",
          background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)",
          overflow: "auto", maxHeight: isLong ? 300 : "none",
          color: "var(--muted-foreground)", margin: "4px 0 0 16px",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>
          {json}
        </pre>
      )}
    </div>
  );
}

function TraceContent({ trace }: { trace: Trace }) {
  return (
    <>
      {/* User prompt */}
      <div style={{
        borderLeft: "3px solid var(--foreground)",
        paddingLeft: 16, marginBottom: 32,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 8 }}>
          Prompt
        </div>
        <div style={{ fontSize: 15, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>
          {trace.prompt}
        </div>
      </div>

      {/* Agent response (collapsed by default) */}
      <CollapsibleSection label="Response" defaultOpen={false}>
        <div style={{ fontSize: 14, color: "var(--foreground)" }}>
          <MarkdownContent content={trace.responseText} instruments={[]} />
        </div>
      </CollapsibleSection>

      {/* Steps */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 12 }}>
          Steps ({trace.steps.length})
        </div>
        {trace.steps.map((step) => (
          <StepDetail key={step.index} step={step} />
        ))}
      </div>

      {/* Metadata footer */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 16, padding: "16px 0",
        borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)",
      }}>
        <span>Model: <span style={{ color: modelBadgeColor(trace.modelId) }}>{modelLabel(trace.modelId)}</span></span>
        <span>Tokens: {formatTokens(trace.totalInputTokens, trace.totalOutputTokens)}</span>
        <span>Duration: {formatDuration(trace.durationMs)}</span>
        <span>Finish: {trace.finishReason}</span>
        {trace.chatId && (
          <a href={`/chat/${trace.chatId}`} style={{ color: "var(--foreground)", textDecoration: "underline" }}>
            View chat
          </a>
        )}
      </div>
    </>
  );
}

function TracePanel({ traceId, onClose }: { traceId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const currentWidth = panelRef.current?.offsetWidth ?? 600;
    dragRef.current = { startX: e.clientX, startWidth: currentWidth };
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !panelRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      const newWidth = Math.max(320, Math.min(window.innerWidth - 300, dragRef.current.startWidth + delta));
      panelRef.current.style.width = `${newWidth}px`;
    };
    const onUp = () => {
      if (panelRef.current) {
        setPanelWidth(panelRef.current.offsetWidth);
      }
      setDragging(false);
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    hasAnimated.current = true;
  }, []);

  useEffect(() => {
    setLoading(true);
    setTrace(null);
    setFullscreen(false);
    fetch(`/api/traces/${traceId}`)
      .then(r => r.json())
      .then(data => { setTrace(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [traceId]);

  const loadingSpinner = (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite", color: "var(--muted-foreground)" }} />
    </div>
  );

  // Full-page popup
  if (fullscreen) {
    return (
      <>
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
          onClick={() => setFullscreen(false)}
        />
        <div style={{
          position: "fixed", inset: 20, zIndex: 50,
          background: "var(--background)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)", overflowY: "auto",
        }}>
          <div style={{
            position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "flex-end",
            gap: 6, padding: "12px 12px 0 0",
          }}>
            <button
              onClick={() => setFullscreen(false)}
              title="Collapse to panel"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)", background: "var(--background)",
                cursor: "pointer", color: "var(--foreground)",
              }}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
            <button
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)", background: "var(--background)",
                cursor: "pointer", color: "var(--foreground)",
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          {loading && loadingSpinner}
          {trace && (
            <div style={{ padding: "24px 32px", maxWidth: 900, margin: "0 auto" }}>
              <TraceContent trace={trace} />
            </div>
          )}
        </div>
      </>
    );
  }

  // Slide-in side panel
  return (
    <div ref={panelRef} style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: panelWidth,
      zIndex: 30, background: "var(--background)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
      overflowY: "auto",
      animation: hasAnimated.current ? "none" : "slideInRight 150ms ease-out",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        style={{
          position: "absolute", top: 0, left: -3, bottom: 0, width: 6,
          cursor: "col-resize", zIndex: 20,
        }}
      />
      {/* Panel header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", height: 49, boxSizing: "border-box",
        borderBottom: "1px solid var(--border)",
        background: "var(--background)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)" }}>Trace Detail</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setFullscreen(true)}
            title="Open fullscreen"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "transparent",
              cursor: "pointer", color: "var(--foreground)",
            }}
          >
            <Maximize2 style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "transparent",
              cursor: "pointer", color: "var(--foreground)",
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {loading && loadingSpinner}
      {trace && (
        <div style={{ padding: "20px 16px" }}>
          <TraceContent trace={trace} />
        </div>
      )}
    </div>
  );
}

function StepDetail({ step }: { step: Trace["steps"][0] }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      marginBottom: 8, border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)", overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "10px 12px",
          background: "rgba(255,255,255,0.02)", border: "none", cursor: "pointer",
          color: "var(--foreground)", fontSize: 13, fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {open ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
            Step {step.index + 1}
          </span>
          {step.toolCalls.length > 0 && (
            <span style={{
              fontSize: 11, color: "var(--muted-foreground)", fontWeight: 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>
              {step.toolCalls.map(tc => tc.toolName).join(", ")}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 400 }}>
          {step.inputTokens + step.outputTokens} tok
        </span>
      </button>

      {open && (
        <div style={{ padding: "8px 12px 12px 12px" }}>
          {step.toolCalls.map((tc, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <CollapsibleJSON label={`${tc.toolName} args`} data={tc.args} />
              {step.toolResults[i] && (
                <CollapsibleJSON label={`${tc.toolName} result`} data={step.toolResults[i].result} />
              )}
            </div>
          ))}
          {step.text && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Text output</div>
              <div style={{
                fontSize: 13, color: "var(--foreground)", whiteSpace: "pre-wrap",
                padding: "8px 12px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-md)",
                maxHeight: 200, overflowY: "auto",
              }}>
                {step.text}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TracesPage() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchTraces = useCallback(() => {
    fetch("/api/traces")
      .then(r => r.json())
      .then(data => { setTraces(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTraces(); }, [fetchTraces]);

  const filtered = search
    ? traces.filter(t => t.prompt.toLowerCase().includes(search.toLowerCase()) || t.modelId.toLowerCase().includes(search.toLowerCase()))
    : traces;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", height: 49, boxSizing: "border-box",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>Traces</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 720, padding: "20px 24px" }}>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <Search
              style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                width: 15, height: 15, color: "var(--muted-foreground)", pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search traces..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 38px", fontSize: 14,
                borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
                background: "var(--color-card)", color: "var(--foreground)", outline: "none",
              }}
            />
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted-foreground)" }}>
              <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {!loading && traces.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <ListTree style={{ width: 32, height: 32, color: "var(--muted-foreground)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 4 }}>
                No traces yet
              </p>
              <p style={{ fontSize: 13, color: "var(--foreground-quieter-color)" }}>
                Send a chat message to start capturing traces
              </p>
            </div>
          )}

          {/* Trace table */}
          {!loading && filtered.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Time", "Model", "Prompt", "Steps", "Tools", "Tokens (in/out)", "Duration"].map(h => (
                      <th key={h} style={{
                        textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        color: "var(--muted-foreground)", whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(trace => (
                    <tr
                      key={trace.id}
                      onClick={() => setSelectedId(trace.id)}
                      style={{
                        borderBottom: "1px solid var(--border)", cursor: "pointer",
                        transition: "background 100ms",
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--muted-foreground)" }}>
                        {formatRelativeTime(trace.createdAt)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 9999,
                          fontSize: 11, fontWeight: 500, color: modelBadgeColor(trace.modelId),
                          border: `1px solid ${modelBadgeColor(trace.modelId)}33`,
                          background: `${modelBadgeColor(trace.modelId)}15`,
                        }}>
                          {modelLabel(trace.modelId)}
                        </span>
                      </td>
                      <td style={{
                        padding: "10px 12px", color: "var(--foreground)",
                        maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {trace.prompt || "(empty)"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted-foreground)", textAlign: "center" }}>
                        {trace.stepCount}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted-foreground)", textAlign: "center" }}>
                        {trace.toolCount}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted-foreground)", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }}>
                        {formatTokens(trace.totalInputTokens, trace.totalOutputTokens)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                        {formatDuration(trace.durationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length === 0 && traces.length > 0 && (
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", textAlign: "center", padding: "32px 0" }}>
              No traces matching &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      </div>

      {selectedId && (
        <TracePanel traceId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
