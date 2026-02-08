import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface Stage {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  duration: number;
}

const GENERATION_STAGES: Stage[] = [
  {
    id: "analyzing",
    title: "Understanding your role",
    subtitle: "Analyzing your goals, workflows, and deliverables...",
    icon: "🔍",
    duration: 2000,
  },
  {
    id: "designing",
    title: "Designing your workspace",
    subtitle: "Creating a personalized structure for your work...",
    icon: "✨",
    duration: 2500,
  },
  {
    id: "building",
    title: "Building your first project",
    subtitle: "Generating goals, messages, and document templates...",
    icon: "🏗️",
    duration: 2000,
  },
  {
    id: "reviewers",
    title: "Selecting AI reviewers",
    subtitle: "Choosing the best reviewers for your content...",
    icon: "🤖",
    duration: 1500,
  },
  {
    id: "finalizing",
    title: "Finalizing workspace",
    subtitle: "Almost there, putting the finishing touches...",
    icon: "🎨",
    duration: 1000,
  },
];

interface WorkspaceGenerationLoaderProps {
  onComplete: () => void;
}

export function WorkspaceGenerationLoader({ onComplete }: WorkspaceGenerationLoaderProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress bar animation
    const totalDuration = GENERATION_STAGES.reduce((sum, stage) => sum + stage.duration, 0);
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 50;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(newProgress);

      if (elapsed >= totalDuration) {
        clearInterval(interval);
        onComplete();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    // Stage transitions
    let elapsedTime = 0;
    let stageIndex = 0;

    const updateStage = () => {
      if (stageIndex < GENERATION_STAGES.length - 1) {
        elapsedTime += GENERATION_STAGES[stageIndex].duration;
        stageIndex++;
        setCurrentStageIndex(stageIndex);

        setTimeout(updateStage, GENERATION_STAGES[stageIndex].duration);
      }
    };

    const timer = setTimeout(updateStage, GENERATION_STAGES[0].duration);
    return () => clearTimeout(timer);
  }, []);

  const currentStage = GENERATION_STAGES[currentStageIndex];

  return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-12">
          <div className="h-1 bg-[#e8e6e1] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#8b7355] to-[#a0826d]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-[#9a9a94]">
            <span>0%</span>
            <span>{Math.round(progress)}%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Stage indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Icon */}
            <motion.div
              className="text-7xl mb-6"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {currentStage.icon}
            </motion.div>

            {/* Title */}
            <h2 className="text-3xl font-display font-semibold text-[#2d2d2a] mb-3">
              {currentStage.title}
            </h2>

            {/* Subtitle */}
            <p className="text-lg text-[#6b6b63]">
              {currentStage.subtitle}
            </p>

            {/* Loading dots */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-[#8b7355] rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Stage checkmarks */}
        <div className="mt-12 flex justify-center gap-4">
          {GENERATION_STAGES.map((stage, idx) => (
            <div key={stage.id} className="flex flex-col items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300
                  ${idx < currentStageIndex
                    ? "bg-[#7a8450] text-white"
                    : idx === currentStageIndex
                    ? "bg-[#8b7355] text-white scale-110"
                    : "bg-[#e8e6e1] text-[#9a9a94]"
                  }
                `}
              >
                {idx < currentStageIndex ? "✓" : idx + 1}
              </div>
              <span className="text-xs text-[#9a9a94] max-w-[80px] text-center leading-tight">
                {stage.title.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
