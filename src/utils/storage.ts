import { LotteryRecord, DrawRelation, DayOfWeek } from '../types';
import { parseDateString, getWeekStartMonday } from './dateUtils';
import {
  extractHeadAndTail,
  normalizeStationName,
  isStationScheduledOnDay,
  getScheduledDaysForStation,
} from './lotteryAnalysis';
import { getSampleLotteryRecords } from '../data/sampleData';

const STORAGE_KEY = 'xsmn_dac_biet_records_v1';

/**
 * Chuẩn hóa khóa nhận diện duy nhất của một kỳ quay xổ số:
 * Mỗi đài trong cùng 1 ngày chỉ có duy nhất 1 giải đặc biệt.
 */
export function getRecordKey(date: string, station: string): string {
  return `${date.trim()}___${normalizeStationName(station).toLowerCase()}`;
}

export interface InvalidWeekdayInfo {
  record: LotteryRecord;
  scheduledDays: DayOfWeek[];
  reason: string;
}

export interface DeduplicationOptions {
  removeInvalidWeekdays?: boolean; // Tự động loại bỏ các bản ghi của đài có ngày không đúng thứ mở thưởng
}

export interface DeduplicationResult {
  cleanRecords: LotteryRecord[];
  duplicatesRemoved: number; // Tổng số bản ghi trùng và sai lệch bị loại bỏ
  sameDayDuplicatesRemoved: number; // Trùng cùng ngày và đài
  crossDateWrongWeekdayRemoved: number; // Trùng khác ngày của đài không đúng thứ trong xổ
  invalidWeekdayRemoved: number; // Bản ghi đài vào ngày sai lịch xổ XSMN
  invalidRecordsDetected: InvalidWeekdayInfo[];
}

/**
 * Tìm tất cả các bản ghi có đài bị nhập vào ngày không đúng thứ mở thưởng theo lịch XSMN
 */
export function getInvalidWeekdayRecords(records: LotteryRecord[]): InvalidWeekdayInfo[] {
  const result: InvalidWeekdayInfo[] = [];
  for (const r of records) {
    if (!isStationScheduledOnDay(r.station, r.dayOfWeek)) {
      const scheduledDays = getScheduledDaysForStation(r.station);
      result.push({
        record: r,
        scheduledDays,
        reason: `Đài "${r.station}" chỉ mở thưởng vào ${scheduledDays.join(', ')}. Ngày ${r.dateDisplay} là ${r.dayOfWeek} (không đúng thứ trong xổ).`,
      });
    }
  }
  return result;
}

/**
 * Loại bỏ các bản ghi trùng lặp và sai lệch lịch mở thưởng:
 * 1. Trùng cùng Ngày & Đài: Giữ lại bản ghi mới nhất.
 * 2. Trùng khác ngày của cùng 1 đài trong cùng chu kỳ tuần:
 *    Nếu một đài có bản ghi ở ngày đúng thứ trong xổ và bản ghi ở ngày khác không đúng thứ trong xổ,
 *    hệ thống sẽ loại bỏ bản ghi sai ngày đó ("nhập khác ngày của đài đó không đúng thứ trong xổ").
 * 3. Loại bỏ các bản ghi có ngày không đúng thứ mở thưởng của đài (nếu removeInvalidWeekdays = true).
 */
export function deduplicateRecords(
  records: LotteryRecord[],
  options: DeduplicationOptions = { removeInvalidWeekdays: true }
): DeduplicationResult {
  const removeInvalidWeekdays = options.removeInvalidWeekdays ?? true;

  // 1. Phát hiện toàn bộ bản ghi sai thứ mở thưởng
  const invalidRecordsDetected = getInvalidWeekdayRecords(records);

  // 2. Loại bỏ trùng cùng Ngày & Đài (giữ bản ghi mới nhất)
  const sameDayMap = new Map<string, LotteryRecord>();
  let sameDayDuplicatesRemoved = 0;

  for (const record of records) {
    const key = getRecordKey(record.date, record.station);
    if (sameDayMap.has(key)) {
      sameDayDuplicatesRemoved++;
    }
    sameDayMap.set(key, record);
  }

  let workingRecords = Array.from(sameDayMap.values());

  // 3. Xóa trùng khi nhập khác ngày của cùng 1 đài trong cùng 1 chu kỳ tuần:
  // Nếu đài đó có cả ngày đúng thứ mở thưởng và ngày sai thứ mở thưởng, loại bỏ bản ghi sai thứ.
  let crossDateWrongWeekdayRemoved = 0;
  const recordsByWeekAndStation = new Map<string, LotteryRecord[]>();

  for (const r of workingRecords) {
    const weekMonday = getWeekStartMonday(r.date);
    const stationNorm = normalizeStationName(r.station).toLowerCase();
    const groupKey = `${weekMonday}___${stationNorm}`;
    const group = recordsByWeekAndStation.get(groupKey) || [];
    group.push(r);
    recordsByWeekAndStation.set(groupKey, group);
  }

  const keptIds = new Set<string>();
  for (const [, group] of recordsByWeekAndStation.entries()) {
    if (group.length <= 1) {
      group.forEach(r => keptIds.add(r.id));
      continue;
    }

    const validWeekdayRecs = group.filter(r => isStationScheduledOnDay(r.station, r.dayOfWeek));
    const invalidWeekdayRecs = group.filter(r => !isStationScheduledOnDay(r.station, r.dayOfWeek));

    if (validWeekdayRecs.length > 0 && invalidWeekdayRecs.length > 0) {
      // Giữ bản ghi đúng thứ mở thưởng, xóa bản ghi trùng khác ngày sai thứ
      validWeekdayRecs.forEach(r => keptIds.add(r.id));
      crossDateWrongWeekdayRemoved += invalidWeekdayRecs.length;
    } else {
      // Trường hợp cả hai đều đúng thứ (như TP.HCM xổ cả Thứ 2 và Thứ 7) hoặc cả hai đều sai thứ
      group.forEach(r => keptIds.add(r.id));
    }
  }

  workingRecords = workingRecords.filter(r => keptIds.has(r.id));

  // 4. Nếu bật removeInvalidWeekdays: loại bỏ toàn bộ bản ghi có thứ không đúng lịch xổ của đài
  let invalidWeekdayRemoved = 0;
  if (removeInvalidWeekdays) {
    const beforeCount = workingRecords.length;
    workingRecords = workingRecords.filter(r => isStationScheduledOnDay(r.station, r.dayOfWeek));
    invalidWeekdayRemoved = beforeCount - workingRecords.length;
  }

  // Sắp xếp theo ngày tăng dần
  const cleanRecords = workingRecords.sort((a, b) => a.date.localeCompare(b.date));
  const duplicatesRemoved = sameDayDuplicatesRemoved + crossDateWrongWeekdayRemoved + invalidWeekdayRemoved;

  return {
    cleanRecords,
    duplicatesRemoved,
    sameDayDuplicatesRemoved,
    crossDateWrongWeekdayRemoved,
    invalidWeekdayRemoved,
    invalidRecordsDetected,
  };
}

export function loadStoredRecords(): LotteryRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Tự động loại bỏ bất kỳ bản ghi trùng ngày & đài nào nếu có từ trước
        const { cleanRecords } = deduplicateRecords(parsed);
        return cleanRecords;
      }
    }
  } catch (err) {
    console.error('Error loading stored records:', err);
  }
  // Mặc định khi chưa có dữ liệu: trả về mảng rỗng (trống dữ liệu)
  return [];
}

export function saveStoredRecords(records: LotteryRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Error saving records to localStorage:', err);
  }
}

export function clearAllStoredRecords(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Error clearing localStorage:', err);
  }
}

/**
 * Bulk parses pasted text formatted as lines of:
 * "Ngày,Đài,Kết quả"
 * E.g.:
 * 01/09/2026,Đài A,123456
 * 02/09/2026,TP.HCM,025678
 *
 * Supports delimiters: comma, semicolon, tab, pipe.
 */
export function parseBulkText(
  text: string,
  existingLength = 0,
  options: { removeInvalidWeekdays?: boolean } = { removeInvalidWeekdays: true }
): {
  validRecords: LotteryRecord[];
  errors: { lineNum: number; rawText: string; reason: string }[];
  dedupInfo: DeduplicationResult;
} {
  const lines = text.split(/\r?\n/);
  const validRecords: LotteryRecord[] = [];
  const errors: { lineNum: number; rawText: string; reason: string }[] = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return; // Skip empty and comments

    // Delimiter detection: comma, tab, semicolon, pipe
    let parts: string[] = [];
    if (trimmed.includes('\t')) {
      parts = trimmed.split('\t');
    } else if (trimmed.includes(';')) {
      parts = trimmed.split(';');
    } else if (trimmed.includes('|')) {
      parts = trimmed.split('|');
    } else {
      parts = trimmed.split(',');
    }

    if (parts.length < 3) {
      errors.push({
        lineNum,
        rawText: line,
        reason: 'Thiếu cột. Yêu cầu định dạng: Ngày,Đài,Kết quả 6 số (VD: 01/09/2026,TP.HCM,123456)',
      });
      return;
    }

    const rawDate = parts[0].trim();
    const station = parts[1].trim();
    const rawNumber = parts[2].trim();

    if (!station) {
      errors.push({
        lineNum,
        rawText: line,
        reason: 'Tên đài không được để trống.',
      });
      return;
    }

    const parsedDate = parseDateString(rawDate);
    if (!parsedDate.valid) {
      errors.push({
        lineNum,
        rawText: line,
        reason: `Ngày không hợp lệ (${rawDate}). Hỗ trợ DD/MM/YYYY hoặc YYYY-MM-DD.`,
      });
      return;
    }

    const splitNumber = extractHeadAndTail(rawNumber);
    if (!splitNumber.valid) {
      errors.push({
        lineNum,
        rawText: line,
        reason: `Kết quả đặc biệt phải gồm đúng 6 chữ số (nhận được: "${rawNumber}").`,
      });
      return;
    }

    const newRecord: LotteryRecord = {
      id: `rec-${Date.now()}-${existingLength + validRecords.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
      date: parsedDate.iso,
      dateDisplay: parsedDate.display,
      dayOfWeek: parsedDate.dayOfWeek,
      station,
      rawNumber: splitNumber.clean,
      head3: splitNumber.head3,
      tail3: splitNumber.tail3,
      sessionIndex: existingLength + validRecords.length + 1,
      createdAt: Date.now(),
    };

    validRecords.push(newRecord);
  });

  // Tự động loại bỏ các dòng bị trùng cùng Ngày & Đài và các dòng nhập sai thứ trong xổ
  const dedupInfo = deduplicateRecords(validRecords, {
    removeInvalidWeekdays: options.removeInvalidWeekdays ?? true,
  });

  return { validRecords: dedupInfo.cleanRecords, errors, dedupInfo };
}

/**
 * Exports records to a CSV file download
 */
export function exportRecordsToCSV(records: LotteryRecord[], filename = 'Du_Lieu_Xo_So_Dac_Biet.csv'): void {
  const headers = ['ID', 'Ngày', 'Thứ', 'Đài/Tỉnh', 'Kết quả 6 số', '3 số đầu', '3 số cuối', 'Thứ tự kỳ'];
  const rows = records.map(r => [
    r.id,
    r.dateDisplay,
    r.dayOfWeek,
    `"${r.station}"`,
    `"${r.rawNumber}"`, // wrapped in quotes to preserve leading 0s in Excel
    `"${r.head3}"`,
    `"${r.tail3}"`,
    r.sessionIndex,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Exports relations analysis table to CSV
 */
export function exportRelationsToCSV(relations: DrawRelation[], filename = 'Bang_Phan_Tich_Dau_Cuoi.csv'): void {
  const headers = [
    'Ngày nguồn',
    'Thứ nguồn',
    'Đài nguồn',
    '3 số đầu',
    'Ngày đích',
    'Thứ đích',
    'Đài đích',
    '3 số cuối',
    'Khoảng cách kỳ',
    'Khoảng cách ngày',
    'Mức độ tương đồng (%)',
    'Loại quan hệ',
    'Cảnh báo',
    'Mô tả chi tiết',
  ];

  const rows = relations.map(r => [
    r.sourceRecord.dateDisplay,
    r.sourceDayOfWeek,
    `"${r.sourceStation}"`,
    `"${r.sourceHead3}"`,
    r.targetRecord.dateDisplay,
    r.targetDayOfWeek,
    `"${r.targetStation}"`,
    `"${r.targetTail3}"`,
    r.cycleDistance,
    r.dayDistance,
    `${r.similarityScore}%`,
    `"${r.relationTypeLabel}"`,
    r.alertColor.toUpperCase(),
    `"${r.matchDescription}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Exports complete JSON backup
 */
export function exportBackupJSON(records: LotteryRecord[]): void {
  const dataStr = JSON.stringify({
    appName: 'Phân Tích Xổ Số Đặc Biệt Miền Nam',
    exportTime: new Date().toISOString(),
    totalRecords: records.length,
    records,
  }, null, 2);

  downloadBlob(dataStr, `Sao_Luu_XSMN_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
