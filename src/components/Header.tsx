import React from 'react';
import { Database, FileSpreadsheet, Download, RefreshCw, BarChart2, Grid, Sparkles, Compass, Calendar, FilterX } from 'lucide-react';
import { LotteryRecord, NavigationTab } from '../types';
import { getRecordKey, getInvalidWeekdayRecords } from '../utils/storage';

interface HeaderProps {
  records: LotteryRecord[];
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onLoadSampleData: () => void;
  onExportCSV: () => void;
  onBackupJSON: () => void;
  onDeduplicateRecords?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  records,
  activeTab,
  setActiveTab,
  onLoadSampleData,
  onExportCSV,
  onBackupJSON,
  onDeduplicateRecords,
}) => {
  const uniqueStationsCount = new Set(records.map(r => r.station)).size;
  const uniqueDatesCount = new Set(records.map(r => r.date)).size;

  const { duplicateCount, invalidWeekdayCount, totalIssues } = React.useMemo(() => {
    const seen = new Set<string>();
    let dups = 0;
    for (const r of records) {
      const key = getRecordKey(r.date, r.station);
      if (seen.has(key)) {
        dups++;
      } else {
        seen.add(key);
      }
    }
    const invalidRecords = getInvalidWeekdayRecords(records);
    const invalidCount = invalidRecords.length;
    return {
      duplicateCount: dups,
      invalidWeekdayCount: invalidCount,
      totalIssues: dups + invalidCount,
    };
  }, [records]);

  return (
    <header id="main-header" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3.5 gap-4">
          {/* Brand & Title */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
                XS
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                  Phân Tích Xổ Số Đặc Biệt Miền Nam
                </h1>
                <p className="text-xs text-slate-500">
                  Đối chiếu quan hệ Đầu → Cuối giữa các đài qua nhiều chu kỳ lịch sử
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-medium">
              <span>Tổng: <strong className="text-slate-900">{records.length}</strong> bản ghi</span>
              <span className="text-slate-300">|</span>
              <span><strong className="text-slate-900">{uniqueStationsCount}</strong> đài</span>
              <span className="text-slate-300">|</span>
              <span><strong className="text-slate-900">{uniqueDatesCount}</strong> ngày</span>
            </div>

            {onDeduplicateRecords && (
              <button
                id="btn-dedup-header"
                onClick={onDeduplicateRecords}
                title={`Làm sạch dữ liệu: ${duplicateCount} bản ghi trùng cùng ngày + ${invalidWeekdayCount} bản ghi nhập sai thứ mở thưởng`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  totalIssues > 0
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 shadow-2xs font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <FilterX className="w-3.5 h-3.5 text-amber-600" />
                <span>Xóa trùng & sai thứ{totalIssues > 0 ? ` (${totalIssues})` : ''}</span>
              </button>
            )}

            <button
              id="btn-sample-data"
              onClick={onLoadSampleData}
              title="Nạp hơn 80 bản ghi mẫu xổ số miền Nam có sẵn các quan hệ lặp"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Nạp dữ liệu mẫu XSMN</span>
            </button>

            <button
              id="btn-export-csv"
              onClick={onExportCSV}
              title="Xuất file CSV dữ liệu"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất CSV</span>
            </button>

            <button
              id="btn-backup-json"
              onClick={onBackupJSON}
              title="Sao lưu toàn bộ dữ liệu ra file JSON"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Sao lưu JSON</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav id="nav-tabs" className="flex overflow-x-auto space-x-1 border-t border-slate-100 pt-1 pb-2 scrollbar-thin">
          <button
            id="tab-btn-analysis"
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'analysis'
                ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Phân Tích Đầu → Cuối</span>
          </button>

          <button
            id="tab-btn-matrix"
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Ma Trận Xoay Vòng Đài</span>
          </button>

          <button
            id="tab-btn-sameday"
            onClick={() => setActiveTab('sameday')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'sameday'
                ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Đài Xổ Chung Thứ</span>
          </button>

          <button
            id="tab-btn-patterns"
            onClick={() => setActiveTab('patterns')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'patterns'
                ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Phát Hiện Mẫu & Quy Luật</span>
          </button>

          <button
            id="tab-btn-prediction"
            onClick={() => setActiveTab('prediction')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'prediction'
                ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Dự Đoán Mẫu Lịch Sử</span>
          </button>

          <button
            id="tab-btn-data"
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'data'
                ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Quản Lý & Nhập Dữ Liệu</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
