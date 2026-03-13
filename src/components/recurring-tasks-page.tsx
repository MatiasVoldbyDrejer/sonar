"use client";

import { useEffect, useState, useCallback } from "react";

import { Play, Pause, Trash2, Plus, Loader2, CalendarClock, Pencil, RotateCw } from "lucide-react";
import type { RecurringTask } from "@/types";

function formatLastRun(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function RecurringTasksPage() {

  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);

  const fetchTasks = useCallback(() => {
    fetch("/api/recurring-tasks")
      .then(res => res.json())
      .then(data => { setTasks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function handleToggle(task: RecurringTask) {
    await fetch(`/api/recurring-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !task.active }),
    });
    fetchTasks();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this recurring task?")) return;
    await fetch(`/api/recurring-tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  }

  async function handleRunNow(id: number) {
    setRunningId(id);
    try {
      await fetch(`/api/recurring-tasks/${id}/run`, { method: "POST" });
    } finally {
      setRunningId(null);
      fetchTasks();
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>Tasks</span>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500,
            color: "var(--foreground)", padding: "6px 14px", borderRadius: "var(--radius-lg)",
            background: "var(--background)", border: "1px solid var(--border)", cursor: "pointer",
            transition: "background 150ms",
          }}
          onMouseOver={e => { e.currentTarget.style.background = "var(--background-quiet-color)"; }}
          onMouseOut={e => { e.currentTarget.style.background = "var(--background)"; }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          New Task
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 720, padding: "20px 24px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted-foreground)" }}>
              <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {!loading && tasks.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <CalendarClock style={{ width: 32, height: 32, color: "var(--muted-foreground)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 4 }}>
                No recurring tasks yet
              </p>
              <p style={{ fontSize: 13, color: "var(--foreground-quieter-color)" }}>
                Create one here or ask the agent to set up a scheduled task
              </p>
            </div>
          )}

          {tasks.map((task, i) => (
            <div
              key={task.id}
              style={{
                padding: "16px 0",
                borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none",
                opacity: task.active ? 1 : 0.55,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 15, color: "var(--foreground)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {task.name}
                  </div>
                  <div style={{
                    fontSize: 13, color: "var(--muted-foreground)", marginTop: 4,
                    overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {task.prompt}
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, marginTop: 8,
                    fontSize: 12, color: "var(--foreground-quieter-color)",
                  }}>
                    <span>{cronToHuman(task.cronExpression)}</span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span>Last run: {formatLastRun(task.lastRunAt)}</span>
                    {!task.active && (
                      <>
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span style={{ color: "var(--muted-foreground)" }}>Paused</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditingTask(task)}
                    title="Edit"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 32, height: 32, borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
                      color: "var(--foreground)",
                    }}
                  >
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>
                  <button
                    onClick={() => handleRunNow(task.id)}
                    disabled={runningId === task.id}
                    title="Run now"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 32, height: 32, borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
                      color: "var(--foreground)", opacity: runningId === task.id ? 0.5 : 1,
                    }}
                  >
                    {runningId === task.id ? (
                      <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                    ) : (
                      <RotateCw style={{ width: 14, height: 14 }} />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(task)}
                    title={task.active ? "Pause" : "Resume"}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 32, height: 32, borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
                      color: "var(--foreground)",
                    }}
                  >
                    {task.active ? <Pause style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    title="Delete"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 32, height: 32, borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
                      color: "var(--destructive)",
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create dialog */}
      {showCreate && <CreateTaskDialog onClose={() => setShowCreate(false)} onCreated={fetchTasks} />}
      {editingTask && <EditTaskDialog task={editingTask} onClose={() => setEditingTask(null)} onSaved={fetchTasks} />}
    </div>
  );
}

const MODEL_OPTIONS = [
  { value: "sonnet", label: "Claude Sonnet" },
  { value: "opus", label: "Claude Opus" },
  { value: "gemini-flash", label: "Gemini 3 Flash" },
  { value: "gemini-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

function CreateTaskDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cronExpression, setCronExpression] = useState("0 10 * * *");
  const [model, setModel] = useState("gemini-flash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/recurring-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, prompt, cronExpression, model }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create task");
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  }

  const presets = [
    { label: "Daily 10am", value: "0 10 * * *" },
    { label: "Daily 8am", value: "0 8 * * *" },
    { label: "Weekdays 9am", value: "0 9 * * 1-5" },
    { label: "Monday 9am", value: "0 9 * * 1" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 50,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--color-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 24, width: 480, maxWidth: "90vw",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", marginBottom: 20 }}>
          New Recurring Task
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Daily Portfolio Update"
            required
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="How is my portfolio doing? Any significant moves or news I should know about?"
            required
            rows={3}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Schedule
          </label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {presets.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setCronExpression(p.value)}
                style={{
                  padding: "4px 10px", fontSize: 12, borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)", cursor: "pointer",
                  background: cronExpression === p.value ? "var(--foreground)" : "transparent",
                  color: cronExpression === p.value ? "var(--background)" : "var(--muted-foreground)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={cronExpression}
            onChange={e => setCronExpression(e.target.value)}
            placeholder="0 10 * * *"
            required
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", fontFamily: "monospace", boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 12, color: "var(--foreground-quieter-color)", marginTop: 4 }}>
            {cronToHuman(cronExpression)}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Model
          </label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", boxSizing: "border-box",
            }}
          >
            {MODEL_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "var(--destructive)", marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--foreground)", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name || !prompt}
            style={{
              padding: "8px 16px", fontSize: 14, fontWeight: 500, borderRadius: "var(--radius-md)",
              border: "none", background: "var(--foreground)", color: "var(--background)",
              cursor: saving ? "wait" : "pointer", opacity: saving || !name || !prompt ? 0.5 : 1,
            }}
          >
            {saving ? "Creating..." : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditTaskDialog({ task, onClose, onSaved }: { task: RecurringTask; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(task.name);
  const [prompt, setPrompt] = useState(task.prompt);
  const [cronExpression, setCronExpression] = useState(task.cronExpression);
  const [model, setModel] = useState(task.model || "gemini-flash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch(`/api/recurring-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, prompt, cronExpression, model }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update task");
      setSaving(false);
      return;
    }

    onSaved();
    onClose();
  }

  const presets = [
    { label: "Daily 10am", value: "0 10 * * *" },
    { label: "Daily 8am", value: "0 8 * * *" },
    { label: "Weekdays 9am", value: "0 9 * * 1-5" },
    { label: "Monday 9am", value: "0 9 * * 1" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 50,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--color-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 24, width: 480, maxWidth: "90vw",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", marginBottom: 20 }}>
          Edit Task
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            required
            rows={3}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Schedule
          </label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {presets.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setCronExpression(p.value)}
                style={{
                  padding: "4px 10px", fontSize: 12, borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)", cursor: "pointer",
                  background: cronExpression === p.value ? "var(--foreground)" : "transparent",
                  color: cronExpression === p.value ? "var(--background)" : "var(--muted-foreground)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={cronExpression}
            onChange={e => setCronExpression(e.target.value)}
            required
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", fontFamily: "monospace", boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 12, color: "var(--foreground-quieter-color)", marginTop: 4 }}>
            {cronToHuman(cronExpression)}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
            Model
          </label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)",
              outline: "none", boxSizing: "border-box",
            }}
          >
            {MODEL_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "var(--destructive)", marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px", fontSize: 14, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--foreground)", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name || !prompt}
            style={{
              padding: "8px 16px", fontSize: 14, fontWeight: 500, borderRadius: "var(--radius-md)",
              border: "none", background: "var(--foreground)", color: "var(--background)",
              cursor: saving ? "wait" : "pointer", opacity: saving || !name || !prompt ? 0.5 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function cronToHuman(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const time = `${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;

  if (dom === "*" && mon === "*" && dow === "*") return `Daily at ${time}`;
  if (dom === "*" && mon === "*" && dow !== "*") {
    const dayNames = dow.split(",").map(d => days[Number(d)] || d);
    if (dow === "1-5") return `Weekdays at ${time}`;
    return `${dayNames.join(", ")} at ${time}`;
  }
  return `${expr}`;
}
