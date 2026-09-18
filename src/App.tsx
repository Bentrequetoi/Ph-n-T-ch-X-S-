import React, { useState, useEffect, useMemo } from 'react';
import { LotteryRecord, DrawRelation, NavigationTab } from './types';
import {
  loadStoredRecords,
  saveStoredRecords,
  clearAllStoredRecords,
  exportRecordsToCSV,
  exportBackupJSON,
  getRecordKey,
  deduplicateRecords,
} from './utils/storage';
import { getSampleLotteryRecords } from './data/sampleData';
import {
  analyzeHeadToTailRelations,
  analyzeTailToTailRelations,
  generatePatternTrackingLeads,
} from './utils/lotteryAnalysis';
import { Header } from './components/Header';
import { RelationTable } from './components/RelationTable';
import { RotationMatrix } from './components/RotationMatrix';
import { SameDayAnalysis } from './components/SameDayAnalysis';
import { PatternDetection } from './components/PatternDetection';
import { PatternPrediction } from './components/PatternPrediction';
import { DataManager } from './components/DataManager';
import { DetailModal } from './components/DetailModal';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  // Stored Records
  const [records, setRecords] = useState<LotteryRecord[]>(() => loadStoredRecords());

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<NavigationTab>('analysis');

  // Top-level Toast Notification
  const [appToast, setAppToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showAppToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAppToast({ text, type });
    setTimeout(() => {
      setAppToast(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Detail Modal for drill-down into any relation/matrix/pattern
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    relations: DrawRelation[];
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    relations: [],
  });

  // Save records to LocalStorage whenever records change
  useEffect(() => {
    saveStoredRecords(records);
  }, [records]);

  // Compute Full Head -> Tail Analysis (now contains both head-to-tail and tail-to-tail patterns!)
  const analysisResult = useMemo(() => {
    return analyzeHeadToTailRelations(records);
  }, [records]);

  // Compute Tail -> Tail Analysis for dedicated 3-tail matrix and statistics
  const tailAnalysisResult = useMemo(() => {
    return analyzeTailToTailRelations(records);
  }, [records]);

  // Compute Pattern Follow-up Leads (Dự đoán mẫu lịch sử)
  const predictionLeads = useMemo(() => {
    return generatePatternTrackingLeads(
      records,
      analysisResult.repeatedSummaries,
      analysisResult.patterns
    );
  }, [records, analysisResult]);

  // Open detail modal helper
  const handleOpenDetails = (title: string, subtitle: string, rels: DrawRelation[]) => {
    setModalState({
      isOpen: true,
      title,
      subtitle,
      relations: rels,
    });
  };

  const handleCloseDetails = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Actions
  const handleLoadSampleData = () => {
    const samples = getSampleLotteryRecords();
    setRecords(samples);
    saveStoredRecords(samples);
    showAppToast(`Đã nạp thành công ${samples.length} bản ghi mẫu XSMN với đầy đủ quan hệ đầu → cuối giữa các đài.`);
  };

  const handleExportCSV = () => {
    exportRecordsToCSV(records);
    showAppToast('Đã xuất thành công file CSV dữ liệu kết quả.');
  };

  const handleBackupJSON = () => {
    exportBackupJSON(records);
    showAppToast('Đã xuất thành công file sao lưu JSON.');
  };

  const handleAddRecord = (newRec: LotteryRecord) => {
    setRecords(prev => {
      const key = getRecordKey(newRec.date, newRec.station);
      // Loại bỏ kết quả cũ nếu trùng ngày và đài, ghi đè bằng kết quả mới
      const filtered = prev.filter(r => getRecordKey(r.date, r.station) !== key);
      return [...filtered, newRec].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const handleAddBulkRecords = (newRecs: LotteryRecord[]) => {
    setRecords(prev => {
      // Gộp dữ liệu và tự động loại bỏ kết quả trùng cùng ngày & đài, giữ bản ghi mới nhất
      const map = new Map<string, LotteryRecord>();
      prev.forEach(r => map.set(getRecordKey(r.date, r.station), r));
      newRecs.forEach(r => map.set(getRecordKey(r.date, r.station), r));
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const handleDeduplicateRecords = () => {
    const result = deduplicateRecords(records, { removeInvalidWeekdays: true });
    if (result.duplicatesRemoved > 0) {
      setRecords(result.cleanRecords);
      saveStoredRecords(result.cleanRecords);
      const details: string[] = [];
      if (result.sameDayDuplicatesRemoved > 0) {
        details.push(`${result.sameDayDuplicatesRemoved} trùng cùng ngày`);
      }
      if (result.crossDateWrongWeekdayRemoved > 0) {
        details.push(`${result.crossDateWrongWeekdayRemoved} trùng khác ngày sai thứ`);
      }
      if (result.invalidWeekdayRemoved > 0) {
        details.push(`${result.invalidWeekdayRemoved} sai lịch xổ`);
      }
      const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
      showAppToast(`Đã làm sạch & xóa trùng thành công: Đã loại bỏ ${result.duplicatesRemoved} kết quả${detailStr}!`);
    } else {
      showAppToast('Dữ liệu hoàn toàn sạch: Không có kết quả nào bị trùng ngày hoặc sai thứ mở thưởng.', 'info');
    }
  };

  const handleDeleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleDeleteMultipleRecords = (ids: string[]) => {
    const idSet = new Set(ids);
    setRecords(prev => prev.filter(r => !idSet.has(r.id)));
  };

  const handleClearAll = () => {
    setRecords([]);
    clearAllStoredRecords();
    showAppToast('Đã xóa toàn bộ dữ liệu lịch sử khỏi hệ thống.');
  };

  const handleRestoreJSON = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const recs = parsed.records || parsed;
      if (Array.isArray(recs) && recs.length > 0) {
        setRecords(recs);
        saveStoredRecords(recs);
        showAppToast(`Khôi phục thành công ${recs.length} bản ghi từ file sao lưu JSON.`);
      } else {
        showAppToast('File JSON không chứa danh sách bản ghi hợp lệ.', 'error');
      }
    } catch (err) {
      showAppToast('Lỗi định dạng file JSON. Vui lòng kiểm tra lại file sao lưu.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Application Header */}
      <Header
        records={records}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLoadSampleData={handleLoadSampleData}
        onExportCSV={handleExportCSV}
        onBackupJSON={handleBackupJSON}
        onDeduplicateRecords={handleDeduplicateRecords}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'analysis' && (
          <RelationTable
            relations={analysisResult.allRelations}
            repeatedSummaries={analysisResult.repeatedSummaries}
            uniqueStations={analysisResult.stationsList}
            totalRecordsCount={records.length}
            records={records}
            onAddBulkRecords={handleAddBulkRecords}
            onShowToast={showAppToast}
            onLoadSampleData={handleLoadSampleData}
            onNavigateToData={() => setActiveTab('data')}
            onViewDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'matrix' && (
          <RotationMatrix
            stations={analysisResult.stationsList}
            matrix={analysisResult.matrix}
            tailMatrix={tailAnalysisResult.matrix}
            totalRecordsCount={records.length}
            onLoadSampleData={handleLoadSampleData}
            onNavigateToData={() => setActiveTab('data')}
            onViewDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'sameday' && (
          <SameDayAnalysis
            records={records}
            onLoadSampleData={handleLoadSampleData}
            onNavigateToData={() => setActiveTab('data')}
          />
        )}

        {activeTab === 'patterns' && (
          <PatternDetection
            patterns={analysisResult.patterns}
            records={records}
            totalRecordsCount={records.length}
            onLoadSampleData={handleLoadSampleData}
            onNavigateToData={() => setActiveTab('data')}
            onViewDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'prediction' && (
          <PatternPrediction
            leads={predictionLeads}
            relations={analysisResult.allRelations}
            uniqueStations={analysisResult.stationsList}
            totalRecordsCount={records.length}
            onLoadSampleData={handleLoadSampleData}
            onNavigateToData={() => setActiveTab('data')}
            onViewDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'data' && (
          <DataManager
            records={records}
            onAddRecord={handleAddRecord}
            onAddBulkRecords={handleAddBulkRecords}
            onDeleteRecord={handleDeleteRecord}
            onDeleteMultipleRecords={handleDeleteMultipleRecords}
            onDeduplicateRecords={handleDeduplicateRecords}
            onClearAll={handleClearAll}
            onRestoreJSON={handleRestoreJSON}
          />
        )}
      </main>

      {/* Drill-Down Evidence Modal */}
      <DetailModal
        isOpen={modalState.isOpen}
        onClose={handleCloseDetails}
        title={modalState.title}
        subtitle={modalState.subtitle}
        relations={modalState.relations}
      />

      {/* App-level Toast Notification */}
      {appToast && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl border bg-slate-900 text-white text-xs border-slate-700 animate-in slide-in-from-bottom-2 duration-200">
          {appToast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="font-medium">{appToast.text}</span>
          <button
            onClick={() => setAppToast(null)}
            className="ml-2 text-slate-400 hover:text-white p-0.5"
            title="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Phần Mềm Quản Lý & Phân Tích Xổ Số Đặc Biệt Miền Nam &mdash; Số Học Dữ Liệu Lịch Sử</span>
          <span className="text-[11px] text-slate-400">
            Bảo toàn số 0 ở đầu &bull; Bảng thống kê riêng các đài xổ chung thứ &bull; Đối chiếu Đầu &rarr; Cuối đa chu kỳ
          </span>
        </div>
      </footer>
    </div>
  );
}
