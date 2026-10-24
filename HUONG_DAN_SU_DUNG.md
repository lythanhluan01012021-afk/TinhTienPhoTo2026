# HƯỚNG DẪN SỬ DỤNG ỨNG DỤNG TÍNH TIỀN PHOTO TRƯỜNG HỌC

Hệ thống được phát triển chuyên biệt cho công tác in ấn/photocopy học liệu sư phạm với phong cách giao diện **Neumorphism (Soft UI)**, tone chữ xanh Navy sang trọng, sử dụng font chuẩn **Times New Roman** và cơ chế in ấn A4 chống nhảy trang.

---

## 1. KHỞI CHẠY ỨNG DỤNG
* Ứng dụng hiện đang chạy trực tiếp tại địa chỉ:
  👉 **`http://localhost:3000/`** (bạn có thể mở bằng trình duyệt Chrome, Edge, Cốc Cốc hoặc Firefox).
* Lệnh khởi chạy lại trong tương lai:
  ```powershell
  cd e:\APP_PHOTO
  npm run dev
  ```

---

## 2. HƯỚNG DẪN CÁC CHỨC NĂNG CHÍNH

### 📄 TRANG 1: BÀN TÍNH TIỀN PHOTO (GIAO DIỆN CHÍNH)
1. **Cột trái - Chọn Giáo viên & Lớp**:
   * **Chọn Tổ chuyên môn**: Chọn tổ (Toán - Tin, Ngữ Văn, Ngoại Ngữ, KHTN, KHXH...).
   * **Chọn Giáo viên**: Bấm vào giáo viên bất kỳ trong danh sách hoặc gõ tìm kiếm nhanh.
   * **Thêm Lớp**: Các lớp giáo viên đó đang dạy sẽ hiển thị dạng thẻ (chip) kèm sĩ số học sinh.
     * Bấm vào từng lớp để thêm dòng vào bảng bên phải.
     * Hoặc bấm **"Thêm Tất Cả Lớp Của GV"** để nạp hàng loạt.
2. **Cột phải - Bảng Excel Tương Tác**:
   * **Các cột**: `STT`, `Tên GV`, `Lớp`, `Môn Học / Nội Dung`, `Sĩ Số`, `Số Lượng Lẻ`, `Đơn Giá`, `Thành Tiền`, `Thanh Toán`, `Xóa`.
   * **Công thức tự động chuẩn hóa**:
     $$\text{Thành Tiền} = (\text{Sĩ Số} + \text{Số Lượng Lẻ}) \times \text{Đơn Giá}$$
   * Khi bạn sửa Sĩ số, Số lượng lẻ (ví dụ in thêm 1 bản cho GV, 2 bản dự phòng) hoặc Đơn giá $\rightarrow$ Thành tiền và Tổng tiền toàn bảng tự động tính toán tức thì!
   * **Nút Gom Nhóm Theo Lớp**: Bấm vào để nhóm tài liệu theo từng lớp, hiển thị tên GVCN, sĩ số và dòng Subtotal tổng tiền của từng lớp để thu tiền dễ dàng.
   * **Nút In Ấn Chuẩn A4**: Mở hộp thoại xem trước và in ấn A4 không nhảy trang.
   * **Nút Xuất Excel**: Tải toàn bộ bảng tính hiện tại về máy tính dưới dạng file `.xlsx`.
   * **Nút Lưu CSDL**: Đồng bộ dữ liệu vào Google Sheet trên Google Drive.

---

### ⚙️ TRANG 2: DASHBOARD ADMIN & CSDL GOOGLE SHEETS
1. **Quản lý Dữ liệu Sư phạm (Master Data)**:
   * Quản lý Danh sách Giáo viên (kèm Tổ chuyên môn).
   * Quản lý Phân công giảng dạy (GV - Môn - Lớp).
   * Quản lý Sĩ số từng lớp & GVCN.
   * Hỗ trợ **Tải file mẫu Excel** và **Nạp từ file Excel (.xlsx)** bằng cách kéo thả.
2. **Cấu hình CSDL Google Drive**:
   * Thư mục Drive: `https://drive.google.com/drive/folders/19K5b-uR1La1UAUBOVoulYurXi0w97Efw?usp=sharing` (ID: `19K5b-uR1La1UAUBOVoulYurXi0w97Efw`).
   * Mã nguồn [google_apps_script.js](file:///e:/APP_PHOTO/google_apps_script.js) đã được tạo sẵn trong thư mục dự án: Chỉ cần copy và dán vào Google Sheet để kết nối API lưu trữ tự động.
3. **Cài đặt chung**: Điều chỉnh đơn giá mặc định (VNĐ/trang), Tên trường, Niên khóa.

---

### 💰 PHÂN HỆ SỔ QUỸ THU / CHI & GOOGLE SHEETS
* Theo dõi **Tổng tiền thu vào** (từ các lớp nộp tiền photo).
* Theo dõi **Tổng chi phí** (mua giấy in A4, nạp mực in, sửa chữa máy).
* Tự động tính **Lợi nhuận / Quỹ phòng photo còn lại**.
* Bộ lọc trực quan theo Tháng, Năm và Loại giao dịch; hỗ trợ xuất file Excel Sổ quỹ.
* **Tự động thống kê trên Google Sheets (`SoQuy_ThuChi`)**:
  - Tự động gom nhóm các giao dịch thu chi theo từng tuần (Tuần 1, Tuần 2, ..., Tuần n).
  - Tự động chèn và làm nổi bật ở **dòng cuối mỗi tuần**:
    + `💵 TỔNG THU (Tuần X)`: Tổng các khoản thu trong tuần.
    + `🔴 TỔNG CHI (Tuần X)`: Tổng các khoản chi trong tuần.
    + `💰 CÒN LẠI (TỒN QUỸ TUẦN X)`: Tiền còn lại = Tổng Thu - Tổng Chi (nổi bật màu vàng hổ phách, viền kép kế toán sang trọng).
  - **Menu thao tác nhanh trên Google Sheets**: Menu `⚙️ QUẢN LÝ PHOTO` $\rightarrow$ `📊 Thống kê Tổng Chi & Còn Lại cuối mỗi tuần (Sổ Quỹ)` (1 click để cập nhật lại ngay tức thì).

