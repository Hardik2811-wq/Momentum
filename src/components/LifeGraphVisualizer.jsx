import React, { useState, useMemo, useRef } from 'react';
import { buildLifeGraph } from '../lib/lifeGraph.js';

export default function LifeGraphVisualizer({
  tasks = [],
  goals = [],
  habits = [],
  schedules = [],
  toggleTask,
  onSwitchToChat
}) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showOrphans, setShowOrphans] = useState(true);
  const [activeTypes, setActiveTypes] = useState({
    goal: true,
    task: true,
    habit: true,
    schedule: true
  });

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // 1. Build Life Graph DAG
  const graph = useMemo(() => {
    return buildLifeGraph({ tasks, goals, habits, schedules });
  }, [tasks, goals, habits, schedules]);

  const hasCycles = useMemo(() => graph.hasCycles(), [graph]);
  const unblockedTasks = useMemo(() => graph.getUnblockedTasks(), [graph]);

  // Compute critical path task node IDs across all goals
  const criticalPathNodeIds = useMemo(() => {
    const cpIds = new Set();
    for (const g of goals) {
      const cp = graph.getCriticalPath(g.id);
      cp.forEach(t => cpIds.add(`t:${t.id}`));
    }
    return cpIds;
  }, [graph, goals]);

  // Compute node degrees (connectivity)
  const nodeDegrees = useMemo(() => {
    const deg = new Map();
    for (const n of graph.nodes) deg.set(n.id, 0);
    for (const e of graph.edges) {
      deg.set(e.source, (deg.get(e.source) || 0) + 1);
      deg.set(e.target, (deg.get(e.target) || 0) + 1);
    }
    return deg;
  }, [graph]);

  // Filter visible nodes & edges
  const visibleNodes = useMemo(() => {
    return graph.nodes.filter(n => {
      if (!activeTypes[n.type]) return false;
      const d = nodeDegrees.get(n.id) || 0;
      if (!showOrphans && d === 0) return false;
      return true;
    });
  }, [graph, activeTypes, showOrphans, nodeDegrees]);

  const visibleNodeIds = useMemo(() => {
    return new Set(visibleNodes.map(n => n.id));
  }, [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return graph.edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [graph.edges, visibleNodeIds]);

  // 2. Obsidian-Grade Force-Directed Simulation
  const positions = useMemo(() => {
    const width = 800;
    const height = 650;
    const centerX = width / 2;
    const centerY = height / 2;

    const coords = new Map();
    const nodeMap = new Map();

    visibleNodes.forEach((n, idx) => {
      let angle = (idx / Math.max(visibleNodes.length, 1)) * 2 * Math.PI;
      let radius = 120;
      if (n.type === 'goal') radius = 80;
      else if (n.type === 'habit' || n.type === 'schedule') radius = 160;
      else radius = 220 + ((idx * 37) % 80);

      const x = centerX + Math.cos(angle) * radius + ((idx % 5) - 2) * 15;
      const y = centerY + Math.sin(angle) * radius + ((idx % 3) - 1) * 15;

      const pos = { id: n.id, x, y, vx: 0, vy: 0, type: n.type, degree: nodeDegrees.get(n.id) || 0 };
      coords.set(n.id, pos);
      nodeMap.set(n.id, pos);
    });

    const iterations = 85;
    let alpha = 1.0;
    const alphaDecay = 0.96;
    const kRepel = 3200;
    const kSpring = 0.055;
    const springLength = 80;

    for (let iter = 0; iter < iterations; iter++) {
      const nodeList = Array.from(coords.values());
      const nLen = nodeList.length;

      // Coulomb Repulsion
      for (let i = 0; i < nLen; i++) {
        const p1 = nodeList[i];
        for (let j = i + 1; j < nLen; j++) {
          const p2 = nodeList[j];
          let dx = p1.x - p2.x;
          let dy = p1.y - p2.y;
          let distSq = dx * dx + dy * dy;
          if (distSq < 1) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; distSq = 4; }
          const dist = Math.sqrt(distSq);

          const hubMultiplier = 1 + (p1.degree + p2.degree) * 0.12;
          const force = (kRepel * hubMultiplier) / distSq;
          const fx = (dx / dist) * force * alpha;
          const fy = (dy / dist) * force * alpha;

          p1.vx += fx;
          p1.vy += fy;
          p2.vx -= fx;
          p2.vy -= fy;
        }
      }

      // Hooke Spring Attraction
      for (const e of visibleEdges) {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) continue;

        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetLen = e.type === 'reinforces' ? springLength * 0.85 : springLength;
        const force = (dist - targetLen) * kSpring * alpha;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      // Centering Gravitational Pull
      for (const p of nodeList) {
        p.vx -= (p.x - centerX) * 0.02 * alpha;
        p.vy -= (p.y - centerY) * 0.02 * alpha;

        p.x += p.vx * 0.5;
        p.y += p.vy * 0.5;
        p.vx *= 0.65;
        p.vy *= 0.65;
      }

      alpha *= alphaDecay;
    }

    return coords;
  }, [visibleNodes, visibleEdges, nodeDegrees]);

  // Active / Selected Node details & connections
  const activeNodeId = selectedNodeId || hoveredNodeId;

  const connectedInfo = useMemo(() => {
    if (!activeNodeId) return { neighbors: new Set(), edgeIndices: new Set() };
    const neighbors = new Set([activeNodeId]);
    const edgeIndices = new Set();

    visibleEdges.forEach((e, idx) => {
      if (e.source === activeNodeId) {
        neighbors.add(e.target);
        edgeIndices.add(idx);
      } else if (e.target === activeNodeId) {
        neighbors.add(e.source);
        edgeIndices.add(idx);
      }
    });

    return { neighbors, edgeIndices };
  }, [activeNodeId, visibleEdges]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graph.getNode(selectedNodeId);
  }, [selectedNodeId, graph]);

  // 3. Dynamic & Meaningful Semantic Color Palette
  const getNodeVisual = (node) => {
    const deg = nodeDegrees.get(node.id) || 0;
    let radius = 5.5;
    let color = '#94A3B8';
    let haloColor = 'rgba(148, 163, 184, 0.4)';
    let semanticState = 'Item';
    let labelColor = '#CBD5E1';

    switch (node.type) {
      case 'goal':
        radius = Math.min(10 + deg * 1.2, 17);
        if (node.data?.completed || (node.data?.progress >= 100)) {
          color = '#10B981'; // Emerald (Achieved)
          haloColor = 'rgba(16, 185, 129, 0.45)';
          semanticState = 'Goal (Achieved)';
          labelColor = '#6EE7B7';
        } else {
          color = '#F59E0B'; // Solar Amber Gold (Horizon)
          haloColor = 'rgba(245, 158, 11, 0.45)';
          semanticState = 'Goal (Active Horizon)';
          labelColor = '#FDE68A';
        }
        break;

      case 'habit':
        radius = Math.min(7 + deg * 0.8, 12);
        const streak = node.data?.streak || 0;
        if (streak >= 3) {
          color = '#10B981'; // Mint Emerald (Active Streak)
          haloColor = 'rgba(16, 185, 129, 0.4)';
          semanticState = `Habit (${streak}d Streak)`;
          labelColor = '#A7F3D0';
        } else if (streak > 0) {
          color = '#14B8A6'; // Teal
          haloColor = 'rgba(20, 184, 166, 0.4)';
          semanticState = `Habit (Starting)`;
          labelColor = '#99F6E4';
        } else {
          color = '#FB7185'; // Rose Coral (At Risk / Needs check-in)
          haloColor = 'rgba(251, 113, 133, 0.4)';
          semanticState = 'Habit (At Risk)';
          labelColor = '#FECDD3';
        }
        break;

      case 'schedule':
        radius = Math.min(7 + deg * 0.8, 12);
        color = '#A855F7'; // Amethyst Violet (Fixed Anchor)
        haloColor = 'rgba(168, 85, 247, 0.4)';
        semanticState = 'Schedule (Fixed Block)';
        labelColor = '#E9D5FF';
        break;

      case 'task':
      default:
        const t = node.data;
        const isDone = Boolean(t?.completed);
        const isCritical = criticalPathNodeIds.has(node.id) || t?.priority === 'high' || t?.effort === 'high';
        const isUnblocked = unblockedTasks.some(u => String(u.id) === String(t?.id));
        const deps = Array.isArray(t?.dependsOn) ? t.dependsOn : (t?.dependsOn ? [t.dependsOn] : []);
        const isBlocked = !isDone && deps.length > 0 && !isUnblocked;

        if (isDone) {
          radius = 4.5;
          color = '#64748B'; // Muted Slate
          haloColor = 'rgba(100, 116, 139, 0.2)';
          semanticState = 'Task (Completed)';
          labelColor = '#94A3B8';
        } else if (isCritical) {
          radius = 7.5;
          color = '#EF4444'; // Crimson Red (High Leverage / Critical Path)
          haloColor = 'rgba(239, 68, 68, 0.5)';
          semanticState = 'Task (Critical / High Impact)';
          labelColor = '#FCA5A5';
        } else if (isBlocked) {
          radius = 6.0;
          color = '#F97316'; // Warning Orange (Waiting on prerequisite)
          haloColor = 'rgba(249, 115, 22, 0.45)';
          semanticState = 'Task (Blocked by Dependencies)';
          labelColor = '#FDBA74';
        } else if (isUnblocked) {
          radius = 6.5;
          color = '#38BDF8'; // Neon Electric Cyan (Ready to execute)
          haloColor = 'rgba(56, 189, 248, 0.45)';
          semanticState = 'Task (Ready to Execute)';
          labelColor = '#BAE6FD';
        } else {
          radius = 5.5;
          color = '#60A5FA'; // Calm Sky Blue
          haloColor = 'rgba(96, 165, 250, 0.3)';
          semanticState = 'Task (Open Backlog)';
          labelColor = '#BFDBFE';
        }
        break;
    }

    return { radius, color, haloColor, semanticState, labelColor };
  };

  // Pan Handlers
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch Handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Fit view helper
  const handleFitView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNodeId(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full flex flex-col min-h-0 bg-[#121318] text-[#E2E8F0] relative overflow-hidden select-none font-sans"
    >
      {/* ── Top HUD Controls ── */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        
        {/* Left: Collapsible Filters Trigger */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(f => !f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition flex items-center gap-1.5 shadow-lg ${
              showFilters
                ? 'bg-[#1E2029] text-white border-white/20'
                : 'bg-[#181920]/80 text-[#94A3B8] hover:text-white border-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            <span>Filters</span>
            <span className="material-symbols-outlined text-[14px]">
              {showFilters ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Quick Metrics Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-[#181920]/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-[#94A3B8]">
            <span className="text-[#38BDF8]">{visibleNodes.length} nodes</span>
            <span>•</span>
            <span className="text-[#A78BFA]">{visibleEdges.length} links</span>
            <span>•</span>
            <span className={hasCycles ? 'text-amber-400' : 'text-emerald-400'}>
              {hasCycles ? 'cycles' : 'cycle-free'}
            </span>
          </div>
        </div>

        {/* Right: Zoom & Reset Actions */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-[#181920]/80 backdrop-blur-md border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="w-7 h-7 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined text-[16px]">remove</span>
          </button>
          <span className="text-[11px] font-mono text-[#64748B] w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(2.0, z + 0.15))}
            className="w-7 h-7 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            title="Zoom In"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          <button
            type="button"
            onClick={handleFitView}
            className="px-2 py-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 text-[11px] font-mono transition cursor-pointer ml-0.5"
            title="Reset Graph Position"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Semantic Color Palette Legend Bar (Direct Interpretation) ── */}
      <div className="absolute top-12 left-3 right-3 z-20 flex items-center gap-2 overflow-x-auto py-1 px-2.5 rounded-xl bg-[#181920]/90 backdrop-blur-md border border-white/10 text-[10px] font-mono scrollbar-none pointer-events-auto shadow-sm">
        <span className="text-[#64748B] uppercase font-bold text-[9px] shrink-0">Palette:</span>
        <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /><span className="text-[#F59E0B]">Goal</span></div>
        <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-[#10B981]" /><span className="text-[#10B981]">Habit</span></div>
        <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-[#A855F7]" /><span className="text-[#A855F7]">Schedule</span></div>
        <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-[#EF4444]" /><span className="text-[#EF4444]">Critical</span></div>
        <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-[#38BDF8]" /><span className="text-[#38BDF8]">Ready</span></div>
        <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-[#F97316]" /><span className="text-[#F97316]">Blocked</span></div>
        <div className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-[#64748B]" /><span className="text-[#94A3B8]">Done</span></div>
      </div>

      {/* ── Obsidian Floating Filter Drawer ── */}
      {showFilters && (
        <div className="absolute top-22 left-3 z-30 w-64 p-3 rounded-2xl bg-[#181920]/95 backdrop-blur-xl border border-white/15 shadow-2xl text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-semibold text-white tracking-wide">Graph Filter &amp; Display</span>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="text-[#64748B] hover:text-white"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Entity Toggles</span>
            {[
              { type: 'goal', label: 'Goals (Horizons)', color: 'bg-[#F59E0B]' },
              { type: 'habit', label: 'Habits (Streaks)', color: 'bg-[#10B981]' },
              { type: 'schedule', label: 'Schedules (Fixed Blocks)', color: 'bg-[#A855F7]' },
              { type: 'task', label: 'Tasks (Action Items)', color: 'bg-[#38BDF8]' }
            ].map(item => (
              <label
                key={item.type}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-[#CBD5E1]"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span>{item.label}</span>
                </div>
                <input
                  type="checkbox"
                  checked={activeTypes[item.type]}
                  onChange={e => setActiveTypes(prev => ({ ...prev, [item.type]: e.target.checked }))}
                  className="rounded border-white/20 bg-white/10 text-[#38BDF8] focus:ring-0 cursor-pointer"
                />
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between px-2 py-1 text-[#CBD5E1]">
            <span>Show Disconnected Nodes</span>
            <input
              type="checkbox"
              checked={showOrphans}
              onChange={e => setShowOrphans(e.target.checked)}
              className="rounded border-white/20 bg-white/10 text-[#38BDF8] focus:ring-0 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ── Interactive Obsidian Canvas ── */}
      <div
        className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setSelectedNodeId(null)}
      >
        <svg
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        >
          {/* Subtle Dot Grid Pattern & Arrowhead Markers */}
          <defs>
            <pattern
              id="obsidian-dots"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="0.75" fill="#222530" />
            </pattern>

            {/* Dependency Arrowhead (Warm Amber) */}
            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="16"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#F59E0B" />
            </marker>

            {/* Reinforcement Arrowhead (Radiant Cyan) */}
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="16"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38BDF8" />
            </marker>

            {/* Active Highlight Arrowhead */}
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#FFFFFF" />
            </marker>
          </defs>

          <rect width="100%" height="100%" fill="url(#obsidian-dots)" />

          {/* Pan & Zoom Group */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            
            {/* ── High-Contrast Directed Edges ── */}
            {visibleEdges.map((edge, idx) => {
              const sCoord = positions.get(edge.source);
              const tCoord = positions.get(edge.target);
              if (!sCoord || !tCoord) return null;

              const isConnected = connectedInfo.edgeIndices.has(idx);
              const isDimmed = activeNodeId && !isConnected;

              // High-contrast, semantic edge coloring
              const isDepends = edge.type === 'dependsOn';
              const isReinforces = edge.type === 'reinforces';

              const strokeColor = isConnected
                ? '#FFFFFF'
                : isDepends
                ? '#F59E0B' // Amber Gold for task dependencies
                : isReinforces
                ? '#38BDF8' // Radiant Cyan for goal/habit reinforcement
                : '#A855F7'; // Amethyst for schedule links

              const strokeWidth = isConnected ? 2.5 : 1.3;
              const strokeOpacity = isConnected ? 1.0 : isDimmed ? 0.08 : 0.65;
              const markerId = isConnected
                ? 'url(#arrow-active)'
                : isDepends
                ? 'url(#arrow-amber)'
                : 'url(#arrow-cyan)';

              return (
                <line
                  key={`e-${edge.source}-${edge.target}-${idx}`}
                  x1={sCoord.x}
                  y1={sCoord.y}
                  x2={tCoord.x}
                  y2={tCoord.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeDasharray={isReinforces ? '4 3' : 'none'}
                  markerEnd={markerId}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* ── Nodes Layer with Dynamic Colors & Readable Small Labels ── */}
            {visibleNodes.map(node => {
              const pos = positions.get(node.id);
              if (!pos) return null;

              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isConnected = connectedInfo.neighbors.has(node.id);
              const isDimmed = activeNodeId && !isConnected;

              const visual = getNodeVisual(node);
              const isGoal = node.type === 'goal';
              const isLarge = isGoal || pos.degree >= 3;

              // Readable truncated label for compact viewing
              const labelText = isSelected || isHovered
                ? node.label
                : node.label.length > 14
                ? node.label.slice(0, 13) + '…'
                : node.label;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  className="cursor-pointer"
                  opacity={isDimmed ? 0.18 : 1}
                  style={{ transition: 'opacity 0.2s ease' }}
                >
                  {/* Invisible Thumb-Friendly Touch Area */}
                  <circle
                    r={Math.max(visual.radius + 12, 18)}
                    fill="transparent"
                  />
                  {/* Outer Pulsing Glow Halo for Selected or Hovered */}
                  {(isSelected || isHovered) && (
                    <circle
                      r={visual.radius + 9}
                      fill="none"
                      stroke={visual.color}
                      strokeWidth="1.6"
                      strokeOpacity="0.8"
                      className="animate-ping"
                      style={{ animationDuration: '2s' }}
                    />
                  )}

                  {/* Ambient Halo Ring */}
                  <circle
                    r={visual.radius + (isSelected ? 6 : 3)}
                    fill={visual.haloColor}
                    opacity={isSelected ? 1 : 0.45}
                  />

                  {/* Core Particle Dot */}
                  <circle
                    r={visual.radius}
                    fill={visual.color}
                    stroke={isSelected ? '#FFFFFF' : '#121318'}
                    strokeWidth={isSelected ? 2 : 1.2}
                    filter="drop-shadow(0 0 5px rgba(0,0,0,0.6))"
                  />

                  {/* Small Size Font Label for Every Node */}
                  <text
                    x={visual.radius + (isLarge ? 6 : 4.5)}
                    y="3"
                    fill={isSelected ? '#FFFFFF' : isConnected ? '#F8FAFC' : visual.labelColor}
                    fontSize={isLarge ? '10.5' : '8.5'}
                    fontWeight={isLarge || isSelected ? '700' : '500'}
                    letterSpacing="-0.01em"
                    className="pointer-events-none select-none transition-colors"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.95))"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ── Brief Info HUD Card on Node Click (Bottom Glass Panel) ── */}
      {selectedNode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 p-4 rounded-2xl bg-[#181920]/95 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-40 animate-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header Row: Semantic Type Badge + Title + Close */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getNodeVisual(selectedNode).color }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${getNodeVisual(selectedNode).color}22`,
                  color: getNodeVisual(selectedNode).color
                }}
              >
                {getNodeVisual(selectedNode).semanticState}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="text-[#64748B] hover:text-white p-0.5 rounded-lg transition"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <h3 className="font-bold text-sm text-white leading-tight mb-2">
            {selectedNode.label}
          </h3>

          {/* Compact Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/[0.04] p-2.5 rounded-xl border border-white/5 mb-3">
            {selectedNode.type === 'task' && (
              <>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Execution State</span>
                  <span
                    className="font-semibold"
                    style={{ color: getNodeVisual(selectedNode).color }}
                  >
                    {selectedNode.data?.completed ? 'Completed ✓' : unblockedTasks.some(u => String(u.id) === String(selectedNode.data?.id)) ? 'Ready to Execute ⚡' : 'Waiting on Deps 🔒'}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Duration &amp; Energy</span>
                  <span className="font-semibold text-white">
                    {selectedNode.data?.durationMinutes || selectedNode.data?.duration || 30}m • {selectedNode.data?.energy || 'Med'}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Prerequisites</span>
                  <span className="font-semibold text-white">
                    {Array.isArray(selectedNode.data?.dependsOn) ? selectedNode.data.dependsOn.length : (selectedNode.data?.dependsOn ? 1 : 0)} upstream
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Due / Scheduled</span>
                  <span className="font-semibold text-white">
                    {selectedNode.data?.plannedDate || selectedNode.data?.dueDate || 'Open'}
                  </span>
                </div>
              </>
            )}

            {selectedNode.type === 'goal' && (
              <>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Area of Life</span>
                  <span className="font-semibold text-white">{selectedNode.data?.category || 'General'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Target Date</span>
                  <span className="font-semibold text-white">{selectedNode.data?.targetDate || 'Ongoing'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#64748B] block text-[10px]">Connected Sequence</span>
                  <span className="font-semibold text-[#F59E0B]">
                    {graph.getCriticalPath(selectedNode.data?.id).length} actionable tasks mapped
                  </span>
                </div>
              </>
            )}

            {selectedNode.type === 'habit' && (
              <>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Cadence</span>
                  <span className="font-semibold text-white">{selectedNode.data?.cadence || 'Daily'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Current Streak</span>
                  <span className="font-semibold text-emerald-400">
                    {selectedNode.data?.streak || 0} days active
                  </span>
                </div>
              </>
            )}

            {selectedNode.type === 'schedule' && (
              <>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Time Window</span>
                  <span className="font-semibold text-white">
                    {selectedNode.data?.startTime} - {selectedNode.data?.endTime}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Recurrence</span>
                  <span className="font-semibold text-white">{selectedNode.data?.recurrence || 'None'}</span>
                </div>
              </>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-[#64748B] font-mono">
              {nodeDegrees.get(selectedNode.id) || 0} connections
            </span>
            {selectedNode.type === 'task' && toggleTask && (
              <button
                type="button"
                onClick={() => toggleTask(selectedNode.data?.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  selectedNode.data?.completed
                    ? 'bg-white/10 text-[#CBD5E1] hover:bg-white/15'
                    : 'bg-[#38BDF8] text-[#0F172A] hover:bg-[#7DD3FC] shadow-md'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {selectedNode.data?.completed ? 'undo' : 'check'}
                </span>
                <span>{selectedNode.data?.completed ? 'Mark Incomplete' : 'Complete Task'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
