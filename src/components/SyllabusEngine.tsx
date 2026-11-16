import React, { useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Flame,
  Link2,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  EXAM_IDS,
  EXAM_META,
  ExamId,
  FilterStatus,
  IPMAT_TRACK_META,
  IPMAT_TRACKS,
  IpmatTrack,
  SectionGoalKey,
  SyllabusDaysGoal,
  Topic,
} from '../types';

interface SyllabusEngineProps {
  activeExam: ExamId;
  onChangeExam: (exam: ExamId) => void;
  activeIpmatTrack: IpmatTrack;
  onChangeIpmatTrack: (track: IpmatTrack) => void;
  topics: Topic[];
  syllabusDaysGoal: SyllabusDaysGoal;
  onOpenSectionDaysModal: (
    goalKey: SectionGoalKey,
    label: string,
    remainingTopics: number
  ) => void;
  onToggleComplete: (topicId: string) => void;
  onToggleTarget: (topicId: string) => void;
  onOpenAddTopic: () => void;
  onOpenEditTopic: (topic: Topic) => void;
  onDeleteTopic: (topicId: string) => void;
  onOpenDriveModal: (topic: Topic) => void;
  onCopyDriveLink: (url: string, label: string) => void;
  onDeleteDriveLink: (topicId: string, linkId: string) => void;
  onOpenSynergyModal: (topic: Topic) => void;
  onImportExcelFile: (file: File) => void;
  onExportExcelSection: () => void;
  onDownloadSampleTemplate: () => void;
}

export const SyllabusEngine: React.FC<SyllabusEngineProps> = ({
  activeExam,
  onChangeExam,
  activeIpmatTrack,
  onChangeIpmatTrack,
  topics,
  syllabusDaysGoal,
  onOpenSectionDaysModal,
  onToggleComplete,
  onToggleTarget,
  onOpenAddTopic,
  onOpenEditTopic,
  onDeleteTopic,
  onOpenDriveModal,
  onCopyDriveLink,
  onDeleteDriveLink,
  onOpenSynergyModal,
  onImportExcelFile,
  onExportExcelSection,
  onDownloadSampleTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Per-track stats for the 3 IPMAT & JIPMAT sub-sections
  const ipmatTrackStats = useMemo(() => {
    return IPMAT_TRACKS.map((trackId) => {
      const trackTopics = topics.filter((t) => {
        if (t.exam === 'IPMAT') {
          return (t.subExam || 'INDORE') === trackId;
        }
        return trackId === 'INDORE' && t.synergy.includes('IPMAT');
      });
      const done = trackTopics.filter((t) => t.completed).length;
      const total = trackTopics.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        trackId,
        label: IPMAT_TRACK_META[trackId].label,
        done,
        total,
        pct,
      };
    });
  }, [topics]);

  // Topics belonging to the active section (or active IPMAT sub-section)
  const sectionTopics = useMemo(() => {
    if (activeExam !== 'IPMAT') {
      return topics.filter(
        (t) => t.exam === activeExam || t.synergy.includes(activeExam)
      );
    }
    return topics.filter((t) => {
      if (t.exam === 'IPMAT') {
        return (t.subExam || 'INDORE') === activeIpmatTrack;
      }
      return activeIpmatTrack === 'INDORE' && t.synergy.includes('IPMAT');
    });
  }, [topics, activeExam, activeIpmatTrack]);

  const activeGoalKey: SectionGoalKey =
    activeExam === 'IPMAT'
      ? IPMAT_TRACK_META[activeIpmatTrack].goalKey
      : activeExam;

  const activeSectionLabel =
    activeExam === 'IPMAT'
      ? IPMAT_TRACK_META[activeIpmatTrack].label
      : EXAM_META[activeExam].label;

  const activeSectionSubtitle =
    activeExam === 'IPMAT'
      ? IPMAT_TRACK_META[activeIpmatTrack].subtitle
      : EXAM_META[activeExam].subtitle;

  const activeSectionDays = syllabusDaysGoal.sectionDays[activeGoalKey] ?? null;

  const subjects = useMemo(() => {
    const set = new Set<string>();
    sectionTopics.forEach((t) => set.add(t.subject));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sectionTopics]);

  const effectiveSubjectFilter =
    subjectFilter === 'ALL' || subjects.includes(subjectFilter)
      ? subjectFilter
      : 'ALL';

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sectionTopics.filter((t) => {
      if (effectiveSubjectFilter !== 'ALL' && t.subject !== effectiveSubjectFilter) {
        return false;
      }
      if (statusFilter === 'target' && !t.inTarget) return false;
      if (statusFilter === 'pending' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;
      if (q) {
        const hay = `${t.subject} ${t.unit} ${t.name} ${t.synergy.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sectionTopics, effectiveSubjectFilter, statusFilter, searchQuery]);

  const groupedBySubject = useMemo(() => {
    const groups = new Map<string, Topic[]>();
    for (const topic of filteredTopics) {
      const list = groups.get(topic.subject) || [];
      list.push(topic);
      groups.set(topic.subject, list);
    }
    return Array.from(groups.entries());
  }, [filteredTopics]);

  const counts = useMemo(() => {
    return {
      all: sectionTopics.length,
      target: sectionTopics.filter((t) => t.inTarget).length,
      pending: sectionTopics.filter((t) => !t.completed).length,
      completed: sectionTopics.filter((t) => t.completed).length,
    };
  }, [sectionTopics]);

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportExcelFile(file);
    }
    e.target.value = '';
  };

  return (
    <section aria-label="Syllabus Engine" className="space-y-5">
      {/* Three-Section Segmented Tabs + Sub-sections & Controls */}
      <div className="neu-surface rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div
            role="tablist"
            aria-label="Exam sections"
            className="neu-well rounded-full p-1.5 inline-flex flex-wrap sm:flex-nowrap items-center gap-1"
          >
            {EXAM_IDS.map((examId) => {
              const active = activeExam === examId;
              return (
                <button
                  key={examId}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => {
                    onChangeExam(examId);
                    setSubjectFilter('ALL');
                  }}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                    active
                      ? 'neu-mint'
                      : 'text-[#5A625C] hover:text-[#1E2420]'
                  }`}
                >
                  {EXAM_META[examId].label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenAddTopic}
            className="neu-mint rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Topic</span>
          </button>
        </div>

        {/* IPMAT & JIPMAT 3 Separate Syllabus Sections: IPMAT Indore | IPMAT Rohtak | JIPMAT */}
        {activeExam === 'IPMAT' && (
          <div className="neu-well rounded-2xl p-2 flex flex-wrap items-center gap-1.5">
            {ipmatTrackStats.map((track) => {
              const active = activeIpmatTrack === track.trackId;
              return (
                <button
                  key={track.trackId}
                  type="button"
                  onClick={() => {
                    onChangeIpmatTrack(track.trackId);
                    setSubjectFilter('ALL');
                  }}
                  className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 whitespace-nowrap cursor-pointer transition-all ${
                    active
                      ? 'neu-mint font-bold'
                      : 'text-[#5A625C] hover:text-[#1E2420]'
                  }`}
                >
                  <span>{track.label}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-85">
                    {track.done}/{track.total} · {track.pct}%
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Section Header + Manual Section Completion Days Target */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <div className="font-display font-bold text-sm text-[#1E2420]">
              {activeSectionLabel}
            </div>
            <div className="text-xs text-[#5A625C]">{activeSectionSubtitle}</div>
          </div>

          <div className="flex items-center gap-2">
            <CalendarClock className="w-3.5 h-3.5 text-[#153226]" />
            {activeSectionDays ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono tabular-nums font-bold text-[#1E2420]">
                  {activeSectionDays} Days Goal
                </span>
                {counts.pending > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-[#5A625C]">
                    (~{(counts.pending / activeSectionDays).toFixed(1)}/day)
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onOpenSectionDaysModal(
                      activeGoalKey,
                      activeSectionLabel,
                      counts.pending
                    )
                  }
                  className="neu-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#153226] inline-flex items-center gap-1 cursor-pointer"
                  title={`Manually edit completion days for ${activeSectionLabel}`}
                >
                  <Pencil className="w-2.5 h-2.5" />
                  <span>Edit Days</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onOpenSectionDaysModal(
                    activeGoalKey,
                    activeSectionLabel,
                    counts.pending
                  )
                }
                className="neu-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-[#153226] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Set {activeSectionLabel} Days</span>
              </button>
            )}
          </div>
        </div>

        {/* Prominent Excel Import & Export Bar */}
        <div className="neu-well rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              className="neu-mint rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Excel (.xlsx / .csv)</span>
            </button>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelChange}
              className="hidden"
              aria-label="Import Excel or CSV syllabus"
            />

            <button
              type="button"
              onClick={onExportExcelSection}
              className="neu-btn rounded-full px-4 py-2 text-xs font-semibold text-[#1E2420] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#153226]" />
              <span>Export Section to Excel</span>
            </button>

            <button
              type="button"
              onClick={onDownloadSampleTemplate}
              className="neu-btn rounded-full px-4 py-2 text-xs font-semibold text-[#5A625C] hover:text-[#1E2420] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#153226]" />
              <span>Download Sample Excel Template</span>
            </button>
          </div>

          <span className="text-[11px] text-[#5A625C] font-medium px-1">
            Appends rows into {activeSectionLabel} Backlog without overwriting progress
          </span>
        </div>

        {/* Search, Subject Filter & Filter Chips */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-[#7C847D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeSectionLabel} topics, units, or subjects...`}
              className="neu-input w-full rounded-xl pl-10 pr-8 py-2.5 text-sm"
              aria-label="Search syllabus topics"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7C847D] hover:text-[#1E2420] cursor-pointer p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={effectiveSubjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filter by subject"
            className="neu-input rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1E2420] cursor-pointer md:w-48"
          >
            <option value="ALL">All Subjects ({subjects.length})</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'all', label: 'All', count: counts.all },
              { key: 'target', label: 'Active Target', count: counts.target },
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'completed', label: 'Completed', count: counts.completed },
            ] as const
          ).map((chip) => {
            const active = statusFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  active ? 'neu-mint' : 'neu-btn text-[#5A625C] hover:text-[#1E2420]'
                }`}
              >
                {chip.key === 'target' && (
                  <Flame className="w-3.5 h-3.5 text-[#C25E24]" />
                )}
                <span>{chip.label}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Topic List Grouped by Subject */}
      {groupedBySubject.length === 0 ? (
        <div className="neu-surface rounded-2xl p-10 text-center space-y-3">
          <p className="font-display font-semibold text-base text-[#1E2420]">
            No topics match your current filter
          </p>
          <p className="text-xs sm:text-sm text-[#5A625C] max-w-md mx-auto">
            Add a topic manually, clear your search filters, or import an Excel/CSV syllabus sheet into {activeSectionLabel}.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            {(searchQuery || statusFilter !== 'all' || effectiveSubjectFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setSubjectFilter('ALL');
                }}
                className="neu-btn rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAddTopic}
              className="neu-mint rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Topic</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedBySubject.map(([subjectName, subjectTopics]) => {
            const doneCount = subjectTopics.filter((t) => t.completed).length;
            return (
              <div
                key={subjectName}
                className="neu-surface rounded-2xl p-4 sm:p-5 space-y-3"
              >
                {/* Subject Header Row */}
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-black/6">
                  <h2 className="font-display font-bold text-sm sm:text-base text-[#1E2420]">
                    {subjectName}
                  </h2>
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#5A625C]">
                    {doneCount}/{subjectTopics.length} done
                  </span>
                </div>

                {/* Topic Rows */}
                <div className="divide-y divide-black/6">
                  {subjectTopics.map((topic) => {
                    const isSharedIn = topic.exam !== activeExam;
                    return (
                      <div
                        key={topic.id}
                        className={`py-3 first:pt-1 last:pb-1 transition-opacity ${
                          topic.completed ? 'opacity-80' : ''
                        }`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                          {/* Left: Checkbox + Topic Metadata & Title */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={topic.completed}
                              aria-label={`Mark ${topic.name} as ${
                                topic.completed ? 'pending' : 'completed'
                              }`}
                              onClick={() => onToggleComplete(topic.id)}
                              className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                                topic.completed
                                  ? 'neu-mint'
                                  : 'neu-well-sm hover:brightness-95'
                              }`}
                            >
                              {topic.completed && (
                                <Check className="w-3.5 h-3.5 text-[#153226] stroke-[2.8]" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5A625C]">
                                <span>{topic.unit}</span>
                                {isSharedIn && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-[#153226]">
                                      Shared from {EXAM_META[topic.exam].shortLabel}
                                    </span>
                                  </>
                                )}
                                {topic.synergy.length > 0 && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-[#153226]">
                                      Synergy: {topic.synergy.join(', ')}
                                    </span>
                                  </>
                                )}
                              </div>

                              <p
                                className={`text-sm font-semibold leading-snug ${
                                  topic.completed
                                    ? 'line-through text-[#7C847D]'
                                    : 'text-[#1E2420]'
                                }`}
                              >
                                {topic.name}
                              </p>

                              {/* Saved Google Drive Resource Mint Pill-Chips */}
                              {topic.links.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                                  {topic.links.map((link) => (
                                    <div
                                      key={link.id}
                                      className="neu-mint rounded-full pl-3 pr-1.5 py-1 flex items-center gap-1.5 text-xs font-semibold max-w-full"
                                    >
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:underline truncate max-w-[180px] sm:max-w-[240px]"
                                        title={`Open ${link.label} in new tab`}
                                      >
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{link.label}</span>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => onCopyDriveLink(link.url, link.label)}
                                        className="w-5 h-5 rounded-full bg-white/55 hover:bg-white/90 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                                        title="Copy Drive link"
                                        aria-label={`Copy link for ${link.label}`}
                                      >
                                        <Copy className="w-2.5 h-2.5 text-[#153226]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDeleteDriveLink(topic.id, link.id)}
                                        className="w-5 h-5 rounded-full bg-white/55 hover:bg-white/90 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                                        title="Remove Drive link"
                                        aria-label={`Delete link ${link.label}`}
                                      >
                                        <X className="w-3 h-3 text-[#153226]" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Manual Topic Controls */}
                          <div className="flex flex-wrap items-center gap-1.5 pl-9 xl:pl-0 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleTarget(topic.id)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                                topic.inTarget
                                  ? 'neu-mint'
                                  : 'neu-btn text-[#5A625C] hover:text-[#1E2420]'
                              }`}
                              title={
                                topic.inTarget
                                  ? 'Remove from Active Sprint target'
                                  : 'Add to Active Sprint target'
                              }
                            >
                              <Flame
                                className={`w-3.5 h-3.5 ${
                                  topic.inTarget ? 'text-[#C25E24]' : 'text-[#7C847D]'
                                }`}
                              />
                              <span>{topic.inTarget ? 'In Target' : '+ Target'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenDriveModal(topic)}
                              className="neu-btn rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1E2420] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                              title="Attach Google Drive PDF or Notes link"
                            >
                              <Link2 className="w-3.5 h-3.5 text-[#153226]" />
                              <span>+ Drive Link</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenSynergyModal(topic)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                                topic.synergy.length > 0
                                  ? 'neu-mint'
                                  : 'neu-btn text-[#5A625C] hover:text-[#1E2420]'
                              }`}
                              title="Tag topic as shared across exams (Synergy)"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Synergy</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenEditTopic(topic)}
                              className="neu-btn rounded-lg p-1.5 text-[#5A625C] hover:text-[#1E2420] cursor-pointer"
                              title="Edit or replace topic"
                              aria-label={`Edit ${topic.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteTopic(topic.id)}
                              className="neu-btn rounded-lg p-1.5 text-[#5A625C] hover:text-[#B91C1C] cursor-pointer"
                              title="Delete topic"
                              aria-label={`Delete ${topic.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
