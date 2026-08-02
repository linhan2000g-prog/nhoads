# CẢNH BÁO KIẾN TRÚC HỆ THỐNG (KHÔNG ĐƯỢC THAY ĐỔI)

**Dành cho các AI hoặc Lập trình viên trong tương lai:**
Hệ thống quản lý ERP này đang sử dụng một cấu trúc dữ liệu kết hợp **RẤT ĐẶC BIỆT VÀ ĐÃ ĐƯỢC TỐI ƯU HÓA CAO ĐỘ**. Tuyệt đối không được thay đổi kiến trúc này nếu không có sự đồng ý rõ ràng từ chủ sở hữu.

## 1. Kiến Trúc "Bộ Đệm Tức Thời" (Optimistic Cache)
Hệ thống sử dụng đồng thời 2 cơ sở dữ liệu:
- **Google Sheets (Source of Truth):** Là nơi lưu trữ gốc, an toàn, không bao giờ mất, dùng để chốt sổ và xuất báo cáo. Chạy qua Google Apps Script (GAS).
- **Firebase Realtime Database (Cache):** Là bản sao siêu tốc, dùng để tải dữ liệu lên giao diện Web (React) ngay lập tức.

## 2. Luồng Dữ Liệu (Phải Giữ Nguyên)
- **ĐỌC DỮ LIỆU (GET):** Giao diện web (trong `src/api.ts` -> `fetchData`) **LUÔN LUÔN** đọc từ Firebase trước tiên để đảm bảo tốc độ tức thời (<100ms). Nó chỉ lùi về hỏi Google Sheets (GAS) nếu Firebase hoàn toàn sụp đổ hoặc trả về lỗi. Chú ý: Firebase thường tự động xóa các mục (nodes) nếu nó là mảng rỗng, `api.ts` đã được thiết lập để trả về `[]` thay vì lùi về GAS khi gặp Firebase rỗng. Đừng sửa logic này!
- **GHI DỮ LIỆU (POST/PUT/DELETE):** 
  - Giao diện web (trong `src/api.ts` -> `postData`) sẽ **TỰ ĐỘNG GHI ĐÈ** dữ liệu mới thẳng lên Firebase bằng lệnh `PUT` để giao diện phản hồi tức thì.
  - Sau đó, web gửi một lệnh (Fire-and-forget) về Google Apps Script mà **KHÔNG CHỜ PHẢN HỒI** (không dùng `await`).
  - Google Apps Script sẽ từ từ lưu vào Sheets, sau đó kích hoạt hàm `triggerFirebaseSync` để đè lại Firebase một lần nữa nhằm chốt tính chính xác tuyệt đối.

## 3. Bảo Mật Chìa Khóa (Token Propagation)
- **Firebase đã khóa hoàn toàn** bằng Rule (`.read: false`, `.write: false`). Đừng mở ra!
- Dữ liệu Firebase chỉ được lấy ra bằng cách gắn `?auth=FIREBASE_SECRET` vào sau URL.
- **Không bao giờ lưu cứng (hardcode)** `APP_SECRET` hay `FIREBASE_SECRET` vào mã nguồn React. Chúng phải được lấy về từ GAS khi người dùng Đăng Nhập thành công, và lưu vào `localStorage`. Khi Đăng Xuất, chúng phải bị xóa.

## LỜI KẾT
Cấu trúc này mang lại **Tốc độ của Firebase** và **Sự an toàn của Google Sheets**. Mọi thay đổi phá vỡ luồng đồng bộ này sẽ khiến hệ thống hoặc là quá chậm (2-3s mỗi thao tác), hoặc là dễ mất/xung đột dữ liệu. LUÔN LUÔN DUY TRÌ KIẾN TRÚC NÀY!
