import React, { useEffect, useState } from 'react';
import { CalendarClock, ClipboardPaste, Link2, Plus, Save, Share2, Trash2, X } from 'lucide-react';
import {
  AppState,
  EXAM_IDS,
  EXAM_META,
  ExamId,
  IPMAT_TRACK_META,
  IPMAT_TRACKS,
  IpmatTrack,
  SectionGoalKey,
  Topic,
} from '../types';

interface TopicFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  defaultExam: ExamId;
  defaultIpmatTrack: IpmatTrack;
  initialTopic: Topic | null;
  existingSubjects: string[];
  onClose: () => void;
  onSave: (data: {
    exam: ExamId;
    subExam?: IpmatTrack;
    subject: string;
    unit: string;
    name: string;
    inTarget: boolean;
    synergy: ExamId[];
  }) => void;
}

export const TopicFormModal: React.FC<TopicFormModalProps> = ({
  isOpen,
  mode,
  defaultExam,
  defaultIpmatTrack,
  initialTopic,
  existingSubjects,
  onClose,
  onSave,
}) => {
  const [exam, setExam] = useState<ExamId>(defaultExam);
  const [subExam, setSubExam] = useState<IpmatTrack>(defaultIpmatTrack);
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [name, setName] = useState('');
  const [inTarget, setInTarget] = useState(false);
  const [synergy, setSynergy] = useState<ExamId[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialTopic) {
      setExam(initialTopic.exam);
      setSubExam(initialTopic.subExam || defaultIpmatTrack);
      setSubject(initialTopic.subject);
      setUnit(initialTopic.unit);
      setName(initialTopic.name);
      setInTarget(initialTopic.inTarget);
      setSynergy(initialTopic.synergy);
    } else {
      setExam(defaultExam);
      setSubExam(defaultIpmatTrack);
      setSubject('');
      setUnit('');
      setName('');
      setInTarget(false);
      setSynergy([]);
    }
    setError('');
  }, [isOpen, mode, initialTopic, defaultExam, defaultIpmatTrack]);

  if (!isOpen) return null;

  const toggleSynergy = (targetExam: ExamId) => {
    if (targetExam === exam) return;
    setSynergy((prev) =>
      prev.includes(targetExam)
        ? prev.filter((e) => e !== targetExam)
        : [...prev, targetExam]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a topic name.');
      return;
    }
    onSave({
      exam,
      ...(exam === 'IPMAT' ? { subExam } : {}),
      subject: subject.trim() || 'General',
      unit: unit.trim() || 'Core Unit',
      name: name.trim(),
      inTarget,
      synergy: synergy.filter((s) => s !== exam),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2420]/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topic-modal-title"
    >
      <div className="neu-surface rounded-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 id="topic-modal-title" className="font-display font-bold text-lg text-[#1E2420]">
            {mode === 'add' ? 'Add Syllabus Topic' : 'Edit / Replace Topic'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="neu-btn w-8 h-8 rounded-full flex items-center justify-center text-[#5A625C] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#5A625C]">
              Exam Section
            </label>
            <div className="neu-well rounded-full p-1 grid grid-cols-3 gap-1">
              {EXAM_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setExam(id);
                    setSynergy((prev) => prev.filter((s) => s !== id));
                  }}
                  className={`py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                    exam === id
                      ? 'neu-mint'
                      : 'text-[#5A625C] hover:text-[#1E2420]'
                  }`}
                >
                  {EXAM_META[id].shortLabel}
                </button>
              ))}
            </div>
          </div>

          {exam === 'IPMAT' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#5A625C]">
                IPMAT &amp; JIPMAT Sub-Section
              </label>
              <div className="neu-well rounded-full p-1 grid grid-cols-3 gap-1">
                {IPMAT_TRACKS.map((trackId) => (
                  <button
                    key={trackId}
                    type="button"
                    onClick={() => setSubExam(trackId)}
                    className={`py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                      subExam === trackId
                        ? 'neu-mint'
                        : 'text-[#5A625C] hover:text-[#1E2420]'
                    }`}
                  >
                    {IPMAT_TRACK_META[trackId].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="topic-subject" className="block text-xs font-semibold text-[#5A625C]">
                Subject
              </label>
              <input
                id="topic-subject"
                type="text"
                list="subject-suggestions"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics I"
                className="neu-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
              <datalist id="subject-suggestions">
                {existingSubjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="topic-unit" className="block text-xs font-semibold text-[#5A625C]">
                Unit / Module
              </label>
              <input
                id="topic-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Week 2 · Matrices"
                className="neu-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="topic-name" className="block text-xs font-semibold text-[#5A625C]">
              Topic Name
            </label>
            <input
              id="topic-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Conditional Probability & Bayes Theorem"
              className="neu-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              autoFocus
            />
          </div>

          {/* Synergy Exams */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-[#5A625C]">
              Synergy Tag (also counts toward shared exams)
            </span>
            <div className="flex flex-wrap gap-2">
              {EXAM_IDS.filter((id) => id !== exam).map((id) => {
                const active = synergy.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleSynergy(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                      active ? 'neu-mint' : 'neu-btn text-[#5A625C]'
                    }`}
                  >
                    <Share2 className="w-3 h-3" />
                    <span>+ {EXAM_META[id].shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Sprint Toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={inTarget}
              onChange={(e) => setInTarget(e.target.checked)}
              className="w-4 h-4 accent-[#2F855A] rounded cursor-pointer"
            />
            <span className="text-sm text-[#1E2420] font-medium">
              Add immediately to Active Sprint Target queue
            </span>
          </label>

          {error && (
            <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="neu-btn rounded-xl px-4 py-2 text-xs font-semibold text-[#5A625C] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="neu-mint rounded-xl px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {mode === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{mode === 'add' ? 'Add Topic' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface DaysGoalModalTarget {
  scope: 'OVERALL' | SectionGoalKey;
  label: string;
  remainingTopics: number;
  currentDays: number | null;
}

interface SyllabusDaysModalProps {
  target: DaysGoalModalTarget | null;
  onClose: () => void;
  onSaveDays: (scope: 'OVERALL' | SectionGoalKey, days: number | null) => void;
}

export const SyllabusDaysModal: React.FC<SyllabusDaysModalProps> = ({
  target,
  onClose,
  onSaveDays,
}) => {
  const [daysStr, setDaysStr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (target) {
      setDaysStr(target.currentDays ? String(target.currentDays) : '');
      setError('');
    }
  }, [target]);

  if (!target) return null;

  const parsedDays = parseInt(daysStr, 10);
  const isValidNumber = !Number.isNaN(parsedDays) && parsedDays >= 1;
  const pacePreview =
    isValidNumber && target.remainingTopics > 0
      ? (target.remainingTopics / parsedDays).toFixed(1)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber || parsedDays > 1000) {
      setError('Please enter a valid number of days (1 to 1000).');
      return;
    }
    onSaveDays(target.scope, parsedDays);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2420]/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="days-modal-title"
    >
      <div className="neu-surface rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl neu-mint flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 text-[#153226]" />
            </div>
            <div>
              <h2 id="days-modal-title" className="font-display font-bold text-lg text-[#1E2420]">
                {target.currentDays ? 'Edit Completion Days' : 'Set Completion Days'}
              </h2>
              <p className="text-xs text-[#5A625C]">{target.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-btn w-8 h-8 rounded-full flex items-center justify-center text-[#5A625C] cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="syllabus-days-input" className="block text-xs font-semibold text-[#5A625C]">
              Target Days to Complete Syllabus ({target.remainingTopics} topics remaining)
            </label>
            <input
              id="syllabus-days-input"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={daysStr}
              onChange={(e) => {
                setDaysStr(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. 45"
              className="neu-input w-full rounded-xl px-4 py-2.5 text-base font-mono tabular-nums font-bold"
              autoFocus
            />
          </div>

          {/* Quick Day Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-[#5A625C]">Quick fill:</span>
            {[15, 30, 45, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDaysStr(String(d));
                  setError('');
                }}
                className="neu-btn rounded-full px-3 py-1 text-xs font-mono tabular-nums font-semibold text-[#1E2420] cursor-pointer"
              >
                {d}d
              </button>
            ))}
          </div>

          {pacePreview && (
            <div className="neu-well-sm rounded-xl px-3.5 py-2.5 text-xs text-[#1E2420] font-mono tabular-nums">
              Estimated pace: <span className="font-bold text-[#153226]">~{pacePreview} topics/day</span> for {parsedDays} days
            </div>
          )}

          {error && <p className="text-xs font-medium text-[#B91C1C]">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {target.currentDays !== null && (
                <button
                  type="button"
                  onClick={() => onSaveDays(target.scope, null)}
                  className="neu-btn rounded-xl px-3 py-2 text-xs font-semibold text-[#B91C1C] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="neu-btn rounded-xl px-4 py-2 text-xs font-semibold text-[#5A625C] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="neu-mint rounded-xl px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{target.currentDays ? 'Update Days' : 'Save Days'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DriveLinkModalProps {
  topic: Topic | null;
  onClose: () => void;
  onAddLink: (topicId: string, label: string, url: string) => void;
}

export const DriveLinkModal: React.FC<DriveLinkModalProps> = ({
  topic,
  onClose,
  onAddLink,
}) => {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [pasteNotice, setPasteNotice] = useState('');

  useEffect(() => {
    if (topic) {
      setLabel('');
      setUrl('');
      setError('');
      setPasteNotice('');
    }
  }, [topic]);

  if (!topic) return null;

  const handlePaste = async () => {
    setPasteNotice('');
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setPasteNotice('Clipboard API unavailable — paste manually with Ctrl+V.');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        setError('');
      } else {
        setPasteNotice('Clipboard is empty.');
      }
    } catch {
      setPasteNotice('Clipboard permission blocked — press Ctrl+V in the URL field.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter or paste a Google Drive URL.');
      return;
    }
    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    onAddLink(
      topic.id,
      label.trim() || 'Drive PDF Notes',
      normalizedUrl
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2420]/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-modal-title"
    >
      <div className="neu-surface rounded-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="drive-modal-title" className="font-display font-bold text-lg text-[#1E2420]">
              Add Google Drive Resource
            </h2>
            <p className="text-xs text-[#5A625C] mt-0.5 line-clamp-1">
              {topic.subject} · {topic.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-btn w-8 h-8 rounded-full flex items-center justify-center text-[#5A625C] cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="drive-label" className="block text-xs font-semibold text-[#5A625C]">
              Resource Label
            </label>
            <input
              id="drive-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Week 1 Lecture Notes PDF"
              className="neu-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="drive-url" className="block text-xs font-semibold text-[#5A625C]">
              Google Drive URL
            </label>
            <div className="flex items-center gap-2">
              <input
                id="drive-url"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError('');
                }}
                placeholder="https://drive.google.com/file/d/..."
                className="neu-input flex-1 rounded-xl px-3.5 py-2.5 text-sm font-mono"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="neu-btn rounded-xl px-3 py-2.5 text-xs font-semibold text-[#1E2420] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="1-click paste URL from clipboard"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-[#153226]" />
                <span>Paste</span>
              </button>
            </div>
            {pasteNotice && (
              <p className="text-[11px] text-[#5A625C]">{pasteNotice}</p>
            )}
          </div>

          {error && (
            <p className="text-xs font-medium text-[#B91C1C]">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="neu-btn rounded-xl px-4 py-2 text-xs font-semibold text-[#5A625C] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="neu-mint rounded-xl px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Save Drive Link</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SynergyModalProps {
  topic: Topic | null;
  onClose: () => void;
  onSaveSynergy: (topicId: string, synergy: ExamId[]) => void;
}

export const SynergyModal: React.FC<SynergyModalProps> = ({
  topic,
  onClose,
  onSaveSynergy,
}) => {
  const [selected, setSelected] = useState<ExamId[]>([]);

  useEffect(() => {
    if (topic) {
      setSelected(topic.synergy);
    }
  }, [topic]);

  if (!topic) return null;

  const toggle = (examId: ExamId) => {
    setSelected((prev) =>
      prev.includes(examId)
        ? prev.filter((x) => x !== examId)
        : [...prev, examId]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2420]/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="synergy-modal-title"
    >
      <div className="neu-surface rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="synergy-modal-title" className="font-display font-bold text-lg text-[#1E2420]">
              Cross-Exam Synergy Tag
            </h2>
            <p className="text-xs text-[#5A625C] mt-0.5">
              {topic.name} (Home: {EXAM_META[topic.exam].shortLabel})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-btn w-8 h-8 rounded-full flex items-center justify-center text-[#5A625C] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#5A625C] leading-relaxed">
          Select other exams this topic overlaps with. Completing it will update progress percentages in both its home section and tagged synergy sections.
        </p>

        <div className="flex flex-wrap gap-2.5">
          {EXAM_IDS.filter((id) => id !== topic.exam).map((id) => {
            const active = selected.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={`rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                  active ? 'neu-mint' : 'neu-btn text-[#1E2420]'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Counts toward {EXAM_META[id].label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="neu-btn rounded-xl px-4 py-2 text-xs font-semibold text-[#5A625C] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSaveSynergy(topic.id, selected)}
            className="neu-mint rounded-xl px-5 py-2 text-xs font-bold cursor-pointer"
          >
            Apply Synergy
          </button>
        </div>
      </div>
    </div>
  );
};

interface RestoreConfirmModalProps {
  pendingBackup: AppState | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  pendingBackup,
  onCancel,
  onConfirm,
}) => {
  if (!pendingBackup) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2420]/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-modal-title"
    >
      <div className="neu-surface rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="restore-modal-title" className="font-display font-bold text-lg text-[#1E2420]">
            Restore JSON Backup
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="neu-btn w-8 h-8 rounded-full flex items-center justify-center text-[#5A625C] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#5A625C] leading-relaxed">
          This backup will replace your current workspace state with the following saved items:
        </p>

        <div className="neu-well rounded-xl p-3.5 grid grid-cols-2 gap-2 text-xs font-mono tabular-nums text-[#1E2420]">
          <div>Topics: {pendingBackup.topics.length}</div>
          <div>Focus Logs: {pendingBackup.focusLogs.length}</div>
          <div>Mock Tests: {pendingBackup.mockTests.length}</div>
          <div>Vault Notes: {pendingBackup.vaultNotes.length}</div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="neu-btn rounded-xl px-4 py-2 text-xs font-semibold text-[#5A625C] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="neu-mint rounded-xl px-5 py-2 text-xs font-bold cursor-pointer"
          >
            Confirm Restore
          </button>
        </div>
      </div>
    </div>
  );
};
