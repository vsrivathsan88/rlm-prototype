"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type WorkspaceDefinition } from "@/lib/store";
import { streamOnboardingWorkspace, type OnboardingWorkspaceEventName } from "@/lib/api";
import { RoleCard } from "@/components/onboarding/RoleCard";
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

  // Step state (1-3)
  const [step, setStep] = useState(1);

  // Step 1: Role selection
  const [jobFunction, setJobFunction] = useState<string>("");
  const [showMoreRoles, setShowMoreRoles] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");

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

  // Filter roles by search
  const filteredRoles = roleSearch
    ? jobFunctions.filter(f =>
        f.label.toLowerCase().includes(roleSearch.toLowerCase()) ||
        f.description.toLowerCase().includes(roleSearch.toLowerCase())
      )
    : jobFunctions;

  const displayedRoles = showMoreRoles ? filteredRoles : filteredRoles.slice(0, 6);
  const teamQuestionsAnswered = [teamSize, reportingLevel, industry, companyStage].filter(Boolean).length;
  const canShowReportingLevel = Boolean(teamSize);
  const canShowIndustry = Boolean(reportingLevel);
  const canShowCompanyStage = Boolean(industry);
  const canContinueFromTeamStep = Boolean(teamSize && reportingLevel && industry && companyStage);

  useEffect(() => {
    setCurrentAdaptiveQuestionIndex(0);
  }, [questionsUISchema]);

  // Step 1 → Step 2
  const handleRoleSubmit = () => {
    if (!jobFunction) return;
    setStep(2);
  };

  // Step 2 → Step 3 (generate adaptive questions)
  const handleContextSubmit = async () => {
    setLoadingQuestions(true);

    try {
      const response = await fetch("http://localhost:8000/v1/onboarding/adaptive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_function: jobFunction,
          team_size: teamSize,
          reporting_level: reportingLevel,
          industry: industry,
          company_stage: companyStage,
          company_info: companyInfo,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate questions");

      const data = await response.json();
      setQuestionsUISchema(data.ui_schema);

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
      alert("Failed to generate questions. Please try again.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Step 3 → Complete profile and go to project wizard
  const handleGoalsSubmit = async () => {
    if (generatingWorkspace) return;

    const profile = {
      job_function: jobFunction,
      team_size: teamSize,
      reporting_level: reportingLevel,
      industry: industry,
      company_stage: companyStage,
      current_work: answers,
    };

    setGeneratingWorkspace(true);
    setWorkspaceStatus("Generating your personalized workspace...");
    setWorkspaceEvents([]);
    setWorkspaceTokenCount(0);

    let generatedWorkspace: WorkspaceDefinition | null = null;
    try {
      const streamed = await streamOnboardingWorkspace(
        {
          job_function: jobFunction,
          answers,
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
      job_function: jobFunction,
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

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Role Selection */}
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
                  What&apos;s your job function?
                </h1>
                <p className="text-lg text-[#6b6b63]">
                  We&apos;ll personalize your workspace based on your role
                </p>
              </div>

              {/* Search bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  className="glass-input"
                />
              </div>

              {/* Role cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {displayedRoles.map((func) => (
                  <RoleCard
                    key={func.value}
                    roleId={func.value}
                    title={func.label}
                    description={func.description}
                    selected={jobFunction === func.value}
                    onClick={() => setJobFunction(func.value)}
                  />
                ))}
              </div>

              {/* See more button */}
              {!showMoreRoles && filteredRoles.length > 6 && (
                <button
                  onClick={() => setShowMoreRoles(true)}
                  className="w-full py-3 text-[#6b6b63] hover:text-[#8b7355] transition-colors"
                >
                  See {filteredRoles.length - 6} more roles
                </button>
              )}

              {/* Continue button */}
              <div className="flex justify-end mt-8">
                <button
                  onClick={handleRoleSubmit}
                  disabled={!jobFunction}
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
