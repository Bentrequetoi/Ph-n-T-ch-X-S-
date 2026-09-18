import React, { useState, useMemo } from 'react';
import { LotteryRecord } from '../types';
import { parseDateString, VIETNAMESE_DAYS, getVietnameseDayOfWeek, getWeekStartMonday } from '../utils/dateUtils';
import {
  extractHeadAndTail,
  XSMN_WEEKDAY_SCHEDULE,
  isStationScheduledOnDay,
  getScheduledDaysForStation,
  findNearestScheduledDate,
  normalizeStationName,
} from '../utils/lotteryAnalysis';
import {
  parseBulkText,
  exportRecordsToCSV,
  exportBackupJSON,
  getRecordKey,
  deduplicateRecords,
  getInvalidWeekdayRecords,
  DeduplicationResult,
} from '../utils/storage';
import { WeekdayClusterInput } from './WeekdayClusterInput';
import { SingleStationSeriesInput } from './SingleStationSeriesInput';
import {
  Database,
  PlusCircle,
  FileText,
  Upload,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  FilterX,
  X,
  AlertTriangle,
  Check,
  RotateCcw,
} from 'lucide-react';

interface DataManagerProps {
  records: LotteryRecord[];
  onAddRecord: (newRecord: LotteryRecord) => void;
  onAddBulkRecords: (newRecords: LotteryRecord[]) => void;
  onDeleteRecord: (id: string) => void;
  onDeleteMultipleRecords?: (ids: string[]) => void;
  onDeduplicateRecords?: () => void;
  onClearAll: () => void;
  onRestoreJSON: (jsonStr: string) => void;
}

interface DeleteModalConfig {
  isOpen: boolean;
  type: 'single' | 'batch' | 'filtered' | 'all';
  title: string;
  record?: LotteryRecord;
  count?: number;
  description?: string;
  onConfirm: () => void;
}

export const DataManager: React.FC<DataManagerProps> = ({
  records,
  onAddRecord,
  onAddBulkRecords,
  onDeleteRecord,
  onDeleteMultipleRecords,
  onDeduplicateRecords,
  onClearAll,
  onRestoreJSON,
}) => {
  // Mode tabs: 'cluster' | 'singleStation' | 'bulk' | 'single'
  const [inputMode, setInputMode] = useState<'cluster' | 'singleStation' | 'bulk' | 'single'>('cluster');

  // In-app Toast Notification State
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // In-app Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<DeleteModalConfig>({
    isOpen: false,
    type: 'single',
    title: '',
    onConfirm: () => {},
  });

  // Fast delete toggle (whether to require confirmation modal)
  const [confirmBeforeDelete, setConfirmBeforeDelete] = useState<boolean>(true);

  // Single Record State
  const [singleDate, setSingleDate] = useState<string>('2026-09-17');
  const [singleStation, setSingleStation] = useState<string>('TP.HCM');
  const [singleNumber, setSingleNumber] = useState<string>('');
  const [singleError, setSingleError] = useState<string>('');
  const [autoAdvanceSingleDate, setAutoAdvanceSingleDate] = useState<boolean>(true);
  const [blockInvalidWeekdaySubmit, setBlockInvalidWeekdaySubmit] = useState<boolean>(true);

  // Single Form computed values
  const singleParsedDate = useMemo(() => parseDateString(singleDate), [singleDate]);
  const singleSplit = useMemo(() => extractHeadAndTail(singleNumber), [singleNumber]);

  // Kiểm tra lịch mở thưởng của đài đang chọn trong Form đơn
  const singleScheduledDays = useMemo(() => {
    return getScheduledDaysForStation(singleStation);
  }, [singleStation]);

  const isSingleDayValid = useMemo(() => {
    if (!singleParsedDate.valid || !singleStation.trim()) return true;
    return isStationScheduledOnDay(singleStation, singleParsedDate.dayOfWeek);
  }, [singleParsedDate.valid, singleParsedDate.dayOfWeek, singleStation]);

  const nearestScheduled = useMemo(() => {
    if (isSingleDayValid || !singleParsedDate.valid || !singleStation.trim()) return null;
    return findNearestScheduledDate(singleStation, singleParsedDate.iso);
  }, [isSingleDayValid, singleParsedDate.valid, singleParsedDate.iso, singleStation]);

  // Kiểm tra nếu ngày + đài hiện tại ở form nhập đơn đã có kết quả trong hệ thống
  const existingDuplicateRecord = useMemo(() => {
    if (!singleParsedDate.valid || !singleStation.trim()) return null;
    const key = getRecordKey(singleParsedDate.iso, singleStation);
    return records.find(r => getRecordKey(r.date, r.station) === key) || null;
  }, [records, singleParsedDate.iso, singleParsedDate.valid, singleStation]);

  // Kiểm tra trùng khác ngày của đài này trong cùng tuần
  const crossDateWeekDuplicate = useMemo(() => {
    if (!singleParsedDate.valid || !singleStation.trim()) return null;
    const currentWeekMonday = getWeekStartMonday(singleParsedDate.iso);
    const currentStationNorm = normalizeStationName(singleStation).toLowerCase();
    return records.find(r => {
      const weekMonday = getWeekStartMonday(r.date);
      const stationNorm = normalizeStationName(r.station).toLowerCase();
      return weekMonday === currentWeekMonday && stationNorm === currentStationNorm && r.date !== singleParsedDate.iso;
    }) || null;
  }, [records, singleParsedDate.valid, singleParsedDate.iso, singleStation]);

  // Thống kê toàn diện: Trùng cùng Ngày & Đài, Trùng khác ngày sai thứ, và Bản ghi sai thứ mở thưởng
  const duplicateStats = useMemo(() => {
    const keyCount = new Map<string, number>();
    const sameDayDuplicateKeys = new Set<string>();
    let sameDayDuplicates = 0;

    for (const r of records) {
      const key = getRecordKey(r.date, r.station);
      const count = keyCount.get(key) || 0;
      if (count >= 1) {
        sameDayDuplicateKeys.add(key);
        sameDayDuplicates++;
      }
      keyCount.set(key, count + 1);
    }

    // 1. Bản ghi sai thứ mở thưởng
    const invalidWeekdayList = getInvalidWeekdayRecords(records);
    const invalidRecordIds = new Set(invalidWeekdayList.map(item => item.record.id));

    // 2. Trùng khác ngày của cùng 1 đài trong cùng 1 chu kỳ tuần
    const recordsByWeekAndStation = new Map<string, LotteryRecord[]>();
    for (const r of records) {
      const weekMonday = getWeekStartMonday(r.date);
      const stationNorm = normalizeStationName(r.station).toLowerCase();
      const groupKey = `${weekMonday}___${stationNorm}`;
      const group = recordsByWeekAndStation.get(groupKey) || [];
      group.push(r);
      recordsByWeekAndStation.set(groupKey, group);
    }

    const crossDateDuplicateIds = new Set<string>();
    for (const [, group] of recordsByWeekAndStation.entries()) {
      if (group.length > 1) {
        const hasValid = group.some(r => isStationScheduledOnDay(r.station, r.dayOfWeek));
        const hasInvalid = group.some(r => !isStationScheduledOnDay(r.station, r.dayOfWeek));
        if (hasValid && hasInvalid) {
          // Các bản ghi sai thứ trong nhóm này là trùng khác ngày không đúng thứ
          group.filter(r => !isStationScheduledOnDay(r.station, r.dayOfWeek)).forEach(r => {
            crossDateDuplicateIds.add(r.id);
          });
        }
      }
    }

    const totalIssues = sameDayDuplicates + invalidWeekdayList.length;

    return {
      hasIssues: totalIssues > 0,
      totalIssues,
      sameDayDuplicates,
      sameDayDuplicateKeys,
      invalidWeekdayCount: invalidWeekdayList.length,
      invalidWeekdayList,
      invalidRecordIds,
      crossDateDuplicateCount: crossDateDuplicateIds.size,
      crossDateDuplicateIds,
    };
  }, [records]);

  // State to filter and inspect issue rows in the table
  type FilterIssueType = 'none' | 'all_issues' | 'duplicates' | 'wrong_weekday';
  const [filterIssuesMode, setFilterIssuesMode] = useState<FilterIssueType>('none');

  const handleRemoveAllDuplicates = () => {
    if (onDeduplicateRecords) {
      onDeduplicateRecords();
    } else {
      const result = deduplicateRecords(records, { removeInvalidWeekdays: true });
      if (result.duplicatesRemoved > 0) {
        const parts: string[] = [];
        if (result.sameDayDuplicatesRemoved > 0) parts.push(`${result.sameDayDuplicatesRemoved} trùng cùng ngày`);
        if (result.crossDateWrongWeekdayRemoved > 0) parts.push(`${result.crossDateWrongWeekdayRemoved} trùng khác ngày sai thứ`);
        if (result.invalidWeekdayRemoved > 0) parts.push(`${result.invalidWeekdayRemoved} sai thứ mở thưởng`);
        showToast(`Đã làm sạch & xóa trùng thành công: Đã loại bỏ ${result.duplicatesRemoved} kết quả (${parts.join(', ')})!`);
      } else {
        showToast('Dữ liệu hoàn toàn sạch: Không có kết quả nào bị trùng ngày hoặc sai thứ mở thưởng.', 'info');
      }
    }
    setFilterIssuesMode('none');
  };

  const handleRemoveInvalidWeekdayOnly = () => {
    if (duplicateStats.invalidWeekdayCount === 0) {
      showToast('Không có bản ghi nào bị sai thứ mở thưởng.', 'info');
      return;
    }
    const ids = Array.from(duplicateStats.invalidRecordIds);
    if (onDeleteMultipleRecords) {
      onDeleteMultipleRecords(ids);
    } else {
      ids.forEach(id => onDeleteRecord(id));
    }
    showToast(`Đã xóa ${ids.length} bản ghi sai thứ mở thưởng theo lịch XSMN thành công!`);
    setFilterIssuesMode('none');
  };

  // Bulk Paste State
  const [bulkText, setBulkText] = useState<string>(
`01/09/2026,TP.HCM,123456
01/09/2026,Đồng Tháp,025987
01/09/2026,Cà Mau,789654
02/09/2026,Bến Tre,456123
02/09/2026,Vũng Tàu,987025
02/09/2026,Bạc Liêu,654789
05/09/2026,Long An,025678`
  );
  const [bulkParsedResult, setBulkParsedResult] = useState<{
    validRecords: LotteryRecord[];
    errors: { lineNum: number; rawText: string; reason: string }[];
    dedupInfo?: DeduplicationResult;
  } | null>(null);

  // Table Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [dayFilter, setDayFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Handle Single Add
  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError('');

    if (!singleParsedDate.valid) {
      setSingleError('Ngày không hợp lệ. Vui lòng kiểm tra lại định dạng.');
      return;
    }
    if (!singleStation.trim()) {
      setSingleError('Vui lòng nhập hoặc chọn tên đài/tỉnh.');
      return;
    }
    if (!singleSplit.valid) {
      setSingleError('Kết quả Giải Đặc Biệt phải gồm đúng 6 chữ số (VD: 025678).');
      return;
    }

    if (!isSingleDayValid && blockInvalidWeekdaySubmit) {
      setSingleError(
        `Đài "${singleStation}" theo lịch mở thưởng chỉ xổ vào: ${singleScheduledDays.join(', ')}. ` +
        `Ngày ${singleParsedDate.display} là ${singleParsedDate.dayOfWeek} (không đúng thứ trong xổ)! ` +
        `Vui lòng bấm nút "Chuyển về đúng thứ xổ" hoặc bỏ chọn "Chặn lưu sai thứ" để tiếp tục.`
      );
      return;
    }

    const wasDuplicate = !!existingDuplicateRecord;
    const oldNumber = existingDuplicateRecord?.rawNumber;

    const newRecord: LotteryRecord = {
      id: `rec-${Date.now()}-${records.length + 1}`,
      date: singleParsedDate.iso,
      dateDisplay: singleParsedDate.display,
      dayOfWeek: singleParsedDate.dayOfWeek,
      station: singleStation.trim(),
      rawNumber: singleSplit.clean,
      head3: singleSplit.head3,
      tail3: singleSplit.tail3,
      sessionIndex: records.length + 1,
      createdAt: Date.now(),
    };

    onAddRecord(newRecord);
    setSingleNumber('');

    const resultNote = wasDuplicate 
      ? `(Đã loại bỏ kết quả cũ ${oldNumber} trùng ngày đài để ghi đè số mới)`
      : `(Đầu: ${singleSplit.head3}, Cuối: ${singleSplit.tail3})`;

    // Tự động tăng lên 1 ngày sau khi nhập thành công
    if (autoAdvanceSingleDate && singleParsedDate.valid) {
      const parts = singleParsedDate.iso.split('-');
      const curDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      curDate.setDate(curDate.getDate() + 1);
      const nextYyyy = curDate.getFullYear();
      const nextMm = String(curDate.getMonth() + 1).padStart(2, '0');
      const nextDd = String(curDate.getDate()).padStart(2, '0');
      const nextIso = `${nextYyyy}-${nextMm}-${nextDd}`;
      setSingleDate(nextIso);
      showToast(`Đã lưu thành công: ${singleStation} - ${singleSplit.clean} ${resultNote}. Đã chuyển sang ${nextDd}/${nextMm}/${nextYyyy} (+1 ngày)`);
    } else {
      showToast(`Đã lưu thành công: ${singleStation} - ${singleSplit.clean} ${resultNote}`);
    }
  };

  const [bulkFilterInvalidWeekdays, setBulkFilterInvalidWeekdays] = useState<boolean>(true);

  // Preview Bulk
  const handlePreviewBulk = () => {
    const result = parseBulkText(bulkText, records.length, {
      removeInvalidWeekdays: bulkFilterInvalidWeekdays,
    });
    setBulkParsedResult(result);
  };

  // Confirm Import Bulk
  const handleConfirmImportBulk = () => {
    if (!bulkParsedResult || bulkParsedResult.validRecords.length === 0) return;
    onAddBulkRecords(bulkParsedResult.validRecords);
    showToast(`Đã nạp thành công ${bulkParsedResult.validRecords.length} bản ghi vào hệ thống!`);
    setBulkParsedResult(null);
    setBulkText('');
  };

  // File JSON restore handler
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        onRestoreJSON(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered Records for table
  const uniqueStations = useMemo(() => Array.from(new Set(records.map(r => r.station))).sort(), [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filterIssuesMode === 'all_issues') {
        const isDup = duplicateStats.sameDayDuplicateKeys.has(getRecordKey(r.date, r.station));
        const isInvalidDow = duplicateStats.invalidRecordIds.has(r.id);
        const isCrossDup = duplicateStats.crossDateDuplicateIds.has(r.id);
        if (!isDup && !isInvalidDow && !isCrossDup) return false;
      } else if (filterIssuesMode === 'duplicates') {
        if (!duplicateStats.sameDayDuplicateKeys.has(getRecordKey(r.date, r.station))) return false;
      } else if (filterIssuesMode === 'wrong_weekday') {
        if (!duplicateStats.invalidRecordIds.has(r.id)) return false;
      }

      if (stationFilter !== 'ALL' && r.station !== stationFilter) return false;
      if (dayFilter !== 'ALL' && r.dayOfWeek !== dayFilter) return false;
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const matchNum = r.rawNumber.includes(q) || r.head3.includes(q) || r.tail3.includes(q);
        const matchStation = r.station.toLowerCase().includes(q);
        const matchDate = r.dateDisplay.includes(q);
        if (!matchNum && !matchStation && !matchDate) return false;
      }
      return true;
    });
  }, [
    records,
    stationFilter,
    dayFilter,
    searchTerm,
    filterIssuesMode,
    duplicateStats.sameDayDuplicateKeys,
    duplicateStats.invalidRecordIds,
    duplicateStats.crossDateDuplicateIds,
  ]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toggle selection of a single item
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all on current page
  const isAllCurrentPageSelected = paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.has(r.id));
  const handleToggleSelectPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedRecords.forEach(r => next.delete(r.id));
      } else {
        paginatedRecords.forEach(r => next.add(r.id));
      }
      return next;
    });
  };

  // Select all filtered records
  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredRecords.map(r => r.id)));
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Single delete with confirmation or instant
  const handleConfirmDeleteSingle = (record: LotteryRecord) => {
    if (!confirmBeforeDelete) {
      onDeleteRecord(record.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      showToast(`Đã xóa: ${record.station} - ${record.rawNumber}`);
      return;
    }

    setDeleteModal({
      isOpen: true,
      type: 'single',
      title: 'Xác Nhận Xóa Bản Ghi Kỳ Quay',
      record,
      description: `Bản ghi của đài ${record.station} ngày ${record.dateDisplay} (${record.rawNumber}) sẽ bị xóa hoàn toàn khỏi hệ thống.`,
      onConfirm: () => {
        onDeleteRecord(record.id);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(record.id);
          return next;
        });
        showToast(`Đã xóa bản ghi ${record.station} - ${record.rawNumber} thành công!`);
        setDeleteModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Batch delete selected records
  const handleBatchDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;

    if (!confirmBeforeDelete) {
      if (onDeleteMultipleRecords) {
        onDeleteMultipleRecords(Array.from(selectedIds));
      } else {
        selectedIds.forEach(id => onDeleteRecord(id));
      }
      setSelectedIds(new Set());
      showToast(`Đã xóa ${count} bản ghi đã chọn.`);
      return;
    }

    setDeleteModal({
      isOpen: true,
      type: 'batch',
      title: 'Xác Nhận Xóa Hàng Loạt Bản Ghi',
      count,
      description: `Bạn có chắc chắn muốn xóa ${count} bản ghi đã chọn khỏi hệ thống?`,
      onConfirm: () => {
        if (onDeleteMultipleRecords) {
          onDeleteMultipleRecords(Array.from(selectedIds));
        } else {
          selectedIds.forEach(id => onDeleteRecord(id));
        }
        setSelectedIds(new Set());
        showToast(`Đã xóa thành công ${count} bản ghi đã chọn!`);
        setDeleteModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Delete all filtered records
  const handleDeleteFilteredRecords = () => {
    if (filteredRecords.length === 0) return;
    const count = filteredRecords.length;
    const filterInfo = stationFilter !== 'ALL' ? `đài ${stationFilter}` : (searchTerm ? `từ khóa "${searchTerm}"` : 'danh sách đang lọc');

    setDeleteModal({
      isOpen: true,
      type: 'filtered',
      title: `Xác Nhận Xóa ${count} Bản Ghi Đang Lọc`,
      count,
      description: `Toàn bộ ${count} bản ghi theo ${filterInfo} sẽ bị xóa khỏi cơ sở dữ liệu.`,
      onConfirm: () => {
        const idsToDelete = filteredRecords.map(r => r.id);
        if (onDeleteMultipleRecords) {
          onDeleteMultipleRecords(idsToDelete);
        } else {
          idsToDelete.forEach(id => onDeleteRecord(id));
        }
        setSelectedIds(new Set());
        showToast(`Đã xóa ${count} bản ghi lọc thành công!`);
        setDeleteModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Clear all data
  const handleClearAllConfirm = () => {
    if (records.length === 0) {
      showToast('Hiện tại danh sách lịch sử đang trống.', 'info');
      return;
    }

    setDeleteModal({
      isOpen: true,
      type: 'all',
      title: 'Xác Nhận Xóa TOÀN BỘ Dữ Liệu Lịch Sử',
      count: records.length,
      description: `Bạn chuẩn bị xóa toàn bộ ${records.length} bản ghi khỏi hệ thống. Hành động này không thể hoàn tác. Bạn nên xuất bản sao lưu trước khi xóa.`,
      onConfirm: () => {
        onClearAll();
        setSelectedIds(new Set());
        showToast('Đã xóa toàn bộ dữ liệu lịch sử thành công!');
        setDeleteModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Import/Export Cards */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Quản Lý Dữ Liệu & Nhập Hàng Loạt
              </h3>
              <p className="text-xs text-slate-500">
                Tự động tách 3 số đầu, 3 số cuối, giữ nguyên số 0 ở đầu và tính Thứ trong tuần.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-dedup-top"
              type="button"
              onClick={handleRemoveAllDuplicates}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                duplicateStats.hasDuplicates
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Xóa tất cả kết quả trùng cùng Ngày và Đài, chỉ giữ lại 1 kết quả mới nhất"
            >
              <FilterX className="w-3.5 h-3.5 text-amber-600" />
              <span>Xóa trùng giữ 1{duplicateStats.totalDuplicates > 0 ? ` (${duplicateStats.totalDuplicates})` : ''}</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Khôi phục JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                className="hidden"
              />
            </label>

            <button
              onClick={handleClearAllConfirm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Xóa toàn bộ dữ liệu</span>
            </button>
          </div>
        </div>

        {/* Tab switch between Cluster (Chọn Thứ ra các đài), Single Station Series, Bulk text, and Single */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="tab-mode-cluster"
            onClick={() => setInputMode('cluster')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'cluster'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Chọn Thứ → Ra Các Đài Ngày Đó Để Nhập</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
              Cụm 3 - 4 đài
            </span>
          </button>

          <button
            id="tab-mode-singlestation"
            onClick={() => setInputMode('singleStation')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'singleStation'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Nhập 1 đài qua các tuần lần xổ</span>
          </button>

          <button
            id="tab-mode-bulk"
            onClick={() => setInputMode('bulk')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'bulk'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dán hàng loạt CSV / Text (Mục 13)</span>
          </button>

          <button
            id="tab-mode-single"
            onClick={() => setInputMode('single')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'single'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Thêm 1 kỳ đơn lẻ</span>
          </button>
        </div>

        {/* INPUT MODE: NHẬP 1 ĐÀI QUA CÁC TUẦN LẦN XỔ */}
        {inputMode === 'singleStation' && (
          <SingleStationSeriesInput
            existingRecords={records}
            onAddBulkRecords={onAddBulkRecords}
            onAddRecord={onAddRecord}
            showToast={showToast}
            isCollapsible={false}
            defaultExpanded={true}
          />
        )}

        {/* INPUT MODE 0: WEEKDAY CLUSTER (NHẬP HÀNG LOẠT CẢ 3 - 4 ĐÀI CHUNG THỨ) */}
        {inputMode === 'cluster' && (
          <WeekdayClusterInput
            existingRecords={records}
            onAddBulkRecords={onAddBulkRecords}
            showToast={showToast}
          />
        )}

        {/* INPUT MODE 1: BULK PASTE (Mục 13) */}
        {inputMode === 'bulk' && (
          <div className="space-y-3 pt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block mb-1">
                Định dạng chuẩn: Ngày,Đài,Kết quả 6 số
              </span>
              <p className="text-[11px] text-slate-500">
                Ví dụ: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">01/09/2026,Đài A,123456</code> hoặc <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">01/09/2026,TP.HCM,025678</code>. Hỗ trợ dấu phẩy, dấu chấm phẩy (;), tab hoặc dấu gạch đứng (|).
              </p>
            </div>

            <textarea
              rows={6}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="Dán các dòng dữ liệu vào đây..."
              className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviewBulk}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  Kiểm tra & Tách số tự động
                </button>
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bulkFilterInvalidWeekdays}
                  onChange={e => setBulkFilterInvalidWeekdays(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800">
                  Tự động loại bỏ đài nhập sai thứ mở thưởng XSMN & xóa trùng
                </span>
              </label>
            </div>

            {/* Bulk Preview Result */}
            {bulkParsedResult && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3 mt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Hợp lệ: {bulkParsedResult.validRecords.length} bản ghi
                    </span>
                    {bulkParsedResult.errors.length > 0 && (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        Lỗi: {bulkParsedResult.errors.length} dòng
                      </span>
                    )}
                    {bulkParsedResult.dedupInfo && bulkParsedResult.dedupInfo.duplicatesRemoved > 0 && (
                      <span className="text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                        <FilterX className="w-3.5 h-3.5 text-amber-600" />
                        Đã loại bỏ: {bulkParsedResult.dedupInfo.duplicatesRemoved} bản ghi (
                        {bulkParsedResult.dedupInfo.sameDayDuplicatesRemoved > 0 && `${bulkParsedResult.dedupInfo.sameDayDuplicatesRemoved} trùng ngày, `}
                        {bulkParsedResult.dedupInfo.crossDateWrongWeekdayRemoved > 0 && `${bulkParsedResult.dedupInfo.crossDateWrongWeekdayRemoved} trùng khác ngày sai thứ, `}
                        {bulkParsedResult.dedupInfo.invalidWeekdayRemoved > 0 && `${bulkParsedResult.dedupInfo.invalidWeekdayRemoved} sai lịch thứ`}
                        )
                      </span>
                    )}
                  </div>

                  {bulkParsedResult.validRecords.length > 0 && (
                    <button
                      onClick={handleConfirmImportBulk}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
                    >
                      Xác nhận lưu {bulkParsedResult.validRecords.length} bản ghi vào hệ thống
                    </button>
                  )}
                </div>

                {/* Errors display if any */}
                {bulkParsedResult.errors.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 max-h-32 overflow-y-auto text-[11px] text-rose-700 space-y-1">
                    {bulkParsedResult.errors.map((err, i) => (
                      <div key={i}>
                        Dòng {err.lineNum}: {err.reason} ({err.rawText})
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick preview of first 5 valid records */}
                {bulkParsedResult.validRecords.length > 0 && (
                  <div className="overflow-x-auto text-xs bg-white rounded-lg border border-slate-200">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Ngày</th>
                          <th className="p-2">Thứ</th>
                          <th className="p-2">Đài</th>
                          <th className="p-2 text-center">Giải ĐB 6 số</th>
                          <th className="p-2 text-center">3 số đầu</th>
                          <th className="p-2 text-center">3 số cuối</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkParsedResult.validRecords.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="p-2">{r.dateDisplay}</td>
                            <td className="p-2">{r.dayOfWeek}</td>
                            <td className="p-2 font-semibold">{r.station}</td>
                            <td className="p-2 text-center font-mono font-bold text-slate-800">{r.rawNumber}</td>
                            <td className="p-2 text-center font-mono font-bold text-blue-700">{r.head3}</td>
                            <td className="p-2 text-center font-mono font-bold text-purple-700">{r.tail3}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {bulkParsedResult.validRecords.length > 5 && (
                      <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 border-t border-slate-100">
                        ... và {bulkParsedResult.validRecords.length - 5} bản ghi khác
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* INPUT MODE 2: SINGLE ENTRY FORM (Mục 1) */}
        {inputMode === 'single' && (
          <form onSubmit={handleAddSingle} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Ngày quay:
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (singleParsedDate.valid) {
                          const parts = singleParsedDate.iso.split('-');
                          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                          d.setDate(d.getDate() - 1);
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          setSingleDate(`${y}-${m}-${dd}`);
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer text-[10px] font-mono"
                      title="Lùi 1 ngày (-1 ngày)"
                    >
                      -1N
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (singleParsedDate.valid) {
                          const parts = singleParsedDate.iso.split('-');
                          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                          d.setDate(d.getDate() + 1);
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          setSingleDate(`${y}-${m}-${dd}`);
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer text-[10px] font-mono font-bold"
                      title="Tiến 1 ngày (+1 ngày)"
                    >
                      +1N
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (singleParsedDate.valid) {
                          const parts = singleParsedDate.iso.split('-');
                          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                          d.setDate(d.getDate() + 7);
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          setSingleDate(`${y}-${m}-${dd}`);
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer text-[10px] font-mono"
                      title="Tiến 1 tuần (+7 ngày)"
                    >
                      +7N
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
                  required
                />
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-blue-600 font-semibold">
                    Thứ: {singleParsedDate.dayOfWeek}
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-slate-600 cursor-pointer select-none text-[11px]">
                    <input
                      type="checkbox"
                      checked={autoAdvanceSingleDate}
                      onChange={e => setAutoAdvanceSingleDate(e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                    />
                    <span className="font-medium text-emerald-700">Tự tăng +1 ngày</span>
                  </label>
                </div>

                {/* Quick Weekday selector for single record */}
                <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-medium">Chọn thứ:</span>
                  {VIETNAMESE_DAYS.map(dow => {
                    const isCur = singleParsedDate.valid && singleParsedDate.dayOfWeek === dow;
                    return (
                      <button
                        key={`single-jump-dow-${dow}`}
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          for (let i = 0; i < 7; i++) {
                            const d = new Date(today);
                            d.setDate(d.getDate() - i);
                            if (getVietnameseDayOfWeek(d) === dow) {
                              const yyyy = d.getFullYear();
                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                              const dd = String(d.getDate()).padStart(2, '0');
                              setSingleDate(`${yyyy}-${mm}-${dd}`);
                              const stations = XSMN_WEEKDAY_SCHEDULE[dow] || [];
                              if (stations.length > 0) setSingleStation(stations[0]);
                              break;
                            }
                          }
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer border ${
                          isCur
                            ? 'bg-red-600 text-white border-red-600 font-bold shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {dow}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Station */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Đài / Tỉnh (Chọn hoặc nhập mới):
                </label>
                <input
                  type="text"
                  list="station-options"
                  placeholder="VD: TP.HCM, Đồng Tháp..."
                  value={singleStation}
                  onChange={e => setSingleStation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
                  required
                />
                <datalist id="station-options">
                  <option value="TP.HCM" />
                  <option value="Long An" />
                  <option value="Đồng Tháp" />
                  <option value="Cà Mau" />
                  <option value="Bến Tre" />
                  <option value="Vũng Tàu" />
                  <option value="Bạc Liêu" />
                  <option value="Đồng Nai" />
                  <option value="Cần Thơ" />
                  <option value="Sóc Trăng" />
                  <option value="Tây Ninh" />
                  <option value="An Giang" />
                  <option value="Bình Thuận" />
                  <option value="Vĩnh Long" />
                  <option value="Bình Dương" />
                  <option value="Trà Vinh" />
                  <option value="Bình Phước" />
                  <option value="Hậu Giang" />
                  <option value="Tiền Giang" />
                  <option value="Kiên Giang" />
                  <option value="Đà Lạt" />
                </datalist>

                {/* Quick Station Select Chips */}
                <div className="mt-2 space-y-1.5">
                  {singleParsedDate.valid && (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Lịch đài {singleParsedDate.dayOfWeek}:
                        </span>
                        {(XSMN_WEEKDAY_SCHEDULE[singleParsedDate.dayOfWeek] || []).map(st => (
                          <button
                            key={`sched-${st}`}
                            type="button"
                            onClick={() => setSingleStation(st)}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer border ${
                              singleStation === st
                                ? 'bg-red-600 text-white border-red-600 shadow-2xs font-bold'
                                : 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setInputMode('cluster')}
                        className="text-[11px] text-red-600 hover:text-red-700 font-bold underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Nhập cùng lúc cả {(XSMN_WEEKDAY_SCHEDULE[singleParsedDate.dayOfWeek] || []).length} đài ngày này →</span>
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-medium mr-0.5">Chọn nhanh:</span>
                    {['Long An', 'TP.HCM', 'Đồng Tháp', 'Bến Tre', 'Vũng Tàu', 'Đồng Nai', 'Cần Thơ', 'Tây Ninh', 'An Giang', 'Tiền Giang'].map(st => (
                      <button
                        key={`quick-${st}`}
                        type="button"
                        onClick={() => setSingleStation(st)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          singleStation === st
                            ? 'bg-slate-800 text-white border-slate-800 font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6-Digit Number with Leading Zero Guarantee */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Kết quả đặc biệt (Đúng 6 số):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="VD: 025678"
                  value={singleNumber}
                  onChange={e => setSingleNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono tracking-widest focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Giữ nguyên số 0 ở đầu nếu có
                </span>
              </div>
            </div>

            {/* Existing Record Warning for Single Form */}
            {existingDuplicateRecord && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Đài <strong>{singleStation}</strong> ngày <strong>{singleParsedDate.display}</strong> đã có kết quả: <strong className="font-mono text-red-700 font-bold">{existingDuplicateRecord.rawNumber}</strong>. Khi lưu kết quả mới, hệ thống sẽ <strong>tự động loại bỏ kết quả cũ và ghi đè</strong>.
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px] shrink-0">
                  Tự động ghi đè
                </span>
              </div>
            )}

            {/* Cảnh báo đài không đúng thứ mở thưởng theo lịch XSMN */}
            {!isSingleDayValid && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-900">
                      Đài "{singleStation}" không mở thưởng vào {singleParsedDate.dayOfWeek}!
                    </div>
                    <div className="text-red-700 text-[11px] mt-0.5">
                      Theo lịch XSMN, đài <strong>{singleStation}</strong> chỉ mở thưởng vào: <strong className="text-red-900 font-semibold">{singleScheduledDays.join(', ')}</strong>. Ngày bạn chọn ({singleParsedDate.display}) là {singleParsedDate.dayOfWeek} (không đúng thứ trong xổ).
                    </div>
                  </div>
                </div>
                {nearestScheduled && (
                  <button
                    type="button"
                    onClick={() => {
                      setSingleDate(nearestScheduled.dateIso);
                      setSingleError('');
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] shrink-0 transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Chuyển sang {nearestScheduled.dayOfWeek} ({nearestScheduled.dateDisplay})</span>
                  </button>
                )}
              </div>
            )}

            {/* Cảnh báo trùng khác ngày của đài này trong cùng tuần */}
            {crossDateWeekDuplicate && (
              <div className="p-2.5 bg-purple-50 border border-purple-300 rounded-lg text-xs text-purple-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    Cảnh báo trùng khác ngày: Đài <strong>{singleStation}</strong> đã có kết quả ngày <strong>{crossDateWeekDuplicate.dateDisplay} ({crossDateWeekDuplicate.dayOfWeek})</strong> với số <strong className="font-mono text-purple-800">{crossDateWeekDuplicate.rawNumber}</strong> trong cùng tuần này. Nhập khác ngày sai thứ sẽ bị công cụ "Xóa trùng" tự động loại bỏ.
                  </span>
                </div>
              </div>
            )}

            {/* Split Preview & Actions */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span>
                  3 số đầu: <strong className="font-mono text-blue-700">{singleSplit.head3 || '---'}</strong>
                </span>
                <span>
                  3 số cuối: <strong className="font-mono text-purple-700">{singleSplit.tail3 || '---'}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <label className="inline-flex items-center gap-1.5 text-slate-600 cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={blockInvalidWeekdaySubmit}
                    onChange={e => setBlockInvalidWeekdaySubmit(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                  />
                  <span className="font-medium text-slate-700">Chặn lưu nếu sai thứ xổ</span>
                </label>

                {autoAdvanceSingleDate && (
                  <span className="text-[11px] text-emerald-700 font-medium hidden sm:inline-block">
                    ✓ Sau khi lưu: Ngày quay tự tăng +1 ngày
                  </span>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  Lưu kỳ quay này
                </button>
              </div>
            </div>

            {singleError && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {singleError}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Existing Records Table & Search */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-4 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Danh Sách Kết Quả Lịch Sử Đã Lưu ({records.length} bản ghi)
            </h4>
            <p className="text-xs text-slate-500">
              Dữ liệu được lưu an toàn trong trình duyệt (LocalStorage), không mất khi tải lại trang.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              id="btn-dedup-table"
              type="button"
              onClick={handleRemoveAllDuplicates}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                duplicateStats.hasIssues
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Xóa tất cả các kết quả trùng cùng Ngày và Đài, trùng khác ngày sai thứ, và loại bỏ bản ghi sai thứ mở thưởng XSMN"
            >
              <FilterX className="w-3.5 h-3.5 text-amber-600" />
              <span>Xóa trùng & sai thứ{duplicateStats.totalIssues > 0 ? ` (${duplicateStats.totalIssues})` : ''}</span>
            </button>

            <button
              onClick={() => exportRecordsToCSV(records)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất toàn bộ CSV</span>
            </button>
          </div>
        </div>

        {/* Banner cảnh báo phát hiện trùng ngày, trùng khác ngày sai thứ & sai lịch xổ */}
        {duplicateStats.hasIssues && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-col gap-3 text-xs shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-amber-950">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-amber-900 text-sm">
                      Phát hiện {duplicateStats.totalIssues} vấn đề dữ liệu trong hệ thống!
                    </p>
                    {duplicateStats.sameDayDuplicates > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[11px]">
                        {duplicateStats.sameDayDuplicates} trùng cùng ngày
                      </span>
                    )}
                    {duplicateStats.crossDateDuplicateCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-bold text-[11px]">
                        {duplicateStats.crossDateDuplicateCount} trùng khác ngày sai thứ
                      </span>
                    )}
                    {duplicateStats.invalidWeekdayCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold text-[11px]">
                        {duplicateStats.invalidWeekdayCount} sai thứ mở thưởng XSMN
                      </span>
                    )}
                  </div>
                  <p className="text-amber-800 text-[11px] mt-1">
                    Mỗi đài xổ số XSMN chỉ mở thưởng theo đúng các thứ quy định trong tuần. Nhấn nút dọn dẹp để tự động loại bỏ các bản ghi trùng lặp và bản ghi sai thứ trong xổ.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  id="btn-dedup-banner"
                  type="button"
                  onClick={handleRemoveAllDuplicates}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Loại bỏ toàn bộ kết quả trùng cùng ngày, trùng khác ngày sai thứ, và các bản ghi sai thứ mở thưởng"
                >
                  <FilterX className="w-4 h-4" />
                  <span>Xóa trùng & sai thứ ({duplicateStats.totalIssues} bản ghi)</span>
                </button>

                {duplicateStats.invalidWeekdayCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveInvalidWeekdayOnly}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title="Chỉ xóa các bản ghi đài quay không đúng thứ trong tuần"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa {duplicateStats.invalidWeekdayCount} bản ghi sai thứ</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Filter tabs for issues */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-200/70 text-[11px]">
              <span className="text-amber-800 font-semibold mr-1">Bộ lọc nhanh:</span>
              <button
                type="button"
                onClick={() => {
                  setFilterIssuesMode('none');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                  filterIssuesMode === 'none'
                    ? 'bg-amber-200 text-amber-950 border-amber-400 font-bold'
                    : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                Tất cả bản ghi ({records.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterIssuesMode(prev => prev === 'all_issues' ? 'none' : 'all_issues');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                  filterIssuesMode === 'all_issues'
                    ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-2xs'
                    : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                Lọc tất cả vấn đề ({duplicateStats.totalIssues})
              </button>

              {duplicateStats.sameDayDuplicates > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterIssuesMode(prev => prev === 'duplicates' ? 'none' : 'duplicates');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                    filterIssuesMode === 'duplicates'
                      ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-2xs'
                      : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  Chỉ trùng cùng ngày ({duplicateStats.sameDayDuplicates})
                </button>
              )}

              {duplicateStats.invalidWeekdayCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterIssuesMode(prev => prev === 'wrong_weekday' ? 'none' : 'wrong_weekday');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                    filterIssuesMode === 'wrong_weekday'
                      ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-2xs'
                      : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
                  }`}
                >
                  Chỉ bản ghi sai thứ ({duplicateStats.invalidWeekdayCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter / Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tìm kiếm (Số, Đài, Ngày):
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Lọc theo Đài:
            </label>
            <select
              value={stationFilter}
              onChange={e => {
                setStationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="ALL">-- Tất cả các đài --</option>
              {uniqueStations.map(st => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Lọc theo Thứ:
            </label>
            <select
              value={dayFilter}
              onChange={e => {
                setDayFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="ALL">-- Tất cả các thứ --</option>
              {VIETNAMESE_DAYS.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Feature Notice & Active Filter Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Hỗ trợ xóa dữ liệu:</strong> Bạn có thể xóa từng bản ghi bằng nút <Trash2 className="w-3.5 h-3.5 inline text-rose-600" />, tích ô vuông để <strong>xóa nhiều bản ghi cùng lúc</strong>, hoặc xóa theo bộ lọc.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {filterIssuesMode !== 'none' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-semibold">
                <span>
                  {filterIssuesMode === 'all_issues' && `Đang lọc toàn bộ vấn đề trùng & sai thứ (${filteredRecords.length})`}
                  {filterIssuesMode === 'duplicates' && `Đang lọc bản ghi trùng cùng ngày (${filteredRecords.length})`}
                  {filterIssuesMode === 'wrong_weekday' && `Đang lọc bản ghi sai thứ mở thưởng (${filteredRecords.length})`}
                </span>
                <button
                  type="button"
                  onClick={() => setFilterIssuesMode('none')}
                  className="text-amber-800 hover:text-black font-bold ml-1 cursor-pointer"
                  title="Bỏ lọc vấn đề"
                >
                  ✕
                </button>
              </div>
            )}

            {duplicateStats.hasIssues && (
              <button
                type="button"
                onClick={handleRemoveAllDuplicates}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition-colors cursor-pointer shadow-2xs"
                title="Xóa tất cả các kết quả trùng cùng Ngày & Đài, trùng khác ngày sai thứ, và loại bỏ bản ghi sai thứ mở thưởng"
              >
                <FilterX className="w-3.5 h-3.5 text-amber-700" />
                <span>Xóa trùng & sai thứ</span>
              </button>
            )}

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={confirmBeforeDelete}
                onChange={e => setConfirmBeforeDelete(e.target.checked)}
                className="w-3.5 h-3.5 text-red-600 rounded cursor-pointer"
              />
              <span>Hỏi xác nhận trước khi xóa</span>
            </label>

            {(stationFilter !== 'ALL' || searchTerm.trim() !== '' || dayFilter !== 'ALL') && filteredRecords.length > 0 && (
              <button
                onClick={handleDeleteFilteredRecords}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>Xóa {filteredRecords.length} bản ghi đang lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Bulk Selection Action Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-rose-900">
                Đã chọn {selectedIds.size} / {records.length} bản ghi
              </span>
              {filteredRecords.length > selectedIds.size && (
                <button
                  onClick={handleSelectAllFiltered}
                  className="text-blue-700 hover:underline font-semibold text-[11px]"
                >
                  (Chọn tất cả {filteredRecords.length} bản ghi theo bộ lọc)
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
              >
                Bỏ chọn
              </button>
              <button
                onClick={handleBatchDeleteSelected}
                className="px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa {selectedIds.size} bản ghi đã chọn</span>
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={handleToggleSelectPage}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    title={isAllCurrentPageSelected ? "Bỏ chọn trang này" : "Chọn tất cả trang này"}
                  />
                </th>
                <th className="p-2.5">Ngày</th>
                <th className="p-2.5">Thứ</th>
                <th className="p-2.5">Đài / Tỉnh</th>
                <th className="p-2.5 text-center">Giải Đặc Biệt (6 số)</th>
                <th className="p-2.5 text-center">3 số đầu</th>
                <th className="p-2.5 text-center">3 số cuối</th>
                <th className="p-2.5 text-center">Kỳ #</th>
                <th className="p-2.5 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400">
                    Không có bản ghi nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(r => (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      selectedIds.has(r.id) ? 'bg-rose-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => handleToggleSelect(r.id)}
                        className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        title="Chọn bản ghi này để thao tác hàng loạt"
                      />
                    </td>
                    <td className="p-2.5 font-medium text-slate-900">{r.dateDisplay}</td>
                    <td className="p-2.5 text-slate-600">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{r.dayOfWeek}</span>
                        {duplicateStats.invalidRecordIds.has(r.id) && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-300 font-bold inline-flex items-center gap-0.5"
                            title={`Đài ${r.station} chỉ mở thưởng vào: ${getScheduledDaysForStation(r.station).join(', ')}. Thứ này sai lịch mở thưởng XSMN!`}
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Sai thứ xổ</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{r.station}</span>
                        {duplicateStats.sameDayDuplicateKeys.has(getRecordKey(r.date, r.station)) && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold"
                            title="Bản ghi này bị trùng ngày & đài"
                          >
                            Trùng ngày
                          </span>
                        )}
                        {duplicateStats.crossDateDuplicateIds.has(r.id) && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800 border border-purple-300 font-bold"
                            title="Trùng khác ngày của đài này trong cùng tuần không đúng thứ trong xổ"
                          >
                            Trùng khác ngày
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-slate-900 tracking-wider">
                      {r.rawNumber}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                        {r.head3}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono font-bold">
                        {r.tail3}
                      </span>
                    </td>
                    <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                      {r.sessionIndex}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => handleConfirmDeleteSingle(r)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title={`Xóa bản ghi: ${r.station} - ${r.rawNumber}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredRecords.length)} trên tổng số {filteredRecords.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 font-medium"
              >
                Trước
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 font-medium"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* In-App Delete Confirmation Modal (Works 100% in iFrame & Sandbox) */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">{deleteModal.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {deleteModal.description}
                </p>
              </div>
            </div>

            {deleteModal.record && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ngày quay:</span>
                  <span className="font-bold text-slate-900">
                    {deleteModal.record.dateDisplay} ({deleteModal.record.dayOfWeek})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Đài / Tỉnh:</span>
                  <span className="font-bold text-red-700">{deleteModal.record.station}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Giải ĐB (6 số):</span>
                  <span className="font-mono font-bold text-slate-900 tracking-wider">
                    {deleteModal.record.rawNumber}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-blue-700">3 số đầu: <strong>{deleteModal.record.head3}</strong></span>
                  <span className="text-purple-700">3 số cuối: <strong>{deleteModal.record.tail3}</strong></span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={deleteModal.onConfirm}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl border bg-slate-900 text-white text-xs border-slate-700 animate-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white p-0.5"
            title="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
