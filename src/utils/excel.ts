import * as XLSX from 'xlsx';
import { ExamId, IpmatTrack, IPMAT_TRACK_META, Topic } from '../types';
import {
  createId,
  SAMPLE_EXCEL_ROWS,
  SAMPLE_IPMAT_TRACK_EXCEL_ROWS,
} from '../data/seedData';

export interface ExcelImportResult {
  topics: Topic[];
  skippedDuplicates: number;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseIpmatTrackValue(raw: string): IpmatTrack | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v.includes('indore')) return 'INDORE';
  if (v.includes('rohtak')) return 'ROHTAK';
  if (v.includes('jipmat')) return 'JIPMAT';
  return null;
}

export async function parseExcelTopics(
  file: File,
  activeExam: ExamId,
  activeIpmatTrack: IpmatTrack,
  existingTopics: Topic[]
): Promise<ExcelImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded spreadsheet contains no sheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (!rawRows.length) {
    throw new Error('The uploaded spreadsheet is empty.');
  }

  const existingKeys = new Set(
    existingTopics
      .filter((t) => t.exam === activeExam)
      .map(
        (t) =>
          `${t.subExam || ''}::${t.subject.toLowerCase()}::${t.unit.toLowerCase()}::${t.name.toLowerCase()}`
      )
  );

  const imported: Topic[] = [];
  let skippedDuplicates = 0;

  rawRows.forEach((row, index) => {
    const entries = Object.entries(row);
    let subject = '';
    let unit = '';
    let topicName = '';
    let parsedTrack: IpmatTrack | null = null;

    for (const [key, val] of entries) {
      const norm = normalizeHeader(key);
      const strVal = String(val ?? '').trim();
      if (!strVal) continue;

      if (
        !parsedTrack &&
        (norm === 'track' || norm === 'subsection' || norm === 'examtrack' || norm === 'exam')
      ) {
        parsedTrack = parseIpmatTrackValue(strVal);
      } else if (
        !subject &&
        (norm === 'subject' || norm === 'course' || norm === 'paper' || norm === 'section')
      ) {
        subject = strVal;
      } else if (
        !unit &&
        (norm === 'unit' ||
          norm === 'module' ||
          norm === 'week' ||
          norm === 'chapter' ||
          norm === 'block')
      ) {
        unit = strVal;
      } else if (
        !topicName &&
        (norm === 'topicname' ||
          norm === 'topic' ||
          norm === 'name' ||
          norm === 'title' ||
          norm === 'subtopic')
      ) {
        topicName = strVal;
      }
    }

    // Fallback positional mapping if headers didn't match standard names
    if (!topicName) {
      const nonEmptyCols = entries
        .map(([, v]) => String(v ?? '').trim())
        .filter(Boolean);
      if (nonEmptyCols.length >= 3) {
        subject = subject || nonEmptyCols[0];
        unit = unit || nonEmptyCols[1];
        topicName = nonEmptyCols[2];
      } else if (nonEmptyCols.length === 2) {
        subject = subject || nonEmptyCols[0];
        topicName = nonEmptyCols[1];
      } else if (nonEmptyCols.length === 1) {
        topicName = nonEmptyCols[0];
      }
    }

    if (!topicName) return;

    const finalSubject = subject || 'General';
    const finalUnit = unit || 'Imported Backlog';
    const finalSubExam =
      activeExam === 'IPMAT' ? parsedTrack || activeIpmatTrack : undefined;

    const dedupKey = `${finalSubExam || ''}::${finalSubject.toLowerCase()}::${finalUnit.toLowerCase()}::${topicName.toLowerCase()}`;

    if (existingKeys.has(dedupKey)) {
      skippedDuplicates += 1;
      return;
    }

    existingKeys.add(dedupKey);
    imported.push({
      id: createId('imp'),
      exam: activeExam,
      ...(finalSubExam ? { subExam: finalSubExam } : {}),
      subject: finalSubject,
      unit: finalUnit,
      name: topicName,
      completed: false,
      inTarget: false,
      synergy: [],
      links: [],
      createdAt: Date.now() + index,
    });
  });

  if (imported.length === 0 && skippedDuplicates === 0) {
    throw new Error('No valid topic rows found. Ensure columns include Subject, Unit, and Topic Name.');
  }

  return { topics: imported, skippedDuplicates };
}

export function exportSectionToExcel(
  exam: ExamId,
  activeIpmatTrack: IpmatTrack,
  topics: Topic[]
): void {
  const sectionTopics = topics.filter((t) => {
    if (exam !== 'IPMAT') {
      return t.exam === exam || t.synergy.includes(exam);
    }
    if (t.exam === 'IPMAT') {
      return (t.subExam || 'INDORE') === activeIpmatTrack;
    }
    return activeIpmatTrack === 'INDORE' && t.synergy.includes('IPMAT');
  });

  const rows = sectionTopics.map((t) => ({
    Subject: t.subject,
    Unit: t.unit,
    'Topic Name': t.name,
    'Home Section':
      t.exam === 'IPMAT'
        ? IPMAT_TRACK_META[t.subExam || 'INDORE'].label
        : t.exam,
    Status: t.completed ? 'Completed' : 'Pending',
    'In Active Target': t.inTarget ? 'Yes' : 'No',
    'Synergy Exams': t.synergy.join(', '),
    'Drive Links': t.links.map((l) => `${l.label}: ${l.url}`).join(' | '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length > 0
      ? rows
      : [{ Subject: '', Unit: '', 'Topic Name': '', Status: '' }]
  );
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 26 },
    { wch: 42 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 48 },
  ];

  const sheetLabel =
    exam === 'IPMAT' ? IPMAT_TRACK_META[activeIpmatTrack].label : `${exam} Syllabus`;
  const fileLabel =
    exam === 'IPMAT' ? `IPMAT_${activeIpmatTrack}` : exam;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetLabel.slice(0, 31));
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `WinterArc_${fileLabel}_Syllabus_${dateStr}.xlsx`);
}

export function downloadSampleExcelTemplate(
  exam: ExamId,
  activeIpmatTrack: IpmatTrack
): void {
  const sampleRows =
    exam === 'IPMAT'
      ? SAMPLE_IPMAT_TRACK_EXCEL_ROWS[activeIpmatTrack]
      : SAMPLE_EXCEL_ROWS[exam];
  const fileLabel =
    exam === 'IPMAT' ? `IPMAT_${activeIpmatTrack}` : exam;

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  worksheet['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 46 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${fileLabel} Template`.slice(0, 31));
  XLSX.writeFile(workbook, `WinterArc_${fileLabel}_Sample_Template.xlsx`);
}
