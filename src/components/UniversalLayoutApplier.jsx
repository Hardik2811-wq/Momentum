import React, { useEffect, useLayoutEffect } from 'react';

/**
 * UniversalLayoutApplier
 * Injects persistent CSS rules for custom resized blocks defined in settings.customUiLayout.
 * Ensures custom block sizes and dimensions remain applied forever across all views and page reloads,
 * even when Universal Editor Mode is turned off.
 */
export default function UniversalLayoutApplier({ customUiLayout = {} }) {
  useLayoutEffect(() => {
    const STYLE_ID = 'momentum-custom-ui-layout-sheet';
    let styleEl = document.getElementById(STYLE_ID);

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }

    const layoutEntries = Object.entries(customUiLayout || {});

    if (layoutEntries.length === 0) {
      styleEl.textContent = '';
      return;
    }

    const cssRules = layoutEntries.map(([blockKey, dimensions]) => {
      if (!dimensions || typeof dimensions !== 'object') return '';

      const { width, height, minHeight, flex, maxWidth, selector: customSelector } = dimensions;
      const declarations = [];

      if (width !== undefined && width !== null) {
        declarations.push(`width: ${typeof width === 'number' ? `${width}px` : width} !important;`);
        declarations.push(`max-width: ${maxWidth || 'none'} !important;`);
        declarations.push(`flex: ${flex || 'none'} !important;`);
        declarations.push(`flex-basis: auto !important;`);
      }

      if (height !== undefined && height !== null) {
        declarations.push(`height: ${typeof height === 'number' ? `${height}px` : height} !important;`);
      }

      if (minHeight !== undefined && minHeight !== null) {
        declarations.push(`min-height: ${typeof minHeight === 'number' ? `${minHeight}px` : minHeight} !important;`);
      }

      if (declarations.length === 0) return '';

      const selectors = [];
      if (customSelector) selectors.push(customSelector);
      if (blockKey.startsWith('#') || blockKey.startsWith('.') || blockKey.startsWith('[')) {
        if (!selectors.includes(blockKey)) selectors.push(blockKey);
      } else {
        selectors.push(`[data-block-id="${blockKey}"]`);
      }

      return `
        ${selectors.join(', ')} {
          ${declarations.join('\n          ')}
        }
      `;
    }).filter(Boolean);

    styleEl.textContent = cssRules.join('\n');
  }, [customUiLayout]);

  // Ensure elements matching saved selectors also keep data-block-id synced
  useEffect(() => {
    const layoutEntries = Object.entries(customUiLayout || {});
    if (layoutEntries.length === 0) return undefined;

    const syncAttributes = () => {
      layoutEntries.forEach(([blockKey, dimensions]) => {
        if (dimensions?.selector) {
          try {
            const el = document.querySelector(dimensions.selector);
            if (el && !el.getAttribute('data-block-id')) {
              el.setAttribute('data-block-id', blockKey);
            }
          } catch {
            // Ignore invalid selector queries
          }
        }
      });
    };

    syncAttributes();
    const observer = new MutationObserver(syncAttributes);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [customUiLayout]);

  return null;
}
