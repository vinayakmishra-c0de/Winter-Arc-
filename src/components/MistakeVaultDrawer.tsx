import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  NotebookPen,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { EXAM_IDS, ExamId, VaultNote } from '../types';

interface MistakeVaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notes: VaultNote[];
  onAddNote: (title: string, content: string, tags: ExamId[]) => void;
  onToggleReviewed: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCopyNote: (text: string) => void;
}

export const MistakeVaultDrawer: React.FC<MistakeVaultDrawerProps> = ({
  isOpen,
  onClose,
  notes,
  onAddNote,
  onToggleReviewed,
  onDeleteNote,
  onCopyNote,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<ExamId[]>(['IITM']);
  const [filterTag, setFilterTag] = useState<'ALL' | ExamId>('ALL');
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const toggleFormTag = (tag: ExamId) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.length > 1 ? prev.filter((t) => t !== tag) : prev;
      }
      return [...prev, tag];
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !title.trim()) {
      setError('Enter a formula, concept, or mistake takeaway.');
      return;
    }
    onAddNote(
      title.trim() || 'Quick Formula / Takeaway',
      content.trim() || title.trim(),
      selectedTags
    );
    setTitle('');
    setContent('');
    setError('');
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (filterTag !== 'ALL' && !n.tags.includes(filterTag)) return false;
        if (onlyUnreviewed && n.reviewed) return false;
        if (q) {
          const hay = `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [notes, filterTag, onlyUnreviewed, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#1E2420]/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-drawer-title"
    >
      {/* Backdrop click closes */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <div className="w-full max-w-xl h-full bg-[#EFEFEA] border-l border-white shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="neu-surface px-5 py-4 flex items-center justify-between gap-3 shrink-0 rounded-none border-x-0 border-t-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl neu-mint flex items-center justify-center">
              <NotebookPen className="w-4 h-4 text-[#153226]" />
            </div>
            <div>
              <h2 id="vault-drawer-title" className="font-display font-bold text-base text-[#1E2420]">
                Mistake & Formula Vault
              </h2>
              <p className="text-xs text-[#5A625C]">
                Quick-capture tricky formulas & wrong MCQ takeaways for Sunday revision
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="neu-btn w-8 h-8 rounded-full flex items-center justify-center text-[#5A625C] cursor-pointer shrink-0"
            aria-label="Close Formula Vault drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick-Capture Form */}
          <form onSubmit={handleSave} className="neu-surface rounded-2xl p-4 space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="Formula or Mistake Title (e.g. Remainder Theorem Edge Case)"
              className="neu-input w-full rounded-xl px-3.5 py-2 text-sm font-semibold"
            />
            <textarea
              rows={3}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError('');
              }}
              placeholder="Write the tricky formula, shortcut, or why you missed that MCQ..."
              className="neu-input w-full rounded-xl px-3.5 py-2.5 text-sm resize-y"
            />

            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5">
                {EXAM_IDS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleFormTag(tag)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-all ${
                        active ? 'neu-mint' : 'neu-btn text-[#5A625C]'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                className="neu-mint rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Capture Note</span>
              </button>
            </div>

            {error && (
              <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
            )}
          </form>

          {/* Sunday Revision Filter Bar */}
          <div className="space-y-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#7C847D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter vault notes by keyword or formula..."
                className="neu-input w-full rounded-xl pl-10 pr-4 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', ...EXAM_IDS] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterTag(t)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-all ${
                      filterTag === t ? 'neu-mint' : 'neu-btn text-[#5A625C]'
                    }`}
                  >
                    {t === 'ALL' ? 'All Tags' : `#${t}`}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-[#5A625C] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyUnreviewed}
                  onChange={(e) => setOnlyUnreviewed(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#2F855A] rounded cursor-pointer"
                />
                <span>Needs Sunday Review</span>
              </label>
            </div>
          </div>

          {/* Notes List */}
          {filteredNotes.length === 0 ? (
            <div className="neu-surface rounded-2xl p-8 text-center space-y-1.5">
              <p className="text-sm font-semibold text-[#1E2420]">
                No vault notes match this filter
              </p>
              <p className="text-xs text-[#5A625C]">
                Capture formulas and mock mistakes above to build your Sunday revision deck.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <article
                  key={note.id}
                  className={`neu-surface rounded-2xl p-4 space-y-2 transition-opacity ${
                    note.reviewed ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A625C] font-mono">
                        <span>{note.tags.map((t) => `#${t}`).join(' · ')}</span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-display font-bold text-sm text-[#1E2420]">
                        {note.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleReviewed(note.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                          note.reviewed ? 'neu-mint' : 'neu-btn text-[#5A625C]'
                        }`}
                        title="Toggle Sunday revision status"
                      >
                        <Check className="w-3 h-3" />
                        <span>{note.reviewed ? 'Reviewed' : 'Mark Done'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onCopyNote(`${note.title}\n${note.content}`)}
                        className="neu-btn rounded-lg p-1.5 text-[#5A625C] hover:text-[#1E2420] cursor-pointer"
                        title="Copy note"
                        aria-label={`Copy ${note.title}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="neu-btn rounded-lg p-1.5 text-[#5A625C] hover:text-[#B91C1C] cursor-pointer"
                        title="Delete note"
                        aria-label={`Delete ${note.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-[#1E2420] leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
