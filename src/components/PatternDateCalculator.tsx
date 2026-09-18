import React, { useState, useMemo } from 'react';
import { DayOfWeek, HistoricPattern, LotteryRecord } from '../types';
import {
  ALL_XSMN_STATIONS,
  getScheduledDaysForStation,
  calculateNextScheduledDateForStation
} from '../utils/lotteryAnalysis';
import { parseDateString, getDayDifference } from '../utils/dateUtils';
import {
  Calendar,
  Clock,
  Calculator,
  ArrowRight,
  Sparkles,
  Info,
  CalendarDays,
  ChevronRight,
  Filter,
  RotateCcw
} from 'lucide-react';

interface PatternDateCalculatorProps {
  patterns: HistoricPattern[];
  records: LotteryRecord[];
  onSelectEstimatedDateFilter?: (targetDateDisplay: string) => void;
  onSelectStationFilter?: (station: string) => void;
}

export const PatternDateCalculator: React.FC<PatternDateCalculatorProps> = ({
  patterns,
  records,
  onSelectEstimatedDateFilter,
  onSelectStationFilter,
}) => {
  // Find default source station from latest record
  const latestRecord = records.length > 0 ? records[records.length - 1] : null;
  const initialSourceStation = latestRecord?.station || 'TP.HCM';
  const initialDateDisplay = latestRecord?.dateDisplay || '';
  const initialDateIso = latestRecord?.date || new Date().toISOString().split('T')[0];

  const [selectedPatternId, setSelectedPatternId] = useState<string>('');
  const [sourceStation, setSourceStation] = useState<string>(initialSourceStation);
  const [targetStation, setTargetStation] = useState<string>('Đồng Nai');
  const [baseDateInput, setBaseDateInput] = useState<string>(initialDateDisplay);
  const [cycleDistance, setCycleDistance] = useState<number>(1);
  const [targetDayOverride, setTargetDayOverride] = useState<string>('AUTO');
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // If a pattern is selected, populate stations and cycle
  const handleSelectPattern = (patternId: string) => {
    setSelectedPatternId(patternId);
    if (!patternId) return;

    const pat = patterns.find(p => p.id === patternId);
    if (pat) {
      setSourceStation(pat.sourceStation);
      setTargetStation(pat.targetStation);
      const cycleNum = typeof pat.cycleDistance === 'number' ? pat.cycleDistance : 1;
      setCycleDistance(cycleNum);

      // Set base date from pattern's latest occurrence or station's latest record
      const srcRecs = records.filter(r => r.station.toLowerCase() === pat.sourceStation.toLowerCase());
      if (srcRecs.length > 0) {
        const lastRec = srcRecs[srcRecs.length - 1];
        setBaseDateInput(lastRec.dateDisplay);
      } else if (pat.latestDate) {
        const parsed = parseDateString(pat.latestDate);
        if (parsed.valid) setBaseDateInput(parsed.display);
      }

      if (pat.category === 'THU_TRONG_TUAN' && pat.evidenceRecords.length > 0) {
        setTargetDayOverride(pat.evidenceRecords[0].targetDayOfWeek);
      } else {
        setTargetDayOverride('AUTO');
      }
    }
  };

  // Reset to default
  const handleReset = () => {
    setSelectedPatternId('');
    setSourceStation(initialSourceStation);
    setTargetStation('Đồng Nai');
    setBaseDateInput(initialDateDisplay);
    setCycleDistance(1);
    setTargetDayOverride('AUTO');
  };

  // Compute estimated draw date
  const calculationResult = useMemo(() => {
    // Parse base date
    let baseDateIso = initialDateIso;
    let baseDateDisplay = initialDateDisplay;
    let baseDayOfWeek: DayOfWeek = latestRecord?.dayOfWeek || 'Thứ 2';

    if (baseDateInput.trim()) {
      const parsed = parseDateString(baseDateInput.trim());
      if (parsed.valid) {
        baseDateIso = parsed.iso;
        baseDateDisplay = parsed.display;
        baseDayOfWeek = parsed.dayOfWeek;
      }
    }

    const scheduledDays = getScheduledDaysForStation(targetStation);
    if (scheduledDays.length === 0) {
      return {
        success: false,
        error: `Đài ${targetStation} chưa được cấu hình trong lịch mở thưởng XSMN.`,
      };
    }

    const targetDow = targetDayOverride !== 'AUTO' ? (targetDayOverride as DayOfWeek) : undefined;
    const nextScheduled = calculateNextScheduledDateForStation(
      targetStation,
      baseDateIso,
      cycleDistance,
      targetDow
    );

    if (!nextScheduled) {
      return {
        success: false,
        error: `Không tìm thấy ngày quay phù hợp cho đài ${targetStation} theo chu kỳ +${cycleDistance} kỳ.`,
      };
    }

    const maxDatasetDate = records.length > 0 ? records[records.length - 1].date : baseDateIso;
    const daysRemaining = getDayDifference(maxDatasetDate, nextScheduled.dateIso);

    let timingLabel = '';
    let timingBadgeColor = '';

    if (daysRemaining === 0) {
      timingLabel = 'Hôm nay (Cùng ngày)';
      timingBadgeColor = 'bg-rose-500 text-white font-bold';
    } else if (daysRemaining === 1) {
      timingLabel = 'Ngày mai (+1 ngày)';
      timingBadgeColor = 'bg-amber-500 text-slate-950 font-bold';
    } else if (daysRemaining > 1 && daysRemaining <= 3) {
      timingLabel = `Sắp mở thưởng (còn ${daysRemaining} ngày)`;
      timingBadgeColor = 'bg-emerald-600 text-white font-bold';
    } else if (daysRemaining > 3 && daysRemaining <= 7) {
      timingLabel = `Kỳ tới (còn ${daysRemaining} ngày)`;
      timingBadgeColor = 'bg-teal-600 text-white font-medium';
    } else if (daysRemaining > 7) {
      timingLabel = `Sau ${Math.ceil(daysRemaining / 7)} tuần (${daysRemaining} ngày)`;
      timingBadgeColor = 'bg-blue-600 text-white font-medium';
    } else {
      timingLabel = `Đã qua ${Math.abs(daysRemaining)} ngày`;
      timingBadgeColor = 'bg-slate-500 text-white font-medium';
    }

    // Related patterns matching this pair
    const matchingPatterns = patterns.filter(
      p =>
        p.sourceStation.toLowerCase() === sourceStation.toLowerCase() &&
        p.targetStation.toLowerCase() === targetStation.toLowerCase()
    );

    return {
      success: true,
      baseDateIso,
      baseDateDisplay,
      baseDayOfWeek,
      targetStation,
      scheduledDays,
      estimatedDateIso: nextScheduled.dateIso,
      estimatedDateDisplay: nextScheduled.dateDisplay,
      estimatedDayOfWeek: nextScheduled.dayOfWeek,
      daysRemaining,
      timingLabel,
      timingBadgeColor,
      matchingPatterns,
      isUpcoming: daysRemaining >= 0,
    };
  }, [
    baseDateInput,
    sourceStation,
    targetStation,
    cycleDistance,
    targetDayOverride,
    records,
    patterns,
    initialDateIso,
    initialDateDisplay,
    latestRecord,
  ]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-600 rounded-lg text-white">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Bộ Tính Ngày Ước Tính Sẽ Xổ Theo Quy Luật</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider bg-rose-700/80 text-rose-100 px-1.5 py-0.5 rounded">
                Lịch XSMN 21 Đài
              </span>
            </h4>
            <p className="text-[11px] text-slate-300">
              Nhập đài nguồn, ngày xổ căn cứ và chu kỳ lặp để tính chính xác ngày đài đích sẽ mở thưởng.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer"
            title="Đặt lại mặc định"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Đặt lại</span>
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md border border-slate-700 cursor-pointer"
          >
            {isOpen ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Preset Pattern Selector (If patterns exist) */}
          {patterns.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  <span>Chọn nhanh một quy luật đã phát hiện để nạp thông số:</span>
                </label>
                <select
                  value={selectedPatternId}
                  onChange={e => handleSelectPattern(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none max-w-full sm:max-w-md"
                >
                  <option value="">-- Tự chọn thủ công các đài & chu kỳ --</option>
                  {patterns.slice(0, 30).map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.patternScope === 'TAIL_TO_TAIL' ? '3 Số Cuối' : 'Đầu ➔ Cuối'}] [{p.categoryLabel}] {p.sourceStation} → {p.targetStation} (+{p.cycleDistance} kỳ, lặp {p.repeatCount} lần)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Interactive Form Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Source Station */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                1. Đài nguồn xuất phát:
              </label>
              <select
                value={sourceStation}
                onChange={e => {
                  setSourceStation(e.target.value);
                  setSelectedPatternId('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none"
              >
                {ALL_XSMN_STATIONS.map(s => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.days.join(', ')})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Target Station */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                2. Đài đích theo dõi (XSMN):
              </label>
              <select
                value={targetStation}
                onChange={e => {
                  setTargetStation(e.target.value);
                  setSelectedPatternId('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none"
              >
                {ALL_XSMN_STATIONS.map(s => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.days.join(', ')})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Base Date */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                3. Ngày xổ căn cứ (DD/MM/YYYY):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={baseDateInput}
                  onChange={e => setBaseDateInput(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none"
                />
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              </div>
            </div>

            {/* 4. Cycle Distance / Weekday */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                4. Chu kỳ lặp theo quy luật:
              </label>
              <select
                value={cycleDistance}
                onChange={e => setCycleDistance(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none"
              >
                <option value={0}>0 kỳ (Cùng ngày / Cùng buổi)</option>
                <option value={1}>+1 kỳ tiếp theo (Kỳ liền kề)</option>
                <option value={2}>+2 kỳ tiếp theo (Cách 1 kỳ)</option>
                <option value={3}>+3 kỳ tiếp theo</option>
                <option value={4}>+4 kỳ tiếp theo</option>
              </select>
            </div>
          </div>

          {/* Target Day Override (Optional) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-500 font-medium">Lọc theo thứ cụ thể của đài đích:</span>
            <div className="flex flex-wrap gap-1.5">
              {['AUTO', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map(dow => (
                <button
                  key={dow}
                  type="button"
                  onClick={() => setTargetDayOverride(dow)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    targetDayOverride === dow
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {dow === 'AUTO' ? 'Tự động (Theo lịch đài)' : dow}
                </button>
              ))}
            </div>
          </div>

          {/* CALCULATION RESULT DISPLAY BOX */}
          {calculationResult.success ? (
            <div className="bg-linear-to-br from-slate-900 to-slate-950 text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Main Estimated Date Badge */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1">
                      <CalendarDays className="w-4 h-4 text-rose-400" />
                      Ngày Ước Tính Sẽ Xổ Theo Quy Luật:
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${calculationResult.timingBadgeColor}`}>
                      {calculationResult.timingLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-3">
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {calculationResult.estimatedDayOfWeek}, {calculationResult.estimatedDateDisplay}
                    </h3>
                    <div className="px-3 py-1 bg-white/10 rounded-lg text-sm font-semibold text-amber-300 border border-white/10">
                      Đài: {calculationResult.targetStation}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">
                    Lịch mở thưởng chính thức đài {calculationResult.targetStation}:{' '}
                    <strong className="text-white">{calculationResult.scheduledDays?.join(', ')}</strong> hàng tuần.
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  {onSelectEstimatedDateFilter && calculationResult.estimatedDateDisplay && (
                    <button
                      type="button"
                      onClick={() => onSelectEstimatedDateFilter(calculationResult.estimatedDateDisplay!)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Lọc quy luật theo ngày này ({calculationResult.estimatedDateDisplay})</span>
                    </button>
                  )}
                  {onSelectStationFilter && (
                    <button
                      type="button"
                      onClick={() => onSelectStationFilter(calculationResult.targetStation!)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      <span>Lọc đài {calculationResult.targetStation}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Step-by-Step Calculation Formula Breakdown */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <span className="text-[11px] text-slate-400 block font-medium">Bước 1: Kỳ quay căn cứ nguồn</span>
                  <strong className="text-white text-sm">
                    {sourceStation} ({calculationResult.baseDayOfWeek}, {calculationResult.baseDateDisplay})
                  </strong>
                </div>

                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <span className="text-[11px] text-slate-400 block font-medium">Bước 2: Chu kỳ dịch chuyển</span>
                  <strong className="text-amber-300 text-sm">
                    +{cycleDistance} kỳ quay của {calculationResult.targetStation}
                  </strong>
                </div>

                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <span className="text-[11px] text-slate-400 block font-medium">Bước 3: Kết quả ước tính</span>
                  <strong className="text-emerald-400 text-sm">
                    {calculationResult.estimatedDayOfWeek}, {calculationResult.estimatedDateDisplay}
                  </strong>
                </div>
              </div>

              {/* Related matching patterns info */}
              {calculationResult.matchingPatterns && calculationResult.matchingPatterns.length > 0 && (
                <div className="mt-3 text-xs bg-rose-950/40 border border-rose-800/50 rounded-lg p-2.5 text-rose-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      Đã ghi nhận <strong>{calculationResult.matchingPatterns.length}</strong> quy luật lịch sử đã được chứng minh giữa cặp đài {sourceStation} ➔ {calculationResult.targetStation}.
                    </span>
                  </div>
                  <span className="text-[11px] text-rose-300 font-semibold underline shrink-0">
                    Xem bên dưới ↓
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{calculationResult.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
