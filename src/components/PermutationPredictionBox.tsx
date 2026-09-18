import React, { useState, useMemo } from 'react';
import { DrawRelation, PatternPredictionLead } from '../types';
import { PermutationCalculator } from './PermutationCalculator';
import {
  Sparkles,
  Shuffle,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Award,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  Zap,
  Info,
  ChevronRight,
  Filter
} from 'lucide-react';

export interface PermutationForecastStationSummary {
  station: string;
  totalPairRelations: number;
  permuteOnlyCount: number;
  reverseCount: number;
  totalPermuteCount: number; // hoan vi + dao nguoc
  permuteRate: number; // %
  topPartnerStation: string;
  topPartnerPermuteCount: number;
  topPermuteNumbers: { raw: string; count: number }[];
  activeUpcomingLeadsCount: number;
}

export interface PermutationPairForecast {
  id: string;
  sourceStation: string;
  targetStation: string;
  totalRelations: number;
  permuteCount: number; // hoán vị vị trí
  reverseCount: number; // đảo ngược
  totalPermute: number; // hoán vị + đảo ngược
  permuteRate: number; // % trên tổng quan hệ giữa 2 đài
  exactCount: number;
  mostCommonCycle: number;
  sampleNumbers: string[];
  recentRelations: DrawRelation[];
  currentPendingHead3?: string;
  currentPendingLead?: PatternPredictionLead;
}

interface PermutationPredictionBoxProps {
  relations: DrawRelation[];
  leads: PatternPredictionLead[];
  uniqueStations: string[];
  onViewDetails: (title: string, subtitle: string, rels: DrawRelation[]) => void;
  onSelectStation?: (station: string) => void;
  onFilterLeadByPair?: (sourceStation: string, targetStation: string) => void;
  onApplyNumberFilter?: (queryNumber: string) => void;
}

export const PermutationPredictionBox: React.FC<PermutationPredictionBoxProps> = ({
  relations,
  leads,
  uniqueStations,
  onViewDetails,
  onSelectStation,
  onFilterLeadByPair,
  onApplyNumberFilter,
}) => {
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('ALL');
  const [minRelationsThreshold, setMinRelationsThreshold] = useState<number>(2);
  const [sortBy, setSortBy] = useState<'rate' | 'count' | 'active'>('rate');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Phân tích chi tiết từng cặp đài (A -> B) về tần suất và tỉ lệ HOÁN VỊ các bộ số cho nhau
  const pairForecasts = useMemo<PermutationPairForecast[]>(() => {
    if (relations.length === 0) return [];

    const pairMap = new Map<string, {
      sourceStation: string;
      targetStation: string;
      rels: DrawRelation[];
      permuteRels: DrawRelation[];
      reverseRels: DrawRelation[];
      exactRels: DrawRelation[];
      cycles: number[];
      numbersSet: Set<string>;
    }>();

    for (let i = 0; i < relations.length; i++) {
      const r = relations[i];
      // Loại trừ cùng 1 đài tự đối chiếu nếu có
      if (r.sourceStation.trim().toLowerCase() === r.targetStation.trim().toLowerCase()) continue;

      const key = `${r.sourceStation} -> ${r.targetStation}`;
      let item = pairMap.get(key);
      if (!item) {
        item = {
          sourceStation: r.sourceStation,
          targetStation: r.targetStation,
          rels: [],
          permuteRels: [],
          reverseRels: [],
          exactRels: [],
          cycles: [],
          numbersSet: new Set(),
        };
        pairMap.set(key, item);
      }

      item.rels.push(r);
      item.cycles.push(r.cycleDistance);

      if (r.relationType === 'HOAN_VI') {
        item.permuteRels.push(r);
        item.numbersSet.add(`${r.sourceHead3} ⟷ ${r.targetTail3}`);
      } else if (r.relationType === 'DAO_NGUOC') {
        item.reverseRels.push(r);
        item.numbersSet.add(`${r.sourceHead3} ⇄ ${r.targetTail3}`);
      } else if (r.relationType === 'TRUNG_3_3' || r.isExactMatch) {
        item.exactRels.push(r);
      }
    }

    const result: PermutationPairForecast[] = [];

    pairMap.forEach(item => {
      const totalRelCount = item.rels.length;
      const permuteCount = item.permuteRels.length;
      const reverseCount = item.reverseRels.length;
      const totalPermute = permuteCount + reverseCount;

      if (totalRelCount === 0) return;
      const permuteRate = (totalPermute / totalRelCount) * 100;

      // Find most common cycle
      const cycleCounts = new Map<number, number>();
      item.cycles.forEach(c => {
        cycleCounts.set(c, (cycleCounts.get(c) || 0) + 1);
      });
      let mostCommonCycle = 1;
      let maxCycleFreq = 0;
      cycleCounts.forEach((freq, cyc) => {
        if (freq > maxCycleFreq) {
          maxCycleFreq = freq;
          mostCommonCycle = cyc;
        }
      });

      // Find if there is an active upcoming lead for this pair
      const activeLead = leads.find(
        l =>
          l.latestRecord.station === item.sourceStation &&
          l.suggestedStation === item.targetStation &&
          (l.relationType === 'HOAN_VI' || l.relationType === 'DAO_NGUOC')
      );

      result.push({
        id: `permute-pair-${item.sourceStation}-${item.targetStation}`,
        sourceStation: item.sourceStation,
        targetStation: item.targetStation,
        totalRelations: totalRelCount,
        permuteCount,
        reverseCount,
        totalPermute,
        permuteRate,
        exactCount: item.exactRels.length,
        mostCommonCycle,
        sampleNumbers: Array.from(item.numbersSet).slice(0, 4),
        recentRelations: [...item.permuteRels, ...item.reverseRels],
        currentPendingLead: activeLead,
        currentPendingHead3: activeLead ? activeLead.latestRecord.head3 : undefined,
      });
    });

    return result;
  }, [relations, leads]);

  // 2. Thống kê theo từng đài (Đài nào có xu hướng hoán vị bộ số mạnh nhất)
  const stationRankings = useMemo<PermutationForecastStationSummary[]>(() => {
    if (uniqueStations.length === 0) return [];

    return uniqueStations.map(st => {
      const outgoingPairs = pairForecasts.filter(p => p.sourceStation === st);
      const totalPairRelations = outgoingPairs.reduce((acc, p) => acc + p.totalRelations, 0);
      const permuteOnlyCount = outgoingPairs.reduce((acc, p) => acc + p.permuteCount, 0);
      const reverseCount = outgoingPairs.reduce((acc, p) => acc + p.reverseCount, 0);
      const totalPermuteCount = permuteOnlyCount + reverseCount;
      const permuteRate = totalPairRelations > 0 ? (totalPermuteCount / totalPairRelations) * 100 : 0;

      // Top partner
      let topPartnerStation = '---';
      let topPartnerPermuteCount = 0;
      outgoingPairs.forEach(p => {
        if (p.totalPermute > topPartnerPermuteCount) {
          topPartnerPermuteCount = p.totalPermute;
          topPartnerStation = p.targetStation;
        }
      });

      // Count active upcoming leads for this station
      const activeUpcomingLeadsCount = leads.filter(
        l =>
          l.latestRecord.station === st &&
          (l.relationType === 'HOAN_VI' || l.relationType === 'DAO_NGUOC')
      ).length;

      // Top permuted number pairs
      const numberFreqMap = new Map<string, number>();
      outgoingPairs.flatMap(p => p.recentRelations).forEach(r => {
        const key = `${r.sourceHead3} ⇄ ${r.targetTail3}`;
        numberFreqMap.set(key, (numberFreqMap.get(key) || 0) + 1);
      });

      const topPermuteNumbers = Array.from(numberFreqMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([raw, count]) => ({ raw, count }));

      return {
        station: st,
        totalPairRelations,
        permuteOnlyCount,
        reverseCount,
        totalPermuteCount,
        permuteRate,
        topPartnerStation,
        topPartnerPermuteCount,
        topPermuteNumbers,
        activeUpcomingLeadsCount,
      };
    }).filter(s => s.totalPairRelations > 0).sort((a, b) => {
      if (sortBy === 'rate') return b.permuteRate - a.permuteRate;
      if (sortBy === 'count') return b.totalPermuteCount - a.totalPermuteCount;
      return b.activeUpcomingLeadsCount - a.activeUpcomingLeadsCount;
    });
  }, [uniqueStations, pairForecasts, leads, sortBy]);

  // 3. Lọc và sắp xếp các cặp đài dự đoán có tỉ lệ hoán vị cao nhất
  const filteredPairForecasts = useMemo(() => {
    return pairForecasts
      .filter(p => {
        if (p.totalRelations < minRelationsThreshold) return false;
        if (selectedStationFilter !== 'ALL') {
          if (p.sourceStation !== selectedStationFilter && p.targetStation !== selectedStationFilter) {
            return false;
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchSrc = p.sourceStation.toLowerCase().includes(q);
          const matchTgt = p.targetStation.toLowerCase().includes(q);
          const matchNum = p.sampleNumbers.some(n => n.includes(q));
          if (!matchSrc && !matchTgt && !matchNum) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Ưu tiên các cặp đang có manh mối quay gần nhất trước
        if (sortBy === 'active') {
          const aHas = a.currentPendingLead ? 1 : 0;
          const bHas = b.currentPendingLead ? 1 : 0;
          if (bHas !== aHas) return bHas - aHas;
          return b.permuteRate - a.permuteRate;
        }
        if (sortBy === 'rate') {
          if (Math.abs(b.permuteRate - a.permuteRate) > 0.01) {
            return b.permuteRate - a.permuteRate;
          }
          return b.totalPermute - a.totalPermute;
        }
        return b.totalPermute - a.totalPermute;
      });
  }, [pairForecasts, minRelationsThreshold, selectedStationFilter, searchQuery, sortBy]);

  // Top #1 dự đoán sáng nhất
  const top1Pair = filteredPairForecasts[0] || null;

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 text-white border-2 border-amber-500/40 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header & Feature Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-700/80">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
            <Shuffle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                <span>DỰ ĐOÁN CÁC ĐÀI CÓ KHẢ NĂNG HOÁN VỊ BỘ SỐ CHO NHAU CAO NHẤT</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-xs">
                Xác suất 75% - 85%
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Mô hình số học phát hiện cặp đài có khuynh hướng di chuyển 3 chữ số từ Đầu sang Cuối dưới dạng <strong>Hoán Vị Đổi Vị Trí</strong> hoặc <strong>Đảo Ngược Chiều</strong> qua các chu kỳ.
            </p>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-3 bg-slate-800/80 border border-amber-500/30 rounded-xl px-4 py-2 self-start lg:self-auto">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Tổng Cặp Đài Hoán Vị
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-amber-400">
              {pairForecasts.filter(p => p.totalPermute > 0).length} cặp
            </div>
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Kỳ Gần Nhất Chờ
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-rose-400">
              {leads.filter(l => l.relationType === 'HOAN_VI' || l.relationType === 'DAO_NGUOC').length} đầu số
            </div>
          </div>
        </div>
      </div>

      {/* TOP 1 HIGHLIGHT BANNER: ĐÀI ĐƯỢC DỰ ĐOÁN CÓ KHẢ NĂNG HOÁN VỊ CAO NHẤT */}
      {top1Pair && (
        <div className="bg-gradient-to-r from-amber-600/30 via-slate-800 to-slate-900 border border-amber-400/60 rounded-xl p-4 sm:p-5 shadow-md relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 opacity-10 text-amber-400 pointer-events-none">
            <Award className="w-48 h-48" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  Cặp Đài Dẫn Đầu Tỉ Lệ Hoán Vị ({top1Pair.permuteRate.toFixed(1)}%)
                </span>
                {top1Pair.currentPendingLead && (
                  <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold text-[10px] animate-pulse">
                    ⚡ Có đầu số kỳ mới: [{top1Pair.currentPendingHead3}]
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xl sm:text-2xl font-black text-amber-300">
                  {top1Pair.sourceStation}
                </div>
                <ArrowRight className="w-5 h-5 text-amber-400" />
                <div className="text-xl sm:text-2xl font-black text-white">
                  {top1Pair.targetStation}
                </div>
              </div>

              <p className="text-xs text-slate-200 max-w-2xl leading-relaxed">
                Trong lịch sử, khi đài <strong>{top1Pair.sourceStation}</strong> xuất hiện 3 số đầu, có tới{' '}
                <strong className="text-amber-300 font-mono">{top1Pair.totalPermute}</strong> lần ({top1Pair.permuteRate.toFixed(1)}% các lần đối chiếu) chuyển hóa thành hoán vị/đảo chiều của 3 số cuối đài{' '}
                <strong>{top1Pair.targetStation}</strong>, chu kỳ phổ biến nhất là <strong>+{top1Pair.mostCommonCycle} kỳ</strong>.
              </p>

              {/* Sample numbers preview */}
              {top1Pair.sampleNumbers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Các bộ số hoán vị tiêu biểu:</span>
                  {top1Pair.sampleNumbers.map((numPair, idx) => (
                    <span
                      key={`top1-num-${idx}`}
                      className="px-2 py-0.5 rounded bg-slate-900/90 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold"
                    >
                      {numPair}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onViewDetails(
                    `Lịch sử hoán vị: ${top1Pair.sourceStation} ⟷ ${top1Pair.targetStation}`,
                    `Tỉ lệ hoán vị: ${top1Pair.permuteRate.toFixed(1)}% (${top1Pair.totalPermute}/${top1Pair.totalRelations} lần)`,
                    top1Pair.recentRelations
                  )
                }
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-lg text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Xem {top1Pair.recentRelations.length} Bằng Chứng Lịch Sử</span>
              </button>

              {top1Pair.currentPendingLead && (
                <button
                  type="button"
                  onClick={() => {
                    if (onFilterLeadByPair) {
                      onFilterLeadByPair(top1Pair.sourceStation, top1Pair.targetStation);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition-colors text-center cursor-pointer border border-rose-400"
                >
                  Theo dõi số kỳ tới: [{top1Pair.currentPendingLead.projectedTail3}]
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CÔNG CỤ NHẬP ĐẦU SỐ TÍNH HOÁN VỊ THEO QUY LUẬT LỊCH SỬ ĐÃ CÓ */}
      <PermutationCalculator
        relations={relations}
        leads={leads}
        uniqueStations={uniqueStations}
        onViewDetails={onViewDetails}
        onApplyNumberFilter={num => {
          setSearchQuery(num);
          if (onApplyNumberFilter) {
            onApplyNumberFilter(num);
          }
        }}
        onFilterLeadByPair={onFilterLeadByPair}
      />

      {/* Controls & Filtering Bar */}
      <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Station selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Lọc đài:</span>
            <select
              value={selectedStationFilter}
              onChange={e => setSelectedStationFilter(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              <option value="ALL">-- Tất cả các đài --</option>
              {uniqueStations.map(st => (
                <option key={`opt-st-${st}`} value={st}>
                  Đài {st}
                </option>
              ))}
            </select>
          </div>

          {/* Sắp xếp */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Xếp theo:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-800 border border-slate-600 text-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              <option value="rate">Tỉ lệ hoán vị cao nhất (%)</option>
              <option value="count">Số lần hoán vị nhiều nhất</option>
              <option value="active">Đang có đầu số chờ kỳ mới</option>
            </select>
          </div>

          {/* Ngưỡng số quan hệ tối thiểu */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Tối thiểu:</span>
            <select
              value={minRelationsThreshold}
              onChange={e => setMinRelationsThreshold(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-white rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              <option value={1}>≥ 1 lần đối chiếu</option>
              <option value={2}>≥ 2 lần đối chiếu</option>
              <option value={3}>≥ 3 lần đối chiếu</option>
              <option value={5}>≥ 5 lần đối chiếu</option>
            </select>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Tìm tên đài hoặc số..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-white rounded-lg pl-8 pr-2.5 py-1 text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-amber-400 focus:outline-none w-full sm:w-48"
          />
        </div>
      </div>

      {/* BẢNG DỰ ĐOÁN CÁC CẶP ĐÀI HOÁN VỊ NHAU NHIỀU NHẤT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Bảng Xếp Hạng Cặp Đài Hoán Vị Bộ Số ({filteredPairForecasts.length} cặp tìm thấy)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            Dựa trên đối chiếu Đầu Đài Trước ➔ Cuối Đài Sau
          </span>
        </div>

        {filteredPairForecasts.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-xs">
            Không tìm thấy cặp đài nào khớp với điều kiện lọc hiện tại. Hãy giảm mức tối thiểu hoặc đặt lại bộ lọc.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPairForecasts.map((pair, idx) => {
              const isTop3 = idx < 3;
              const hasActiveLead = !!pair.currentPendingLead;

              return (
                <div
                  key={pair.id}
                  className={`border rounded-xl p-3.5 sm:p-4 transition-all flex flex-col justify-between ${
                    hasActiveLead
                      ? 'bg-slate-800/90 border-amber-400/80 ring-1 ring-amber-400/50 shadow-md'
                      : isTop3
                      ? 'bg-slate-800/60 border-slate-600 hover:border-amber-400/60'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Rank + Pair Stations */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-700/60">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 font-mono'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950 font-mono'
                              : idx === 2
                              ? 'bg-amber-700 text-white font-mono'
                              : 'bg-slate-700 text-slate-300 font-mono text-[11px]'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5 text-white">
                          <span className="text-amber-300">{pair.sourceStation}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span>{pair.targetStation}</span>
                        </div>
                      </div>

                      {/* Percentage Badge */}
                      <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-mono font-black text-xs">
                        {pair.permuteRate.toFixed(1)}%
                      </span>
                    </div>

                    {/* Stats metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Hoán Vị</span>
                        <span className="text-xs font-black text-amber-400 font-mono">
                          {pair.permuteCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Đảo Ngược</span>
                        <span className="text-xs font-black text-amber-300 font-mono">
                          {pair.reverseCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Chu Kỳ</span>
                        <span className="text-xs font-bold text-slate-300 font-mono">
                          +{pair.mostCommonCycle} kỳ
                        </span>
                      </div>
                    </div>

                    {/* Active Pending Lead alert if station has drawn recently */}
                    {pair.currentPendingLead && (
                      <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/60 text-[11px] text-rose-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1 text-rose-300">
                            <Zap className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                            Đang có đầu số chờ:
                          </span>
                          <span className="font-mono font-black text-amber-300 text-xs px-1.5 py-0.5 rounded bg-black/40">
                            [{pair.currentPendingHead3}]
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-tight">
                          Dự phóng theo hoán vị cho đài <strong>{pair.targetStation}</strong> kỳ tới:{' '}
                          <strong className="text-white font-mono text-xs">
                            [{pair.currentPendingLead.projectedTail3}]
                          </strong>
                        </p>
                      </div>
                    )}

                    {/* Sample Number Pairs */}
                    {pair.sampleNumbers.length > 0 && (
                      <div className="text-[11px] space-y-1">
                        <span className="text-slate-400 text-[10px] block">Mẫu hoán vị từng xuất hiện:</span>
                        <div className="flex flex-wrap gap-1">
                          {pair.sampleNumbers.map((s, sIdx) => (
                            <span
                              key={`sample-${sIdx}`}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card bottom button */}
                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Tổng {pair.totalPermute}/{pair.totalRelations} lần
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onViewDetails(
                          `Quan hệ hoán vị: ${pair.sourceStation} ➔ ${pair.targetStation}`,
                          `Tỉ lệ hoán vị: ${pair.permuteRate.toFixed(1)}% (${pair.totalPermute} lần xảy ra)`,
                          pair.recentRelations
                        )
                      }
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Xem bằng chứng</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BẢNG TỔNG KẾT THEO ĐÀI NGUỒN: ĐÀI NÀO CÓ XU HƯỚNG TỎA HOÁN VỊ MẠNH NHẤT */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Bảng Tổng Hợp Theo Từng Đài: Xu Hướng Hoán Vị Sang Các Đài Khác
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Sắp xếp theo tỉ lệ hoán vị trung bình
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-[11px] text-slate-400 font-semibold bg-slate-950/40">
                <th className="py-2.5 px-3">Tên Đài</th>
                <th className="py-2.5 px-3 text-center">Tổng Số Lượt Đối Chiếu</th>
                <th className="py-2.5 px-3 text-center">Số Lần Hoán Vị / Đảo</th>
                <th className="py-2.5 px-3 text-center">Tỉ Lệ Hoán Vị (%)</th>
                <th className="py-2.5 px-3">Đài Đích Hay Hoán Vị Nhất</th>
                <th className="py-2.5 px-3 text-center">Đầu Số Đang Chờ Kỳ Mới</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stationRankings.slice(0, 10).map((stItem, idx) => (
                <tr key={`rank-st-${stItem.station}`} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{stItem.station}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                    {stItem.totalPairRelations}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">
                    {stItem.totalPermuteCount}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold text-xs">
                      {stItem.permuteRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      <span>➔ {stItem.topPartnerStation}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({stItem.topPartnerPermuteCount} lần)
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {stItem.activeUpcomingLeadsCount > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-500/50 text-rose-300 font-bold text-[10px]">
                        {stItem.activeUpcomingLeadsCount} đầu số
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">---</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
