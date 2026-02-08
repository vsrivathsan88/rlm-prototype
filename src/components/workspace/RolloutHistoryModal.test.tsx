import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RolloutHistoryModal } from "./RolloutHistoryModal";
import type { RolloutHistoryEvent } from "@/lib/store";

const events: RolloutHistoryEvent[] = [
  {
    mode: "active",
    from_mode: "shadow",
    updated_at: "2026-02-07T09:00:00Z",
    reason: "manual-active-reason",
    source: "manual",
  },
  {
    mode: "baseline",
    from_mode: "active",
    updated_at: "2026-02-07T10:00:00Z",
    reason: "manual-baseline-reason",
    source: "manual",
  },
  {
    mode: "shadow",
    from_mode: "active",
    updated_at: "2026-02-07T11:00:00Z",
    reason: "auto-fallback-reason",
    source: "auto_fallback",
    trigger: "candidate-outage",
  },
];

describe("RolloutHistoryModal", () => {
  it("supports keyboard close and dialog semantics", async () => {
    const onClose = vi.fn();
    render(
      <RolloutHistoryModal
        isOpen
        onClose={onClose}
        projectName="Acme"
        currentMode="shadow"
        events={events}
      />
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^close rollout history$/i })).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows recovery action only when fallback exists and mode is not active", () => {
    const onRecover = vi.fn();
    const { rerender } = render(
      <RolloutHistoryModal
        isOpen
        onClose={() => {}}
        currentMode="shadow"
        events={events}
        onRecoverToActive={onRecover}
      />
    );

    expect(screen.getByRole("button", { name: /recover to active/i })).toBeInTheDocument();

    rerender(
      <RolloutHistoryModal
        isOpen
        onClose={() => {}}
        currentMode="active"
        events={events}
        onRecoverToActive={onRecover}
      />
    );

    expect(screen.queryByRole("button", { name: /recover to active/i })).not.toBeInTheDocument();
  });

  it("filters events by source", () => {
    render(
      <RolloutHistoryModal
        isOpen
        onClose={() => {}}
        currentMode="shadow"
        events={events}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /filter source manual/i }));

    expect(screen.getByText(/manual-active-reason/i)).toBeInTheDocument();
    expect(screen.getByText(/manual-baseline-reason/i)).toBeInTheDocument();
    expect(screen.queryByText(/auto-fallback-reason/i)).not.toBeInTheDocument();
  });

  it("filters events by mode", () => {
    render(
      <RolloutHistoryModal
        isOpen
        onClose={() => {}}
        currentMode="shadow"
        events={events}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /filter mode baseline/i }));

    expect(screen.getByText(/manual-baseline-reason/i)).toBeInTheDocument();
    expect(screen.queryByText(/manual-active-reason/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto-fallback-reason/i)).not.toBeInTheDocument();
  });
});
