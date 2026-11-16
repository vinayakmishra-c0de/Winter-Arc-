import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { RotateCcw, X } from 'lucide-react';
import { AppState, ExamId, IpmatTrack, SectionGoalKey, Topic } from './types';
import { createId, getLocalDateKey } from './data/seedData';
import {
  loadAppState,
  saveAppState,
  validateBackupPayload,
} from './utils/storage';
import {
  downloadSampleExcelTemplate,
  exportSectionToExcel,
  parseExcelTopics,
} from './utils/excel';
import { auth } from './firebase';
import {
  addFocusLogToCloud,
  addMockTestToCloud,
  addVaultNoteToCloud,
  bootstrapCloudSync,
  createManyTopicsInCloud,
  createTopicInCloud,
  deleteMockTestFromCloud,
  deleteTopicFromCloud,
  deleteVaultNoteFromCloud,
  replaceCloudWorkspaceFromBackup,
  savePreferencesToCloud,
  subscribeToUserWorkspace,
  updateTopicFieldsInCloud,
  updateVaultNoteFieldsInCloud,
} from './services/firestoreSync';
import { ActiveWorkspace, MasterGoalHeader } from './components/MasterGoalHeader';
import { LoginPage } from './components/LoginPage';
import { SyllabusEngine } from './components/SyllabusEngine';
import { FocusTimerWidget } from './components/FocusTimerWidget';
import { MockAnalyticsView } from './components/MockAnalyticsView';
import { MistakeVaultDrawer } from './components/MistakeVaultDrawer';
import {
  DaysGoalModalTarget,
  DriveLinkModal,
  RestoreConfirmModal,
  SyllabusDaysModal,
  SynergyModal,
  TopicFormModal,
} from './components/TopicModals';

interface ToastState {
  id: number;
  message: string;
  tone: 'neutral' | 'error';
  undoAction?: () => void;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace>('syllabus');
  const [activeExam, setActiveExam] = useState<ExamId>('IITM');
  const [activeIpmatTrack, setActiveIpmatTrack] = useState<IpmatTrack>('INDORE');
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  // Modal states
  const [topicModalState, setTopicModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    topic: Topic | null;
  }>({ isOpen: false, mode: 'add', topic: null });

  const [daysModalTarget, setDaysModalTarget] = useState<DaysGoalModalTarget | null>(null);
  const [driveModalTopicId, setDriveModalTopicId] = useState<string | null>(null);
  const [synergyModalTopicId, setSynergyModalTopicId] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<AppState | null>(null);

  // Toast state
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const prefSyncTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, options?: { tone?: 'neutral' | 'error'; undoAction?: () => void }) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      const next: ToastState = {
        id: Date.now(),
        message,
        tone: options?.tone ?? 'neutral',
        undoAction: options?.undoAction,
      };
      setToast(next);
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, options?.undoAction ? 5500 : 3400);
    },
    []
  );

  // Persist every state update to localStorage as offline cache
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // Firebase Auth & Real-Time Firestore Listeners
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }
      setUser(nextUser);
      setAuthLoading(false);

      if (!nextUser) return;

      try {
        const seededNewCloud = await bootstrapCloudSync(nextUser.uid, stateRef.current);
        if (seededNewCloud) {
          showToast('Synced local workspace to Firebase Cloud');
        }

        unsubCloud = subscribeToUserWorkspace(nextUser.uid, {
          onPreferences: (dailyTargetHours, syllabusDaysGoal) => {
            setState((prev) => ({
              ...prev,
              dailyTargetHours,
              syllabusDaysGoal,
            }));
          },
          onTopics: (topics) => {
            setState((prev) => ({ ...prev, topics }));
          },
          onFocusLogs: (focusLogs) => {
            setState((prev) => ({ ...prev, focusLogs }));
          },
          onMockTests: (mockTests) => {
            setState((prev) => ({ ...prev, mockTests }));
          },
          onVaultNotes: (vaultNotes) => {
            setState((prev) => ({ ...prev, vaultNotes }));
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Cloud sync connection error';
        console.error(msg);
        showToast('Cloud sync failed — continuing with local cache', { tone: 'error' });
      }
    });

    return () => {
      unsubAuth();
      if (unsubCloud) unsubCloud();
    };
  }, [showToast]);

  const handleEmailPasswordLogin = async (email: string, password: string) => {
    setLoginError('');
    setLoginSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Signed in — Cloud Sync active');
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setLoginError('Invalid email or password.');
      } else if (code === 'auth/invalid-email') {
        setLoginError('Please enter a valid email address.');
      } else if (code === 'auth/user-disabled') {
        setLoginError('This account has been disabled.');
      } else if (code === 'auth/too-many-requests') {
        setLoginError('Too many failed attempts. Please wait a moment and try again.');
      } else if (code === 'auth/operation-not-allowed') {
        setLoginError(
          'Email/Password sign-in is not enabled yet in Firebase Console.'
        );
      } else {
        setLoginError('Unable to sign in. Please check your credentials.');
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setLoginError('');
    } catch {
      showToast('Failed to sign out', { tone: 'error' });
    }
  };

  // Global Escape handler for drawers/modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingBackup) setPendingBackup(null);
      else if (daysModalTarget) setDaysModalTarget(null);
      else if (driveModalTopicId) setDriveModalTopicId(null);
      else if (synergyModalTopicId) setSynergyModalTopicId(null);
      else if (topicModalState.isOpen)
        setTopicModalState((prev) => ({ ...prev, isOpen: false }));
      else if (isVaultOpen) setIsVaultOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    pendingBackup,
    daysModalTarget,
    driveModalTopicId,
    synergyModalTopicId,
    topicModalState.isOpen,
    isVaultOpen,
  ]);

  const driveModalTopic = useMemo(
    () => state.topics.find((t) => t.id === driveModalTopicId) ?? null,
    [state.topics, driveModalTopicId]
  );

  const synergyModalTopic = useMemo(
    () => state.topics.find((t) => t.id === synergyModalTopicId) ?? null,
    [state.topics, synergyModalTopicId]
  );

  const sprintTopics = useMemo(
    () => state.topics.filter((t) => t.inTarget),
    [state.topics]
  );

  const existingSubjectsForActiveExam = useMemo(() => {
    const set = new Set<string>();
    state.topics
      .filter((t) =>
        activeExam === 'IPMAT'
          ? t.exam === 'IPMAT' && (t.subExam || 'INDORE') === activeIpmatTrack
          : t.exam === activeExam
      )
      .forEach((t) => set.add(t.subject));
    return Array.from(set).sort();
  }, [state.topics, activeExam, activeIpmatTrack]);

  // Manual Completion Days Goal Handlers
  const handleOpenOverallDaysModal = (remainingTopics: number) => {
    setDaysModalTarget({
      scope: 'OVERALL',
      label: 'All Syllabi Combined (Master Goal)',
      remainingTopics,
      currentDays: state.syllabusDaysGoal.overallDays,
    });
  };

  const handleOpenSectionDaysModal = (
    goalKey: SectionGoalKey,
    label: string,
    remainingTopics: number
  ) => {
    setDaysModalTarget({
      scope: goalKey,
      label,
      remainingTopics,
      currentDays: state.syllabusDaysGoal.sectionDays[goalKey] ?? null,
    });
  };

  const handleSaveDaysGoal = (
    scope: 'OVERALL' | SectionGoalKey,
    days: number | null
  ) => {
    const nextGoal =
      scope === 'OVERALL'
        ? { ...state.syllabusDaysGoal, overallDays: days }
        : {
            ...state.syllabusDaysGoal,
            sectionDays: { ...state.syllabusDaysGoal.sectionDays, [scope]: days },
          };

    setState((prev) => ({ ...prev, syllabusDaysGoal: nextGoal }));
    setDaysModalTarget(null);

    if (user) {
      void savePreferencesToCloud(user.uid, state.dailyTargetHours, nextGoal).catch(() =>
        showToast('Cloud save failed for timeline', { tone: 'error' })
      );
    }

    showToast(
      days ? `Saved ${days}-day completion target` : 'Cleared completion days target'
    );
  };

  // Syllabus Actions
  const handleToggleComplete = (topicId: string) => {
    const target = state.topics.find((t) => t.id === topicId);
    if (!target) return;
    const nextCompleted = !target.completed;

    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === topicId ? { ...t, completed: nextCompleted } : t
      ),
    }));

    if (user) {
      void updateTopicFieldsInCloud(
        user.uid,
        topicId,
        { completed: nextCompleted },
        target.exam
      ).catch(() => showToast('Failed to sync topic completion', { tone: 'error' }));
    }
  };

  const handleToggleTarget = (topicId: string) => {
    const target = state.topics.find((t) => t.id === topicId);
    if (!target) return;
    const nextInTarget = !target.inTarget;

    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === topicId ? { ...t, inTarget: nextInTarget } : t
      ),
    }));

    if (user) {
      void updateTopicFieldsInCloud(
        user.uid,
        topicId,
        { inTarget: nextInTarget },
        target.exam
      ).catch(() => showToast('Failed to sync sprint target', { tone: 'error' }));
    }
  };

  const handleSaveTopicModal = (data: {
    exam: ExamId;
    subExam?: IpmatTrack;
    subject: string;
    unit: string;
    name: string;
    inTarget: boolean;
    synergy: ExamId[];
  }) => {
    if (topicModalState.mode === 'add') {
      const newTopic: Topic = {
        id: createId('top'),
        exam: data.exam,
        ...(data.exam === 'IPMAT' ? { subExam: data.subExam || activeIpmatTrack } : {}),
        subject: data.subject,
        unit: data.unit,
        name: data.name,
        completed: false,
        inTarget: data.inTarget,
        synergy: data.synergy,
        links: [],
        createdAt: Date.now(),
      };
      setState((prev) => ({
        ...prev,
        topics: [...prev.topics, newTopic],
      }));
      setActiveExam(data.exam);
      if (data.exam === 'IPMAT' && data.subExam) {
        setActiveIpmatTrack(data.subExam);
      }

      if (user) {
        void createTopicInCloud(user.uid, newTopic).catch(() =>
          showToast('Failed to sync new topic to cloud', { tone: 'error' })
        );
      }
      showToast(`Added "${data.name}"`);
    } else if (topicModalState.topic) {
      const editId = topicModalState.topic.id;
      const nextSubExam = data.exam === 'IPMAT' ? data.subExam || 'INDORE' : undefined;
      setState((prev) => ({
        ...prev,
        topics: prev.topics.map((t) =>
          t.id === editId
            ? {
                ...t,
                exam: data.exam,
                subExam: nextSubExam,
                subject: data.subject,
                unit: data.unit,
                name: data.name,
                inTarget: data.inTarget,
                synergy: data.synergy,
              }
            : t
        ),
      }));

      if (user) {
        void updateTopicFieldsInCloud(
          user.uid,
          editId,
          {
            exam: data.exam,
            subExam: nextSubExam || '',
            subject: data.subject,
            unit: data.unit,
            name: data.name,
            inTarget: data.inTarget,
            synergy: data.synergy,
          },
          data.exam
        ).catch(() => showToast('Failed to sync topic edit', { tone: 'error' }));
      }
      showToast(`Updated "${data.name}"`);
    }
    setTopicModalState({ isOpen: false, mode: 'add', topic: null });
  };

  const handleDeleteTopic = (topicId: string) => {
    const deletedIndex = state.topics.findIndex((t) => t.id === topicId);
    const deletedTopic = state.topics[deletedIndex];
    if (!deletedTopic) return;

    setState((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t.id !== topicId),
    }));

    if (user) {
      void deleteTopicFromCloud(user.uid, topicId).catch(() =>
        showToast('Failed to delete topic in cloud', { tone: 'error' })
      );
    }

    showToast(`Deleted "${deletedTopic.name}"`, {
      undoAction: () => {
        setState((prev) => {
          if (prev.topics.some((t) => t.id === deletedTopic.id)) return prev;
          const copy = [...prev.topics];
          copy.splice(Math.min(deletedIndex, copy.length), 0, deletedTopic);
          return { ...prev, topics: copy };
        });
        if (user) {
          void createTopicInCloud(user.uid, deletedTopic).catch(() =>
            showToast('Failed to restore topic in cloud', { tone: 'error' })
          );
        }
        setToast(null);
      },
    });
  };

  // Drive Links
  const handleAddDriveLink = (topicId: string, label: string, url: string) => {
    const target = state.topics.find((t) => t.id === topicId);
    if (!target) return;
    const nextLinks = [...target.links, { id: createId('lnk'), label, url }].slice(0, 20);

    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === topicId ? { ...t, links: nextLinks } : t
      ),
    }));
    setDriveModalTopicId(null);

    if (user) {
      void updateTopicFieldsInCloud(
        user.uid,
        topicId,
        { links: nextLinks },
        target.exam
      ).catch(() => showToast('Failed to sync Drive link', { tone: 'error' }));
    }
    showToast(`Saved Drive link "${label}"`);
  };

  const handleCopyDriveLink = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Copied "${label}" link to clipboard`);
    } catch {
      showToast('Clipboard copy failed — right-click the link to copy', { tone: 'error' });
    }
  };

  const handleDeleteDriveLink = (topicId: string, linkId: string) => {
    const target = state.topics.find((t) => t.id === topicId);
    if (!target) return;
    const nextLinks = target.links.filter((l) => l.id !== linkId);

    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === topicId ? { ...t, links: nextLinks } : t
      ),
    }));

    if (user) {
      void updateTopicFieldsInCloud(
        user.uid,
        topicId,
        { links: nextLinks },
        target.exam
      ).catch(() => showToast('Failed to remove Drive link in cloud', { tone: 'error' }));
    }
    showToast('Removed Drive link');
  };

  // Synergy
  const handleSaveSynergy = (topicId: string, synergy: ExamId[]) => {
    const target = state.topics.find((t) => t.id === topicId);
    if (!target) return;

    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === topicId ? { ...t, synergy } : t
      ),
    }));
    setSynergyModalTopicId(null);

    if (user) {
      void updateTopicFieldsInCloud(
        user.uid,
        topicId,
        { synergy },
        target.exam
      ).catch(() => showToast('Failed to sync synergy tags', { tone: 'error' }));
    }
    showToast('Updated cross-exam synergy tags');
  };

  // Excel Import / Export / Sample Template
  const handleImportExcelFile = async (file: File) => {
    try {
      const { topics: imported, skippedDuplicates } = await parseExcelTopics(
        file,
        activeExam,
        activeIpmatTrack,
        state.topics
      );
      setState((prev) => ({
        ...prev,
        topics: [...prev.topics, ...imported],
      }));

      if (user && imported.length > 0) {
        void createManyTopicsInCloud(user.uid, imported).catch(() =>
          showToast('Failed to upload imported Excel topics to cloud', { tone: 'error' })
        );
      }

      const dupMsg =
        skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicates skipped)` : '';
      const targetLabel =
        activeExam === 'IPMAT' ? `IPMAT ${activeIpmatTrack}` : activeExam;
      showToast(`Imported ${imported.length} topics into ${targetLabel} Backlog${dupMsg}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to parse spreadsheet.';
      showToast(msg, { tone: 'error' });
    }
  };

  const handleExportExcelSection = () => {
    exportSectionToExcel(activeExam, activeIpmatTrack, state.topics);
    showToast(`Exported ${activeExam === 'IPMAT' ? activeIpmatTrack : activeExam} syllabus to Excel`);
  };

  const handleDownloadSampleTemplate = () => {
    downloadSampleExcelTemplate(activeExam, activeIpmatTrack);
    showToast(
      `Downloaded ${activeExam === 'IPMAT' ? activeIpmatTrack : activeExam} sample Excel template`
    );
  };

  // Focus Logger
  const handleLogFocusMinutes = useCallback(
    (exam: ExamId, minutes: number, mode: '50/10' | '25/5' | 'manual') => {
      if (minutes <= 0) return;
      const newLog = {
        id: createId('foc'),
        date: getLocalDateKey(),
        exam,
        minutes,
        mode,
        timestamp: Date.now(),
      };
      setState((prev) => ({
        ...prev,
        focusLogs: [...prev.focusLogs, newLog],
      }));

      if (user) {
        void addFocusLogToCloud(user.uid, newLog).catch(() =>
          showToast('Failed to sync focus log to cloud', { tone: 'error' })
        );
      }
      showToast(`Logged ${minutes}m focus session to ${exam}`);
    },
    [showToast, user]
  );

  const handleChangeDailyTarget = (hours: number) => {
    setState((prev) => ({
      ...prev,
      dailyTargetHours: hours,
    }));

    if (user) {
      if (prefSyncTimerRef.current) {
        window.clearTimeout(prefSyncTimerRef.current);
      }
      prefSyncTimerRef.current = window.setTimeout(() => {
        void savePreferencesToCloud(user.uid, hours, stateRef.current.syllabusDaysGoal).catch(
          () => showToast('Failed to sync daily target hours', { tone: 'error' })
        );
      }, 450);
    }
  };

  // Mock Tests
  const handleAddMockTest = (mockData: Omit<AppState['mockTests'][number], 'id' | 'createdAt'>) => {
    const newMock = {
      ...mockData,
      id: createId('mock'),
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      mockTests: [...prev.mockTests, newMock],
    }));

    if (user) {
      void addMockTestToCloud(user.uid, newMock).catch(() =>
        showToast('Failed to sync mock test to cloud', { tone: 'error' })
      );
    }
    showToast(`Logged mock "${mockData.name}" (${mockData.scorePercent}%)`);
  };

  const handleDeleteMockTest = (id: string) => {
    setState((prev) => ({
      ...prev,
      mockTests: prev.mockTests.filter((m) => m.id !== id),
    }));

    if (user) {
      void deleteMockTestFromCloud(user.uid, id).catch(() =>
        showToast('Failed to delete mock in cloud', { tone: 'error' })
      );
    }
    showToast('Removed mock test entry');
  };

  // Mistake & Formula Vault
  const handleAddVaultNote = (title: string, content: string, tags: ExamId[]) => {
    const newNote = {
      id: createId('note'),
      title,
      content,
      tags,
      reviewed: false,
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      vaultNotes: [newNote, ...prev.vaultNotes],
    }));

    if (user) {
      void addVaultNoteToCloud(user.uid, newNote).catch(() =>
        showToast('Failed to sync vault note to cloud', { tone: 'error' })
      );
    }
    showToast('Saved note to Formula Vault');
  };

  const handleToggleVaultReviewed = (id: string) => {
    const target = state.vaultNotes.find((n) => n.id === id);
    if (!target) return;
    const nextReviewed = !target.reviewed;

    setState((prev) => ({
      ...prev,
      vaultNotes: prev.vaultNotes.map((n) =>
        n.id === id ? { ...n, reviewed: nextReviewed } : n
      ),
    }));

    if (user) {
      void updateVaultNoteFieldsInCloud(user.uid, id, { reviewed: nextReviewed }).catch(() =>
        showToast('Failed to sync review status', { tone: 'error' })
      );
    }
  };

  const handleDeleteVaultNote = (id: string) => {
    setState((prev) => ({
      ...prev,
      vaultNotes: prev.vaultNotes.filter((n) => n.id !== id),
    }));

    if (user) {
      void deleteVaultNoteFromCloud(user.uid, id).catch(() =>
        showToast('Failed to delete note in cloud', { tone: 'error' })
      );
    }
    showToast('Deleted vault note');
  };

  const handleCopyVaultNote = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied note to clipboard');
    } catch {
      showToast('Clipboard copy blocked by browser', { tone: 'error' });
    }
  };

  // JSON Backup Export / Restore
  const handleExportJson = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winter-arc-backup-${getLocalDateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported JSON backup');
  };

  const handleSelectRestoreFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = validateBackupPayload(parsed);
      if (!validated) {
        showToast('Invalid Winter Arc backup JSON file.', { tone: 'error' });
        return;
      }
      setPendingBackup(validated);
    } catch {
      showToast('Could not read JSON backup file.', { tone: 'error' });
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackup) return;
    const backup = pendingBackup;
    setState(backup);
    setPendingBackup(null);

    if (user) {
      try {
        await replaceCloudWorkspaceFromBackup(user.uid, backup);
        showToast(`Restored & synced backup (${backup.topics.length} topics)`);
      } catch {
        showToast('Restored locally, but cloud sync failed', { tone: 'error' });
      }
    } else {
      showToast(`Restored backup (${backup.topics.length} topics)`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="neu-surface rounded-2xl px-6 py-4 text-sm font-semibold text-[#5A625C]">
          Loading Winter Arc Command Center...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={handleEmailPasswordLogin}
        errorMessage={loginError}
        isSubmitting={loginSubmitting}
      />
    );
  }

  return (
    <div className="min-h-screen w-full px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
      <div className="max-w-[1380px] mx-auto space-y-6">
        <MasterGoalHeader
          topics={state.topics}
          overallTargetDays={state.syllabusDaysGoal.overallDays}
          onOpenOverallDaysModal={handleOpenOverallDaysModal}
          activeWorkspace={activeWorkspace}
          onChangeWorkspace={setActiveWorkspace}
          activeExam={activeExam}
          onSelectExamFromPill={(exam) => {
            setActiveExam(exam);
            setActiveWorkspace('syllabus');
          }}
          vaultCount={state.vaultNotes.length}
          onOpenVault={() => setIsVaultOpen(true)}
          onExportJson={handleExportJson}
          onSelectRestoreFile={handleSelectRestoreFile}
          user={user}
          onSignOut={handleSignOut}
        />

        {/* Main 2-Column Command Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="min-w-0">
            {activeWorkspace === 'syllabus' ? (
              <SyllabusEngine
                activeExam={activeExam}
                onChangeExam={setActiveExam}
                activeIpmatTrack={activeIpmatTrack}
                onChangeIpmatTrack={setActiveIpmatTrack}
                topics={state.topics}
                syllabusDaysGoal={state.syllabusDaysGoal}
                onOpenSectionDaysModal={handleOpenSectionDaysModal}
                onToggleComplete={handleToggleComplete}
                onToggleTarget={handleToggleTarget}
                onOpenAddTopic={() =>
                  setTopicModalState({ isOpen: true, mode: 'add', topic: null })
                }
                onOpenEditTopic={(topic) =>
                  setTopicModalState({ isOpen: true, mode: 'edit', topic })
                }
                onDeleteTopic={handleDeleteTopic}
                onOpenDriveModal={(topic) => setDriveModalTopicId(topic.id)}
                onCopyDriveLink={handleCopyDriveLink}
                onDeleteDriveLink={handleDeleteDriveLink}
                onOpenSynergyModal={(topic) => setSynergyModalTopicId(topic.id)}
                onImportExcelFile={handleImportExcelFile}
                onExportExcelSection={handleExportExcelSection}
                onDownloadSampleTemplate={handleDownloadSampleTemplate}
              />
            ) : (
              <MockAnalyticsView
                mockTests={state.mockTests}
                onAddMockTest={handleAddMockTest}
                onDeleteMockTest={handleDeleteMockTest}
              />
            )}
          </div>

          <div className="lg:sticky lg:top-5">
            <FocusTimerWidget
              focusLogs={state.focusLogs}
              dailyTargetHours={state.dailyTargetHours}
              onChangeDailyTarget={handleChangeDailyTarget}
              onLogFocusMinutes={handleLogFocusMinutes}
              sprintTopics={sprintTopics}
              onToggleCompleteTopic={handleToggleComplete}
            />
          </div>
        </main>

        <footer className="neu-surface rounded-2xl px-5 py-3.5 text-center">
          <p className="text-xs sm:text-sm font-medium text-[#5A625C]">
            Built by <span className="font-semibold text-[#1E2420]">Vinayak Mishra</span> ( IIT Madras ) |{' '}
            <a
              href="tel:+919508355456"
              className="font-mono tabular-nums font-semibold text-[#153226] hover:underline"
            >
              +91 9508355456
            </a>
          </p>
        </footer>
      </div>

      {/* Slide-Over Mistake & Formula Vault Drawer */}
      <MistakeVaultDrawer
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        notes={state.vaultNotes}
        onAddNote={handleAddVaultNote}
        onToggleReviewed={handleToggleVaultReviewed}
        onDeleteNote={handleDeleteVaultNote}
        onCopyNote={handleCopyVaultNote}
      />

      {/* Modals */}
      <TopicFormModal
        isOpen={topicModalState.isOpen}
        mode={topicModalState.mode}
        defaultExam={activeExam}
        defaultIpmatTrack={activeIpmatTrack}
        initialTopic={topicModalState.topic}
        existingSubjects={existingSubjectsForActiveExam}
        onClose={() =>
          setTopicModalState({ isOpen: false, mode: 'add', topic: null })
        }
        onSave={handleSaveTopicModal}
      />

      <SyllabusDaysModal
        target={daysModalTarget}
        onClose={() => setDaysModalTarget(null)}
        onSaveDays={handleSaveDaysGoal}
      />

      <DriveLinkModal
        topic={driveModalTopic}
        onClose={() => setDriveModalTopicId(null)}
        onAddLink={handleAddDriveLink}
      />

      <SynergyModal
        topic={synergyModalTopic}
        onClose={() => setSynergyModalTopicId(null)}
        onSaveSynergy={handleSaveSynergy}
      />

      <RestoreConfirmModal
        pendingBackup={pendingBackup}
        onCancel={() => setPendingBackup(null)}
        onConfirm={handleConfirmRestore}
      />

      {/* Tactile Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 neu-surface rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm shadow-lg"
        >
          <span
            className={`text-xs sm:text-sm font-semibold ${
              toast.tone === 'error' ? 'text-[#B91C1C]' : 'text-[#1E2420]'
            }`}
          >
            {toast.message}
          </span>
          {toast.undoAction && (
            <button
              type="button"
              onClick={toast.undoAction}
              className="neu-mint rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[#7C847D] hover:text-[#1E2420] cursor-pointer p-0.5 shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
