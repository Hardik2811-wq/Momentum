import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Clock,
  Zap,
  Brain,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FastForward
} from 'lucide-react';

const SIMULATION_EVENTS = [
  {
    timeMin: 8 * 60 + 30, // 08:30
    timeLabel: '08:30',
    type: 'CLASH',
    title: 'Somatic Clash Detected',
    desc: 'Heavy Leg Day workout finishes; immediate high-strain deep work would cause brain fog.',
    icon: AlertTriangle,
    color: 'border-rose-500/50 bg-rose-950/60 text-rose-200'
  },
  {
    timeMin: 9 * 60 + 15, // 09:15
    timeLabel: '09:15',
    type: 'BUFFER',
    title: 'Recovery Buffer Inserted (+45m)',
    desc: 'AI autonomous engine carved out hydration & neural cooldown before creative sprint.',
    icon: Zap,
    color: 'border-cyan-500/50 bg-cyan-950/60 text-cyan-200'
  },
  {
    timeMin: 10 * 60 + 30, // 10:30
    timeLabel: '10:30',
    type: 'FOCUS',
    title: 'Prime Cognitive Flow Unlocked',
    desc: 'Deep work executed at peak prefrontal cortex capacity with zero cognitive guilt.',
    icon: Brain,
    color: 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
  },
  {
    timeMin: 14 * 60 + 0, // 14:00
    timeLabel: '14:00',
    type: 'SLIPPED',
    title: 'Slipped Schedule Shifted',
    desc: 'Missed client review task shifted into verified 1-hour afternoon gap window.',
    icon: Clock,
    color: 'border-amber-500/50 bg-amber-950/60 text-amber-200'
  },
  {
    timeMin: 19 * 60 + 45, // 19:45
    timeLabel: '19:45',
    type: 'HABIT',
    title: 'Habit Streak Shield Activated',
    desc: 'Evening energy low: AI converted 45m workout to 5m minimum viable recovery, saving streak.',
    icon: Flame,
    color: 'border-purple-500/50 bg-purple-950/60 text-purple-200'
  }
];

export default function AgentReplayPlayer({
  timelineItems = [],
  harmonizedItems = []
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(8 * 60); // start at 08:00 (480 min)
  const [speed, setSpeed] = useState(2); // 1x, 2x, 4x
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  const startMinute = 7 * 60; // 07:00
  const endMinute = 22 * 60; // 22:00
  const totalMinutes = endMinute - startMinute;

  // Animation ticker loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const loop = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Advance virtual minutes: 1 real second = 30 virtual minutes at 1x
      const virtualMinutesPerSec = 30 * speed;
      const advance = (delta / 1000) * virtualMinutesPerSec;

      setCurrentMinute(prev => {
        const next = prev + advance;
        if (next >= endMinute) {
          setIsPlaying(false);
          return endMinute;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, endMinute]);

  const progressPercent = Math.min(100, Math.max(0, ((currentMinute - startMinute) / totalMinutes) * 100));

  const formatMinToTime = (min) => {
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Find nearest active event
  const currentEvent = SIMULATION_EVENTS.find(e => Math.abs(e.timeMin - currentMinute) < 40);

  const handleRestart = () => {
    setCurrentMinute(startMinute);
    setIsPlaying(true);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 p-5 sm:p-6 shadow-2xl">
      {/* Title & Speed Multipliers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Time-Lapse Flow Simulation
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Visual Replay Player
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Scrub and watch the AI dynamically untangle schedule friction and protect your focus
            </p>
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          {[1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-1 rounded-lg font-mono font-semibold transition-all ${
                speed === s
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Visual Canvas / Day Runway */}
      <div className="relative py-6 px-2 sm:px-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 mb-5 overflow-hidden">
        {/* Timeline Axis Labels */}
        <div className="flex justify-between text-[11px] font-mono text-zinc-500 mb-3 select-none">
          <span>07:00 AM</span>
          <span>11:00 AM</span>
          <span>03:00 PM</span>
          <span>07:00 PM</span>
          <span>10:00 PM</span>
        </div>

        {/* Progress Track & Event Markers */}
        <div className="relative h-6 bg-zinc-800/80 rounded-full overflow-visible mb-6 flex items-center">
          {/* Filled active timeline */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Event Pins */}
          {SIMULATION_EVENTS.map((evt, idx) => {
            const evtPct = ((evt.timeMin - startMinute) / totalMinutes) * 100;
            const isPassed = currentMinute >= evt.timeMin;
            return (
              <div
                key={idx}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 cursor-pointer"
                style={{ left: `${evtPct}%` }}
                onClick={() => setCurrentMinute(evt.timeMin)}
                title={`${evt.timeLabel}: ${evt.title}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 border-zinc-950 transition-all ${
                  isPassed ? 'bg-cyan-400 shadow-md shadow-cyan-400/80 scale-110' : 'bg-zinc-600 hover:bg-zinc-400'
                }`} />
              </div>
            );
          })}

          {/* Current Playhead Scrubber */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-xl shadow-cyan-400/50 flex items-center justify-center ring-2 ring-cyan-400">
              <div className="w-2 h-2 rounded-full bg-zinc-950" />
            </div>
          </div>
        </div>

        {/* Virtual Clock Display */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-lg font-bold text-zinc-100">
              {formatMinToTime(currentMinute)}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              Virtual Simulation Clock
            </span>
          </div>

          <span className="text-xs font-mono text-zinc-400">
            {Math.round(progressPercent)}% of day simulated
          </span>
        </div>

        {/* Dynamic Event Popover Card */}
        <div className="min-h-[90px] flex items-center">
          <AnimatePresence mode="wait">
            {currentEvent ? (
              <motion.div
                key={currentEvent.timeLabel}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className={`w-full p-3.5 rounded-xl border ${currentEvent.color} flex items-start gap-3 backdrop-blur-md shadow-lg`}
              >
                <div className="p-2 rounded-lg bg-zinc-950/60 shrink-0">
                  <currentEvent.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span>{currentEvent.title}</span>
                    <span className="font-mono text-[10px] opacity-80">{currentEvent.timeLabel}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {currentEvent.desc}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="w-full p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/30 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500/60" />
                Optimal state maintained. Prefrontal cortex load balanced.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Media Player Control Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(prev => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md shadow-violet-600/30 transition-all"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Simulation</span>
              </>
            )}
          </button>

          <button
            onClick={handleRestart}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Restart to 07:00"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Scrubber Range Slider */}
        <input
          type="range"
          min={startMinute}
          max={endMinute}
          value={currentMinute}
          onChange={(e) => setCurrentMinute(Number(e.target.value))}
          className="flex-1 max-w-xs accent-violet-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
        />
      </div>
    </div>
  );
}
