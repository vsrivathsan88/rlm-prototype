"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteUserApiKey,
  listAdminModels,
  listUserApiKeys,
  testUserApiKey,
  updateAdminModel,
  upsertUserApiKey,
  type AdminModelRegistryEntry,
  type UserApiKeyMeta,
} from "@/lib/api";

const PROVIDERS = ["groq", "openai", "anthropic"] as const;

export default function AdminControlPage() {
  const [adminKey, setAdminKey] = useState("");
  const [userId, setUserId] = useState("");
  const [models, setModels] = useState<AdminModelRegistryEntry[]>([]);
  const [keys, setKeys] = useState<UserApiKeyMeta[]>([]);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("groq");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedAdminKey = window.localStorage.getItem("admin_control_key");
    const storedUser = window.localStorage.getItem("admin_control_user");
    if (storedAdminKey) setAdminKey(storedAdminKey);
    if (storedUser) setUserId(storedUser);
  }, []);

  const loadAll = async () => {
    if (!userId.trim()) {
      setError("Enter a user id before loading key settings.");
      setMessage("");
      return;
    }
    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      const [modelData, keyData] = await Promise.all([
        listAdminModels(adminKey || undefined),
        listUserApiKeys(userId || undefined),
      ]);
      setModels(modelData.models || []);
      setKeys(keyData.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin control data");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModel = async (model: AdminModelRegistryEntry) => {
    setError("");
    setMessage("");
    try {
      const res = await updateAdminModel(
        {
          provider: model.provider,
          model: model.model,
          enabled: !model.enabled,
          name: model.name,
          tags: model.tags || [],
        },
        adminKey || undefined
      );
      setModels((prev) =>
        prev.map((item) =>
          item.provider === res.model.provider && item.model === res.model.model ? res.model : item
        )
      );
      setMessage(`${res.model.model} is now ${res.model.enabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update model");
    }
  };

  const saveKey = async () => {
    if (!userId.trim()) {
      setError("Enter a user id before saving keys.");
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    setIsSaving(true);
    try {
      await upsertUserApiKey(
        {
          provider,
          api_key: apiKey,
          label: label || undefined,
          base_url: baseUrl || undefined,
        },
        userId || undefined
      );
      setApiKey("");
      setLabel("");
      setBaseUrl("");
      const keyData = await listUserApiKeys(userId || undefined);
      setKeys(keyData.keys || []);
      setMessage(`Saved ${provider} key for ${userId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setIsSaving(false);
    }
  };

  const runTest = async (targetProvider: string) => {
    if (!userId.trim()) {
      setError("Enter a user id before testing keys.");
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    setTestingProvider(targetProvider);
    try {
      const result = await testUserApiKey(
        { provider: targetProvider },
        userId || undefined
      );
      if (result.ok) {
        setMessage(`${targetProvider} key is valid (${result.status_code}).`);
      } else {
        setError(`${targetProvider} key test failed (${result.status_code}): ${result.detail || "unknown error"}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed testing ${targetProvider}`);
    } finally {
      setTestingProvider("");
    }
  };

  const removeKey = async (targetProvider: string) => {
    if (!userId.trim()) {
      setError("Enter a user id before deleting keys.");
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    try {
      await deleteUserApiKey(targetProvider, userId || undefined);
      const keyData = await listUserApiKeys(userId || undefined);
      setKeys(keyData.keys || []);
      setMessage(`Deleted ${targetProvider} key for ${userId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete key");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#111827]">
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="mb-4 rounded-xl border border-[#d9dde5] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold">Admin Control</h1>
              <p className="text-sm text-[#4b5563]">
                Enable models and manage encrypted user API keys.
              </p>
            </div>
            <Link href="/admin/evals" className="text-sm text-[#2563eb] hover:underline">
              Open Eval Review
            </Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Admin key (for model toggles)"
              className="rounded border border-[#cfd5de] bg-white px-3 py-2 text-sm"
            />
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="User id (x-user-id)"
              className="rounded border border-[#cfd5de] bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("admin_control_key", adminKey);
                  window.localStorage.setItem("admin_control_user", userId);
                }
                void loadAll();
              }}
              className="rounded border border-[#1f2937] bg-[#1f2937] px-3 py-2 text-sm text-white hover:bg-[#111827]"
            >
              {isLoading ? "Loading..." : "Load Settings"}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-[#b91c1c]">{error}</p> : null}
          {message ? <p className="mt-2 text-sm text-[#0f766e]">{message}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-[#d9dde5] bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Model Registry</h2>
            <div className="space-y-2">
              {models.length === 0 ? (
                <p className="text-xs text-[#6b7280]">No models loaded.</p>
              ) : (
                models.map((model) => (
                  <div
                    key={`${model.provider}:${model.model}`}
                    className="flex items-center justify-between rounded border border-[#d9dde5] px-2 py-1.5"
                  >
                    <div>
                      <div className="text-xs font-semibold">{model.name}</div>
                      <div className="text-[11px] text-[#6b7280]">
                        {model.provider} · {model.model}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleModel(model)}
                      className={`rounded px-2 py-1 text-xs ${
                        model.enabled
                          ? "bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]"
                          : "bg-[#fee2e2] text-[#991b1b] hover:bg-[#fecaca]"
                      }`}
                    >
                      {model.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[#d9dde5] bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">User API Keys</h2>
            <div className="grid gap-2">
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as (typeof PROVIDERS)[number])}
                className="rounded border border-[#cfd5de] bg-white px-2 py-1.5 text-xs"
              >
                {PROVIDERS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="API key"
                type="password"
                className="rounded border border-[#cfd5de] bg-white px-2 py-1.5 text-xs"
              />
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Label (optional)"
                className="rounded border border-[#cfd5de] bg-white px-2 py-1.5 text-xs"
              />
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="Base URL override (optional)"
                className="rounded border border-[#cfd5de] bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => void saveKey()}
                disabled={isSaving || !apiKey.trim()}
                className="rounded border border-[#1f2937] bg-[#1f2937] px-3 py-1.5 text-xs text-white hover:bg-[#111827] disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Key"}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {keys.length === 0 ? (
                <p className="text-xs text-[#6b7280]">No keys saved for this user.</p>
              ) : (
                keys.map((key) => (
                  <div key={key.provider} className="rounded border border-[#d9dde5] px-2 py-1.5">
                    <div className="text-xs font-semibold">{key.provider}</div>
                    <div className="text-[11px] text-[#6b7280]">
                      {key.label || "No label"} · ****{key.last4 || "----"}
                    </div>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void runTest(key.provider)}
                        className="rounded border border-[#cfd5de] px-2 py-1 text-[11px] text-[#374151] hover:bg-[#f3f4f6]"
                      >
                        {testingProvider === key.provider ? "Testing..." : "Test"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeKey(key.provider)}
                        className="rounded border border-[#fecaca] px-2 py-1 text-[11px] text-[#991b1b] hover:bg-[#fee2e2]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
