import React from 'react';
import { X, Calendar, ArrowRight, CheckCircle2, Copy, Check } from 'lucide-react';
import { DrawRelation } from '../types';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  relations: DrawRelation[];
}

export const DetailModal: React.FC<DetailModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  relations,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Tìm thấy <strong className="text-slate-800">{relations.length}</strong> lần liên kết đối chiếu</span>
            <span className="text-[11px] text-slate-400">Dữ liệu căn cứ lịch sử thực tế từ các kỳ quay</span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {relations.map((rel, idx) => {
              const bgClass =
                rel.alertColor === 'red'
                  ? 'bg-rose-50/50 hover:bg-rose-50'
                  : rel.alertColor === 'orange'
                  ? 'bg-amber-50/50 hover:bg-amber-50'
                  : rel.alertColor === 'yellow'
                  ? 'bg-yellow-50/40 hover:bg-yellow-50'
                  : 'bg-white hover:bg-slate-50';

              const badgeColor =
                rel.alertColor === 'red'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : rel.alertColor === 'orange'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : rel.alertColor === 'yellow'
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300';

              return (
                <div key={rel.id || idx} className={`p-4 transition-colors ${bgClass}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Journey */}
                    <div className="flex items-center gap-3 text-xs sm:text-sm">
                      {/* Source */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs min-w-[150px]">
                        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{rel.sourceRecord.dateDisplay} ({rel.sourceDayOfWeek})</span>
                        </div>
                        <div className="font-bold text-slate-800 mt-0.5">{rel.sourceStation}</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <span>{rel.comparisonType === 'TAIL_TO_TAIL' ? '3 số cuối (nguồn):' : '3 số đầu:'}</span>
                          <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${rel.comparisonType === 'TAIL_TO_TAIL' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                            {rel.sourceTail3 || rel.sourceHead3}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Giải ĐB: {rel.sourceRecord.rawNumber}
                        </div>
                      </div>

                      {/* Arrow & Cycle */}
                      <div className="flex flex-col items-center justify-center px-1">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full mb-1">
                          +{rel.cycleDistance} kỳ
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] text-slate-400 mt-1">
                          {rel.dayDistance} ngày
                        </span>
                      </div>

                      {/* Target */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs min-w-[150px]">
                        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{rel.targetRecord.dateDisplay} ({rel.targetDayOfWeek})</span>
                        </div>
                        <div className="font-bold text-slate-800 mt-0.5">{rel.targetStation}</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <span>3 số cuối:</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-bold">
                            {rel.targetTail3}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Giải ĐB: {rel.targetRecord.rawNumber}
                        </div>
                      </div>
                    </div>

                    {/* Right: Badge & Details */}
                    <div className="flex md:flex-col items-end justify-between md:justify-center gap-1 text-right">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${badgeColor}`}>
                        {rel.isExactMatch && <CheckCircle2 className="w-3 h-3" />}
                        {rel.relationTypeLabel} ({rel.similarityScore}%)
                      </span>
                      <span className="text-[11px] text-slate-500 max-w-[220px] truncate">
                        {rel.matchDescription}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống đối chiếu tự động bảo toàn số 0 ở đầu</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
