import {
  AppState,
  ExamId,
  FocusLog,
  IpmatTrack,
  SectionGoalKey,
  SyllabusDaysGoal,
  Topic,
} from '../types';
import {
  getInitialState,
  getLocalDateKey,
  getOffsetDateKey,
  IPMAT_ROHTAK_SEED,
  JIPMAT_SEED,
} from '../data/seedData';

const STORAGE_KEY = 'winter_arc_command_center_v1';

const VALID_IPMAT_TRACKS = new Set<IpmatTrack>(['INDORE', 'ROHTAK', 'JIPMAT']);
const VALID_GOAL_KEYS = new Set<SectionGoalKey>([
  'IITM',
  'IPMAT_INDORE',
  'IPMAT_ROHTAK',
  'JIPMAT',
  'CUET',
]);

function normalizeDaysGoal(rawGoal: unknown): SyllabusDaysGoal {
  if (!rawGoal || typeof rawGoal !== 'object') {
    return { overallDays: null, sectionDays: {} };
  }
  const obj = rawGoal as Record<string, unknown>;
  const overallDays =
    typeof obj.overallDays === 'number' && obj.overallDays >= 1
      ? Math.round(obj.overallDays)
      : null;

  const sectionDays: Partial<Record<SectionGoalKey, number | null>> = {};
  if (obj.sectionDays && typeof obj.sectionDays === 'object') {
    for (const [k, v] of Object.entries(obj.sectionDays as Record<string, unknown>)) {
      if (VALID_GOAL_KEYS.has(k as SectionGoalKey)) {
        sectionDays[k as SectionGoalKey] =
          typeof v === 'number' && v >= 1 ? Math.round(v) : null;
      }
    }
  }
  return { overallDays, sectionDays };
}

function migrateIpmatTracks(topics: Topic[], alreadyMigrated?: boolean): Topic[] {
  if (alreadyMigrated) {
    return topics.map((t) =>
      t.exam === 'IPMAT' && !VALID_IPMAT_TRACKS.has(t.subExam as IpmatTrack)
        ? { ...t, subExam: 'INDORE' }
        : t
    );
  }

  const normalized = topics.map((t) => {
    if (t.exam !== 'IPMAT') return t;
    if (VALID_IPMAT_TRACKS.has(t.subExam as IpmatTrack)) return t;
    if (t.id.startsWith('ipmat_lr_')) {
      return { ...t, subExam: 'JIPMAT' as IpmatTrack };
    }
    return { ...t, subExam: 'INDORE' as IpmatTrack };
  });

  const existingIds = new Set(normalized.map((t) => t.id));
  const hasRohtak = normalized.some((t) => t.exam === 'IPMAT' && t.subExam === 'ROHTAK');
  const hasJipmatExtras = normalized.some((t) => t.id === 'jipmat_qa_1');

  const extras: Topic[] = [];
  if (!hasRohtak) {
    IPMAT_ROHTAK_SEED.forEach((t) => {
      if (!existingIds.has(t.id)) extras.push(t);
    });
  }
  if (!hasJipmatExtras) {
    JIPMAT_SEED.forEach((t) => {
      if (!existingIds.has(t.id)) extras.push(t);
    });
  }

  return [...normalized, ...extras];
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const fallback = getInitialState();

    const baseTopics = Array.isArray(parsed.topics) ? parsed.topics : fallback.topics;
    const migratedTopics = migrateIpmatTracks(baseTopics, parsed.ipmatTracksMigrated);

    return {
      version: 1,
      topics: migratedTopics,
      focusLogs: Array.isArray(parsed.focusLogs) ? parsed.focusLogs : [],
      dailyTargetHours:
        typeof parsed.dailyTargetHours === 'number' &&
        parsed.dailyTargetHours >= 2.5 &&
        parsed.dailyTargetHours <= 6.5
          ? parsed.dailyTargetHours
          : 3.0,
      mockTests: Array.isArray(parsed.mockTests) ? parsed.mockTests : [],
      vaultNotes: Array.isArray(parsed.vaultNotes) ? parsed.vaultNotes : fallback.vaultNotes,
      syllabusDaysGoal: normalizeDaysGoal(parsed.syllabusDaysGoal),
      ipmatTracksMigrated: true,
    };
  } catch {
    return getInitialState();
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues gracefully
  }
}

export function validateBackupPayload(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.topics)) return null;

  const validExams = new Set<ExamId>(['IITM', 'IPMAT', 'CUET']);
  const sanitizedTopics: Topic[] = obj.topics
    .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
    .map((t, idx) => {
      const exam = validExams.has(t.exam as ExamId) ? (t.exam as ExamId) : 'IITM';
      const subExam =
        exam === 'IPMAT'
          ? VALID_IPMAT_TRACKS.has(t.subExam as IpmatTrack)
            ? (t.subExam as IpmatTrack)
            : typeof t.id === 'string' && t.id.startsWith('ipmat_lr_')
            ? 'JIPMAT'
            : 'INDORE'
          : undefined;
      return {
        id: typeof t.id === 'string' && t.id ? t.id : `restored_${Date.now()}_${idx}`,
        exam,
        ...(subExam ? { subExam } : {}),
        subject: typeof t.subject === 'string' && t.subject.trim() ? t.subject.trim() : 'General',
        unit: typeof t.unit === 'string' && t.unit.trim() ? t.unit.trim() : 'Core Unit',
        name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : 'Untitled Topic',
        completed: Boolean(t.completed),
        inTarget: Boolean(t.inTarget),
        synergy: Array.isArray(t.synergy)
          ? t.synergy.filter((s): s is ExamId => validExams.has(s as ExamId))
          : [],
        links: Array.isArray(t.links)
          ? t.links
              .filter(
                (l): l is Record<string, unknown> =>
                  Boolean(l && typeof l === 'object' && typeof l.url === 'string')
              )
              .map((l, lIdx) => ({
                id: typeof l.id === 'string' ? l.id : `link_${idx}_${lIdx}`,
                label: typeof l.label === 'string' && l.label.trim() ? l.label.trim() : 'Drive Resource',
                url: String(l.url),
              }))
          : [],
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      };
    });

  return {
    version: 1,
    topics: sanitizedTopics,
    focusLogs: Array.isArray(obj.focusLogs) ? (obj.focusLogs as FocusLog[]) : [],
    dailyTargetHours:
      typeof obj.dailyTargetHours === 'number' &&
      obj.dailyTargetHours >= 2.5 &&
      obj.dailyTargetHours <= 6.5
        ? obj.dailyTargetHours
        : 3.0,
    mockTests: Array.isArray(obj.mockTests) ? (obj.mockTests as AppState['mockTests']) : [],
    vaultNotes: Array.isArray(obj.vaultNotes) ? (obj.vaultNotes as AppState['vaultNotes']) : [],
    syllabusDaysGoal: normalizeDaysGoal(obj.syllabusDaysGoal),
    ipmatTracksMigrated: true,
  };
}

export function calculateStreak(focusLogs: FocusLog[]): number {
  const minutesByDate = new Map<string, number>();
  for (const log of focusLogs) {
    if (log.minutes > 0) {
      minutesByDate.set(log.date, (minutesByDate.get(log.date) || 0) + log.minutes);
    }
  }

  const todayKey = getLocalDateKey();
  const yesterdayKey = getOffsetDateKey(-1);

  let cursorOffset = 0;
  if ((minutesByDate.get(todayKey) || 0) > 0) {
    cursorOffset = 0;
  } else if ((minutesByDate.get(yesterdayKey) || 0) > 0) {
    cursorOffset = -1;
  } else {
    return 0;
  }

  let streak = 0;
  while (true) {
    const key = getOffsetDateKey(cursorOffset);
    if ((minutesByDate.get(key) || 0) > 0) {
      streak += 1;
      cursorOffset -= 1;
    } else {
      break;
    }
  }
  return streak;
}

export function formatDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
