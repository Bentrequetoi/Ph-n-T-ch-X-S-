import React, { useState, useMemo } from 'react';
import {
  DrawRelation,
  RepeatedRelationSummary,
  DayOfWeek,
  RelationType,
  AlertColor
} from '../types';
import { VIETNAMESE_DAYS } from '../utils/dateUtils';
import { WarningLegend } from './WarningLegend';
import {
  Filter,
  Search,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  Repeat,
  FileSpreadsheet,
  Maximize2,
  Database,
  PlusCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { exportRelationsToCSV } from '../utils/storage';
import { RatioStatistics } from './RatioStatistics';
import { SingleStationSeriesInput } from './SingleStationSeriesInput';
import { LotteryRecord } from '../types';

interface RelationTableProps {
  relations: DrawRelation[];
  repeatedSummaries: RepeatedRelationSummary[];
  uniqueStations: string[];
  totalRecordsCount?: number;
  records?: LotteryRecord[];
  onAddBulkRecords?: (newRecords: LotteryRecord[]) => void;
  onShowToast?: (text: string, type?: 'success' | 'error') => void;
  onLoadSampleData?: () => void;
  onNavigateToData?: () => void;
  onViewDetails: (title: string, subtitle: string, rels: DrawRelation[]) => void;
}

export const RelationTable: React.FC<RelationTableProps> = ({
  relations,
  repeatedSummaries,
  uniqueStations,
  totalRecordsCount,
  records = [],
  onAddBulkRecords,
  onShowToast,
  onLoadSampleData,
  onNavigateToData,
  onViewDetails,
}) => {
  // Filters
  const [sourceStation, setSourceStation] = useState<string>('ALL');
  const [targetStation, setTargetStation] = useState<string>('ALL');
  const [selectedCycles, setSelectedCycles] = useState<number[]>([]);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [selectedRelationType, setSelectedRelationType] = useState<string>('ALL');
  const [minSimilarity, setMinSimilarity] = useState<number>(0);
  const [searchNumber, setSearchNumber] = useState<string>('');
  const [colorFilter, setColorFilter] = useState<string>('ALL');

  // Pagination for main table
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  // Active view toggle: Chi tiết đối chiếu vs Bảng tần suất lặp lại vs Thống kê tỉ lệ
  const [subTab, setSubTab] = useState<'details' | 'repeats' | 'ratio_stats'>('details');

  // Quick core ratio statistics calculation
  const quickRatioStats = useMemo(() => {
    const total = relations.length;
    if (total === 0) {
      return {
        total: 0,
        exactCount: 0,
        exactRate: 0,
        permuteCount: 0,
        permuteRate: 0,
        reverseCount: 0,
        reverseRate: 0,
        match23Count: 0,
        match23Rate: 0,
      };
    }

    let exactCount = 0;
    let reverseCount = 0;
    let permuteCount = 0;
    let match23Count = 0;

    for (let i = 0; i < total; i++) {
      const type = relations[i].relationType;
      if (type === 'TRUNG_3_3' || relations[i].isExactMatch) {
        exactCount++;
      } else if (type === 'DAO_NGUOC') {
        reverseCount++;
        permuteCount++;
      } else if (type === 'HOAN_VI') {
        permuteCount++;
      } else if (type === 'TRUNG_2_3' || type === 'TRUNG_VI_TRI') {
        match23Count++;
      }
    }

    return {
      total,
      exactCount,
      exactRate: (exactCount / total) * 100,
      permuteCount,
      permuteRate: (permuteCount / total) * 100,
      reverseCount,
      reverseRate: (reverseCount / total) * 100,
      match23Count,
      match23Rate: (match23Count / total) * 100,
    };
  }, [relations]);

  // Cycle options as explicitly required in #3
  const cyclePresets = [
    { label: 'Kế tiếp (+1)', val: 1 },
    { label: '+2 kỳ', val: 2 },
    { label: '+3 kỳ', val: 3 },
    { label: '+4 kỳ', val: 4 },
    { label: '+5 kỳ', val: 5 },
    { label: '+6 kỳ', val: 6 },
    { label: '+7 kỳ', val: 7 },
    { label: '+14 kỳ', val: 14 },
    { label: '+21 kỳ', val: 21 },
    { label: '+30 kỳ', val: 30 },
  ];

  // Toggle cycle preset
  const toggleCycle = (val: number) => {
    setPage(1);
    setSelectedCycles(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  };

  // Toggle day
  const toggleDay = (day: DayOfWeek) => {
    setPage(1);
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Reset filters
  const resetFilters = () => {
    setSourceStation('ALL');
    setTargetStation('ALL');
    setSelectedCycles([]);
    setSelectedDays([]);
    setSelectedRelationType('ALL');
    setMinSimilarity(0);
    setSearchNumber('');
    setColorFilter('ALL');
    setPage(1);
  };

  // Filtered relations
  const filteredRelations = useMemo(() => {
    return relations.filter(r => {
      // Source Station
      if (sourceStation !== 'ALL' && r.sourceStation !== sourceStation) return false;
      // Target Station
      if (targetStation !== 'ALL' && r.targetStation !== targetStation) return false;
      // Cycle
      if (selectedCycles.length > 0 && !selectedCycles.includes(r.cycleDistance)) return false;
      // Days
      if (selectedDays.length > 0 && !selectedDays.includes(r.sourceDayOfWeek) && !selectedDays.includes(r.targetDayOfWeek)) return false;
      // Relation type
      if (selectedRelationType !== 'ALL') {
        if (selectedRelationType === 'HOAN_VI_GROUP') {
          if (r.relationType !== 'HOAN_VI' && r.relationType !== 'DAO_NGUOC') return false;
        } else if (r.relationType !== selectedRelationType) {
          return false;
        }
      }
      // Similarity score
      if (r.similarityScore < minSimilarity) return false;
      // Color
      if (colorFilter !== 'ALL' && r.alertColor !== colorFilter) return false;
      // Search number (search in 3 số đầu or 3 số cuối)
      if (searchNumber.trim() !== '') {
        const q = searchNumber.trim();
        if (!r.sourceHead3.includes(q) && !r.targetTail3.includes(q)) return false;
      }
      return true;
    });
  }, [
    relations,
    sourceStation,
    targetStation,
    selectedCycles,
    selectedDays,
    selectedRelationType,
    minSimilarity,
    colorFilter,
    searchNumber,
  ]);

  // Filtered repeated summaries
  const filteredRepeats = useMemo(() => {
    return repeatedSummaries.filter(rep => {
      if (sourceStation !== 'ALL' && rep.sourceStation !== sourceStation) return false;
      if (targetStation !== 'ALL' && rep.targetStation !== targetStation) return false;
      if (searchNumber.trim() !== '') {
        const q = searchNumber.trim();
        if (!rep.sourceHead3.includes(q) && !rep.targetTail3.includes(q)) return false;
      }
      if (colorFilter !== 'ALL' && rep.alertColor !== colorFilter) return false;
      return true;
    });
  }, [repeatedSummaries, sourceStation, targetStation, searchNumber, colorFilter]);

  // Paginated relations
  const totalPages = Math.ceil(filteredRelations.length / pageSize) || 1;
  const paginatedRelations = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRelations.slice(start, start + pageSize);
  }, [filteredRelations, page, pageSize]);

  // Empty State 1: Chưa có dữ liệu trong hệ thống
  if (totalRecordsCount === 0 || (relations.length === 0 && (totalRecordsCount === undefined || totalRecordsCount === 0))) {
    return (
      <div className="space-y-5">
        {/* Ô NHẬP DỮ LIỆU NGAY TRÊN TRANG ĐẦU */}
        {onAddBulkRecords && (
          <SingleStationSeriesInput
            existingRecords={records}
            onAddBulkRecords={onAddBulkRecords}
            showToast={(text, type) => {
              if (onShowToast) {
                onShowToast(text, type === 'error' ? 'error' : 'success');
              }
            }}
            isCollapsible={false}
            defaultExpanded={true}
          />
        )}

        <WarningLegend />

        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <Database className="w-8 h-8 text-slate-600" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            Bảng Phân Tích Chi Tiết Đang Trống (Chưa Có Dữ Liệu)
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed mb-6">
            Hệ thống hiện chưa có bản ghi kết quả xổ số nào. Bảng phân tích chi tiết sẽ tự động tính toán đối chiếu <strong>3 số đầu</strong> của đài nguồn với <strong>3 số cuối</strong> của đài đích qua tất cả các chu kỳ (+1 đến +30 kỳ) ngay khi có dữ liệu.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {onLoadSampleData && (
              <button
                type="button"
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp Dữ Liệu Mẫu XSMN (50+ kỳ quay)</span>
              </button>
            )}

            {onNavigateToData && (
              <button
                type="button"
                onClick={onNavigateToData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl border border-slate-300 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-slate-700" />
                <span>Nhập Dữ Liệu Kết Quả Mới</span>
              </button>
            )}
          </div>

          {/* Sơ đồ cấu trúc Bảng phân tích chi tiết khi có dữ liệu */}
          <div className="border-t border-slate-100 pt-6 text-left max-w-3xl mx-auto">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 text-center sm:text-left">
              Bảng Phân Tích Chi Tiết sẽ cung cấp những gì khi nạp dữ liệu:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] flex items-center justify-center font-black">1</span>
                  <span>Đối Chiếu Đầu ➔ Cuối</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Lấy 3 số đầu của Đài A (ngày trước) làm nguồn, đối chiếu với 3 số cuối của Đài B (ngày sau) làm đích qua các chu kỳ (+1, +2, ..., +30).
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[11px] flex items-center justify-center font-black">2</span>
                  <span>Tô Màu Cảnh Báo</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Tự động tô màu Đỏ (trùng khớp 3/3 hoặc lặp cao), Cam (tương đồng 67-85%), Vàng (33%), Xanh (bình thường).
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] flex items-center justify-center font-black">3</span>
                  <span>Bảo Toàn Số 0 Ở Đầu</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Bộ số được xử lý dưới dạng chuỗi ký tự cố định 3 chữ số (ví dụ: "025", "008"), không bao giờ bị cắt mất số 0.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty State 2: Chỉ có 1 bản ghi trong hệ thống
  if (totalRecordsCount === 1) {
    return (
      <div className="space-y-5">
        {/* Ô NHẬP DỮ LIỆU NGAY TRÊN TRANG ĐẦU */}
        {onAddBulkRecords && (
          <SingleStationSeriesInput
            existingRecords={records}
            onAddBulkRecords={onAddBulkRecords}
            showToast={(text, type) => {
              if (onShowToast) {
                onShowToast(text, type === 'error' ? 'error' : 'success');
              }
            }}
            isCollapsible={false}
            defaultExpanded={true}
          />
        )}

        <WarningLegend />

        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <AlertCircle className="w-7 h-7" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
            Cần Tối Thiểu 2 Kỳ Quay Thưởng Để Bắt Đầu Phân Tích
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed mb-6">
            Hệ thống hiện tại mới ghi nhận 1 bản ghi kết quả. Thuật toán đối chiếu Đầu ➔ Cuối cần tối thiểu 2 kỳ quay khác nhau để tính khoảng cách chu kỳ và tìm kiếm quan hệ dịch chuyển số.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {onNavigateToData && (
              <button
                type="button"
                onClick={onNavigateToData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Thêm Kỳ Quay Tiếp Theo</span>
              </button>
            )}

            {onLoadSampleData && (
              <button
                type="button"
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl border border-slate-300 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-red-600" />
                <span>Nạp Dữ Liệu Mẫu XSMN</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Ô NHẬP DỮ LIỆU NGAY TRÊN TRANG ĐẦU: 1 ĐÀI QUA CÁC TUẦN LẦN XỔ */}
      {onAddBulkRecords && (
        <SingleStationSeriesInput
          existingRecords={records}
          onAddBulkRecords={onAddBulkRecords}
          showToast={(text, type) => {
            if (onShowToast) {
              onShowToast(text, type === 'error' ? 'error' : 'success');
            }
          }}
          isCollapsible={true}
          defaultExpanded={records.length < 5}
        />
      )}

      {/* Warning Legend banner */}
      <WarningLegend />

      {/* Filter Control Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Bộ Lọc Phân Tích Chuyên Sâu</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >
              Đặt lại tất cả lọc
            </button>
            <button
              onClick={() => exportRelationsToCSV(filteredRelations)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất kết quả ({filteredRelations.length})</span>
            </button>
          </div>
        </div>

        {/* Row 1: Stations & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Source Station */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Đài nguồn (3 số đầu):
            </label>
            <select
              value={sourceStation}
              onChange={e => {
                setSourceStation(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="ALL">-- Tất cả các đài nguồn --</option>
              {uniqueStations.map(st => (
                <option key={`src-${st}`} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Target Station */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Đài đích (3 số cuối):
            </label>
            <select
              value={targetStation}
              onChange={e => {
                setTargetStation(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="ALL">-- Tất cả các đài đích --</option>
              {uniqueStations.map(st => (
                <option key={`tgt-${st}`} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Search by 3 numbers */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tìm theo số (Đầu hoặc Cuối):
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="VD: 123 hoặc 025..."
                value={searchNumber}
                onChange={e => {
                  setSearchNumber(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Alert Color Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Lọc theo màu cảnh báo:
            </label>
            <select
              value={colorFilter}
              onChange={e => {
                setColorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="ALL">-- Tất cả mức cảnh báo --</option>
              <option value="red">🔴 Màu ĐỎ (Trùng 100% / Tần suất ≥ 3)</option>
              <option value="orange">🟠 Màu CAM (Tương đồng cao / Hoán vị / Đảo)</option>
              <option value="yellow">🟡 Màu VÀNG (Tương đồng 1 phần 33%)</option>
              <option value="green">🟢 Màu XANH (Bình thường)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Cycle distances (Mục 3) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Khoảng cách chu kỳ phân tích (Chọn một hoặc nhiều chu kỳ):
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCycles([])}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                selectedCycles.length === 0
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả chu kỳ
            </button>
            {cyclePresets.map(preset => {
              const isSelected = selectedCycles.includes(preset.val);
              return (
                <button
                  key={preset.val}
                  onClick={() => toggleCycle(preset.val)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Day of Week Filters (Mục 7) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Lọc theo Thứ trong tuần (Tất cả, 1 thứ, hoặc nhiều thứ):
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedDays([])}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                selectedDays.length === 0
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả các thứ
            </button>
            {VIETNAMESE_DAYS.map(day => {
              const isSelected = selectedDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 4: Relation Type & Similarity Score */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Loại quan hệ số (Mục 6):
            </label>
            <select
              value={selectedRelationType}
              onChange={e => {
                setSelectedRelationType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="ALL">-- Tất cả loại quan hệ --</option>
              <option value="TRUNG_3_3">🔴 Trùng hoàn toàn 3 số (100% - Trùng riêng)</option>
              <option value="HOAN_VI_GROUP">🟠 Bộ 3 số hoán vị & đảo ngược (75% - 85% - Hoán vị riêng)</option>
              <option value="DAO_NGUOC">Đảo ngược vị trí (ví dụ 123 ⇄ 321)</option>
              <option value="HOAN_VI">Hoán vị chữ số (ví dụ 123 ⟷ 132)</option>
              <option value="TRUNG_2_3">🔵 Trùng 2/3 chữ số (67%)</option>
              <option value="TRUNG_VI_TRI">Trùng 2 vị trí cố định</option>
              <option value="TRUNG_1_3">Trùng 1/3 chữ số (33%)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Mức độ tương đồng lịch sử tối thiểu: {minSimilarity}%
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="33"
                value={minSimilarity}
                onChange={e => {
                  setMinSimilarity(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full accent-red-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 min-w-[36px]">
                {minSimilarity}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Statistical Summary: Thống Kê Tỉ Lệ Trùng Riêng & Hoán Vị Bộ 3 Số Riêng */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-700/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Tỉ lệ trùng riêng */}
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm animate-pulse"></span>
            <div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold flex items-center gap-1">
                <span>Tỉ Lệ Trùng Riêng (3/3)</span>
                <span className="text-rose-400 font-bold">100%</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-rose-400">
                  {quickRatioStats.exactRate.toFixed(2)}%
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  ({quickRatioStats.exactCount}/{quickRatioStats.total} đối chiếu)
                </span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>

          {/* Tỉ lệ hoán vị riêng */}
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></span>
            <div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold flex items-center gap-1">
                <span>Tỉ Lệ Hoán Vị Riêng</span>
                <span className="text-amber-400 font-bold">75% - 85%</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                  {quickRatioStats.permuteRate.toFixed(2)}%
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  ({quickRatioStats.permuteCount}/{quickRatioStats.total} đối chiếu)
                </span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-700 hidden md:block"></div>

          {/* Tỉ lệ trùng 2/3 */}
          <div className="hidden md:flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-sm"></span>
            <div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                Trùng 2/3 chữ số
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-blue-300">
                  {quickRatioStats.match23Rate.toFixed(1)}%
                </span>
                <span className="text-[11px] text-slate-400">
                  ({quickRatioStats.match23Count})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
          <button
            type="button"
            onClick={() => {
              setSelectedRelationType('TRUNG_3_3');
              setSubTab('details');
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedRelationType === 'TRUNG_3_3' && subTab === 'details'
                ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                : 'bg-rose-600/80 hover:bg-rose-600 text-white'
            }`}
          >
            Lọc Trùng Riêng ({quickRatioStats.exactCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRelationType('HOAN_VI_GROUP');
              setSubTab('details');
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedRelationType === 'HOAN_VI_GROUP' && subTab === 'details'
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            Lọc Hoán Vị Riêng ({quickRatioStats.permuteCount})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('ratio_stats')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              subTab === 'ratio_stats'
                ? 'bg-white text-slate-900 border-white font-bold'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
            }`}
          >
            Báo cáo thống kê tỉ lệ chi tiết →
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Bảng Chi Tiết Đối Chiếu vs Bảng Tần Suất Lặp Lại vs Thống Kê Tỉ Lệ Riêng */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setSubTab('details')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'details'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Bảng Phân Tích Chi Tiết ({filteredRelations.length})</span>
          </button>

          <button
            onClick={() => setSubTab('repeats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'repeats'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Phát Hiện Sự Giống Nhau Lặp Lại ({filteredRepeats.length})</span>
          </button>

          <button
            onClick={() => setSubTab('ratio_stats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'ratio_stats'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Thống Kê Tỉ Lệ Trùng & Hoán Vị Riêng</span>
            <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono font-bold">
              {quickRatioStats.exactRate.toFixed(1)}% | {quickRatioStats.permuteRate.toFixed(1)}%
            </span>
          </button>
        </div>

        <span className="text-xs text-slate-500 hidden sm:inline font-medium">
          {subTab === 'details'
            ? `Hiển thị trang ${page} / ${totalPages}`
            : subTab === 'repeats'
            ? `${filteredRepeats.length} mẫu lặp`
            : `${uniqueStations.length} đài xổ số`}
        </span>
      </div>

      {/* VIEW 1: BẢNG PHÂN TÍCH CHI TIẾT (Mục 11) */}
      {subTab === 'details' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Ngày nguồn</th>
                  <th className="py-3 px-3">Đài nguồn</th>
                  <th className="py-3 px-3 text-center">3 số đầu</th>
                  <th className="py-3 px-2 text-center">→</th>
                  <th className="py-3 px-3 text-center">3 số cuối</th>
                  <th className="py-3 px-3">Đài đích</th>
                  <th className="py-3 px-3">Ngày đích</th>
                  <th className="py-3 px-3 text-center">Khoảng cách</th>
                  <th className="py-3 px-3 text-center">Mức tương đồng</th>
                  <th className="py-3 px-3">Loại quan hệ</th>
                  <th className="py-3 px-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRelations.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <div className="max-w-md mx-auto text-center space-y-2">
                        <Filter className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm font-semibold text-slate-700">
                          Không tìm thấy quan hệ nào phù hợp với bộ lọc hiện tại
                        </p>
                        <p className="text-xs text-slate-500">
                          Hệ thống hiện có <strong>{relations.length}</strong> quan hệ đối chiếu giữa các đài. Hãy thử nới lỏng bộ lọc hoặc bấm nút đặt lại bên dưới.
                        </p>
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Đặt lại tất cả bộ lọc</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRelations.map((rel, idx) => {
                    // Row styling based on Requirement #5 & #11:
                    // Tô ĐỎ dòng trùng khớp 3/3 hoặc lặp cao
                    // Tô CAM dòng tương đồng cao
                    // Tô VÀNG dòng tương đồng 1 phần
                    const rowClass =
                      rel.alertColor === 'red'
                        ? 'bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-l-rose-600'
                        : rel.alertColor === 'orange'
                        ? 'bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                        : rel.alertColor === 'yellow'
                        ? 'bg-yellow-50/40 hover:bg-yellow-100/50 border-l-4 border-l-yellow-400'
                        : 'bg-white hover:bg-slate-50 border-l-4 border-l-slate-200';

                    const badgeColor =
                      rel.alertColor === 'red'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : rel.alertColor === 'orange'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : rel.alertColor === 'yellow'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                    return (
                      <tr key={rel.id || idx} className={`${rowClass} transition-colors`}>
                        {/* Source Date */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{rel.sourceRecord.dateDisplay}</div>
                          <div className="text-[11px] text-slate-500">{rel.sourceDayOfWeek}</div>
                        </td>

                        {/* Source Station */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rel.sourceStation}
                        </td>

                        {/* Source Head 3 */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-bold text-xs tracking-wider">
                            {rel.sourceHead3}
                          </span>
                        </td>

                        {/* Arrow */}
                        <td className="py-2.5 px-2 text-center text-slate-400">
                          <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                        </td>

                        {/* Target Tail 3 */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono font-bold text-xs tracking-wider">
                            {rel.targetTail3}
                          </span>
                        </td>

                        {/* Target Station */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rel.targetStation}
                        </td>

                        {/* Target Date */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{rel.targetRecord.dateDisplay}</div>
                          <div className="text-[11px] text-slate-500">{rel.targetDayOfWeek}</div>
                        </td>

                        {/* Cycle Distance */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            +{rel.cycleDistance} kỳ
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">{rel.dayDistance} ngày</div>
                        </td>

                        {/* Similarity Score */}
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            rel.similarityScore === 100
                              ? 'text-rose-700 bg-rose-100'
                              : rel.similarityScore >= 67
                              ? 'text-amber-800 bg-amber-100'
                              : 'text-slate-600 bg-slate-100'
                          }`}>
                            {rel.similarityScore}%
                          </span>
                        </td>

                        {/* Relation Type */}
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeColor}`}>
                            {rel.isExactMatch && <CheckCircle2 className="w-3 h-3" />}
                            {rel.relationTypeLabel}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() =>
                              onViewDetails(
                                `Đối chiếu: ${rel.sourceStation} → ${rel.targetStation}`,
                                `3 số đầu [${rel.sourceHead3}] → 3 số cuối [${rel.targetTail3}]`,
                                [rel]
                              )
                            }
                            title="Xem chi tiết cặp kỳ quay"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs">
              <span className="text-slate-500">
                Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredRelations.length)} trên tổng số {filteredRelations.length} quan hệ
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 font-medium"
                >
                  Trước
                </button>
                <span className="px-2 font-bold text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 font-medium"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PHÁT HIỆN SỰ GIỐNG NHAU LẶP LẠI (Mục 4) */}
      {subTab === 'repeats' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Tổng Hợp Tần Suất Lặp Lại Quan Hệ Đầu → Cuối
              </h4>
              <p className="text-xs text-slate-500">
                Ghi nhận số lần cùng một quan hệ (Đài nguồn → Đài đích : Số) xuất hiện trong dữ liệu lịch sử
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {filteredRepeats.length} quan hệ lặp
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Đài nguồn</th>
                  <th className="py-3 px-3">Đài đích</th>
                  <th className="py-3 px-3 text-center">Số (Đầu → Cuối)</th>
                  <th className="py-3 px-3">Quan hệ</th>
                  <th className="py-3 px-3 text-center">Số lần lặp</th>
                  <th className="py-3 px-3 text-center">Chu kỳ thường gặp</th>
                  <th className="py-3 px-3">Lần gần nhất</th>
                  <th className="py-3 px-3 text-center">Bằng chứng lịch sử</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRepeats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Chưa ghi nhận quan hệ lặp lại nào theo bộ lọc đã chọn.
                    </td>
                  </tr>
                ) : (
                  filteredRepeats.map(summary => {
                    const isHighRepeat = summary.repeatCount >= 3;
                    const rowClass =
                      summary.alertColor === 'red'
                        ? 'bg-rose-50/70 hover:bg-rose-100/70 font-medium'
                        : summary.alertColor === 'orange'
                        ? 'bg-amber-50/60 hover:bg-amber-100/60'
                        : 'bg-white hover:bg-slate-50';

                    return (
                      <tr key={summary.id} className={`${rowClass} transition-colors`}>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {summary.sourceStation}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {summary.targetStation}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold tracking-wider">
                            {summary.sourceHead3} → {summary.targetTail3}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {summary.relationLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                            isHighRepeat
                              ? 'bg-rose-600 text-white shadow-xs'
                              : summary.repeatCount === 2
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {summary.repeatCount} lần
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-semibold text-slate-700">
                            +{summary.mostCommonCycle} kỳ
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            (tb: {summary.averageCycleDistance} kỳ)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {summary.latestDate}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() =>
                              onViewDetails(
                                `Lịch sử lặp: ${summary.sourceStation} → ${summary.targetStation}`,
                                `Bộ số [${summary.sourceHead3}] xuất hiện ${summary.repeatCount} lần`,
                                summary.occurrences
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors shadow-2xs"
                          >
                            <Maximize2 className="w-3 h-3 text-slate-400" />
                            <span>Xem {summary.occurrences.length} lần</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: BẢNG THỐNG KÊ TỈ LỆ TRÙNG RIÊNG VÀ HOÁN VỊ BỘ 3 SỐ RIÊNG */}
      {subTab === 'ratio_stats' && (
        <RatioStatistics
          relations={relations}
          uniqueStations={uniqueStations}
          onFilterExact={() => {
            setSelectedRelationType('TRUNG_3_3');
            setSubTab('details');
            setPage(1);
          }}
          onFilterPermute={() => {
            setSelectedRelationType('HOAN_VI_GROUP');
            setSubTab('details');
            setPage(1);
          }}
          onFilterReverse={() => {
            setSelectedRelationType('DAO_NGUOC');
            setSubTab('details');
            setPage(1);
          }}
          onFilter23={() => {
            setSelectedRelationType('TRUNG_2_3');
            setSubTab('details');
            setPage(1);
          }}
          onViewDetails={onViewDetails}
        />
      )}
    </div>
  );
};
