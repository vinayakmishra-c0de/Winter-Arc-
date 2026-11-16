import React, { useMemo, useState } from 'react';
import { LineChart, Plus, Trash2 } from 'lucide-react';
import { EXAM_IDS, EXAM_META, ExamId, MockTest } from '../types';
import { getLocalDateKey } from '../data/seedData';

interface MockAnalyticsViewProps {
  mockTests: MockTest[];
  onAddMockTest: (mock: Omit<MockTest, 'id' | 'createdAt'>) => void;
  onDeleteMockTest: (id: string) => void;
}

function computeMockMetrics(
  exam: ExamId,
  score: number,
  maxMarks: number,
  wrongQuestions: number,
  attemptedInput?: number
): { scorePercent: number; netAccuracyPercent: number } {
  const scorePercent =
    maxMarks > 0
      ? Math.max(0, Math.min(100, Number(((score / maxMarks) * 100).toFixed(1))))
      : 0;

  if (
    typeof attemptedInput === 'number' &&
    !Number.isNaN(attemptedInput) &&
    attemptedInput > 0
  ) {
    const correct = Math.max(0, attemptedInput - Math.max(0, wrongQuestions));
    const acc = Math.max(
      0,
      Math.min(100, Number(((correct / attemptedInput) * 100).toFixed(1)))
    );
    return { scorePercent, netAccuracyPercent: acc };
  }

  // Auto-estimate Net Accuracy when Attempted Questions is omitted
  // IPMAT/CUET typically use +4 or +5 per question; IITM typically 1-2 marks per question
  const marksPerQ = exam === 'IITM' ? (maxMarks > 120 ? 2 : 1) : maxMarks >= 180 ? 4 : 1;
  const estCorrect = Math.max(0, score / marksPerQ);
  const estAttempted = estCorrect + Math.max(0, wrongQuestions);
  const netAccuracyPercent =
    estAttempted > 0
      ? Math.max(
          0,
          Math.min(100, Number(((estCorrect / estAttempted) * 100).toFixed(1)))
        )
      : scorePercent;

  return { scorePercent, netAccuracyPercent };
}

export const MockAnalyticsView: React.FC<MockAnalyticsViewProps> = ({
  mockTests,
  onAddMockTest,
  onDeleteMockTest,
}) => {
  const [exam, setExam] = useState<ExamId>('IPMAT');
  const [name, setName] = useState('');
  const [date, setDate] = useState(getLocalDateKey());
  const [scoreStr, setScoreStr] = useState('');
  const [maxMarksStr, setMaxMarksStr] = useState('360');
  const [wrongStr, setWrongStr] = useState('0');
  const [attemptedStr, setAttemptedStr] = useState('');
  const [formError, setFormError] = useState('');

  const [filterExam, setFilterExam] = useState<'ALL' | ExamId>('ALL');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const previewMetrics = useMemo(() => {
    const score = parseFloat(scoreStr);
    const maxMarks = parseFloat(maxMarksStr);
    const wrong = parseInt(wrongStr || '0', 10);
    const attempted = attemptedStr ? parseInt(attemptedStr, 10) : undefined;
    if (Number.isNaN(score) || Number.isNaN(maxMarks) || maxMarks <= 0) {
      return null;
    }
    return computeMockMetrics(exam, score, maxMarks, Math.max(0, wrong), attempted);
  }, [exam, scoreStr, maxMarksStr, wrongStr, attemptedStr]);

  const handleExamChangeInForm = (nextExam: ExamId) => {
    setExam(nextExam);
    if (nextExam === 'IITM' && (maxMarksStr === '360' || maxMarksStr === '200')) {
      setMaxMarksStr('100');
    } else if (nextExam === 'IPMAT' && (maxMarksStr === '100' || maxMarksStr === '200')) {
      setMaxMarksStr('360');
    } else if (nextExam === 'CUET' && (maxMarksStr === '100' || maxMarksStr === '360')) {
      setMaxMarksStr('200');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const score = parseFloat(scoreStr);
    const maxMarks = parseFloat(maxMarksStr);
    const wrong = parseInt(wrongStr || '0', 10);
    const attempted = attemptedStr ? parseInt(attemptedStr, 10) : undefined;

    if (!name.trim()) {
      setFormError('Enter a mock test name.');
      return;
    }
    if (Number.isNaN(score) || Number.isNaN(maxMarks) || maxMarks <= 0) {
      setFormError('Enter valid numeric Score and Max Marks (> 0).');
      return;
    }
    if (score > maxMarks) {
      setFormError('Score cannot exceed Max Marks.');
      return;
    }
    if (Number.isNaN(wrong) || wrong < 0) {
      setFormError('Wrong Questions must be 0 or greater.');
      return;
    }

    const { scorePercent, netAccuracyPercent } = computeMockMetrics(
      exam,
      score,
      maxMarks,
      wrong,
      attempted
    );

    onAddMockTest({
      exam,
      name: name.trim(),
      date: date || getLocalDateKey(),
      score,
      maxMarks,
      wrongQuestions: wrong,
      attemptedQuestions: attempted,
      scorePercent,
      netAccuracyPercent,
    });

    setName('');
    setScoreStr('');
    setWrongStr('0');
    setAttemptedStr('');
    setFormError('');
  };

  const filteredMocks = useMemo(() => {
    const base =
      filterExam === 'ALL'
        ? mockTests
        : mockTests.filter((m) => m.exam === filterExam);
    return [...base].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt - b.createdAt;
    });
  }, [mockTests, filterExam]);

  const recentFirstMocks = useMemo(() => {
    return [...filteredMocks].reverse();
  }, [filteredMocks]);

  const kpis = useMemo(() => {
    if (filteredMocks.length === 0) {
      return { count: 0, avgScore: 0, avgAcc: 0, bestScore: 0 };
    }
    const avgScore =
      filteredMocks.reduce((acc, m) => acc + m.scorePercent, 0) /
      filteredMocks.length;
    const avgAcc =
      filteredMocks.reduce((acc, m) => acc + m.netAccuracyPercent, 0) /
      filteredMocks.length;
    const bestScore = Math.max(...filteredMocks.map((m) => m.scorePercent));
    return {
      count: filteredMocks.length,
      avgScore: Number(avgScore.toFixed(1)),
      avgAcc: Number(avgAcc.toFixed(1)),
      bestScore: Number(bestScore.toFixed(1)),
    };
  }, [filteredMocks]);

  // SVG chart coordinates
  const chartW = 680;
  const chartH = 210;
  const padL = 38;
  const padR = 20;
  const padT = 18;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const getPoint = (idx: number, total: number, val: number) => {
    const x =
      total <= 1
        ? padL + plotW / 2
        : padL + (idx / (total - 1)) * plotW;
    const y = padT + (1 - Math.max(0, Math.min(100, val)) / 100) * plotH;
    return { x, y };
  };

  const scorePoints = filteredMocks.map((m, i) =>
    getPoint(i, filteredMocks.length, m.scorePercent)
  );
  const accPoints = filteredMocks.map((m, i) =>
    getPoint(i, filteredMocks.length, m.netAccuracyPercent)
  );

  const scorePolyline = scorePoints.map((p) => `${p.x},${p.y}`).join(' ');
  const accPolyline = accPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <section aria-label="Mock Test and Accuracy Analytics" className="space-y-5">
      {/* Quick-Entry Mock Form */}
      <div className="neu-surface rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-[#153226]" />
            <h2 className="font-display font-bold text-base sm:text-lg text-[#1E2420]">
              Log Mock Test Result
            </h2>
          </div>

          {previewMetrics && (
            <div className="neu-mint rounded-full px-3.5 py-1 text-xs font-mono tabular-nums font-bold">
              Score: {previewMetrics.scorePercent}% · Net Accuracy: {previewMetrics.netAccuracyPercent}%
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <label htmlFor="mock-exam" className="block text-xs font-semibold text-[#5A625C]">
                Exam
              </label>
              <select
                id="mock-exam"
                value={exam}
                onChange={(e) => handleExamChangeInForm(e.target.value as ExamId)}
                className="neu-input w-full rounded-xl px-3 py-2 text-sm font-medium cursor-pointer"
              >
                {EXAM_IDS.map((id) => (
                  <option key={id} value={id}>
                    {EXAM_META[id].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="mock-name" className="block text-xs font-semibold text-[#5A625C]">
                Mock Name
              </label>
              <input
                id="mock-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="e.g. IPMAT Indore Full Mock #01"
                className="neu-input w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="mock-date" className="block text-xs font-semibold text-[#5A625C]">
                Date
              </label>
              <input
                id="mock-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="neu-input w-full rounded-xl px-3 py-2 text-sm font-mono"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="mock-score" className="block text-xs font-semibold text-[#5A625C]">
                Score
              </label>
              <input
                id="mock-score"
                type="number"
                step="0.5"
                value={scoreStr}
                onChange={(e) => {
                  setScoreStr(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="248"
                className="neu-input w-full rounded-xl px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="mock-max" className="block text-xs font-semibold text-[#5A625C]">
                Max Marks
              </label>
              <input
                id="mock-max"
                type="number"
                min="1"
                step="1"
                value={maxMarksStr}
                onChange={(e) => {
                  setMaxMarksStr(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="360"
                className="neu-input w-full rounded-xl px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <div className="space-y-1">
                <label htmlFor="mock-wrong" className="block text-xs font-semibold text-[#5A625C]">
                  Wrong Questions
                </label>
                <input
                  id="mock-wrong"
                  type="number"
                  min="0"
                  step="1"
                  value={wrongStr}
                  onChange={(e) => setWrongStr(e.target.value)}
                  className="neu-input w-full rounded-xl px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="mock-attempted" className="block text-xs font-semibold text-[#5A625C]">
                  Attempted (Opt.)
                </label>
                <input
                  id="mock-attempted"
                  type="number"
                  min="1"
                  step="1"
                  value={attemptedStr}
                  onChange={(e) => setAttemptedStr(e.target.value)}
                  placeholder="Auto"
                  className="neu-input w-full rounded-xl px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              className="neu-mint rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Mock Test</span>
            </button>
          </div>

          {formError && (
            <p className="text-xs font-medium text-[#B91C1C]">{formError}</p>
          )}
        </form>
      </div>

      {/* Filter & KPI Strip */}
      <div className="neu-surface rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold text-base text-[#1E2420]">
            Score & Accuracy Trajectory
          </h3>
          <div className="neu-well rounded-full p-1 inline-flex items-center gap-1">
            {(['ALL', ...EXAM_IDS] as const).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setFilterExam(ex);
                  setHoveredIdx(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  filterExam === ex
                    ? 'neu-mint'
                    : 'text-[#5A625C] hover:text-[#1E2420]'
                }`}
              >
                {ex === 'ALL' ? 'All Exams' : EXAM_META[ex].shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="neu-well-sm rounded-xl p-3.5">
            <div className="text-xs text-[#5A625C] font-medium">Mocks Logged</div>
            <div className="font-mono tabular-nums text-xl font-bold text-[#1E2420] mt-1">
              {kpis.count}
            </div>
          </div>
          <div className="neu-well-sm rounded-xl p-3.5">
            <div className="text-xs text-[#5A625C] font-medium">Avg Score %</div>
            <div className="font-mono tabular-nums text-xl font-bold text-[#153226] mt-1">
              {kpis.avgScore}%
            </div>
          </div>
          <div className="neu-well-sm rounded-xl p-3.5">
            <div className="text-xs text-[#5A625C] font-medium">Avg Net Accuracy</div>
            <div className="font-mono tabular-nums text-xl font-bold text-[#1E2420] mt-1">
              {kpis.avgAcc}%
            </div>
          </div>
          <div className="neu-well-sm rounded-xl p-3.5">
            <div className="text-xs text-[#5A625C] font-medium">Best Score %</div>
            <div className="font-mono tabular-nums text-xl font-bold text-[#153226] mt-1">
              {kpis.bestScore}%
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        {filteredMocks.length === 0 ? (
          <div className="neu-well rounded-xl p-8 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#1E2420]">
              No mock tests logged yet
            </p>
            <p className="text-xs text-[#5A625C]">
              Log your first mock score above to visualize Score % and Net Accuracy % trends.
            </p>
          </div>
        ) : (
          <div className="neu-well rounded-2xl p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-semibold text-[#153226]">
                  <span className="w-3 h-0.5 bg-[#2A8562] inline-block rounded" />
                  Score %
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#4A5568]">
                  <span className="w-3 h-0.5 bg-[#4A5568] inline-block rounded border-b border-dashed" />
                  Net Accuracy %
                </span>
              </div>
              {hoveredIdx !== null && filteredMocks[hoveredIdx] && (
                <span className="font-mono tabular-nums text-[#1E2420] font-semibold">
                  {filteredMocks[hoveredIdx].name}: {filteredMocks[hoveredIdx].scorePercent}% score ·{' '}
                  {filteredMocks[hoveredIdx].netAccuracyPercent}% acc
                </span>
              )}
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-52 min-w-[440px]"
                role="img"
                aria-label="Mock test score percentage and net accuracy percentage trend chart"
              >
                {/* Horizontal gridlines at 0, 25, 50, 75, 100 */}
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = padT + (1 - tick / 100) * plotH;
                  return (
                    <g key={tick}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={chartW - padR}
                        y2={y}
                        stroke="rgba(0,0,0,0.08)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-[#7C847D] text-[10px] font-mono"
                      >
                        {tick}%
                      </text>
                    </g>
                  );
                })}

                {/* Net Accuracy Line */}
                {filteredMocks.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#4A5568"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                    points={accPolyline}
                  />
                )}

                {/* Score % Line */}
                {filteredMocks.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#2A8562"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={scorePolyline}
                  />
                )}

                {/* Data Points */}
                {filteredMocks.map((m, i) => {
                  const sp = scorePoints[i];
                  const ap = accPoints[i];
                  const isHovered = hoveredIdx === i;
                  return (
                    <g
                      key={m.id}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={ap.x}
                        cy={ap.y}
                        r={isHovered ? 5 : 3.5}
                        fill="#4A5568"
                        stroke="#F7F7F3"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={sp.x}
                        cy={sp.y}
                        r={isHovered ? 6 : 4.5}
                        fill="#2A8562"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <text
                        x={sp.x}
                        y={chartH - 8}
                        textAnchor="middle"
                        className="fill-[#5A625C] text-[10px] font-mono"
                      >
                        #{i + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Recent Mock History Table */}
        {recentFirstMocks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 text-xs font-semibold text-[#5A625C]">
                  <th className="py-2.5 pr-3">Date</th>
                  <th className="py-2.5 pr-3">Exam</th>
                  <th className="py-2.5 pr-3">Mock Name</th>
                  <th className="py-2.5 pr-3 text-right">Score</th>
                  <th className="py-2.5 pr-3 text-right">Wrong</th>
                  <th className="py-2.5 pr-3 text-right">Score %</th>
                  <th className="py-2.5 pr-3 text-right">Net Acc %</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 text-xs sm:text-sm">
                {recentFirstMocks.map((m) => (
                  <tr key={m.id} className="hover:bg-black/[0.02]">
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-xs text-[#5A625C] whitespace-nowrap">
                      {m.date}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-xs text-[#153226] whitespace-nowrap">
                      {EXAM_META[m.exam].shortLabel}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-[#1E2420]">
                      {m.name}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#1E2420] whitespace-nowrap">
                      {m.score} / {m.maxMarks}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#B91C1C]">
                      {m.wrongQuestions}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-bold text-[#153226]">
                      {m.scorePercent}%
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-bold text-[#1E2420]">
                      {m.netAccuracyPercent}%
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteMockTest(m.id)}
                        className="neu-btn rounded-lg p-1.5 text-[#5A625C] hover:text-[#B91C1C] cursor-pointer inline-flex"
                        aria-label={`Delete mock ${m.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
