import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * UniversalBlockEditor
 * Vector-style shape manipulator & UI Editor for EVERY block in the app.
 * - Activated via universal pencil/edit button in Header.
 * - Ctrl + Left Click (or ⌘ + Left Click) selects any block/card/container.
 * - Renders vector bounding box with corner & edge resize handles (Figma-style).
 * - Dragging adjusts width, height, minHeight in real time.
 * - Saves permanently to settings.customUiLayout so custom sizes persist forever.
 */
function getUniqueSelector(el) {
  if (!el || el === document.body || el === document.documentElement) return '';
  const blockId = el.getAttribute('data-block-id');
  if (blockId) return `[data-block-id="${blockId}"]`;
  if (el.id) return `#${el.id}`;

  const path = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    const curBlockId = current.getAttribute('data-block-id');
    if (curBlockId) {
      path.unshift(`[data-block-id="${curBlockId}"]`);
      break;
    }
    if (current.id) {
      path.unshift(`#${current.id}`);
      break;
    }
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
    const index = siblings.indexOf(current) + 1;
    const tag = current.tagName.toLowerCase();
    path.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    current = parent;
  }
  return path.join(' > ');
}

export default function UniversalBlockEditor({
  isEditorMode = false,
  onToggleEditorMode,
  customUiLayout = {},
  onUpdateLayout,
  onResetLayout
}) {
  const [selectedBlock, setSelectedBlock] = useState(null); // { el, blockId, rect }
  const [hoveredRect, setHoveredRect] = useState(null); // { el, rect, label }
  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null); // { handle, startX, startY, startWidth, startHeight }
  const [liveDimensions, setLiveDimensions] = useState(null); // { width, height }
  const [saveBadge, setSaveBadge] = useState(false);

  const selectedRef = useRef(selectedBlock);
  selectedRef.current = selectedBlock;

  const dragRef = useRef(activeDrag);
  dragRef.current = activeDrag;

  // Track Ctrl / Cmd key state
  useEffect(() => {
    if (!isEditorMode) {
      setIsCtrlDown(false);
      setHoveredRect(null);
      setSelectedBlock(null);
      return undefined;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlDown(true);
      }
      if (e.key === 'Escape') {
        if (selectedRef.current) {
          setSelectedBlock(null);
          setLiveDimensions(null);
        } else if (onToggleEditorMode) {
          onToggleEditorMode();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlDown(false);
        setHoveredRect(null);
      }
    };

    const handleWindowBlur = () => {
      setIsCtrlDown(false);
      setHoveredRect(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isEditorMode, onToggleEditorMode]);

  // Helper: Find eligible target block element
  const getTargetBlock = useCallback((target) => {
    if (!target) return null;
    // Ignore clicks inside editor UI, modals, or toasts
    if (target.closest('[data-editor-ui="true"]')) return null;
    if (target.closest('#modal-root, [role="dialog"], .toast-container')) return null;

    // Look for explicit data-block-id first
    const explicit = target.closest('[data-block-id]');
    if (explicit && !explicit.closest('[data-editor-ui="true"]')) return explicit;

    // Look for card-like container classes
    const card = target.closest(
      '[data-card], .rounded-3xl, .rounded-2xl, .rounded-xl, article, section, aside, .card'
    );
    if (card && !card.closest('[data-editor-ui="true"]') && card.tagName !== 'BODY' && card.id !== 'root') {
      return card;
    }

    // Fallback: nearest container div inside main
    const container = target.closest('main > div, main div.grid > div, main div.space-y-6 > div');
    if (container && !container.closest('[data-editor-ui="true"]') && container.tagName !== 'BODY') {
      return container;
    }

    return null;
  }, []);

  // Helper: Generate or extract a stable semantic block ID
  const getOrCreateBlockId = useCallback((el) => {
    if (!el) return null;
    const existing = el.getAttribute('data-block-id');
    if (existing) return existing;

    if (el.id && !el.id.startsWith('react-')) {
      el.setAttribute('data-block-id', el.id);
      return el.id;
    }

    // Try finding a title/heading to make a human-readable identifier
    const heading = el.querySelector('h1, h2, h3, h4, p.font-bold, p.font-semibold, span.font-bold');
    const headingText = heading?.textContent?.trim().slice(0, 20).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const tag = el.tagName.toLowerCase();
    
    let generated = headingText ? `${tag}-${headingText}` : `${tag}-${Math.random().toString(36).substring(2, 7)}`;
    generated = generated.replace(/-+/g, '-').replace(/^-|-$/g, '');
    el.setAttribute('data-block-id', generated);
    return generated;
  }, []);

  // Hover detection when Ctrl / Cmd is held
  useEffect(() => {
    if (!isEditorMode) return undefined;

    const handleMouseMove = (e) => {
      if (dragRef.current) return; // Don't update hover while dragging
      if (!e.ctrlKey && !e.metaKey) {
        if (hoveredRect) setHoveredRect(null);
        return;
      }

      const block = getTargetBlock(e.target);
      if (!block || block === selectedRef.current?.el) {
        setHoveredRect(null);
        return;
      }

      const rect = block.getBoundingClientRect();
      const blockId = block.getAttribute('data-block-id') || block.id || block.tagName.toLowerCase();
      setHoveredRect({
        el: block,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        label: blockId
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isEditorMode, getTargetBlock, hoveredRect]);

  // Global Ctrl + Click block selector
  useEffect(() => {
    if (!isEditorMode) return undefined;

    const handlePointerDown = (e) => {
      // Check if user held Ctrl or Cmd
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.target.closest('[data-editor-ui="true"]')) return;

      const block = getTargetBlock(e.target);
      if (!block) return;

      e.preventDefault();
      e.stopPropagation();

      const blockId = getOrCreateBlockId(block);
      const rect = block.getBoundingClientRect();

      setSelectedBlock({
        el: block,
        blockId,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      });

      setLiveDimensions({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });

      setHoveredRect(null);
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  }, [isEditorMode, getTargetBlock, getOrCreateBlockId]);

  // Keep selected bounding box position in sync on scroll / window resize
  const updateSelectedRect = useCallback(() => {
    if (!selectedRef.current?.el) return;
    const rect = selectedRef.current.el.getBoundingClientRect();
    setSelectedBlock(prev => {
      if (!prev?.el) return null;
      return {
        ...prev,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      };
    });
  }, []);

  useEffect(() => {
    if (!selectedBlock) return undefined;

    window.addEventListener('scroll', updateSelectedRect, { passive: true, capture: true });
    window.addEventListener('resize', updateSelectedRect, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateSelectedRect, { capture: true });
      window.removeEventListener('resize', updateSelectedRect);
    };
  }, [selectedBlock, updateSelectedRect]);

  // Vector Resize Handle Dragging Logic
  const startDrag = (handle, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedBlock?.el) return;
    const rect = selectedBlock.el.getBoundingClientRect();

    setActiveDrag({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
      blockId: selectedBlock.blockId,
      el: selectedBlock.el
    });
  };

  useEffect(() => {
    if (!activeDrag) return undefined;

    const handlePointerMove = (e) => {
      const { handle, startX, startY, startWidth, startHeight, el } = activeDrag;
      if (!el) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (handle === 'right') {
        nextWidth = Math.max(120, Math.round(startWidth + deltaX));
      } else if (handle === 'left') {
        nextWidth = Math.max(120, Math.round(startWidth - deltaX));
      } else if (handle === 'bottom') {
        nextHeight = Math.max(50, Math.round(startHeight + deltaY));
      } else if (handle === 'top') {
        nextHeight = Math.max(50, Math.round(startHeight - deltaY));
      } else if (handle === 'bottom-right') {
        nextWidth = Math.max(120, Math.round(startWidth + deltaX));
        nextHeight = Math.max(50, Math.round(startHeight + deltaY));
      } else if (handle === 'bottom-left') {
        nextWidth = Math.max(120, Math.round(startWidth - deltaX));
        nextHeight = Math.max(50, Math.round(startHeight + deltaY));
      } else if (handle === 'top-right') {
        nextWidth = Math.max(120, Math.round(startWidth + deltaX));
        nextHeight = Math.max(50, Math.round(startHeight - deltaY));
      } else if (handle === 'top-left') {
        nextWidth = Math.max(120, Math.round(startWidth - deltaX));
        nextHeight = Math.max(50, Math.round(startHeight - deltaY));
      }

      // Apply real-time styles directly to element for instant fluid feedback
      if (['right', 'left', 'bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(handle)) {
        el.style.setProperty('width', `${nextWidth}px`, 'important');
        el.style.setProperty('max-width', 'none', 'important');
        el.style.setProperty('flex', 'none', 'important');
        el.style.setProperty('flex-basis', 'auto', 'important');
      }

      if (['bottom', 'top', 'bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(handle)) {
        el.style.setProperty('height', `${nextHeight}px`, 'important');
        el.style.setProperty('min-height', `${nextHeight}px`, 'important');
      }

      setLiveDimensions({ width: nextWidth, height: nextHeight });
      updateSelectedRect();
    };

    const handlePointerUp = () => {
      const { blockId, el } = activeDrag;
      const finalRect = el.getBoundingClientRect();
      const finalW = Math.round(finalRect.width);
      const finalH = Math.round(finalRect.height);

      const selector = getUniqueSelector(el);

      if (onUpdateLayout && blockId) {
        onUpdateLayout(blockId, {
          width: finalW,
          height: finalH,
          minHeight: finalH,
          flex: 'none',
          maxWidth: 'none',
          selector
        });
      }

      setSaveBadge(true);
      setTimeout(() => setSaveBadge(false), 2000);

      setActiveDrag(null);
      updateSelectedRect();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, onUpdateLayout, updateSelectedRect]);

  if (!isEditorMode) return null;

  const customCount = Object.keys(customUiLayout || {}).length;

  return (
    <div data-editor-ui="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden font-sans">
      
      {/* ── Top Floating Universal Editor Dock ── */}
      <div className="pointer-events-auto absolute top-16 md:top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-[#1A1B1F]/90 backdrop-blur-xl text-white shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-3 duration-200">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0A84FF] animate-pulse" />
          <span className="text-xs font-semibold tracking-tight">UI Editor Mode</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] text-white/80">
          <kbd className="px-1 py-0.5 rounded bg-black/40 text-[10px] font-mono">Ctrl</kbd>
          <span>+</span>
          <span>Click any block to resize</span>
        </div>

        {customCount > 0 && (
          <span className="hidden md:inline text-[11px] text-emerald-400 font-medium">
            {customCount} customized {customCount === 1 ? 'block' : 'blocks'}
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-1">
          {customCount > 0 && (
            <button
              onClick={() => onResetLayout && onResetLayout()}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Reset all customized block layouts to default"
            >
              Reset All
            </button>
          )}
          <button
            onClick={() => onToggleEditorMode && onToggleEditorMode()}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#0A84FF] hover:bg-[#0071E3] text-white text-[11px] font-semibold transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[14px]">done</span>
            <span>Exit Editor</span>
          </button>
        </div>
      </div>

      {/* ── Hover Guide Outline (When Ctrl/Cmd is held) ── */}
      {hoveredRect && !selectedBlock && isCtrlDown && (
        <div
          className="pointer-events-none absolute transition-all duration-75 border-2 border-dashed border-[#0A84FF] rounded-xl bg-[#0A84FF]/[0.04]"
          style={{
            top: hoveredRect.rect.top - 2,
            left: hoveredRect.rect.left - 2,
            width: hoveredRect.rect.width + 4,
            height: hoveredRect.rect.height + 4,
          }}
        >
          <div className="absolute -top-7 left-0 px-2 py-0.5 rounded-md bg-[#0A84FF] text-white text-[10px] font-semibold tracking-tight shadow-md flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">ads_click</span>
            <span>Click to resize ({hoveredRect.label})</span>
          </div>
        </div>
      )}

      {/* ── Selected Vector Bounding Box with Figma-Style Resize Handles ── */}
      {selectedBlock && selectedBlock.rect && (
        <div
          className="pointer-events-none absolute"
          style={{
            top: selectedBlock.rect.top,
            left: selectedBlock.rect.left,
            width: selectedBlock.rect.width,
            height: selectedBlock.rect.height,
          }}
        >
          {/* Main Vibrant Blue Outline with Glow */}
          <div className="absolute inset-0 border-2 border-[#0A84FF] rounded-xl shadow-[0_0_0_1px_rgba(10,132,255,0.3),0_8px_32px_rgba(10,132,255,0.18)]" />

          {/* ── Floating HUD Dimensions Badge ── */}
          <div
            className="pointer-events-auto absolute -top-11 left-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1B1F]/95 backdrop-blur-md text-white shadow-xl border border-white/10 whitespace-nowrap z-50 text-[11px]"
          >
            <span className="font-semibold text-white/90">
              {selectedBlock.blockId}
            </span>
            <span className="text-white/40">|</span>
            <span className="font-mono text-[#0A84FF] font-medium">
              {liveDimensions?.width || Math.round(selectedBlock.rect.width)}px × {liveDimensions?.height || Math.round(selectedBlock.rect.height)}px
            </span>
            {saveBadge && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold animate-pulse">
                Saved!
              </span>
            )}
            <button
              onClick={() => {
                if (onResetLayout && selectedBlock.blockId) {
                  onResetLayout(selectedBlock.blockId);
                  if (selectedBlock.el) {
                    selectedBlock.el.style.width = '';
                    selectedBlock.el.style.height = '';
                    selectedBlock.el.style.minHeight = '';
                    selectedBlock.el.style.flex = '';
                    selectedBlock.el.style.maxWidth = '';
                  }
                  updateSelectedRect();
                }
              }}
              className="text-white/60 hover:text-red-400 transition-colors ml-1"
              title="Reset this block to default"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setSelectedBlock(null);
                setLiveDimensions(null);
              }}
              className="text-white/60 hover:text-white transition-colors"
              title="Deselect block (Esc)"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>

          {/* ── 4 Corner Handles ── */}
          {/* Top-Left */}
          <div
            onPointerDown={(e) => startDrag('top-left', e)}
            className="pointer-events-auto absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#0A84FF] rounded-sm shadow-sm cursor-nwse-resize hover:scale-125 transition-transform"
          />
          {/* Top-Right */}
          <div
            onPointerDown={(e) => startDrag('top-right', e)}
            className="pointer-events-auto absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#0A84FF] rounded-sm shadow-sm cursor-nesw-resize hover:scale-125 transition-transform"
          />
          {/* Bottom-Left */}
          <div
            onPointerDown={(e) => startDrag('bottom-left', e)}
            className="pointer-events-auto absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#0A84FF] rounded-sm shadow-sm cursor-nesw-resize hover:scale-125 transition-transform"
          />
          {/* Bottom-Right */}
          <div
            onPointerDown={(e) => startDrag('bottom-right', e)}
            className="pointer-events-auto absolute -bottom-2 -right-2 w-4 h-4 bg-[#0A84FF] border-2 border-white rounded shadow-md cursor-nwse-resize hover:scale-125 transition-transform flex items-center justify-center"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-xs" />
          </div>

          {/* ── 4 Edge Resize Bar Handles ── */}
          {/* Right Edge Handle (Adjust Width) */}
          <div
            onPointerDown={(e) => startDrag('right', e)}
            className="pointer-events-auto absolute -right-2 top-1/2 -translate-y-1/2 w-3.5 h-10 bg-white border-2 border-[#0A84FF] rounded-full shadow-md cursor-ew-resize hover:bg-[#0A84FF] hover:border-white transition-all flex flex-col items-center justify-center gap-0.5 group"
            title="Drag horizontally to adjust width"
          >
            <div className="w-1 h-1 bg-[#0A84FF] group-hover:bg-white rounded-full" />
            <div className="w-1 h-1 bg-[#0A84FF] group-hover:bg-white rounded-full" />
          </div>

          {/* Bottom Edge Handle (Adjust Height) */}
          <div
            onPointerDown={(e) => startDrag('bottom', e)}
            className="pointer-events-auto absolute -bottom-2 left-1/2 -translate-x-1/2 h-3.5 w-10 bg-white border-2 border-[#0A84FF] rounded-full shadow-md cursor-ns-resize hover:bg-[#0A84FF] hover:border-white transition-all flex items-center justify-center gap-0.5 group"
            title="Drag vertically to adjust height"
          >
            <div className="w-1 h-1 bg-[#0A84FF] group-hover:bg-white rounded-full" />
            <div className="w-1 h-1 bg-[#0A84FF] group-hover:bg-white rounded-full" />
          </div>

          {/* Left Edge Handle */}
          <div
            onPointerDown={(e) => startDrag('left', e)}
            className="pointer-events-auto absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-8 bg-white border border-[#0A84FF] rounded-full shadow-sm cursor-ew-resize hover:bg-[#0A84FF] transition-all"
            title="Drag horizontally to adjust width"
          />

          {/* Top Edge Handle */}
          <div
            onPointerDown={(e) => startDrag('top', e)}
            className="pointer-events-auto absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-8 bg-white border border-[#0A84FF] rounded-full shadow-sm cursor-ns-resize hover:bg-[#0A84FF] transition-all"
            title="Drag vertically to adjust height"
          />
        </div>
      )}
    </div>
  );
}
