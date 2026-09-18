import React, { useState, useMemo } from 'react';
import { HistoricPattern, DrawRelation, LotteryRecord, DayOfWeek } from '../types';
import { WarningLegend } from './WarningLegend';
import { PatternDateCalculator } from './PatternDateCalculator';
import {
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileSearch,
  Filter,
  Maximize2,
  PlusCircle,
  CalendarDays,
  Clock,
  ArrowUpDown,
  X,
  Target
} from 'lucide-react';

interface PatternDetectionProps {
  patterns: HistoricPattern[];
  records?: LotteryRecord[];
  totalRecordsCount?: number;
  onLoadSampleData?: () => void;
  onNavigateToData?: () => void;
  onViewDetails: (title: string, subtitle: string, rels: DrawRelation[]) => void;
}

export const PatternDetection: React.FC<PatternDetectionProps> = ({
  patterns,
  records = [],
  totalRecordsCount,
  onLoadSampleData,
  onNavigateToData,
  onViewDetails,
}) => {
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'HEAD_TO_TAIL' | 'TAIL_TO_TAIL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedConfidence, setSelectedConfidence] = useState<string>('ALL');
  const [selectedTiming, setSelectedTiming] = useState<string>('ALL');
  const [selectedTargetDay, setSelectedTargetDay] = useState<string>('ALL');
  const [dateSearchQuery, setDateSearchQuery] = useState<string>('');
  const [stationSearchQuery, setStationSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DATE_ASC' | 'REPEAT_DESC' | 'CYCLE_ASC'>('DATE_ASC');

  // Counts by scope
  const headPatternCount = useMemo(() => patterns.filter(p => p.patternScope === 'HEAD_TO_TAIL').length, [patterns]);
  const tailPatternCount = useMemo(() => patterns.filter(p => p.patternScope === 'TAIL_TO_TAIL').length, [patterns]);

  // Filter patterns
  const filteredPatterns = useMemo(() => {
    return patterns.filter(p => {
      if (selectedScope !== 'ALL' && p.patternScope !== selectedScope) return false;
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (selectedConfidence !== 'ALL' && p.confidenceType !== selectedConfidence) return false;

      // Filter by timing
      if (selectedTiming === 'UPCOMING_3') {
        if (!p.estimatedDrawDate) return false;
        if (p.estimatedDrawDate.daysRemaining < 0 || p.estimatedDrawDate.daysRemaining > 3) return false;
      } else if (selectedTiming === 'UPCOMING_7') {
        if (!p.estimatedDrawDate) return false;
        if (p.estimatedDrawDate.daysRemaining < 0 || p.estimatedDrawDate.daysRemaining > 7) return false;
      } else if (selectedTiming === 'TODAY_OR_TOMORROW') {
        if (!p.estimatedDrawDate) return false;
        if (p.estimatedDrawDate.daysRemaining < 0 || p.estimatedDrawDate.daysRemaining > 1) return false;
      }

      // Filter by Target Weekday
      if (selectedTargetDay !== 'ALL') {
        if (!p.estimatedDrawDate || p.estimatedDrawDate.estimatedDayOfWeek !== selectedTargetDay) {
          return false;
        }
      }

      // Filter by Date search query
      if (dateSearchQuery.trim()) {
        const query = dateSearchQuery.trim().toLowerCase();
        if (
          !p.estimatedDrawDate ||
          (!p.estimatedDrawDate.estimatedDateDisplay.toLowerCase().includes(query) &&
            !p.estimatedDrawDate.estimatedDayOfWeek.toLowerCase().includes(query))
        ) {
          return false;
        }
      }

      // Filter by Station query
      if (stationSearchQuery.trim()) {
        const sQuery = stationSearchQuery.trim().toLowerCase();
        const matchSrc = p.sourceStation.toLowerCase().includes(sQuery);
        const matchTgt = p.targetStation.toLowerCase().includes(sQuery);
        if (!matchSrc && !matchTgt) return false;
      }

      return true;
    });
  }, [
    patterns,
    selectedCategory,
    selectedConfidence,
    selectedTiming,
    selectedTargetDay,
    dateSearchQuery,
    stationSearchQuery,
  ]);

  // Sort patterns
  const sortedPatterns = useMemo(() => {
    const list = [...filteredPatterns];
    if (sortBy === 'DATE_ASC') {
      list.sort((a, b) => {
        // Upcoming first, then lowest daysRemaining
        const daysA = a.estimatedDrawDate ? a.estimatedDrawDate.daysRemaining : 999;
        const daysB = b.estimatedDrawDate ? b.estimatedDrawDate.daysRemaining : 999;
        return daysA - daysB;
      });
    } else if (sortBy === 'REPEAT_DESC') {
      list.sort((a, b) => b.repeatCount - a.repeatCount);
    } else if (sortBy === 'CYCLE_ASC') {
      list.sort((a, b) => {
        const cA = typeof a.cycleDistance === 'number' ? a.cycleDistance : 99;
        const cB = typeof b.cycleDistance === 'number' ? b.cycleDistance : 99;
        return cA - cB;
      });
    }
    return list;
  }, [filteredPatterns, sortBy]);

  // Handler from PatternDateCalculator
  const handleSelectEstimatedDateFilter = (targetDateDisplay: string) => {
    setDateSearchQuery(targetDateDisplay);
  };

  const handleSelectStationFilter = (station: string) => {
    setStationSearchQuery(station);
  };

  const handleClearFilters = () => {
    setSelectedScope('ALL');
    setSelectedCategory('ALL');
    setSelectedConfidence('ALL');
    setSelectedTiming('ALL');
    setSelectedTargetDay('ALL');
    setDateSearchQuery('');
    setStationSearchQuery('');
    setSortBy('DATE_ASC');
  };

  // Quick stats
  const upcomingCount = useMemo(() => {
    return patterns.filter(
      p => p.estimatedDrawDate && p.estimatedDrawDate.daysRemaining >= 0 && p.estimatedDrawDate.daysRemaining <= 7
    ).length;
  }, [patterns]);

  return (
    <div className="space-y-5">
      <WarningLegend />

      {/* Intro Box & Methodology (Mục 15) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-bold text-slate-900">
                Phát Hiện Mẫu, Quy Luật & Tính Ngày Ước Tính Sẽ Xổ
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống khai phá các chu kỳ lặp thực tế từ Đầu sang Cuối và tự động{' '}
              <strong className="text-slate-800 font-semibold">
                tính toán ngày ước tính sẽ xổ theo quy luật
              </strong>{' '}
              dựa trên lịch mở thưởng chính thức của 21 đài XSMN.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-800 rounded-lg text-xs font-semibold border border-rose-200">
              <CalendarDays className="w-4 h-4 text-rose-600" />
              <span>{upcomingCount} quy luật sắp đến kỳ xổ</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Chứng minh lịch sử 100%</span>
            </div>
          </div>
        </div>

        {/* 5 Phân loại thuật toán bắt buộc (Mục 15) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-3 text-xs">
          <div className="p-2 rounded bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-800 block">1. Trùng khớp thực tế</span>
            <span className="text-[11px] text-slate-500">Đối chiếu chính xác 100% 3 số</span>
          </div>
          <div className="p-2 rounded bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-800 block">2. Tương đồng một phần</span>
            <span className="text-[11px] text-slate-500">Đảo ngược / hoán vị / 2/3</span>
          </div>
          <div className="p-2 rounded bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-800 block">3. Mẫu lặp lại</span>
            <span className="text-[11px] text-slate-500">Lặp theo thứ hoặc chu kỳ k kỳ</span>
          </div>
          <div className="p-2 rounded bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-800 block">4. Quan hệ tần suất cao</span>
            <span className="text-[11px] text-slate-500">Xuất hiện từ 3 lần trở lên</span>
          </div>
          <div className="p-2 rounded bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-800 block">5. Tính ngày ước tính</span>
            <span className="text-[11px] text-slate-500">Lịch XSMN 21 đài chính xác</span>
          </div>
        </div>
      </div>

      {/* TÍNH NGÀY ƯỚC TÍNH SẼ XỔ THEO QUY LUẬT (Interactive Calculator) */}
      <PatternDateCalculator
        patterns={patterns}
        records={records}
        onSelectEstimatedDateFilter={handleSelectEstimatedDateFilter}
        onSelectStationFilter={handleSelectStationFilter}
      />

      {/* Scope Selector Tabs (Đầu ➔ Cuối vs 3 Số Cuối giữa các đài) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedScope('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            selectedScope === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Tất Cả Quy Luật ({patterns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedScope('TAIL_TO_TAIL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            selectedScope === 'TAIL_TO_TAIL'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Quy Luật 3 Số Cuối (Đuôi → Đuôi) ({tailPatternCount})</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded-full uppercase">
            Mới
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedScope('HEAD_TO_TAIL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            selectedScope === 'HEAD_TO_TAIL'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
          }`}
        >
          <span>Quy Luật Đầu → Cuối ({headPatternCount})</span>
        </button>
      </div>

      {/* Filter & Sorter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-rose-600" />
            <span>Bộ Lọc & Sắp Xếp Quy Luật Theo Ngày Ước Tính</span>
          </div>

          {(selectedCategory !== 'ALL' ||
            selectedConfidence !== 'ALL' ||
            selectedTiming !== 'ALL' ||
            selectedTargetDay !== 'ALL' ||
            dateSearchQuery ||
            stationSearchQuery) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Filter 1: Timing / Sắp đến ngày xổ */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Thời gian ước tính:
            </label>
            <select
              value={selectedTiming}
              onChange={e => setSelectedTiming(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
            >
              <option value="ALL">-- Tất cả thời gian --</option>
              <option value="TODAY_OR_TOMORROW">Hôm nay & Ngày mai (0-1 ngày)</option>
              <option value="UPCOMING_3">Sắp mở thưởng (1-3 ngày tới)</option>
              <option value="UPCOMING_7">Kỳ tới trong tuần (≤ 7 ngày)</option>
            </select>
          </div>

          {/* Filter 2: Thứ mở thưởng ước tính */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Thứ ước tính sẽ xổ:
            </label>
            <select
              value={selectedTargetDay}
              onChange={e => setSelectedTargetDay(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
            >
              <option value="ALL">-- Tất cả các Thứ --</option>
              <option value="Thứ 2">Thứ 2 (TP.HCM, Đồng Tháp, Cà Mau)</option>
              <option value="Thứ 3">Thứ 3 (Bến Tre, Vũng Tàu, Bạc Liêu)</option>
              <option value="Thứ 4">Thứ 4 (Đồng Nai, Cần Thơ, Sóc Trăng)</option>
              <option value="Thứ 5">Thứ 5 (Tây Ninh, An Giang, Bình Thuận)</option>
              <option value="Thứ 6">Thứ 6 (Vĩnh Long, Bình Dương, Trà Vinh)</option>
              <option value="Thứ 7">Thứ 7 (TP.HCM, Long An, Bình Phước, Hậu Giang)</option>
              <option value="Chủ nhật">Chủ nhật (Tiền Giang, Kiên Giang, Đà Lạt)</option>
            </select>
          </div>

          {/* Filter 3: Category */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Nhóm mẫu quy luật:
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL">-- Tất cả nhóm mẫu --</option>
              <optgroup label="Quy Luật 3 Số Cuối (Đuôi ➔ Đuôi)">
                <option value="QUY_LUAT_3_SO_CUOI">Tất Cả Quy Luật 3 Số Cuối</option>
                <option value="CHUYEN_CUOI_CUOI_LAP">3 Số Cuối Lặp Lại</option>
                <option value="CHU_KY_3_SO_CUOI">Chu Kỳ Cố Định 3 Số Cuối</option>
                <option value="THU_3_SO_CUOI">3 Số Cuối Theo Thứ</option>
                <option value="LAN_TOA_3_SO_CUOI">3 Số Cuối Lan Tỏa Nhiều Đài</option>
              </optgroup>
              <optgroup label="Quy Luật Đầu ➔ Cuối">
                <option value="CHUYEN_DAU_CUOI_LAP">Chuyển Đầu → Cuối Lặp Lại</option>
                <option value="CHU_KY_CO_DINH">Chu Kỳ Cố Định (k kỳ)</option>
                <option value="THU_TRONG_TUAN">Theo Thứ Trong Tuần</option>
                <option value="BO_SO_LAN_TOA">Bộ Số Lan Tỏa Nhiều Đài</option>
              </optgroup>
            </select>
          </div>

          {/* Filter 4: Search Date or Station */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">
              Tìm theo ngày / đài:
            </label>
            <input
              type="text"
              value={dateSearchQuery || stationSearchQuery}
              onChange={e => {
                const val = e.target.value;
                setDateSearchQuery(val);
                setStationSearchQuery(val);
              }}
              placeholder="VD: 23/09 hoặc Đồng Nai..."
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-slate-500" />
              <span>Sắp xếp hiển thị:</span>
            </label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="DATE_ASC">Ngày ước tính gần nhất (Sắp xổ trước)</option>
              <option value="REPEAT_DESC">Số lần lặp lại nhiều nhất</option>
              <option value="CYCLE_ASC">Khoảng cách chu kỳ ngắn nhất</option>
            </select>
          </div>
        </div>

        {/* Count notification */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Đang hiển thị <strong>{sortedPatterns.length}</strong> / {patterns.length} quy luật có tính ngày ước tính
          </span>
          {dateSearchQuery && (
            <span className="text-rose-600 font-medium">
              Đang lọc theo ngày: <strong>{dateSearchQuery}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Patterns Grid */}
      {sortedPatterns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-3">
          <p className="text-sm font-medium">
            {totalRecordsCount === 0
              ? 'Chưa có dữ liệu kết quả để phát hiện quy luật dịch chuyển.'
              : 'Không tìm thấy quy luật nào khớp với tiêu chí ngày ước tính đã lọc.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {onLoadSampleData && (
              <button
                type="button"
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Nạp Dữ Liệu Mẫu XSMN</span>
              </button>
            )}
            {onNavigateToData && (
              <button
                type="button"
                onClick={onNavigateToData}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg border border-slate-300 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-700" />
                <span>Nhập Dữ Liệu Mới</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <span>Xem tất cả quy luật</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedPatterns.map(pattern => {
            const cardBg =
              pattern.alertColor === 'red'
                ? 'border-rose-300 bg-rose-50/40'
                : pattern.alertColor === 'orange'
                ? 'border-amber-300 bg-amber-50/40'
                : 'border-slate-200 bg-white';

            const badgeColor =
              pattern.alertColor === 'red'
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : pattern.alertColor === 'orange'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-slate-100 text-slate-700 border-slate-300';

            const est = pattern.estimatedDrawDate;

            return (
              <div
                key={pattern.id}
                className={`border rounded-xl p-4.5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${cardBg}`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {pattern.categoryLabel}
                      </span>
                      {pattern.patternScope === 'TAIL_TO_TAIL' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          3 Số Cuối (Đuôi ➔ Đuôi)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Đầu ➔ Cuối
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}>
                      {pattern.confidenceLabel}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {pattern.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {pattern.description}
                  </p>

                  {/* NGÀY ƯỚC TÍNH SẼ XỔ THEO QUY LUẬT (Requirement Box) */}
                  {est ? (
                    <div className="my-3 p-3 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-xs">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-rose-400" />
                          <span>Ngày Ước Tính Sẽ Xổ Theo Quy Luật:</span>
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${est.timingBadgeColor}`}>
                          {est.timingLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <div className="text-base sm:text-lg font-black text-white tracking-tight">
                            {est.estimatedDayOfWeek}, {est.estimatedDateDisplay}
                          </div>
                          <div className="text-xs text-amber-300 font-medium mt-0.5">
                            Đài đích:{' '}
                            <strong className="text-white font-bold">{est.targetStation}</strong>{' '}
                            (Lịch XSMN:{' '}
                            <span className="text-slate-300">{est.scheduledDays.join(', ')}</span>)
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setDateSearchQuery(est.estimatedDateDisplay);
                          }}
                          className="text-[11px] text-rose-300 hover:text-white underline cursor-pointer"
                        >
                          Lọc ngày này
                        </button>
                      </div>

                      {/* Formula & derivation note */}
                      <p className="text-[11px] text-slate-300 mt-2 pt-2 border-t border-slate-800/80 leading-relaxed font-normal">
                        {est.formulaExplanation}
                      </p>
                    </div>
                  ) : (
                    <div className="my-3 p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Chưa xác định ngày mở thưởng cụ thể cho quy luật này.</span>
                    </div>
                  )}

                  {/* Key metadata chips */}
                  <div className="grid grid-cols-2 gap-2 my-2 text-xs bg-white/80 p-2.5 rounded-lg border border-slate-200/80">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Đài nguồn &rarr; Đài đích</span>
                      <strong className="text-slate-800">
                        {pattern.sourceStation} &rarr; {pattern.targetStation}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Số lần lặp lại</span>
                      <strong className="text-rose-600">{pattern.repeatCount} lần trong lịch sử</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Khoảng cách kỳ</span>
                      <strong className="text-slate-700">+{pattern.cycleDistance} kỳ</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Lần gần nhất</span>
                      <strong className="text-slate-700">{pattern.latestDate || '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* Bottom Evidence Action Button */}
                <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    Bằng chứng: <strong>{pattern.evidenceRecords.length}</strong> kỳ quay đối chiếu
                  </div>
                  <button
                    onClick={() =>
                      onViewDetails(
                        `Căn cứ quy luật: ${pattern.title}`,
                        `Danh sách các kỳ quay chứng minh quy luật này (Ngày ước tính sẽ xổ: ${
                          est ? `${est.estimatedDayOfWeek}, ${est.estimatedDateDisplay}` : 'Chưa xác định'
                        })`,
                        pattern.evidenceRecords
                      )
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>Xem căn cứ lịch sử</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
