export type ExamId = 'IITM' | 'IPMAT' | 'CUET';

export type IpmatTrack = 'INDORE' | 'ROHTAK' | 'JIPMAT';

export type SectionGoalKey =
  | 'IITM'
  | 'IPMAT_INDORE'
  | 'IPMAT_ROHTAK'
  | 'JIPMAT'
  | 'CUET';

export type FilterStatus = 'all' | 'target' | 'pending' | 'completed';

export interface DriveLink {
  id: string;
  label: string;
  url: string;
}

export interface Topic {
  id: string;
  exam: ExamId;
  subExam?: IpmatTrack; // Used when exam === 'IPMAT'
  subject: string;
  unit: string;
  name: string;
  completed: boolean;
  inTarget: boolean;
  synergy: ExamId[];
  links: DriveLink[];
  createdAt: number;
}

export interface FocusLog {
  id: string;
  date: string; // YYYY-MM-DD local date
  exam: ExamId;
  minutes: number;
  mode: '50/10' | '25/5' | 'manual';
  timestamp: number;
}

export interface MockTest {
  id: string;
  exam: ExamId;
  name: string;
  date: string; // YYYY-MM-DD
  score: number;
  maxMarks: number;
  wrongQuestions: number;
  attemptedQuestions?: number;
  scorePercent: number;
  netAccuracyPercent: number;
  createdAt: number;
}

export interface VaultNote {
  id: string;
  title: string;
  content: string;
  tags: ExamId[];
  reviewed: boolean;
  createdAt: number;
}

export interface SyllabusDaysGoal {
  overallDays: number | null;
  overallStartDate?: string | null;
  sectionDays: Partial<Record<SectionGoalKey, number | null>>;
}

export interface AppState {
  version: 1;
  topics: Topic[];
  focusLogs: FocusLog[];
  dailyTargetHours: number;
  mockTests: MockTest[];
  vaultNotes: VaultNote[];
  syllabusDaysGoal: SyllabusDaysGoal;
  ipmatTracksMigrated?: boolean;
}

export const EXAM_META: Record<
  ExamId,
  {
    id: ExamId;
    label: string;
    shortLabel: string;
    subtitle: string;
  }
> = {
  IITM: {
    id: 'IITM',
    label: 'IITM Qualifier',
    shortLabel: 'IITM',
    subtitle: 'IIT Madras BS Data Science Qualifier',
  },
  IPMAT: {
    id: 'IPMAT',
    label: 'IPMAT & JIPMAT',
    shortLabel: 'IPMAT',
    subtitle: 'IPMAT Indore · IPMAT Rohtak · JIPMAT',
  },
  CUET: {
    id: 'CUET',
    label: 'CUET UG',
    shortLabel: 'CUET',
    subtitle: 'Commerce Domain, English & General Test',
  },
};

export const IPMAT_TRACK_META: Record<
  IpmatTrack,
  {
    id: IpmatTrack;
    label: string;
    shortLabel: string;
    subtitle: string;
    goalKey: SectionGoalKey;
  }
> = {
  INDORE: {
    id: 'INDORE',
    label: 'IPMAT Indore',
    shortLabel: 'Indore',
    subtitle: 'QA (Short Answer + MCQ) & Verbal Ability',
    goalKey: 'IPMAT_INDORE',
  },
  ROHTAK: {
    id: 'ROHTAK',
    label: 'IPMAT Rohtak',
    shortLabel: 'Rohtak',
    subtitle: 'Quantitative Ability, Logical Reasoning & Verbal Ability',
    goalKey: 'IPMAT_ROHTAK',
  },
  JIPMAT: {
    id: 'JIPMAT',
    label: 'JIPMAT',
    shortLabel: 'JIPMAT',
    subtitle: 'QA, Data Interpretation & LR (DILR), and Verbal Ability',
    goalKey: 'JIPMAT',
  },
};

export const EXAM_IDS: ExamId[] = ['IITM', 'IPMAT', 'CUET'];
export const IPMAT_TRACKS: IpmatTrack[] = ['INDORE', 'ROHTAK', 'JIPMAT'];
