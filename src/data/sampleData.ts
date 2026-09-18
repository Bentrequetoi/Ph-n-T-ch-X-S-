import { LotteryRecord } from '../types';
import { parseDateString } from '../utils/dateUtils';
import { extractHeadAndTail } from '../utils/lotteryAnalysis';

interface RawSampleItem {
  date: string; // DD/MM/YYYY
  station: string;
  rawNumber: string;
}

// 80+ realistic draws with deliberate patterns for demonstration:
// Including exact 3/3 repeats (e.g. 123, 025, 789, 456), 2/3 matches, reversals (321 vs 123), and cycle repeats
const RAW_SAMPLES: RawSampleItem[] = [
  // Tuần 1: Tháng 08/2026
  { date: '03/08/2026', station: 'TP.HCM', rawNumber: '123456' }, // Đầu: 123, Đuôi: 456 (Thứ 2)
  { date: '03/08/2026', station: 'Đồng Tháp', rawNumber: '025678' }, // Đầu: 025, Đuôi: 678 (Thứ 2)
  { date: '03/08/2026', station: 'Cà Mau', rawNumber: '839214' }, // Đầu: 839, Đuôi: 214 (Thứ 2)

  { date: '04/08/2026', station: 'Bến Tre', rawNumber: '456789' }, // Đầu: 456, Đuôi: 789 (Thứ 3)
  { date: '04/08/2026', station: 'Vũng Tàu', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123 -> Trùng đầu TP.HCM ngày 03/08 (Thứ 3)
  { date: '04/08/2026', station: 'Bạc Liêu', rawNumber: '312025' }, // Đầu: 312, Đuôi: 025 -> Trùng đầu Đồng Tháp ngày 03/08

  { date: '05/08/2026', station: 'Đồng Nai', rawNumber: '678123' }, // Đầu: 678, Đuôi: 123 -> Trùng đầu TP.HCM sau 2 kỳ (Thứ 4)
  { date: '05/08/2026', station: 'Cần Thơ', rawNumber: '025321' }, // Đầu: 025, Đuôi: 321 -> Đảo ngược 123
  { date: '05/08/2026', station: 'Sóc Trăng', rawNumber: '951456' }, // Đầu: 951, Đuôi: 456 -> Trùng đuôi TP.HCM

  { date: '06/08/2026', station: 'Tây Ninh', rawNumber: '123890' }, // Đầu: 123, Đuôi: 890 (Thứ 5)
  { date: '06/08/2026', station: 'An Giang', rawNumber: '542025' }, // Đầu: 542, Đuôi: 025 -> Trùng đầu Đồng Tháp ngày 03
  { date: '06/08/2026', station: 'Bình Thuận', rawNumber: '321132' }, // Đầu: 321, Đuôi: 132 -> Hoán vị 123

  { date: '07/08/2026', station: 'Vĩnh Long', rawNumber: '890789' }, // Đầu: 890, Đuôi: 789 (Thứ 6)
  { date: '07/08/2026', station: 'Bình Dương', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123 -> Trùng đầu Tây Ninh (Thứ 6)
  { date: '07/08/2026', station: 'Trà Vinh', rawNumber: '416025' }, // Đầu: 416, Đuôi: 025 (Thứ 6)

  { date: '08/08/2026', station: 'TP.HCM', rawNumber: '123789' }, // Đầu: 123, Đuôi: 789 (Thứ 7)
  { date: '08/08/2026', station: 'Long An', rawNumber: '678123' }, // Đầu: 678, Đuôi: 123 (Thứ 7)
  { date: '08/08/2026', station: 'Bình Phước', rawNumber: '025987' }, // Đầu: 025, Đuôi: 987 (Thứ 7)
  { date: '08/08/2026', station: 'Hậu Giang', rawNumber: '345678' }, // Đầu: 345, Đuôi: 678 (Thứ 7)

  { date: '09/08/2026', station: 'Tiền Giang', rawNumber: '456123' }, // Đầu: 456, Đuôi: 123 (Chủ nhật)
  { date: '09/08/2026', station: 'Kiên Giang', rawNumber: '789025' }, // Đầu: 789, Đuôi: 025 (Chủ nhật)
  { date: '09/08/2026', station: 'Đà Lạt', rawNumber: '214839' }, // Đầu: 214, Đuôi: 839 (Chủ nhật)

  // Tuần 2: Tháng 08/2026 (Lặp lại quy luật sau 7 kỳ)
  { date: '10/08/2026', station: 'TP.HCM', rawNumber: '123999' }, // Đầu: 123, Đuôi: 999
  { date: '10/08/2026', station: 'Đồng Tháp', rawNumber: '025444' }, // Đầu: 025, Đuôi: 444
  { date: '10/08/2026', station: 'Cà Mau', rawNumber: '678129' }, // Đầu: 678, Đuôi: 129 -> Trùng 2/3 với 123

  { date: '11/08/2026', station: 'Bến Tre', rawNumber: '999123' }, // Đầu: 999, Đuôi: 123 -> TP.HCM -> Bến Tre
  { date: '11/08/2026', station: 'Vũng Tàu', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123
  { date: '11/08/2026', station: 'Bạc Liêu', rawNumber: '555025' }, // Đầu: 555, Đuôi: 025

  { date: '12/08/2026', station: 'Đồng Nai', rawNumber: '444123' }, // Đầu: 444, Đuôi: 123
  { date: '12/08/2026', station: 'Cần Thơ', rawNumber: '123025' }, // Đầu: 123, Đuôi: 025
  { date: '12/08/2026', station: 'Sóc Trăng', rawNumber: '888789' }, // Đầu: 888, Đuôi: 789

  { date: '13/08/2026', station: 'Tây Ninh', rawNumber: '123654' }, // Đầu: 123, Đuôi: 654
  { date: '13/08/2026', station: 'An Giang', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123
  { date: '13/08/2026', station: 'Bình Thuận', rawNumber: '025321' }, // Đầu: 025, Đuôi: 321

  { date: '14/08/2026', station: 'Vĩnh Long', rawNumber: '321025' }, // Đầu: 321, Đuôi: 025
  { date: '14/08/2026', station: 'Bình Dương', rawNumber: '654123' }, // Đầu: 654, Đuôi: 123
  { date: '14/08/2026', station: 'Trà Vinh', rawNumber: '789456' }, // Đầu: 789, Đuôi: 456

  { date: '15/08/2026', station: 'TP.HCM', rawNumber: '123888' }, // Đầu: 123, Đuôi: 888
  { date: '15/08/2026', station: 'Long An', rawNumber: '321123' }, // Đầu: 321, Đuôi: 123
  { date: '15/08/2026', station: 'Bình Phước', rawNumber: '025789' }, // Đầu: 025, Đuôi: 789
  { date: '15/08/2026', station: 'Hậu Giang', rawNumber: '456025' }, // Đầu: 456, Đuôi: 025

  { date: '16/08/2026', station: 'Tiền Giang', rawNumber: '888123' }, // Đầu: 888, Đuôi: 123
  { date: '16/08/2026', station: 'Kiên Giang', rawNumber: '123025' }, // Đầu: 123, Đuôi: 025
  { date: '16/08/2026', station: 'Đà Lạt', rawNumber: '789321' }, // Đầu: 789, Đuôi: 321

  // Tuần 3: Tháng 08/2026
  { date: '17/08/2026', station: 'TP.HCM', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123
  { date: '17/08/2026', station: 'Đồng Tháp', rawNumber: '123025' }, // Đầu: 123, Đuôi: 025
  { date: '17/08/2026', station: 'Cà Mau', rawNumber: '025789' }, // Đầu: 025, Đuôi: 789

  { date: '18/08/2026', station: 'Bến Tre', rawNumber: '456789' }, // Đầu: 456, Đuôi: 789
  { date: '18/08/2026', station: 'Vũng Tàu', rawNumber: '123789' }, // Đầu: 123, Đuôi: 789
  { date: '18/08/2026', station: 'Bạc Liêu', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123

  { date: '19/08/2026', station: 'Đồng Nai', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123
  { date: '19/08/2026', station: 'Cần Thơ', rawNumber: '025123' }, // Đầu: 025, Đuôi: 123
  { date: '19/08/2026', station: 'Sóc Trăng', rawNumber: '321025' }, // Đầu: 321, Đuôi: 025

  { date: '20/08/2026', station: 'Tây Ninh', rawNumber: '123456' }, // Đầu: 123, Đuôi: 456
  { date: '20/08/2026', station: 'An Giang', rawNumber: '456123' }, // Đầu: 456, Đuôi: 123
  { date: '20/08/2026', station: 'Bình Thuận', rawNumber: '789025' }, // Đầu: 789, Đuôi: 025

  { date: '21/08/2026', station: 'Vĩnh Long', rawNumber: '025789' }, // Đầu: 025, Đuôi: 789
  { date: '21/08/2026', station: 'Bình Dương', rawNumber: '123025' }, // Đầu: 123, Đuôi: 025
  { date: '21/08/2026', station: 'Trà Vinh', rawNumber: '678123' }, // Đầu: 678, Đuôi: 123

  { date: '22/08/2026', station: 'TP.HCM', rawNumber: '123678' }, // Đầu: 123, Đuôi: 678
  { date: '22/08/2026', station: 'Long An', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123
  { date: '22/08/2026', station: 'Bình Phước', rawNumber: '456025' }, // Đầu: 456, Đuôi: 025
  { date: '22/08/2026', station: 'Hậu Giang', rawNumber: '025123' }, // Đầu: 025, Đuôi: 123

  { date: '23/08/2026', station: 'Tiền Giang', rawNumber: '678123' }, // Đầu: 678, Đuôi: 123
  { date: '23/08/2026', station: 'Kiên Giang', rawNumber: '321025' }, // Đầu: 321, Đuôi: 025
  { date: '23/08/2026', station: 'Đà Lạt', rawNumber: '123789' }, // Đầu: 123, Đuôi: 789

  // Tuần 4: Cuối tháng 08 & Đầu tháng 09/2026
  { date: '24/08/2026', station: 'TP.HCM', rawNumber: '025456' }, // Đầu: 025, Đuôi: 456
  { date: '24/08/2026', station: 'Đồng Tháp', rawNumber: '123789' }, // Đầu: 123, Đuôi: 789
  { date: '24/08/2026', station: 'Cà Mau', rawNumber: '789025' }, // Đầu: 789, Đuôi: 025

  { date: '25/08/2026', station: 'Bến Tre', rawNumber: '123025' }, // Đầu: 123, Đuôi: 025
  { date: '25/08/2026', station: 'Vũng Tàu', rawNumber: '456123' }, // Đầu: 456, Đuôi: 123
  { date: '25/08/2026', station: 'Bạc Liêu', rawNumber: '789456' }, // Đầu: 789, Đuôi: 456

  { date: '26/08/2026', station: 'Đồng Nai', rawNumber: '789025' }, // Đầu: 789, Đuôi: 025
  { date: '26/08/2026', station: 'Cần Thơ', rawNumber: '123789' }, // Đầu: 123, Đuôi: 789
  { date: '26/08/2026', station: 'Sóc Trăng', rawNumber: '456123' }, // Đầu: 456, Đuôi: 123

  { date: '27/08/2026', station: 'Tây Ninh', rawNumber: '025123' }, // Đầu: 025, Đuôi: 123
  { date: '27/08/2026', station: 'An Giang', rawNumber: '123025' }, // Đầu: 123, Đuôi: 025
  { date: '27/08/2026', station: 'Bình Thuận', rawNumber: '789678' }, // Đầu: 789, Đuôi: 678

  { date: '28/08/2026', station: 'Vĩnh Long', rawNumber: '123789' }, // Đầu: 123, Đuôi: 789
  { date: '28/08/2026', station: 'Bình Dương', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123
  { date: '28/08/2026', station: 'Trà Vinh', rawNumber: '025456' }, // Đầu: 025, Đuôi: 456

  { date: '29/08/2026', station: 'TP.HCM', rawNumber: '123025' }, // Đầu: 123, Đuôi: 025
  { date: '29/08/2026', station: 'Long An', rawNumber: '025123' }, // Đầu: 025, Đuôi: 123
  { date: '29/08/2026', station: 'Bình Phước', rawNumber: '789456' }, // Đầu: 789, Đuôi: 456
  { date: '29/08/2026', station: 'Hậu Giang', rawNumber: '456789' }, // Đầu: 456, Đuôi: 789

  { date: '30/08/2026', station: 'Tiền Giang', rawNumber: '789123' }, // Đầu: 789, Đuôi: 123
  { date: '30/08/2026', station: 'Kiên Giang', rawNumber: '123789' }, // Đầu: 123, Đuôi: 789
  { date: '30/08/2026', station: 'Đà Lạt', rawNumber: '025123' }, // Đầu: 025, Đuôi: 123

  // Kỳ gần nhất tháng 09/2026
  { date: '01/09/2026', station: 'TP.HCM', rawNumber: '123456' }, // Đầu: 123
  { date: '01/09/2026', station: 'Đồng Tháp', rawNumber: '025987' }, // Đầu: 025
  { date: '01/09/2026', station: 'Cà Mau', rawNumber: '789654' }, // Đầu: 789

  { date: '02/09/2026', station: 'Bến Tre', rawNumber: '456123' }, // Đầu: 456, Đuôi: 123 (Trùng đầu TP.HCM ngày 01)
  { date: '02/09/2026', station: 'Vũng Tàu', rawNumber: '987025' }, // Đầu: 987, Đuôi: 025 (Trùng đầu Đồng Tháp ngày 01)
  { date: '02/09/2026', station: 'Bạc Liêu', rawNumber: '654789' }, // Đầu: 654, Đuôi: 789 (Trùng đầu Cà Mau ngày 01)

  // Kỳ quay Thứ 7 ngày 05/09/2026 (Bao gồm đầy đủ các đài Thứ 7: TP.HCM, Long An, Bình Phước, Hậu Giang)
  { date: '05/09/2026', station: 'TP.HCM', rawNumber: '123890' }, // Đầu: 123, Đuôi: 890 (Thứ 7)
  { date: '05/09/2026', station: 'Long An', rawNumber: '025123' }, // Đầu: 025, Đuôi: 123 (Thứ 7 - Đài Long An)
  { date: '05/09/2026', station: 'Bình Phước', rawNumber: '890789' }, // Đầu: 890, Đuôi: 789 (Thứ 7)
  { date: '05/09/2026', station: 'Hậu Giang', rawNumber: '789025' }, // Đầu: 789, Đuôi: 025 (Thứ 7)
];

export function getSampleLotteryRecords(): LotteryRecord[] {
  return RAW_SAMPLES.map((item, index) => {
    const parsedDate = parseDateString(item.date);
    const split = extractHeadAndTail(item.rawNumber);

    return {
      id: `sample-${index + 1}`,
      date: parsedDate.iso,
      dateDisplay: parsedDate.display,
      dayOfWeek: parsedDate.dayOfWeek,
      station: item.station,
      rawNumber: split.clean,
      head3: split.head3,
      tail3: split.tail3,
      sessionIndex: index + 1,
      createdAt: Date.now() - (RAW_SAMPLES.length - index) * 86400000,
    };
  });
}
