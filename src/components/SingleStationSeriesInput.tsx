import React, { useState, useMemo } from 'react';
import { LotteryRecord, DayOfWeek } from '../types';
import { parseDateString, VIETNAMESE_DAYS, getVietnameseDayOfWeek } from '../utils/dateUtils';
import { extractHeadAndTail, XSMN_WEEKDAY_SCHEDULE, ALL_XSMN_STATIONS } from '../utils/lotteryAnalysis';
import {
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  Clock,
  RotateCcw,
  Check,
  Zap,
  Info
} from 'lucide-react';

interface SingleStationSeriesInputProps {
  existingRecords: LotteryRecord[];
  onAddBulkRecords: (newRecords: LotteryRecord[]) => void;
  onAddRecord?: (newRecord: LotteryRecord) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface StationDrawRow {
  id: string;
  dateStr: string; // YYYY-MM-DD
  dateDisplay: string; // DD/MM/YYYY
  dayOfWeek: DayOfWeek;
  rawNumber: string; // 6 digits
  head3: string;
  tail3: string;
  isValid: boolean;
  isDuplicate: boolean;
  error?: string;
}

export const SingleStationSeriesInput: React.FC<SingleStationSeriesInputProps> = ({
  existingRecords,
  onAddBulkRecords,
  showToast,
  isCollapsible = true,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [selectedStation, setSelectedStation] = useState<string>('TP.HCM');
  
  // Xác định ngày bắt đầu mặc định
  const defaultStartDate = useMemo(() => {
    // Tìm ngày gần nhất của đài này nếu đã có trong hệ thống
    const stationRecs = existingRecords.filter(r => r.station === selectedStation);
    if (stationRecs.length > 0) {
      const sorted = [...stationRecs].sort((a, b) => b.date.localeCompare(a.date));
      // Tự động nhảy +7 ngày từ ngày gần nhất
      const last = new Date(sorted[0].date);
      last.setDate(last.getDate() + 7);
      const yyyy = last.getFullYear();
      const mm = String(last.getMonth() + 1).padStart(2, '0');
      const dd = String(last.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [existingRecords, selectedStation]);

  const [startDateStr, setStartDateStr] = useState<string>(defaultStartDate);
  const [intervalWeeks, setIntervalWeeks] = useState<number>(1); // Mỗi tuần nhảy 1 lần (7 ngày)
  const [numDraws, setNumDraws] = useState<number>(4); // Khởi tạo sẵn 4 tuần (1 tháng)

  // Danh sách các dòng kỳ quay của đài
  const [drawRows, setDrawRows] = useState<StationDrawRow[]>(() => {
    return generateInitialRows('TP.HCM', defaultStartDate, 4, 1, existingRecords);
  });

  // Fast paste text (ví dụ người dùng dán 1 cột số: 123456, 789012, 025678...)
  const [pasteColumnText, setPasteColumnText] = useState<string>('');
  // Selected weekday for filtering stations
  const [selectedDayFilter, setSelectedDayFilter] = useState<DayOfWeek | null>(null);

  // Hàm sinh các hàng theo tuần
  function generateInitialRows(
    station: string,
    startIso: string,
    count: number,
    stepWeeks: number,
    records: LotteryRecord[]
  ): StationDrawRow[] {
    const rows: StationDrawRow[] = [];
    const baseDate = new Date(startIso.includes('-') ? startIso : '2026-09-17');

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i * (stepWeeks * 7));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const iso = `${yyyy}-${mm}-${dd}`;
      const display = `${dd}/${mm}/${yyyy}`;
      const dow = getVietnameseDayOfWeek(d);

      // Check if duplicate
      const isDup = records.some(
        r => r.date === iso && r.station.trim().toLowerCase() === station.trim().toLowerCase()
      );

      rows.push({
        id: `row-${station}-${iso}-${i}`,
        dateStr: iso,
        dateDisplay: display,
        dayOfWeek: dow,
        rawNumber: '',
        head3: '---',
        tail3: '---',
        isValid: false,
        isDuplicate: isDup,
      });
    }
    return rows;
  }

  // Khi người dùng đổi đài hoặc đổi ngày bắt đầu hoặc số lượng kỳ
  const handleRegenerateRows = (
    station: string = selectedStation,
    start: string = startDateStr,
    count: number = numDraws,
    step: number = intervalWeeks
  ) => {
    setDrawRows(generateInitialRows(station, start, count, step, existingRecords));
  };

  const handleStationChange = (newStation: string) => {
    setSelectedStation(newStation);
    handleRegenerateRows(newStation, startDateStr, numDraws, intervalWeeks);
  };

  const handleStartDateChange = (newDateStr: string) => {
    setStartDateStr(newDateStr);
    handleRegenerateRows(selectedStation, newDateStr, numDraws, intervalWeeks);
  };

  // Chọn thứ để ra các đài ngày đó và nhảy ngày đúng thứ
  const handleSelectDayAndStation = (targetDow: DayOfWeek, st: string) => {
    setSelectedDayFilter(targetDow);
    const today = new Date();
    let selDate = new Date(today);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (getVietnameseDayOfWeek(d) === targetDow) {
        selDate = d;
        break;
      }
    }
    const yyyy = selDate.getFullYear();
    const mm = String(selDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selDate.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;

    setSelectedStation(st);
    setStartDateStr(iso);
    handleRegenerateRows(st, iso, numDraws, intervalWeeks);
    showToast(`Đã chọn đài ${st} theo lịch ${targetDow}!`, 'info');
  };

  // Cập nhật giá trị số cho 1 dòng
  const handleRowNumberChange = (index: number, val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 6);
    setDrawRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      row.rawNumber = digitsOnly;
      if (digitsOnly.length === 6) {
        const { head3, tail3 } = extractHeadAndTail(digitsOnly);
        row.head3 = head3;
        row.tail3 = tail3;
        row.isValid = true;
        row.error = undefined;
      } else {
        row.head3 = digitsOnly.length >= 3 ? digitsOnly.slice(0, 3) : '---';
        row.tail3 = digitsOnly.length === 6 ? digitsOnly.slice(3, 6) : '---';
        row.isValid = false;
        row.error = digitsOnly.length > 0 ? `Cần đủ 6 chữ số (${digitsOnly.length}/6)` : undefined;
      }
      updated[index] = row;
      return updated;
    });
  };

  // Thêm 1 tuần kế tiếp (+7 ngày)
  const handleAddNextWeekRow = () => {
    const lastRow = drawRows[drawRows.length - 1];
    let nextDate: Date;
    if (lastRow) {
      nextDate = new Date(lastRow.dateStr);
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate = new Date();
    }
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const display = `${dd}/${mm}/${yyyy}`;
    const dow = getVietnameseDayOfWeek(nextDate);
    const isDup = existingRecords.some(r => r.date === iso && r.station === selectedStation);

    setDrawRows(prev => [
      ...prev,
      {
        id: `row-${selectedStation}-${iso}-${prev.length}`,
        dateStr: iso,
        dateDisplay: display,
        dayOfWeek: dow,
        rawNumber: '',
        head3: '---',
        tail3: '---',
        isValid: false,
        isDuplicate: isDup,
      },
    ]);
  };

  // Xóa 1 dòng khỏi danh sách tạm
  const handleRemoveRow = (index: number) => {
    setDrawRows(prev => prev.filter((_, i) => i !== index));
  };

  // Tự động phân bổ khi dán 1 cột số kết quả
  const handleApplyPastedNumbers = () => {
    if (!pasteColumnText.trim()) return;

    // Tìm tất cả chuỗi gồm 6 chữ số
    const matches = pasteColumnText.match(/\b\d{6}\b/g) || [];
    if (matches.length === 0) {
      // Thử lọc theo từng dòng chỉ giữ số
      const lines = pasteColumnText.split(/\r?\n/).map(l => l.replace(/\D/g, '')).filter(l => l.length === 6);
      if (lines.length > 0) {
        applyNumbersList(lines);
        return;
      }
      showToast('Không tìm thấy dãy 6 chữ số hợp lệ nào trong văn bản đã dán.', 'error');
      return;
    }

    applyNumbersList(matches);
  };

  const applyNumbersList = (numbers: string[]) => {
    setDrawRows(prev => {
      // Nếu số lượng kết quả dán vào nhiều hơn số hàng hiện có, tự động mở rộng thêm hàng
      let currentRows = [...prev];
      if (numbers.length > currentRows.length) {
        const lastRow = currentRows[currentRows.length - 1];
        let cursorDate = lastRow ? new Date(lastRow.dateStr) : new Date(startDateStr);

        for (let i = currentRows.length; i < numbers.length; i++) {
          cursorDate = new Date(cursorDate);
          cursorDate.setDate(cursorDate.getDate() + 7);
          const yyyy = cursorDate.getFullYear();
          const mm = String(cursorDate.getMonth() + 1).padStart(2, '0');
          const dd = String(cursorDate.getDate()).padStart(2, '0');
          const iso = `${yyyy}-${mm}-${dd}`;
          const isDup = existingRecords.some(
            r => r.date === iso && r.station.trim().toLowerCase() === selectedStation.trim().toLowerCase()
          );

          currentRows.push({
            id: `row-${selectedStation}-${iso}-${i}`,
            dateStr: iso,
            dateDisplay: `${dd}/${mm}/${yyyy}`,
            dayOfWeek: getVietnameseDayOfWeek(cursorDate),
            rawNumber: '',
            head3: '---',
            tail3: '---',
            isValid: false,
            isDuplicate: isDup,
          });
        }
      }

      // Điền số vào các dòng
      return currentRows.map((row, idx) => {
        if (idx < numbers.length) {
          const num = numbers[idx];
          const { head3, tail3 } = extractHeadAndTail(num);
          return {
            ...row,
            rawNumber: num,
            head3,
            tail3,
            isValid: true,
            error: undefined,
          };
        }
        return row;
      });
    });

    showToast(`Đã tự động điền ${numbers.length} kết quả vào danh sách các tuần của đài ${selectedStation}!`);
    setPasteColumnText('');
  };

  // Lưu toàn bộ các tuần hợp lệ vào hệ thống
  const handleSaveAllRows = () => {
    const validRows = drawRows.filter(r => r.isValid && r.rawNumber.length === 6);

    if (validRows.length === 0) {
      showToast('Chưa có kỳ nào nhập đủ 6 chữ số hợp lệ.', 'error');
      return;
    }

    const timestamp = Date.now();
    const newRecords: LotteryRecord[] = validRows.map((r, idx) => {
      const parsed = parseDateString(r.dateStr);
      return {
        id: `rec-${selectedStation}-${r.dateStr}-${timestamp}-${idx}`,
        date: r.dateStr,
        dateDisplay: r.dateDisplay,
        dayOfWeek: parsed.dayOfWeek,
        station: selectedStation,
        rawNumber: r.rawNumber,
        head3: r.head3,
        tail3: r.tail3,
        sessionIndex: existingRecords.length + idx + 1,
        createdAt: timestamp + idx,
      };
    });

    const duplicateCount = validRows.filter(r => r.isDuplicate).length;

    onAddBulkRecords(newRecords);
    if (duplicateCount > 0) {
      showToast(`Lưu thành công ${newRecords.length} kỳ của đài ${selectedStation} (tự động loại bỏ và ghi đè ${duplicateCount} kết quả cũ trùng ngày)!`);
    } else {
      showToast(`Lưu thành công ${newRecords.length} kỳ quay qua các tuần của đài ${selectedStation}!`);
    }

    // Reset lại và chuẩn bị cho các kỳ tiếp theo
    const lastRow = validRows[validRows.length - 1];
    const nextDate = new Date(lastRow.dateStr);
    nextDate.setDate(nextDate.getDate() + 7);
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    const nextIso = `${yyyy}-${mm}-${dd}`;
    setStartDateStr(nextIso);
    setDrawRows(generateInitialRows(selectedStation, nextIso, 4, 1, [...existingRecords, ...newRecords]));
  };

  // Thống kê số lượng kỳ hợp lệ sẵn sàng lưu
  const validCount = drawRows.filter(r => r.isValid).length;

  // Lịch quay theo thứ của đài đang chọn
  const stationMeta = ALL_XSMN_STATIONS.find(s => s.name === selectedStation);

  return (
    <div className="bg-white border-2 border-red-500/80 rounded-2xl shadow-md overflow-hidden transition-all">
      {/* Box Header */}
      <div
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
        className={`px-4 sm:px-5 py-3.5 bg-gradient-to-r from-red-600 via-red-700 to-rose-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isCollapsible ? 'cursor-pointer hover:bg-opacity-95' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center font-black shrink-0 border border-white/20 shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black tracking-wide">
                NHẬP LIÊN TỤC 1 ĐÀI QUA CÁC TUẦN LẦN XỔ
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                Mới
              </span>
            </div>
            <p className="text-xs text-red-100/90 mt-0.5">
              Chọn 1 đài duy nhất, hệ thống tự động nhảy cách tuần (+7 ngày) theo đúng lịch mở thưởng để nhập 4, 8, 12 kỳ liên tiếp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {validCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold text-xs shadow-xs flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Đã sẵn sàng {validCount} kỳ</span>
            </span>
          )}

          {isCollapsible && (
            <button
              type="button"
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-5 bg-slate-50/50">
          {/* Controls Bar: Chọn đài, ngày khởi điểm, số tuần */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
            {/* Quick Weekday to Stations Selector */}
            <div className="pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-red-600" />
                  <span>Chọn Thứ để lọc ra các đài mở thưởng ngày đó:</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Bấm thứ → ra các đài → bấm đài để nhập chuỗi tuần
                </span>
              </div>

              {/* 7 Weekday buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {VIETNAMESE_DAYS.map(dow => {
                  const dayStations = XSMN_WEEKDAY_SCHEDULE[dow] || [];
                  const isCurDow = (selectedDayFilter || getVietnameseDayOfWeek(startDateStr)) === dow;
                  return (
                    <button
                      key={`btn-filter-dow-${dow}`}
                      type="button"
                      onClick={() => {
                        setSelectedDayFilter(dow);
                        if (dayStations.length > 0) {
                          // If current station isn't in this day, pick the first station of this day
                          const nextStation = dayStations.includes(selectedStation) ? selectedStation : dayStations[0];
                          handleSelectDayAndStation(dow, nextStation);
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer border ${
                        isCurDow
                          ? 'bg-red-600 text-white border-red-600 shadow-2xs font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{dow}</span>
                      <span className="ml-1 opacity-80 text-[10px]">({dayStations.length} đài)</span>
                    </button>
                  );
                })}
              </div>

              {/* Stations of selected day */}
              {(() => {
                const activeDow = selectedDayFilter || getVietnameseDayOfWeek(startDateStr);
                const stationsOfDow = XSMN_WEEKDAY_SCHEDULE[activeDow] || [];
                return (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-red-50/60 p-2 rounded-lg border border-red-100">
                    <span className="text-[11px] font-bold text-red-800">
                      Các đài mở thưởng {activeDow}:
                    </span>
                    {stationsOfDow.map(st => (
                      <button
                        key={`chip-st-${st}`}
                        type="button"
                        onClick={() => handleSelectDayAndStation(activeDow, st)}
                        className={`text-xs px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer border ${
                          selectedStation === st
                            ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                            : 'bg-white text-slate-800 border-slate-300 hover:border-red-400 hover:text-red-700'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Chọn Đài */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn 1 đài cần nhập qua các tuần:
                </label>
                <select
                  value={selectedStation}
                  onChange={e => handleStationChange(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  {ALL_XSMN_STATIONS.map(st => (
                    <option key={`opt-st-${st.name}`} value={st.name}>
                      {st.name} ({st.days.join(', ')})
                    </option>
                  ))}
                </select>
                {stationMeta && (
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Lịch mở thưởng: <strong>{stationMeta.days.join(' & ')}</strong>
                  </span>
                )}
              </div>

              {/* 2. Ngày Bắt Đầu (Kỳ Đầu Tiên) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ngày bắt đầu (kỳ 1):
                </label>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={e => handleStartDateChange(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Thứ: <strong>{getVietnameseDayOfWeek(startDateStr)}</strong>
                </span>
              </div>

              {/* 3. Số Lượng Kỳ / Tuần Chuẩn Bị */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số kỳ quay liên tiếp:
                </label>
                <div className="flex items-center gap-1.5">
                  {[4, 8, 12].map(n => (
                    <button
                      key={`btn-num-${n}`}
                      type="button"
                      onClick={() => {
                        setNumDraws(n);
                        handleRegenerateRows(selectedStation, startDateStr, n, intervalWeeks);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        numDraws === n
                          ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {n} tuần
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Tự động sinh {numDraws} tuần tương ứng
                </span>
              </div>

              {/* 4. Thao tác dán nhanh cả cột */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dán nhanh cột số kết quả:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="VD: 123456 025678 789123"
                    value={pasteColumnText}
                    onChange={e => setPasteColumnText(e.target.value)}
                    className="flex-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-red-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPastedNumbers}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors shrink-0 cursor-pointer"
                    title="Điền tự động lần lượt vào các tuần"
                  >
                    Điền
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Dán nhiều số cách nhau bằng dấu cách hoặc dòng
                </span>
              </div>
            </div>
          </div>

          {/* DANH SÁCH CÁC TUẦN CỦA ĐÀI */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Danh Sách Các Tuần Lần Xổ — Đài: <span className="text-red-600 font-black">{selectedStation}</span>
                </span>
                <span className="text-[11px] text-slate-500">({drawRows.length} kỳ)</span>
              </div>

              <button
                type="button"
                onClick={handleAddNextWeekRow}
                className="text-xs font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm 1 tuần kế tiếp (+7 ngày)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {drawRows.map((row, idx) => {
                const hasInput = row.rawNumber.length > 0;

                return (
                  <div
                    key={row.id}
                    className={`bg-white rounded-xl p-3 border transition-all shadow-2xs relative ${
                      row.isValid
                        ? 'border-emerald-400 ring-1 ring-emerald-400/40'
                        : row.error
                        ? 'border-rose-300 bg-rose-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header card: Tuần số X & Ngày */}
                    <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="text-xs font-bold text-slate-800">
                          <span>{row.dayOfWeek}</span>, <span className="text-slate-500 font-normal">{row.dateDisplay}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="text-slate-300 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        title="Xóa kỳ này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Ô nhập số giải đặc biệt 6 chữ số */}
                    <div className="space-y-1.5">
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Nhập 6 số..."
                          value={row.rawNumber}
                          onChange={e => handleRowNumberChange(idx, e.target.value)}
                          className={`w-full text-center text-lg font-mono font-black tracking-widest rounded-lg px-2 py-1.5 border transition-all focus:outline-none ${
                            row.isValid
                              ? 'bg-emerald-50/50 border-emerald-400 text-emerald-800 focus:ring-2 focus:ring-emerald-500'
                              : row.error
                              ? 'bg-rose-50/50 border-rose-300 text-rose-800 focus:ring-2 focus:ring-rose-500'
                              : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500'
                          }`}
                        />
                        {row.isValid && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-2.5 top-2.5 pointer-events-none" />
                        )}
                      </div>

                      {/* Head and Tail preview */}
                      <div className="grid grid-cols-2 gap-1 text-center text-[10px]">
                        <div className="bg-blue-50/80 rounded py-1 border border-blue-100 text-blue-800">
                          <span className="block opacity-75 font-medium">3 số đầu:</span>
                          <span className="font-mono font-bold text-xs">{row.head3}</span>
                        </div>
                        <div className="bg-purple-50/80 rounded py-1 border border-purple-100 text-purple-800">
                          <span className="block opacity-75 font-medium">3 số cuối:</span>
                          <span className="font-mono font-bold text-xs">{row.tail3}</span>
                        </div>
                      </div>

                      {/* Warning if date already has record */}
                      {row.isDuplicate && (
                        <div className="text-[10px] text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200 text-center font-medium">
                          ⚠️ Đã có kết quả (lưu sẽ tự ghi đè số mới)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Bar: Nút Lưu Toàn Bộ Kỳ */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Sparkles className="w-4 h-4 text-red-600" />
              <span>
                Đã nhập hợp lệ <strong>{validCount}</strong> / {drawRows.length} kỳ của đài <strong>{selectedStation}</strong>.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRegenerateRows()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>

              <button
                type="button"
                disabled={validCount === 0}
                onClick={handleSaveAllRows}
                className={`px-5 py-2 font-black text-xs sm:text-sm rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  validCount > 0
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Lưu {validCount} Kỳ Quay Vào Hệ Thống Đối Chiếu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
