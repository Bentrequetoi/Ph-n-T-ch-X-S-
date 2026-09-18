import React, { useState, useMemo } from 'react';
import { PatternPredictionLead, DrawRelation, DayOfWeek } from '../types';
import { WarningLegend } from './WarningLegend';
import { PermutationPredictionBox } from './PermutationPredictionBox';
import {
  XSMN_WEEKDAY_SCHEDULE,
  getScheduledDaysForStation,
} from '../utils/lotteryAnalysis';
import {
  Compass,
  AlertTriangle,
  ArrowRight,
  FileCheck2,
  Sparkles,
  PlusCircle,
  Filter,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Percent,
  Search,
  SlidersHorizontal,
  Info,
  Check,
  ShieldCheck,
  HelpCircle,
  Shuffle,
  Calendar,
  CalendarDays,
  LayoutGrid,
  List,
  ArrowUpDown,
  Clock,
} from 'lucide-react';

interface PatternPredictionProps {
  leads: PatternPredictionLead[];
  relations?: DrawRelation[];
  uniqueStations?: string[];
  totalRecordsCount?: number;
  onLoadSampleData?: () => void;
  onNavigateToData?: () => void;
  onViewDetails: (title: string, subtitle: string, rels: DrawRelation[]) => void;
}

export type SortOption =
  | 'WEEKDAY_TARGET'
  | 'WEEKDAY_SOURCE'
  | 'SIMILARITY'
  | 'OCCURRENCES'
  | 'RECENT';

export const WEEKDAY_ORDER: DayOfWeek[] = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ nhật',
];

export const WEEKDAY_THEMES: Record<
  DayOfWeek,
  {
    badgeBg: string;
    badgeText: string;
    border: string;
    headerBg: string;
    cardBorder: string;
    accentText: string;
    activeTab: string;
  }
> = {
  'Thứ 2': {
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900',
    border: 'border-blue-300',
    headerBg: 'bg-blue-50/80',
    cardBorder: 'border-blue-200',
    accentText: 'text-blue-700',
    activeTab: 'bg-blue-600 text-white border-blue-600 shadow-xs',
  },
  'Thứ 3': {
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    border: 'border-emerald-300',
    headerBg: 'bg-emerald-50/80',
    cardBorder: 'border-emerald-200',
    accentText: 'text-emerald-700',
    activeTab: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
  },
  'Thứ 4': {
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    border: 'border-amber-300',
    headerBg: 'bg-amber-50/80',
    cardBorder: 'border-amber-200',
    accentText: 'text-amber-800',
    activeTab: 'bg-amber-600 text-white border-amber-600 shadow-xs',
  },
  'Thứ 5': {
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    border: 'border-purple-300',
    headerBg: 'bg-purple-50/80',
    cardBorder: 'border-purple-200',
    accentText: 'text-purple-700',
    activeTab: 'bg-purple-600 text-white border-purple-600 shadow-xs',
  },
  'Thứ 6': {
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-900',
    border: 'border-teal-300',
    headerBg: 'bg-teal-50/80',
    cardBorder: 'border-teal-200',
    accentText: 'text-teal-700',
    activeTab: 'bg-teal-600 text-white border-teal-600 shadow-xs',
  },
  'Thứ 7': {
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
    border: 'border-rose-300',
    headerBg: 'bg-rose-50/80',
    cardBorder: 'border-rose-200',
    accentText: 'text-rose-700',
    activeTab: 'bg-rose-600 text-white border-rose-600 shadow-xs',
  },
  'Chủ nhật': {
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-900',
    border: 'border-red-300',
    headerBg: 'bg-red-50/80',
    cardBorder: 'border-red-200',
    accentText: 'text-red-700',
    activeTab: 'bg-red-600 text-white border-red-600 shadow-xs',
  },
};

export const PatternPrediction: React.FC<PatternPredictionProps> = ({
  leads,
  relations = [],
  uniqueStations = [],
  totalRecordsCount = 0,
  onLoadSampleData,
  onNavigateToData,
  onViewDetails,
}) => {
  // Weekday specific states
  const [selectedWeekday, setSelectedWeekday] = useState<string>('ALL'); // 'ALL' | DayOfWeek
  const [weekdayBasis, setWeekdayBasis] = useState<'TARGET_STATION' | 'SOURCE_RECORD'>('TARGET_STATION');
  const [viewMode, setViewMode] = useState<'GROUPED_BY_WEEKDAY' | 'FLAT_LIST'>('GROUPED_BY_WEEKDAY');
  const [sortBy, setSortBy] = useState<SortOption>('WEEKDAY_TARGET');

  // General filter states
  const [similarityFilter, setSimilarityFilter] = useState<'ALL' | 'EXACT_100' | 'PERMUTE_OR_REVERSE' | 'MATCH_2_3'>('ALL');
  const [sourceStationFilter, setSourceStationFilter] = useState<string>('ALL');
  const [suggestedStationFilter, setSuggestedStationFilter] = useState<string>('ALL');
  const [minOccurrences, setMinOccurrences] = useState<number>(0);
  const [searchNumber, setSearchNumber] = useState<string>('');

  // Expanded cards set for deep similarity inspection
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedLeadIds(new Set(leads.map(l => l.id)));
  };

  const collapseAll = () => {
    setExpandedLeadIds(new Set());
  };

  // Helper to extract target scheduled days
  const getTargetDays = (lead: PatternPredictionLead): DayOfWeek[] => {
    if (lead.targetScheduledDays && lead.targetScheduledDays.length > 0) {
      return lead.targetScheduledDays;
    }
    return getScheduledDaysForStation(lead.suggestedStation);
  };

  const getPrimaryTargetDay = (lead: PatternPredictionLead): DayOfWeek => {
    if (lead.primaryTargetDay) return lead.primaryTargetDay;
    const days = getTargetDays(lead);
    return days[0] || 'Thứ 2';
  };

  // Extract unique stations for dropdowns
  const uniqueSourceStations = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => set.add(l.latestRecord.station));
    return Array.from(set).sort();
  }, [leads]);

  const uniqueSuggestedStations = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => set.add(l.suggestedStation));
    return Array.from(set).sort();
  }, [leads]);

  // Quick statistics by similarity
  const stats = useMemo(() => {
    let exactCount = 0;
    let permuteOrReverseCount = 0;
    let match23Count = 0;
    let highRepeatCount = 0;

    leads.forEach(lead => {
      const score = lead.similarityScore;
      if (score === 100) exactCount++;
      else if (score >= 75) permuteOrReverseCount++;
      else if (score >= 67) match23Count++;

      if (lead.historicOccurrencesCount >= 3) highRepeatCount++;
    });

    return {
      total: leads.length,
      exactCount,
      permuteOrReverseCount,
      match23Count,
      highRepeatCount,
    };
  }, [leads]);

  // Count leads available for each weekday
  const weekdayStats = useMemo(() => {
    const counts: Record<DayOfWeek, number> = {
      'Thứ 2': 0,
      'Thứ 3': 0,
      'Thứ 4': 0,
      'Thứ 5': 0,
      'Thứ 6': 0,
      'Thứ 7': 0,
      'Chủ nhật': 0,
    };

    leads.forEach(lead => {
      if (weekdayBasis === 'TARGET_STATION') {
        const targetDays = getTargetDays(lead);
        targetDays.forEach(d => {
          if (counts[d] !== undefined) counts[d]++;
        });
      } else {
        const d = lead.latestRecord.dayOfWeek;
        if (counts[d] !== undefined) counts[d]++;
      }
    });

    return counts;
  }, [leads, weekdayBasis]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let result = leads.filter(lead => {
      // 1. Weekday filter
      if (selectedWeekday !== 'ALL') {
        if (weekdayBasis === 'TARGET_STATION') {
          const targetDays = getTargetDays(lead);
          if (!targetDays.includes(selectedWeekday as DayOfWeek)) return false;
        } else {
          if (lead.latestRecord.dayOfWeek !== selectedWeekday) return false;
        }
      }

      // 2. Similarity filter
      if (similarityFilter === 'EXACT_100' && lead.similarityScore !== 100) return false;
      if (
        similarityFilter === 'PERMUTE_OR_REVERSE' &&
        (lead.similarityScore < 75 || lead.similarityScore >= 100)
      ) {
        return false;
      }
      if (
        similarityFilter === 'MATCH_2_3' &&
        (lead.similarityScore < 60 || lead.similarityScore >= 75)
      ) {
        return false;
      }

      // 3. Station filters
      if (sourceStationFilter !== 'ALL' && lead.latestRecord.station !== sourceStationFilter) {
        return false;
      }
      if (suggestedStationFilter !== 'ALL' && lead.suggestedStation !== suggestedStationFilter) {
        return false;
      }

      // 4. Minimum occurrences
      if (minOccurrences > 0 && lead.historicOccurrencesCount < minOccurrences) {
        return false;
      }

      // 5. Number search (head3 or projectedTail3)
      if (searchNumber.trim()) {
        const query = searchNumber.trim();
        const headMatch = lead.latestRecord.head3.includes(query);
        const tailMatch = lead.projectedTail3.includes(query);
        if (!headMatch && !tailMatch) return false;
      }

      return true;
    });

    // Helper for weekday index
    const getDayIdx = (d?: DayOfWeek): number => {
      if (!d) return 99;
      const idx = WEEKDAY_ORDER.indexOf(d);
      return idx === -1 ? 99 : idx;
    };

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'WEEKDAY_TARGET') {
        const dayA = getPrimaryTargetDay(a);
        const dayB = getPrimaryTargetDay(b);
        const diff = getDayIdx(dayA) - getDayIdx(dayB);
        if (diff !== 0) return diff;
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        return b.historicOccurrencesCount - a.historicOccurrencesCount;
      }

      if (sortBy === 'WEEKDAY_SOURCE') {
        const diff = getDayIdx(a.latestRecord.dayOfWeek) - getDayIdx(b.latestRecord.dayOfWeek);
        if (diff !== 0) return diff;
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        return b.historicOccurrencesCount - a.historicOccurrencesCount;
      }

      if (sortBy === 'SIMILARITY') {
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        return b.historicOccurrencesCount - a.historicOccurrencesCount;
      }

      if (sortBy === 'OCCURRENCES') {
        if (b.historicOccurrencesCount !== a.historicOccurrencesCount) {
          return b.historicOccurrencesCount - a.historicOccurrencesCount;
        }
        return b.similarityScore - a.similarityScore;
      }

      // RECENT: by latest draw date
      return b.latestRecord.date.localeCompare(a.latestRecord.date);
    });

    return result;
  }, [
    leads,
    selectedWeekday,
    weekdayBasis,
    similarityFilter,
    sourceStationFilter,
    suggestedStationFilter,
    minOccurrences,
    searchNumber,
    sortBy,
  ]);

  // Grouped leads by Day of Week for structured presentation
  const groupedLeadsByWeekday = useMemo(() => {
    const groups: {
      day: DayOfWeek;
      stations: string[];
      leads: PatternPredictionLead[];
    }[] = [];

    WEEKDAY_ORDER.forEach(day => {
      if (selectedWeekday !== 'ALL' && selectedWeekday !== day) return;

      const dayLeads = filteredLeads.filter(lead => {
        if (weekdayBasis === 'TARGET_STATION') {
          return getTargetDays(lead).includes(day);
        } else {
          return lead.latestRecord.dayOfWeek === day;
        }
      });

      if (dayLeads.length > 0 || selectedWeekday === day) {
        groups.push({
          day,
          stations: XSMN_WEEKDAY_SCHEDULE[day] || [],
          leads: dayLeads,
        });
      }
    });

    return groups;
  }, [filteredLeads, selectedWeekday, weekdayBasis]);

  const resetFilters = () => {
    setSelectedWeekday('ALL');
    setWeekdayBasis('TARGET_STATION');
    setViewMode('GROUPED_BY_WEEKDAY');
    setSimilarityFilter('ALL');
    setSourceStationFilter('ALL');
    setSuggestedStationFilter('ALL');
    setMinOccurrences(0);
    setSearchNumber('');
    setSortBy('WEEKDAY_TARGET');
  };

  // Render individual lead card
  const renderLeadCard = (lead: PatternPredictionLead, idx: number) => {
    const isHigh = lead.historicOccurrencesCount >= 3;
    const isExpanded = expandedLeadIds.has(lead.id);
    const targetDays = getTargetDays(lead);
    const primaryDay = getPrimaryTargetDay(lead);
    const targetTheme = WEEKDAY_THEMES[primaryDay] || WEEKDAY_THEMES['Thứ 2'];
    const sourceTheme = WEEKDAY_THEMES[lead.latestRecord.dayOfWeek] || WEEKDAY_THEMES['Thứ 2'];

    // Card border & background based on alert color
    const cardBg =
      lead.alertColor === 'red'
        ? 'border-rose-300 bg-rose-50/30'
        : lead.alertColor === 'orange'
        ? 'border-amber-300 bg-amber-50/30'
        : 'border-slate-200 bg-white';

    // Score badge styling
    const scoreBg =
      lead.similarityScore === 100
        ? 'bg-rose-600 text-white'
        : lead.similarityScore >= 85
        ? 'bg-amber-600 text-white'
        : lead.similarityScore >= 75
        ? 'bg-amber-500 text-white'
        : 'bg-blue-600 text-white';

    const breakdown = lead.similarityBreakdown;

    return (
      <div
        key={lead.id ? `${lead.id}-${idx}` : `pred-lead-${idx}`}
        className={`border rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${cardBg}`}
      >
        <div>
          {/* Top Bar: Stations, Weekday Indicators, and Similarity Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900">
              {/* Source station with draw day badge */}
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
                <span className="font-bold">{lead.latestRecord.station}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${sourceTheme.badgeBg} ${sourceTheme.badgeText}`}>
                  {lead.latestRecord.dayOfWeek}
                </span>
              </div>

              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

              {/* Target station with scheduled draw day(s) badge */}
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                <span className="font-bold">{lead.suggestedStation}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${targetTheme.badgeBg} ${targetTheme.badgeText}`}>
                  Xổ {targetDays.join(', ')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${scoreBg}`}>
                {lead.similarityScore}% {lead.relationTypeLabel}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  isHigh ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Đã lặp {lead.historicOccurrencesCount} lần
              </span>
            </div>
          </div>

          {/* Numbers Match Visual Block */}
          <div className="my-3.5 p-3 sm:p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 flex flex-wrap items-center justify-between gap-1 mb-2">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Kỳ xổ: <strong>{lead.latestRecord.dateDisplay}</strong> ({lead.latestRecord.dayOfWeek})
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>Đài đích mở thưởng: {targetDays.join(', ')}</span>
                <span className="text-slate-400">|</span>
                <span>+{lead.expectedCycle} kỳ</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-center">
              <div className="flex-1 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                <span className="text-[10px] text-blue-800 block font-semibold mb-0.5">
                  3 số đầu ({lead.latestRecord.station} - {lead.latestRecord.dayOfWeek}):
                </span>
                <span className="text-xl font-mono font-black text-blue-700 tracking-widest">
                  {lead.latestRecord.head3}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-400 flex flex-col items-center px-1">
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <span className="text-[9px] text-slate-500 font-semibold mt-0.5">Đầu &rarr; Cuối</span>
              </div>

              <div className="flex-1 bg-purple-50/60 p-2.5 rounded-lg border border-purple-100">
                <span className="text-[10px] text-purple-800 block font-semibold mb-0.5">
                  3 số cuối theo dõi ({lead.suggestedStation} - {targetDays.join('/')}):
                </span>
                <span className="text-xl font-mono font-black text-purple-700 tracking-widest">
                  {lead.projectedTail3}
                </span>
              </div>
            </div>
          </div>

          {/* Similarity In-Depth Inspection Block */}
          {breakdown && (
            <div className="my-3 rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden">
              <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                  <span>Xem xét kỹ tương đồng</span>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-white text-slate-700 border border-slate-200">
                    {breakdown.tierLabel}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpand(lead.id)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{isExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Always show high-level similarity summary */}
              <div className="p-3 text-xs text-slate-700 space-y-2">
                <p className="leading-relaxed font-medium">
                  {breakdown.explanation}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    Chữ số chung: <strong>{breakdown.sharedDigits.length}/3</strong> ({'{'}
                    {breakdown.sharedDigits.join(', ')}
                    {'}'})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    Trùng vị trí: <strong>{breakdown.exactPositionsCount}/3</strong> vị trí
                  </span>
                  {breakdown.isReversed && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                      Đảo ngược 100%
                    </span>
                  )}
                  {breakdown.isPermutation && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                      Hoán vị cùng bộ số
                    </span>
                  )}
                </div>

                {/* Digit-by-Digit Inspection Table (Shown when expanded) */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Đối chiếu chi tiết 3 vị trí chữ số:
                    </div>

                    <div className="divide-y divide-slate-200 rounded border border-slate-200 bg-white overflow-hidden">
                      {breakdown.positionDetails.map((pos) => {
                        const isExact = pos.matchType === 'EXACT';
                        const isPerm = pos.matchType === 'PERMUTED';

                        return (
                          <div
                            key={`pos-${pos.posIndex}`}
                            className="px-3 py-2 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-600 w-20">
                                {pos.posName}:
                              </span>
                              <div className="flex items-center gap-1 font-mono font-bold">
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-100">
                                  {pos.sourceDigit}
                                </span>
                                <span className="text-slate-400">&rarr;</span>
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-100">
                                  {pos.targetDigit}
                                </span>
                              </div>
                            </div>

                            <div>
                              {isExact && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  Trùng vị trí
                                </span>
                              )}
                              {isPerm && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Đảo vị trí bộ số
                                </span>
                              )}
                              {!isExact && !isPerm && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                                  Khác biệt
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reasoning description */}
          <p className="text-xs text-slate-600 leading-relaxed mt-2.5">
            {lead.reasoning}
          </p>
        </div>

        {/* Bottom Evidence Button */}
        <div className="pt-3 mt-3.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            Lần lặp gần nhất: <strong>{lead.lastHistoricMatchDate}</strong>
          </span>
          <button
            type="button"
            onClick={() =>
              onViewDetails(
                `Căn cứ lịch sử: ${lead.latestRecord.station} (${lead.latestRecord.dayOfWeek}) → ${lead.suggestedStation} (${targetDays.join(', ')})`,
                `Mức tương đồng: ${lead.similarityScore}% (${lead.relationTypeLabel}) - ${lead.historicOccurrencesCount} lần trong lịch sử`,
                lead.evidence
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Xem {lead.evidence.length} bằng chứng</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Mandatory Disclaimer Alert Box (Mục 12) */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-200 text-amber-900 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-900" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-amber-900 uppercase tracking-wide">
              Cảnh Báo Quan Trọng Về Phân Tích Lịch Sử
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-amber-900 mt-1 leading-relaxed">
              “Đây là phân tích dữ liệu lịch sử, không phải dự đoán chắc chắn kết quả xổ số.”
            </p>
            <p className="text-xs text-amber-800/90 mt-1.5 leading-relaxed">
              Phần mềm chỉ tổng hợp các quan hệ có tần suất lặp lại cao trong quá khứ dựa trên 3 số đầu của các kỳ quay mới nhất.
              Người dùng chỉ nên sử dụng như tài liệu tham khảo thống kê số học.
            </p>
          </div>
        </div>
      </div>

      <WarningLegend />

      {/* DỰ ĐOÁN ĐÀI NÀO CÓ KHẢ NĂNG GIỐNG NHAU VIỆC LẤY HOÁN VỊ CÁC BỘ SỐ CHO NHAU NHẤT */}
      <PermutationPredictionBox
        relations={relations}
        leads={leads}
        uniqueStations={uniqueStations}
        onViewDetails={onViewDetails}
        onSelectStation={(st) => {
          setSourceStationFilter(st);
        }}
        onFilterLeadByPair={(src, tgt) => {
          setSourceStationFilter(src);
          setSuggestedStationFilter(tgt);
          setSimilarityFilter('PERMUTE_OR_REVERSE');
        }}
        onApplyNumberFilter={(queryNumber) => {
          setSearchNumber(queryNumber);
        }}
      />

      {/* SẮP XẾP & PHÂN LOẠI THEO KIỂU THỨ (LỊCH XSMN) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-red-600" />
              <h3 className="text-base font-bold text-slate-900">
                Sắp Xếp & Phân Tích Mẫu Theo Kiểu Thứ (Lịch XSMN)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Phân loại và gom nhóm các manh mối dự đoán theo từng Thứ trong tuần (Thứ 2 &rarr; Chủ nhật) tương ứng với lịch mở thưởng chính thức của 21 đài miền Nam.
            </p>
          </div>

          {/* Controls: Weekday Basis & View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Basis Selector */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setWeekdayBasis('TARGET_STATION')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  weekdayBasis === 'TARGET_STATION'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Sắp xếp / gom nhóm theo Thứ mở thưởng của Đài đích (theo dõi)"
              >
                🎯 Thứ đài theo dõi
              </button>
              <button
                type="button"
                onClick={() => setWeekdayBasis('SOURCE_RECORD')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  weekdayBasis === 'SOURCE_RECORD'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Sắp xếp / gom nhóm theo Thứ của kỳ quay nguồn vừa xổ"
              >
                🕒 Thứ kỳ vừa xổ
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('GROUPED_BY_WEEKDAY')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  viewMode === 'GROUPED_BY_WEEKDAY'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-slate-600" />
                <span>Gom nhóm theo Thứ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('FLAT_LIST')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  viewMode === 'FLAT_LIST'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5 text-slate-600" />
                <span>Danh sách phẳng</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Weekday Filter Tabs (Thứ 2 -> Chủ nhật) */}
        <div>
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Chọn nhanh Thứ trong tuần để xem:</span>
            <span className="text-[11px] font-normal normal-case text-slate-500">
              {weekdayBasis === 'TARGET_STATION'
                ? 'Đang tính theo ngày mở thưởng của đài theo dõi'
                : 'Đang tính theo ngày quay của đài nguồn vừa xổ'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {/* "Tất cả các Thứ" Button */}
            <button
              type="button"
              onClick={() => setSelectedWeekday('ALL')}
              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                selectedWeekday === 'ALL'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold">Tất cả Thứ</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] opacity-80">Toàn bộ tuần</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    selectedWeekday === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {leads.length}
                </span>
              </div>
            </button>

            {/* 7 Weekday Buttons */}
            {WEEKDAY_ORDER.map(day => {
              const count = weekdayStats[day] || 0;
              const theme = WEEKDAY_THEMES[day];
              const isSelected = selectedWeekday === day;
              const stations = XSMN_WEEKDAY_SCHEDULE[day] || [];

              return (
                <button
                  key={`day-tab-${day}`}
                  type="button"
                  onClick={() => setSelectedWeekday(day)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? theme.activeTab
                      : count > 0
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-800'
                      : 'bg-slate-50/50 border-slate-200/60 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{day}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : count > 0
                          ? `${theme.badgeBg} ${theme.badgeText}`
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <div
                    className={`text-[10px] truncate mt-1 ${
                      isSelected ? 'text-white/80' : 'text-slate-500'
                    }`}
                    title={stations.join(', ')}
                  >
                    {stations.slice(0, 2).join(', ')}
                    {stations.length > 2 ? '...' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Similarity Stats Bar */}
        {leads.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSimilarityFilter('ALL')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                similarityFilter === 'ALL'
                  ? 'border-slate-800 bg-slate-900 text-white shadow-xs'
                  : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="text-[11px] font-medium opacity-80">Tất cả mức tương đồng</div>
              <div className="text-lg font-black mt-0.5">{stats.total}</div>
            </button>

            <button
              type="button"
              onClick={() => setSimilarityFilter('EXACT_100')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                similarityFilter === 'EXACT_100'
                  ? 'border-rose-600 bg-rose-600 text-white shadow-xs'
                  : 'border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 text-rose-900'
              }`}
            >
              <div className="text-[11px] font-medium opacity-90 flex items-center justify-between">
                <span>Trùng tuyệt đối 3/3</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-900">100%</span>
              </div>
              <div className="text-lg font-black mt-0.5">{stats.exactCount}</div>
            </button>

            <button
              type="button"
              onClick={() => setSimilarityFilter('PERMUTE_OR_REVERSE')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                similarityFilter === 'PERMUTE_OR_REVERSE'
                  ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                  : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/70 text-amber-900'
              }`}
            >
              <div className="text-[11px] font-medium opacity-90 flex items-center justify-between">
                <span>Đảo ngược / Hoán vị</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">75-85%</span>
              </div>
              <div className="text-lg font-black mt-0.5">{stats.permuteOrReverseCount}</div>
            </button>

            <button
              type="button"
              onClick={() => setSimilarityFilter('MATCH_2_3')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                similarityFilter === 'MATCH_2_3'
                  ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                  : 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-900'
              }`}
            >
              <div className="text-[11px] font-medium opacity-90 flex items-center justify-between">
                <span>Trùng 2/3 chữ số</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-200 text-blue-900">67%</span>
              </div>
              <div className="text-lg font-black mt-0.5">{stats.match23Count}</div>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      {leads.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>Bộ lọc & Sắp xếp kết quả dự đoán</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                Đang hiển thị <strong>{filteredLeads.length}</strong> / {leads.length} quan hệ
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  Mở rộng tất cả
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  Thu gọn
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Mức độ tương đồng */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Mức độ tương đồng
              </label>
              <select
                value={similarityFilter}
                onChange={e => setSimilarityFilter(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="ALL">Tất cả mức tương đồng</option>
                <option value="EXACT_100">🔴 Trùng tuyệt đối 3/3 (100%)</option>
                <option value="PERMUTE_OR_REVERSE">🟠 Đảo ngược / Hoán vị (75% - 85%)</option>
                <option value="MATCH_2_3">🔵 Trùng 2/3 chữ số (67%)</option>
              </select>
            </div>

            {/* 2. Đài nguồn */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Đài nguồn (vừa xổ)
              </label>
              <select
                value={sourceStationFilter}
                onChange={e => setSourceStationFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="ALL">Tất cả đài nguồn</option>
                {uniqueSourceStations.map(st => (
                  <option key={`src-${st}`} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Đài theo dõi */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Đài theo dõi (đích)
              </label>
              <select
                value={suggestedStationFilter}
                onChange={e => setSuggestedStationFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="ALL">Tất cả đài đích</option>
                {uniqueSuggestedStations.map(st => (
                  <option key={`tgt-${st}`} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Tìm số */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Tìm kiếm 3 số
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  maxLength={3}
                  value={searchNumber}
                  onChange={e => setSearchNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Nhập 1-3 số..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-slate-800 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* 5. Sắp xếp - Đưa ra các tùy chọn sắp xếp theo kiểu thứ */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1 flex items-center justify-between">
                <span>Sắp xếp ưu tiên</span>
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
              </label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="WEEKDAY_TARGET">📅 Sắp xếp theo Thứ đài theo dõi (Thứ 2 → CN)</option>
                <option value="WEEKDAY_SOURCE">🕒 Sắp xếp theo Thứ kỳ xổ nguồn (Thứ 2 → CN)</option>
                <option value="SIMILARITY">⭐ Độ tương đồng cao nhất</option>
                <option value="OCCURRENCES">🔁 Số lần lặp nhiều nhất</option>
                <option value="RECENT">⏱️ Kỳ quay gần nhất</option>
              </select>
            </div>
          </div>

          {/* Reset Filters button if any filter is active */}
          {(selectedWeekday !== 'ALL' ||
            similarityFilter !== 'ALL' ||
            sourceStationFilter !== 'ALL' ||
            suggestedStationFilter !== 'ALL' ||
            minOccurrences > 0 ||
            searchNumber.trim() !== '') && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-amber-700 font-medium">
                Đang áp dụng bộ lọc tùy chỉnh: {selectedWeekday !== 'ALL' ? `[${selectedWeekday}] ` : ''}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium underline transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Đặt lại tất cả bộ lọc</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Leads Output List / Weekday Grouped List */}
      {leads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-3">
          <p className="text-sm font-medium">
            {totalRecordsCount === 0
              ? 'Chưa có dữ liệu kết quả để trích xuất manh mối theo dõi.'
              : 'Chưa đủ dữ liệu các kỳ quay mới nhất để trích xuất manh mối theo dõi.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {onLoadSampleData && (
              <button
                type="button"
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
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
          </div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-3">
          <p className="text-sm font-medium">
            Không tìm thấy quan hệ theo dõi nào phù hợp với bộ lọc hiện tại.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Đặt lại tất cả bộ lọc</span>
          </button>
        </div>
      ) : viewMode === 'GROUPED_BY_WEEKDAY' ? (
        /* ================== CHẾ ĐỘ XEM GOM NHÓM THEO THỨ ================== */
        <div className="space-y-6">
          {groupedLeadsByWeekday.map((group) => {
            const theme = WEEKDAY_THEMES[group.day];
            const hasLeads = group.leads.length > 0;

            return (
              <div
                key={`weekday-group-${group.day}`}
                className={`border rounded-2xl overflow-hidden bg-white shadow-xs ${theme.border}`}
              >
                {/* Day Header */}
                <div
                  className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${theme.headerBg} ${theme.border}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                      <CalendarDays className={`w-5 h-5 ${theme.accentText}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-slate-900">
                          {group.day}
                        </h4>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText}`}
                        >
                          {group.leads.length} manh mối theo dõi
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Lịch mở thưởng XSMN:{' '}
                        <strong>{group.stations.join(', ')}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium">
                    {weekdayBasis === 'TARGET_STATION'
                      ? 'Dự đoán cho các đài mở thưởng vào Thứ này'
                      : 'Manh mối xuất phát từ kỳ quay nguồn của Thứ này'}
                  </div>
                </div>

                {/* Day Content */}
                <div className="p-4 sm:p-5">
                  {hasLeads ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                      {group.leads.map((lead, idx) => renderLeadCard(lead, idx))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs italic">
                      Chưa có manh mối theo dõi nào phù hợp cho {group.day}.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================== CHẾ ĐỘ XEM DANH SÁCH PHẲNG ================== */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Danh sách liên tục được sắp xếp theo:{' '}
              <strong className="text-slate-800">
                {sortBy === 'WEEKDAY_TARGET'
                  ? 'Thứ đài theo dõi (Thứ 2 → CN)'
                  : sortBy === 'WEEKDAY_SOURCE'
                  ? 'Thứ kỳ xổ nguồn (Thứ 2 → CN)'
                  : sortBy === 'SIMILARITY'
                  ? 'Độ tương đồng cao nhất'
                  : sortBy === 'OCCURRENCES'
                  ? 'Số lần lặp nhiều nhất'
                  : 'Kỳ quay gần nhất'}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
            {filteredLeads.map((lead, idx) => renderLeadCard(lead, idx))}
          </div>
        </div>
      )}

      {/* Guide Note Box on Similarity Examination */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 text-xs text-slate-600 space-y-2.5">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <Info className="w-4 h-4 text-blue-600" />
          <span>Nguyên Tắc Sắp Xếp Theo Kiểu Thứ & Tương Đồng Số Học Trong XSMN</span>
        </div>
        <p className="leading-relaxed">
          Phân tích dự đoán mẫu liên kết 3 số đầu của đài vừa xổ với 3 số cuối của đài mở thưởng kế tiếp theo chu kỳ lịch sử:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
          <li>
            <strong>Sắp xếp theo kiểu Thứ (Thứ 2 &rarr; Chủ nhật):</strong> Gom nhóm hoặc phân bổ kết quả theo ngày mở thưởng của đài đích (ví dụ: Long An xổ Thứ 7, Tiền Giang xổ Chủ nhật) hoặc theo ngày xổ của đài nguồn để người chơi dễ dàng theo dõi đúng ngày trong tuần.
          </li>
          <li>
            <strong>Trùng khớp 100% (3/3 số):</strong> Toàn bộ 3 chữ số trùng khớp chính xác từng vị trí (hàng trăm, hàng chục, hàng đơn vị).
          </li>
          <li>
            <strong>Đảo ngược thứ tự (85%):</strong> Đảo trực tiếp 3 chữ số (ví dụ: 123 ⇄ 321 hoặc 025 ⇄ 520, bảo toàn số 0).
          </li>
          <li>
            <strong>Hoán vị bộ 3 số (75%):</strong> Cùng chứa một tập hợp 3 chữ số nhưng sắp xếp đổi chéo vị trí (ví dụ: 123 ⇄ 231, 312).
          </li>
          <li>
            <strong>Trùng 2/3 chữ số (67%):</strong> Giữ nguyên 1 cặp số chủ lực giữa hai đài qua các chu kỳ.
          </li>
        </ul>
      </div>
    </div>
  );
};
