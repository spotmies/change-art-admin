import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { IShift } from '@contracts';
import { formatShiftTime } from '@lib/utils';
import {
  useCreateShift,
  useDeleteShift,
  useShifts,
  useUpdateShift,
} from '../hooks/use-shifts';

const NAME_MAX = 50;

interface ShiftFormValues {
  name: string;
  start_time: string;
  end_time: string;
}

function ShiftForm({
  initial,
  submitting,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: ShiftFormValues;
  submitting: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: ShiftFormValues) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [startTime, setStartTime] = useState(initial.start_time);
  const [endTime, setEndTime] = useState(initial.end_time);

  const canSubmit = name.trim().length > 0 && startTime !== '' && endTime !== '' && startTime !== endTime;

  return (
    <form
      className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:items-end p-3 rounded-lg bg-slate-50 border border-slate-200"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ name: name.trim(), start_time: startTime, end_time: endTime });
      }}
    >
      <div>
        <label className="block text-[10.5px] font-bold text-slate-500 uppercase mb-1">Shift Name</label>
        <input
          autoFocus
          type="text"
          className="w-full h-9 px-2.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          placeholder="e.g. Morning"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-[10.5px] font-bold text-slate-500 uppercase mb-1">From</label>
        <input
          type="time"
          required
          className="h-9 px-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-[10.5px] font-bold text-slate-500 uppercase mb-1">To</label>
        <input
          type="time"
          required
          className="h-9 px-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
      </div>
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="h-9 px-3 rounded-md border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
      {startTime !== '' && endTime !== '' && startTime === endTime && (
        <p className="sm:col-span-4 text-[11px] text-rose-600 font-medium">Start and end time cannot be the same.</p>
      )}
    </form>
  );
}

export function ShiftsManagerModal({ onClose }: { onClose: () => void }) {
  const { data: shifts, isLoading, isError } = useShifts();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IShift | null>(null);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage shifts"
        className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" aria-hidden />
              Manage Shifts
            </h2>
            <p className="text-[11.5px] text-slate-500 font-medium mt-0.5">
              These shifts appear in the Shift dropdown when creating or editing a user.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-xs font-medium">
              Loading shifts…
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-10 text-rose-600 text-xs font-medium">
              Failed to load shifts. Please try again.
            </div>
          ) : shifts && shifts.length > 0 ? (
            shifts.map((shift) =>
              editingId === shift.id ? (
                <ShiftForm
                  key={shift.id}
                  initial={{ name: shift.name, start_time: shift.start_time, end_time: shift.end_time }}
                  submitting={updateShift.isPending}
                  submitLabel="Save"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(values) =>
                    updateShift.mutate(
                      { id: shift.id, payload: values },
                      { onSuccess: () => setEditingId(null) },
                    )
                  }
                />
              ) : (
                <div
                  key={shift.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">{shift.name}</div>
                    <div className="text-[11.5px] text-slate-500 font-medium">
                      {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setEditingId(shift.id); setAdding(false); }}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                      title="Edit shift"
                      aria-label={`Edit ${shift.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(shift)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                      title="Delete shift"
                      aria-label={`Delete ${shift.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ),
            )
          ) : (
            <div className="py-10 text-center text-slate-400 text-xs font-medium">
              No shifts yet — add the first one below.
            </div>
          )}

          {adding && (
            <ShiftForm
              initial={{ name: '', start_time: '', end_time: '' }}
              submitting={createShift.isPending}
              submitLabel="Add"
              onCancel={() => setAdding(false)}
              onSubmit={(values) =>
                createShift.mutate(values, { onSuccess: () => setAdding(false) })
              }
            />
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 shrink-0">
          {!adding && (
            <button
              type="button"
              onClick={() => { setAdding(true); setEditingId(null); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Shift
            </button>
          )}
        </div>
      </div>

      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !deleteShift.isPending) setDeleteTarget(null); }}
            role="presentation"
          >
            <div role="dialog" aria-modal="true" className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Delete &quot;{deleteTarget.name}&quot;?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Staff currently assigned this shift keep the label on their profile, but it will no longer
                appear as a selectable option.
              </p>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteShift.isPending}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteShift.isPending}
                  onClick={() => {
                    deleteShift.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                  }}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {deleteShift.isPending ? 'Deleting…' : 'Delete Shift'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>,
    document.body,
  );
}
