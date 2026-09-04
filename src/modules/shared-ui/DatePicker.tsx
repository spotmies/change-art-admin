import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

export interface DatePickerProps {
  /** ISO date string, e.g. "1990-05-20" (matches native input[type=date] value) */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Furthest future date selectable. Omit to allow any future date (e.g. a joining date). */
  maxDate?: Date;
  /** Override the trigger button's own classes (default: the shared `.fi` field style) */
  triggerClassName?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  disabled,
  maxDate,
  triggerClassName,
}: DatePickerProps) {
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [value]);

  const today = new Date();
  const defaultCursor = selectedDate ?? maxDate ?? today;
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [cursor, setCursor] = useState(defaultCursor);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCursor(selectedDate ?? maxDate ?? today);
      setView('days');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const daysInGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const years = useMemo(() => {
    const centerYear = (maxDate ?? today).getFullYear();
    const topYear = maxDate ? centerYear : centerYear + 20;
    const bottomYear = centerYear - 99;
    const list: number[] = [];
    for (let y = topYear; y >= bottomYear; y--) list.push(y);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDate]);

  const selectDay = (day: Date) => {
    if (maxDate && day > maxDate) return;
    onChange(format(day, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between w-full disabled:opacity-60 disabled:cursor-not-allowed ${
          triggerClassName ?? 'fi'
        }`}
        style={{ textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span style={{ color: selectedDate ? 'var(--text-main)' : 'var(--text-muted)' }}>
          {selectedDate ? format(selectedDate, 'dd-MM-yyyy') : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selectedDate && !disabled && (
            <X
              className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            />
          )}
          <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[5px] shadow-xl z-50 overflow-hidden font-sans text-xs"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => setView((v) => (v === 'days' ? 'months' : 'days'))}
              className="flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors"
            >
              {format(cursor, 'MMMM yyyy')}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {/* Days view */}
          {view === 'days' && (
            <div className="p-2">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {daysInGrid.map((day) => {
                  const inMonth = isSameMonth(day, cursor);
                  const selected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDay = isToday(day);
                  const disabledDay = !!maxDate && day > maxDate;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={disabledDay}
                      onClick={() => selectDay(day)}
                      className={[
                        'w-7 h-7 mx-auto flex items-center justify-center rounded-full text-[11px] transition-colors',
                        disabledDay
                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                          : selected
                            ? 'bg-[#2563eb] text-white font-semibold'
                            : isTodayDay
                              ? 'text-[#2563eb] font-semibold ring-1 ring-[#2563eb]/40 hover:bg-blue-50 dark:hover:bg-slate-800'
                              : inMonth
                                ? 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800'
                                : 'text-slate-300 dark:text-slate-600 hover:bg-blue-50/60 dark:hover:bg-slate-800/60',
                      ].join(' ')}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Month picker view */}
          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1 p-2 max-h-56 overflow-y-auto custom-scrollbar">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCursor((c) => new Date(c.getFullYear(), i, 1));
                    setView('years');
                  }}
                  className={`py-1.5 rounded text-[11px] transition-colors ${
                    i === cursor.getMonth()
                      ? 'bg-blue-50/80 dark:bg-slate-800 text-[#2563eb] font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {/* Year picker view */}
          {view === 'years' && (
            <div className="grid grid-cols-4 gap-1 p-2 max-h-56 overflow-y-auto custom-scrollbar">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setCursor((c) => new Date(y, c.getMonth(), 1));
                    setView('days');
                  }}
                  className={`py-1.5 rounded text-[11px] transition-colors ${
                    y === cursor.getFullYear()
                      ? 'bg-blue-50/80 dark:bg-slate-800 text-[#2563eb] font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => selectDay(today)}
              className="text-[10px] font-semibold text-[#2563eb] hover:text-[#1d4ed8] transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
