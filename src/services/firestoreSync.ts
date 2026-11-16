import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AppState,
  DriveLink,
  ExamId,
  FocusLog,
  IpmatTrack,
  MockTest,
  SyllabusDaysGoal,
  Topic,
  VaultNote,
} from '../types';

function clampString(val: string, fallback: string, maxLen: number): string {
  const trimmed = (val || '').trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

function sanitizeOptionalDays(val: number | null | undefined): number {
  if (typeof val !== 'number' || Number.isNaN(val) || val <= 0) return 0;
  return Math.min(1000, Math.round(val));
}

function buildPreferencesPayload(
  uid: string,
  dailyTargetHours: number,
  daysGoal: SyllabusDaysGoal
) {
  const overallDays = sanitizeOptionalDays(daysGoal.overallDays);
  const overallStartDate =
    overallDays > 0 &&
    typeof daysGoal.overallStartDate === 'string' &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(daysGoal.overallStartDate)
      ? daysGoal.overallStartDate
      : '';

  return {
    ownerId: uid,
    dailyTargetHours: Math.min(6.5, Math.max(2.5, Number(dailyTargetHours) || 3.0)),
    overallDays,
    overallStartDate,
    iitmDays: sanitizeOptionalDays(daysGoal.sectionDays.IITM),
    ipmatIndoreDays: sanitizeOptionalDays(daysGoal.sectionDays.IPMAT_INDORE),
    ipmatRohtakDays: sanitizeOptionalDays(daysGoal.sectionDays.IPMAT_ROHTAK),
    jipmatDays: sanitizeOptionalDays(daysGoal.sectionDays.JIPMAT),
    cuetDays: sanitizeOptionalDays(daysGoal.sectionDays.CUET),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeLinks(links: DriveLink[]): DriveLink[] {
  return (links || []).slice(0, 20).map((l, idx) => ({
    id: clampString(l.id, `lnk_${idx}`, 128),
    label: clampString(l.label, 'Drive Resource', 160),
    url: clampString(l.url, 'https://drive.google.com', 1024),
  }));
}

function sanitizeSynergy(synergy: ExamId[], homeExam: ExamId): ExamId[] {
  const valid = new Set<ExamId>(['IITM', 'IPMAT', 'CUET']);
  return Array.from(new Set(synergy.filter((s) => valid.has(s) && s !== homeExam))).slice(0, 3);
}

function buildTopicCreatePayload(uid: string, t: Topic) {
  return {
    ownerId: uid,
    exam: t.exam,
    subExam: t.exam === 'IPMAT' ? t.subExam || 'INDORE' : '',
    subject: clampString(t.subject, 'General', 120),
    unit: clampString(t.unit, 'Core Unit', 160),
    name: clampString(t.name, 'Untitled Topic', 260),
    completed: Boolean(t.completed),
    inTarget: Boolean(t.inTarget),
    synergy: sanitizeSynergy(t.synergy || [], t.exam),
    links: sanitizeLinks(t.links || []),
    clientCreatedAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildFocusLogPayload(uid: string, log: FocusLog) {
  return {
    ownerId: uid,
    date: clampString(log.date, new Date().toISOString().slice(0, 10), 10),
    exam: log.exam,
    minutes: Math.min(600, Math.max(1, Math.round(log.minutes))),
    mode: log.mode,
    timestamp: typeof log.timestamp === 'number' ? log.timestamp : Date.now(),
    createdAt: serverTimestamp(),
  };
}

function buildMockPayload(uid: string, m: MockTest) {
  return {
    ownerId: uid,
    exam: m.exam,
    name: clampString(m.name, 'Mock Test', 160),
    date: clampString(m.date, new Date().toISOString().slice(0, 10), 10),
    score: Math.min(10000, Math.max(-1000, Number(m.score) || 0)),
    maxMarks: Math.min(10000, Math.max(1, Number(m.maxMarks) || 100)),
    wrongQuestions: Math.min(1000, Math.max(0, Math.round(m.wrongQuestions) || 0)),
    attemptedQuestions:
      typeof m.attemptedQuestions === 'number' && m.attemptedQuestions > 0
        ? Math.min(1000, Math.round(m.attemptedQuestions))
        : 0,
    scorePercent: Math.min(100, Math.max(0, Number(m.scorePercent) || 0)),
    netAccuracyPercent: Math.min(100, Math.max(0, Number(m.netAccuracyPercent) || 0)),
    clientCreatedAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
    createdAt: serverTimestamp(),
  };
}

function buildVaultNotePayload(uid: string, n: VaultNote) {
  const validTags = Array.from(
    new Set((n.tags || []).filter((t): t is ExamId => t === 'IITM' || t === 'IPMAT' || t === 'CUET'))
  ).slice(0, 3);
  if (validTags.length === 0) validTags.push('IITM');

  return {
    ownerId: uid,
    title: clampString(n.title, 'Formula Note', 160),
    content: clampString(n.content, n.title || 'Note', 4000),
    tags: validTags,
    reviewed: Boolean(n.reviewed),
    clientCreatedAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function bootstrapCloudSync(uid: string, localState: AppState): Promise<boolean> {
  const prefPath = `users/${uid}/settings/preferences`;
  const topicsPath = `users/${uid}/topics`;
  try {
    const [prefSnap, topicsSnap] = await Promise.all([
      getDoc(doc(db, prefPath)),
      getDocs(query(collection(db, topicsPath), where('ownerId', '==', uid), limit(1))),
    ]);

    // If user already has cloud data, do not overwrite it with local defaults
    if (prefSnap.exists() || !topicsSnap.empty) {
      return false;
    }

    // Seed cloud account with the user's current local state
    await writeStateBatches(uid, localState);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, topicsPath);
  }
}

async function writeStateBatches(uid: string, state: AppState): Promise<void> {
  const operations: Array<() => Promise<void>> = [];

  const allOps: Array<{ refPath: string; data: Record<string, unknown> }> = [
    {
      refPath: `users/${uid}/settings/preferences`,
      data: buildPreferencesPayload(uid, state.dailyTargetHours, state.syllabusDaysGoal),
    },
    ...state.topics.map((t) => ({
      refPath: `users/${uid}/topics/${t.id}`,
      data: buildTopicCreatePayload(uid, t),
    })),
    ...state.focusLogs.map((l) => ({
      refPath: `users/${uid}/focusLogs/${l.id}`,
      data: buildFocusLogPayload(uid, l),
    })),
    ...state.mockTests.map((m) => ({
      refPath: `users/${uid}/mockTests/${m.id}`,
      data: buildMockPayload(uid, m),
    })),
    ...state.vaultNotes.map((n) => ({
      refPath: `users/${uid}/vaultNotes/${n.id}`,
      data: buildVaultNotePayload(uid, n),
    })),
  ];

  for (let i = 0; i < allOps.length; i += 400) {
    const chunk = allOps.slice(i, i + 400);
    operations.push(async () => {
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(db, item.refPath), item.data);
      }
      await batch.commit();
    });
  }

  for (const run of operations) {
    await run();
  }
}

export async function replaceCloudWorkspaceFromBackup(
  uid: string,
  backup: AppState
): Promise<void> {
  const userBase = `users/${uid}`;
  try {
    const subcollections = ['topics', 'focusLogs', 'mockTests', 'vaultNotes'];
    for (const sub of subcollections) {
      const snap = await getDocs(
        query(collection(db, `${userBase}/${sub}`), where('ownerId', '==', uid))
      );
      if (!snap.empty) {
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    }
    await writeStateBatches(uid, backup);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userBase);
  }
}

export interface WorkspaceSnapshotHandlers {
  onPreferences: (dailyTargetHours: number, daysGoal: SyllabusDaysGoal) => void;
  onTopics: (topics: Topic[]) => void;
  onFocusLogs: (logs: FocusLog[]) => void;
  onMockTests: (mocks: MockTest[]) => void;
  onVaultNotes: (notes: VaultNote[]) => void;
}

export function subscribeToUserWorkspace(
  uid: string,
  handlers: WorkspaceSnapshotHandlers
): () => void {
  const prefPath = `users/${uid}/settings/preferences`;
  const topicsPath = `users/${uid}/topics`;
  const focusPath = `users/${uid}/focusLogs`;
  const mocksPath = `users/${uid}/mockTests`;
  const vaultPath = `users/${uid}/vaultNotes`;

  const unsubPref = onSnapshot(
    doc(db, prefPath),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const overallDays =
        typeof d.overallDays === 'number' && d.overallDays > 0 ? d.overallDays : null;
      const overallStartDate =
        overallDays !== null &&
        typeof d.overallStartDate === 'string' &&
        /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.overallStartDate)
          ? d.overallStartDate
          : null;
      const daysGoal: SyllabusDaysGoal = {
        overallDays,
        overallStartDate,
        sectionDays: {
          IITM: typeof d.iitmDays === 'number' && d.iitmDays > 0 ? d.iitmDays : null,
          IPMAT_INDORE:
            typeof d.ipmatIndoreDays === 'number' && d.ipmatIndoreDays > 0
              ? d.ipmatIndoreDays
              : null,
          IPMAT_ROHTAK:
            typeof d.ipmatRohtakDays === 'number' && d.ipmatRohtakDays > 0
              ? d.ipmatRohtakDays
              : null,
          JIPMAT: typeof d.jipmatDays === 'number' && d.jipmatDays > 0 ? d.jipmatDays : null,
          CUET: typeof d.cuetDays === 'number' && d.cuetDays > 0 ? d.cuetDays : null,
        },
      };
      const hours =
        typeof d.dailyTargetHours === 'number' &&
        d.dailyTargetHours >= 2.5 &&
        d.dailyTargetHours <= 6.5
          ? d.dailyTargetHours
          : 3.0;
      handlers.onPreferences(hours, daysGoal);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, prefPath);
    }
  );

  const unsubTopics = onSnapshot(
    query(collection(db, topicsPath), where('ownerId', '==', uid)),
    (snap) => {
      const list: Topic[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const exam = d.exam as ExamId;
        return {
          id: docSnap.id,
          exam,
          ...(exam === 'IPMAT'
            ? { subExam: (d.subExam || 'INDORE') as IpmatTrack }
            : {}),
          subject: String(d.subject || 'General'),
          unit: String(d.unit || 'Core Unit'),
          name: String(d.name || 'Untitled Topic'),
          completed: Boolean(d.completed),
          inTarget: Boolean(d.inTarget),
          synergy: Array.isArray(d.synergy) ? (d.synergy as ExamId[]) : [],
          links: Array.isArray(d.links) ? (d.links as DriveLink[]) : [],
          createdAt: typeof d.clientCreatedAt === 'number' ? d.clientCreatedAt : Date.now(),
        };
      });
      list.sort((a, b) => a.createdAt - b.createdAt);
      handlers.onTopics(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, topicsPath);
    }
  );

  const unsubFocus = onSnapshot(
    query(collection(db, focusPath), where('ownerId', '==', uid)),
    (snap) => {
      const list: FocusLog[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          date: String(d.date),
          exam: d.exam as ExamId,
          minutes: Number(d.minutes) || 0,
          mode: d.mode as FocusLog['mode'],
          timestamp: typeof d.timestamp === 'number' ? d.timestamp : Date.now(),
        };
      });
      list.sort((a, b) => a.timestamp - b.timestamp);
      handlers.onFocusLogs(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, focusPath);
    }
  );

  const unsubMocks = onSnapshot(
    query(collection(db, mocksPath), where('ownerId', '==', uid)),
    (snap) => {
      const list: MockTest[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const attempted =
          typeof d.attemptedQuestions === 'number' && d.attemptedQuestions > 0
            ? d.attemptedQuestions
            : undefined;
        return {
          id: docSnap.id,
          exam: d.exam as ExamId,
          name: String(d.name),
          date: String(d.date),
          score: Number(d.score) || 0,
          maxMarks: Number(d.maxMarks) || 100,
          wrongQuestions: Number(d.wrongQuestions) || 0,
          ...(attempted ? { attemptedQuestions: attempted } : {}),
          scorePercent: Number(d.scorePercent) || 0,
          netAccuracyPercent: Number(d.netAccuracyPercent) || 0,
          createdAt: typeof d.clientCreatedAt === 'number' ? d.clientCreatedAt : Date.now(),
        };
      });
      list.sort((a, b) => a.createdAt - b.createdAt);
      handlers.onMockTests(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, mocksPath);
    }
  );

  const unsubVault = onSnapshot(
    query(collection(db, vaultPath), where('ownerId', '==', uid)),
    (snap) => {
      const list: VaultNote[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: String(d.title),
          content: String(d.content),
          tags: Array.isArray(d.tags) ? (d.tags as ExamId[]) : ['IITM'],
          reviewed: Boolean(d.reviewed),
          createdAt: typeof d.clientCreatedAt === 'number' ? d.clientCreatedAt : Date.now(),
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      handlers.onVaultNotes(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, vaultPath);
    }
  );

  return () => {
    unsubPref();
    unsubTopics();
    unsubFocus();
    unsubMocks();
    unsubVault();
  };
}

export async function savePreferencesToCloud(
  uid: string,
  dailyTargetHours: number,
  daysGoal: SyllabusDaysGoal
): Promise<void> {
  const path = `users/${uid}/settings/preferences`;
  try {
    await setDoc(
      doc(db, path),
      buildPreferencesPayload(uid, dailyTargetHours, daysGoal)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createTopicInCloud(uid: string, topic: Topic): Promise<void> {
  const path = `users/${uid}/topics/${topic.id}`;
  try {
    await setDoc(doc(db, path), buildTopicCreatePayload(uid, topic));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createManyTopicsInCloud(uid: string, topics: Topic[]): Promise<void> {
  const basePath = `users/${uid}/topics`;
  try {
    for (let i = 0; i < topics.length; i += 400) {
      const batch = writeBatch(db);
      for (const t of topics.slice(i, i + 400)) {
        batch.set(doc(db, `${basePath}/${t.id}`), buildTopicCreatePayload(uid, t));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, basePath);
  }
}

export async function updateTopicFieldsInCloud(
  uid: string,
  topicId: string,
  fields: Partial<{
    completed: boolean;
    inTarget: boolean;
    synergy: ExamId[];
    links: DriveLink[];
    exam: ExamId;
    subExam: string;
    subject: string;
    unit: string;
    name: string;
  }>,
  homeExam: ExamId
): Promise<void> {
  const path = `users/${uid}/topics/${topicId}`;
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof fields.completed === 'boolean') payload.completed = fields.completed;
  if (typeof fields.inTarget === 'boolean') payload.inTarget = fields.inTarget;
  if (fields.synergy) payload.synergy = sanitizeSynergy(fields.synergy, homeExam);
  if (fields.links) payload.links = sanitizeLinks(fields.links);
  if (fields.exam) payload.exam = fields.exam;
  if (typeof fields.subExam === 'string') payload.subExam = fields.subExam;
  if (typeof fields.subject === 'string')
    payload.subject = clampString(fields.subject, 'General', 120);
  if (typeof fields.unit === 'string')
    payload.unit = clampString(fields.unit, 'Core Unit', 160);
  if (typeof fields.name === 'string')
    payload.name = clampString(fields.name, 'Untitled Topic', 260);

  try {
    await updateDoc(doc(db, path), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTopicFromCloud(uid: string, topicId: string): Promise<void> {
  const path = `users/${uid}/topics/${topicId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addFocusLogToCloud(uid: string, log: FocusLog): Promise<void> {
  const path = `users/${uid}/focusLogs/${log.id}`;
  try {
    await setDoc(doc(db, path), buildFocusLogPayload(uid, log));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function addMockTestToCloud(uid: string, mock: MockTest): Promise<void> {
  const path = `users/${uid}/mockTests/${mock.id}`;
  try {
    await setDoc(doc(db, path), buildMockPayload(uid, mock));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteMockTestFromCloud(uid: string, mockId: string): Promise<void> {
  const path = `users/${uid}/mockTests/${mockId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addVaultNoteToCloud(uid: string, note: VaultNote): Promise<void> {
  const path = `users/${uid}/vaultNotes/${note.id}`;
  try {
    await setDoc(doc(db, path), buildVaultNotePayload(uid, note));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVaultNoteFieldsInCloud(
  uid: string,
  noteId: string,
  fields: Partial<{ reviewed: boolean; title: string; content: string; tags: ExamId[] }>
): Promise<void> {
  const path = `users/${uid}/vaultNotes/${noteId}`;
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof fields.reviewed === 'boolean') payload.reviewed = fields.reviewed;
  if (typeof fields.title === 'string')
    payload.title = clampString(fields.title, 'Formula Note', 160);
  if (typeof fields.content === 'string')
    payload.content = clampString(fields.content, 'Note', 4000);
  if (fields.tags) payload.tags = fields.tags.slice(0, 3);

  try {
    await updateDoc(doc(db, path), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVaultNoteFromCloud(uid: string, noteId: string): Promise<void> {
  const path = `users/${uid}/vaultNotes/${noteId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
