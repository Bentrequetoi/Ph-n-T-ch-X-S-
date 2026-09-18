import React, { useState } from 'react';
import { StationMatrixCell, DrawRelation } from '../types';
import { Grid, Eye, AlertCircle, ArrowDownRight, Layers, Sparkles } from 'lucide-react';
import { WarningLegend } from './WarningLegend';

interface RotationMatrixProps {
  stations: string[];
  matrix: StationMatrixCell[][];
  tailMatrix?: StationMatrixCell[][];
  totalRecordsCount?: number;
  onLoadSampleData?: () => void;
  onNavigateToData?: () => void;
  onViewDetails: (title: string, subtitle: string, rels: DrawRelation[]) => void;
}

export const RotationMatrix: React.FC<RotationMatrixProps> = ({
  stations,
  matrix,
  tailMatrix,
  totalRecordsCount,
  onLoadSampleData,
  onNavigateToData,
  onViewDetails,
}) => {
  const [hoveredCell, setHoveredCell] = useState<StationMatrixCell | null>(null);
  const [matrixMode, setMatrixMode] = useState<'HEAD_TO_TAIL' | 'TAIL_TO_TAIL'>('HEAD_TO_TAIL');

  const currentMatrix = matrixMode === 'TAIL_TO_TAIL' && tailMatrix && tailMatrix.length > 0 ? tailMatrix : matrix;

  if (stations.length === 0 || totalRecordsCount === 0) {
    return (
      <div className="space-y-5">
        <WarningLegend />
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <Grid className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            Ma Trận Xoay Vòng Đang Trống (Chưa Có Dữ Liệu)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed mb-6">
            Hệ thống chưa có đủ đài và kỳ quay để thiết lập ma trận xoay vòng giữa các đài (Đầu ➔ Cuối). Vui lòng nạp bộ dữ liệu mẫu hoặc nhập dữ liệu mới.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onLoadSampleData && (
              <button
                type="button"
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp Dữ Liệu Mẫu XSMN</span>
              </button>
            )}
            {onNavigateToData && (
              <button
                type="button"
                onClick={onNavigateToData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl border border-slate-300 transition-all cursor-pointer"
              >
                <span>Nhập Dữ Liệu Kết Quả Mới</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WarningLegend />

      {/* Intro Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Grid className={`w-5 h-5 ${matrixMode === 'TAIL_TO_TAIL' ? 'text-indigo-600' : 'text-red-600'}`} />
              <h3 className="text-base font-bold text-slate-900">
                {matrixMode === 'TAIL_TO_TAIL'
                  ? 'Ma Trận Xoay Vòng 3 Số Cuối Giữa Các Đài (Đuôi → Đuôi)'
                  : 'Ma Trận Xoay Vòng Giữa Các Đài (Đầu → Cuối)'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {matrixMode === 'TAIL_TO_TAIL' ? (
                <>
                  Hàng ngang: <strong>Đài Nguồn</strong> (xét 3 số cuối giải ĐB) &mdash; Cột dọc: <strong>Đài Đích</strong> (xét 3 số cuối giải ĐB).
                  Đối chiếu chu kỳ lặp thực tế giữa 21 đài XSMN.
                </>
              ) : (
                <>
                  Hàng ngang: <strong>Đài Nguồn</strong> (xét 3 số đầu) &mdash; Cột dọc: <strong>Đài Đích</strong> (xét 3 số cuối).
                  Các ô có tần suất lặp cao được tô màu Đỏ/Cam. Bấm vào ô bất kỳ để xem toàn bộ danh sách đối chiếu thực tế.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-600"></span>
              <span className="text-slate-600 font-medium">≥ 3 lần lặp (Đỏ)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500"></span>
              <span className="text-slate-600 font-medium">1 - 2 lần lặp (Cam)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300"></span>
              <span className="text-slate-400 font-medium">0 lần</span>
            </div>
          </div>
        </div>

        {/* Mode switcher tabs */}
        {tailMatrix && tailMatrix.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600 mr-1">Chế độ ma trận:</span>
            <button
              type="button"
              onClick={() => setMatrixMode('HEAD_TO_TAIL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                matrixMode === 'HEAD_TO_TAIL'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
              }`}
            >
              Ma Trận Đầu ➔ Cuối
            </button>
            <button
              type="button"
              onClick={() => setMatrixMode('TAIL_TO_TAIL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                matrixMode === 'TAIL_TO_TAIL'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ma Trận 3 Số Cuối (Đuôi ➔ Đuôi)</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded-full uppercase">
                Mới
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Matrix Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[650px] scrollbar-thin">
          <table className="w-full text-center text-xs border-collapse">
            {/* Header Row: Target Stations */}
            <thead className="bg-slate-100/90 text-slate-800 font-bold sticky top-0 z-20 border-b border-slate-200">
              <tr>
                <th className="p-3 bg-slate-200/90 text-left sticky left-0 z-30 min-w-[130px] border-r border-slate-300">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>Nguồn ↓</span>
                    <span>Đích →</span>
                  </div>
                </th>
                {stations.map(st => (
                  <th
                    key={`col-${st}`}
                    className="p-3 min-w-[120px] max-w-[150px] border-r border-slate-200 text-slate-800 truncate"
                    title={`Đài đích: ${st}`}
                  >
                    {st}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body Rows: Source Stations */}
            <tbody className="divide-y divide-slate-200">
              {currentMatrix.map((row, rIdx) => {
                const srcStation = stations[rIdx];
                return (
                  <tr key={`row-${srcStation}`} className="hover:bg-slate-50/50 transition-colors">
                    {/* Sticky Source Station Column */}
                    <td className="p-3 font-bold text-slate-900 bg-slate-100/90 text-left sticky left-0 z-10 border-r border-slate-300 min-w-[130px] truncate shadow-xs">
                      {srcStation}
                    </td>

                    {/* Matrix Cells */}
                    {row.map((cell, cIdx) => {
                      const tgtStation = stations[cIdx];
                      const isSelf = srcStation === tgtStation;
                      const hasMatches = cell.totalMatches > 0;
                      const isHot = cell.exactMatches >= 3 || cell.totalMatches >= 5;
                      const isWarm = (cell.exactMatches >= 1 && cell.exactMatches < 3) || cell.totalMatches >= 2;

                      // Cell background styling according to Requirement #5 & #8
                      let cellStyle = 'bg-slate-50/30 text-slate-400 hover:bg-slate-100';
                      let badgeStyle = 'bg-slate-200 text-slate-600';

                      if (isHot) {
                        cellStyle = 'bg-rose-100/80 hover:bg-rose-200/80 text-rose-950 font-semibold border-rose-300';
                        badgeStyle = 'bg-rose-600 text-white font-black';
                      } else if (isWarm) {
                        cellStyle = 'bg-amber-100/70 hover:bg-amber-200/70 text-amber-950 border-amber-300';
                        badgeStyle = 'bg-amber-500 text-white font-bold';
                      } else if (hasMatches) {
                        cellStyle = 'bg-yellow-50/60 hover:bg-yellow-100/60 text-yellow-900 border-yellow-200';
                        badgeStyle = 'bg-yellow-400 text-yellow-950 font-medium';
                      }

                      return (
                        <td
                          key={`cell-${srcStation}-${tgtStation}`}
                          onClick={() => {
                            if (cell.relations.length > 0) {
                              onViewDetails(
                                `Ma trận: ${cell.sourceStation} → ${cell.targetStation}`,
                                `Tổng cộng ${cell.totalMatches} lần liên kết (Trùng khớp 3/3: ${cell.exactMatches} lần)`,
                                cell.relations
                              );
                            }
                          }}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`p-2 border-r border-b border-slate-200 transition-all cursor-pointer ${cellStyle} relative group`}
                        >
                          {hasMatches ? (
                            <div className="flex flex-col items-center justify-center min-h-[56px] space-y-1">
                              {/* Total count badge */}
                              <span className={`px-2 py-0.5 rounded-full text-xs shadow-2xs ${badgeStyle}`}>
                                {cell.exactMatches > 0 ? `${cell.exactMatches} lặp` : `${cell.totalMatches} liên`}
                              </span>

                              {/* Unique Numbers list */}
                              {cell.uniqueNumbers.length > 0 && (
                                <div className="text-[10px] font-mono text-slate-700 font-semibold truncate max-w-[100px]">
                                  {cell.uniqueNumbers.slice(0, 2).join(', ')}
                                  {cell.uniqueNumbers.length > 2 ? '...' : ''}
                                </div>
                              )}

                              {/* Cycle & Date info */}
                              <div className="text-[9px] text-slate-500 flex items-center gap-1">
                                {cell.mostCommonCycle !== null && (
                                  <span>+{cell.mostCommonCycle} kỳ</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center min-h-[56px] text-slate-300 text-sm">
                              {isSelf ? '—' : '0'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Hover summary helper bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-600">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            {hoveredCell && hoveredCell.totalMatches > 0 ? (
              <span>
                Ô chọn: <strong>{hoveredCell.sourceStation}</strong> → <strong>{hoveredCell.targetStation}</strong> |{' '}
                Trùng 3/3: <strong className="text-rose-600">{hoveredCell.exactMatches} lần</strong> |{' '}
                Các bộ số: {hoveredCell.uniqueNumbers.join(', ') || 'Chưa có'} |{' '}
                Gần nhất: {hoveredCell.latestDate || '—'}
              </span>
            ) : (
              <span>Rê chuột hoặc nhấp vào ô bất kỳ trên ma trận để xem bằng chứng lịch sử chi tiết.</span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">Dữ liệu tính toán tự động</span>
        </div>
      </div>
    </div>
  );
};
