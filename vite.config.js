import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXCEL_PATH = path.resolve(__dirname, 'CSDL_PHOTO_LOCAL.xlsx');
const ROOT_EXCEL_PATH = path.resolve(__dirname, '..', 'CSDL_PHOTO_LOCAL.xlsx');
const xlsxLib = XLSX.default || XLSX;

// Custom Plugin: Lưu trữ và đồng bộ CSDL trực tiếp vào file Excel trong thư mục dự án
function localExcelStoragePlugin() {
  return {
    name: 'local-excel-storage-plugin',
    configureServer(server) {
      // 1. Endpoint Lưu / Đọc CSDL Excel Cục Bộ
      server.middlewares.use('/api/local-excel', (req, res, next) => {
        // Cho phép CORS nội bộ & kết nối từ Vercel Cloud về localhost
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        // GET: Đọc dữ liệu từ file Excel CSDL Cục Bộ
        if (req.method === 'GET') {
          try {
            let targetFile = fs.existsSync(ROOT_EXCEL_PATH) ? ROOT_EXCEL_PATH : EXCEL_PATH;
            if (!fs.existsSync(targetFile)) {
              const syncPath = path.resolve(__dirname, 'CSDL_PHOTO_LOCAL_DONG_BO.xlsx');
              if (fs.existsSync(syncPath)) targetFile = syncPath;
            }

            if (!fs.existsSync(targetFile)) {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ 
                success: false, 
                exists: false, 
                message: 'Chưa có file CSDL_PHOTO_LOCAL.xlsx. Hãy bấm Lưu CSDL để tạo file mới!' 
              }));
            }

            const stats = fs.statSync(targetFile);
            const fileBuf = fs.readFileSync(targetFile);
            const wb = xlsxLib.read(fileBuf, { type: 'buffer' });
            
            // Đọc các sheets
            const billingItemsRaw = wb.Sheets['BangTinhTien'] ? xlsxLib.utils.sheet_to_json(wb.Sheets['BangTinhTien']) : [];
            const debtsRaw = wb.Sheets['NoCacLop'] ? xlsxLib.utils.sheet_to_json(wb.Sheets['NoCacLop']) : [];
            const cashflowRaw = wb.Sheets['SoQuyThuChi'] ? xlsxLib.utils.sheet_to_json(wb.Sheets['SoQuyThuChi']) : [];

            // Chuyển đổi định dạng phù hợp với AppContext
            const billingItems = billingItemsRaw
              .filter(r => r['Mã Đơn'] && r['Mã Đơn'] !== 'Thông báo')
              .map(r => ({
                id: r['Mã Đơn'],
                week: r['Tuần'] || 'Tuần 1',
                teacherName: r['Tên Giáo Viên'] || '',
                className: r['Lớp'] || '',
                subject: r['Tài liệu'] || r['Môn Học / Nội Dung'] || '',
                studentCount: Number(r['Sĩ Số']) || 0,
                extraCount: Number(r['SL Lẻ'] ?? r['Số Lượng Lẻ']) || 0,
                unitPrice: Number(r['Đơn Giá (đ)']) || 380,
                amount: Number(r['Thành Tiền (đ)']) || 0,
                isPaid: r['Đã Thanh Toán'] === 'ĐÃ THU',
                note: r['Ghi Chú'] || ''
              }));

            const classDebts = {};
            debtsRaw.forEach(r => {
              if (r['Lớp'] && r['Lớp'] !== 'Thông báo') {
                classDebts[r['Lớp']] = {
                  className: r['Lớp'],
                  amount: Number(r['Số Tiền Nợ / Thiếu (đ)']) || 0,
                  note: r['Lý Do / Ghi Chú Nợ'] || ''
                };
              }
            });

            const cashflow = cashflowRaw
              .filter(r => r['Mã GD'] && r['Mã GD'] !== 'Thông báo')
              .map(r => ({
                id: r['Mã GD'],
                date: r['Ngày Tháng'] || '',
                type: r['Loại'] === 'CHI TIỀN' ? 'CHI' : 'THU',
                amount: Number(r['Số Tiền (đ)']) || 0,
                category: r['Hạng Mục'] || '',
                person: r['Người Giao Dịch'] || '',
                note: r['Ghi Chú'] || ''
              }));

            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: true,
              exists: true,
              filePath: targetFile,
              lastModified: stats.mtime.toISOString(),
              data: {
                billingItems,
                classDebts,
                cashflow
              }
            }));
          } catch (err) {
            console.error('Lỗi khi đọc file Excel local:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        }

        // POST: Ghi trực tiếp CSDL vào file Excel CSDL_PHOTO_LOCAL.xlsx
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const wb = xlsxLib.utils.book_new();

              // 1. Sheet: BangTinhTien (Toàn bộ các đơn photo)
              const billingData = (payload.billingItems || []).map((item, idx) => {
                const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                const amount = Number(item.amount) || (copies * (Number(item.unitPrice) || 0));
                return {
                  'STT': idx + 1,
                  'Mã Đơn': item.id || '',
                  'Tuần': item.week || '',
                  'Tên Giáo Viên': item.teacherName || '',
                  'Lớp': item.className || '',
                  'Tài liệu': item.subject || '',
                  'Sĩ Số': Number(item.studentCount) || 0,
                  'SL Lẻ': Number(item.extraCount) || 0,
                  'Tổng Bản In': copies,
                  'Đơn Giá (đ)': Number(item.unitPrice) || 0,
                  'Thành Tiền (đ)': amount,
                  'Đã Thanh Toán': item.isPaid ? 'ĐÃ THU' : 'CHƯA THU',
                  'Ghi Chú': item.note || '',
                  'Cập Nhật Lúc': new Date().toLocaleString('vi-VN')
                };
              });
              const wsBilling = xlsxLib.utils.json_to_sheet(billingData.length > 0 ? billingData : [{ 'Thông báo': 'Chưa có đơn photo nào' }]);
              xlsxLib.utils.book_append_sheet(wb, wsBilling, 'BangTinhTien');

              // 2. Sheet: NoCacLop (Danh sách các lớp đang nợ/thiếu)
              const debtEntries = [];
              const debts = payload.classDebts || {};
              Object.keys(debts).forEach((className) => {
                const d = debts[className];
                const amt = Number(d?.amount) || 0;
                if (amt > 0) {
                  debtEntries.push({
                    'STT': debtEntries.length + 1,
                    'Lớp': className,
                    'Số Tiền Nợ / Thiếu (đ)': amt,
                    'Lý Do / Ghi Chú Nợ': d?.note || '',
                    'Cập Nhật Lúc': new Date().toLocaleString('vi-VN')
                  });
                }
              });
              const wsDebts = xlsxLib.utils.json_to_sheet(debtEntries.length > 0 ? debtEntries : [{ 'Thông báo': 'Không có lớp nào nợ/thiếu' }]);
              xlsxLib.utils.book_append_sheet(wb, wsDebts, 'NoCacLop');

              // 3. Sheet: SoQuyThuChi (Giao dịch thu chi tiền mặt)
              const cashflowData = (payload.cashflow || []).map((cf, idx) => ({
                'STT': idx + 1,
                'Mã GD': cf.id || '',
                'Ngày Tháng': cf.date || '',
                'Loại': cf.type === 'THU' ? 'THU TIỀN' : 'CHI TIỀN',
                'Số Tiền (đ)': Number(cf.amount) || 0,
                'Hạng Mục': cf.category || '',
                'Người Giao Dịch': cf.person || cf.payer || '',
                'Ghi Chú': cf.note || ''
              }));
              const wsCashflow = xlsxLib.utils.json_to_sheet(cashflowData.length > 0 ? cashflowData : [{ 'Thông báo': 'Chưa có giao dịch thu chi nào' }]);
              xlsxLib.utils.book_append_sheet(wb, wsCashflow, 'SoQuyThuChi');

              // 4. Sheet: TongHopDoanhThu (Tổng hợp nhanh theo tuần)
              const weekMap = {};
              (payload.billingItems || []).forEach(item => {
                const w = item.week || 'Tuần 1';
                if (!weekMap[w]) {
                  weekMap[w] = { classes: new Set(), copies: 0, photoAmount: 0 };
                }
                const copies = (Number(item.studentCount) || 0) + (Number(item.extraCount) || 0);
                weekMap[w].copies += copies;
                weekMap[w].photoAmount += Number(item.amount) || (copies * (Number(item.unitPrice) || 0));
                if (item.className) weekMap[w].classes.add(item.className);
              });

              const summaryData = Object.keys(weekMap).map((w, idx) => ({
                'STT': idx + 1,
                'Tuần Làm Việc': w,
                'Tổng Số Lớp Photo': weekMap[w].classes.size,
                'Tổng Số Bản In': weekMap[w].copies,
                'Tổng Tiền Photo (đ)': weekMap[w].photoAmount,
                'Cập Nhật Lúc': new Date().toLocaleString('vi-VN')
              }));
              const wsSummary = xlsxLib.utils.json_to_sheet(summaryData.length > 0 ? summaryData : [{ 'Thông báo': 'Chưa có dữ liệu tổng hợp' }]);
              xlsxLib.utils.book_append_sheet(wb, wsSummary, 'TongHopDoanhThu');

              // Ghi trực tiếp ra file Excel trong thư mục dự án và thư mục gốc D:\APP-PHOTO26
              const fileBuf = xlsxLib.write(wb, { type: 'buffer', bookType: 'xlsx' });
              
              // Luôn lưu file đồng bộ song song dự phòng
              const syncPath = path.resolve(__dirname, 'CSDL_PHOTO_LOCAL_DONG_BO.xlsx');
              try {
                fs.writeFileSync(syncPath, fileBuf);
              } catch (e) {}

              // Ghi đồng thời vào cả thư mục gốc D:\APP-PHOTO26\CSDL_PHOTO_LOCAL.xlsx
              try {
                fs.writeFileSync(ROOT_EXCEL_PATH, fileBuf);
              } catch (e) {}

              // Thử ghi vào file chính CSDL_PHOTO_LOCAL.xlsx trong TinhTienPhoTo2026
              let isLocked = false;
              try {
                fs.writeFileSync(EXCEL_PATH, fileBuf);
              } catch (err) {
                if (err.code === 'EBUSY' || err.code === 'EPERM') {
                  isLocked = true;
                  console.warn('File CSDL_PHOTO_LOCAL.xlsx đang mở trong Microsoft Excel nên Windows tạm khóa:', err.message);
                } else {
                  throw err;
                }
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ 
                success: true, 
                isLocked,
                filePath: isLocked ? syncPath : ROOT_EXCEL_PATH, 
                fileName: isLocked ? 'CSDL_PHOTO_LOCAL_DONG_BO.xlsx' : 'CSDL_PHOTO_LOCAL.xlsx',
                savedAt: new Date().toISOString(),
                rowsCount: billingData.length,
                debtsCount: debtEntries.length,
                cashflowCount: cashflowData.length,
                message: isLocked 
                  ? '⚠️ File CSDL_PHOTO_LOCAL.xlsx đang được mở trong phần mềm Microsoft Excel! Dữ liệu đã lưu an toàn vào CSDL_PHOTO_LOCAL_DONG_BO.xlsx. Vui lòng đóng cửa sổ Excel để hệ thống tự động lưu vào file chính!'
                  : `Đã lưu thành công vào file Excel: ${ROOT_EXCEL_PATH}`
              }));
            } catch (err) {
              console.error('Lỗi khi ghi file Excel cục bộ:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });

      // 2. Endpoint Mở file Excel trực tiếp trên Windows (Excel / LibreOffice)
      server.middlewares.use('/api/open-local-excel', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === 'POST') {
          let openTarget = fs.existsSync(ROOT_EXCEL_PATH) ? ROOT_EXCEL_PATH : EXCEL_PATH;
          if (!fs.existsSync(openTarget)) {
            const syncPath = path.resolve(__dirname, 'CSDL_PHOTO_LOCAL_DONG_BO.xlsx');
            if (fs.existsSync(syncPath)) openTarget = syncPath;
          }

          if (fs.existsSync(openTarget)) {
            exec(`start "" "${openTarget}"`);
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, message: `Đã mở file ${openTarget}` }));
          } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, message: 'File Excel chưa được tạo. Hãy bấm Lưu CSDL trước!' }));
          }
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    localExcelStoragePlugin()
  ],
  server: {
    port: 3000,
    open: false
  }
});
