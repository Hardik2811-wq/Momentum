import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Brain,
  Zap,
  Flame,
  Target,
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

const REEL_SLIDES = [
  {
    id: 's1',
    eyebrow: 'Circadian & Somatic Armor',
    title: 'Biological Rhythm Synchronized',
    description: 'Autonomous engine audited your physical exertion and inserted strategic 45m nervous system recovery buffers before creative focus sessions.',
    metric: '100%',
    metricLabel: 'Burnout Shield Integrity',
    icon: Brain,
    gradient: 'from-violet-600/30 via-indigo-600/20 to-zinc-950',
    borderColor: 'border-violet-500/30',
    accentColor: 'text-violet-400'
  },
  {
    id: 's2',
    eyebrow: 'Streak Defense Protocol',
    title: 'Zero Hard-Earned Habits Lost',
    description: 'When evening energy drained, AI auto-scaled high-friction habits into effortless 5-minute minimum viable recovery sessions to preserve momentum.',
    metric: '14 Days',
    metricLabel: 'Longest Active Streak Protected',
    icon: Flame,
    gradient: 'from-orange-600/30 via-amber-600/20 to-zinc-950',
    borderColor: 'border-orange-500/30',
    accentColor: 'text-orange-400'
  },
  {
    id: 's3',
    eyebrow: 'Deep Execution Output',
    title: 'Uncompromised Peak Flow',
    description: 'Unblocked cascade prerequisites immediately upon completion, keeping your goal critical path moving forward with zero administrative hesitation.',
    metric: '3.5 Hrs',
    metricLabel: 'Prime Cognitive Flow Preserved',
    icon: Target,
    gradient: 'from-emerald-600/30 via-teal-600/20 to-zinc-950',
    borderColor: 'border-emerald-500/30',
    accentColor: 'text-emerald-400'
  }
];

export default function AgentStoryReel() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % REEL_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const slide = REEL_SLIDES[currentSlideIndex];
  const Icon = slide.icon;

  const handleNext = () => {
    setCurrentSlideIndex(prev => (prev + 1) % REEL_SLIDES.length);
  };

  const handlePrev = () => {
    setCurrentSlideIndex(prev => (prev - 1 + REEL_SLIDES.length) % REEL_SLIDES.length);
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl flex flex-col justify-between min-h-[300px]"
    >
      {/* Dynamic Background Mesh Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} transition-all duration-700 pointer-events-none`} />

      {/* Story Progress Indicators at Top */}
      <div className="relative z-10 flex items-center gap-2 mb-6">
        {REEL_SLIDES.map((s, idx) => (
          <div
            key={s.id}
            onClick={() => setCurrentSlideIndex(idx)}
            className="flex-1 h-1 bg-zinc-800/80 rounded-full overflow-hidden cursor-pointer"
          >
            <motion.div
              className={`h-full ${idx === currentSlideIndex ? 'bg-white' : idx < currentSlideIndex ? 'bg-zinc-400' : 'bg-transparent'}`}
              initial={false}
              animate={{ width: idx === currentSlideIndex ? '100%' : idx < currentSlideIndex ? '100%' : '0%' }}
              transition={{ duration: idx === currentSlideIndex && !isPaused ? 5 : 0.2, ease: 'linear' }}
            />
          </div>
        ))}
      </div>

      {/* Kinetic Animated Slide Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-mono uppercase tracking-widest font-bold ${slide.accentColor}`}>
                {slide.eyebrow}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[11px] text-zinc-400 font-mono">Executive Summary</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="max-w-xl">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                  {slide.title}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 mt-2 leading-relaxed">
                  {slide.description}
                </p>
              </div>

              {/* Huge Kinetic Metric Card */}
              <div className={`hidden sm:flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/80 border ${slide.borderColor} backdrop-blur-xl shrink-0 min-w-[130px]`}>
                <Icon className={`w-6 h-6 mb-1 ${slide.accentColor}`} />
                <span className="text-2xl font-black text-white font-mono tracking-tight">
                  {slide.metric}
                </span>
                <span className="text-[10px] text-zinc-400 text-center font-medium mt-0.5">
                  {slide.metricLabel}
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons & Touch Target Arrows */}
      <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10 mt-6">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>Slide {currentSlideIndex + 1} of {REEL_SLIDES.length}</span>
        </div>
      </div>
    </div>
  );
}
