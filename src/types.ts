export type DayOfWeek = 
  | 'Thứ 2' 
  | 'Thứ 3' 
  | 'Thứ 4' 
  | 'Thứ 5' 
  | 'Thứ 6' 
  | 'Thứ 7' 
  | 'Chủ nhật';

export interface LotteryRecord {
  id: string;
  date: string; // ISO YYYY-MM-DD
  dateDisplay: string; // DD/MM/YYYY
  dayOfWeek: DayOfWeek;
  station: string; // e.g. "TP.HCM", "Đồng Tháp", "Đài A", etc.
  rawNumber: string; // Exactly 6 digits (e.g. "025678")
  head3: string; // Exactly 3 digits (e.g. "025")
  tail3: string; // Exactly 3 digits (e.g. "678")
  sessionIndex: number; // Chronological order index (1, 2, 3...)
  createdAt: number;
}

export type RelationType = 
  | 'TRUNG_3_3' // Trùng hoàn toàn 3 số (100%)
  | 'TRUNG_2_3' // Trùng 2/3 chữ số (67%)
  | 'DAO_NGUOC' // Đảo ngược chữ số (ví dụ 123 <-> 321)
  | 'HOAN_VI' // Hoán vị chữ số (ví dụ 123 <-> 132, 213, 231, 312)
  | 'TRUNG_VI_TRI' // Trùng vị trí chữ số (ví dụ cùng hàng trăm và đơn vị)
  | 'TRUNG_1_3'; // Trùng 1/3 chữ số (33%)

export type AlertColor = 'red' | 'orange' | 'yellow' | 'green';

export interface DrawRelation {
  id: string;
  sourceRecord: LotteryRecord;
  targetRecord: LotteryRecord;
  sourceDate: string;
  targetDate: string;
  sourceStation: string;
  targetStation: string;
  sourceHead3: string;
  targetTail3: string;
  sourceTail3?: string; // 3 số cuối đài nguồn (khi so sánh 3 số cuối Đuôi -> Đuôi)
  comparisonType?: 'HEAD_TO_TAIL' | 'TAIL_TO_TAIL'; // Loại so sánh: Đầu -> Cuối hay Cuối -> Cuối
  cycleDistance: number; // Khoảng cách theo phiên kỳ quay (k kỳ)
  dayDistance: number; // Khoảng cách ngày thực tế (targetDate - sourceDate)
  sourceDayOfWeek: DayOfWeek;
  targetDayOfWeek: DayOfWeek;
  relationType: RelationType;
  relationTypeLabel: string;
  similarityScore: number; // 0% - 100%
  alertColor: AlertColor;
  matchDescription: string;
  isExactMatch: boolean;
}

export interface RepeatedRelationSummary {
  id: string;
  sourceStation: string;
  targetStation: string;
  sourceHead3: string;
  targetTail3: string;
  sourceTail3?: string;
  comparisonType?: 'HEAD_TO_TAIL' | 'TAIL_TO_TAIL';
  relationType: RelationType;
  relationLabel: string;
  repeatCount: number;
  averageCycleDistance: number;
  mostCommonCycle: number;
  latestDate: string;
  earliestDate: string;
  alertColor: AlertColor;
  occurrences: DrawRelation[];
}

export interface StationMatrixCell {
  sourceStation: string;
  targetStation: string;
  totalMatches: number;
  exactMatches: number;
  partialMatches: number;
  uniqueNumbers: string[];
  mostCommonCycle: number | null;
  latestDate: string | null;
  alertColor: AlertColor;
  relations: DrawRelation[];
}

export type PatternCategory = 
  | 'CHU_KY_CO_DINH' // Lặp lại theo cùng số kỳ (Đầu -> Cuối)
  | 'THU_TRONG_TUAN' // Lặp lại theo thứ cố định (Đầu -> Cuối)
  | 'CAP_DAI_QUEN_THUOC' // Cặp đài lặp lại tần suất cao
  | 'BO_SO_LAN_TOA' // Một bộ số xuất hiện qua nhiều đài
  | 'CHUYEN_DAU_CUOI_LAP' // Chuyển từ đầu sang cuối lặp lại nhiều lần
  | 'QUY_LUAT_3_SO_CUOI' // Quy luật 3 số cuối giữa các đài (Đuôi -> Đuôi)
  | 'CHUYEN_CUOI_CUOI_LAP' // Bộ 3 số cuối lặp lại giữa các đài
  | 'CHU_KY_3_SO_CUOI' // Chu kỳ cố định 3 số cuối giữa các đài
  | 'LAN_TOA_3_SO_CUOI' // 3 số cuối lan toả nhiều đài
  | 'THU_3_SO_CUOI'; // 3 số cuối theo Thứ trong tuần

export interface EstimatedDrawDateInfo {
  estimatedDateIso: string; // YYYY-MM-DD
  estimatedDateDisplay: string; // DD/MM/YYYY
  estimatedDayOfWeek: DayOfWeek;
  targetStation: string;
  scheduledDays: DayOfWeek[];
  daysRemaining: number;
  cycleDistanceNum: number;
  baseSourceDate: string;
  baseSourceDisplay: string;
  baseSourceDayOfWeek: DayOfWeek;
  timingLabel: string;
  timingBadgeColor: string;
  formulaExplanation: string;
  isUpcoming: boolean;
}

export interface HistoricPattern {
  id: string;
  category: PatternCategory;
  categoryLabel: string;
  patternScope?: 'HEAD_TO_TAIL' | 'TAIL_TO_TAIL'; // Đầu -> Cuối hay 3 Số Cuối giữa các đài
  title: string;
  description: string;
  sourceStation: string;
  targetStation: string;
  numbersInvolved: string[];
  repeatCount: number;
  cycleDistance: number | string;
  dayOfWeek?: DayOfWeek;
  latestDate: string;
  alertColor: AlertColor;
  confidenceType: 'TRUNG_KHOP_THUC_TE' | 'TUONG_DONG_CAO' | 'MAU_LAP_LAI' | 'TAN_SUAT_CAO' | 'GIA_THUYET_THEO_DOI';
  confidenceLabel: string;
  evidenceRecords: DrawRelation[];
  estimatedDrawDate?: EstimatedDrawDateInfo;
}

export interface TailPatternOverview {
  totalRelations: number;
  exactMatchesCount: number;
  permuteMatchesCount: number;
  reverseMatchesCount: number;
  topStationPairs: {
    sourceStation: string;
    targetStation: string;
    totalMatches: number;
    exactMatches: number;
    mostCommonNumber: string;
    mostCommonCycle: number;
    relations: DrawRelation[];
  }[];
  hotTailNumbers: {
    number: string;
    totalOccurrences: number;
    stations: string[];
    dates: string[];
    relations: DrawRelation[];
  }[];
}

export interface SimilarityPositionDetail {
  posIndex: number; // 0 (trăm), 1 (chục), 2 (đơn vị)
  posName: string; // 'Hàng trăm', 'Hàng chục', 'Hàng đơn vị'
  sourceDigit: string;
  targetDigit: string;
  matchType: 'EXACT' | 'PERMUTED' | 'DIFFERENT';
  matchLabel: string;
}

export interface SimilarityBreakdown {
  score: number; // 0 - 100%
  tier: 'EXACT_100' | 'REVERSE_85' | 'PERMUTE_75' | 'MATCH_2_3' | 'MATCH_1_3';
  tierLabel: string;
  sharedDigits: string[];
  sharedDigitsCount: number;
  exactPositionsCount: number;
  isReversed: boolean;
  isPermutation: boolean;
  positionDetails: SimilarityPositionDetail[];
  explanation: string;
}

export interface PatternPredictionLead {
  id: string;
  latestRecord: LotteryRecord;
  suggestedStation: string;
  projectedTail3: string;
  relationType: RelationType;
  relationTypeLabel: string;
  similarityScore: number;
  similarityBreakdown: SimilarityBreakdown;
  expectedCycle: number;
  historicOccurrencesCount: number;
  lastHistoricMatchDate: string;
  alertColor: AlertColor;
  reasoning: string;
  evidence: DrawRelation[];
  targetScheduledDays?: DayOfWeek[]; // Các thứ mở thưởng theo lịch XSMN của đài theo dõi
  primaryTargetDay?: DayOfWeek; // Thứ mở thưởng chính của đài theo dõi
}

export type NavigationTab = 
  | 'analysis' 
  | 'matrix' 
  | 'sameday' 
  | 'patterns' 
  | 'prediction' 
  | 'data';

export interface SameDayDrawGroup {
  date: string; // ISO
  dateDisplay: string; // DD/MM/YYYY
  dayOfWeek: DayOfWeek;
  records: LotteryRecord[];
  internalRelations: DrawRelation[]; // Head -> Tail between stations on the same day
}

export interface DayOfWeekStatSummary {
  dayOfWeek: DayOfWeek;
  scheduledStations: string[];
  actualStations: string[];
  totalDrawDays: number;
  totalRecords: number;
  sameDayMatchesCount: number;
  sameDayExactCount: number;
  interWeekMatchesCount: number;
  interWeekExactCount: number;
  topPairs: { sourceStation: string; targetStation: string; count: number; exactCount: number }[];
  topHeads: { number: string; count: number; stations: string[] }[];
  topTails: { number: string; count: number; stations: string[] }[];
}
