# Operations Rails Spec

## Purpose
Define the three governance rails that matter most for a manager-first, agentic product:

1. Escalation ladder
2. Decision log
3. Capacity limits

This keeps humans focused on goal-setting, review, feedback, and coordination, while agents handle execution.

## Non-Goals
- Full org design modeling (RACI, SLA, staffing)
- Workflow orchestration beyond project-level controls
- Compliance policy engine v1

## Rail 1: Escalation Ladder
### Objective
Ensure risky or uncertain situations are surfaced to a human with clear, minimal decision friction.

### Trigger Conditions
- Reviewer disagreement above threshold
- Source confidence below threshold
- High-risk external action detected
- Repeated execution failure (N retries exceeded)

### Levels
- `L0`: Auto-continue
- `L1`: Human one-click approval required
- `L2`: Hard pause; explicit human decision required

### UX Requirements
- Show `Why escalated` as plain language bullets.
- Show `Recommended action` and `Impact if ignored`.
- Persist escalation event to decision log.

## Rail 2: Decision Log
### Objective
Create a trustworthy audit trail for approvals, fallbacks, overrides, and major agent actions.

### Event Schema (v1)
```json
{
  "id": "evt_...",
  "timestamp": "ISO-8601",
  "project_id": "proj_...",
  "actor_type": "human|doer|reviewer|system",
  "actor_id": "string",
  "decision_type": "approve|reject|fallback|override|route_change|pause|resume",
  "reason": "string",
  "evidence_refs": ["file#line", "annotation_id"],
  "impact_summary": "string",
  "metadata": {}
}
```

### UX Requirements
- Timeline-first view with filters:
  - `Approvals`
  - `Fallbacks`
  - `Overrides`
  - `Escalations`
- One-click jump from decision log event to related editor line/highlight.

## Rail 3: Capacity Limits
### Objective
Prevent overrun, thrashing, and invisible cost/latency spikes.

### Limits (v1)
- Max concurrent doers per project
- Max reviewer runs per draft
- Daily token/cost budget per workspace

### Behavior
- If limit reached: queue task with ETA and reason.
- Allow human override with explicit log event.
- Surface limit state in right panel and hub cards.

## Default Policy (v1)
- `L0` for low-risk drafting tasks.
- `L1` for medium-risk tasks with weak evidence or reviewer conflict.
- `L2` for external publication/send/export or repeated failure.
- Queue when > 3 concurrent doers or reviewer reruns > 5 per draft.

## Acceptance Criteria
1. Every escalation creates a decision log event.
2. Every human override is logged with reason.
3. Capacity rejections show user-facing reason and next ETA.
4. Users can filter and inspect decision events without opening dev tools.
5. Rollback and fallback actions are visible in one timeline.

## Implementation Notes
- Keep these rails model-agnostic (works with Qwen/Kimi/GPT-OSS).
- Treat policy thresholds as config, not hardcoded constants.
- Start with project-scoped controls, then expand to workspace/org scope.
