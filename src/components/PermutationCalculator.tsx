import React, { useState, useMemo } from 'react';
import { DrawRelation, PatternPredictionLead, DayOfWeek } from '../types';
import {
  calculateHeadPermutationsWithRules,
  HeadPermutationCalculationResult,
  getScheduledDaysForStation,
} from '../utils/lotteryAnalysis';
import { WEEKDAY_THEMES } from './PatternPrediction';
import {
  Calculator,
  Shuffle,
  Sparkles,
  ArrowRight,
  FileCheck2,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  RefreshCw,
  Zap,
  Info,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface PermutationCalculatorProps {
  relations: DrawRelation[];
  leads: PatternPredictionLead[];
  uniqueStations: string[];
  onViewDetails: (title: string, subtitle: string, rels: DrawRelation[]) => void;
  onApplyNumberFilter?: (queryNumber: string) => void;
  onFilterLeadByPair?: (sourceStation: string, targetStation: string) => void;
}

export const PermutationCalculator: React.FC<PermutationCalculatorProps> = ({
  relations,
  leads,
  uniqueStations,
  onViewDetails,
  onApplyNumberFilter,
  onFilterLeadByPair,
}) => {
  // Input states
  const [headInput, setHeadInput] = useState<string>('');
  const [selectedSourceStation, setSelectedSourceStation] = useState<string>('ALL');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Extract recent head numbers from latest leads for quick-pick
  const recentQuickPicks = useMemo(() => {
    const map = new Map<string, { head3: string; station: string; dayOfWeek: DayOfWeek; date: string }>();
    leads.forEach(l => {
      const key = `${l.latestRecord.station}-${l.latestRecord.head3}`;
      if (!map.has(key)) {
        map.set(key, {
          head3: l.latestRecord.head3,
          station: l.latestRecord.station,
          dayOfWeek: l.latestRecord.dayOfWeek,
          date: l.latestRecord.dateDisplay,
        });
      }
    });
    return Array.from(map.values()).slice(0, 8);
  }, [leads]);

  // Set default initial head number if input is empty and leads exist
  const effectiveHeadInput = headInput.trim() || (recentQuickPicks[0] ? recentQuickPicks[0].head3 : '456');

  // Perform calculation
  const calculationResult: HeadPermutationCalculationResult = useMemo(() => {
    return calculateHeadPermutationsWithRules(effectiveHeadInput, selectedSourceStation, relations);
  }, [effectiveHeadInput, selectedSourceStation, relations]);

  const handleCopy = (num: string) => {
    navigator.clipboard?.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 1500);
  };

  const handleQuickPick = (item: { head3: string; station: string }) => {
    setHeadInput(item.head3);
    setSelectedSourceStation(item.station);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-6 text-white shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/80">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                BỘ TÍNH TOÁN HOÁN VỊ ĐẦU SỐ THEO QUY LUẬT LỊCH SỬ
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                Tra Cứu & Dự Phóng
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Nhập bất kỳ 3 số đầu (hoặc chọn từ kỳ vừa xổ) để tính toàn bộ tổ hợp hoán vị và đối chiếu các quy luật, đài đích lặp lại trong lịch sử.
            </p>
          </div>
        </div>

        {calculationResult.totalPermutationHits > 0 && (
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-2 self-start sm:self-auto text-xs font-bold">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Tìm thấy {calculationResult.totalPermutationHits} tiền lệ trong lịch sử</span>
          </div>
        )}
      </div>

      {/* Input Form & Quick Pick Chips */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Input box */}
        <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shuffle className="w-4 h-4 text-amber-400" />
              <span>1. Nhập 3 Số Đầu Cần Tính</span>
            </label>
            {headInput && (
              <button
                type="button"
                onClick={() => setHeadInput('')}
                className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Xóa nhập
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={3}
                value={headInput}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setHeadInput(val);
                }}
                placeholder={effectiveHeadInput}
                className="w-full bg-slate-950 border-2 border-amber-500/60 focus:border-amber-400 text-amber-300 rounded-xl px-4 py-3 text-2xl font-mono font-black text-center tracking-widest placeholder:text-slate-600 focus:outline-none shadow-inner"
              />
              <span className="absolute right-3 top-3.5 text-[10px] text-slate-500 font-mono">
                {headInput.length}/3 số
              </span>
            </div>

            {onApplyNumberFilter && (
              <button
                type="button"
                onClick={() => onApplyNumberFilter(effectiveHeadInput)}
                className="px-3 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex flex-col items-center justify-center transition-colors cursor-pointer shadow-md shrink-0"
                title="Lọc danh sách dự đoán bên dưới theo số này"
              >
                <Search className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">Lọc Bảng</span>
              </button>
            )}
          </div>

          {/* Source station selector */}
          <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
            <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
              <span>Đài xuất phát (vừa ra đầu số này):</span>
              <span className="text-[10px] text-slate-400">
                {selectedSourceStation === 'ALL' ? 'Tất cả 21 đài' : `Đài ${selectedSourceStation}`}
              </span>
            </label>
            <select
              value={selectedSourceStation}
              onChange={e => setSelectedSourceStation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL">-- Đối chiếu tất cả các đài --</option>
              {uniqueStations.map(st => (
                <option key={`opt-src-${st}`} value={st}>
                  Đài {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Quick pick from recent draw results */}
        <div className="lg:col-span-7 bg-slate-800/50 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1.5 border-b border-slate-700/60">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>2. Chọn Nhanh Đầu Số Vừa Mở Thưởng Gần Đây</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Bấm để tự động điền & tính toán
              </span>
            </div>

            {recentQuickPicks.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Chưa có dữ liệu đầu số từ các kỳ mở thưởng gần nhất. Hãy nạp dữ liệu kết quả để chọn nhanh.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5">
                {recentQuickPicks.map((pick, pIdx) => {
                  const isSelected = effectiveHeadInput === pick.head3 && selectedSourceStation === pick.station;
                  const theme = WEEKDAY_THEMES[pick.dayOfWeek] || WEEKDAY_THEMES['Thứ 2'];

                  return (
                    <button
                      key={`quick-pick-${pIdx}`}
                      type="button"
                      onClick={() => handleQuickPick(pick)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-bold'
                          : 'bg-slate-900 border-slate-700 text-white hover:border-amber-400/60 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-sm font-black tracking-wider ${isSelected ? 'text-slate-950' : 'text-amber-300'}`}>
                          [{pick.head3}]
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${isSelected ? 'bg-slate-950/20 text-slate-950' : `${theme.badgeBg} ${theme.badgeText}`}`}>
                          {pick.dayOfWeek}
                        </span>
                      </div>
                      <div className="text-[10px] truncate mt-1 opacity-90">
                        {pick.station}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>
              Đang tính cho đầu số: <strong className="text-amber-300 font-mono text-xs">[{effectiveHeadInput}]</strong>
            </span>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-500">Mẫu gợi ý:</span>
              <button
                type="button"
                onClick={() => setHeadInput('123')}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-700 text-slate-300 font-mono"
              >
                123
              </button>
              <button
                type="button"
                onClick={() => setHeadInput('456')}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-700 text-slate-300 font-mono"
              >
                456
              </button>
              <button
                type="button"
                onClick={() => setHeadInput('789')}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-700 text-slate-300 font-mono"
              >
                789
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TỔNG HỢP CÁC BIẾN THỂ HOÁN VỊ VÀ ĐỐI CHIẾU TIỀN LỆ LỊCH SỬ */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Các Biến Thể Hoán Vị Của Đầu Số [{effectiveHeadInput}] ({calculationResult.allPermutations.length} hoán vị)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            {calculationResult.totalPermutationHits > 0
              ? `Từng xuất hiện ${calculationResult.totalPermutationHits} lần làm đuôi trong lịch sử`
              : 'Chưa có tiền lệ trực tiếp làm đuôi ở các kỳ đã nạp'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {calculationResult.variants.map((v, vIdx) => {
            const isOriginal = v.variantType === 'ORIGINAL';
            const isReversed = v.variantType === 'REVERSED';
            const hasHits = v.totalHits > 0;

            const badgeColor = isOriginal
              ? 'bg-rose-500 text-white'
              : isReversed
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'bg-blue-600 text-white';

            return (
              <div
                key={`var-${v.permutation}-${vIdx}`}
                className={`border rounded-xl p-3.5 transition-all flex flex-col justify-between ${
                  hasHits
                    ? 'bg-slate-800/90 border-amber-400/70 shadow-md ring-1 ring-amber-400/30'
                    : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Permutation Number + Type Badge */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-mono font-black text-amber-300 tracking-wider">
                        {v.permutation}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(v.permutation)}
                        className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                        title="Sao chép số"
                      >
                        {copiedNumber === v.permutation ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeColor}`}>
                        {v.similarityScore}% • {v.variantLabel}
                      </span>
                    </div>
                  </div>

                  {/* Hits Breakdown in History */}
                  <div className="text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Tiền lệ làm số cuối (đuôi):</span>
                      <strong className={hasHits ? 'text-amber-400 font-mono text-sm' : 'text-slate-500'}>
                        {v.totalHits > 0 ? `${v.totalHits} lần` : '0 lần'}
                      </strong>
                    </div>

                    {hasHits ? (
                      <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 space-y-1.5">
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          Các đài từng nhận số đuôi này:
                        </span>
                        <div className="space-y-1">
                          {v.targetStations.map((tgt, tIdx) => (
                            <div
                              key={`tgt-${tgt.station}-${tIdx}`}
                              className="flex items-center justify-between text-[11px] bg-slate-900 px-2 py-1 rounded border border-slate-800"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{tgt.station}</span>
                                <span className="text-[9px] text-slate-400">
                                  ({tgt.scheduledDays.join(', ')})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-amber-300 font-mono font-bold">
                                  {tgt.hitCount} lần
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  +{tgt.mostCommonCycle} kỳ
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950/40 rounded-lg p-2 border border-slate-800/80 text-[11px] text-slate-500 italic">
                        Chưa từng xuất hiện làm đuôi với đầu số này ở các kỳ quay đã ghi nhận.
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action */}
                {hasHits && (
                  <div className="pt-2.5 mt-2.5 border-t border-slate-700/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        onViewDetails(
                          `Tiền lệ hoán vị: Đầu [${effectiveHeadInput}] ➔ Đuôi [${v.permutation}]`,
                          `Mức tương đồng: ${v.similarityScore}% (${v.variantLabel}) - Đã xuất hiện ${v.totalHits} lần`,
                          v.targetStations.flatMap(t => t.evidence)
                        )
                      }
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Xem {v.totalHits} bằng chứng</span>
                    </button>

                    {onApplyNumberFilter && (
                      <button
                        type="button"
                        onClick={() => onApplyNumberFilter(v.permutation)}
                        className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        Lọc số này
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. DỰ PHÓNG ĐÀI ĐÍCH & QUY LUẬT CẶP ĐÀI TƯƠNG ỨNG */}
      {(calculationResult.bestTargetStations.length > 0 || calculationResult.generalPairRules.length > 0) && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Dự Phóng Quy Luật Đài Đích Cho Đầu Số [{effectiveHeadInput}]
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Ưu tiên các đài có tần suất hoán vị cao nhất
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {calculationResult.bestTargetStations.slice(0, 3).map((best, bIdx) => {
              const primaryDay = best.scheduledDays[0] || 'Thứ 2';
              const theme = WEEKDAY_THEMES[primaryDay] || WEEKDAY_THEMES['Thứ 2'];

              return (
                <div
                  key={`best-tgt-${best.station}-${bIdx}`}
                  className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span className="text-amber-300">Đài {best.station}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${theme.badgeBg} ${theme.badgeText}`}>
                          Xổ {best.scheduledDays.join(', ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Chu kỳ phổ biến: +{best.commonCycle} kỳ
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                      {best.hitCount} lần trúng
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="text-[10px] text-slate-400 block">
                      Bộ số hoán vị từng nổ ở đài này:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {best.topNumbers.map((num, nIdx) => (
                        <span
                          key={`best-num-${nIdx}`}
                          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-xs font-bold text-amber-300"
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        onViewDetails(
                          `Tiền lệ hoán vị: Đầu [${effectiveHeadInput}] ➔ Đài ${best.station}`,
                          `Đã lặp lại ${best.hitCount} lần sau chu kỳ +${best.commonCycle} kỳ`,
                          best.evidence
                        )
                      }
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Xem bằng chứng</span>
                    </button>

                    {onFilterLeadByPair && selectedSourceStation !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => onFilterLeadByPair(selectedSourceStation, best.station)}
                        className="text-[11px] text-slate-300 hover:text-white flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Xem cặp này</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* If sourceStation selected, also show general pair rules */}
            {selectedSourceStation !== 'ALL' &&
              calculationResult.generalPairRules.slice(0, 3).map((rule, rIdx) => {
                const primaryDay = rule.scheduledDays[0] || 'Thứ 2';
                const theme = WEEKDAY_THEMES[primaryDay] || WEEKDAY_THEMES['Thứ 2'];

                return (
                  <div
                    key={`gen-rule-${rule.targetStation}-${rIdx}`}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{selectedSourceStation} ➔ {rule.targetStation}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold inline-block mt-0.5 ${theme.badgeBg} ${theme.badgeText}`}>
                          Xổ {rule.scheduledDays.join(', ')}
                        </span>
                      </div>

                      <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/30">
                        {rule.permuteRate.toFixed(1)}% Hoán vị
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Cặp đài này có tỉ lệ hoán vị bộ số rất mạnh ({rule.permuteHits}/{rule.totalRelations} lần). 
                      Khi <strong>{selectedSourceStation}</strong> ra đầu [<strong>{effectiveHeadInput}</strong>], kỳ tới của <strong>{rule.targetStation}</strong> có xác suất cao đón các hoán vị [
                      {calculationResult.allPermutations.slice(0, 3).join(', ')}...].
                    </p>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400">
                        Chu kỳ trung bình: +{rule.commonCycle} kỳ
                      </span>

                      {onFilterLeadByPair && (
                        <button
                          type="button"
                          onClick={() => onFilterLeadByPair(selectedSourceStation, rule.targetStation)}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Theo dõi cặp</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
