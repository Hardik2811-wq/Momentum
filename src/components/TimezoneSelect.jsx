import React, { useState, useRef, useEffect, useMemo } from 'react';

// Comprehensive list of standard IANA timezones with fallbacks
export const TIMEZONE_LIST = (() => {
  try {
    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // quiet fallback
  }
  return [
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
    'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota',
    'America/Chicago', 'America/Denver', 'America/Halifax', 'America/Los_Angeles',
    'America/Mexico_City', 'America/New_York', 'America/Phoenix', 'America/Santiago',
    'America/Sao_Paulo', 'America/Toronto', 'America/Vancouver',
    'Asia/Bangkok', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Jerusalem',
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Riyadh',
    'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tokyo',
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
    'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Dublin',
    'Europe/Helsinki', 'Europe/Lisbon', 'Europe/London', 'Europe/Madrid', 'Europe/Moscow',
    'Europe/Paris', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich',
    'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu', 'UTC'
  ];
})();

export function formatTimezoneDisplay(tz) {
  if (!tz) return '';
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const parts = formatter.formatToParts(now);
    const offset = parts.find(p => p.type === 'timeZoneName')?.value || '';
    const time = parts.filter(p => p.type !== 'timeZoneName').map(p => p.value).join('').trim();
    return `${tz} (${offset}${time ? ` · ${time}` : ''})`;
  } catch {
    return tz;
  }
}

export default function TimezoneSelect({ value, onChange, placeholder = 'Search or select timezone...', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  // Auto-detect system timezone default
  const detectedTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const currentTz = value || detectedTz;

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [isOpen]);

  const filteredTimezones = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TIMEZONE_LIST;
    return TIMEZONE_LIST.filter(tz => tz.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className="w-full px-3 py-2 rounded-xl text-[12px] bg-[#F5F4FA] hover:bg-[#EBEBF0] border border-black/[0.08] text-[#1A1B1F] flex items-center justify-between transition text-left"
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-[15px] text-[#0A84FF] shrink-0">public</span>
          <span className="truncate">{formatTimezoneDisplay(currentTz)}</span>
        </span>
        <span className="material-symbols-outlined text-[15px] text-[#8E8E93] shrink-0 ml-1">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-black/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.18)] p-2 space-y-1.5 animate-fadeIn">
          {/* Search Input */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-2.5 text-[15px] text-[#8E8E93]">search</span>
            <input
              type="text"
              autoFocus
              placeholder="Search city, country, or region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl text-[11px] bg-[#F5F4FA] border border-black/[0.06] outline-none focus:bg-white focus:border-[#0A84FF] transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 text-[#8E8E93] hover:text-[#1A1B1F] text-[13px]"
              >
                ×
              </button>
            )}
          </div>

          {/* Quick Action: Auto-detect / Reset to system */}
          <button
            type="button"
            onClick={() => {
              onChange(detectedTz);
              setIsOpen(false);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold text-[#0A84FF] hover:bg-blue-50/60 flex items-center justify-between transition"
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">my_location</span>
              <span>Auto-detect System ({detectedTz})</span>
            </span>
            {currentTz === detectedTz && <span className="material-symbols-outlined text-[13px]">check</span>}
          </button>

          <div className="border-t border-black/[0.05] my-1" />

          {/* Timezone List Scroll Area */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
            {filteredTimezones.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-[#8E8E93]">
                No matching timezone found.
              </div>
            ) : (
              filteredTimezones.map(tz => {
                const isSelected = currentTz === tz;
                return (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => {
                      onChange(tz);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-[#0A84FF] text-white font-semibold shadow-2xs'
                        : 'text-[#1A1B1F] hover:bg-[#F5F4FA]'
                    }`}
                  >
                    <span className="truncate">{formatTimezoneDisplay(tz)}</span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[13px] ml-1 shrink-0">check</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
