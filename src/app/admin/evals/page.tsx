"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  annotateAdminEvalCase,
  getAdminEvalRun,
  listAdminEvalRuns,
  type EvalCaseAnnotation,
  type EvalRunDetailResponse,
  type EvalRunSummary,
} from "@/lib/api";

type AnnotationDraft = {
  winner: string;
  label: string;
  action: string;
  note: string;
  tagsText: string;
};

function toPercent(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function extractNestedNumber(record: Record<string, unknown> | null | undefined, path: string[]): number | null {
  let current: unknown = record;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" ? current : null;
}

function extractNestedString(record: Record<string, unknown> | null | undefined, path: string[]): string {
  let current: unknown = record;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}

function annotationToDraft(annotation?: EvalCaseAnnotation): AnnotationDraft {
  return {
    winner: annotation?.winner || "",
    label: annotation?.label || "",
    action: annotation?.action || "",
    note: annotation?.note || "",
    tagsText: (annotation?.tags || []).join(", "),
  };
}

export default function AdminEvalsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [adminUser, setAdminUser] = useState("admin");
  const [runs, setRuns] = useState<EvalRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runDetail, setRunDetail] = useState<EvalRunDetailResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AnnotationDraft>>({});
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [savingCaseId, setSavingCaseId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedKey = window.localStorage.getItem("admin_eval_key");
    const storedUser = window.localStorage.getItem("admin_eval_user");
    if (storedKey) setAdminKey(storedKey);
    if (storedUser) setAdminUser(storedUser);
  }, []);

  const loadRuns = async () => {
    setIsLoadingRuns(true);
    setError("");
    try {
      const data = await listAdminEvalRuns(50, adminKey.trim() || undefined);
      setRuns(data.runs || []);
      if (!selectedRunId && data.runs?.length) {
        setSelectedRunId(data.runs[0].run_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load eval runs");
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const loadRunDetail = async (runId: string) => {
    if (!runId) return;
    setIsLoadingRun(true);
    setError("");
    setMessage("");
    try {
      const detail = await getAdminEvalRun(runId, adminKey.trim() || undefined);
      setRunDetail(detail);
      const nextDrafts: Record<string, AnnotationDraft> = {};
      for (const result of detail.results || []) {
        const existing = detail.annotations?.[result.id];
        nextDrafts[result.id] = annotationToDraft(existing);
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load eval run details");
      setRunDetail(null);
      setDrafts({});
    } finally {
      setIsLoadingRun(false);
    }
  };

  useEffect(() => {
    if (!selectedRunId) return;
    void loadRunDetail(selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId]);

  const sortedCases = useMemo(() => {
    return (runDetail?.results || []).slice().sort((a, b) => a.id.localeCompare(b.id));
  }, [runDetail]);

  const saveCaseAnnotation = async (runId: string, caseId: string) => {
    const draft = drafts[caseId] || annotationToDraft();
    setSavingCaseId(caseId);
    setError("");
    setMessage("");
    try {
      await annotateAdminEvalCase(
        runId,
        caseId,
        {
          winner: draft.winner || null,
          label: draft.label || null,
          action: draft.action || null,
          note: draft.note || null,
          tags: draft.tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        adminKey.trim() || undefined,
        adminUser.trim() || undefined
      );
      setMessage(`Saved annotation for ${caseId}.`);
      await loadRunDetail(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save annotation for ${caseId}`);
    } finally {
      setSavingCaseId("");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#111827]">
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        <div className="mb-4 rounded-xl border border-[#d9dde5] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold">Admin Evals</h1>
              <p className="mt-1 text-sm text-[#4b5563]">
                Compare Vanilla vs RLM outputs and annotate what should improve.
              </p>
            </div>
            <Link href="/admin/control" className="text-sm text-[#2563eb] hover:underline">
              Open Model + Keys Control
            </Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Admin key (if enabled)"
              className="rounded border border-[#cfd5de] bg-white px-3 py-2 text-sm"
              type="password"
            />
            <input
              value={adminUser}
              onChange={(event) => setAdminUser(event.target.value)}
              placeholder="Admin username"
              className="rounded border border-[#cfd5de] bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("admin_eval_key", adminKey);
                  window.localStorage.setItem("admin_eval_user", adminUser);
                }
                void loadRuns();
              }}
              className="rounded border border-[#1f2937] bg-[#1f2937] px-3 py-2 text-sm text-white hover:bg-[#111827]"
            >
              {isLoadingRuns ? "Loading..." : "Load Eval Runs"}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-[#b91c1c]">{error}</p> : null}
          {message ? <p className="mt-2 text-sm text-[#0f766e]">{message}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-[#d9dde5] bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Runs</h2>
              <button
                type="button"
                onClick={() => void loadRuns()}
                className="text-xs text-[#2563eb] hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
              {runs.length === 0 ? (
                <p className="text-xs text-[#6b7280]">No eval runs found.</p>
              ) : (
                runs.map((run) => {
                  const selected = selectedRunId === run.run_id;
                  const aggregate = run.aggregate || {};
                  return (
                    <button
                      key={run.run_id}
                      type="button"
                      onClick={() => setSelectedRunId(run.run_id)}
                      className={`w-full rounded border px-3 py-2 text-left text-xs ${
                        selected
                          ? "border-[#2563eb] bg-[#eff6ff]"
                          : "border-[#d9dde5] bg-white hover:border-[#9ca3af]"
                      }`}
                    >
                      <div className="font-semibold text-[#111827]">{run.run_id}</div>
                      <div className="mt-1 text-[#6b7280]">{run.model || "unknown model"}</div>
                      <div className="mt-1 text-[#6b7280]">
                        overall delta: {toPercent((aggregate as Record<string, unknown>).delta_overall)}
                      </div>
                      <div className="text-[#6b7280]">
                        grounded delta: {toPercent((aggregate as Record<string, unknown>).delta_groundedness)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="rounded-xl border border-[#d9dde5] bg-white p-4 shadow-sm">
            {!runDetail ? (
              <p className="text-sm text-[#6b7280]">
                {isLoadingRun ? "Loading run..." : "Select a run to review case-level outputs."}
              </p>
            ) : (
              <div>
                <div className="mb-3 border-b border-[#e5e7eb] pb-3">
                  <h2 className="text-base font-semibold">{runDetail.run_id}</h2>
                  <p className="text-sm text-[#6b7280]">
                    {runDetail.summary.model || "unknown model"} · {runDetail.summary.dataset || "dataset not set"}
                  </p>
                  <p className="text-sm text-[#6b7280]">
                    cases: {runDetail.summary.cases ?? "-"} · failed: {runDetail.summary.failed_cases ?? 0}
                  </p>
                </div>

                <div className="max-h-[72vh] space-y-3 overflow-auto pr-1">
                  {sortedCases.map((result) => {
                    const draft = drafts[result.id] || annotationToDraft();
                    const vanillaOverall = extractNestedNumber(result.vanilla, ["score", "overall"]);
                    const rlmOverall = extractNestedNumber(result.rlm, ["score", "overall"]);
                    const vanillaAnswer = extractNestedString(result.vanilla, ["answer"]);
                    const rlmAnswer = extractNestedString(result.rlm, ["answer"]);
                    const delta =
                      vanillaOverall !== null && rlmOverall !== null ? rlmOverall - vanillaOverall : null;

                    return (
                      <article key={result.id} className="rounded-lg border border-[#d9dde5] bg-[#fafafa] p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold">{result.id}</h3>
                            {delta !== null ? (
                              <p className="text-xs text-[#4b5563]">overall delta: {toPercent(delta)}</p>
                            ) : null}
                          </div>
                          {result.error ? (
                            <span className="rounded bg-[#fee2e2] px-2 py-1 text-xs text-[#991b1b]">{result.error}</span>
                          ) : null}
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="rounded border border-[#d1d5db] bg-white p-2">
                            <p className="text-xs font-semibold text-[#374151]">
                              Vanilla ({toPercent(vanillaOverall)})
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-xs text-[#4b5563]">
                              {vanillaAnswer || "No answer"}
                            </p>
                          </div>
                          <div className="rounded border border-[#d1d5db] bg-white p-2">
                            <p className="text-xs font-semibold text-[#374151]">
                              RLM ({toPercent(rlmOverall)})
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-xs text-[#4b5563]">
                              {rlmAnswer || "No answer"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 grid gap-2 md:grid-cols-4">
                          <select
                            value={draft.winner}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [result.id]: { ...draft, winner: event.target.value },
                              }))
                            }
                            className="rounded border border-[#cfd5de] bg-white px-2 py-1 text-xs"
                          >
                            <option value="">Winner</option>
                            <option value="rlm">RLM</option>
                            <option value="vanilla">Vanilla</option>
                            <option value="tie">Tie</option>
                          </select>

                          <input
                            value={draft.label}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [result.id]: { ...draft, label: event.target.value },
                              }))
                            }
                            placeholder="Label (e.g. weak_citation)"
                            className="rounded border border-[#cfd5de] bg-white px-2 py-1 text-xs"
                          />

                          <input
                            value={draft.action}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [result.id]: { ...draft, action: event.target.value },
                              }))
                            }
                            placeholder="Action (fix_prompt, fix_retrieval)"
                            className="rounded border border-[#cfd5de] bg-white px-2 py-1 text-xs"
                          />

                          <input
                            value={draft.tagsText}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [result.id]: { ...draft, tagsText: event.target.value },
                              }))
                            }
                            placeholder="Tags: evidence, clarity"
                            className="rounded border border-[#cfd5de] bg-white px-2 py-1 text-xs"
                          />
                        </div>

                        <textarea
                          value={draft.note}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [result.id]: { ...draft, note: event.target.value },
                            }))
                          }
                          placeholder="Notes on what is happening and what to fix..."
                          className="mt-2 min-h-16 w-full rounded border border-[#cfd5de] bg-white px-2 py-1 text-xs"
                        />

                        <div className="mt-2 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => void saveCaseAnnotation(runDetail.run_id, result.id)}
                            disabled={savingCaseId === result.id}
                            className="rounded border border-[#1f2937] bg-[#1f2937] px-3 py-1.5 text-xs text-white hover:bg-[#111827] disabled:opacity-60"
                          >
                            {savingCaseId === result.id ? "Saving..." : "Save Annotation"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
