import { Project } from "./store";

/**
 * Generate personalized prompt suggestions based on project goal, documents, and context.
 *
 * ALWAYS prioritizes:
 * 1. Project goal (what the user is trying to achieve)
 * 2. Uploaded documents (what evidence/sources they have)
 * 3. Target audience (who they're writing for)
 * 4. Project type/name (secondary context)
 */
export function getPersonalizedSuggestions(project?: Project): string[] {
  if (!project) {
    return [
      "Summarize the top 3 risks with sources",
      "Rewrite this section for clarity",
      "Find evidence for the pipeline claim",
      "Draft an executive summary",
    ];
  }

  const goal = project.goal || "";
  const audience = project.target_audience || "";
  const projectName = project.name || "";
  const hasFiles = project.files && project.files.length > 0;
  const fileCount = project.files?.length || 0;

  // Build context-aware suggestions
  const suggestions: string[] = [];

  // SUGGESTION 1: Always related to the project goal
  if (goal) {
    suggestions.push(
      `Create a detailed action plan to achieve: "${goal}" with timeline, key milestones, and resource requirements`
    );
  } else {
    suggestions.push(
      `Draft a strategic brief for ${projectName} outlining objectives, key initiatives, and success metrics`
    );
  }

  // SUGGESTION 2: Document-aware analysis (if files uploaded)
  if (hasFiles) {
    suggestions.push(
      `Analyze the ${fileCount} uploaded ${fileCount === 1 ? 'file' : 'files'} and identify gaps, inconsistencies, or missing information relevant to ${goal || projectName}`
    );
  } else {
    suggestions.push(
      `List the key documents and data sources needed to support this project and where to find them`
    );
  }

  // SUGGESTION 3: Audience-specific content
  if (audience) {
    suggestions.push(
      `Write a compelling narrative for ${audience} explaining why ${goal || projectName} matters and what's in it for them`
    );
  } else {
    suggestions.push(
      `Identify the key stakeholders who need to approve or support this project and tailor messaging for each`
    );
  }

  // SUGGESTION 4: Risk & validation (using uploaded files as evidence)
  if (hasFiles && goal) {
    suggestions.push(
      `Cross-check claims in the draft against uploaded source files and flag any statements that need citations or data backing`
    );
  } else if (goal) {
    suggestions.push(
      `Identify the top 3 risks to achieving "${goal}" and recommend specific mitigation strategies with owners`
    );
  } else {
    suggestions.push(
      `Generate a SWOT analysis for this project with specific examples and evidence from available materials`
    );
  }

  return suggestions;
}

/**
 * Get quick action suggestions based on project stage and context.
 * These are shorter, more tactical prompts for common tasks.
 */
export function getQuickActions(project?: Project): string[] {
  if (!project) {
    return [
      "Summarize key points",
      "Check for evidence gaps",
      "Draft executive summary",
      "Identify next steps",
    ];
  }

  const hasFiles = project.files && project.files.length > 0;
  const goal = project.goal || "";

  const actions: string[] = [];

  // Action 1: Always goal-related
  if (goal) {
    actions.push(`What are the biggest obstacles to: ${goal}?`);
  } else {
    actions.push("What are the key risks for this project?");
  }

  // Action 2: Evidence-based
  if (hasFiles) {
    actions.push("Which claims need stronger evidence from source files?");
  } else {
    actions.push("What data or sources would strengthen this case?");
  }

  // Action 3: Audience impact
  if (project.target_audience) {
    actions.push(`How will ${project.target_audience} react to this?`);
  } else {
    actions.push("Who needs to see this and why?");
  }

  // Action 4: Next steps
  actions.push("What are the immediate next steps and owners?");

  return actions;
}
