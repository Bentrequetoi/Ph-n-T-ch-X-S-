import React, { useState, useMemo } from 'react';
import {
  LotteryRecord,
  DayOfWeek,
  DrawRelation,
  SameDayDrawGroup,
  DayOfWeekStatSummary
} from '../types';
import {
  XSMN_WEEKDAY_SCHEDULE,
  analyzeSameDayAndWeekdayRelations
} from '../utils/lotteryAnalysis';
import {
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Info,
  ChevronRight,
  Award,
  PlusCircle
} from 'lucide-react';
import { DetailModal } from './DetailModal';

interface SameDayAnalysisProps {
  records: LotteryRecord[];
  onLoadSampleData?: () => void;
  onNavigateToData?: () => void;
}

export const SameDayAnalysis: React.FC<SameDayAnalysisProps> = ({
  records,
  onLoadSampleData,
  onNavigateToData,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'ALL'>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<'draws' | 'pairs' | 'interweek' | 'tops'>('draws');
  const [selectedRelation, setSelectedRelation] = useState<DrawRelation | null>(null);
  const [onlyExactMatch, setOnlyExactMatch] = useState<boolean>(false);
  const [filterStation, setFilterStation] = useState<string>('ALL');

  // Compute all same-day and weekday statistics
  const analysisData = useMemo(() => {
    return analyzeSameDayAndWeekdayRelations(records);
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs space-y-4">
        <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-slate-200">
          <Calendar className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900">
          Chưa Có Dữ Liệu Đài Xổ Chung Thứ (Đang Trống)
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          Bảng thống kê các đài xổ chung thứ cần dữ liệu kết quả để phân tích tương quan 3 số đầu ➔ 3 số cuối giữa các đài trong cùng buổi chiều hoặc liên tuần.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onLoadSampleData && (
            <button
              type="button"
              onClick={onLoadSampleData}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Nạp Dữ Liệu Mẫu XSMN</span>
            </button>
          )}
          {onNavigateToData && (
            <button
              type="button"
              onClick={onNavigateToData}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl border border-slate-300 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-slate-700" />
              <span>Nhập Dữ Liệu Mới</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const daysList: DayOfWeek[] = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

  // Filter groups by selected day
  const filteredGroups = useMemo(() => {
    return analysisData.sameDayGroups.filter(g => {
      if (selectedDay !== 'ALL' && g.dayOfWeek !== selectedDay) return false;
      if (filterStation !== 'ALL') {
        const hasStation = g.records.some(r => r.station === filterStation);
        if (!hasStation) return false;
      }
      if (onlyExactMatch) {
        const hasExact = g.internalRelations.some(r => r.isExactMatch);
        if (!hasExact) return false;
      }
      return true;
    });
  }, [analysisData.sameDayGroups, selectedDay, filterStation, onlyExactMatch]);

  // Filter inter-week relations
  const filteredInterWeek = useMemo(() => {
    return analysisData.interWeekRelations.filter(r => {
      if (selectedDay !== 'ALL' && r.sourceDayOfWeek !== selectedDay) return false;
      if (onlyExactMatch && !r.isExactMatch) return false;
      if (filterStation !== 'ALL' && r.sourceStation !== filterStation && r.targetStation !== filterStation) return false;
      return true;
    });
  }, [analysisData.interWeekRelations, selectedDay, onlyExactMatch, filterStation]);

  // Active weekday summary stats
  const activeSummary = useMemo(() => {
    if (selectedDay === 'ALL') {
      // Aggregate all
      const totalDrawDays = analysisData.sameDayGroups.length;
      const totalRecords = records.length;
      const sameDayMatches = analysisData.allSameDayRelations.length;
      const sameDayExact = analysisData.allSameDayRelations.filter(r => r.isExactMatch).length;
      const interWeekMatches = analysisData.interWeekRelations.length;
      const interWeekExact = analysisData.interWeekRelations.filter(r => r.isExactMatch).length;

      return {
        dayOfWeek: 'Tất cả các thứ',
        scheduledStations: ['Tất cả 21 đài XSMN'],
        actualStations: Array.from(new Set(records.map(r => r.station))),
        totalDrawDays,
        totalRecords,
        sameDayMatchesCount: sameDayMatches,
        sameDayExactCount: sameDayExact,
        interWeekMatchesCount: interWeekMatches,
        interWeekExactCount: interWeekExact,
        topPairs: [],
        topHeads: [],
        topTails: [],
      };
    }

    return (
      analysisData.weekdaySummaries.find(s => s.dayOfWeek === selectedDay) || {
        dayOfWeek: selectedDay,
        scheduledStations: XSMN_WEEKDAY_SCHEDULE[selectedDay] || [],
        actualStations: [],
        totalDrawDays: 0,
        totalRecords: 0,
        sameDayMatchesCount: 0,
        sameDayExactCount: 0,
        interWeekMatchesCount: 0,
        interWeekExactCount: 0,
        topPairs: [],
        topHeads: [],
        topTails: [],
      }
    );
  }, [analysisData, selectedDay, records]);

  // Stations for filter dropdown
  const availableStations = useMemo(() => {
    if (selectedDay === 'ALL') {
      return Array.from(new Set(records.map(r => r.station))).sort();
    }
    const scheduled = XSMN_WEEKDAY_SCHEDULE[selectedDay] || [];
    const fromRecords = Array.from(
      new Set(records.filter(r => r.dayOfWeek === selectedDay).map(r => r.station))
    );
    return Array.from(new Set([...scheduled, ...fromRecords])).sort();
  }, [records, selectedDay]);

  if (records.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <Calendar className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            Bảng Thống Kê Đài Xổ Chung Thứ Đang Trống
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed mb-6">
            Hiện chưa có dữ liệu kết quả xổ số nào trong hệ thống. Vui lòng nhập dữ liệu hoặc nạp bộ mẫu XSMN để xem phân tích các đài mở thưởng cùng ngày và liên tuần cùng thứ.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onLoadSampleData && (
              <button
                type="button"
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp Dữ Liệu Mẫu XSMN</span>
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
        </div>
      </div>
    );
  }

  return (
    <div id="same-day-analysis-container" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Thống Kê Các Đài Xổ Chung Thứ (Miền Nam)
              </h2>
              <p className="text-xs text-slate-500">
                Phân tích chuyên sâu mối quan hệ 3 số đầu ➔ 3 số cuối giữa các đài mở thưởng cùng một buổi chiều (16h15) hoặc giữa các tuần cùng thứ.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {analysisData.sameDayGroups.length} ngày quay
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {analysisData.allSameDayRelations.length} quan hệ cùng ngày
            </span>
          </div>
        </div>

        {/* Weekday Selector Tabs */}
        <div className="pt-3">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Chọn Thứ trong tuần để xem bảng thống kê riêng:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <button
              onClick={() => {
                setSelectedDay('ALL');
                setFilterStation('ALL');
              }}
              className={`p-2 rounded-lg border text-left transition-all ${
                selectedDay === 'ALL'
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold">Tất Cả Các Thứ</div>
              <div className={`text-[10px] truncate ${selectedDay === 'ALL' ? 'text-red-100' : 'text-slate-500'}`}>
                Toàn bộ lịch sử
              </div>
            </button>

            {daysList.map(dow => {
              const summary = analysisData.weekdaySummaries.find(s => s.dayOfWeek === dow);
              const sched = XSMN_WEEKDAY_SCHEDULE[dow] || [];
              const isSelected = selectedDay === dow;
              const sameDayCount = summary?.sameDayMatchesCount || 0;

              return (
                <button
                  key={dow}
                  onClick={() => {
                    setSelectedDay(dow);
                    setFilterStation('ALL');
                  }}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{dow}</span>
                    {sameDayCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected ? 'bg-white text-red-700' : 'bg-red-100 text-red-800'
                        }`}
                        title={`${sameDayCount} quan hệ cùng ngày`}
                      >
                        {sameDayCount}
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-[10px] truncate mt-0.5 ${
                      isSelected ? 'text-red-100' : 'text-slate-500'
                    }`}
                    title={sched.join(', ')}
                  >
                    {sched.slice(0, 2).join(', ')}...
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Kỳ / Ngày Quay</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{activeSummary.totalDrawDays}</span>
            <span className="text-xs text-slate-500">ngày ({activeSummary.totalRecords} bản ghi)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Đài chuẩn: {activeSummary.scheduledStations.join(', ')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Quan Hệ CÙNG NGÀY (Cùng Thứ)</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{activeSummary.sameDayMatchesCount}</span>
            <span className="text-xs text-emerald-600 font-semibold">
              ({activeSummary.sameDayExactCount} trùng 100%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Đầu đài này ➔ Cuối đài kia trong cùng buổi chiều
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Quan Hệ LIÊN TUẦN Cùng Thứ</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700">{activeSummary.interWeekMatchesCount}</span>
            <span className="text-xs text-purple-600 font-semibold">
              ({activeSummary.interWeekExactCount} trùng 100%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Tuần N ➔ Tuần N+1, N+2, N+3 cùng thứ
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Đài Xổ Trong Thứ Này</span>
            <Layers className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-800 line-clamp-1">
            {activeSummary.scheduledStations.join(', ')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Thực tế có dữ liệu: {activeSummary.actualStations.length} đài
          </p>
        </div>
      </div>

      {/* Filter & Subtab Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveSubTab('draws')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'draws'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Bảng Đối Chiếu Theo Ngày Quay ({filteredGroups.length})
          </button>

          <button
            onClick={() => setActiveSubTab('pairs')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'pairs'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tần Suất Cặp Đài Cùng Thứ
          </button>

          <button
            onClick={() => setActiveSubTab('interweek')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'interweek'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Liên Tuần Cùng Thứ ({filteredInterWeek.length})
          </button>

          <button
            onClick={() => setActiveSubTab('tops')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSubTab === 'tops'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Top Bộ Số Đầu & Cuối
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStation}
              onChange={e => setFilterStation(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="ALL">-- Tất cả các đài --</option>
              {availableStations.map(st => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
            <input
              type="checkbox"
              checked={onlyExactMatch}
              onChange={e => setOnlyExactMatch(e.target.checked)}
              className="w-3.5 h-3.5 text-red-600 rounded cursor-pointer"
            />
            <span className="font-semibold text-[11px]">Chỉ xem trùng 100% (ĐỎ)</span>
          </label>
        </div>
      </div>

      {/* SUBTAB 1: DRAWS LIST */}
      {activeSubTab === 'draws' && (
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              Không có kỳ quay nào phù hợp với bộ lọc.
            </div>
          ) : (
            filteredGroups.map(group => {
              const matches = group.internalRelations;
              const hasExact = matches.some(m => m.isExactMatch);

              return (
                <div
                  key={group.date}
                  className={`bg-white border rounded-xl overflow-hidden shadow-xs transition-all ${
                    hasExact ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
                  }`}
                >
                  {/* Date Header */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{group.dateDisplay}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                        {group.dayOfWeek}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({group.records.length} đài cùng xổ vào 16h15)
                      </span>
                    </div>

                    {matches.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          {matches.length} quan hệ Đầu ➔ Cuối nội bộ
                        </span>
                        {hasExact && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white animate-pulse">
                            CÓ TRÙNG 100%
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        Không phát hiện trùng khớp nội bộ
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Stations Results Cards in this day */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.records.map(rec => (
                        <div
                          key={rec.id}
                          className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-2 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{rec.station}</span>
                            <span className="text-[10px] font-mono text-slate-400">#{rec.sessionIndex}</span>
                          </div>

                          <div className="text-center py-1">
                            <span className="font-mono text-base font-black tracking-wider text-slate-900">
                              {rec.rawNumber}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center text-xs">
                            <div className="bg-blue-50 border border-blue-200 rounded py-1 px-1.5">
                              <div className="text-[10px] font-medium text-blue-700">3 số đầu</div>
                              <div className="font-mono font-bold text-blue-900 text-sm">{rec.head3}</div>
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded py-1 px-1.5">
                              <div className="text-[10px] font-medium text-purple-700">3 số cuối</div>
                              <div className="font-mono font-bold text-purple-900 text-sm">{rec.tail3}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Internal Relations List for this day */}
                    {matches.length > 0 && (
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Quan hệ Đầu ➔ Cuối được phát hiện giữa các đài trong buổi quay này:</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {matches.map(m => (
                            <div
                              key={m.id}
                              onClick={() => setSelectedRelation(m)}
                              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer hover:shadow-xs transition-all ${
                                m.isExactMatch
                                  ? 'bg-red-50 border-red-200 text-red-900 hover:bg-red-100'
                                  : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 font-mono font-bold">
                                  <span className="text-blue-700 font-semibold">{m.sourceStation}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 text-xs">
                                    {m.sourceHead3}
                                  </span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <div className="flex items-center gap-1 font-mono font-bold">
                                  <span className="text-purple-700 font-semibold">{m.targetStation}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-purple-200 text-purple-900 text-xs">
                                    {m.targetTail3}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    m.isExactMatch ? 'bg-red-600 text-white' : 'bg-amber-200 text-amber-900'
                                  }`}
                                >
                                  {m.relationTypeLabel}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUBTAB 2: STATION PAIRS RANKING */}
      {activeSubTab === 'pairs' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Bảng Xếp Hạng Các Cặp Đài Cùng Thứ Hay Có Quan Hệ Đầu ➔ Cuối Nhất
            </h3>
            <p className="text-xs text-slate-500">
              Thống kê tần suất chuyển dịch số giữa các cặp đài xổ cùng ngày hoặc liên tuần.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSummary.topPairs.length === 0 ? (
              <div className="col-span-full p-6 text-center text-slate-400 text-xs">
                Chưa có dữ liệu cặp đài trùng khớp cho thứ này.
              </div>
            ) : (
              activeSummary.topPairs.map((p, idx) => (
                <div
                  key={`${p.sourceStation}-${p.targetStation}`}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Hạng #{idx + 1}</span>
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
                      {p.count} lần lặp
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-bold text-sm text-slate-900 pt-1">
                    <span className="text-blue-700">{p.sourceStation} (Đầu)</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <span className="text-purple-700">{p.targetStation} (Cuối)</span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>Trùng chính xác 100%:</span>
                    <span className="font-bold text-red-600">{p.exactCount} lần</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: INTERWEEK LIST */}
      {activeSubTab === 'interweek' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Bảng Quan Hệ Liên Tuần Cùng Thứ (Cách 1 ➔ 4 Tuần)
            </h3>
            <p className="text-xs text-slate-500">
              3 số đầu của đài này vào Thứ X lặp lại vào 3 số cuối của đài kia ở các tuần tiếp theo.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Tuần Nguồn (Đầu)</th>
                  <th className="p-2.5">Đài Nguồn</th>
                  <th className="p-2.5 text-center">3 số đầu</th>
                  <th className="p-2.5 text-center">Khoảng cách tuần</th>
                  <th className="p-2.5">Tuần Đích (Cuối)</th>
                  <th className="p-2.5">Đài Đích</th>
                  <th className="p-2.5 text-center">3 số cuối</th>
                  <th className="p-2.5 text-center">Loại Quan Hệ</th>
                  <th className="p-2.5 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInterWeek.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400">
                      Không có bản ghi liên tuần nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredInterWeek.map(r => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRelation(r)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        r.isExactMatch ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="p-2.5 font-medium text-slate-900">
                        {r.sourceRecord.dateDisplay} ({r.sourceDayOfWeek})
                      </td>
                      <td className="p-2.5 font-bold text-blue-700">{r.sourceStation}</td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                          {r.sourceHead3}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          +{r.cycleDistance} tuần ({r.dayDistance} ngày)
                        </span>
                      </td>
                      <td className="p-2.5 font-medium text-slate-900">
                        {r.targetRecord.dateDisplay} ({r.targetDayOfWeek})
                      </td>
                      <td className="p-2.5 font-bold text-purple-700">{r.targetStation}</td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono font-bold">
                          {r.targetTail3}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.isExactMatch ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.relationTypeLabel}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button className="text-blue-600 hover:text-blue-800 font-semibold text-xs">
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: TOP NUMBERS */}
      {activeSubTab === 'tops' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              Top 3 Số Đầu Xuất Hiện Nhiều Nhất ({activeSummary.dayOfWeek})
            </h3>
            <div className="divide-y divide-slate-100">
              {activeSummary.topHeads.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">Chưa có dữ liệu.</div>
              ) : (
                activeSummary.topHeads.map(item => (
                  <div key={item.number} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                        {item.number}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        xuất hiện ở: {item.stations.join(', ')}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {item.count} lần
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              Top 3 Số Cuối Xuất Hiện Nhiều Nhất ({activeSummary.dayOfWeek})
            </h3>
            <div className="divide-y divide-slate-100">
              {activeSummary.topTails.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">Chưa có dữ liệu.</div>
              ) : (
                activeSummary.topTails.map(item => (
                  <div key={item.number} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900">
                        {item.number}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        xuất hiện ở: {item.stations.join(', ')}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {item.count} lần
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Relation Detail Modal */}
      {selectedRelation && (
        <DetailModal
          isOpen={!!selectedRelation}
          onClose={() => setSelectedRelation(null)}
          title={`Chi Tiết Đối Chiếu: ${selectedRelation.sourceStation} ➔ ${selectedRelation.targetStation}`}
          subtitle={selectedRelation.matchDescription}
          relations={[selectedRelation]}
        />
      )}
    </div>
  );
};
