import React, { useRef } from 'react';
import {
  BookOpen,
  CalendarClock,
  Cloud,
  Download,
  Flame,
  LineChart,
  LogOut,
  NotebookPen,
  Pencil,
  Plus,
  Upload,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { EXAM_IDS, EXAM_META, ExamId, Topic } from '../types';

export type ActiveWorkspace = 'syllabus' | 'mocks';

interface MasterGoalHeaderProps {
  topics: Topic[];
  overallTargetDays: number | null;
  onOpenOverallDaysModal: (remainingTopics: number) => void;
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
  onOpenOverallDaysModal,
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

  const dailyPaceHint =
    overallTargetDays && remainingUnique > 0
      ? `~${(remainingUnique / overallTargetDays).toFixed(1)}/day`
      : null;

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
          <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-[#1E2420] whitespace-nowrap shrink-0">
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
          {/* Left: Overall % + Completed / Remaining + Active Sprint + Target Days */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
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

            {/* Manual Syllabus Completion Days Target */}
            <div className="neu-well-sm rounded-xl px-3.5 py-2 flex items-center gap-2.5">
              <CalendarClock className="w-4 h-4 text-[#153226] shrink-0" />
              <div className="text-xs">
                <div className="text-[#5A625C] font-medium">Completion Timeline</div>
                {overallTargetDays ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums font-bold text-[#1E2420]">
                      {overallTargetDays} Days
                    </span>
                    {dailyPaceHint && (
                      <span className="font-mono tabular-nums text-[11px] text-[#5A625C]">
                        ({dailyPaceHint})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenOverallDaysModal(remainingUnique)}
                      className="neu-btn rounded-md px-2 py-0.5 text-[11px] font-semibold text-[#153226] inline-flex items-center gap-1 cursor-pointer"
                      title="Manually re-edit syllabus completion days"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenOverallDaysModal(remainingUnique)}
                    className="neu-mint rounded-md px-2.5 py-0.5 text-[11px] font-bold inline-flex items-center gap-1 mt-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Set Target Days</span>
                  </button>
                )}
              </div>
            </div>
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
