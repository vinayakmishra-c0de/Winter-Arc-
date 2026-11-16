import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Cloud,
  Download,
  Flame,
  LineChart,
  LogOut,
  NotebookPen,
  Upload,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { EXAM_IDS, EXAM_META, ExamId, Topic } from '../types';

export type ActiveWorkspace = 'syllabus' | 'mocks';

interface MasterGoalHeaderProps {
  topics: Topic[];
  overallTargetDays: number | null;
  overallStartDate: string | null;
  onSetOverallDuration: (days: number | null) => void;
  activeWorkspace: ActiveWorkspace;
  onChangeWorkspace: (ws: ActiveWorkspace) => void;
  activeExam: ExamId;
  onSelectExamFromPill: (exam: ExamId) => void;
  vaultCount: number;
  onOpenVault: () => void;
  onExportJson: () => void;
  onSelectRestoreFile: (file: File) => void;
  user: User;
  onSignOut: () => void;
}

export const MasterGoalHeader: React.FC<MasterGoalHeaderProps> = ({
  topics,
  overallTargetDays,
  onSetOverallDuration,
  activeWorkspace,
  onChangeWorkspace,
  activeExam,
  onSelectExamFromPill,
  vaultCount,
  onOpenVault,
  onExportJson,
  onSelectRestoreFile,
  user,
  onSignOut,
}) => {
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [durationInput, setDurationInput] = useState<string>(
    overallTargetDays ? String(overallTargetDays) : ''
  );

  useEffect(() => {
    setDurationInput(overallTargetDays ? String(overallTargetDays) : '');
  }, [overallTargetDays]);

  // Overall progress counts unique topics so denominators stay exact
  const totalUnique = topics.length;
  const completedUnique = topics.filter((t) => t.completed).length;
  const remainingUnique = totalUnique - completedUnique;
  const overallPercent =
    totalUnique > 0 ? Math.round((completedUnique / totalUnique) * 100) : 0;

  // Active Sprint (manual user-targeted topics)
  const sprintTopics = topics.filter((t) => t.inTarget);
  const sprintCompleted = sprintTopics.filter((t) => t.completed).length;
  const sprintTotal = sprintTopics.length;
  const sprintPercent =
    sprintTotal > 0 ? Math.round((sprintCompleted / sprintTotal) * 100) : 0;

  // Section-wise progress (includes home topics + synergy-tagged topics)
  const sectionStats = EXAM_IDS.map((examId) => {
    const matching = topics.filter(
      (t) => t.exam === examId || t.synergy.includes(examId)
    );
    const done = matching.filter((t) => t.completed).length;
    const total = matching.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      examId,
      shortLabel: EXAM_META[examId].shortLabel,
      done,
      total,
      pct,
    };
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectRestoreFile(file);
    }
    e.target.value = '';
  };

  const parsedInput = parseInt(durationInput.trim(), 10);
  const isValidInput =
    durationInput.trim() !== '' &&
    !Number.isNaN(parsedInput) &&
    parsedInput >= 1 &&
    parsedInput <= 1000;
  const hasDurationChanged =
    isValidInput && parsedInput !== overallTargetDays;

  const handleDurationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!durationInput.trim()) {
      if (overallTargetDays !== null) {
        onSetOverallDuration(null);
      }
      return;
    }
    if (!isValidInput) return;
    onSetOverallDuration(parsedInput);
  };

  return (
    <header className="w-full space-y-5">
      {/* Top Bar Contract: Brand — Navigation — Utility Actions */}
      <div className="neu-surface rounded-2xl px-4 py-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-4">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-9 h-9 rounded-xl neu-mint flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#153226]"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <span className="font-[Georgia] font-bold text-lg sm:text-xl tracking-tight text-[#1E2420] whitespace-nowrap shrink-0">
            Winter Arc Command Center
          </span>
        </div>

        {/* Zone 2: Segmented Navigation Controls */}
        <nav
          aria-label="Workspace views"
          className="neu-well rounded-full p-1 flex items-center gap-1"
        >
          <button
            type="button"
            onClick={() => onChangeWorkspace('syllabus')}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
              activeWorkspace === 'syllabus'
                ? 'neu-mint font-semibold'
                : 'text-[#5A625C] hover:text-[#1E2420]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Syllabus Engine</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeWorkspace('mocks')}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
              activeWorkspace === 'mocks'
                ? 'neu-mint font-semibold'
                : 'text-[#5A625C] hover:text-[#1E2420]'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Mock Analytics</span>
          </button>
          <button
            type="button"
            onClick={onOpenVault}
            className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer text-[#5A625C] hover:text-[#1E2420] transition-colors"
          >
            <NotebookPen className="w-3.5 h-3.5" />
            <span>Formula Vault</span>
            <span className="font-mono tabular-nums text-[11px] opacity-80">
              ({vaultCount})
            </span>
          </button>
        </nav>

        {/* Zone 3: Cloud Sync & Backup Utility Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="neu-well-sm rounded-xl px-2.5 py-1.5 flex items-center gap-2 shrink-0">
            <Cloud className="w-3.5 h-3.5 text-[#153226]" />
            <span
              className="text-xs font-semibold text-[#1E2420] max-w-[150px] truncate"
              title={user.email || 'Synced Account'}
            >
              {user.email || 'Cloud Sync'}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="neu-btn rounded-lg px-2 py-1 text-[11px] font-semibold text-[#5A625C] hover:text-[#1E2420] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onExportJson}
            className="neu-btn rounded-xl px-3 py-2 text-xs font-semibold text-[#1E2420] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Download full JSON backup of all topics, links, focus logs, mocks, and notes"
          >
            <Download className="w-3.5 h-3.5 text-[#153226]" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="neu-btn rounded-xl px-3 py-2 text-xs font-semibold text-[#1E2420] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Restore state from a previously exported JSON backup"
          >
            <Upload className="w-3.5 h-3.5 text-[#153226]" />
            <span>Restore JSON</span>
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Restore JSON Backup File"
          />
        </div>
      </div>

      {/* Master Goal Proximity Card */}
      <section
        aria-label="Master Goal Proximity"
        className="neu-surface rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Left: Overall % + Days Remaining Counter + Active Sprint + Study Goal Duration Input */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono tabular-nums text-3xl sm:text-4xl font-bold tracking-tight text-[#153226]">
                  {overallPercent}%
                </span>
                <div>
                  <h1 className="font-display font-bold text-sm sm:text-base text-[#1E2420]">
                    Master Goal Proximity
                  </h1>
                  <p className="text-xs sm:text-sm text-[#5A625C] font-mono tabular-nums">
                    {completedUnique} completed · {remainingUnique} remaining · {totalUnique} total
                  </p>
                </div>
              </div>
            </div>

            <div className="h-9 w-px bg-[#D7D7D0] hidden sm:block" aria-hidden="true" />

            {/* Active Sprint Progress Counter */}
            <div className="neu-well-sm rounded-xl px-3.5 py-2 flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-[#C25E24] shrink-0" />
              <div className="text-xs">
                <div className="text-[#5A625C] font-medium">Active Sprint</div>
                <div className="font-mono tabular-nums font-bold text-[#1E2420]">
                  {sprintCompleted} / {sprintTotal} targets ({sprintPercent}%)
                </div>
              </div>
            </div>

            {/* Study Goal Duration Inline Input */}
            <form
              onSubmit={handleDurationSubmit}
              className="neu-well-sm rounded-xl px-3 py-1.5 flex items-center gap-2"
            >
              <label
                htmlFor="study-goal-duration"
                className="text-xs font-medium text-[#5A625C] whitespace-nowrap shrink-0"
              >
                Study Goal Duration
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="study-goal-duration"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="Days"
                  aria-label="Study Goal Duration in days"
                  className="neu-well w-16 rounded-lg px-2 py-1 text-xs font-mono tabular-nums font-bold text-[#1E2420] focus:outline-none focus:ring-2 focus:ring-[#9DE0C5]"
                />
                <span className="text-[11px] font-medium text-[#5A625C] whitespace-nowrap">
                  days
                </span>
                <button
                  type="submit"
                  disabled={!isValidInput || (!hasDurationChanged && overallTargetDays !== null)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all ${
                    isValidInput && (hasDurationChanged || overallTargetDays === null)
                      ? 'neu-mint cursor-pointer'
                      : 'neu-btn text-[#7C847D] opacity-60 cursor-not-allowed'
                  }`}
                  title="Save Study Goal Duration"
                >
                  <Check className="w-3 h-3" />
                  <span>{overallTargetDays ? 'Update' : 'Set'}</span>
                </button>
                {overallTargetDays !== null && (
                  <button
                    type="button"
                    onClick={() => onSetOverallDuration(null)}
                    className="neu-btn rounded-lg p-1 text-[#5A625C] hover:text-[#B91C1C] cursor-pointer shrink-0"
                    title="Clear Study Goal Duration"
                    aria-label="Clear Study Goal Duration"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right: Section-Wise Completion Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            {sectionStats.map((sec) => {
              const isSelected = activeWorkspace === 'syllabus' && activeExam === sec.examId;
              return (
                <button
                  key={sec.examId}
                  type="button"
                  onClick={() => onSelectExamFromPill(sec.examId)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                    isSelected
                      ? 'neu-mint'
                      : 'neu-btn text-[#1E2420]'
                  }`}
                  title={`Jump to ${sec.shortLabel} syllabus (${sec.done} of ${sec.total} completed, including synergy topics)`}
                >
                  <span>{sec.shortLabel}</span>
                  <span className="font-mono tabular-nums font-bold">
                    {sec.pct}%
                  </span>
                  <span className="font-mono tabular-nums text-[11px] opacity-75">
                    {sec.done}/{sec.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recessed Horizontal Progress Bar with Smooth Mint Fill */}
        <div className="space-y-1.5">
          <div
            className="neu-well h-4 w-full rounded-full p-1 overflow-hidden"
            role="progressbar"
            aria-valuenow={overallPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall syllabus completion"
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${overallPercent}%`,
                minWidth: overallPercent > 0 ? '12px' : '0px',
                background: 'linear-gradient(90deg, #B8EED8 0%, #9DE0C5 100%)',
                boxShadow:
                  overallPercent > 0
                    ? '0 0 12px rgba(142, 227, 195, 0.7)'
                    : 'none',
              }}
            />
          </div>
        </div>
      </section>
    </header>
  );
};
