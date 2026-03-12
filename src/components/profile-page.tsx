"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { InvestorProfile } from "@/types";

const GOAL_OPTIONS = [
  "retirement",
  "wealth-building",
  "income",
  "capital-preservation",
  "speculation",
];

const REGION_OPTIONS = [
  "Nordics",
  "Europe",
  "US",
  "Asia",
  "Emerging Markets",
  "Global",
];

const ASSET_TYPE_OPTIONS = ["stocks", "funds", "etf", "crypto", "bonds"];

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            style={{
              padding: "4px 12px",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid",
              borderColor: isSelected
                ? "var(--primary)"
                : "var(--border)",
              background: isSelected
                ? "var(--primary)"
                : "transparent",
              color: isSelected
                ? "var(--primary-foreground)"
                : "var(--foreground)",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<InvestorProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.profile || {}))
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error();
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<InvestorProfile>) =>
    setProfile((prev) => ({ ...prev, ...patch }));

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted-foreground)" }}>
        Loading profile…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Investor Profile</h1>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Name</Label>
              <Input
                value={profile.name || ""}
                onChange={(e) => update({ name: e.target.value || undefined })}
                placeholder="Your name"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Birth Year</Label>
              <Input
                type="number"
                value={profile.birthYear || ""}
                onChange={(e) =>
                  update({ birthYear: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="e.g. 1985"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Location</Label>
              <Input
                value={profile.location || ""}
                onChange={(e) => update({ location: e.target.value || undefined })}
                placeholder="e.g. Copenhagen, Denmark"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Base Currency</Label>
              <Input
                value={profile.baseCurrency || ""}
                onChange={(e) => update({ baseCurrency: e.target.value.toUpperCase() || undefined })}
                placeholder="e.g. DKK, EUR, USD"
                maxLength={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investment Style */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Style</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label>Risk Tolerance</Label>
                <Select
                  value={profile.riskTolerance || ""}
                  onValueChange={(v) =>
                    update({ riskTolerance: (v || undefined) as InvestorProfile["riskTolerance"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label>Time Horizon</Label>
                <Select
                  value={profile.timeHorizon || ""}
                  onValueChange={(v) =>
                    update({ timeHorizon: (v || undefined) as InvestorProfile["timeHorizon"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short-term (&lt;3 years)</SelectItem>
                    <SelectItem value="medium">Medium-term (3–10 years)</SelectItem>
                    <SelectItem value="long">Long-term (10+ years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Investment Goals</Label>
              <MultiSelect
                options={GOAL_OPTIONS}
                selected={profile.investmentGoals || []}
                onChange={(v) => update({ investmentGoals: v.length > 0 ? v : undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Focus Areas */}
      <Card>
        <CardHeader>
          <CardTitle>Focus Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Region Focus</Label>
              <MultiSelect
                options={REGION_OPTIONS}
                selected={profile.regionFocus || []}
                onChange={(v) => update({ regionFocus: v.length > 0 ? v : undefined })}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Sector Interests</Label>
              <Input
                value={(profile.sectorInterests || []).join(", ")}
                onChange={(e) =>
                  update({
                    sectorInterests: e.target.value
                      ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      : undefined,
                  })
                }
                placeholder="e.g. Technology, Healthcare, Energy"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Asset Type Preferences</Label>
              <MultiSelect
                options={ASSET_TYPE_OPTIONS}
                selected={profile.assetTypePreferences || []}
                onChange={(v) => update({ assetTypePreferences: v.length > 0 ? v : undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Context */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Income Bracket</Label>
              <Input
                value={profile.incomeBracket || ""}
                onChange={(e) => update({ incomeBracket: e.target.value || undefined })}
                placeholder="e.g. 500k-1M DKK"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Net Worth Range</Label>
              <Input
                value={profile.netWorthRange || ""}
                onChange={(e) => update({ netWorthRange: e.target.value || undefined })}
                placeholder="e.g. 2-5M DKK"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label>Investment Experience</Label>
              <Select
                value={profile.investmentExperience || ""}
                onValueChange={(v) =>
                  update({
                    investmentExperience: (v || undefined) as InvestorProfile["investmentExperience"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Notes */}
      <Card>
        <CardHeader>
          <CardTitle>AI Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label>Free-form context for AI analysis</Label>
            <Textarea
              value={profile.notes || ""}
              onChange={(e) => update({ notes: e.target.value || undefined })}
              placeholder="Add any additional context you want the AI to consider when analyzing your portfolio. For example: 'I plan to buy a house in 2 years', 'I'm interested in sustainable investing', 'I have a pension through my employer covering 15% of salary'…"
              style={{ minHeight: 120 }}
            />
          </div>
        </CardContent>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
