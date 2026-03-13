"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Play, Pause, Pencil, Trash2, Loader2, RotateCw, Check, X } from "lucide-react";

interface RecurringTaskBlockData {
  id: number;
  name: string;
  schedule: string;
  prompt: string;
  active?: boolean;
  timezone?: string;
  model?: string;
}

const MODEL_OPTIONS = [
  { value: "sonnet", label: "Claude Sonnet" },
  { value: "opus", label: "Claude Opus" },
  { value: "gemini-flash", label: "Gemini 3 Flash" },
  { value: "gemini-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

const SCHEDULE_PRESETS = [
  { label: "Daily 10am", value: "0 10 * * *" },
  { label: "Daily 8am", value: "0 8 * * *" },
  { label: "Weekdays 9am", value: "0 9 * * 1-5" },
  { label: "Monday 9am", value: "0 9 * * 1" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
];

function cronToHuman(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const time = `${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  if (parts[2] === "*" && parts[3] === "*" && dow === "*") return `Daily at ${time}`;
  if (parts[2] === "*" && parts[3] === "*" && dow !== "*") {
    if (dow === "1-5") return `Weekdays at ${time}`;
    const dayNames = dow.split(",").map(d => days[Number(d)] || d);
    return `${dayNames.join(", ")} at ${time}`;
  }
  return expr;
}

export function RecurringTaskBlock({ data }: { data: RecurringTaskBlockData }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [task, setTask] = useState(data);
  const [active, setActive] = useState(data.active !== false);
  const [running, setRunning] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(data.name);
  const [editPrompt, setEditPrompt] = useState(data.prompt);
  const [editSchedule, setEditSchedule] = useState(data.schedule);
  const [editModel, setEditModel] = useState(data.model || "gemini-flash");
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const newActive = !active;
    const res = await fetch(`/api/recurring-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: newActive }),
    });
    if (res.ok) setActive(newActive);
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      await fetch(`/api/recurring-tasks/${task.id}/run`, { method: "POST" });
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/recurring-tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) setDeleted(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    const res = await fetch(`/api/recurring-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        prompt: editPrompt,
        cronExpression: editSchedule,
        model: editModel,
      }),
    });
    if (res.ok) {
      setTask({ ...task, name: editName, prompt: editPrompt, schedule: editSchedule, model: editModel });
      setEditing(false);
    }
    setSaving(false);
  }

  function handleCancelEdit() {
    setEditName(task.name);
    setEditPrompt(task.prompt);
    setEditSchedule(task.schedule);
    setEditModel(task.model || "gemini-flash");
    setEditing(false);
  }

  if (deleted) {
    return (
      <div style={{
        margin: "8px 0",
        padding: "12px 16px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        background: "var(--card)",
        fontSize: 13,
        color: "var(--muted-foreground)",
        fontStyle: "italic",
      }}>
        Task deleted
      </div>
    );
  }

  return (
    <div style={{
      margin: "8px 0",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      overflow: "hidden",
      opacity: active ? 1 : 0.6,
      transition: "opacity 150ms",
    }}>
      {/* Header — always visible, clickable to expand */}
      <button
        onClick={() => { if (!editing) setExpanded(!expanded); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: editing ? "default" : "pointer",
          color: "var(--foreground)",
          textAlign: "left",
          fontSize: 14,
        }}
      >
        <CalendarClock style={{ width: 16, height: 16, color: "var(--primary)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{task.name}</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            {cronToHuman(task.schedule)}
            {!active && <span style={{ marginLeft: 8, color: "var(--muted-foreground)" }}>Paused</span>}
          </div>
        </div>
        {!editing && (
          expanded
            ? <ChevronUp style={{ width: 14, height: 14, color: "var(--muted-foreground)", flexShrink: 0 }} />
            : <ChevronDown style={{ width: 14, height: 14, color: "var(--muted-foreground)", flexShrink: 0 }} />
        )}
      </button>

      {/* Expanded content */}
      {expanded && !editing && (
        <div style={{ padding: "0 16px 12px", borderTop: "1px solid var(--border)" }}>
          {/* Prompt preview */}
          <div style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
            padding: "12px 0 8px",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}>
            {task.prompt}
          </div>

          {/* Meta row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            color: "var(--foreground-quieter-color)",
            marginBottom: 12,
          }}>
            <span>{task.timezone || "Europe/Copenhagen"}</span>
            {task.model && (
              <>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>{MODEL_OPTIONS.find(m => m.value === task.model)?.label || task.model}</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            <ActionButton icon={<Pencil style={{ width: 13, height: 13 }} />} label="Edit" onClick={() => setEditing(true)} />
            <ActionButton
              icon={running
                ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                : <RotateCw style={{ width: 13, height: 13 }} />}
              label="Run now"
              onClick={handleRunNow}
              disabled={running}
            />
            <ActionButton
              icon={active ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
              label={active ? "Pause" : "Resume"}
              onClick={handleToggle}
            />
            <ActionButton
              icon={<Trash2 style={{ width: 13, height: 13 }} />}
              label="Delete"
              onClick={handleDelete}
              destructive
            />
          </div>
        </div>
      )}

      {/* Edit form */}
      {expanded && editing && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ paddingTop: 12 }}>
            <FieldLabel>Name</FieldLabel>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <FieldLabel>Prompt</FieldLabel>
            <textarea
              value={editPrompt}
              onChange={e => setEditPrompt(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <FieldLabel>Schedule</FieldLabel>
            <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
              {SCHEDULE_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setEditSchedule(p.value)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 11,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    background: editSchedule === p.value ? "var(--foreground)" : "transparent",
                    color: editSchedule === p.value ? "var(--background)" : "var(--muted-foreground)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={editSchedule}
              onChange={e => setEditSchedule(e.target.value)}
              style={{ ...inputStyle, fontFamily: "monospace" }}
            />
            <div style={{ fontSize: 11, color: "var(--foreground-quieter-color)", marginTop: 3 }}>
              {cronToHuman(editSchedule)}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <FieldLabel>Model</FieldLabel>
            <select
              value={editModel}
              onChange={e => setEditModel(e.target.value)}
              style={inputStyle}
            >
              {MODEL_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            <ActionButton
              icon={saving ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Check style={{ width: 13, height: 13 }} />}
              label={saving ? "Saving..." : "Save"}
              onClick={handleSaveEdit}
              disabled={saving || !editName || !editPrompt}
              primary
            />
            <ActionButton icon={<X style={{ width: 13, height: 13 }} />} label="Cancel" onClick={handleCancelEdit} />
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  fontSize: 13,
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  outline: "none",
  boxSizing: "border-box",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 4 }}>
      {children}
    </label>
  );
}

function ActionButton({ icon, label, onClick, disabled, destructive, primary }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      data-hover="text-btn"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        fontSize: 12,
        borderRadius: "var(--radius-md)",
        border: primary ? "none" : "1px solid var(--border)",
        background: primary ? "var(--foreground)" : "transparent",
        color: primary ? "var(--background)" : destructive ? "var(--destructive)" : "var(--muted-foreground)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
