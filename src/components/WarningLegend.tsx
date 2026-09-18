import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export const WarningLegend: React.FC = () => {
  return (
    <div id="warning-legend" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Quy Chuẩn Tô Màu Cảnh Báo & Mức Độ Tương Đồng Lịch Sử
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Lưu ý: Màu Đỏ thể hiện tần suất lặp lịch sử cao, <strong>không</strong> mang ý nghĩa "chắc chắn".</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 text-xs">
        {/* Đỏ */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200">
          <span className="shrink-0 w-3.5 h-3.5 mt-0.5 rounded-full bg-rose-600 shadow-xs"></span>
          <div>
            <span className="font-bold text-rose-900 block">MÀU ĐỎ: Trùng Khớp / Tần Suất Cao</span>
            <p className="text-rose-700 text-[11px] leading-relaxed mt-0.5">
              Trùng khớp trực tiếp 3/3 số (100%) HOẶC quan hệ đã lặp lại nhiều lần (≥ 3 lần) trong lịch sử.
            </p>
          </div>
        </div>

        {/* Cam */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <span className="shrink-0 w-3.5 h-3.5 mt-0.5 rounded-full bg-amber-500 shadow-xs"></span>
          <div>
            <span className="font-bold text-amber-900 block">MÀU CAM: Tương Đồng Cao</span>
            <p className="text-amber-700 text-[11px] leading-relaxed mt-0.5">
              Tương đồng 67% - 85% (đảo ngược vị trí, hoán vị chữ số, trùng 2/3) hoặc có mẫu lặp 2 lần.
            </p>
          </div>
        </div>

        {/* Vàng */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-yellow-50 border border-yellow-200">
          <span className="shrink-0 w-3.5 h-3.5 mt-0.5 rounded-full bg-yellow-400 shadow-xs"></span>
          <div>
            <span className="font-bold text-yellow-900 block">MÀU VÀNG: Tương Đồng Một Phần</span>
            <p className="text-yellow-800 text-[11px] leading-relaxed mt-0.5">
              Trùng 1/3 chữ số (33%) hoặc trùng vị trí tương đối, dữ liệu lặp lại đơn lẻ chưa đủ chu kỳ.
            </p>
          </div>
        </div>

        {/* Xanh */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
          <span className="shrink-0 w-3.5 h-3.5 mt-0.5 rounded-full bg-emerald-600 shadow-xs"></span>
          <div>
            <span className="font-bold text-emerald-900 block">MÀU XANH: Tiêu Chuẩn / Bình Thường</span>
            <p className="text-emerald-700 text-[11px] leading-relaxed mt-0.5">
              Không phát hiện liên kết số đặc biệt giữa 2 đài ở các chu kỳ đang đối chiếu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
