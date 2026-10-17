import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function AgentConfidenceGauge({ confidence = 0.85, riskLevel = 'LOW', size = 56 }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(1, Math.max(0, confidence)) * circumference);

  const getRingColor = () => {
    if (confidence >= 0.85) return 'text-emerald-400 stroke-emerald-400';
    if (confidence >= 0.65) return 'text-cyan-400 stroke-cyan-400';
    if (confidence >= 0.45) return 'text-amber-400 stroke-amber-400';
    return 'text-rose-400 stroke-rose-400';
  };

  const getRiskBadge = () => {
    switch (riskLevel) {
      case 'HIGH':
        return {
          icon: <ShieldAlert className="w-3 h-3 text-rose-400" />,
          label: 'High Risk',
          cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
        };
      case 'MEDIUM':
        return {
          icon: <AlertTriangle className="w-3 h-3 text-amber-400" />,
          label: 'Moderate Risk',
          cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        };
      default:
        return {
          icon: <ShieldCheck className="w-3 h-3 text-emerald-400" />,
          label: 'Low Risk',
          cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
        };
    }
  };

  const badge = getRiskBadge();

  return (
    <div className="flex items-center gap-3">
      {/* Radial Ring */}
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 52 52">
          {/* Background circle */}
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-zinc-800"
            strokeWidth="4"
            fill="transparent"
          />
          {/* Progress arc */}
          <circle
            cx="26"
            cy="26"
            r={radius}
            className={`transition-all duration-700 ease-out ${getRingColor()}`}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-mono font-bold tracking-tight text-zinc-100">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Confidence & Risk Pill Details */}
      <div className="space-y-1">
        <div className="text-[11px] font-mono uppercase font-bold text-zinc-400 tracking-wider">
          AI Confidence
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${badge.cls}`}>
          {badge.icon}
          <span>{badge.label}</span>
        </div>
      </div>
    </div>
  );
}
