import React, { useState, useMemo, useEffect } from 'react';
import { LotteryRecord, DayOfWeek } from '../types';
import { parseDateString, VIETNAMESE_DAYS, getVietnameseDayOfWeek } from '../utils/dateUtils';
import { extractHeadAndTail, XSMN_WEEKDAY_SCHEDULE } from '../utils/lotteryAnalysis';
import {
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  Sparkles
} from 'lucide-react';

interface WeekdayClusterInputProps {
  existingRecords: LotteryRecord[];
  onAddBulkRecords: (newRecords: LotteryRecord[]) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

interface WeekdayConfigItem {
  dow: DayOfWeek;
  shortLabel: string;
  count: number;
  stations: string[];
}

const WEEKDAYS_CONFIG: WeekdayConfigItem[] = [
  { dow: 'Thứ 2', shortLabel: 'T2', count: 3, stations: ['TP.HCM', 'Đồng Tháp', 'Cà Mau'] },
  { dow: 'Thứ 3', shortLabel: 'T3', count: 3, stations: ['Bến Tre', 'Vũng Tàu', 'Bạc Liêu'] },
  { dow: 'Thứ 4', shortLabel: 'T4', count: 3, stations: ['Đồng Nai', 'Cần Thơ', 'Sóc Trăng'] },
  { dow: 'Thứ 5', shortLabel: 'T5', count: 3, stations: ['Tây Ninh', 'An Giang', 'Bình Thuận'] },
  { dow: 'Thứ 6', shortLabel: 'T6', count: 3, stations: ['Vĩnh Long', 'Bình Dương', 'Trà Vinh'] },
  { dow: 'Thứ 7', shortLabel: 'T7', count: 4, stations: ['TP.HCM', 'Long An', 'Bình Phước', 'Hậu Giang'] },
  { dow: 'Chủ nhật', shortLabel: 'CN', count: 3, stations: ['Tiền Giang', 'Kiên Giang', 'Đà Lạt'] },
];

export const WeekdayClusterInput: React.FC<WeekdayClusterInputProps> = ({
  existingRecords,
  onAddBulkRecords,
  showToast,
}) => {
  // Current selected date (default to today or latest record date)
  const initialDate = useMemo(() => {
    if (existingRecords.length > 0) {
      const sorted = [...existingRecords].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0].date;
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [existingRecords]);

  const [dateStr, setDateStr] = useState<string>(initialDate);
  const [fastPasteText, setFastPasteText] = useState<string>('');
  const [autoAdvanceDay, setAutoAdvanceDay] = useState<boolean>(true);

  // Parse date and day of week
  const parsedDate = useMemo(() => parseDateString(dateStr), [dateStr]);

  // Scheduled stations for the current day of week
  const defaultStations = useMemo(() => {
    if (!parsedDate.valid) return ['TP.HCM', 'Đồng Tháp', 'Cà Mau'];
    const scheduled = XSMN_WEEKDAY_SCHEDULE[parsedDate.dayOfWeek];
    return scheduled && scheduled.length > 0 ? scheduled : ['TP.HCM'];
  }, [parsedDate]);

  // Active stations for this input batch
  const [activeStations, setActiveStations] = useState<string[]>(defaultStations);

  // Sync active stations whenever the day of week changes
  useEffect(() => {
    setActiveStations(defaultStations);
  }, [defaultStations]);

  // Numbers keyed by station name: { [station: string]: string }
  const [stationNumbers, setStationNumbers] = useState<Record<string, string>>({});

  // Reset or initialize station numbers when activeStations change
  const handleNumberChange = (station: string, val: string) => {
    const cleanDigits = val.replace(/\D/g, '').slice(0, 6);
    setStationNumbers(prev => ({
      ...prev,
      [station]: cleanDigits,
    }));
  };

  // Fast paste handler: extracts up to N 6-digit numbers and fills into stations
  const handleProcessFastPaste = (textToProcess?: string) => {
    const text = textToProcess !== undefined ? textToProcess : fastPasteText;
    if (!text.trim()) return;

    const newNumbers: Record<string, string> = { ...stationNumbers };

    // Check for named stations first (e.g. "TP.HCM: 123456" or "Long An 025678")
    for (const st of activeStations) {
      const escapedSt = st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`${escapedSt}[^0-9]*(\\d{6})`, 'i');
      const match = text.match(reg);
      if (match && match[1]) {
        newNumbers[st] = match[1];
      }
    }

    // Extract raw numbers if not matched by name
    const rawMatches = text.match(/\b\d{6}\b/g) || [];
    if (rawMatches.length > 0) {
      let matchIdx = 0;
      for (const st of activeStations) {
        if (!newNumbers[st] && matchIdx < rawMatches.length) {
          newNumbers[st] = rawMatches[matchIdx];
          matchIdx++;
        }
      }
    }

    setStationNumbers(newNumbers);
    showToast(`Đã tự động điền số cho các đài từ nội dung dán!`, 'info');
  };

  // Change date by offset in days (e.g. +1 day, -1 day, +7 days, -7 days)
  const adjustDate = (days: number, silent = false) => {
    if (!parsedDate.valid) return;
    const parts = dateStr.split('-');
    const cur = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    cur.setDate(cur.getDate() + days);
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const nextIso = `${yyyy}-${mm}-${dd}`;
    setDateStr(nextIso);
    setStationNumbers({});
    setFastPasteText('');

    if (!silent) {
      const nextParsed = parseDateString(nextIso);
      const nextStations = XSMN_WEEKDAY_SCHEDULE[nextParsed.dayOfWeek] || [];
      if (days === 1) {
        showToast(`Đã chuyển sang ngày kế tiếp (+1 ngày): ${nextParsed.dayOfWeek} (${nextParsed.display}) - Mở ${nextStations.length} đài!`, 'info');
      } else if (days === -1) {
        showToast(`Đã lùi về ngày trước (-1 ngày): ${nextParsed.dayOfWeek} (${nextParsed.display})!`, 'info');
      }
    }
  };

  // Click on a specific weekday (Thứ 2 -> Chủ Nhật)
  // Automatically selects that weekday, calculates the most recent date for it, and shows its stations
  const handleSelectWeekday = (targetDow: DayOfWeek) => {
    const today = new Date();
    let selectedDate = new Date(today);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (getVietnameseDayOfWeek(d) === targetDow) {
        selectedDate = d;
        break;
      }
    }

    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;

    setDateStr(iso);

    const scheduled = XSMN_WEEKDAY_SCHEDULE[targetDow] || [];
    setActiveStations(scheduled.length > 0 ? scheduled : ['TP.HCM']);
    setStationNumbers({});
    setFastPasteText('');

    showToast(`Đã chọn ${targetDow}: Mở ${scheduled.length} đài (${scheduled.join(', ')})!`, 'info');
  };

  // Quick recent dates for the currently selected day of week (up to 4 past weeks)
  const recentDatesForCurrentDow = useMemo(() => {
    if (!parsedDate.valid) return [];
    const currentDow = parsedDate.dayOfWeek;
    const dates: { iso: string; display: string; label: string }[] = [];

    const today = new Date();
    let latest = new Date(today);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (getVietnameseDayOfWeek(d) === currentDow) {
        latest = d;
        break;
      }
    }

    for (let w = 0; w < 4; w++) {
      const d = new Date(latest);
      d.setDate(d.getDate() - w * 7);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const iso = `${yyyy}-${mm}-${dd}`;
      const display = `${dd}/${mm}/${yyyy}`;
      const label = w === 0 ? 'Kỳ gần nhất' : w === 1 ? 'Tuần trước' : `${w} tuần trước`;
      dates.push({ iso, display, label });
    }

    return dates;
  }, [parsedDate.valid, parsedDate.dayOfWeek]);

  // Validation status for each station
  const stationStatuses = useMemo(() => {
    return activeStations.map(st => {
      const num = stationNumbers[st] || '';
      const split = extractHeadAndTail(num);
      const existingMatch = existingRecords.find(
        r => r.date === parsedDate.iso && r.station.trim().toLowerCase() === st.trim().toLowerCase()
      );
      return {
        station: st,
        rawNumber: num,
        split,
        isValid: split.valid,
        isAlreadyExisting: !!existingMatch,
        existingNumber: existingMatch?.rawNumber || '',
      };
    });
  }, [activeStations, stationNumbers, existingRecords, parsedDate.iso]);

  const validEntries = useMemo(() => {
    return stationStatuses.filter(s => s.isValid);
  }, [stationStatuses]);

  // Handle Save All stations of this weekday
  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsedDate.valid) {
      showToast('Ngày quay không hợp lệ!', 'error');
      return;
    }

    if (validEntries.length === 0) {
      showToast('Vui lòng nhập ít nhất 1 đài có kết quả 6 số hợp lệ!', 'error');
      return;
    }

    const newRecords: LotteryRecord[] = validEntries.map((item, idx) => ({
      id: `rec-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      date: parsedDate.iso,
      dateDisplay: parsedDate.display,
      dayOfWeek: parsedDate.dayOfWeek,
      station: item.station,
      rawNumber: item.rawNumber,
      head3: item.split.head3,
      tail3: item.split.tail3,
      sessionIndex: 0,
      createdAt: Date.now() + idx,
    }));

    const duplicateCount = validEntries.filter(e => e.isAlreadyExisting).length;

    onAddBulkRecords(newRecords);
    if (duplicateCount > 0) {
      showToast(
        `Đã lưu kết quả ${newRecords.length} đài ${parsedDate.dayOfWeek} ngày ${parsedDate.display} (tự động loại bỏ và ghi đè ${duplicateCount} kết quả cũ trùng ngày đài)!`,
        'success'
      );
    } else {
      showToast(
        `Đã lưu thành công kết quả ${newRecords.length} đài ${parsedDate.dayOfWeek} ngày ${parsedDate.display}!`,
        'success'
      );
    }

    // Reset inputs
    setStationNumbers({});
    setFastPasteText('');

    // Tự động chuyển sang 1 ngày kế tiếp (+1 ngày) sau khi lưu
    if (autoAdvanceDay) {
      adjustDate(1);
    }
  };

  // Add custom station to this weekday cluster
  const [customStationName, setCustomStationName] = useState<string>('');
  const handleAddCustomStation = () => {
    if (!customStationName.trim()) return;
    if (!activeStations.includes(customStationName.trim())) {
      setActiveStations(prev => [...prev, customStationName.trim()]);
    }
    setCustomStationName('');
  };

  const handleRemoveStation = (stToRemove: string) => {
    setActiveStations(prev => prev.filter(st => st !== stToRemove));
    setStationNumbers(prev => {
      const next = { ...prev };
      delete next[stToRemove];
      return next;
    });
  };

  return (
    <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* SECTION 1: PROMINENT WEEKDAY SELECTOR (CHỌN THỨ LÀ RA CÁC ĐÀI NGÀY ĐÓ ĐỂ NHẬP) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-black shadow-2xs">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Chọn Thứ → Ra Các Đài Ngày Đó Để Nhập</span>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[11px]">
                  XSMN Chuẩn
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Bấm chọn bất kỳ Thứ nào dưới đây, hệ thống sẽ mở ngay tất cả các đài xổ số của ngày đó để bạn nhập số.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-500">Đang chọn:</span>
            <div className="text-xs font-bold text-red-600 flex items-center gap-1 sm:justify-end">
              <span>{parsedDate.dayOfWeek}</span>
              <span>— {activeStations.length} Đài</span>
            </div>
          </div>
        </div>

        {/* 7 Weekday Buttons Row / Grid */}
        <div>
          <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
            <span>BƯỚC 1: BẤM CHỌN THỨ TRONG TUẦN</span>
            <span className="text-slate-400 font-normal">Thứ 7 có 4 đài, các thứ khác có 3 đài</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {WEEKDAYS_CONFIG.map(cfg => {
              const isSelected = parsedDate.valid && parsedDate.dayOfWeek === cfg.dow;
              return (
                <button
                  key={`btn-dow-${cfg.dow}`}
                  type="button"
                  onClick={() => handleSelectWeekday(cfg.dow)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                    isSelected
                      ? 'bg-red-600 text-white border-red-600 shadow-sm ring-2 ring-red-300'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-black text-sm">
                      {cfg.dow}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : cfg.count === 4
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cfg.count} đài
                    </span>
                  </div>

                  <div
                    className={`text-[10px] leading-tight line-clamp-2 ${
                      isSelected ? 'text-red-100' : 'text-slate-500'
                    }`}
                    title={cfg.stations.join(', ')}
                  >
                    {cfg.stations.join(' • ')}
                  </div>

                  {isSelected && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white shadow-xs" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: DATE SELECTOR & RECENT DRAW DATES FOR THIS WEEKDAY */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-red-600" />
                <span>BƯỚC 2: CHỌN NGÀY ({parsedDate.dayOfWeek}):</span>
              </span>

              {/* Quick Pills for Recent Weeks of this day */}
              <div className="flex flex-wrap items-center gap-1.5">
                {recentDatesForCurrentDow.map(item => {
                  const isCurrent = dateStr === item.iso;
                  return (
                    <button
                      key={`recent-d-${item.iso}`}
                      type="button"
                      onClick={() => {
                        setDateStr(item.iso);
                        setStationNumbers({});
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                        isCurrent
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                      title={`Xem ngày ${item.display}`}
                    >
                      <span>{item.label}: </span>
                      <strong className="font-mono">{item.display}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Input & Steppers */}
            <div className="flex items-center gap-1.5 self-start lg:self-auto">
              <span className="text-[11px] text-slate-500 font-medium">Hoặc ngày khác:</span>
              <input
                type="date"
                value={dateStr}
                onChange={e => {
                  setDateStr(e.target.value);
                  setStationNumbers({});
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
              />

              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => adjustDate(-1)}
                  className="px-2 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                  title="Lùi 1 ngày (-1 ngày)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>-1 Ngày</span>
                </button>
                <button
                  type="button"
                  onClick={() => adjustDate(1)}
                  className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors cursor-pointer flex items-center gap-0.5 shadow-2xs"
                  title="Chuyển sang 1 ngày kế tiếp (+1 ngày)"
                >
                  <span>+1 Ngày kế tiếp</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => adjustDate(-7)}
                  className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-white rounded transition-colors cursor-pointer"
                  title="Lùi 1 tuần (-7 ngày)"
                >
                  -7N
                </button>
                <button
                  type="button"
                  onClick={() => adjustDate(7)}
                  className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-white rounded transition-colors cursor-pointer"
                  title="Tiến 1 tuần (+7 ngày)"
                >
                  +7N
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Paste Bar for all stations of this day */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={fastPasteText}
                onChange={e => {
                  setFastPasteText(e.target.value);
                  handleProcessFastPaste(e.target.value);
                }}
                placeholder={`Dán nhanh kết quả cả ${activeStations.length} đài (VD: 123456 025678 789123)...`}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => handleProcessFastPaste()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Phân bổ tự động</span>
            </button>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Tự động điền theo thứ tự các đài: {activeStations.join(', ')}.
          </span>
        </div>
      </div>

      {/* SECTION 3: STATIONS INPUT FORM (TỰ ĐỘNG HIỆN RA CÁC ĐÀI CỦA NGÀY THỨ ĐÓ ĐỂ NHẬP) */}
      <form onSubmit={handleSaveAll} className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                3
              </span>
              <span>BƯỚC 3: NHẬP SỐ CHO CÁC ĐÀI NGÀY {parsedDate.dayOfWeek.toUpperCase()} ({parsedDate.display})</span>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500">Cụm đài:</span>
              <span className="font-bold text-slate-800">{activeStations.join(' • ')}</span>
            </div>
          </div>

          {/* Grid of station inputs */}
          <div className={`grid grid-cols-1 ${activeStations.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
            {stationStatuses.map((item, index) => {
              return (
                <div
                  key={`st-input-${item.station}`}
                  className={`bg-white rounded-xl border p-3.5 shadow-xs transition-all relative ${
                    item.isValid
                      ? 'border-emerald-400 ring-2 ring-emerald-100'
                      : item.rawNumber.length > 0
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Station Title & Badge */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-red-100 text-red-800 font-black text-[11px] flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        Đài {item.station}
                      </span>
                    </div>

                    {/* Remove station button if custom */}
                    {activeStations.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStation(item.station)}
                        title={`Xóa đài ${item.station} khỏi lượt nhập này`}
                        className="text-slate-300 hover:text-rose-500 p-0.5 rounded cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 6-Digit Input */}
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="VD: 025678"
                      value={item.rawNumber}
                      onChange={e => handleNumberChange(item.station, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-base sm:text-lg text-slate-900 font-mono font-black tracking-widest text-center focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                    {item.rawNumber.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleNumberChange(item.station, '')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 p-1"
                        title="Xóa số"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Split preview: Head3 and Tail3 */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">
                        Đầu: <strong className="font-mono text-blue-700">{item.split.head3 || '---'}</strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500">
                        Đuôi: <strong className="font-mono text-purple-700">{item.split.tail3 || '---'}</strong>
                      </span>
                    </div>

                    {item.isValid ? (
                      <span className="text-emerald-600 font-semibold inline-flex items-center gap-0.5 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Hợp lệ
                      </span>
                    ) : item.rawNumber.length > 0 ? (
                      <span className="text-amber-600 font-medium text-[10px]">
                        {item.rawNumber.length}/6 số
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Chờ nhập</span>
                    )}
                  </div>

                  {/* Existing record warning badge */}
                  {item.isAlreadyExisting && (
                    <div className="mt-2 py-1 px-1.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-800 flex items-center justify-between gap-1 font-medium">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>Đã có KQ ({item.existingNumber})</span>
                      </span>
                      <span className="font-bold text-amber-700">Tự ghi đè</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add custom station option if user wants extra */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Thêm đài khác nếu có..."
              value={customStationName}
              onChange={e => setCustomStationName(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <button
              type="button"
              onClick={handleAddCustomStation}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer border border-slate-200"
            >
              <Plus className="w-3 h-3" />
              <span>Thêm đài</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveStations(defaultStations)}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Khôi phục cụm đài chuẩn ({parsedDate.dayOfWeek})
          </button>
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Trạng thái:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                validEntries.length === activeStations.length
                  ? 'bg-emerald-100 text-emerald-800'
                  : validEntries.length > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                Đã nhập {validEntries.length} / {activeStations.length} đài
              </span>
            </div>

            {/* Auto advance day checkbox */}
            <label className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer select-none bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <input
                type="checkbox"
                checked={autoAdvanceDay}
                onChange={e => setAutoAdvanceDay(e.target.checked)}
                className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-emerald-900 flex items-center gap-1">
                <span>Tự động chuyển sang 1 ngày kế tiếp sau khi lưu</span>
                <span className="text-[11px] font-medium text-emerald-700">(+1 ngày)</span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStationNumbers({});
                setFastPasteText('');
              }}
              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              Xóa trắng
            </button>

            <button
              type="button"
              onClick={() => adjustDate(1)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Bỏ qua hoặc chuyển sang 1 ngày kế tiếp (+1 ngày)"
            >
              <span>Sang ngày kế (+1)</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>

            <button
              type="submit"
              disabled={validEntries.length === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer ${
                validEntries.length > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Lưu kết quả cả {activeStations.length} đài {parsedDate.dayOfWeek} (Ngày {parsedDate.display})
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
