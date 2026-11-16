import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { EXAM_IDS, EXAM_META, ExamId, FocusLog, Topic } from '../types';
import { getLocalDateKey, getOffsetDateKey } from '../data/seedData';
import { calculateStreak, formatDuration } from '../utils/storage';

type PresetId = '50/10' | '25/5';
type TimerPhase = 'focus' | 'break';

interface FocusTimerWidgetProps {
  focusLogs: FocusLog[];
  dailyTargetHours: number;
  onChangeDailyTarget: (hours: number) => void;
  onLogFocusMinutes: (exam: ExamId, minutes: number, mode: '50/10' | '25/5' | 'manual') => void;
  sprintTopics: Topic[];
  onToggleCompleteTopic: (topicId: string) => void;
}

const PRESETS: Record<PresetId, { focusMin: number; breakMin: number; label: string }> = {
  '50/10': { focusMin: 50, breakMin: 10, label: '50m Deep Work / 10m Break' },
  '25/5': { focusMin: 25, breakMin: 5, label: '25m Warm-Up / 5m Break' },
};

function playCompletionChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.45);
    });
  } catch {
    // Audio playback optional
  }
}

export const FocusTimerWidget: React.FC<FocusTimerWidgetProps> = ({
  focusLogs,
  dailyTargetHours,
  onChangeDailyTarget,
  onLogFocusMinutes,
  sprintTopics,
  onToggleCompleteTopic,
}) => {
  const [preset, setPreset] = useState<PresetId>('50/10');
  const [phase, setPhase] = useState<TimerPhase>('focus');
  const [subject, setSubject] = useState<ExamId>('IITM');
  const [isRunning, setIsRunning] = useState(false);

  const totalPhaseSeconds =
    (phase === 'focus' ? PRESETS[preset].focusMin : PRESETS[preset].breakMin) * 60;
  const [secondsLeft, setSecondsLeft] = useState<number>(totalPhaseSeconds);

  const targetEndRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Sync timer when preset or phase changes while stopped
  const selectPreset = (nextPreset: PresetId) => {
    setIsRunning(false);
    targetEndRef.current = null;
    completedRef.current = false;
    setPreset(nextPreset);
    setPhase('focus');
    setSecondsLeft(PRESETS[nextPreset].focusMin * 60);
  };

  const switchPhase = (nextPhase: TimerPhase) => {
    setIsRunning(false);
    targetEndRef.current = null;
    completedRef.current = false;
    setPhase(nextPhase);
    setSecondsLeft(
      (nextPhase === 'focus' ? PRESETS[preset].focusMin : PRESETS[preset].breakMin) * 60
    );
  };

  const handleStartPause = () => {
    if (isRunning) {
      setIsRunning(false);
      targetEndRef.current = null;
    } else {
      completedRef.current = false;
      targetEndRef.current = Date.now() + secondsLeft * 1000;
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    targetEndRef.current = null;
    completedRef.current = false;
    setSecondsLeft(totalPhaseSeconds);
  };

  const handleBankElapsedNow = () => {
    if (phase !== 'focus') return;
    const elapsedMinutes = Math.round((totalPhaseSeconds - secondsLeft) / 60);
    if (elapsedMinutes < 1) return;
    onLogFocusMinutes(subject, elapsedMinutes, preset);
    handleReset();
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = window.setInterval(() => {
      if (!targetEndRef.current) return;
      const diffSec = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
      setSecondsLeft(diffSec);

      if (diffSec <= 0 && !completedRef.current) {
        completedRef.current = true;
        setIsRunning(false);
        targetEndRef.current = null;
        playCompletionChime();

        if (phase === 'focus') {
          onLogFocusMinutes(subject, PRESETS[preset].focusMin, preset);
          setPhase('break');
          setSecondsLeft(PRESETS[preset].breakMin * 60);
        } else {
          setPhase('focus');
          setSecondsLeft(PRESETS[preset].focusMin * 60);
        }
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [isRunning, phase, preset, subject, onLogFocusMinutes]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const elapsedPercent = Math.min(
    100,
    Math.max(0, ((totalPhaseSeconds - secondsLeft) / totalPhaseSeconds) * 100)
  );
  const canBankPartial =
    phase === 'focus' && totalPhaseSeconds - secondsLeft >= 60;

  // Today's logged minutes & breakdown
  const todayKey = getLocalDateKey();
  const todayStats = useMemo(() => {
    const byExam: Record<ExamId, number> = { IITM: 0, IPMAT: 0, CUET: 0 };
    let total = 0;
    for (const log of focusLogs) {
      if (log.date === todayKey) {
        total += log.minutes;
        byExam[log.exam] = (byExam[log.exam] || 0) + log.minutes;
      }
    }
    return { total, byExam };
  }, [focusLogs, todayKey]);

  const targetMinutes = Math.round(dailyTargetHours * 60);
  const targetPercent = Math.min(
    100,
    targetMinutes > 0 ? Math.round((todayStats.total / targetMinutes) * 100) : 0
  );

  const streak = useMemo(() => calculateStreak(focusLogs), [focusLogs]);

  // Last 7 days mini activity strip
  const last7Days = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of focusLogs) {
      map.set(log.date, (map.get(log.date) || 0) + log.minutes);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const offset = i - 6;
      const key = getOffsetDateKey(offset);
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const dayLabel = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      return {
        key,
        dayLabel,
        minutes: map.get(key) || 0,
      };
    });
  }, [focusLogs]);

  const overloadModeLabel =
    dailyTargetHours <= 3.0
      ? 'Warm-Up'
      : dailyTargetHours <= 5.0
      ? 'Builder'
      : 'Peak Mode';

  return (
    <aside aria-label="Deep Work Focus Timer and Active Sprint" className="space-y-5">
      {/* Pomodoro Timer Card */}
      <div className="neu-surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#153226]" />
            <h2 className="font-display font-bold text-base text-[#1E2420]">
              Deep Work Timer
            </h2>
          </div>

          <div className="neu-well-sm rounded-full p-0.5 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => switchPhase('focus')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                phase === 'focus' ? 'neu-mint' : 'text-[#5A625C]'
              }`}
            >
              Focus
            </button>
            <button
              type="button"
              onClick={() => switchPhase('break')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                phase === 'break' ? 'neu-mint' : 'text-[#5A625C]'
              }`}
            >
              Break
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-2 gap-2">
          {(['50/10', '25/5'] as PresetId[]).map((p) => {
            const active = preset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => selectPreset(p)}
                className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold text-center cursor-pointer transition-all ${
                  active ? 'neu-mint' : 'neu-btn text-[#5A625C]'
                }`}
              >
                {p === '50/10' ? '50m Deep / 10m' : '25m Warm-Up / 5m'}
              </button>
            );
          })}
        </div>

        {/* Recessed Clock Display */}
        <div className="neu-well rounded-2xl p-4 text-center space-y-2.5">
          <div className="text-[11px] font-semibold text-[#5A625C]">
            {phase === 'focus' ? `Focusing on ${EXAM_META[subject].shortLabel}` : 'Recovery Break'}
          </div>
          <div className="font-mono tabular-nums text-4xl sm:text-5xl font-bold tracking-tight text-[#1E2420]">
            {mins}:{secs}
          </div>
          <div className="neu-well-sm h-2 rounded-full overflow-hidden p-0.5 bg-[#DCDCD4]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${elapsedPercent}%`,
                background: 'linear-gradient(90deg, #B8EED8 0%, #9DE0C5 100%)',
              }}
            />
          </div>
        </div>

        {/* Subject Selector */}
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-[#5A625C]">
            Focus Subject
          </span>
          <div className="neu-well rounded-full p-1 grid grid-cols-3 gap-1">
            {EXAM_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubject(id)}
                className={`py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  subject === id ? 'neu-mint' : 'text-[#5A625C] hover:text-[#1E2420]'
                }`}
              >
                {EXAM_META[id].shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Start / Pause / Reset Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartPause}
            className="neu-mint flex-1 rounded-xl py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Start {phase === 'focus' ? 'Focus' : 'Break'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="neu-btn rounded-xl p-2.5 text-[#5A625C] hover:text-[#1E2420] cursor-pointer"
            title="Reset timer"
            aria-label="Reset timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {canBankPartial && (
          <button
            type="button"
            onClick={handleBankElapsedNow}
            className="neu-btn w-full rounded-xl py-2 text-xs font-semibold text-[#153226] cursor-pointer"
          >
            Log {Math.round((totalPhaseSeconds - secondsLeft) / 60)}m Elapsed Now & Reset
          </button>
        )}

        {/* Quick Offline Study Logger */}
        <div className="pt-2 border-t border-black/6 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#5A625C]">
            Log offline ({EXAM_META[subject].shortLabel}):
          </span>
          <div className="flex items-center gap-1.5">
            {[15, 30, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onLogFocusMinutes(subject, m, 'manual')}
                className="neu-btn rounded-lg px-2 py-1 text-[11px] font-mono tabular-nums font-semibold text-[#1E2420] cursor-pointer flex items-center gap-0.5"
                title={`Log ${m} offline minutes to ${subject}`}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{m}m</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Focus Hours, Progressive Overload & Consistency Streak */}
      <div className="neu-surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-sm text-[#1E2420]">
              Today&apos;s Focus & Streak
            </h3>
            <p className="font-mono tabular-nums text-xs text-[#5A625C] mt-0.5">
              {formatDuration(todayStats.total)} / {dailyTargetHours.toFixed(1)}h target ({targetPercent}%)
            </p>
          </div>
          <div className="neu-mint rounded-xl px-3 py-1.5 text-center shrink-0">
            <div className="font-mono tabular-nums text-sm font-bold text-[#153226]">
              {streak}d
            </div>
            <div className="text-[10px] font-semibold text-[#153226]/80">Streak</div>
          </div>
        </div>

        {/* Daily Progress Bar */}
        <div className="neu-well h-3 rounded-full p-0.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${targetPercent}%`,
              minWidth: targetPercent > 0 ? '8px' : '0px',
              background: 'linear-gradient(90deg, #B8EED8 0%, #9DE0C5 100%)',
            }}
          />
        </div>

        {/* Subject Breakdown Today */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {EXAM_IDS.map((id) => (
            <div key={id} className="neu-well-sm rounded-xl py-2 px-1.5">
              <div className="text-[10px] font-semibold text-[#5A625C]">
                {EXAM_META[id].shortLabel}
              </div>
              <div className="font-mono tabular-nums text-xs font-bold text-[#1E2420] mt-0.5">
                {formatDuration(todayStats.byExam[id])}
              </div>
            </div>
          ))}
        </div>

        {/* Progressive Overload Target Slider (2.5h - 6.5h) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#5A625C]">Daily Target Overload</span>
            <span className="font-mono tabular-nums font-bold text-[#153226]">
              {dailyTargetHours.toFixed(1)}h · {overloadModeLabel}
            </span>
          </div>
          <input
            type="range"
            min={2.5}
            max={6.5}
            step={0.5}
            value={dailyTargetHours}
            onChange={(e) => onChangeDailyTarget(parseFloat(e.target.value))}
            className="neu-range"
            aria-label="Daily focus target hours"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#7C847D]">
            <span>2.5h Warm-Up</span>
            <span>4.5h</span>
            <span>6.5h Peak</span>
          </div>
        </div>

        {/* 7-Day Consistency Mini Strip */}
        <div className="pt-2 border-t border-black/6 space-y-2">
          <div className="text-[11px] font-semibold text-[#5A625C]">
            Last 7 Days Focus Consistency
          </div>
          <div className="grid grid-cols-7 gap-1.5 items-end h-14">
            {last7Days.map((day) => {
              const pct = Math.min(100, Math.round((day.minutes / Math.max(60, targetMinutes)) * 100));
              return (
                <div
                  key={day.key}
                  className="flex flex-col items-center gap-1 h-full justify-end"
                  title={`${day.key}: ${formatDuration(day.minutes)}`}
                >
                  <div className="neu-well-sm w-full flex-1 rounded-md p-0.5 flex items-end overflow-hidden">
                    <div
                      className="w-full rounded-sm transition-all duration-300"
                      style={{
                        height: `${day.minutes > 0 ? Math.max(16, pct) : 0}%`,
                        background: 'linear-gradient(180deg, #B8EED8 0%, #9DE0C5 100%)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[#7C847D]">
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Sprint Queue Summary */}
      <div className="neu-surface rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#C25E24]" />
            <h3 className="font-display font-bold text-sm text-[#1E2420]">
              Active Sprint Queue
            </h3>
          </div>
          <span className="font-mono tabular-nums text-xs font-semibold text-[#5A625C]">
            {sprintTopics.filter((t) => t.completed).length}/{sprintTopics.length}
          </span>
        </div>

        {sprintTopics.length === 0 ? (
          <p className="text-xs text-[#5A625C] leading-relaxed">
            No topics in your sprint queue yet. Click <span className="font-semibold text-[#1E2420]">+ Target</span> on any syllabus topic to queue it here.
          </p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {sprintTopics.map((topic) => (
              <li
                key={topic.id}
                className="flex items-start gap-2.5 py-1.5 border-b border-black/5 last:border-b-0"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={topic.completed}
                  onClick={() => onToggleCompleteTopic(topic.id)}
                  className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 cursor-pointer ${
                    topic.completed ? 'neu-mint' : 'neu-well-sm'
                  }`}
                  aria-label={`Toggle ${topic.name}`}
                >
                  {topic.completed && <Check className="w-3 h-3 text-[#153226] stroke-[3]" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold text-[#5A625C]">
                    {EXAM_META[topic.exam].shortLabel} · {topic.subject}
                  </div>
                  <div
                    className={`text-xs font-medium leading-snug truncate ${
                      topic.completed ? 'line-through text-[#7C847D]' : 'text-[#1E2420]'
                    }`}
                    title={topic.name}
                  >
                    {topic.name}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};
