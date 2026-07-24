import { FileText, Image as ImageIcon, ExternalLink, Download } from 'lucide-react';

export function FileGrid({
  imageFiles,
  imageUrls,
  otherFiles,
  onPreview,
  onDownload,
  maxHeightPx = 380,
}: {
  imageFiles: { id: string; file_name: string }[];
  imageUrls: string[];
  otherFiles: { id: string; file_name: string }[];
  onPreview?: (url: string, name: string) => void;
  onDownload?: (id: string, name: string) => void;
  /** Cap the internal scroll area's height — smaller when nesting this grid
   *  inside an already-long panel (e.g. the job detail modal's Compare tab). */
  maxHeightPx?: number;
}) {
  if (imageFiles.length === 0 && otherFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center bg-black/5 dark:bg-white/5 rounded-xl border border-dashed border-border/50">
        <ImageIcon className="w-8 h-8 text-text-faint mb-2" strokeWidth={1.5} />
        <span className="text-[12px] text-text-muted">No files uploaded yet.</span>
      </div>
    );
  }
  return (
    <div
      className="space-y-5 overflow-y-auto custom-scrollbar pr-2 -mr-2 pb-2"
      style={{ maxHeight: maxHeightPx }}
    >
      {imageFiles.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {imageFiles.map((f, i) => (
            <div
              key={f.id}
              className="group relative rounded-xl overflow-hidden border border-border/60 bg-black/5 dark:bg-white/5 transition-all duration-300 shadow-sm hover:shadow-md aspect-[4/3] block"
            >
              {imageUrls[i] ? (
                <>
                  <img src={imageUrls[i]} alt={f.file_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer" loading="lazy" onClick={() => onPreview?.(imageUrls[i], f.file_name)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 pointer-events-none">
                    <span className="text-white text-[11px] font-medium truncate w-full mb-1">{f.file_name}</span>
                    <div className="flex items-center justify-between w-full">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-white/80 hover:text-white text-[10px] pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); onPreview?.(imageUrls[i], f.file_name); }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        className="flex items-center justify-center p-1.5 rounded-md bg-white/20 hover:bg-white/40 text-white transition-colors pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); onDownload?.(f.id, f.file_name); }}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <ImageIcon className="w-6 h-6 text-text-faint mb-2" aria-hidden />
                  <span className="text-text-faint text-[10px] text-center truncate w-full">{f.file_name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
      
      {otherFiles.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2">
          {otherFiles.map((f) => (
            <li key={f.id} className="group flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/60 bg-white/50 dark:bg-[#15233c]/50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded bg-crimson/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-crimson" aria-hidden />
                </div>
                <span className="truncate text-[12px] font-medium text-text-main">{f.file_name}</span>
              </div>
              <button
                type="button"
                className="shrink-0 p-1.5 rounded-md text-text-muted hover:text-crimson hover:bg-crimson/10 transition-colors"
                onClick={() => onDownload?.(f.id, f.file_name)}
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
