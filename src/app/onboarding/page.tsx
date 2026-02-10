"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type WorkspaceDefinition } from "@/lib/store";
import { streamOnboardingWorkspace, type OnboardingWorkspaceEventName } from "@/lib/api";
import {
  MultiSelectField,
  ChipsField,
  SelectField,
  TextInputField,
  TextareaInputField,
  ListInputField,
} from "@/components/onboarding/QuestionFields";
import "@/styles/gradient-theme.css";

// Job Functions
const jobFunctions = [
  { value: "product_marketing_manager", label: "Product Marketing Manager", description: "Launch products, create positioning, enable sales teams" },
  { value: "content_marketing_manager", label: "Content Marketing Manager", description: "Create content strategy, thought leadership, SEO" },
  { value: "demand_gen_manager", label: "Demand Gen Manager", description: "Generate pipeline, run campaigns, drive qualified leads" },
  { value: "account_executive", label: "Account Executive", description: "Close deals, build relationships, hit revenue targets" },
  { value: "customer_success_manager", label: "Customer Success Manager", description: "Drive retention, expansion, customer satisfaction" },
  { value: "sales_enablement_manager", label: "Sales Enablement Manager", description: "Train sales teams, create content, improve win rates" },
  { value: "growth_marketing_manager", label: "Growth Marketing Manager", description: "Experiment-driven growth, optimize funnels, scale channels" },
  { value: "partner_marketing_manager", label: "Partner Marketing Manager", description: "Build partner programs, co-marketing, channel enablement" },
  { value: "field_marketing_manager", label: "Field Marketing Manager", description: "Regional events, local campaigns, field engagement" },
  { value: "brand_manager", label: "Brand Manager", description: "Build brand awareness, consistency, market positioning" },
  { value: "communications_manager", label: "Communications Manager", description: "PR, internal comms, crisis management, messaging" },
  { value: "solutions_engineer", label: "Solutions Engineer", description: "Technical demos, solution design, customer onboarding" },
];

// Team context options
const teamSizeOptions = [
  { value: "solo", label: "Just me (1)" },
  { value: "small", label: "Small team (2-5)" },
  { value: "medium", label: "Medium team (6-20)" },
  { value: "large", label: "Large team (21+)" },
];

const reportingLevelOptions = [
  { value: "ic", label: "Individual Contributor" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "vp_plus", label: "VP or above" },
];

const industryOptions = [
  { value: "saas", label: "SaaS" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "enterprise", label: "Enterprise" },
  { value: "fintech", label: "Fintech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "other", label: "Other" },
];

const companyStageOptions = [
  { value: "startup", label: "Startup (Pre-Seed to Series A)" },
  { value: "growth", label: "Growth (Series B to D)" },
  { value: "enterprise", label: "Enterprise (Series D+)" },
];

const titleQuickPicks = [
  { label: "Founder / CEO", value: "growth_marketing_manager" },
  { label: "Product Marketing Manager", value: "product_marketing_manager" },
  { label: "Demand Gen Manager", value: "demand_gen_manager" },
  { label: "Content Marketing Manager", value: "content_marketing_manager" },
  { label: "Account Executive", value: "account_executive" },
  { label: "Customer Success Manager", value: "customer_success_manager" },
];

const titleKeywordMappings: Array<{ value: string; keywords: string[] }> = [
  { value: "product_marketing_manager", keywords: ["product marketing", "pmm", "go to market", "go-to-market"] },
  { value: "content_marketing_manager", keywords: ["content marketing", "content lead", "editorial", "seo"] },
  { value: "demand_gen_manager", keywords: ["demand gen", "demand generation", "performance marketing", "pipeline"] },
  { value: "account_executive", keywords: ["account executive", "sales rep", "seller", "closing"] },
  { value: "customer_success_manager", keywords: ["customer success", "csm", "retention", "renewal"] },
  { value: "sales_enablement_manager", keywords: ["sales enablement", "enablement"] },
  { value: "growth_marketing_manager", keywords: ["growth", "founder", "ceo", "operator"] },
  { value: "partner_marketing_manager", keywords: ["partner marketing", "partnership"] },
  { value: "field_marketing_manager", keywords: ["field marketing", "events marketing"] },
  { value: "brand_manager", keywords: ["brand", "brand marketing"] },
  { value: "communications_manager", keywords: ["communications", "comms", "pr", "public relations"] },
  { value: "solutions_engineer", keywords: ["solutions engineer", "sales engineer", "solution consultant"] },
];

function inferJobFunctionFromTitle(title: string): string {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return "product_marketing_manager";

  for (const mapping of titleKeywordMappings) {
    if (mapping.keywords.some((keyword) => normalized.includes(keyword))) {
      return mapping.value;
    }
  }

  return "product_marketing_manager";
}

interface UIField {
  id: string;
  type: string;
  label: string;
  value?: unknown;
  editable?: boolean;
  placeholder?: string;
  help_text?: string;
  icon?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: Record<string, unknown>;
}

interface UISection {
  id: string;
  title: string;
  subtitle?: string;
  fields: UIField[];
}

interface UISchema {
  title: string;
  subtitle?: string;
  sections: UISection[];
  actions?: Array<{ id: string; label: string; type: string }>;
}

interface AdaptiveQuestion {
  sectionId: string;
  sectionTitle?: string;
  field: UIField;
}

function coerceWorkspaceDefinition(value: unknown): WorkspaceDefinition | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorkspaceDefinition>;
  if (!candidate.first_project || typeof candidate.first_project !== "object") return null;
  if (!Array.isArray(candidate.reviewers)) return null;
  if (!Array.isArray(candidate.quick_actions)) return null;
  if (!Array.isArray(candidate.okrs)) return null;
  return candidate as WorkspaceDefinition;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { setOnboarding, setUserProfile } = useAppStore();

  // Step state (0-3)
  const [step, setStep] = useState(0);

  // Step 1: Title capture
  const [jobTitle, setJobTitle] = useState<string>("");
  const [jobFunction, setJobFunction] = useState<string>("");

  // Step 2: Team context
  const [teamSize, setTeamSize] = useState("");
  const [reportingLevel, setReportingLevel] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyStage, setCompanyStage] = useState("");
  const companyInfo: Record<string, unknown> | null = null;

  // Step 3: Goals (adaptive questions)
  const [questionsUISchema, setQuestionsUISchema] = useState<UISchema | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [generatingWorkspace, setGeneratingWorkspace] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const [workspaceEvents, setWorkspaceEvents] = useState<string[]>([]);
  const [workspaceTokenCount, setWorkspaceTokenCount] = useState(0);
  const [currentAdaptiveQuestionIndex, setCurrentAdaptiveQuestionIndex] = useState(0);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const adaptiveQuestions = useMemo<AdaptiveQuestion[]>(
    () =>
      (questionsUISchema?.sections || []).flatMap((section) =>
        section.fields.map((field) => ({
          sectionId: section.id,
          sectionTitle: section.title,
          field,
        }))
      ),
    [questionsUISchema]
  );
  const activeAdaptiveQuestion = adaptiveQuestions[currentAdaptiveQuestionIndex] || null;
  const totalAdaptiveQuestions = adaptiveQuestions.length;
  const isLastAdaptiveQuestion =
    totalAdaptiveQuestions > 0 && currentAdaptiveQuestionIndex === totalAdaptiveQuestions - 1;
  const inferredJobLabel = useMemo(() => {
    const inferred = jobTitle.trim() ? inferJobFunctionFromTitle(jobTitle) : jobFunction;
    return jobFunctions.find((func) => func.value === inferred)?.label ?? "GTM Operator";
  }, [jobFunction, jobTitle]);
  const teamQuestionsAnswered = [teamSize, reportingLevel, industry, companyStage].filter(Boolean).length;
  const canShowReportingLevel = Boolean(teamSize);
  const canShowIndustry = Boolean(reportingLevel);
  const canShowCompanyStage = Boolean(industry);
  const canContinueFromTeamStep = Boolean(teamSize && reportingLevel && industry && companyStage);

  useEffect(() => {
    setCurrentAdaptiveQuestionIndex(0);
  }, [questionsUISchema]);

  // Step 1 → Step 2
  const handleTitleSubmit = () => {
    const normalizedTitle = jobTitle.trim();
    if (!normalizedTitle) {
      setTitleError("Please enter your title to continue.");
      return;
    }
    setTitleError(null);
    setJobFunction("");
    setStep(2);
  };

  // Step 2 → Step 3 (generate adaptive questions)
  const handleContextSubmit = async () => {
    if (!jobTitle.trim() && !jobFunction) {
      setContextError("Missing role context. Please go back and enter your title.");
      return;
    }
    if (!reportingLevel) {
      setContextError("Please choose your reporting level.");
      return;
    }
    setContextError(null);

    setLoadingQuestions(true);

    try {
      const response = await fetch("http://localhost:8000/v1/onboarding/adaptive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_function: jobFunction || undefined,
          job_title: jobTitle.trim(),
          team_size: teamSize,
          reporting_level: reportingLevel,
          industry: industry,
          company_stage: companyStage,
          company_info: companyInfo,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: "Failed to generate questions" }));
        throw new Error(typeof payload.detail === "string" ? payload.detail : "Failed to generate questions");
      }

      const data = await response.json();
      setQuestionsUISchema(data.ui_schema);
      if (data?.questions_context?.job_function && typeof data.questions_context.job_function === "string") {
        setJobFunction(data.questions_context.job_function);
      }

      // Initialize answers
      const initialAnswers: Record<string, unknown> = {};
      data.ui_schema.sections.forEach((section: UISection) => {
        section.fields.forEach((field: UIField) => {
          if (field.value !== undefined) {
            initialAnswers[field.id] = field.value;
          } else if (field.type === "multiselect" || field.type === "chips" || field.type === "list") {
            initialAnswers[field.id] = [];
          } else {
            initialAnswers[field.id] = "";
          }
        });
      });
      setAnswers(initialAnswers);

      setStep(3);
    } catch (error) {
      console.error("Error generating questions:", error);
      const message = error instanceof Error ? error.message : "Failed to generate questions. Please try again.";
      setContextError(message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Step 3 → Complete profile and go to project wizard
  const handleGoalsSubmit = async () => {
    if (generatingWorkspace) return;
    const resolvedJobFunction = jobFunction || inferJobFunctionFromTitle(jobTitle);
    if (!resolvedJobFunction) {
      setContextError("Could not resolve your role. Please go back and confirm title + reporting level.");
      return;
    }

    const profile = {
      job_function: resolvedJobFunction,
      team_size: teamSize,
      reporting_level: reportingLevel,
      industry: industry,
      company_stage: companyStage,
      current_work: {
        ...answers,
        job_title: jobTitle.trim(),
      },
    };

    setGeneratingWorkspace(true);
    setWorkspaceStatus("Generating your personalized workspace...");
    setWorkspaceEvents([]);
    setWorkspaceTokenCount(0);

    let generatedWorkspace: WorkspaceDefinition | null = null;
    try {
      const streamed = await streamOnboardingWorkspace(
        {
          job_function: resolvedJobFunction,
          job_title: jobTitle.trim(),
          answers,
          team_size: teamSize,
          reporting_level: reportingLevel,
          industry,
          company_stage: companyStage,
        },
        (event: OnboardingWorkspaceEventName, data: unknown) => {
          if (event === "status" && data && typeof data === "object") {
            const message =
              "message" in data && typeof (data as { message?: unknown }).message === "string"
                ? (data as { message: string }).message
                : null;
            if (message) setWorkspaceStatus(message);
            return;
          }
          if (event === "llm_token" && data && typeof data === "object") {
            const delta =
              "delta" in data && typeof (data as { delta?: unknown }).delta === "string"
                ? (data as { delta: string }).delta
                : "";
            if (delta) setWorkspaceTokenCount((prev) => prev + delta.length);
            return;
          }
          if (event === "project_name" && data && typeof data === "object") {
            const name =
              "name" in data && typeof (data as { name?: unknown }).name === "string"
                ? (data as { name: string }).name
                : null;
            if (name) {
              setWorkspaceStatus(`Building project: ${name}`);
              setWorkspaceEvents((prev) => [...prev, `Project: ${name}`].slice(-6));
            }
            return;
          }
          if (event === "project_details") {
            setWorkspaceEvents((prev) => [...prev, "Project details ready"].slice(-6));
            return;
          }
          if (event === "document" && data && typeof data === "object") {
            const title =
              "title" in data && typeof (data as { title?: unknown }).title === "string"
                ? (data as { title: string }).title
                : "Starter document";
            setWorkspaceEvents((prev) => [...prev, `Document: ${title}`].slice(-6));
            return;
          }
          if (event === "reviewer" && data && typeof data === "object") {
            const reviewerName =
              "name" in data && typeof (data as { name?: unknown }).name === "string"
                ? (data as { name: string }).name
                : "Reviewer";
            setWorkspaceEvents((prev) => [...prev, `Reviewer: ${reviewerName}`].slice(-6));
            return;
          }
          if (event === "quick_action" && data && typeof data === "object") {
            const actionLabel =
              "label" in data && typeof (data as { label?: unknown }).label === "string"
                ? (data as { label: string }).label
                : "Quick action";
            setWorkspaceEvents((prev) => [...prev, `Action: ${actionLabel}`].slice(-6));
            return;
          }
          if (event === "complete") {
            setWorkspaceStatus("Workspace ready. Moving to project setup...");
          }
        }
      );
      generatedWorkspace = coerceWorkspaceDefinition(streamed.workspace);
    } catch (error) {
      console.error("Workspace streaming failed:", error);
      setWorkspaceStatus("Could not stream workspace. Continuing with profile defaults...");
    }

    setOnboarding({
      job_function: resolvedJobFunction,
      workspace: generatedWorkspace,
      completed: true,
    });
    setUserProfile(profile);
    localStorage.setItem("user_profile", JSON.stringify(profile));
    router.push("/projects/new?first=true");
  };

  const isFieldRequired = (field: UIField): boolean => {
    if (!field.validation || typeof field.validation !== "object") return false;
    const required = (field.validation as { required?: unknown }).required;
    return required === true;
  };

  const isFieldAnswered = (field: UIField): boolean => {
    const value = answers[field.id];
    if (field.type === "multiselect" || field.type === "chips" || field.type === "list") {
      return Array.isArray(value) && value.length > 0;
    }
    if (field.type === "text" || field.type === "textarea" || field.type === "select") {
      return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
    }
    return Boolean(value);
  };

  const canAdvanceAdaptiveQuestion =
    !activeAdaptiveQuestion ||
    !isFieldRequired(activeAdaptiveQuestion.field) ||
    isFieldAnswered(activeAdaptiveQuestion.field);

  const handlePreviousAdaptiveQuestion = () => {
    setCurrentAdaptiveQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextAdaptiveQuestion = () => {
    setCurrentAdaptiveQuestionIndex((prev) =>
      Math.min(totalAdaptiveQuestions - 1, prev + 1)
    );
  };

  // Render field based on type
  const renderQuestionField = (field: UIField) => {
    const value = answers[field.id];
    const onChange = (newValue: unknown) => {
      setAnswers({ ...answers, [field.id]: newValue });
    };

    switch (field.type) {
      case "multiselect":
        return (
          <MultiSelectField
            key={field.id}
            label={field.label}
            icon={field.icon}
            helpText={field.help_text}
            options={field.options || []}
            value={value}
            onChange={onChange}
          />
        );
      case "chips":
        return (
          <ChipsField
            key={field.id}
            label={field.label}
            icon={field.icon}
            helpText={field.help_text}
            options={field.options || []}
            value={value}
            onChange={onChange}
          />
        );
      case "select":
        return (
          <SelectField
            key={field.id}
            label={field.label}
            icon={field.icon}
            helpText={field.help_text}
            options={field.options || []}
            value={value}
            onChange={onChange}
          />
        );
      case "text":
        return (
          <TextInputField
            key={field.id}
            label={field.label}
            icon={field.icon}
            helpText={field.help_text}
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
          />
        );
      case "textarea":
        return (
          <TextareaInputField
            key={field.id}
            label={field.label}
            icon={field.icon}
            helpText={field.help_text}
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
          />
        );
      case "list":
        return (
          <ListInputField
            key={field.id}
            label={field.label}
            icon={field.icon}
            helpText={field.help_text}
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
            maxItems={
              typeof field.validation?.max_items === "number"
                ? field.validation.max_items
                : 10
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fafaf8] to-[#f5f3f0]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header with product name */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-display font-semibold text-[#2d2d2a] mb-2 tracking-tight">
            Project Lens
          </h1>
          <p className="text-[#6b6b63]">Intelligent workspace for GTM teams</p>
        </div>

        {/* Progress indicator */}
        {step > 0 && (
          <div className="flex items-center justify-center gap-3 mb-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-300
                    ${step >= i
                      ? "bg-[#8b7355] text-white shadow-[0_2px_8px_rgba(139,115,85,0.2)]"
                      : "bg-white border border-[#e8e6e1] text-[#9a9a94]"
                    }
                  `}
                >
                  {i}
                </div>
                {i < 3 && (
                  <div
                    className={`
                      w-20 h-0.5 transition-all duration-300
                      ${step > i ? "bg-[#8b7355]" : "bg-[#e8e6e1]"}
                    `}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mx-auto max-w-3xl rounded-2xl border border-[#e8e6e1] bg-white/80 p-10 shadow-[0_14px_36px_rgba(45,45,42,0.08)]">
                <h1 className="text-center text-4xl font-semibold text-[#2d2d2a] tracking-tight">
                  Build your first agentic workspace in 2 minutes
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-[#6b6b63]">
                  We personalize your first project, doers, and reviewers so you can start with useful output instead
                  of a blank page.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-3 text-sm text-[#47473f] md:grid-cols-3">
                  <div className="rounded-xl border border-[#e8e6e1] bg-[#fafaf8] p-4">
                    Personalized crew and prompts
                  </div>
                  <div className="rounded-xl border border-[#e8e6e1] bg-[#fafaf8] p-4">
                    Starter project and document scaffold
                  </div>
                  <div className="rounded-xl border border-[#e8e6e1] bg-[#fafaf8] p-4">
                    You can edit everything afterward
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <span className="text-sm text-[#9a9a94]">Takes about 2 minutes</span>
                  <button
                    onClick={() => setStep(1)}
                    className="gradient-button"
                  >
                    Start Setup
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 1: Title Capture */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <h1 className="text-4xl font-semibold text-[#2d2d2a] mb-3 tracking-tight">
                  What&apos;s your title?
                </h1>
                <p className="text-lg text-[#6b6b63]">
                  Enter it naturally. We&apos;ll map it behind the scenes.
                </p>
              </div>

              <div className="mx-auto max-w-3xl">
                <input
                  type="text"
                  data-testid="title-input"
                  placeholder="e.g. Founder, Product Marketing Manager, Sales Lead"
                  value={jobTitle}
                  onChange={(e) => {
                    const value = e.target.value;
                    setJobTitle(value);
                    setTitleError(null);
                  }}
                  className="glass-input"
                />
                {titleError && (
                  <p className="mt-2 text-sm text-[#b9382d]">{titleError}</p>
                )}
                <p className="mt-3 text-sm text-[#8a867f]">
                  We&apos;ll tailor your setup as: <span className="font-medium text-[#5f533f]">{inferredJobLabel}</span>
                </p>
                <div className="mt-6">
                  <p className="mb-3 text-sm text-[#6b6b63]">Quick picks</p>
                  <div className="flex flex-wrap gap-2">
                    {titleQuickPicks.map((pick) => (
                      <button
                        key={pick.label}
                        type="button"
                        data-testid={`title-quick-pick-${pick.value}`}
                        onClick={() => {
                          setJobTitle(pick.label);
                          setJobFunction("");
                          setTitleError(null);
                        }}
                        className={`rounded-full border px-4 py-2 text-sm transition-all ${
                          inferJobFunctionFromTitle(jobTitle) === pick.value
                            ? "border-[#8b7355] bg-[#f3ece2] text-[#5f533f]"
                            : "border-[#ddd9d2] bg-white text-[#57574f] hover:border-[#c9c2b7]"
                        }`}
                      >
                        {pick.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Continue button */}
              <div className="flex justify-end mt-8">
                <button
                  onClick={handleTitleSubmit}
                  disabled={!jobTitle.trim()}
                  className="gradient-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Team Context */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-12">
                <h1 className="text-4xl font-semibold text-[#2d2d2a] mb-3 tracking-tight">
                  Tell us about your team
                </h1>
                <p className="text-lg text-[#6b6b63]">
                  Help us personalize your experience
                </p>
                <p className="text-sm text-[#9a9a94] mt-3">
                  Question {Math.min(teamQuestionsAnswered + 1, 4)} of 4
                </p>
              </div>

              <div className="space-y-8 max-w-3xl mx-auto">
                {/* Team Size */}
                <div className="glass-card p-6 border border-[#e8e6e1]">
                  <label className="block text-lg font-medium text-[#2d2d2a] mb-4">
                    Team Size
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                        {teamSizeOptions.map((option) => (
                          <button
                            key={option.value}
                            data-testid={`team-size-${option.value}`}
                            onClick={() => {
                              setTeamSize(option.value);
                              setReportingLevel("");
                              setIndustry("");
                              setCompanyStage("");
                            }}
                            className={`
                              p-4 rounded-lg transition-all text-left
                              ${teamSize === option.value
                            ? "bg-[#8b7355] text-white border-2 border-[#8b7355] shadow-[0_2px_8px_rgba(139,115,85,0.2)]"
                            : "bg-[#fafaf8] border border-[#e8e6e1] hover:border-[#d4d2cc] text-[#2d2d2a]"
                          }
                        `}
                      >
                        <span className="font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reporting Level */}
                <AnimatePresence>
                  {canShowReportingLevel && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="glass-card p-6 border border-[#e8e6e1]"
                    >
                      <label className="block text-lg font-medium text-[#2d2d2a] mb-4">
                        Your Role
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {reportingLevelOptions.map((option) => (
                          <button
                            key={option.value}
                            data-testid={`reporting-level-${option.value}`}
                            onClick={() => {
                              setReportingLevel(option.value);
                              setIndustry("");
                              setCompanyStage("");
                            }}
                            className={`
                              p-4 rounded-lg transition-all text-left
                              ${reportingLevel === option.value
                                ? "bg-[#8b7355] text-white border-2 border-[#8b7355] shadow-[0_2px_8px_rgba(139,115,85,0.2)]"
                                : "bg-[#fafaf8] border border-[#e8e6e1] hover:border-[#d4d2cc] text-[#2d2d2a]"
                              }
                            `}
                          >
                            <span className="font-medium">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Industry */}
                <AnimatePresence>
                  {canShowIndustry && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="glass-card p-6 border border-[#e8e6e1]"
                    >
                      <label className="block text-lg font-medium text-[#2d2d2a] mb-4">
                        Industry
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {industryOptions.map((option) => (
                          <button
                            key={option.value}
                            data-testid={`industry-${option.value}`}
                            onClick={() => {
                              setIndustry(option.value);
                              setCompanyStage("");
                            }}
                            className={`
                              p-4 rounded-lg transition-all text-left
                              ${industry === option.value
                                ? "bg-[#8b7355] text-white border-2 border-[#8b7355] shadow-[0_2px_8px_rgba(139,115,85,0.2)]"
                                : "bg-[#fafaf8] border border-[#e8e6e1] hover:border-[#d4d2cc] text-[#2d2d2a]"
                              }
                            `}
                          >
                            <span className="font-medium">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Company Stage */}
                <AnimatePresence>
                  {canShowCompanyStage && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="glass-card p-6 border border-[#e8e6e1]"
                    >
                      <label className="block text-lg font-medium text-[#2d2d2a] mb-4">
                        Company Stage
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        {companyStageOptions.map((option) => (
                          <button
                            key={option.value}
                            data-testid={`company-stage-${option.value}`}
                            onClick={() => setCompanyStage(option.value)}
                            className={`
                              p-4 rounded-lg transition-all text-left
                              ${companyStage === option.value
                                ? "bg-[#8b7355] text-white border-2 border-[#8b7355] shadow-[0_2px_8px_rgba(139,115,85,0.2)]"
                                : "bg-[#fafaf8] border border-[#e8e6e1] hover:border-[#d4d2cc] text-[#2d2d2a]"
                              }
                            `}
                          >
                            <span className="font-medium">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation */}
              {contextError && (
                <p className="mt-4 text-sm text-[#b9382d]">{contextError}</p>
              )}
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 text-[#6b6b63] hover:text-[#8b7355] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContextSubmit}
                  disabled={!canContinueFromTeamStep || loadingQuestions}
                  className="gradient-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingQuestions ? "Generating Questions..." : "Continue"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Current Goals (Adaptive Questions) */}
          {step === 3 && questionsUISchema && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <h1 className="text-4xl font-semibold text-[#2d2d2a] mb-3 tracking-tight">
                  {questionsUISchema.title}
                </h1>
                {questionsUISchema.subtitle && (
                  <p className="text-lg text-[#6b6b63]">
                    {questionsUISchema.subtitle}
                  </p>
                )}
                {totalAdaptiveQuestions > 0 && (
                  <p className="mt-3 text-sm text-[#9a9a94]">
                    Question {currentAdaptiveQuestionIndex + 1} of {totalAdaptiveQuestions}
                  </p>
                )}
              </div>

              <div className="glass-card p-8 space-y-6">
                {totalAdaptiveQuestions > 0 && (
                  <div className="h-1 overflow-hidden rounded-full bg-[#ece9e4]">
                    <div
                      className="h-full bg-[#8b7355] transition-all duration-200 ease-out"
                      style={{
                        width: `${((currentAdaptiveQuestionIndex + 1) / totalAdaptiveQuestions) * 100}%`,
                      }}
                    />
                  </div>
                )}
                <AnimatePresence mode="wait">
                  {activeAdaptiveQuestion ? (
                    <motion.div
                      key={activeAdaptiveQuestion.field.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {activeAdaptiveQuestion.sectionTitle && (
                        <h3 className="mb-2 text-xl font-medium text-[#2d2d2a]">
                          {activeAdaptiveQuestion.sectionTitle}
                        </h3>
                      )}
                      {renderQuestionField(activeAdaptiveQuestion.field)}
                    </motion.div>
                  ) : (
                    <p className="text-sm text-[#6b6b63]">No adaptive questions returned.</p>
                  )}
                </AnimatePresence>
              </div>

              {generatingWorkspace && (
                <div className="mt-5 rounded-xl border border-[#e8e6e1] bg-[#fafaf8] px-5 py-4">
                  <p className="text-sm font-medium text-[#2d2d2a]">{workspaceStatus}</p>
                  {workspaceTokenCount > 0 && (
                    <p className="mt-1 text-xs text-[#8b7355]">
                      Streaming live generation: {workspaceTokenCount.toLocaleString()} chars processed
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    {workspaceEvents.map((event, index) => (
                      <p key={`${event}-${index}`} className="text-xs text-[#6b6b63]">
                        {event}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => {
                    if (currentAdaptiveQuestionIndex === 0) {
                      setStep(2);
                      return;
                    }
                    handlePreviousAdaptiveQuestion();
                  }}
                  disabled={generatingWorkspace}
                  className="px-6 py-3 text-[#6b6b63] hover:text-[#8b7355] transition-colors"
                >
                  {currentAdaptiveQuestionIndex === 0 ? "Back" : "Previous"}
                </button>
                <button
                  onClick={isLastAdaptiveQuestion ? handleGoalsSubmit : handleNextAdaptiveQuestion}
                  disabled={generatingWorkspace || !canAdvanceAdaptiveQuestion}
                  className="gradient-button"
                >
                  {generatingWorkspace
                    ? "Generating Workspace..."
                    : isLastAdaptiveQuestion
                      ? "Continue to Project Setup →"
                      : "Next Question"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
