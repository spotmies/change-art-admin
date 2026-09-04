import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { ALL_COUNTRY_CODES } from './country-codes';

export interface CountryPickerProps {
  value: string;
  onChange: (code: string) => void;
}

export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = useMemo(
    () => ALL_COUNTRY_CODES.find((c) => c.code === value) ?? ALL_COUNTRY_CODES[0],
    [value],
  );

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return ALL_COUNTRY_CODES;
    const q = search.toLowerCase().trim();
    return ALL_COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        c.country.toLowerCase().includes(q),
    );
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Segment 1 Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border-r border-slate-200 dark:border-slate-700 px-2.5 py-1.5 shrink-0 select-none cursor-pointer transition-colors"
        aria-expanded={isOpen}
      >
        <img
          src={`https://flagcdn.com/w40/${selectedCountry.country.toLowerCase()}.png`}
          alt={selectedCountry.name}
          className="w-5 h-3.5 object-cover rounded-[2px] border border-slate-200/80 mr-1.5 shrink-0"
        />
        <ChevronDown
          className="w-3 h-3 text-slate-500 transition-transform duration-150"
          style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[5px] shadow-xl z-50 overflow-hidden font-sans text-xs">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Country List */}
          <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
            {filteredCountries.length === 0 ? (
              <div className="px-3 py-3 text-center text-slate-400 text-xs">No countries found</div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === value && c.country === selectedCountry.country;
                return (
                  <button
                    key={c.country + c.code}
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-slate-800 text-[#2563eb] font-semibold'
                        : 'text-slate-700 dark:text-slate-200 font-normal'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={`https://flagcdn.com/w40/${c.country.toLowerCase()}.png`}
                        alt={c.name}
                        className="w-4 h-3 object-cover rounded-[2px] border border-slate-200/60 shrink-0"
                      />
                      <span className="truncate text-xs">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[11px] text-slate-400 font-mono">{c.code}</span>
                      {isSelected ? <Check className="w-3.5 h-3.5 text-[#2563eb]" /> : null}
                    </div>
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
