import {
  LotteryRecord,
  DrawRelation,
  RelationType,
  AlertColor,
  RepeatedRelationSummary,
  StationMatrixCell,
  HistoricPattern,
  EstimatedDrawDateInfo,
  PatternPredictionLead,
  SimilarityBreakdown,
  SimilarityPositionDetail,
  DayOfWeek,
  SameDayDrawGroup,
  DayOfWeekStatSummary,
  TailPatternOverview
} from '../types';
import { getDayDifference, VIETNAMESE_DAYS, getVietnameseDayOfWeek, parseDateString } from './dateUtils';

/**
 * Validates and extracts 3 head and 3 tail digits from a 6-digit number string
 */
export function extractHeadAndTail(rawNumber: string): {
  valid: boolean;
  clean: string;
  head3: string;
  tail3: string;
} {
  const clean = rawNumber.replace(/\D/g, '');
  if (clean.length !== 6) {
    return { valid: false, clean, head3: '', tail3: '' };
  }
  const head3 = clean.slice(0, 3);
  const tail3 = clean.slice(3, 6);
  return { valid: true, clean, head3, tail3 };
}

/**
 * Determines relation type and similarity between two 3-digit strings
 */
export function compareDigits(
  head3: string,
  tail3: string
): {
  relationType: RelationType;
  relationTypeLabel: string;
  similarityScore: number;
  matchDescription: string;
  isExactMatch: boolean;
} {
  // 1. Exact match 3/3
  if (head3 === tail3) {
    return {
      relationType: 'TRUNG_3_3',
      relationTypeLabel: 'Trùng hoàn toàn (3/3)',
      similarityScore: 100,
      matchDescription: `Trùng khớp chính xác 3 số: ${head3} → ${tail3}`,
      isExactMatch: true,
    };
  }

  // 2. Reverse order (e.g. 123 and 321)
  const reversedHead = head3.split('').reverse().join('');
  if (reversedHead === tail3) {
    return {
      relationType: 'DAO_NGUOC',
      relationTypeLabel: 'Đảo ngược vị trí',
      similarityScore: 85,
      matchDescription: `Đảo ngược vị trí chữ số: ${head3} ⇄ ${tail3}`,
      isExactMatch: false,
    };
  }

  // 3. Permutation (Hoán vị: cùng các chữ số nhưng vị trí khác)
  const sortedHead = head3.split('').sort().join('');
  const sortedTail = tail3.split('').sort().join('');
  if (sortedHead === sortedTail) {
    return {
      relationType: 'HOAN_VI',
      relationTypeLabel: 'Hoán vị chữ số',
      similarityScore: 75,
      matchDescription: `Bộ số hoán vị (cùng 3 chữ số): ${head3} ⟷ ${tail3}`,
      isExactMatch: false,
    };
  }

  // 4. Exact positions matching count
  let exactPosCount = 0;
  for (let i = 0; i < 3; i++) {
    if (head3[i] === tail3[i]) exactPosCount++;
  }

  // 5. Shared digits count (multiset intersection)
  const headDigits = head3.split('');
  const tailDigits = tail3.split('');
  let sharedCount = 0;
  const tempTail = [...tailDigits];
  for (const digit of headDigits) {
    const idx = tempTail.indexOf(digit);
    if (idx !== -1) {
      sharedCount++;
      tempTail.splice(idx, 1);
    }
  }

  if (exactPosCount === 2) {
    return {
      relationType: 'TRUNG_VI_TRI',
      relationTypeLabel: 'Trùng 2 vị trí cố định',
      similarityScore: 67,
      matchDescription: `Trùng 2 vị trí số: ${head3} và ${tail3}`,
      isExactMatch: false,
    };
  }

  if (sharedCount === 2) {
    return {
      relationType: 'TRUNG_2_3',
      relationTypeLabel: 'Trùng 2/3 chữ số',
      similarityScore: 67,
      matchDescription: `Trùng 2 trong 3 chữ số: ${head3} và ${tail3}`,
      isExactMatch: false,
    };
  }

  if (sharedCount === 1) {
    return {
      relationType: 'TRUNG_1_3',
      relationTypeLabel: 'Trùng 1/3 chữ số',
      similarityScore: 33,
      matchDescription: `Trùng 1 trong 3 chữ số: ${head3} và ${tail3}`,
      isExactMatch: false,
    };
  }

  return {
    relationType: 'TRUNG_1_3',
    relationTypeLabel: 'Không tương đồng',
    similarityScore: 0,
    matchDescription: `Không có chữ số trùng`,
    isExactMatch: false,
  };
}

/**
 * Calculates in-depth similarity breakdown between two 3-digit strings.
 * Meticulously inspects digit positions (hundreds, tens, units), shared digits,
 * reverse orders, permutations, and mathematical match tiers.
 */
export function calculateSimilarityBreakdown(head3: string, tail3: string): SimilarityBreakdown {
  const isExact = head3 === tail3;
  const isReversed = !isExact && head3.split('').reverse().join('') === tail3;
  const sortedHead = head3.split('').sort().join('');
  const sortedTail = tail3.split('').sort().join('');
  const isPermutation = !isExact && !isReversed && sortedHead === sortedTail;

  const exactPositions: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (head3[i] === tail3[i]) {
      exactPositions.push(i);
    }
  }

  // Multiset shared digits
  const headDigits = head3.split('');
  const tailDigits = tail3.split('');
  const sharedDigits: string[] = [];
  const tempTail = [...tailDigits];
  for (const digit of headDigits) {
    const idx = tempTail.indexOf(digit);
    if (idx !== -1) {
      sharedDigits.push(digit);
      tempTail.splice(idx, 1);
    }
  }

  const posNames = ['Hàng trăm', 'Hàng chục', 'Hàng đơn vị'];
  const positionDetails: SimilarityPositionDetail[] = [];
  for (let i = 0; i < 3; i++) {
    const sDig = head3[i] || '-';
    const tDig = tail3[i] || '-';
    if (sDig === tDig) {
      positionDetails.push({
        posIndex: i,
        posName: posNames[i],
        sourceDigit: sDig,
        targetDigit: tDig,
        matchType: 'EXACT',
        matchLabel: `Trùng tuyệt đối chữ số ${sDig}`,
      });
    } else if (tailDigits.includes(sDig)) {
      positionDetails.push({
        posIndex: i,
        posName: posNames[i],
        sourceDigit: sDig,
        targetDigit: tDig,
        matchType: 'PERMUTED',
        matchLabel: `Số ${sDig} đảo sang vị trí khác (đối diện ${tDig})`,
      });
    } else {
      positionDetails.push({
        posIndex: i,
        posName: posNames[i],
        sourceDigit: sDig,
        targetDigit: tDig,
        matchType: 'DIFFERENT',
        matchLabel: `Khác biệt: ${sDig} so với ${tDig}`,
      });
    }
  }

  let score = 0;
  let tier: SimilarityBreakdown['tier'] = 'MATCH_1_3';
  let tierLabel = 'Không tương đồng';
  let explanation = '';

  if (isExact) {
    score = 100;
    tier = 'EXACT_100';
    tierLabel = 'Trùng khớp tuyệt đối (100%)';
    explanation = `Trùng khớp chính xác 100% cả 3 vị trí chữ số: [${head3}] ➔ [${tail3}]. Giữ nguyên cấu trúc số.`;
  } else if (isReversed) {
    score = 85;
    tier = 'REVERSE_85';
    tierLabel = 'Đảo ngược thứ tự (85%)';
    explanation = `Đảo ngược trực tiếp thứ tự 3 số: [${head3}] ⇄ [${tail3}]. Cùng 3 chữ số nhưng đổi chiều hoàn toàn.`;
  } else if (isPermutation) {
    score = 75;
    tier = 'PERMUTE_75';
    tierLabel = 'Hoán vị bộ 3 số (75%)';
    explanation = `Hoán vị bộ 3 số: Cùng tập hợp chữ số {${sharedDigits.join(', ')}}, vị trí hoán đổi lẫn nhau.`;
  } else if (sharedDigits.length === 2) {
    score = 67;
    tier = 'MATCH_2_3';
    tierLabel = 'Trùng 2/3 chữ số (67%)';
    explanation = `Trùng khớp 2 trong 3 chữ số: các chữ số chung {${sharedDigits.join(', ')}}. Giữ nguyên 1 cặp số cốt lõi.`;
  } else if (sharedDigits.length === 1) {
    score = 33;
    tier = 'MATCH_1_3';
    tierLabel = 'Trùng 1/3 chữ số (33%)';
    explanation = `Chỉ trùng 1 chữ số chung {${sharedDigits.join(', ')}}.`;
  } else {
    score = 0;
    tier = 'MATCH_1_3';
    tierLabel = 'Không có chữ số trùng';
    explanation = `Không có chữ số nào trùng giữa [${head3}] và [${tail3}].`;
  }

  return {
    score,
    tier,
    tierLabel,
    sharedDigits,
    sharedDigitsCount: sharedDigits.length,
    exactPositionsCount: exactPositions.length,
    isReversed,
    isPermutation,
    positionDetails,
    explanation,
  };
}

/**
 * Assigns warning color based on requirement #5:
 * Màu ĐỎ: Trùng khớp trực tiếp HOẶC quan hệ đã xuất hiện nhiều lần (tần suất cao)
 * Màu CAM: Có mức độ tương đồng cao (67% - 85%, đảo ngược, hoán vị) hoặc có mẫu lặp đáng chú ý
 * Màu VÀNG: Có một phần mẫu tương đồng (33%) nhưng chưa đủ dữ liệu
 * Màu XANH: Không phát hiện quan hệ đáng chú ý (hoặc bình thường)
 */
export function determineAlertColor(
  isExactMatch: boolean,
  similarityScore: number,
  repeatCount: number = 1
): AlertColor {
  if (isExactMatch || repeatCount >= 3) {
    return 'red';
  }
  if (similarityScore >= 67 || repeatCount === 2) {
    return 'orange';
  }
  if (similarityScore >= 33) {
    return 'yellow';
  }
  return 'green';
}

export interface AnalysisFilterOptions {
  sourceStation?: string;
  targetStation?: string;
  sourceDays?: DayOfWeek[];
  targetDays?: DayOfWeek[];
  cycleDistances?: number[]; // e.g. [1, 2, 3, 4, 5, 6, 7, 14, 21, 30]
  minCycle?: number;
  maxCycle?: number;
  minSimilarity?: number; // 0, 33, 67, 100
  relationTypes?: RelationType[];
  exactOnly?: boolean;
  searchNumber?: string;
}

/**
 * Core engine: builds all Head -> Tail relations between records across chronological draws
 */
export function analyzeHeadToTailRelations(
  records: LotteryRecord[],
  filters: AnalysisFilterOptions = {}
): {
  allRelations: DrawRelation[];
  repeatedSummaries: RepeatedRelationSummary[];
  matrix: StationMatrixCell[][];
  stationsList: string[];
  patterns: HistoricPattern[];
} {
  if (records.length < 2) {
    return {
      allRelations: [],
      repeatedSummaries: [],
      matrix: [],
      stationsList: [],
      patterns: [],
    };
  }

  // Sort chronologically ascending
  const sorted = [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sessionIndex - b.sessionIndex;
  });

  const uniqueStations = Array.from(new Set(sorted.map(r => r.station))).sort();

  // Create date-to-draw-index mapping for cycle distance
  // In Southern Lottery, each draw date or draw session has an index
  const dateMap = new Map<string, number>();
  const uniqueDates = Array.from(new Set(sorted.map(r => r.date))).sort();
  uniqueDates.forEach((d, idx) => dateMap.set(d, idx));

  const relations: DrawRelation[] = [];

  // Compare every source record with future records
  for (let i = 0; i < sorted.length; i++) {
    const src = sorted[i];
    const srcDateIdx = dateMap.get(src.date) ?? 0;

    for (let j = i + 1; j < sorted.length; j++) {
      const tgt = sorted[j];

      // Do not match within the exact same record
      if (src.id === tgt.id) continue;

      // Ensure chronological: target must be on same date with later session or strictly later date
      if (tgt.date < src.date) continue;

      const tgtDateIdx = dateMap.get(tgt.date) ?? 0;
      const cycleDistance = tgtDateIdx - srcDateIdx;

      // If cycle is 0 (same day, different station), count as 0 or 1 session
      const effectiveCycle = cycleDistance === 0 ? 0 : cycleDistance;

      // Filter by max cycle bound to prevent O(N^2) exploding if thousands of records
      if (filters.maxCycle !== undefined && effectiveCycle > filters.maxCycle) {
        // Can skip further checks for this source if sorted
        continue;
      }

      if (filters.minCycle !== undefined && effectiveCycle < filters.minCycle) {
        continue;
      }

      if (filters.cycleDistances && filters.cycleDistances.length > 0) {
        if (!filters.cycleDistances.includes(effectiveCycle)) {
          continue;
        }
      }

      // Check source and target station filter
      if (filters.sourceStation && filters.sourceStation !== 'ALL' && src.station !== filters.sourceStation) {
        continue;
      }
      if (filters.targetStation && filters.targetStation !== 'ALL' && tgt.station !== filters.targetStation) {
        continue;
      }

      // Check day of week filter
      if (filters.sourceDays && filters.sourceDays.length > 0 && !filters.sourceDays.includes(src.dayOfWeek)) {
        continue;
      }
      if (filters.targetDays && filters.targetDays.length > 0 && !filters.targetDays.includes(tgt.dayOfWeek)) {
        continue;
      }

      // Number comparison: 3 số đầu của Đài A -> 3 số cuối của Đài B
      const comparison = compareDigits(src.head3, tgt.tail3);

      // Similarity threshold filter
      if (filters.minSimilarity !== undefined && comparison.similarityScore < filters.minSimilarity) {
        continue;
      }

      // Exact only filter
      if (filters.exactOnly && !comparison.isExactMatch) {
        continue;
      }

      // Relation type filter
      if (filters.relationTypes && filters.relationTypes.length > 0) {
        if (!filters.relationTypes.includes(comparison.relationType)) {
          continue;
        }
      }

      // Number search filter (matches head3 or tail3)
      if (filters.searchNumber && filters.searchNumber.trim() !== '') {
        const q = filters.searchNumber.trim();
        if (!src.head3.includes(q) && !tgt.tail3.includes(q)) {
          continue;
        }
      }

      const dayDistance = getDayDifference(src.date, tgt.date);
      const alertColor = determineAlertColor(comparison.isExactMatch, comparison.similarityScore, 1);

      const rel: DrawRelation = {
        id: `${src.id}->${tgt.id}`,
        sourceRecord: src,
        targetRecord: tgt,
        sourceDate: src.date,
        targetDate: tgt.date,
        sourceStation: src.station,
        targetStation: tgt.station,
        sourceHead3: src.head3,
        targetTail3: tgt.tail3,
        comparisonType: 'HEAD_TO_TAIL',
        cycleDistance: effectiveCycle,
        dayDistance,
        sourceDayOfWeek: src.dayOfWeek,
        targetDayOfWeek: tgt.dayOfWeek,
        relationType: comparison.relationType,
        relationTypeLabel: comparison.relationTypeLabel,
        similarityScore: comparison.similarityScore,
        alertColor,
        matchDescription: comparison.matchDescription,
        isExactMatch: comparison.isExactMatch,
      };

      relations.push(rel);
    }
  }

  // Aggregate repeated relations: Group by (sourceStation, targetStation, sourceHead3, targetTail3, relationType)
  const groupMap = new Map<string, DrawRelation[]>();
  for (const rel of relations) {
    const key = `${rel.sourceStation}|${rel.targetStation}|${rel.sourceHead3}|${rel.targetTail3}|${rel.relationType}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(rel);
  }

  const repeatedSummaries: RepeatedRelationSummary[] = [];

  groupMap.forEach((occList) => {
    const first = occList[0];
    const repeatCount = occList.length;

    // Cycle stats
    const cycleCounts = new Map<number, number>();
    let cycleSum = 0;
    for (const o of occList) {
      cycleSum += o.cycleDistance;
      cycleCounts.set(o.cycleDistance, (cycleCounts.get(o.cycleDistance) || 0) + 1);
    }
    let mostCommonCycle = first.cycleDistance;
    let maxOcc = 0;
    cycleCounts.forEach((cnt, c) => {
      if (cnt > maxOcc) {
        maxOcc = cnt;
        mostCommonCycle = c;
      }
    });

    const dates = occList.map(o => o.targetDate).sort();
    const latestDate = dates[dates.length - 1];
    const earliestDate = dates[0];

    const alertColor = determineAlertColor(first.isExactMatch, first.similarityScore, repeatCount);

    // Update alert color on individual relations if repeated
    if (repeatCount >= 3) {
      occList.forEach(o => {
        o.alertColor = 'red';
      });
    }

    repeatedSummaries.push({
      id: `${first.sourceStation}->${first.targetStation}:${first.sourceHead3}->${first.targetTail3}`,
      sourceStation: first.sourceStation,
      targetStation: first.targetStation,
      sourceHead3: first.sourceHead3,
      targetTail3: first.targetTail3,
      comparisonType: 'HEAD_TO_TAIL',
      relationType: first.relationType,
      relationLabel: first.relationTypeLabel,
      repeatCount,
      averageCycleDistance: Math.round((cycleSum / repeatCount) * 10) / 10,
      mostCommonCycle,
      latestDate,
      earliestDate,
      alertColor,
      occurrences: occList,
    });
  });

  // Sort summaries by repeatCount descending, then exactMatch first
  repeatedSummaries.sort((a, b) => {
    if (b.repeatCount !== a.repeatCount) return b.repeatCount - a.repeatCount;
    return b.occurrences[0].similarityScore - a.occurrences[0].similarityScore;
  });

  // Build Station Rotation Matrix (Requirement #8)
  const matrix: StationMatrixCell[][] = [];
  for (let r = 0; r < uniqueStations.length; r++) {
    const srcStation = uniqueStations[r];
    const row: StationMatrixCell[] = [];

    for (let c = 0; c < uniqueStations.length; c++) {
      const tgtStation = uniqueStations[c];

      if (srcStation === tgtStation) {
        // Self-loop (e.g. A -> A in next cycle)
        const cellRels = relations.filter(
          rel => rel.sourceStation === srcStation && rel.targetStation === tgtStation
        );
        row.push(createMatrixCell(srcStation, tgtStation, cellRels));
      } else {
        const cellRels = relations.filter(
          rel => rel.sourceStation === srcStation && rel.targetStation === tgtStation
        );
        row.push(createMatrixCell(srcStation, tgtStation, cellRels));
      }
    }
    matrix.push(row);
  }

  // Detect Historic Patterns and Rules (Requirement #9)
  const patterns = mineHistoricPatterns(relations, repeatedSummaries, sorted);

  return {
    allRelations: relations,
    repeatedSummaries,
    matrix,
    stationsList: uniqueStations,
    patterns,
  };
}

function createMatrixCell(
  sourceStation: string,
  targetStation: string,
  cellRels: DrawRelation[]
): StationMatrixCell {
  const totalMatches = cellRels.length;
  const exactMatches = cellRels.filter(r => r.isExactMatch).length;
  const partialMatches = totalMatches - exactMatches;

  const numbersSet = new Set<string>();
  const cycleCountMap = new Map<number, number>();
  let latestDate: string | null = null;

  for (const r of cellRels) {
    if (r.isExactMatch) {
      numbersSet.add(r.sourceHead3);
    }
    cycleCountMap.set(r.cycleDistance, (cycleCountMap.get(r.cycleDistance) || 0) + 1);
    if (!latestDate || r.targetDate > latestDate) {
      latestDate = r.targetDate;
    }
  }

  let mostCommonCycle: number | null = null;
  let maxCycleCnt = 0;
  cycleCountMap.forEach((cnt, cyc) => {
    if (cnt > maxCycleCnt) {
      maxCycleCnt = cnt;
      mostCommonCycle = cyc;
    }
  });

  // Color coding for matrix cell
  let alertColor: AlertColor = 'green';
  if (exactMatches >= 3 || totalMatches >= 6) {
    alertColor = 'red';
  } else if (exactMatches >= 1 || totalMatches >= 3) {
    alertColor = 'orange';
  } else if (totalMatches > 0) {
    alertColor = 'yellow';
  }

  return {
    sourceStation,
    targetStation,
    totalMatches,
    exactMatches,
    partialMatches,
    uniqueNumbers: Array.from(numbersSet),
    mostCommonCycle,
    latestDate,
    alertColor,
    relations: cellRels,
  };
}

/**
 * Mines verified Head -> Tail patterns from historical data
 */
function mineHeadToTailPatterns(
  relations: DrawRelation[],
  summaries: RepeatedRelationSummary[],
  records: LotteryRecord[]
): HistoricPattern[] {
  const patterns: HistoricPattern[] = [];

  // Pattern 1: Cặp đài lặp lại quan hệ cùng 1 bộ 3 số nhiều lần
  const highRepeats = summaries.filter(s => s.repeatCount >= 2 && s.occurrences[0].isExactMatch);
  for (const s of highRepeats) {
    const dates = s.occurrences.map(o => o.targetDate).sort();
    const latestDate = dates[dates.length - 1];

    patterns.push({
      id: `rep-exact-${s.id}`,
      category: 'CHUYEN_DAU_CUOI_LAP',
      categoryLabel: 'Chuyển Đầu → Cuối Lặp Lại',
      patternScope: 'HEAD_TO_TAIL',
      title: `${s.sourceStation} → ${s.targetStation}: Bộ số ${s.sourceHead3} lặp lại ${s.repeatCount} lần`,
      description: `3 số đầu của ${s.sourceStation} (${s.sourceHead3}) đã xuất hiện thành 3 số cuối của ${s.targetStation} chính xác ${s.repeatCount} lần trong lịch sử (khoảng cách phổ biến: ${s.mostCommonCycle} kỳ).`,
      sourceStation: s.sourceStation,
      targetStation: s.targetStation,
      numbersInvolved: [s.sourceHead3],
      repeatCount: s.repeatCount,
      cycleDistance: s.mostCommonCycle,
      latestDate,
      alertColor: s.repeatCount >= 3 ? 'red' : 'orange',
      confidenceType: s.repeatCount >= 3 ? 'TAN_SUAT_CAO' : 'TRUNG_KHOP_THUC_TE',
      confidenceLabel: s.repeatCount >= 3 ? 'Quan hệ tần suất cao' : 'Trùng khớp thực tế',
      evidenceRecords: s.occurrences,
    });
  }

  // Pattern 2: Chu kỳ cố định giữa 2 đài (Ví dụ: Cứ sau K kỳ là có quan hệ Đầu -> Cuối)
  const stationPairCycleMap = new Map<string, DrawRelation[]>();
  for (const rel of relations) {
    if (rel.isExactMatch) {
      const key = `${rel.sourceStation}->${rel.targetStation}@k=${rel.cycleDistance}`;
      if (!stationPairCycleMap.has(key)) {
        stationPairCycleMap.set(key, []);
      }
      stationPairCycleMap.get(key)!.push(rel);
    }
  }

  stationPairCycleMap.forEach((list, key) => {
    if (list.length >= 2) {
      const first = list[0];
      const numbers = Array.from(new Set(list.map(l => l.sourceHead3)));
      const dates = list.map(l => l.targetDate).sort();
      const latestDate = dates[dates.length - 1];

      patterns.push({
        id: `cycle-${key}`,
        category: 'CHU_KY_CO_DINH',
        categoryLabel: 'Lặp lại sau cùng số kỳ',
        patternScope: 'HEAD_TO_TAIL',
        title: `${first.sourceStation} → ${first.targetStation} sau đúng ${first.cycleDistance} kỳ (${list.length} lần)`,
        description: `Ghi nhận ${list.length} trường hợp 3 số đầu của ${first.sourceStation} xuất hiện thành 3 số cuối của ${first.targetStation} sau chính xác ${first.cycleDistance} kỳ quay (các số: ${numbers.join(', ')}).`,
        sourceStation: first.sourceStation,
        targetStation: first.targetStation,
        numbersInvolved: numbers,
        repeatCount: list.length,
        cycleDistance: first.cycleDistance,
        latestDate,
        alertColor: list.length >= 3 ? 'red' : 'orange',
        confidenceType: 'MAU_LAP_LAI',
        confidenceLabel: 'Mẫu lặp theo chu kỳ',
        evidenceRecords: list,
      });
    }
  });

  // Pattern 3: Quan hệ phụ thuộc vào Thứ trong tuần (Ví dụ: Thứ 2 Đài A -> Thứ 4 Đài B)
  const dayRelationMap = new Map<string, DrawRelation[]>();
  for (const rel of relations) {
    if (rel.isExactMatch) {
      const key = `${rel.sourceDayOfWeek}->${rel.targetDayOfWeek}|${rel.sourceStation}->${rel.targetStation}`;
      if (!dayRelationMap.has(key)) {
        dayRelationMap.set(key, []);
      }
      dayRelationMap.get(key)!.push(rel);
    }
  }

  dayRelationMap.forEach((list, key) => {
    if (list.length >= 2) {
      const first = list[0];
      const numbers = Array.from(new Set(list.map(l => l.sourceHead3)));
      const dates = list.map(l => l.targetDate).sort();
      const latestDate = dates[dates.length - 1];

      patterns.push({
        id: `day-${key}`,
        category: 'THU_TRONG_TUAN',
        categoryLabel: 'Mẫu theo Thứ trong tuần',
        patternScope: 'HEAD_TO_TAIL',
        title: `${first.sourceDayOfWeek} (${first.sourceStation}) → ${first.targetDayOfWeek} (${first.targetStation})`,
        description: `Quan hệ Đầu → Cuối giữa ${first.sourceStation} vào ${first.sourceDayOfWeek} và ${first.targetStation} vào ${first.targetDayOfWeek} đã xảy ra ${list.length} lần (bộ số: ${numbers.join(', ')}).`,
        sourceStation: first.sourceStation,
        targetStation: first.targetStation,
        numbersInvolved: numbers,
        repeatCount: list.length,
        cycleDistance: first.cycleDistance,
        dayOfWeek: first.sourceDayOfWeek,
        latestDate,
        alertColor: list.length >= 3 ? 'red' : 'orange',
        confidenceType: 'MAU_LAP_LAI',
        confidenceLabel: 'Mẫu lặp theo thứ',
        evidenceRecords: list,
      });
    }
  });

  // Pattern 4: Một bộ số lan tỏa qua nhiều đài (xuất hiện ở >= 3 đài khác nhau)
  const numberStationCount = new Map<string, { heads: Set<string>; tails: Set<string>; records: LotteryRecord[] }>();
  for (const rec of records) {
    if (!numberStationCount.has(rec.head3)) {
      numberStationCount.set(rec.head3, { heads: new Set(), tails: new Set(), records: [] });
    }
    numberStationCount.get(rec.head3)!.heads.add(rec.station);
    numberStationCount.get(rec.head3)!.records.push(rec);

    if (!numberStationCount.has(rec.tail3)) {
      numberStationCount.set(rec.tail3, { heads: new Set(), tails: new Set(), records: [] });
    }
    numberStationCount.get(rec.tail3)!.tails.add(rec.station);
    numberStationCount.get(rec.tail3)!.records.push(rec);
  }

  numberStationCount.forEach((data, num) => {
    const totalDistinctStations = new Set([...data.heads, ...data.tails]).size;
    if (totalDistinctStations >= 3 && data.heads.size >= 1 && data.tails.size >= 1) {
      const numRels = relations.filter(r => r.isExactMatch && r.sourceHead3 === num);
      if (numRels.length >= 2) {
        patterns.push({
          id: `spread-${num}`,
          category: 'BO_SO_LAN_TOA',
          categoryLabel: 'Bộ số lan tỏa nhiều đài',
          patternScope: 'HEAD_TO_TAIL',
          title: `Bộ 3 số [${num}] xuất hiện trên ${totalDistinctStations} đài khác nhau`,
          description: `Bộ số ${num} vừa xuất hiện ở đầu giải (${Array.from(data.heads).join(', ')}) vừa xuất hiện ở đuôi giải (${Array.from(data.tails).join(', ')}) với ${numRels.length} lần kết nối đầu → cuối.`,
          sourceStation: Array.from(data.heads)[0] || 'Nhiều đài',
          targetStation: Array.from(data.tails)[0] || 'Nhiều đài',
          numbersInvolved: [num],
          repeatCount: numRels.length,
          cycleDistance: 'Nhiều kỳ',
          latestDate: data.records[data.records.length - 1]?.date || '',
          alertColor: numRels.length >= 3 ? 'red' : 'orange',
          confidenceType: 'TAN_SUAT_CAO',
          confidenceLabel: 'Lan tỏa diện rộng',
          evidenceRecords: numRels,
        });
      }
    }
  });

  // Enrich Head-to-Tail patterns with estimated draw dates
  for (const p of patterns) {
    const targetDow = p.category === 'THU_TRONG_TUAN' && p.evidenceRecords.length > 0
      ? p.evidenceRecords[0].targetDayOfWeek
      : undefined;

    p.estimatedDrawDate = calculateEstimatedDrawDateForPattern(
      p.sourceStation,
      p.targetStation,
      p.cycleDistance,
      p.evidenceRecords,
      records,
      targetDow
    );
  }

  return patterns;
}

/**
 * Mines verified 3-Tail patterns between stations (Quy luật 3 số cuối giữa các đài: Đuôi -> Đuôi)
 */
function mineTailHistoricPatterns(
  tailRelations: DrawRelation[],
  repeatedSummaries: RepeatedRelationSummary[],
  records: LotteryRecord[]
): HistoricPattern[] {
  const patterns: HistoricPattern[] = [];

  // Pattern T1: Lặp lại 3 số cuối giữa 2 đài (Đuôi -> Đuôi)
  const exactRepeats = repeatedSummaries.filter(s => s.repeatCount >= 2 && s.occurrences[0].isExactMatch);
  for (const s of exactRepeats) {
    const dates = s.occurrences.map(o => o.targetDate).sort();
    const latestDate = dates[dates.length - 1];
    const tailNum = s.sourceTail3 || s.sourceHead3;

    patterns.push({
      id: `tail-rep-exact-${s.id}`,
      category: 'CHUYEN_CUOI_CUOI_LAP',
      categoryLabel: '3 Số Cuối Lặp Lại (Đuôi → Đuôi)',
      patternScope: 'TAIL_TO_TAIL',
      title: `${s.sourceStation} (Đuôi) → ${s.targetStation} (Đuôi): Bộ số ${tailNum} lặp ${s.repeatCount} lần`,
      description: `3 số cuối của đài ${s.sourceStation} (${tailNum}) đã xuất hiện lại thành 3 số cuối của ${s.targetStation} chính xác ${s.repeatCount} lần trong lịch sử (chu kỳ phổ biến: ${s.mostCommonCycle} kỳ).`,
      sourceStation: s.sourceStation,
      targetStation: s.targetStation,
      numbersInvolved: [tailNum],
      repeatCount: s.repeatCount,
      cycleDistance: s.mostCommonCycle,
      latestDate,
      alertColor: s.repeatCount >= 3 ? 'red' : 'orange',
      confidenceType: s.repeatCount >= 3 ? 'TAN_SUAT_CAO' : 'TRUNG_KHOP_THUC_TE',
      confidenceLabel: s.repeatCount >= 3 ? 'Quan hệ đuôi tần suất cao' : 'Trùng khớp 3 số cuối thực tế',
      evidenceRecords: s.occurrences,
    });
  }

  // Pattern T2: Chu kỳ cố định 3 số cuối giữa 2 đài
  const tailCycleMap = new Map<string, DrawRelation[]>();
  for (const rel of tailRelations) {
    if (rel.isExactMatch) {
      const key = `${rel.sourceStation}->${rel.targetStation}@k=${rel.cycleDistance}`;
      if (!tailCycleMap.has(key)) {
        tailCycleMap.set(key, []);
      }
      tailCycleMap.get(key)!.push(rel);
    }
  }

  tailCycleMap.forEach((list, key) => {
    if (list.length >= 2) {
      const first = list[0];
      const numbers = Array.from(new Set(list.map(l => l.sourceTail3 || l.sourceHead3)));
      const dates = list.map(l => l.targetDate).sort();
      const latestDate = dates[dates.length - 1];

      patterns.push({
        id: `tail-cycle-${key}`,
        category: 'CHU_KY_3_SO_CUOI',
        categoryLabel: 'Chu Kỳ Cố Định 3 Số Cuối',
        patternScope: 'TAIL_TO_TAIL',
        title: `Chu kỳ đuôi: ${first.sourceStation} → ${first.targetStation} sau đúng ${first.cycleDistance} kỳ (${list.length} lần)`,
        description: `Ghi nhận ${list.length} lần 3 số cuối của ${first.sourceStation} xuất hiện lại ở 3 số cuối của ${first.targetStation} sau chính xác ${first.cycleDistance} kỳ quay (các bộ 3 số cuối: ${numbers.join(', ')}).`,
        sourceStation: first.sourceStation,
        targetStation: first.targetStation,
        numbersInvolved: numbers,
        repeatCount: list.length,
        cycleDistance: first.cycleDistance,
        latestDate,
        alertColor: list.length >= 3 ? 'red' : 'orange',
        confidenceType: 'MAU_LAP_LAI',
        confidenceLabel: 'Chu kỳ lặp 3 số cuối',
        evidenceRecords: list,
      });
    }
  });

  // Pattern T3: 3 số cuối theo Thứ trong tuần
  const tailDayMap = new Map<string, DrawRelation[]>();
  for (const rel of tailRelations) {
    if (rel.isExactMatch) {
      const key = `${rel.sourceDayOfWeek}->${rel.targetDayOfWeek}|${rel.sourceStation}->${rel.targetStation}`;
      if (!tailDayMap.has(key)) {
        tailDayMap.set(key, []);
      }
      tailDayMap.get(key)!.push(rel);
    }
  }

  tailDayMap.forEach((list, key) => {
    if (list.length >= 2) {
      const first = list[0];
      const numbers = Array.from(new Set(list.map(l => l.sourceTail3 || l.sourceHead3)));
      const dates = list.map(l => l.targetDate).sort();
      const latestDate = dates[dates.length - 1];

      patterns.push({
        id: `tail-day-${key}`,
        category: 'THU_3_SO_CUOI',
        categoryLabel: '3 Số Cuối Theo Thứ',
        patternScope: 'TAIL_TO_TAIL',
        title: `3 số cuối: ${first.sourceDayOfWeek} (${first.sourceStation}) → ${first.targetDayOfWeek} (${first.targetStation})`,
        description: `Quy luật chuyền 3 số cuối giữa ${first.sourceStation} (${first.sourceDayOfWeek}) và ${first.targetStation} (${first.targetDayOfWeek}) đã xảy ra ${list.length} lần (các số: ${numbers.join(', ')}).`,
        sourceStation: first.sourceStation,
        targetStation: first.targetStation,
        numbersInvolved: numbers,
        repeatCount: list.length,
        cycleDistance: first.cycleDistance,
        dayOfWeek: first.sourceDayOfWeek,
        latestDate,
        alertColor: list.length >= 3 ? 'red' : 'orange',
        confidenceType: 'MAU_LAP_LAI',
        confidenceLabel: 'Quy luật đuôi theo thứ',
        evidenceRecords: list,
      });
    }
  });

  // Pattern T4: Bộ 3 số cuối lan toả nhiều đài
  const tailStationCount = new Map<string, { stations: Set<string>; records: LotteryRecord[] }>();
  for (const rec of records) {
    if (!tailStationCount.has(rec.tail3)) {
      tailStationCount.set(rec.tail3, { stations: new Set(), records: [] });
    }
    tailStationCount.get(rec.tail3)!.stations.add(rec.station);
    tailStationCount.get(rec.tail3)!.records.push(rec);
  }

  tailStationCount.forEach((data, num) => {
    if (data.stations.size >= 3) {
      const numRels = tailRelations.filter(r => r.isExactMatch && (r.sourceTail3 === num || r.sourceHead3 === num));
      if (numRels.length >= 2) {
        patterns.push({
          id: `tail-spread-${num}`,
          category: 'LAN_TOA_3_SO_CUOI',
          categoryLabel: '3 Số Cuối Lan Tỏa Nhiều Đài',
          patternScope: 'TAIL_TO_TAIL',
          title: `Bộ 3 số cuối [${num}] nổ ở ${data.stations.size} đài XSMN khác nhau`,
          description: `Bộ 3 số cuối ${num} đã nổ ở đuôi giải của các đài: ${Array.from(data.stations).join(', ')} với ${numRels.length} lượt chuyền đuôi ghi nhận trong dữ liệu.`,
          sourceStation: Array.from(data.stations)[0] || 'Nhiều đài',
          targetStation: Array.from(data.stations)[1] || 'Nhiều đài',
          numbersInvolved: [num],
          repeatCount: numRels.length,
          cycleDistance: 'Nhiều kỳ',
          latestDate: data.records[data.records.length - 1]?.date || '',
          alertColor: numRels.length >= 3 ? 'red' : 'orange',
          confidenceType: 'TAN_SUAT_CAO',
          confidenceLabel: 'Đuôi lan tỏa diện rộng',
          evidenceRecords: numRels,
        });
      }
    }
  });

  // Pattern T5: Cặp đài có duyên chuyển 3 số cuối cao nhất
  const stationPairTotalMap = new Map<string, DrawRelation[]>();
  for (const rel of tailRelations) {
    const key = `${rel.sourceStation}->${rel.targetStation}`;
    if (!stationPairTotalMap.has(key)) {
      stationPairTotalMap.set(key, []);
    }
    stationPairTotalMap.get(key)!.push(rel);
  }

  stationPairTotalMap.forEach((list, key) => {
    const exactList = list.filter(r => r.isExactMatch);
    if (list.length >= 3 && exactList.length >= 1) {
      const first = list[0];
      const numbers = Array.from(new Set(list.map(l => l.sourceTail3 || l.sourceHead3)));
      const dates = list.map(l => l.targetDate).sort();
      const latestDate = dates[dates.length - 1];

      patterns.push({
        id: `tail-affinity-${key}`,
        category: 'QUY_LUAT_3_SO_CUOI',
        categoryLabel: 'Quy Luật 3 Số Cuối Giữa Các Đài',
        patternScope: 'TAIL_TO_TAIL',
        title: `Quy luật đuôi: ${first.sourceStation} ➔ ${first.targetStation} (${list.length} lần chuyển đuôi)`,
        description: `Đài ${first.sourceStation} có mối liên kết đuôi rất mạnh với ${first.targetStation}: ghi nhận ${list.length} lần chuyển dịch 3 số cuối (gồm ${exactList.length} lần trùng khớp 100% và ${list.length - exactList.length} lần đảo/hoán vị).`,
        sourceStation: first.sourceStation,
        targetStation: first.targetStation,
        numbersInvolved: numbers.slice(0, 5),
        repeatCount: list.length,
        cycleDistance: first.cycleDistance,
        latestDate,
        alertColor: exactList.length >= 2 ? 'red' : 'orange',
        confidenceType: 'TAN_SUAT_CAO',
        confidenceLabel: 'Cặp đài duyên đuôi cao',
        evidenceRecords: list,
      });
    }
  });

  // Enrich all tail patterns with estimatedDrawDate
  for (const p of patterns) {
    const targetDow = (p.category === 'THU_3_SO_CUOI' || p.category === 'THU_TRONG_TUAN') && p.evidenceRecords.length > 0
      ? p.evidenceRecords[0].targetDayOfWeek
      : undefined;

    p.estimatedDrawDate = calculateEstimatedDrawDateForPattern(
      p.sourceStation,
      p.targetStation,
      p.cycleDistance,
      p.evidenceRecords,
      records,
      targetDow
    );
  }

  return patterns;
}

/**
 * Core engine for Tail -> Tail (3 số cuối giữa các đài) analysis across chronological draws
 */
export function analyzeTailToTailRelations(
  records: LotteryRecord[],
  filters: AnalysisFilterOptions = {}
): {
  allRelations: DrawRelation[];
  repeatedSummaries: RepeatedRelationSummary[];
  matrix: StationMatrixCell[][];
  stationsList: string[];
  patterns: HistoricPattern[];
  overview: TailPatternOverview;
} {
  if (records.length < 2) {
    return {
      allRelations: [],
      repeatedSummaries: [],
      matrix: [],
      stationsList: [],
      patterns: [],
      overview: {
        totalRelations: 0,
        exactMatchesCount: 0,
        permuteMatchesCount: 0,
        reverseMatchesCount: 0,
        topStationPairs: [],
        hotTailNumbers: [],
      },
    };
  }

  // Sort chronologically ascending
  const sorted = [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sessionIndex - b.sessionIndex;
  });

  const uniqueStations = Array.from(new Set(sorted.map(r => r.station))).sort();

  const dateMap = new Map<string, number>();
  const uniqueDates = Array.from(new Set(sorted.map(r => r.date))).sort();
  uniqueDates.forEach((d, idx) => dateMap.set(d, idx));

  const relations: DrawRelation[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const src = sorted[i];
    const srcDateIdx = dateMap.get(src.date) ?? 0;

    for (let j = i + 1; j < sorted.length; j++) {
      const tgt = sorted[j];
      if (src.id === tgt.id) continue;
      if (tgt.date < src.date) continue;

      const tgtDateIdx = dateMap.get(tgt.date) ?? 0;
      const cycleDistance = tgtDateIdx - srcDateIdx;
      const effectiveCycle = cycleDistance === 0 ? 0 : cycleDistance;

      if (filters.maxCycle !== undefined && effectiveCycle > filters.maxCycle) continue;
      if (filters.minCycle !== undefined && effectiveCycle < filters.minCycle) continue;

      if (filters.sourceStation && filters.sourceStation !== 'ALL' && src.station !== filters.sourceStation) continue;
      if (filters.targetStation && filters.targetStation !== 'ALL' && tgt.station !== filters.targetStation) continue;

      if (filters.sourceDays && filters.sourceDays.length > 0 && !filters.sourceDays.includes(src.dayOfWeek)) continue;
      if (filters.targetDays && filters.targetDays.length > 0 && !filters.targetDays.includes(tgt.dayOfWeek)) continue;

      // CORE COMPARISON: 3 số cuối của Đài A (src.tail3) -> 3 số cuối của Đài B (tgt.tail3)
      const comparison = compareDigits(src.tail3, tgt.tail3);

      if (filters.minSimilarity !== undefined && comparison.similarityScore < filters.minSimilarity) continue;
      if (filters.exactOnly && !comparison.isExactMatch) continue;
      if (filters.relationTypes && filters.relationTypes.length > 0 && !filters.relationTypes.includes(comparison.relationType)) continue;

      if (filters.searchNumber && filters.searchNumber.trim() !== '') {
        const q = filters.searchNumber.trim();
        if (!src.tail3.includes(q) && !tgt.tail3.includes(q)) continue;
      }

      // Filter out noisy weak matches for general overview if not filtered
      if (comparison.similarityScore < 40 && !comparison.isExactMatch) continue;

      const dayDistance = getDayDifference(src.date, tgt.date);
      const alertColor = determineAlertColor(comparison.isExactMatch, comparison.similarityScore, 1);

      const rel: DrawRelation = {
        id: `tail-${src.id}->${tgt.id}`,
        sourceRecord: src,
        targetRecord: tgt,
        sourceDate: src.date,
        targetDate: tgt.date,
        sourceStation: src.station,
        targetStation: tgt.station,
        sourceHead3: src.tail3, // compatibility
        sourceTail3: src.tail3,
        targetTail3: tgt.tail3,
        comparisonType: 'TAIL_TO_TAIL',
        cycleDistance: effectiveCycle,
        dayDistance,
        sourceDayOfWeek: src.dayOfWeek,
        targetDayOfWeek: tgt.dayOfWeek,
        relationType: comparison.relationType,
        relationTypeLabel: comparison.relationTypeLabel,
        similarityScore: comparison.similarityScore,
        alertColor,
        matchDescription: `3 số cuối ${src.station} (${src.tail3}) ${comparison.matchDescription.toLowerCase()} 3 số cuối ${tgt.station} (${tgt.tail3})`,
        isExactMatch: comparison.isExactMatch,
      };

      relations.push(rel);
    }
  }

  // Aggregate repeated relations for tail-to-tail
  const groupMap = new Map<string, DrawRelation[]>();
  for (const rel of relations) {
    const key = `${rel.sourceStation}|${rel.targetStation}|${rel.sourceTail3}|${rel.targetTail3}|${rel.relationType}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(rel);
  }

  const repeatedSummaries: RepeatedRelationSummary[] = [];
  groupMap.forEach((occList) => {
    const first = occList[0];
    const repeatCount = occList.length;

    const cycleCounts = new Map<number, number>();
    let cycleSum = 0;
    for (const o of occList) {
      cycleSum += o.cycleDistance;
      cycleCounts.set(o.cycleDistance, (cycleCounts.get(o.cycleDistance) || 0) + 1);
    }
    let mostCommonCycle = first.cycleDistance;
    let maxOcc = 0;
    cycleCounts.forEach((cnt, c) => {
      if (cnt > maxOcc) {
        maxOcc = cnt;
        mostCommonCycle = c;
      }
    });

    const dates = occList.map(o => o.targetDate).sort();
    const latestDate = dates[dates.length - 1];
    const earliestDate = dates[0];
    const alertColor = determineAlertColor(first.isExactMatch, first.similarityScore, repeatCount);

    if (repeatCount >= 3) {
      occList.forEach(o => {
        o.alertColor = 'red';
      });
    }

    repeatedSummaries.push({
      id: `tail:${first.sourceStation}->${first.targetStation}:${first.sourceTail3}->${first.targetTail3}`,
      sourceStation: first.sourceStation,
      targetStation: first.targetStation,
      sourceHead3: first.sourceHead3,
      sourceTail3: first.sourceTail3,
      targetTail3: first.targetTail3,
      comparisonType: 'TAIL_TO_TAIL',
      relationType: first.relationType,
      relationLabel: first.relationTypeLabel,
      repeatCount,
      averageCycleDistance: Math.round((cycleSum / repeatCount) * 10) / 10,
      mostCommonCycle,
      latestDate,
      earliestDate,
      alertColor,
      occurrences: occList,
    });
  });

  repeatedSummaries.sort((a, b) => {
    if (b.repeatCount !== a.repeatCount) return b.repeatCount - a.repeatCount;
    return b.occurrences[0].similarityScore - a.occurrences[0].similarityScore;
  });

  // Build Tail Rotation Matrix
  const matrix: StationMatrixCell[][] = [];
  for (let r = 0; r < uniqueStations.length; r++) {
    const srcStation = uniqueStations[r];
    const row: StationMatrixCell[] = [];
    for (let c = 0; c < uniqueStations.length; c++) {
      const tgtStation = uniqueStations[c];
      const cellRels = relations.filter(
        rel => rel.sourceStation === srcStation && rel.targetStation === tgtStation
      );
      row.push(createMatrixCell(srcStation, tgtStation, cellRels));
    }
    matrix.push(row);
  }

  // Mine Tail Patterns specifically
  const patterns = mineTailHistoricPatterns(relations, repeatedSummaries, sorted);
  patterns.sort((a, b) => b.repeatCount - a.repeatCount);

  // Build Overview Stats
  let exactMatchesCount = 0;
  let permuteMatchesCount = 0;
  let reverseMatchesCount = 0;

  for (const r of relations) {
    if (r.relationType === 'TRUNG_3_3' || r.isExactMatch) {
      exactMatchesCount++;
    } else if (r.relationType === 'DAO_NGUOC') {
      reverseMatchesCount++;
      permuteMatchesCount++;
    } else if (r.relationType === 'HOAN_VI') {
      permuteMatchesCount++;
    }
  }

  // Top Station Pairs
  const stationPairTotalMap = new Map<string, DrawRelation[]>();
  for (const rel of relations) {
    const key = `${rel.sourceStation}->${rel.targetStation}`;
    if (!stationPairTotalMap.has(key)) {
      stationPairTotalMap.set(key, []);
    }
    stationPairTotalMap.get(key)!.push(rel);
  }

  const topStationPairs: TailPatternOverview['topStationPairs'] = [];
  stationPairTotalMap.forEach((pairRels, pairKey) => {
    const [src, tgt] = pairKey.split('->');
    const exactMatches = pairRels.filter(r => r.isExactMatch).length;
    const numCounts = new Map<string, number>();
    pairRels.forEach(r => {
      const num = r.sourceTail3 || r.sourceHead3;
      numCounts.set(num, (numCounts.get(num) || 0) + 1);
    });
    let mostCommonNumber = '';
    let maxNumCnt = 0;
    numCounts.forEach((c, n) => {
      if (c > maxNumCnt) {
        maxNumCnt = c;
        mostCommonNumber = n;
      }
    });

    topStationPairs.push({
      sourceStation: src,
      targetStation: tgt,
      totalMatches: pairRels.length,
      exactMatches,
      mostCommonNumber,
      mostCommonCycle: pairRels[0].cycleDistance,
      relations: pairRels,
    });
  });

  topStationPairs.sort((a, b) => {
    if (b.exactMatches !== a.exactMatches) return b.exactMatches - a.exactMatches;
    return b.totalMatches - a.totalMatches;
  });

  // Hot Tail Numbers
  const tailStationCount = new Map<string, { stations: Set<string>; records: LotteryRecord[] }>();
  for (const rec of sorted) {
    if (!tailStationCount.has(rec.tail3)) {
      tailStationCount.set(rec.tail3, { stations: new Set(), records: [] });
    }
    tailStationCount.get(rec.tail3)!.stations.add(rec.station);
    tailStationCount.get(rec.tail3)!.records.push(rec);
  }

  const hotTailNumbers: TailPatternOverview['hotTailNumbers'] = [];
  tailStationCount.forEach((val, num) => {
    const rels = relations.filter(r => (r.sourceTail3 === num || r.targetTail3 === num));
    hotTailNumbers.push({
      number: num,
      totalOccurrences: val.records.length,
      stations: Array.from(val.stations),
      dates: val.records.map(r => r.date),
      relations: rels,
    });
  });

  hotTailNumbers.sort((a, b) => b.totalOccurrences - a.totalOccurrences);

  const overview: TailPatternOverview = {
    totalRelations: relations.length,
    exactMatchesCount,
    permuteMatchesCount,
    reverseMatchesCount,
    topStationPairs: topStationPairs.slice(0, 10),
    hotTailNumbers: hotTailNumbers.slice(0, 10),
  };

  return {
    allRelations: relations,
    repeatedSummaries,
    matrix,
    stationsList: uniqueStations,
    patterns,
    overview,
  };
}

/**
 * Mines verified patterns from historical data (both Head -> Tail and Tail -> Tail between stations)
 * (Requirement #9 & #15)
 */
function mineHistoricPatterns(
  relations: DrawRelation[],
  summaries: RepeatedRelationSummary[],
  records: LotteryRecord[]
): HistoricPattern[] {
  // 1. Mine Head -> Tail patterns
  const headPatterns = mineHeadToTailPatterns(relations, summaries, records);

  // 2. Mine Tail -> Tail patterns (Quy luật 3 số cuối giữa các đài)
  let tailPatterns: HistoricPattern[] = [];
  try {
    const tailResults = analyzeTailToTailRelations(records);
    tailPatterns = tailResults.patterns;
  } catch (err) {
    console.error('Error mining tail patterns:', err);
  }

  // 3. Combine and sort all patterns by repeatCount descending
  const allPatterns = [...headPatterns, ...tailPatterns];
  allPatterns.sort((a, b) => b.repeatCount - a.repeatCount);

  return allPatterns;
}

/**
 * Predicts / suggests pattern follow-up leads based on the latest draws and verified history
 * Strictly follows Requirement #12:
 * "KHÔNG được khẳng định kết quả tương lai. Chỉ đưa ra các quan hệ lịch sử đáng chú ý có thể tiếp tục theo dõi."
 */
export function generatePatternTrackingLeads(
  records: LotteryRecord[],
  summaries: RepeatedRelationSummary[],
  patterns: HistoricPattern[]
): PatternPredictionLead[] {
  if (records.length < 2) return [];

  // Sort records descending to get recent draws
  const sortedDesc = [...records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.sessionIndex - a.sessionIndex;
  });

  // Take recent records from the latest sessions (up to 30 records, covering full weekly cycles across all XSMN stations)
  const recentRecords = sortedDesc.slice(0, 30);
  const leads: PatternPredictionLead[] = [];

  for (const rec of recentRecords) {
    // 1. Check if rec.head3 has any verified historical repeats with target stations
    const matchingSummaries = summaries.filter(
      s => s.sourceStation === rec.station && s.sourceHead3 === rec.head3
    );

    for (let sIdx = 0; sIdx < matchingSummaries.length; sIdx++) {
      const s = matchingSummaries[sIdx];
      const breakdown = calculateSimilarityBreakdown(rec.head3, s.targetTail3);
      const targetScheduledDays = getScheduledDaysForStation(s.targetStation);
      const primaryTargetDay = targetScheduledDays[0] || rec.dayOfWeek;
      
      let alertColor: AlertColor = 'yellow';
      if (breakdown.score === 100 || s.repeatCount >= 3) {
        alertColor = 'red';
      } else if (breakdown.score >= 75 || s.repeatCount >= 2) {
        alertColor = 'orange';
      }

      leads.push({
        id: `lead-${rec.id}-${s.targetStation}-${s.targetTail3}-${s.relationType}-${sIdx}`,
        latestRecord: rec,
        suggestedStation: s.targetStation,
        projectedTail3: s.targetTail3,
        relationType: s.relationType,
        relationTypeLabel: breakdown.tierLabel,
        similarityScore: breakdown.score,
        similarityBreakdown: breakdown,
        expectedCycle: s.mostCommonCycle,
        historicOccurrencesCount: s.repeatCount,
        lastHistoricMatchDate: s.latestDate,
        alertColor,
        reasoning: `Đài ${rec.station} ngày ${rec.dateDisplay} (${rec.dayOfWeek}) có 3 số đầu [${rec.head3}]. Trong lịch sử, số này từng chuyển thành 3 số cuối [${s.targetTail3}] của đài ${s.targetStation} (mở thưởng ${targetScheduledDays.join(', ')}) ${s.repeatCount} lần với mức tương đồng ${breakdown.score}% (${breakdown.tierLabel}), khoảng cách chu kỳ phổ biến là +${s.mostCommonCycle} kỳ.`,
        evidence: s.occurrences,
        targetScheduledDays,
        primaryTargetDay,
      });
    }

    // 2. High-similarity historical summaries (e.g. đảo 3 số, hoán vị, hoặc trùng 2/3 số từ đài nguồn sang đài đích)
    const highSimilaritySummaries = summaries.filter(s => {
      if (s.sourceStation !== rec.station) return false;
      if (s.sourceHead3 === rec.head3) return false; // Already processed above
      const sim = compareDigits(rec.head3, s.targetTail3);
      return sim.similarityScore >= 67 && s.repeatCount >= 2;
    });

    for (let hIdx = 0; hIdx < highSimilaritySummaries.length; hIdx++) {
      const s = highSimilaritySummaries[hIdx];
      const breakdown = calculateSimilarityBreakdown(rec.head3, s.targetTail3);
      const targetScheduledDays = getScheduledDaysForStation(s.targetStation);
      const primaryTargetDay = targetScheduledDays[0] || rec.dayOfWeek;
      
      let alertColor: AlertColor = 'yellow';
      if (breakdown.score === 100 || s.repeatCount >= 3) {
        alertColor = 'red';
      } else if (breakdown.score >= 75) {
        alertColor = 'orange';
      }

      leads.push({
        id: `lead-sim-${rec.id}-${s.targetStation}-${s.targetTail3}-${hIdx}`,
        latestRecord: rec,
        suggestedStation: s.targetStation,
        projectedTail3: s.targetTail3,
        relationType: s.relationType,
        relationTypeLabel: breakdown.tierLabel,
        similarityScore: breakdown.score,
        similarityBreakdown: breakdown,
        expectedCycle: s.mostCommonCycle,
        historicOccurrencesCount: s.repeatCount,
        lastHistoricMatchDate: s.latestDate,
        alertColor,
        reasoning: `Đài ${rec.station} ngày ${rec.dateDisplay} (${rec.dayOfWeek}) có 3 số đầu [${rec.head3}]. Đối chiếu với đài ${s.targetStation} (mở thưởng ${targetScheduledDays.join(', ')}) từng có chuỗi đuôi [${s.targetTail3}] tương đồng ${breakdown.score}% (${breakdown.tierLabel}) lặp lại ${s.repeatCount} lần trong lịch sử sau chu kỳ +${s.mostCommonCycle} kỳ.`,
        evidence: s.occurrences,
        targetScheduledDays,
        primaryTargetDay,
      });
    }

    // 3. Check if station pair has a strong cycle rule
    const pairPatterns = patterns.filter(
      p => p.sourceStation === rec.station && p.repeatCount >= 2
    );

    for (let pIdx = 0; pIdx < pairPatterns.length; pIdx++) {
      const p = pairPatterns[pIdx];
      const targetTail = rec.head3;
      const exists = leads.some(
        l => l.latestRecord.id === rec.id && l.suggestedStation === p.targetStation && l.projectedTail3 === targetTail
      );

      if (!exists && typeof p.cycleDistance === 'number') {
        const breakdown = calculateSimilarityBreakdown(rec.head3, targetTail);
        const targetScheduledDays = getScheduledDaysForStation(p.targetStation);
        const primaryTargetDay = targetScheduledDays[0] || rec.dayOfWeek;
        const alertColor: AlertColor = p.repeatCount >= 3 ? 'red' : 'orange';

        leads.push({
          id: `lead-pair-${rec.id}-${p.targetStation}-${targetTail}-${pIdx}`,
          latestRecord: rec,
          suggestedStation: p.targetStation,
          projectedTail3: targetTail,
          relationType: 'TRUNG_3_3',
          relationTypeLabel: breakdown.tierLabel,
          similarityScore: breakdown.score,
          similarityBreakdown: breakdown,
          expectedCycle: p.cycleDistance,
          historicOccurrencesCount: p.repeatCount,
          lastHistoricMatchDate: p.latestDate,
          alertColor,
          reasoning: `Theo quy luật chu kỳ lịch sử: Quan hệ dịch chuyển Đầu → Cuối giữa ${rec.station} → ${p.targetStation} (mở thưởng ${targetScheduledDays.join(', ')}) đã từng lặp lại ${p.repeatCount} lần sau đúng +${p.cycleDistance} kỳ. Đầu kỳ này của ${rec.station} là [${rec.head3}] (Mức tương đồng: ${breakdown.score}%).`,
          evidence: p.evidenceRecords,
          targetScheduledDays,
          primaryTargetDay,
        });
      }
    }
  }

  // Deduplicate by source, target, projected tail, and relation
  const uniqueLeadsMap = new Map<string, PatternPredictionLead>();
  for (const lead of leads) {
    const key = `${lead.latestRecord.id}-${lead.suggestedStation}-${lead.projectedTail3}-${lead.relationType}`;
    if (!uniqueLeadsMap.has(key)) {
      uniqueLeadsMap.set(key, lead);
    }
  }

  // Sort primarily by similarity score descending, then by historic occurrences count descending
  const sortedLeads = Array.from(uniqueLeadsMap.values()).sort((a, b) => {
    if (b.similarityScore !== a.similarityScore) {
      return b.similarityScore - a.similarityScore;
    }
    return b.historicOccurrencesCount - a.historicOccurrencesCount;
  });

  // Assign distinct, 100% unique IDs across the result set
  return sortedLeads.map((lead, idx) => ({
    ...lead,
    id: `lead-unique-${lead.latestRecord.id}-${lead.suggestedStation}-${lead.projectedTail3}-${lead.relationType}-${idx}`
  }));
}

/**
 * Standard Southern Vietnam Lottery (XSMN) drawing schedule by Day of Week
 */
export const XSMN_WEEKDAY_SCHEDULE: Record<DayOfWeek, string[]> = {
  'Thứ 2': ['TP.HCM', 'Đồng Tháp', 'Cà Mau'],
  'Thứ 3': ['Bến Tre', 'Vũng Tàu', 'Bạc Liêu'],
  'Thứ 4': ['Đồng Nai', 'Cần Thơ', 'Sóc Trăng'],
  'Thứ 5': ['Tây Ninh', 'An Giang', 'Bình Thuận'],
  'Thứ 6': ['Vĩnh Long', 'Bình Dương', 'Trà Vinh'],
  'Thứ 7': ['TP.HCM', 'Long An', 'Bình Phước', 'Hậu Giang'],
  'Chủ nhật': ['Tiền Giang', 'Kiên Giang', 'Đà Lạt'],
};

/**
 * 21 official stations in Southern Vietnam Lottery (XSMN) and their drawing day(s) of week
 */
export const ALL_XSMN_STATIONS: { name: string; days: DayOfWeek[] }[] = [
  { name: 'TP.HCM', days: ['Thứ 2', 'Thứ 7'] },
  { name: 'Đồng Tháp', days: ['Thứ 2'] },
  { name: 'Cà Mau', days: ['Thứ 2'] },
  { name: 'Bến Tre', days: ['Thứ 3'] },
  { name: 'Vũng Tàu', days: ['Thứ 3'] },
  { name: 'Bạc Liêu', days: ['Thứ 3'] },
  { name: 'Đồng Nai', days: ['Thứ 4'] },
  { name: 'Cần Thơ', days: ['Thứ 4'] },
  { name: 'Sóc Trăng', days: ['Thứ 4'] },
  { name: 'Tây Ninh', days: ['Thứ 5'] },
  { name: 'An Giang', days: ['Thứ 5'] },
  { name: 'Bình Thuận', days: ['Thứ 5'] },
  { name: 'Vĩnh Long', days: ['Thứ 6'] },
  { name: 'Bình Dương', days: ['Thứ 6'] },
  { name: 'Trà Vinh', days: ['Thứ 6'] },
  { name: 'Long An', days: ['Thứ 7'] },
  { name: 'Bình Phước', days: ['Thứ 7'] },
  { name: 'Hậu Giang', days: ['Thứ 7'] },
  { name: 'Tiền Giang', days: ['Chủ nhật'] },
  { name: 'Kiên Giang', days: ['Chủ nhật'] },
  { name: 'Đà Lạt', days: ['Chủ nhật'] },
];

/**
 * Normalizes station names against standard XSMN naming conventions (e.g. TPHCM -> TP.HCM, Lâm Đồng -> Đà Lạt)
 */
export function normalizeStationName(st: string): string {
  if (!st) return '';
  const s = st.trim().toLowerCase();
  if (s.includes('hồ chí minh') || s.includes('hcm') || s === 'tp.hcm' || s === 'tphcm' || s === 'tp hcm') return 'TP.HCM';
  if (s.includes('đà lạt') || s.includes('da lat') || s.includes('lâm đồng') || s.includes('lam dong')) return 'Đà Lạt';
  if (s.includes('đồng tháp') || s.includes('dong thap')) return 'Đồng Tháp';
  if (s.includes('cà mau') || s.includes('ca mau')) return 'Cà Mau';
  if (s.includes('bến tre') || s.includes('ben tre')) return 'Bến Tre';
  if (s.includes('vũng tàu') || s.includes('vung tau')) return 'Vũng Tàu';
  if (s.includes('bạc liêu') || s.includes('bac lieu')) return 'Bạc Liêu';
  if (s.includes('đồng nai') || s.includes('dong nai')) return 'Đồng Nai';
  if (s.includes('cần thơ') || s.includes('can tho')) return 'Cần Thơ';
  if (s.includes('sóc trăng') || s.includes('soc trang')) return 'Sóc Trăng';
  if (s.includes('tây ninh') || s.includes('tay ninh')) return 'Tây Ninh';
  if (s.includes('an giang')) return 'An Giang';
  if (s.includes('bình thuận') || s.includes('binh thuan')) return 'Bình Thuận';
  if (s.includes('vĩnh long') || s.includes('vinh long')) return 'Vĩnh Long';
  if (s.includes('bình dương') || s.includes('binh duong') || s.includes('sông bé')) return 'Bình Dương';
  if (s.includes('trà vinh') || s.includes('tra vinh')) return 'Trà Vinh';
  if (s.includes('long an')) return 'Long An';
  if (s.includes('bình phước') || s.includes('binh phuoc')) return 'Bình Phước';
  if (s.includes('hậu giang') || s.includes('hau giang')) return 'Hậu Giang';
  if (s.includes('tiền giang') || s.includes('tien giang')) return 'Tiền Giang';
  if (s.includes('kiên giang') || s.includes('kien giang')) return 'Kiên Giang';
  return st.trim();
}

/**
 * Returns the list of standard drawing weekdays for a given station in XSMN.
 */
export function getScheduledDaysForStation(station: string): DayOfWeek[] {
  const norm = normalizeStationName(station);
  const found = ALL_XSMN_STATIONS.find(s => s.name.toLowerCase() === norm.toLowerCase());
  if (found) return found.days;

  // Fallback check against XSMN_WEEKDAY_SCHEDULE
  const days: DayOfWeek[] = [];
  for (const [dow, list] of Object.entries(XSMN_WEEKDAY_SCHEDULE)) {
    if (list.some(s => s.toLowerCase() === norm.toLowerCase())) {
      days.push(dow as DayOfWeek);
    }
  }
  return days;
}

/**
 * Validates whether a station is officially scheduled to draw on the specified day of week.
 * Returns true if valid or unknown station, false if recognized station on an unscheduled weekday.
 */
export function isStationScheduledOnDay(station: string, dayOfWeek: DayOfWeek): boolean {
  const scheduledDays = getScheduledDaysForStation(station);
  if (scheduledDays.length === 0) return true; // Custom / unrecognized station: allow
  return scheduledDays.includes(dayOfWeek);
}

/**
 * Given a station and a reference date (ISO), finds the nearest date (ISO) when this station officially draws.
 */
export function findNearestScheduledDate(
  station: string,
  fromDateIso: string
): { dateIso: string; dateDisplay: string; dayOfWeek: DayOfWeek; diffDays: number } | null {
  const scheduledDays = getScheduledDaysForStation(station);
  if (scheduledDays.length === 0) return null;

  const parts = fromDateIso.split('-');
  if (parts.length < 3) return null;
  const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(baseDate.getTime())) return null;

  let bestMatch: { dateIso: string; dateDisplay: string; dayOfWeek: DayOfWeek; diffDays: number } | null = null;
  let minDiff = Infinity;

  // Check offsets from -6 to +6 days
  for (let offset = -6; offset <= 6; offset++) {
    const testDate = new Date(baseDate);
    testDate.setDate(testDate.getDate() + offset);
    const dow = getVietnameseDayOfWeek(testDate);

    if (scheduledDays.includes(dow)) {
      const absDiff = Math.abs(offset);
      // Prefer backward offset (-1 over +1) if tie, or minimal absolute diff
      if (absDiff < minDiff || (absDiff === minDiff && offset < 0)) {
        minDiff = absDiff;
        const yyyy = testDate.getFullYear();
        const mm = String(testDate.getMonth() + 1).padStart(2, '0');
        const dd = String(testDate.getDate()).padStart(2, '0');
        bestMatch = {
          dateIso: `${yyyy}-${mm}-${dd}`,
          dateDisplay: `${dd}/${mm}/${yyyy}`,
          dayOfWeek: dow,
          diffDays: offset,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Calculates the exact future scheduled drawing date for a target station given a base reference date
 * and a cycle distance (+k kỳ quay của đài đích) or target weekday according to official XSMN timetable.
 */
export function calculateNextScheduledDateForStation(
  targetStation: string,
  baseDateIso: string,
  cycleDistance: number = 1,
  targetDayOfWeek?: DayOfWeek
): { dateIso: string; dateDisplay: string; dayOfWeek: DayOfWeek } | null {
  const scheduledDays = getScheduledDaysForStation(targetStation);
  if (scheduledDays.length === 0) return null;

  const parts = baseDateIso.split('-');
  if (parts.length < 3) return null;
  const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(baseDate.getTime())) return null;

  const baseDow = getVietnameseDayOfWeek(baseDate);

  // If cycle distance is 0 (same day draw) and station is scheduled on baseDate
  if (cycleDistance === 0 && scheduledDays.includes(baseDow)) {
    if (!targetDayOfWeek || baseDow === targetDayOfWeek) {
      const yyyy = baseDate.getFullYear();
      const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
      const dd = String(baseDate.getDate()).padStart(2, '0');
      return {
        dateIso: `${yyyy}-${mm}-${dd}`,
        dateDisplay: `${dd}/${mm}/${yyyy}`,
        dayOfWeek: baseDow,
      };
    }
  }

  // Advance day by day (from +1 day) until hitting the cycleDistance-th draw of targetStation
  let matchedCycles = 0;
  const testDate = new Date(baseDate);
  const targetCycle = Math.max(1, cycleDistance);

  // Search horizon up to 90 days (approx 12 weeks)
  for (let offset = 1; offset <= 90; offset++) {
    testDate.setDate(testDate.getDate() + 1);
    const dow = getVietnameseDayOfWeek(testDate);

    if (scheduledDays.includes(dow)) {
      if (!targetDayOfWeek || dow === targetDayOfWeek) {
        matchedCycles++;
        if (matchedCycles >= targetCycle) {
          const yyyy = testDate.getFullYear();
          const mm = String(testDate.getMonth() + 1).padStart(2, '0');
          const dd = String(testDate.getDate()).padStart(2, '0');
          return {
            dateIso: `${yyyy}-${mm}-${dd}`,
            dateDisplay: `${dd}/${mm}/${yyyy}`,
            dayOfWeek: dow,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Calculates estimated draw date information for a historic pattern rule.
 * Combines source station recent draw history, cycle distance, and target station XSMN schedule.
 */
export function calculateEstimatedDrawDateForPattern(
  sourceStation: string,
  targetStation: string,
  cycleDistance: number | string,
  evidenceRecords: DrawRelation[],
  records: LotteryRecord[],
  targetDayOfWeek?: DayOfWeek
): EstimatedDrawDateInfo | undefined {
  if (!targetStation || targetStation === 'Nhiều đài') return undefined;

  const scheduledDays = getScheduledDaysForStation(targetStation);
  if (scheduledDays.length === 0) return undefined;

  // Extract cycle number
  let cycleNum = 1;
  if (typeof cycleDistance === 'number') {
    cycleNum = cycleDistance;
  } else if (typeof cycleDistance === 'string') {
    const matched = cycleDistance.match(/\d+/);
    if (matched) {
      cycleNum = parseInt(matched[0], 10);
    }
  }

  // Find latest draw of source station
  const sourceRecords = records.filter(r => r.station.toLowerCase() === sourceStation.toLowerCase());
  const latestSourceRec = sourceRecords.length > 0 ? sourceRecords[sourceRecords.length - 1] : undefined;

  let baseSourceDate = latestSourceRec?.date;
  let baseSourceDisplay = latestSourceRec?.dateDisplay;
  let baseSourceDayOfWeek = latestSourceRec?.dayOfWeek;

  if (!baseSourceDate && evidenceRecords.length > 0) {
    const sortedEv = [...evidenceRecords].sort((a, b) => b.sourceDate.localeCompare(a.sourceDate));
    baseSourceDate = sortedEv[0].sourceDate;
    baseSourceDisplay = sortedEv[0].sourceRecord.dateDisplay;
    baseSourceDayOfWeek = sortedEv[0].sourceDayOfWeek;
  }

  if (!baseSourceDate) return undefined;
  if (!baseSourceDisplay) {
    const parsed = parseDateString(baseSourceDate);
    baseSourceDisplay = parsed.display;
    baseSourceDayOfWeek = parsed.dayOfWeek;
  }

  const maxDatasetDate = records.length > 0 ? records[records.length - 1].date : baseSourceDate;

  // Calculate target date based on baseSourceDate and cycleNum
  let estimated = calculateNextScheduledDateForStation(targetStation, baseSourceDate, cycleNum, targetDayOfWeek);
  if (!estimated) return undefined;

  let daysRemaining = getDayDifference(maxDatasetDate, estimated.dateIso);
  let isUpcoming = daysRemaining >= 0;

  // If the calculated date is already passed compared to current database max date,
  // project the next forward upcoming occurrence for the user!
  if (daysRemaining < 0) {
    const upcomingFromNow = calculateNextScheduledDateForStation(targetStation, maxDatasetDate, 1, targetDayOfWeek);
    if (upcomingFromNow) {
      estimated = upcomingFromNow;
      daysRemaining = getDayDifference(maxDatasetDate, estimated.dateIso);
      isUpcoming = true;
    }
  }

  let timingLabel = '';
  let timingBadgeColor = '';

  if (daysRemaining === 0) {
    timingLabel = 'Hôm nay (Cùng ngày)';
    timingBadgeColor = 'bg-rose-500 text-white';
  } else if (daysRemaining === 1) {
    timingLabel = 'Ngày mai (+1 ngày)';
    timingBadgeColor = 'bg-amber-500 text-slate-950 font-bold';
  } else if (daysRemaining > 1 && daysRemaining <= 3) {
    timingLabel = `Sắp xổ (còn ${daysRemaining} ngày)`;
    timingBadgeColor = 'bg-emerald-600 text-white font-bold';
  } else if (daysRemaining > 3 && daysRemaining <= 7) {
    timingLabel = `Kỳ tới (còn ${daysRemaining} ngày)`;
    timingBadgeColor = 'bg-teal-600 text-white';
  } else if (daysRemaining > 7) {
    timingLabel = `Sau ${Math.ceil(daysRemaining / 7)} tuần`;
    timingBadgeColor = 'bg-indigo-600 text-white';
  } else {
    timingLabel = `Đã qua ${Math.abs(daysRemaining)} ngày`;
    timingBadgeColor = 'bg-slate-500 text-white';
  }

  const formulaExplanation = `Kỳ quay căn cứ: ${sourceStation} ngày ${baseSourceDisplay} (${baseSourceDayOfWeek}) ➔ Quy luật +${cycleNum} kỳ đài ${targetStation} (lịch mở: ${scheduledDays.join(', ')}) ➔ Ước tính sẽ xổ: ${estimated.dateDisplay} (${estimated.dayOfWeek}).`;

  return {
    estimatedDateIso: estimated.dateIso,
    estimatedDateDisplay: estimated.dateDisplay,
    estimatedDayOfWeek: estimated.dayOfWeek,
    targetStation,
    scheduledDays,
    daysRemaining,
    cycleDistanceNum: cycleNum,
    baseSourceDate,
    baseSourceDisplay: baseSourceDisplay || baseSourceDate,
    baseSourceDayOfWeek: baseSourceDayOfWeek || 'Thứ 2',
    timingLabel,
    timingBadgeColor,
    formulaExplanation,
    isUpcoming,
  };
}

/**
 * Specialized Analysis Engine for Stations Drawn on the Same Day of Week (Chung Thứ / Chung Ngày)
 */
export function analyzeSameDayAndWeekdayRelations(records: LotteryRecord[]): {
  sameDayGroups: SameDayDrawGroup[];
  interWeekRelations: DrawRelation[];
  weekdaySummaries: DayOfWeekStatSummary[];
  allSameDayRelations: DrawRelation[];
} {
  if (!records || records.length === 0) {
    return {
      sameDayGroups: [],
      interWeekRelations: [],
      weekdaySummaries: [],
      allSameDayRelations: [],
    };
  }

  // 1. Group records by Date
  const dateMap = new Map<string, LotteryRecord[]>();
  for (const r of records) {
    const arr = dateMap.get(r.date) || [];
    arr.push(r);
    dateMap.set(r.date, arr);
  }

  // Sort dates descending (newest first for display)
  const sortedDatesDesc = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
  const sortedDatesAsc = [...sortedDatesDesc].reverse();

  const sameDayGroups: SameDayDrawGroup[] = [];
  const allSameDayRelations: DrawRelation[] = [];

  // 2. Compute within-day relations (Same Day / Cùng Buổi Quay 16h15)
  for (const d of sortedDatesDesc) {
    const dayRecords = dateMap.get(d)!;
    const internalRelations: DrawRelation[] = [];

    // Pairwise comparison between distinct stations on the same date
    for (let i = 0; i < dayRecords.length; i++) {
      const src = dayRecords[i];
      for (let j = 0; j < dayRecords.length; j++) {
        if (i === j) continue;
        const tgt = dayRecords[j];
        if (src.station.trim().toLowerCase() === tgt.station.trim().toLowerCase()) continue;

        const comparison = compareDigits(src.head3, tgt.tail3);
        // Only keep meaningful correlations
        if (comparison.similarityScore >= 33) {
          const alertColor = determineAlertColor(comparison.isExactMatch, comparison.similarityScore, 1);
          const rel: DrawRelation = {
            id: `sameday-${src.id}-${tgt.id}`,
            sourceRecord: src,
            targetRecord: tgt,
            sourceDate: src.date,
            targetDate: tgt.date,
            sourceStation: src.station,
            targetStation: tgt.station,
            sourceHead3: src.head3,
            targetTail3: tgt.tail3,
            cycleDistance: 0,
            dayDistance: 0,
            sourceDayOfWeek: src.dayOfWeek,
            targetDayOfWeek: tgt.dayOfWeek,
            relationType: comparison.relationType,
            relationTypeLabel: comparison.relationTypeLabel,
            similarityScore: comparison.similarityScore,
            alertColor,
            matchDescription: `Cùng ngày ${src.dateDisplay} (${src.dayOfWeek}): Đầu ${src.station} [${src.head3}] → Cuối ${tgt.station} [${tgt.tail3}] (${comparison.relationTypeLabel})`,
            isExactMatch: comparison.isExactMatch,
          };
          internalRelations.push(rel);
          allSameDayRelations.push(rel);
        }
      }
    }

    sameDayGroups.push({
      date: d,
      dateDisplay: dayRecords[0]?.dateDisplay || d,
      dayOfWeek: dayRecords[0]?.dayOfWeek || 'Thứ 2',
      records: dayRecords,
      internalRelations,
    });
  }

  // 3. Compute inter-week relations for the SAME day of week (Thứ X tuần N -> Thứ X tuần N+k)
  const interWeekRelations: DrawRelation[] = [];
  const daysOrder: DayOfWeek[] = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

  for (const dow of daysOrder) {
    // Dates of this day of week in chronological ascending order
    const dowDates = sortedDatesAsc.filter(d => {
      const recs = dateMap.get(d);
      return recs && recs[0]?.dayOfWeek === dow;
    });

    if (dowDates.length < 2) continue;

    for (let i = 0; i < dowDates.length; i++) {
      const srcDate = dowDates[i];
      const srcRecords = dateMap.get(srcDate)!;

      // Look ahead up to 4 weeks
      for (let j = i + 1; j < Math.min(dowDates.length, i + 5); j++) {
        const tgtDate = dowDates[j];
        const tgtRecords = dateMap.get(tgtDate)!;
        const weekGap = j - i;

        for (const src of srcRecords) {
          for (const tgt of tgtRecords) {
            const comparison = compareDigits(src.head3, tgt.tail3);
            if (comparison.similarityScore >= 33) {
              const alertColor = determineAlertColor(comparison.isExactMatch, comparison.similarityScore, 1);
              const rel: DrawRelation = {
                id: `interweek-${src.id}-${tgt.id}`,
                sourceRecord: src,
                targetRecord: tgt,
                sourceDate: src.date,
                targetDate: tgt.date,
                sourceStation: src.station,
                targetStation: tgt.station,
                sourceHead3: src.head3,
                targetTail3: tgt.tail3,
                cycleDistance: weekGap,
                dayDistance: getDayDifference(src.date, tgt.date),
                sourceDayOfWeek: src.dayOfWeek,
                targetDayOfWeek: tgt.dayOfWeek,
                relationType: comparison.relationType,
                relationTypeLabel: comparison.relationTypeLabel,
                similarityScore: comparison.similarityScore,
                alertColor,
                matchDescription: `Liên tuần (${dow}, cách ${weekGap} tuần): Đầu ${src.station} ngày ${src.dateDisplay} [${src.head3}] → Cuối ${tgt.station} ngày ${tgt.dateDisplay} [${tgt.tail3}] (${comparison.relationTypeLabel})`,
                isExactMatch: comparison.isExactMatch,
              };
              interWeekRelations.push(rel);
            }
          }
        }
      }
    }
  }

  // 4. Summaries per Day of Week
  const weekdaySummaries: DayOfWeekStatSummary[] = daysOrder.map(dow => {
    const dowGroups = sameDayGroups.filter(g => g.dayOfWeek === dow);
    const dowRecords = dowGroups.flatMap(g => g.records);
    const dowSameDayRels = dowGroups.flatMap(g => g.internalRelations);
    const dowInterWeekRels = interWeekRelations.filter(r => r.sourceDayOfWeek === dow && r.targetDayOfWeek === dow);

    const actualStations = Array.from(new Set(dowRecords.map(r => r.station))).sort();
    const scheduled = XSMN_WEEKDAY_SCHEDULE[dow] || [];

    // Pair counts
    const pairMap = new Map<string, { sourceStation: string; targetStation: string; count: number; exactCount: number }>();
    for (const r of [...dowSameDayRels, ...dowInterWeekRels]) {
      const key = `${r.sourceStation} → ${r.targetStation}`;
      const prev = pairMap.get(key) || { sourceStation: r.sourceStation, targetStation: r.targetStation, count: 0, exactCount: 0 };
      prev.count++;
      if (r.isExactMatch) prev.exactCount++;
      pairMap.set(key, prev);
    }
    const topPairs = Array.from(pairMap.values()).sort((a, b) => b.count - a.count).slice(0, 6);

    // Top Head numbers
    const headMap = new Map<string, { number: string; count: number; stations: Set<string> }>();
    for (const r of dowRecords) {
      const prev = headMap.get(r.head3) || { number: r.head3, count: 0, stations: new Set<string>() };
      prev.count++;
      prev.stations.add(r.station);
      headMap.set(r.head3, prev);
    }
    const topHeads = Array.from(headMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => ({ number: item.number, count: item.count, stations: Array.from(item.stations) }));

    // Top Tail numbers
    const tailMap = new Map<string, { number: string; count: number; stations: Set<string> }>();
    for (const r of dowRecords) {
      const prev = tailMap.get(r.tail3) || { number: r.tail3, count: 0, stations: new Set<string>() };
      prev.count++;
      prev.stations.add(r.station);
      tailMap.set(r.tail3, prev);
    }
    const topTails = Array.from(tailMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => ({ number: item.number, count: item.count, stations: Array.from(item.stations) }));

    return {
      dayOfWeek: dow,
      scheduledStations: scheduled,
      actualStations,
      totalDrawDays: dowGroups.length,
      totalRecords: dowRecords.length,
      sameDayMatchesCount: dowSameDayRels.length,
      sameDayExactCount: dowSameDayRels.filter(r => r.isExactMatch).length,
      interWeekMatchesCount: dowInterWeekRels.length,
      interWeekExactCount: dowInterWeekRels.filter(r => r.isExactMatch).length,
      topPairs,
      topHeads,
      topTails,
    };
  });

  return {
    sameDayGroups,
    interWeekRelations,
    weekdaySummaries,
    allSameDayRelations,
  };
}

/**
 * Sinh tất cả các hoán vị độc nhất của một chuỗi chữ số (3 chữ số)
 */
export function getAllPermutations(str: string): string[] {
  if (str.length <= 1) return [str];
  const results = new Set<string>();
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    const subPerms = getAllPermutations(remaining);
    for (const sub of subPerms) {
      results.add(char + sub);
    }
  }
  return Array.from(results).sort();
}

export interface PermutationVariantAnalysis {
  permutation: string;
  variantType: 'ORIGINAL' | 'REVERSED' | 'PERMUTED';
  variantLabel: string;
  similarityScore: number;
  totalHits: number;
  targetStations: {
    station: string;
    hitCount: number;
    mostCommonCycle: number;
    scheduledDays: DayOfWeek[];
    evidence: DrawRelation[];
  }[];
}

export interface HeadPermutationCalculationResult {
  inputHead3: string;
  sourceStation: string;
  allPermutations: string[];
  variants: PermutationVariantAnalysis[];
  totalPermutationHits: number;
  bestTargetStations: {
    station: string;
    hitCount: number;
    scheduledDays: DayOfWeek[];
    topNumbers: string[];
    commonCycle: number;
    evidence: DrawRelation[];
  }[];
  generalPairRules: {
    targetStation: string;
    permuteRate: number;
    totalRelations: number;
    permuteHits: number;
    commonCycle: number;
    scheduledDays: DayOfWeek[];
  }[];
  allEvidence: DrawRelation[];
}

/**
 * Tính toán hoán vị của một đầu số (3 số đầu) theo quy luật lịch sử đã có
 */
export function calculateHeadPermutationsWithRules(
  head3: string,
  sourceStation: string | 'ALL',
  relations: DrawRelation[]
): HeadPermutationCalculationResult {
  const cleanHead = head3.trim();
  const perms = cleanHead.length === 3 ? getAllPermutations(cleanHead) : cleanHead.length > 0 ? [cleanHead] : [];
  const reversedHead = cleanHead.split('').reverse().join('');

  const allEvidence: DrawRelation[] = [];
  const targetStationMap = new Map<string, {
    station: string;
    hitCount: number;
    numberCounts: Map<string, number>;
    cycles: number[];
    evidence: DrawRelation[];
  }>();

  // 1. Phân tích từng biến thể hoán vị với các quan hệ lịch sử
  const variants: PermutationVariantAnalysis[] = perms.map(p => {
    let variantType: 'ORIGINAL' | 'REVERSED' | 'PERMUTED' = 'PERMUTED';
    let variantLabel = 'Hoán vị chữ số';
    let similarityScore = 75;

    if (p === cleanHead) {
      variantType = 'ORIGINAL';
      variantLabel = 'Số gốc nguyên bản';
      similarityScore = 100;
    } else if (p === reversedHead) {
      variantType = 'REVERSED';
      variantLabel = 'Đảo ngược chiều';
      similarityScore = 85;
    }

    // Tìm trong relations những lần đầu số này (hoặc từ đài nguồn này) sinh ra đuôi p
    const matchedRels = relations.filter(r => {
      const matchHead = r.sourceHead3 === cleanHead;
      const matchTail = r.targetTail3 === p;
      const matchSource = sourceStation === 'ALL' || r.sourceStation === sourceStation;
      return matchHead && matchTail && matchSource;
    });

    matchedRels.forEach(r => allEvidence.push(r));

    // Gom theo đài đích
    const stationGroupMap = new Map<string, {
      station: string;
      hitCount: number;
      cycles: number[];
      evidence: DrawRelation[];
    }>();

    matchedRels.forEach(r => {
      let stItem = stationGroupMap.get(r.targetStation);
      if (!stItem) {
        stItem = {
          station: r.targetStation,
          hitCount: 0,
          cycles: [],
          evidence: [],
        };
        stationGroupMap.set(r.targetStation, stItem);
      }
      stItem.hitCount++;
      stItem.cycles.push(r.cycleDistance);
      stItem.evidence.push(r);

      // Thêm vào tổng thể targetStationMap
      let globalSt = targetStationMap.get(r.targetStation);
      if (!globalSt) {
        globalSt = {
          station: r.targetStation,
          hitCount: 0,
          numberCounts: new Map<string, number>(),
          cycles: [],
          evidence: [],
        };
        targetStationMap.set(r.targetStation, globalSt);
      }
      globalSt.hitCount++;
      globalSt.cycles.push(r.cycleDistance);
      globalSt.evidence.push(r);
      globalSt.numberCounts.set(p, (globalSt.numberCounts.get(p) || 0) + 1);
    });

    const targetStations = Array.from(stationGroupMap.values()).map(item => {
      // Tìm chu kỳ phổ biến nhất
      const cycleFreq = new Map<number, number>();
      item.cycles.forEach(c => cycleFreq.set(c, (cycleFreq.get(c) || 0) + 1));
      let mostCommonCycle = 1;
      let maxF = 0;
      cycleFreq.forEach((f, c) => {
        if (f > maxF) {
          maxF = f;
          mostCommonCycle = c;
        }
      });

      return {
        station: item.station,
        hitCount: item.hitCount,
        mostCommonCycle,
        scheduledDays: getScheduledDaysForStation(item.station),
        evidence: item.evidence,
      };
    }).sort((a, b) => b.hitCount - a.hitCount);

    return {
      permutation: p,
      variantType,
      variantLabel,
      similarityScore,
      totalHits: matchedRels.length,
      targetStations,
    };
  });

  // 2. Tổng hợp các đài đích nhận các bộ số hoán vị này nhiều nhất
  const bestTargetStations = Array.from(targetStationMap.values()).map(item => {
    const cycleFreq = new Map<number, number>();
    item.cycles.forEach(c => cycleFreq.set(c, (cycleFreq.get(c) || 0) + 1));
    let commonCycle = 1;
    let maxF = 0;
    cycleFreq.forEach((f, c) => {
      if (f > maxF) {
        maxF = f;
        commonCycle = c;
      }
    });

    const topNumbers = Array.from(item.numberCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    return {
      station: item.station,
      hitCount: item.hitCount,
      scheduledDays: getScheduledDaysForStation(item.station),
      topNumbers,
      commonCycle,
      evidence: item.evidence,
    };
  }).sort((a, b) => b.hitCount - a.hitCount);

  // 3. Quy luật tổng quan giữa đài nguồn với các đài khác (khi nguồn là 1 đài cụ thể)
  const generalPairRules: {
    targetStation: string;
    permuteRate: number;
    totalRelations: number;
    permuteHits: number;
    commonCycle: number;
    scheduledDays: DayOfWeek[];
  }[] = [];

  if (sourceStation !== 'ALL') {
    const pairMap = new Map<string, { total: number; permute: number; cycles: number[] }>();
    relations.forEach(r => {
      if (r.sourceStation !== sourceStation) return;
      if (r.targetStation === sourceStation) return;

      let p = pairMap.get(r.targetStation);
      if (!p) {
        p = { total: 0, permute: 0, cycles: [] };
        pairMap.set(r.targetStation, p);
      }
      p.total++;
      if (r.relationType === 'HOAN_VI' || r.relationType === 'DAO_NGUOC') {
        p.permute++;
        p.cycles.push(r.cycleDistance);
      }
    });

    pairMap.forEach((data, tgtStation) => {
      if (data.total >= 2 && data.permute > 0) {
        const cycleFreq = new Map<number, number>();
        data.cycles.forEach(c => cycleFreq.set(c, (cycleFreq.get(c) || 0) + 1));
        let commonCycle = 1;
        let maxF = 0;
        cycleFreq.forEach((f, c) => {
          if (f > maxF) {
            maxF = f;
            commonCycle = c;
          }
        });

        generalPairRules.push({
          targetStation: tgtStation,
          permuteRate: (data.permute / data.total) * 100,
          totalRelations: data.total,
          permuteHits: data.permute,
          commonCycle,
          scheduledDays: getScheduledDaysForStation(tgtStation),
        });
      }
    });

    generalPairRules.sort((a, b) => {
      if (b.permuteRate !== a.permuteRate) return b.permuteRate - a.permuteRate;
      return b.permuteHits - a.permuteHits;
    });
  }

  const totalPermutationHits = variants.reduce((sum, v) => sum + v.totalHits, 0);

  return {
    inputHead3: cleanHead,
    sourceStation,
    allPermutations: perms,
    variants,
    totalPermutationHits,
    bestTargetStations,
    generalPairRules,
    allEvidence,
  };
}
