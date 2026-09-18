import React, { useState, useMemo } from 'react';
import { DrawRelation } from '../types';
import {
  Percent,
  CheckCircle2,
  Repeat,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Calendar,
  FileCheck2,
  Filter,
  Sparkles,
  Layers,
  ArrowUpDown
} from 'lucide-react';

interface RatioStatisticsProps {
  relations: DrawRelation[];
  uniqueStations: string[];
  onFilterExact: () => void;
  onFilterPermute: () => void;
  onFilterReverse: () => void;
  onFilter23: () => void;
  onViewDetails: (title: string, subtitle: string, rels: DrawRelation[]) => void;
}

export const RatioStatistics: React.FC<RatioStatisticsProps> = ({
  relations,
  uniqueStations,
  onFilterExact,
  onFilterPermute,
  onFilterReverse,
  onFilter23,
  onViewDetails,
}) => {
  const [stationSortBy, setStationSortBy] = useState<'exactRate' | 'permuteRate' | 'totalRate' | 'total'>('exactRate');
  const [cycleSortBy, setCycleSortBy] = useState<'cycle' | 'exactRate' | 'permuteRate'>('cycle');

  const total = relations.length;

  // 1. Core global statistics
  const coreStats = useMemo(() => {
    if (total === 0) {
      return {
        total: 0,
        exactCount: 0,
        exactRate: 0,
        reverseCount: 0,
        reverseRate: 0,
        permuteOnlyCount: 0,
        permuteOnlyRate: 0,
        permuteTotalCount: 0,
        permuteTotalRate: 0,
        match23Count: 0,
        match23Rate: 0,
        match13Count: 0,
        match13Rate: 0,
      };
    }

    let exactCount = 0;
    let reverseCount = 0;
    let permuteOnlyCount = 0;
    let match23Count = 0;
    let match13Count = 0;

    for (let i = 0; i < total; i++) {
      const type = relations[i].relationType;
      if (type === 'TRUNG_3_3' || relations[i].isExactMatch) {
        exactCount++;
      } else if (type === 'DAO_NGUOC') {
        reverseCount++;
      } else if (type === 'HOAN_VI') {
        permuteOnlyCount++;
      } else if (type === 'TRUNG_2_3' || type === 'TRUNG_VI_TRI') {
        match23Count++;
      } else if (type === 'TRUNG_1_3') {
        match13Count++;
      }
    }

    const permuteTotalCount = reverseCount + permuteOnlyCount;

    return {
      total,
      exactCount,
      exactRate: (exactCount / total) * 100,
      reverseCount,
      reverseRate: (reverseCount / total) * 100,
      permuteOnlyCount,
      permuteOnlyRate: (permuteOnlyCount / total) * 100,
      permuteTotalCount,
      permuteTotalRate: (permuteTotalCount / total) * 100,
      match23Count,
      match23Rate: (match23Count / total) * 100,
      match13Count,
      match13Rate: (match13Count / total) * 100,
    };
  }, [relations, total]);

  // 2. Station-by-station ratio breakdown
  const stationStats = useMemo(() => {
    const map = new Map<
      string,
      {
        station: string;
        total: number;
        exactList: DrawRelation[];
        reverseList: DrawRelation[];
        permuteList: DrawRelation[];
        targetCounts: Map<string, { exact: number; permute: number }>;
      }
    >();

    for (const st of uniqueStations) {
      map.set(st, {
        station: st,
        total: 0,
        exactList: [],
        reverseList: [],
        permuteList: [],
        targetCounts: new Map(),
      });
    }

    for (const r of relations) {
      let entry = map.get(r.sourceStation);
      if (!entry) {
        entry = {
          station: r.sourceStation,
          total: 0,
          exactList: [],
          reverseList: [],
          permuteList: [],
          targetCounts: new Map(),
        };
        map.set(r.sourceStation, entry);
      }

      entry.total++;

      let tgt = entry.targetCounts.get(r.targetStation);
      if (!tgt) {
        tgt = { exact: 0, permute: 0 };
        entry.targetCounts.set(r.targetStation, tgt);
      }

      if (r.relationType === 'TRUNG_3_3' || r.isExactMatch) {
        entry.exactList.push(r);
        tgt.exact++;
      } else if (r.relationType === 'DAO_NGUOC') {
        entry.reverseList.push(r);
        tgt.permute++;
      } else if (r.relationType === 'HOAN_VI') {
        entry.permuteList.push(r);
        tgt.permute++;
      }
    }

    const list = Array.from(map.values())
      .filter(item => item.total > 0)
      .map(item => {
        const exactCount = item.exactList.length;
        const exactRate = item.total > 0 ? (exactCount / item.total) * 100 : 0;
        const permuteCount = item.reverseList.length + item.permuteList.length;
        const permuteRate = item.total > 0 ? (permuteCount / item.total) * 100 : 0;
        const totalLinkedRate = exactRate + permuteRate;

        // Find top target station for exact
        let topTargetExact = '-';
        let maxExact = 0;
        let topTargetPermute = '-';
        let maxPermute = 0;

        for (const [tgtSt, counts] of item.targetCounts.entries()) {
          if (counts.exact > maxExact) {
            maxExact = counts.exact;
            topTargetExact = `${tgtSt} (${counts.exact} lần)`;
          }
          if (counts.permute > maxPermute) {
            maxPermute = counts.permute;
            topTargetPermute = `${tgtSt} (${counts.permute} lần)`;
          }
        }

        return {
          station: item.station,
          total: item.total,
          exactCount,
          exactRate,
          exactList: item.exactList,
          permuteCount,
          permuteRate,
          permuteList: [...item.reverseList, ...item.permuteList],
          reverseCount: item.reverseList.length,
          permuteOnlyCount: item.permuteList.length,
          totalLinkedRate,
          topTargetExact: maxExact > 0 ? topTargetExact : 'Chưa ghi nhận',
          topTargetPermute: maxPermute > 0 ? topTargetPermute : 'Chưa ghi nhận',
        };
      });

    // Sort station list
    list.sort((a, b) => {
      if (stationSortBy === 'exactRate') {
        if (b.exactRate !== a.exactRate) return b.exactRate - a.exactRate;
        return b.exactCount - a.exactCount;
      }
      if (stationSortBy === 'permuteRate') {
        if (b.permuteRate !== a.permuteRate) return b.permuteRate - a.permuteRate;
        return b.permuteCount - a.permuteCount;
      }
      if (stationSortBy === 'totalRate') {
        return b.totalLinkedRate - a.totalLinkedRate;
      }
      return b.total - a.total;
    });

    return list;
  }, [relations, uniqueStations, stationSortBy]);

  // 3. Cycle-by-cycle ratio breakdown (+1, +2, +3, +4, +5, +6, +7, +14, ...)
  const cycleStats = useMemo(() => {
    const cycleMap = new Map<
      number,
      {
        cycle: number;
        total: number;
        exactList: DrawRelation[];
        permuteList: DrawRelation[];
      }
    >();

    for (const r of relations) {
      const c = r.cycleDistance;
      let entry = cycleMap.get(c);
      if (!entry) {
        entry = { cycle: c, total: 0, exactList: [], permuteList: [] };
        cycleMap.set(c, entry);
      }
      entry.total++;
      if (r.relationType === 'TRUNG_3_3' || r.isExactMatch) {
        entry.exactList.push(r);
      } else if (r.relationType === 'DAO_NGUOC' || r.relationType === 'HOAN_VI') {
        entry.permuteList.push(r);
      }
    }

    const list = Array.from(cycleMap.values()).map(item => {
      const exactCount = item.exactList.length;
      const exactRate = item.total > 0 ? (exactCount / item.total) * 100 : 0;
      const permuteCount = item.permuteList.length;
      const permuteRate = item.total > 0 ? (permuteCount / item.total) * 100 : 0;
      return {
        cycle: item.cycle,
        total: item.total,
        exactCount,
        exactRate,
        exactList: item.exactList,
        permuteCount,
        permuteRate,
        permuteList: item.permuteList,
      };
    });

    list.sort((a, b) => {
      if (cycleSortBy === 'exactRate') return b.exactRate - a.exactRate;
      if (cycleSortBy === 'permuteRate') return b.permuteRate - a.permuteRate;
      return a.cycle - b.cycle;
    });

    return list;
  }, [relations, cycleSortBy]);

  // 4. Top Repeating 3-digit sets for Exact and Permutations
  const topNumberSets = useMemo(() => {
    // Top exact numbers
    const exactCounts = new Map<string, { number: string; count: number; rels: DrawRelation[] }>();
    // Top permuted tuples
    const permuteCounts = new Map<string, { tuple: string; count: number; rels: DrawRelation[] }>();

    for (const r of relations) {
      if (r.relationType === 'TRUNG_3_3' || r.isExactMatch) {
        const num = r.sourceHead3;
        const e = exactCounts.get(num) || { number: num, count: 0, rels: [] };
        e.count++;
        e.rels.push(r);
        exactCounts.set(num, e);
      } else if (r.relationType === 'DAO_NGUOC' || r.relationType === 'HOAN_VI') {
        const tuple = r.sourceHead3.split('').sort().join('');
        const e = permuteCounts.get(tuple) || { tuple, count: 0, rels: [] };
        e.count++;
        e.rels.push(r);
        permuteCounts.set(tuple, e);
      }
    }

    const topExact = Array.from(exactCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topPermute = Array.from(permuteCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { topExact, topPermute };
  }, [relations]);

  if (total === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
        Chưa có dữ liệu để tính toán tỉ lệ thống kê trùng và hoán vị.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: HERO STATISTICAL COMPARISON CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Tỉ Lệ Trùng Riêng (Exact Match) */}
        <div className="bg-gradient-to-br from-rose-50 to-white border-2 border-rose-300 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                <span>Tỉ Lệ Trùng Riêng (100%)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900 font-bold text-[11px]">
                3/3 Chữ Số
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-black text-rose-700 font-mono tracking-tight">
                {coreStats.exactRate.toFixed(2)}%
              </span>
              <span className="text-xs font-semibold text-rose-900/80">
                ({coreStats.exactCount} / {coreStats.total} đối chiếu)
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Tỉ lệ số lần 3 số đầu của đài trước trùng khớp tuyệt đối nguyên bản với 3 số cuối của đài đích ở các kỳ sau.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-200/70 flex items-center justify-between">
            <button
              type="button"
              onClick={onFilterExact}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Xem {coreStats.exactCount} cặp trùng riêng</span>
            </button>
            <span className="text-[11px] text-rose-800 font-semibold">
              Độ hiếm cao
            </span>
          </div>
        </div>

        {/* Card 2: Tỉ Lệ Hoán Vị Riêng (Permutation & Reversal) */}
        <div className="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-300 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Tỉ Lệ Hoán Vị Bộ 3 Số Riêng</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold text-[11px]">
                75% - 85%
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-black text-amber-700 font-mono tracking-tight">
                {coreStats.permuteTotalRate.toFixed(2)}%
              </span>
              <span className="text-xs font-semibold text-amber-900/80">
                ({coreStats.permuteTotalCount} / {coreStats.total} đối chiếu)
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <strong>Đảo ngược:</strong> {coreStats.reverseRate.toFixed(1)}% ({coreStats.reverseCount} lần)
              </span>
              <span className="inline-flex items-center gap-1">
                <strong>Hoán vị:</strong> {coreStats.permuteOnlyRate.toFixed(1)}% ({coreStats.permuteOnlyCount} lần)
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Tỉ lệ cùng chứa trọn vẹn bộ 3 chữ số giữa đài nguồn và đài đích nhưng đảo thứ tự hoặc hoán vị chéo.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/70 flex items-center justify-between">
            <button
              type="button"
              onClick={onFilterPermute}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Xem {coreStats.permuteTotalCount} cặp hoán vị riêng</span>
            </button>
            <span className="text-[11px] text-amber-800 font-semibold">
              Cùng bộ 3 số
            </span>
          </div>
        </div>

        {/* Card 3: Trùng 2/3 chữ số (Trùng cặp) & Tổng liên kết */}
        <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>Tỉ Lệ Trùng 2/3 Chữ Số</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold text-[11px]">
                67% Cặp Số
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-black text-blue-700 font-mono tracking-tight">
                {coreStats.match23Rate.toFixed(2)}%
              </span>
              <span className="text-xs font-semibold text-blue-900/80">
                ({coreStats.match23Count} / {coreStats.total} đối chiếu)
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Tỉ lệ giữ nguyên 1 cặp 2 chữ số chủ lực (hoặc trùng 2 vị trí cố định) từ 3 số đầu sang 3 số cuối.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-blue-200/70 flex items-center justify-between">
            <button
              type="button"
              onClick={onFilter23}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Xem {coreStats.match23Count} cặp trùng 2/3</span>
            </button>
            <span className="text-[11px] text-blue-800 font-semibold">
              Giữ cặp số
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: PERCENTAGE DISTRIBUTION VISUAL BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-600" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
              Biểu Đồ Phân Bổ Tỉ Lệ Tương Đồng Số Học Đầu ➔ Cuối
            </h4>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Tổng cơ số: <strong>{coreStats.total}</strong> quan hệ đối chiếu lịch sử
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="h-6 w-full bg-slate-100 rounded-lg overflow-hidden flex border border-slate-200">
          {coreStats.exactRate > 0 && (
            <div
              style={{ width: `${coreStats.exactRate}%` }}
              title={`Trùng 100%: ${coreStats.exactRate.toFixed(2)}% (${coreStats.exactCount} lần)`}
              className="bg-rose-600 h-full flex items-center justify-center text-[10px] font-black text-white px-1 overflow-hidden"
            >
              {coreStats.exactRate >= 4 && `${coreStats.exactRate.toFixed(1)}%`}
            </div>
          )}
          {coreStats.reverseRate > 0 && (
            <div
              style={{ width: `${coreStats.reverseRate}%` }}
              title={`Đảo ngược 85%: ${coreStats.reverseRate.toFixed(2)}% (${coreStats.reverseCount} lần)`}
              className="bg-amber-600 h-full flex items-center justify-center text-[10px] font-black text-white px-1 overflow-hidden"
            >
              {coreStats.reverseRate >= 4 && `${coreStats.reverseRate.toFixed(1)}%`}
            </div>
          )}
          {coreStats.permuteOnlyRate > 0 && (
            <div
              style={{ width: `${coreStats.permuteOnlyRate}%` }}
              title={`Hoán vị 75%: ${coreStats.permuteOnlyRate.toFixed(2)}% (${coreStats.permuteOnlyCount} lần)`}
              className="bg-amber-400 h-full flex items-center justify-center text-[10px] font-black text-slate-900 px-1 overflow-hidden"
            >
              {coreStats.permuteOnlyRate >= 4 && `${coreStats.permuteOnlyRate.toFixed(1)}%`}
            </div>
          )}
          {coreStats.match23Rate > 0 && (
            <div
              style={{ width: `${coreStats.match23Rate}%` }}
              title={`Trùng 2/3: ${coreStats.match23Rate.toFixed(2)}% (${coreStats.match23Count} lần)`}
              className="bg-blue-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 overflow-hidden"
            >
              {coreStats.match23Rate >= 5 && `${coreStats.match23Rate.toFixed(1)}%`}
            </div>
          )}
          {coreStats.match13Rate > 0 && (
            <div
              style={{ width: `${coreStats.match13Rate}%` }}
              title={`Trùng 1/3: ${coreStats.match13Rate.toFixed(2)}% (${coreStats.match13Count} lần)`}
              className="bg-slate-300 h-full flex items-center justify-center text-[10px] font-medium text-slate-700 px-1 overflow-hidden"
            >
              {coreStats.match13Rate >= 8 && `${coreStats.match13Rate.toFixed(1)}%`}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
          <button
            type="button"
            onClick={onFilterExact}
            className="flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <span className="w-3 h-3 rounded bg-rose-600 inline-block"></span>
            <span className="text-slate-700">Trùng riêng 100%: <strong>{coreStats.exactRate.toFixed(2)}%</strong> ({coreStats.exactCount})</span>
          </button>
          <button
            type="button"
            onClick={onFilterReverse}
            className="flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <span className="w-3 h-3 rounded bg-amber-600 inline-block"></span>
            <span className="text-slate-700">Đảo ngược 85%: <strong>{coreStats.reverseRate.toFixed(2)}%</strong> ({coreStats.reverseCount})</span>
          </button>
          <button
            type="button"
            onClick={onFilterPermute}
            className="flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
            <span className="text-slate-700">Hoán vị 75%: <strong>{coreStats.permuteOnlyRate.toFixed(2)}%</strong> ({coreStats.permuteOnlyCount})</span>
          </button>
          <button
            type="button"
            onClick={onFilter23}
            className="flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
            <span className="text-slate-700">Trùng 2/3 (67%): <strong>{coreStats.match23Rate.toFixed(2)}%</strong> ({coreStats.match23Count})</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: TOP REPEATING NUMBERS FOR EXACT & PERMUTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Exact Numbers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
              <CheckCircle2 className="w-4 h-4 text-rose-600" />
              <span>Các Bộ 3 Số Trùng Tuyệt Đối Nhiều Nhất</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Đầu ➔ Đuôi (100%)</span>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {topNumberSets.topExact.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Chưa có bộ số nào trùng 100% lặp lại.</p>
            ) : (
              topNumberSets.topExact.map((item) => (
                <div key={`top-ex-${item.number}`} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded bg-rose-100 text-rose-800">
                      {item.number}
                    </span>
                    <span className="text-slate-600 text-[11px]">
                      Trùng chính xác <strong>{item.count}</strong> lần
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onViewDetails(
                        `Chi tiết bộ số trùng [${item.number}]`,
                        `Tổng cộng ${item.count} lần trùng khớp 100% giữa các đài`,
                        item.rels
                      )
                    }
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Xem lịch sử
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Permuted Tuples */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Repeat className="w-4 h-4 text-amber-600" />
              <span>Các Bộ 3 Số Hoán Vị / Đảo Ngược Nhiều Nhất</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Cùng bộ số</span>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {topNumberSets.topPermute.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Chưa có bộ số hoán vị nào lặp lại.</p>
            ) : (
              topNumberSets.topPermute.map((item) => (
                <div key={`top-perm-${item.tuple}`} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      {'{' + item.tuple.split('').join(',') + '}'}
                    </span>
                    <span className="text-slate-600 text-[11px]">
                      Hoán vị/Đảo <strong>{item.count}</strong> lần
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onViewDetails(
                        `Chi tiết bộ số hoán vị {${item.tuple.split('').join(',')}}`,
                        `Tổng cộng ${item.count} lần hoán vị giữa các đài`,
                        item.rels
                      )
                    }
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Xem lịch sử
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: TABLE 1 - STATS BY STATION */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-2">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Thống Kê Tỉ Lệ Trùng Riêng & Hoán Vị Riêng Theo Từng Đài Xổ Số
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Đo lường xác suất dịch chuyển 3 số đầu của mỗi đài khi làm đài nguồn sang 3 số cuối của các đài đích.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Sắp xếp theo:</span>
            <select
              value={stationSortBy}
              onChange={e => setStationSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="exactRate">Tỉ lệ trùng riêng cao nhất</option>
              <option value="permuteRate">Tỉ lệ hoán vị riêng cao nhất</option>
              <option value="totalRate">Tổng tỉ lệ liên kết cao nhất</option>
              <option value="total">Tổng lượt đối chiếu nhiều nhất</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Tên Đài</th>
                <th className="py-3 px-3 text-center">Tổng lượt đối chiếu</th>
                <th className="py-3 px-3 text-center">Số lần Trùng riêng (3/3)</th>
                <th className="py-3 px-3 text-center">Tỉ Lệ Trùng Riêng (%)</th>
                <th className="py-3 px-3 text-center">Số lần Hoán vị riêng</th>
                <th className="py-3 px-3 text-center">Tỉ Lệ Hoán Vị Riêng (%)</th>
                <th className="py-3 px-3">Đài đích hay trùng nhất</th>
                <th className="py-3 px-3">Đài đích hay hoán vị nhất</th>
                <th className="py-3 px-3 text-center">Xem bằng chứng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stationStats.map((st) => (
                <tr key={`st-stat-${st.station}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3.5 font-bold text-slate-900">
                    {st.station}
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-slate-600">
                    {st.total}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-rose-700">
                    {st.exactCount}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs bg-rose-100 text-rose-800">
                      {st.exactRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">
                    {st.permuteCount}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs bg-amber-100 text-amber-800">
                      {st.permuteRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {st.topTargetExact}
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {st.topTargetPermute}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {st.exactCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onViewDetails(
                              `Quan hệ trùng riêng của đài ${st.station}`,
                              `${st.exactCount} lần trùng khớp 100% (${st.exactRate.toFixed(2)}%)`,
                              st.exactList
                            )
                          }
                          className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold border border-rose-200"
                        >
                          Trùng ({st.exactCount})
                        </button>
                      )}
                      {st.permuteCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onViewDetails(
                              `Quan hệ hoán vị riêng của đài ${st.station}`,
                              `${st.permuteCount} lần hoán vị/đảo ngược (${st.permuteRate.toFixed(2)}%)`,
                              st.permuteList
                            )
                          }
                          className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-semibold border border-amber-200"
                        >
                          Hoán vị ({st.permuteCount})
                        </button>
                      )}
                      {st.exactCount === 0 && st.permuteCount === 0 && (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5: TABLE 2 - STATS BY CYCLE DISTANCE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Thống Kê Tỉ Lệ Trùng Riêng & Hoán Vị Riêng Theo Khoảng Cách Chu Kỳ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân tích xem quy luật Trùng riêng và Hoán vị bộ 3 số rơi vào chu kỳ kế tiếp (+1 kỳ), cùng tuần (+7 kỳ) hay chu kỳ xa (+14, +21, +30 kỳ).
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Sắp xếp:</span>
            <select
              value={cycleSortBy}
              onChange={e => setCycleSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="cycle">Thứ tự chu kỳ (+1, +2...)</option>
              <option value="exactRate">Tỉ lệ trùng riêng cao nhất</option>
              <option value="permuteRate">Tỉ lệ hoán vị riêng cao nhất</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Khoảng cách Chu kỳ</th>
                <th className="py-3 px-3 text-center">Số đối chiếu</th>
                <th className="py-3 px-3 text-center">Số lần Trùng riêng (3/3)</th>
                <th className="py-3 px-3 text-center">Tỉ Lệ Trùng Riêng (%)</th>
                <th className="py-3 px-3 text-center">Số lần Hoán vị riêng</th>
                <th className="py-3 px-3 text-center">Tỉ Lệ Hoán Vị Riêng (%)</th>
                <th className="py-3 px-3 text-center">Bằng chứng lịch sử</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cycleStats.map((c) => (
                <tr key={`cyc-stat-${c.cycle}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3.5 font-bold text-slate-900">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-mono">
                      +{c.cycle} kỳ quay
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-slate-600">
                    {c.total}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-rose-700">
                    {c.exactCount}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs bg-rose-100 text-rose-800">
                      {c.exactRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">
                    {c.permuteCount}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs bg-amber-100 text-amber-800">
                      {c.permuteRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {c.exactCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onViewDetails(
                              `Chu kỳ +${c.cycle} kỳ quay - Trùng riêng`,
                              `${c.exactCount} lần trùng khớp 100% ở chu kỳ này (${c.exactRate.toFixed(2)}%)`,
                              c.exactList
                            )
                          }
                          className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold border border-rose-200"
                        >
                          Trùng ({c.exactCount})
                        </button>
                      )}
                      {c.permuteCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onViewDetails(
                              `Chu kỳ +${c.cycle} kỳ quay - Hoán vị riêng`,
                              `${c.permuteCount} lần hoán vị ở chu kỳ này (${c.permuteRate.toFixed(2)}%)`,
                              c.permuteList
                            )
                          }
                          className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-semibold border border-amber-200"
                        >
                          Hoán vị ({c.permuteCount})
                        </button>
                      )}
                    </div>
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
