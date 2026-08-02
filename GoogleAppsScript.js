/**
 * Ứng dụng Quản lý ERP (Thu Chi, Bán Hàng, Kho Hàng) - Backend Google Sheets API
 * KÈM THEO: Tính năng Đăng nhập, Phân quyền và Nhật ký thao tác (Audit Log)
 * Hướng dẫn cài đặt:
 * 1. Mở file Google Sheet đang dùng.
 * 2. Vào Tiện ích mở rộng -> Apps Script (Extensions -> Apps Script).
 * 3. Xóa nội dung cũ và dán toàn bộ đoạn code này vào.
 * 4. Nhấn Lưu (biểu tượng đĩa mềm hoặc Ctrl + S).
 * 5. Chọn hàm "setupInitialSheets" trong thanh dropdown và nhấn "Chạy" (Run) để tự động tạo các Sheet mới.
 * 6. Nhấn "Triển khai" (Deploy) -> "Quản lý bản triển khai" (Manage deployments) -> Sửa -> Phiên bản Mới -> Triển khai.
 */

const HEADERS_THUCHI = ['ID', 'Ngày', 'Nội dung Chi', 'Số tiền Chi', 'Nội dung Thu', 'Số tiền Thu', 'Người Giao/Nhận', 'Người Lập Phiếu'];
const HEADERS_BANHANG = ['ID', 'Ngày', 'SĐT Khách', 'Tên Khách', 'Chi tiết (JSON)', 'Tổng Tiền', 'Đã Thanh Toán', 'Còn Nợ', 'Ghi chú', 'Người Tạo'];
const HEADERS_NHAPKHO = ['ID', 'Ngày', 'Nhà Cung Cấp', 'Chi tiết (JSON)', 'Tổng Cần Trả', 'Đã Thanh Toán', 'Còn Nợ', 'Ghi chú', 'Người Tạo'];
const HEADERS_KHACHHANG = ['ID', 'SĐT', 'Tên Khách', 'Số lần mua', 'Ghi chú', 'Đơn đặt hàng', 'Thanh Toán', 'Còn Nợ', 'Ngày Nghiệm Thu', 'Địa chỉ'];
const HEADERS_TONKHO = ['ID', 'Mã SP', 'Tên Sản Phẩm', 'ĐVT', 'Giá Nhập', 'Giá Bán', 'Số lượng Tồn'];
const HEADERS_LICHSUKHO = ['ID', 'Mã SP', 'Tên Sản Phẩm', 'Ngày', 'Loại (import/export)', 'Số lượng', 'Ghi chú', 'Người Thực Hiện'];
const HEADERS_TAIKHOAN = ['ID', 'Tài khoản', 'Mật khẩu', 'Quyền', 'Họ Tên'];
const HEADERS_NHATKY = ['ID', 'Thời gian', 'Nhân viên', 'Hành động', 'Mô-đun', 'Chi tiết'];

function setupInitialSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const setupSheet = (name, headers) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#e0e0e0");
    return sheet;
  };

  setupSheet("Thu Chi", HEADERS_THUCHI);
  setupSheet("Bán Hàng", HEADERS_BANHANG);
  setupSheet("Nhập Kho", HEADERS_NHAPKHO);
  setupSheet("Khách Hàng", HEADERS_KHACHHANG);
  setupSheet("Tồn Kho", HEADERS_TONKHO);
  setupSheet("Lịch Sử Kho", HEADERS_LICHSUKHO);
  const sheetTaiKhoan = setupSheet("Tài Khoản", HEADERS_TAIKHOAN);
  setupSheet("Nhật Ký", HEADERS_NHATKY);

  // Tạo tài khoản admin mặc định nếu chưa có
  if (sheetTaiKhoan.getLastRow() <= 1) {
    sheetTaiKhoan.appendRow([generateId(), "admin", "admin123", "admin", "Quản trị viên"]);
  }
}

function logAudit(ss, user, action, moduleName, details) {
  try {
    const sheet = ss.getSheetByName("Nhật Ký");
    if (sheet) {
      sheet.appendRow([generateId(), new Date(), user || "Hệ thống", action, moduleName, details]);
    }
  } catch(e) {}
}

function getRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) return { rowNum: i + 1, data: data[i] };
  }
  return null;
}

function deleteRowById(sheet, id) {
  const match = getRowById(sheet, id);
  if (match) {
    sheet.deleteRow(match.rowNum);
    return responseJson({ success: true });
  }
  return responseJson({ error: 'Không tìm thấy ID để xóa' }, 404);
}

function doGet(e) {
  try {
    const module = e.parameter.module || 'thuchi';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (module === 'auth') {
      return responseJson({ error: 'Sử dụng POST để đăng nhập' }, 400);
    }

    if (module === 'users') {
      const sheetTK = ss.getSheetByName("Tài Khoản");
      if (!sheetTK) return responseJson({ data: [] });
      const tkData = sheetTK.getDataRange().getValues();
      const users = [];
      for (let i = 1; i < tkData.length; i++) {
        if (!tkData[i][0]) continue;
        let perms = [];
        try { perms = JSON.parse(tkData[i][5]); } catch(e) {}
        users.push({
          id: tkData[i][0],
          username: tkData[i][1],
          role: tkData[i][3],
          fullName: tkData[i][4],
          permissions: perms
        });
      }
      return responseJson({ data: users });
    }

    if (module === 'thuchi') {
      const month = e.parameter.month;
      const year = e.parameter.year;
      if (!month || !year) return responseJson({ error: 'Thiếu tham số month hoặc year' }, 400);
      const sheet = ss.getSheetByName("Thu Chi");
      const values = sheet.getDataRange().getValues();
      const data = [];
      for (let i = 1; i < values.length; i++) {
        let row = values[i];
        if (!row[0]) continue;
        let rowDate = row[1] instanceof Date ? row[1] : new Date(row[1]);
        if (isNaN(rowDate)) continue;

        if (rowDate.getMonth() + 1 == month && rowDate.getFullYear() == year) {
          data.push({
            id: row[0], date: rowDate.toISOString().split('T')[0],
            expenseContent: row[2] || "", expenseAmount: row[3] || 0,
            incomeContent: row[4] || "", incomeAmount: row[5] || 0,
            personName: row[6] || "", creatorName: row[7] || ""
          });
        }
      }
      return responseJson({ data: data, previousBalance: getPreviousBalance(ss, parseInt(month), parseInt(year)) });
    }
    
    else if (module === 'banhang') {
      const sheet = ss.getSheetByName("Bán Hàng");
      const values = sheet.getDataRange().getValues();
      const data = [];
      for (let i = 1; i < values.length; i++) {
        let row = values[i];
        if (!row[0]) continue;
        let rowDate = row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1];
        data.push({
          id: row[0], date: rowDate, phone: row[2] || "", customerName: row[3] || "",
          items: JSON.parse(row[4] || "[]"), totalAmount: row[5] || 0,
          paidAmount: row[6] || 0, debt: row[7] || 0, note: row[8] || "", creator: row[9] || ""
        });
      }
      return responseJson({ data: data });
    }

    else if (module === 'nhapkho') {
      const sheet = ss.getSheetByName("Nhập Kho");
      const values = sheet.getDataRange().getValues();
      const data = [];
      for (let i = 1; i < values.length; i++) {
        let row = values[i];
        if (!row[0]) continue;
        let rowDate = row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1];
        data.push({
          id: row[0], date: rowDate, supplier: row[2] || "",
          items: JSON.parse(row[3] || "[]"), totalAmount: row[4] || 0,
          paidAmount: row[5] || 0, debt: row[6] || 0, note: row[7] || "", creator: row[8] || ""
        });
      }
      return responseJson({ data: data });
    }

    else if (module === 'khachhang') {
      const sheet = ss.getSheetByName("Khách Hàng");
      const values = sheet.getDataRange().getValues();
      
      // Lấy dữ liệu bán hàng để thống kê
      const bhSheet = ss.getSheetByName("Bán Hàng");
      const bhValues = bhSheet ? bhSheet.getDataRange().getValues() : [];
      const stats = {};
      
      for (let i = 1; i < bhValues.length; i++) {
        let row = bhValues[i];
        if (!row[0]) continue;
        let phone = String(row[2] || "").replace(/^'/, "");
        let totalAmount = Number(row[5]) || 0;
        let debt = Number(row[7]) || 0;
        
        if (!stats[phone]) stats[phone] = { spent: 0, debt: 0, count: 0 };
        stats[phone].spent += totalAmount;
        stats[phone].debt += debt;
        stats[phone].count += 1;
      }

      const data = [];
      for (let i = 1; i < values.length; i++) {
        let row = values[i];
        if (!row[0]) continue;
        let phone = String(row[1] || "").replace(/^'/, "");
        let stat = stats[phone] || { spent: 0, debt: 0, count: 0 };
        
        data.push({ 
          id: row[0], 
          phone: phone, 
          name: row[2] || "", 
          purchaseCount: stat.count, // Sử dụng count thực tế từ số hóa đơn
          totalSpent: stat.spent,
          debt: stat.debt,
          note: row[4] || "" 
        });
      }
      return responseJson({ data: data });
    }

    else if (module === 'khohang') {
      const sheetTonKho = ss.getSheetByName("Tồn Kho");
      const tkValues = sheetTonKho.getDataRange().getValues();
      const products = [];
      for (let i = 1; i < tkValues.length; i++) {
        let row = tkValues[i];
        if (!row[0]) continue;
        products.push({ id: row[0], code: row[1] || "", name: row[2] || "", unit: row[3] || "", importPrice: row[4] || 0, price: row[5] || 0, stock: row[6] || 0 });
      }

      const sheetLichSu = ss.getSheetByName("Lịch Sử Kho");
      const lsValues = sheetLichSu.getDataRange().getValues();
      const logs = [];
      for (let i = 1; i < lsValues.length; i++) {
        let row = lsValues[i];
        if (!row[0]) continue;
        logs.push({
          id: row[0], productId: row[1], productName: row[2],
          date: row[3] instanceof Date ? row[3].toISOString().split('T')[0] : row[3],
          type: row[4] || "export", quantity: row[5] || 0, note: row[6] || "", user: row[7] || ""
        });
      }
      return responseJson({ products: products, logs: logs });
    }

    else if (module === 'congno') {
      const bhSheet = ss.getSheetByName("Bán Hàng");
      const bhValues = bhSheet.getDataRange().getValues();
      const phaithu = [];
      for (let i = 1; i < bhValues.length; i++) {
        let row = bhValues[i];
        if (!row[0]) continue;
        let debt = Number(row[7]) || 0;
        if (debt > 0) {
          phaithu.push({
            id: row[0], date: row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1],
            phone: row[2], name: row[3], total: row[5], debt: debt
          });
        }
      }

      const nkSheet = ss.getSheetByName("Nhập Kho");
      const nkValues = nkSheet.getDataRange().getValues();
      const phaitra = [];
      for (let i = 1; i < nkValues.length; i++) {
        let row = nkValues[i];
        if (!row[0]) continue;
        let debt = Number(row[6]) || 0;
        if (debt > 0) {
          phaitra.push({
            id: row[0], date: row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1],
            phone: "", name: row[2], total: row[4], debt: debt
          });
        }
      }
      return responseJson({ phaithu: phaithu, phaitra: phaitra });
    }

    else if (module === 'dashboard') {
      // Logic gộp doanh thu, lợi nhuận, chi phí... có thể tính toán ở đây hoặc frontend tự tính từ mảng gốc
      // Để API chạy nhanh, ta có thể cho frontend gọi banhang & nhapkho rồi tự vẽ.
      return responseJson({ message: 'Dashboard được xử lý trên Frontend.' });
    }

    return responseJson({ error: 'Module không hợp lệ' }, 400);
  } catch (error) {
    return responseJson({ error: error.message }, 500);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const out = doPostInner(e, payload, ss);
    const resString = out.getContent();
    
    try {
      const resObj = JSON.parse(resString);
      if (resObj.success || (resObj.id && !resObj.error)) {
        const module = payload.module;
        let modulesToSync = [module];
        if (module === 'banhang') modulesToSync = ['banhang', 'khachhang', 'khohang', 'congno'];
        if (module === 'nhapkho') modulesToSync = ['nhapkho', 'khohang', 'congno'];
        triggerFirebaseSync(ss, modulesToSync);
      }
    } catch(err) {
      Logger.log("JSON Parse error in doPost wrapper: " + err.message);
    }
    
    return ContentService.createTextOutput(resString).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return responseJson({ error: error.message }, 500);
  }
}

function doPostInner(e, payload, ss) {
  try {
    const module = payload.module;
    const action = payload.action;
    const user = payload.user || "Unknown";

    if (module === 'auth') {
      const sheetTK = ss.getSheetByName("Tài Khoản");
      const tkData = sheetTK.getDataRange().getValues();
      for (let i = 1; i < tkData.length; i++) {
        if (String(tkData[i][1]).trim() === String(payload.username).trim() && String(tkData[i][2]).trim() === String(payload.password).trim()) {
          let perms = [];
          try { perms = JSON.parse(tkData[i][5] || "[]"); } catch(e) {}
          return responseJson({ success: true, user: { id: tkData[i][0], username: tkData[i][1], role: tkData[i][3], fullName: tkData[i][4], permissions: perms } });
        }
      }
      return responseJson({ success: false, error: 'Sai tài khoản hoặc mật khẩu' }, 401);
    }

    if (module === 'users') {
      let sheetTK = ss.getSheetByName("Tài Khoản");
      if (!sheetTK) {
        sheetTK = ss.insertSheet("Tài Khoản");
        sheetTK.appendRow(["ID", "Username", "Password", "Role", "FullName", "Permissions"]);
      }
      
      if (action === 'add') {
        const d = payload.data;
        const newId = generateId();
        const permsStr = JSON.stringify(d.permissions || []);
        sheetTK.appendRow([newId, d.username, d.password, d.role || "staff", d.fullName, permsStr]);
        
        try {
          let msg = "👤 <b>TÀI KHOẢN NHÂN VIÊN MỚI</b>\n\n";
          msg += "🔹 Họ tên: " + d.fullName + "\n";
          msg += "🔹 Tên đăng nhập: <b>" + d.username + "</b>\n";
          msg += "🔹 Mật khẩu: <b>" + d.password + "</b>\n";
          msg += "🔹 Quyền truy cập: " + (d.permissions || []).join(", ") + "\n";
          sendTelegramMessage(msg);
        } catch(e) {}
        
        return responseJson({ success: true, id: newId });
      }
      
      if (action === 'update') {
        const d = payload.data;
        const tkData = sheetTK.getDataRange().getValues();
        for (let i = 1; i < tkData.length; i++) {
          if (tkData[i][0] === d.id) {
            sheetTK.getRange(i + 1, 2).setValue(d.username);
            if (d.password) sheetTK.getRange(i + 1, 3).setValue(d.password);
            sheetTK.getRange(i + 1, 5).setValue(d.fullName);
            sheetTK.getRange(i + 1, 6).setValue(JSON.stringify(d.permissions || []));
            
            try {
              let msg = "✏️ <b>CẬP NHẬT TÀI KHOẢN</b>\n\n";
              msg += "🔹 Họ tên: " + d.fullName + "\n";
              msg += "🔹 Tên đăng nhập: <b>" + d.username + "</b>\n";
              if (d.password) msg += "🔹 Mật khẩu mới: <b>" + d.password + "</b>\n";
              msg += "🔹 Quyền truy cập: " + (d.permissions || []).join(", ") + "\n";
              sendTelegramMessage(msg);
            } catch(e) {}

            return responseJson({ success: true });
          }
        }
        return responseJson({ success: false, error: 'Không tìm thấy user' }, 404);
      }
      
      if (action === 'delete') {
        const id = payload.id;
        const tkData = sheetTK.getDataRange().getValues();
        for (let i = 1; i < tkData.length; i++) {
          if (tkData[i][0] === id) {
            const deletedUsername = tkData[i][1];
            const deletedName = tkData[i][4];
            sheetTK.deleteRow(i + 1);
            
            try {
              let msg = "🚫 <b>XÓA TÀI KHOẢN</b>\n\n";
              msg += "🔹 Tài khoản <b>" + deletedUsername + "</b> (" + deletedName + ") đã bị xóa khỏi hệ thống!\n";
              sendTelegramMessage(msg);
            } catch(e) {}
            
            return responseJson({ success: true });
          }
        }
        return responseJson({ success: false, error: 'Không tìm thấy user' }, 404);
      }
    }

    if (module === 'thuchi') {
      const sheet = ss.getSheetByName("Thu Chi");
      if (action === 'add') {
        const d = payload.data;
        const newId = generateId();
        sheet.appendRow([
          newId, new Date(d.date), d.expenseContent || "", d.expenseAmount || "", d.incomeContent || "", d.incomeAmount || "", d.personName || "", user
        ]);
        if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).sort({column: 2, ascending: true});
        
        logAudit(ss, user, "Thêm Mới", "Thu Chi", `Phiếu mới - Thu: ${d.incomeAmount || 0}, Chi: ${d.expenseAmount || 0}`);
        
        // ---- Bắn thông báo Telegram Thu Chi ----
        try {
          const mDate = new Date(d.date);
          const cMonth = mDate.getMonth() + 1;
          const cYear = mDate.getFullYear();
          const prevBal = getPreviousBalance(ss, cMonth, cYear);
          let currentTotalIncome = 0;
          let currentTotalExpense = 0;
          const tcData = sheet.getDataRange().getValues();
          for (let i = 1; i < tcData.length; i++) {
            let row = tcData[i];
            if (!row[0]) continue;
            let rd = row[1] instanceof Date ? row[1] : new Date(row[1]);
            if (!isNaN(rd) && rd.getMonth() + 1 === cMonth && rd.getFullYear() === cYear) {
              currentTotalExpense += Number(row[3]) || 0;
              currentTotalIncome += Number(row[5]) || 0;
            }
          }
          const finalBal = prevBal + currentTotalIncome - currentTotalExpense;

          let msg = "💸 <b>BÁO CÁO PHIẾU " + (d.incomeAmount > 0 ? "THU" : "CHI") + "</b>\n\n";
          msg += "- Số tiền: <b>" + formatVND(d.incomeAmount > 0 ? d.incomeAmount : d.expenseAmount) + "</b>\n";
          msg += "- Người " + (d.incomeAmount > 0 ? "nộp" : "nhận") + ": " + (d.personName || "Khách") + "\n";
          msg += "- Lý do: " + (d.incomeContent || d.expenseContent) + "\n\n";
          msg += "💰 <b>THỐNG KÊ QUỸ TỚI HIỆN TẠI</b>\n";
          msg += "- Dư đầu tháng: " + formatVND(prevBal) + "\n";
          msg += "- Tổng Thu tháng này: " + formatVND(currentTotalIncome) + "\n";
          msg += "- Tổng Chi tháng này: " + formatVND(currentTotalExpense) + "\n";
          msg += "- <b>CÒN LẠI (TỒN QUỸ): " + formatVND(finalBal) + "</b>";
          sendTelegramMessage(msg);
        } catch(e) { 
          Logger.log(e); 
          sendTelegramMessage("Lỗi ở Thu Chi: " + e.message);
        }
        // ----------------------------------------
        
        return responseJson({ success: true, id: newId });
      } else if (action === 'delete') {
        const row = getRowById(sheet, payload.id);
        if (row) {
           logAudit(ss, user, "Xóa", "Thu Chi", `Xóa phiếu Thu/Chi ID: ${payload.id}`);
           
           // ---- Bắn thông báo Telegram Xóa Thu Chi ----
           try {
             let msg = "❌ <b>MỘT GIAO DỊCH VỪA BỊ XÓA</b>\n\n";
             msg += "- Người xóa: " + user + "\n";
             msg += "- ID phiếu: " + payload.id + "\n";
             sendTelegramMessage(msg);
           } catch(e) {}
           // ----------------------------------------
           
           return deleteRowById(sheet, payload.id);
        }
        return responseJson({ error: 'Không tìm thấy' }, 404);
      } else if (action === 'update') {
        const d = payload.data;
        const match = getRowById(sheet, payload.id);
        if (match) {
          sheet.getRange(match.rowNum, 2, 1, 7).setValues([[
            new Date(d.date), d.expenseContent || "", d.expenseAmount || "", d.incomeContent || "", d.incomeAmount || "", d.personName || "", user
          ]]);
          logAudit(ss, user, "Cập nhật", "Thu Chi", `Cập nhật phiếu Thu/Chi ID: ${payload.id}`);
          
          // ---- Bắn thông báo Telegram Cập nhật Thu Chi ----
          try {
            const isThu = Number(d.incomeAmount) > 0;
            let msg = "✏️ <b>CẬP NHẬT PHIẾU " + (isThu ? "THU" : "CHI") + "</b>\n\n";
            msg += "- Mã phiếu: " + payload.id + "\n";
            msg += "- Số tiền: <b>" + formatVND(isThu ? d.incomeAmount : d.expenseAmount) + "</b>\n";
            msg += "- Người " + (isThu ? "nộp" : "nhận") + ": " + (d.personName || "Khách") + "\n";
            msg += "- Lý do: " + (d.incomeContent || d.expenseContent) + "\n";
            msg += "- Người sửa: " + user;
            sendTelegramMessage(msg);
          } catch(e) {
            sendTelegramMessage("Lỗi gửi tele Cập nhật Thu Chi: " + e.message);
          }
          // ----------------------------------------

          return responseJson({ success: true });
        }
        return responseJson({ error: 'Không tìm thấy phiếu' }, 404);
      }
    }

    else if (module === 'khachhang') {
      const sheet = ss.getSheetByName("Khách Hàng");
      if (action === 'add') {
        const d = payload.data || payload;
        const newId = generateId();
        // ID, SĐT, Tên Khách, Số lần mua, Ghi chú, Đơn đặt hàng, Thanh Toán, Còn Nợ, Ngày Nghiệm Thu, Địa chỉ, Hạn thu tiền
        sheet.appendRow([newId, "'" + d.phone, d.name, 0, d.note || "", d.orders || "", Number(d.paid) || 0, Number(d.debt) || 0, d.acceptanceDate || "", d.address || "", d.dueDate ? new Date(d.dueDate) : ""]);
        logAudit(ss, user, "Thêm Mới", "Khách Hàng", `Thêm khách hàng: ${d.name}`);
        
        // ---- Bắn thông báo Telegram Thêm Khách Hàng ----
        try {
          let msg = "🆕 <b>KHÁCH HÀNG MỚI</b>\n\n";
          msg += "- Tên khách: <b>" + d.name + "</b>\n";
          msg += "- Số điện thoại: " + d.phone + "\n";
          if (d.orders) msg += "- Đơn đặt hàng: " + d.orders + "\n";
          if (d.paid) msg += "- Thanh toán: " + formatVND(d.paid) + "\n";
          if (d.debt) msg += "- Còn nợ: " + formatVND(d.debt) + "\n";
          if (d.acceptanceDate) msg += "- Ngày nghiệm thu: " + d.acceptanceDate + "\n";
          if (d.address) msg += "- Địa chỉ: " + d.address + "\n";
          if (d.note) msg += "- Ghi chú: " + d.note + "\n";
          msg += "- Người thêm: " + user;
          sendTelegramMessage(msg);
        } catch(e) {}
        // ----------------------------------------

        return responseJson({ success: true, id: newId });
      } else if (action === 'edit' || action === 'update') {
        const d = payload.data || payload;
        const match = getRowById(sheet, d.id);
        if (match) {
          // ID ở cột 1, SĐT ở cột 2, Tên ở cột 3, Số lần mua ở cột 4, Ghi chú ở cột 5, Đơn đặt hàng ở cột 6, Thanh Toán ở cột 7, Còn Nợ ở cột 8, Ngày Nghiệm Thu ở cột 9, Địa chỉ ở cột 10
          sheet.getRange(match.rowNum, 2).setValue("'" + d.phone);
          sheet.getRange(match.rowNum, 3).setValue(d.name);
          sheet.getRange(match.rowNum, 5).setValue(d.note || "");
          sheet.getRange(match.rowNum, 6).setValue(d.orders || "");
          sheet.getRange(match.rowNum, 7).setValue(Number(d.paid) || 0);
          sheet.getRange(match.rowNum, 8).setValue(Number(d.debt) || 0);
          sheet.getRange(match.rowNum, 9).setValue(d.acceptanceDate || "");
          sheet.getRange(match.rowNum, 10).setValue(d.address || "");
          sheet.getRange(match.rowNum, 11).setValue(d.dueDate ? new Date(d.dueDate) : "");
          logAudit(ss, user, "Cập nhật", "Khách Hàng", `Sửa thông tin KH: ${d.name}`);

          // ---- Bắn thông báo Telegram Cập nhật Khách Hàng ----
          try {
            let msg = "✏️ <b>CẬP NHẬT KHÁCH HÀNG</b>\n\n";
            msg += "- Tên khách: <b>" + d.name + "</b>\n";
            msg += "- Số điện thoại: " + d.phone + "\n";
            if (d.orders) msg += "- Đơn đặt hàng: " + d.orders + "\n";
            if (d.paid) msg += "- Thanh toán: " + formatVND(d.paid) + "\n";
            if (d.debt) msg += "- Còn nợ: " + formatVND(d.debt) + "\n";
            if (d.acceptanceDate) msg += "- Ngày nghiệm thu: " + d.acceptanceDate + "\n";
            if (d.address) msg += "- Địa chỉ: " + d.address + "\n";
            if (d.note) msg += "- Ghi chú: " + d.note + "\n";
            msg += "- Người sửa: " + user;
            sendTelegramMessage(msg);
          } catch(e) {}
          // ----------------------------------------

          return responseJson({ success: true });
        }
        return responseJson({ error: 'Không tìm thấy khách hàng' }, 404);
      } else if (action === 'delete') {
        const row = getRowById(sheet, payload.id);
        if (row) {
          logAudit(ss, user, "Xóa", "Khách Hàng", `Xóa khách hàng ID: ${payload.id}`);
          return deleteRowById(sheet, payload.id);
        }
        return responseJson({ error: 'Không tìm thấy khách hàng để xóa' }, 404);
      }
    }

    else if (module === 'banhang') {
      const sheetBanHang = ss.getSheetByName("Bán Hàng");
      
      if (action === 'add') {
        const d = payload.data;
        // 1. Cập nhật Khách Hàng
        const sheetKhachHang = ss.getSheetByName("Khách Hàng");
        const khData = sheetKhachHang.getDataRange().getValues();
        let khRowIndex = -1;
        let currentCount = 0;
        for (let i = 1; i < khData.length; i++) {
          if (khData[i][1] == d.phone) { khRowIndex = i + 1; currentCount = Number(khData[i][3]) || 0; break; }
        }
        if (khRowIndex !== -1) {
          sheetKhachHang.getRange(khRowIndex, 3).setValue(d.customerName);
          sheetKhachHang.getRange(khRowIndex, 4).setValue(currentCount + 1);
        } else {
          sheetKhachHang.appendRow([generateId(), "'" + d.phone, d.customerName, 1, "", "", 0, 0, "", ""]);
        }

        // 2. Thêm Bán Hàng
        const newId = generateId();
        const totalAmount = d.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
        const debt = totalAmount - (Number(d.paidAmount) || 0);
        sheetBanHang.appendRow([newId, new Date(d.date), "'" + d.phone, d.customerName, JSON.stringify(d.items), totalAmount, Number(d.paidAmount) || 0, debt, d.note || "", user, d.dueDate ? new Date(d.dueDate) : ""]);

        // 3. Xử lý Tồn Kho
        const sheetTK = ss.getSheetByName("Tồn Kho");
        const sheetLS = ss.getSheetByName("Lịch Sử Kho");
        const tkData = sheetTK.getDataRange().getValues();

        for (const item of d.items) {
          for (let i = 1; i < tkData.length; i++) {
            if (tkData[i][0] === item.productId || tkData[i][1] === item.productId) {
              let currentStock = Number(tkData[i][6]); // Cột 7 là Tồn kho (sau khi update HEADERS)
              let newStock = currentStock - Number(item.qty);
              sheetTK.getRange(i + 1, 7).setValue(newStock);
              sheetLS.appendRow([generateId(), tkData[i][1], tkData[i][2], new Date(d.date), 'export', Number(item.qty), `Bán cho KH: ${d.customerName}`, user]);
              break;
            }
          }
        }
        logAudit(ss, user, "Thêm Mới", "Bán Hàng", `Tạo phiếu bán hàng KH ${d.customerName}. Tổng tiền: ${totalAmount}`);
        
        // ---- Bắn thông báo Telegram Xuất Hàng ----
        try {
          let msg = "🚀 <b>BÁO CÁO BÁN HÀNG</b>\n\n";
          msg += "- Khách hàng: <b>" + d.customerName + "</b>\n";
          msg += "- SĐT: " + d.phone + "\n";
          msg += "- Tổng tiền đơn hàng: <b>" + formatVND(totalAmount) + "</b>\n";
          msg += "- Khách đã trả: " + formatVND(d.paidAmount) + "\n";
          if (debt > 0) msg += "- <b>Khách còn nợ: " + formatVND(debt) + "</b>\n";
          msg += "\n📦 <b>Chi tiết mặt hàng:</b>\n";
          for (let item of d.items) {
            msg += "- " + item.productName + " (x" + item.qty + ") = " + formatVND(item.price * item.qty) + "\n";
          }
          sendTelegramMessage(msg);
        } catch(e) {}
        // ----------------------------------------
        
        return responseJson({ success: true, id: newId });
      }
      else if (action === 'delete') {
        const match = getRowById(sheetBanHang, payload.id);
        if (match) {
          const rowData = match.data;
          const phone = rowData[2];
          const customerName = rowData[3];
          const items = JSON.parse(rowData[4] || "[]");
          const totalAmount = rowData[5];

          // Phục hồi kho
          const sheetTK = ss.getSheetByName("Tồn Kho");
          const sheetLS = ss.getSheetByName("Lịch Sử Kho");
          const tkData = sheetTK.getDataRange().getValues();
          for (const item of items) {
            for (let i = 1; i < tkData.length; i++) {
              if (tkData[i][0] === item.productId || tkData[i][1] === item.productId) {
                let currentStock = Number(tkData[i][6]);
                let newStock = currentStock + Number(item.qty);
                sheetTK.getRange(i + 1, 7).setValue(newStock);
                sheetLS.appendRow([generateId(), tkData[i][1], tkData[i][2], new Date(), 'import', Number(item.qty), `Hoàn kho do xóa phiếu Bán Hàng ${payload.id}`, user]);
                break;
              }
            }
          }

          logAudit(ss, user, "Xóa", "Bán Hàng", `Xóa phiếu bán hàng KH: ${customerName}. Tổng tiền: ${totalAmount}`);
          
          // ---- Bắn thông báo Telegram Xóa Đơn Hàng ----
          try {
            let msg = "❌ <b>MỘT ĐƠN BÁN HÀNG VỪA BỊ XÓA</b>\n\n";
            msg += "- Khách hàng: " + customerName + "\n";
            msg += "- Giá trị đơn: " + formatVND(totalAmount) + "\n";
            msg += "- Người xóa: " + user + "\n";
            sendTelegramMessage(msg);
          } catch(e) {}
          // ----------------------------------------
          
          return deleteRowById(sheetBanHang, payload.id);
        }
        return responseJson({ error: 'Không tìm thấy phiếu' }, 404);
      }
      else if (action === 'update') {
        const match = getRowById(sheetBanHang, payload.id);
        if (match) {
          const d = payload.data;
          const oldItems = JSON.parse(match.data[4] || "[]");
          const totalAmount = d.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
          const debt = totalAmount - (Number(d.paidAmount) || 0);
          
          // 1. Cập nhật Khách Hàng (Tên có thể đổi)
          const sheetKhachHang = ss.getSheetByName("Khách Hàng");
          const khData = sheetKhachHang.getDataRange().getValues();
          let khRowIndex = -1;
          for (let i = 1; i < khData.length; i++) {
            if (khData[i][1] == d.phone || "'" + khData[i][1] == d.phone || khData[i][1] == d.phone.replace("'", "")) { 
              khRowIndex = i + 1; 
              break; 
            }
          }
          if (khRowIndex !== -1) {
            sheetKhachHang.getRange(khRowIndex, 3).setValue(d.customerName);
          } else {
            sheetKhachHang.appendRow([generateId(), "'" + d.phone, d.customerName, 1, ""]);
          }

          // 2. Phục hồi Tồn Kho cũ
          const sheetTK = ss.getSheetByName("Tồn Kho");
          const sheetLS = ss.getSheetByName("Lịch Sử Kho");
          const tkData = sheetTK.getDataRange().getValues();
          for (const item of oldItems) {
            for (let i = 1; i < tkData.length; i++) {
              if (tkData[i][0] === item.productId || tkData[i][1] === item.productId) {
                let currentStock = Number(tkData[i][6]);
                let newStock = currentStock + Number(item.qty);
                sheetTK.getRange(i + 1, 7).setValue(newStock);
                sheetLS.appendRow([generateId(), tkData[i][1], tkData[i][2], new Date(), 'import', Number(item.qty), `Hoàn kho do sửa phiếu Bán Hàng ${payload.id}`, user]);
                tkData[i][6] = newStock; // Update temp array
                break;
              }
            }
          }

          // 3. Trừ Tồn Kho mới
          for (const item of d.items) {
            for (let i = 1; i < tkData.length; i++) {
              if (tkData[i][0] === item.productId || tkData[i][1] === item.productId) {
                let currentStock = Number(tkData[i][6]);
                let newStock = currentStock - Number(item.qty);
                sheetTK.getRange(i + 1, 7).setValue(newStock);
                sheetLS.appendRow([generateId(), tkData[i][1], tkData[i][2], new Date(d.date), 'export', Number(item.qty), `Cập nhật Bán cho KH: ${d.customerName}`, user]);
                tkData[i][6] = newStock; // Update temp array
                break;
              }
            }
          }

          // 4. Cập nhật Bán Hàng
          sheetBanHang.getRange(match.rowNum, 2, 1, 10).setValues([[
            new Date(d.date), "'" + d.phone, d.customerName, JSON.stringify(d.items), totalAmount, Number(d.paidAmount) || 0, debt, d.note || "", user, d.dueDate ? new Date(d.dueDate) : ""
          ]]);
          
          logAudit(ss, user, "Cập nhật", "Bán Hàng", `Cập nhật phiếu bán KH: ${d.customerName}. Tổng tiền: ${totalAmount}`);
          
          // ---- Bắn thông báo Telegram Cập nhật Đơn Hàng ----
          try {
            let msg = "✏️ <b>CẬP NHẬT ĐƠN BÁN HÀNG</b>\n\n";
            msg += "- Mã phiếu: " + payload.id + "\n";
            msg += "- Khách hàng: <b>" + d.customerName + "</b> (" + d.phone + ")\n";
            msg += "- Tổng tiền: <b>" + formatVND(totalAmount) + "</b>\n";
            msg += "- Đã thu: " + formatVND(d.paidAmount || 0) + "\n";
            msg += "- Còn nợ: " + formatVND(debt) + "\n";
            msg += "- Người sửa: " + user;
            sendTelegramMessage(msg);
          } catch(e) {}
          // ----------------------------------------

          return responseJson({ success: true });
        }
        return responseJson({ error: 'Không tìm thấy phiếu' }, 404);
      }
    }

    else if (module === 'nhapkho') {
      const sheetNK = ss.getSheetByName("Nhập Kho");
      if (action === 'add') {
        const d = payload.data;
        const newId = generateId();
        const totalAmount = d.items.reduce((sum, item) => sum + (Number(item.importPrice) * Number(item.qty)), 0);
        const debt = totalAmount - (Number(d.paidAmount) || 0);

        sheetNK.appendRow([newId, new Date(d.date), d.supplier, JSON.stringify(d.items), totalAmount, Number(d.paidAmount) || 0, debt, d.note || "", user]);

        const sheetTK = ss.getSheetByName("Tồn Kho");
        const sheetLS = ss.getSheetByName("Lịch Sử Kho");
        const tkData = sheetTK.getDataRange().getValues();

        for (const item of d.items) {
          let found = false;
          for (let i = 1; i < tkData.length; i++) {
            if (tkData[i][0] === item.productId || tkData[i][1] === item.code) { // Tìm theo ID hoặc Mã Code
              let currentStock = Number(tkData[i][6]);
              let newStock = currentStock + Number(item.qty);
              sheetTK.getRange(i + 1, 7).setValue(newStock);
              sheetLS.appendRow([generateId(), tkData[i][1], tkData[i][2], new Date(d.date), 'import', Number(item.qty), `Nhập hàng từ NCC: ${d.supplier}`, user]);
              found = true;
              break;
            }
          }
          if (!found && item.name) {
            // Sản phẩm mới tinh
            const newProdId = generateId();
            sheetTK.appendRow([newProdId, item.code || "", item.name, item.unit || "Cái", item.importPrice || 0, 0, item.qty]);
            sheetLS.appendRow([generateId(), item.code || "", item.name, new Date(d.date), 'import', Number(item.qty), `Nhập hàng mới từ NCC: ${d.supplier}`, user]);
          }
        }
        
        logAudit(ss, user, "Thêm Mới", "Nhập Kho", `Tạo phiếu nhập kho từ ${d.supplier}. Tổng tiền: ${totalAmount}`);
        
        // ---- Bắn thông báo Telegram Nhập Hàng ----
        try {
          let msg = "📥 <b>BÁO CÁO NHẬP HÀNG</b>\n\n";
          msg += "- Nhà cung cấp: <b>" + d.supplier + "</b>\n";
          msg += "- Tổng tiền thanh toán: <b>" + formatVND(totalAmount) + "</b>\n";
          msg += "- Đã trả: " + formatVND(d.paidAmount) + "\n";
          if (debt > 0) msg += "- <b>Còn nợ NCC: " + formatVND(debt) + "</b>\n";
          msg += "\n📦 <b>Chi tiết nhập:</b>\n";
          for (let item of d.items) {
            msg += "- " + item.productName + " (x" + item.qty + ")\n";
          }
          sendTelegramMessage(msg);
        } catch(e) {}
        // ----------------------------------------
        
        return responseJson({ success: true, id: newId });
      }
      else if (action === 'delete') {
         // Logic Xoá Nhập Kho tương tự Bán Hàng (Trừ kho lại)
         const match = getRowById(sheetNK, payload.id);
         if (match) {
            const rowData = match.data;
            const items = JSON.parse(rowData[3] || "[]");
            const sheetTK = ss.getSheetByName("Tồn Kho");
            const sheetLS = ss.getSheetByName("Lịch Sử Kho");
            const tkData = sheetTK.getDataRange().getValues();

            for (const item of items) {
              for (let i = 1; i < tkData.length; i++) {
                if (tkData[i][0] === item.productId || tkData[i][1] === item.code) {
                  let currentStock = Number(tkData[i][6]);
                  let newStock = currentStock - Number(item.qty); // Trừ lại kho
                  sheetTK.getRange(i + 1, 7).setValue(newStock);
                  sheetLS.appendRow([generateId(), tkData[i][1], tkData[i][2], new Date(), 'export', Number(item.qty), `Khấu trừ do xóa phiếu Nhập Kho ${payload.id}`, user]);
                  break;
                }
              }
            }
            logAudit(ss, user, "Xóa", "Nhập Kho", `Xóa phiếu nhập hàng NCC: ${rowData[2]}`);
            
            // ---- Bắn thông báo Telegram Xóa Nhập Kho ----
            try {
              const supplier = rowData[2];
              const totalAmount = rowData[4];
              let msg = "❌ <b>MỘT PHIẾU NHẬP HÀNG VỪA BỊ XÓA</b>\n\n";
              msg += "- Nhà cung cấp: " + supplier + "\n";
              msg += "- Giá trị phiếu: " + formatVND(totalAmount) + "\n";
              msg += "- Người xóa: " + user + "\n";
              sendTelegramMessage(msg);
            } catch(e) {}
            // ----------------------------------------
            
            return deleteRowById(sheetNK, payload.id);
         }
         return responseJson({ error: 'Không tìm thấy phiếu' }, 404);
      }
    }

    else if (module === 'congno') {
      if (action === 'updateDueDate') {
        const d = payload.data;
        let targetSheet = ss.getSheetByName("Bán Hàng");
        let dataArr = targetSheet.getDataRange().getValues();
        let targetRow = -1;
        let pName = "";
        
        for (let i = 1; i < dataArr.length; i++) {
          if (dataArr[i][0] === d.id) {
            targetRow = i + 1;
            pName = dataArr[i][3]; // Tên Khách
            targetSheet.getRange(targetRow, 11).setValue(d.newDueDate ? new Date(d.newDueDate) : "");
            break;
          }
        }
        
        // Nếu không tìm thấy trong Bán Hàng, tìm trong Khách Hàng
        if (targetRow === -1) {
          targetSheet = ss.getSheetByName("Khách Hàng");
          dataArr = targetSheet.getDataRange().getValues();
          for (let i = 1; i < dataArr.length; i++) {
            if (dataArr[i][0] === d.id) {
              targetRow = i + 1;
              pName = dataArr[i][2]; // Tên Khách
              targetSheet.getRange(targetRow, 11).setValue(d.newDueDate ? new Date(d.newDueDate) : "");
              break;
            }
          }
        }
        
        if (targetRow !== -1) {
          logAudit(ss, user, "Sửa Hạn Thu", "Công Nợ", `Đổi ngày thu nợ khách: ${pName} thành ${d.newDueDate || "Trống"}`);
          triggerFirebaseSync(ss, ['congno']);
          return responseJson({ success: true });
        }
        return responseJson({ error: 'Không tìm thấy khoản nợ' }, 404);
      }

      if (action === 'pay_debt') {
        const d = payload.data;
        const type = d.type; // 'thu' or 'tra'
        const targetSheet = ss.getSheetByName(type === 'thu' ? "Bán Hàng" : "Nhập Kho");
        const dataArr = targetSheet.getDataRange().getValues();
        let targetRow = -1;
        let pName = "";

        for (let i = 1; i < dataArr.length; i++) {
          if (dataArr[i][0] === d.id) {
            targetRow = i + 1;
            pName = type === 'thu' ? dataArr[i][3] : dataArr[i][2]; // Tên Khách / Tên NCC
            
            // Cột tổng tiền và thanh toán phụ thuộc vào sheet
            let totalAmountCol = type === 'thu' ? 5 : 4;
            let paidAmountCol = type === 'thu' ? 6 : 5;

            let totalAmount = Number(dataArr[i][totalAmountCol]);
            let currentPaid = Number(dataArr[i][paidAmountCol]);
            let newPaid = currentPaid + Number(d.amount);
            let newDebt = totalAmount - newPaid;
            
            targetSheet.getRange(targetRow, paidAmountCol + 1).setValue(newPaid);
            targetSheet.getRange(targetRow, paidAmountCol + 2).setValue(newDebt); // Cột Còn nợ
            break;
          }
        }
        
        // Nếu không tìm thấy trong Bán Hàng, tìm trong Khách Hàng (nếu là thu nợ)
        if (targetRow === -1 && type === 'thu') {
          targetSheet = ss.getSheetByName("Khách Hàng");
          dataArr = targetSheet.getDataRange().getValues();
          for (let i = 1; i < dataArr.length; i++) {
            if (dataArr[i][0] === d.id) {
              targetRow = i + 1;
              pName = dataArr[i][2]; // Tên Khách
              let paidAmountCol = 6;
              let currentPaid = Number(dataArr[i][paidAmountCol]);
              let currentDebt = Number(dataArr[i][7]);
              let newPaid = currentPaid + Number(d.amount);
              let newDebt = currentDebt - Number(d.amount);
              
              targetSheet.getRange(targetRow, paidAmountCol + 1).setValue(newPaid);
              targetSheet.getRange(targetRow, 8).setValue(newDebt); // Cột Còn nợ
              break;
            }
          }
        }

        if (targetRow === -1) return responseJson({ error: 'Không tìm thấy đơn hàng' }, 404);

        const sheetThuChi = ss.getSheetByName("Thu Chi");
        if (sheetThuChi) {
          if (type === 'thu') {
            sheetThuChi.appendRow([generateId(), new Date(d.date), "", "", `Thu nợ KH: ${pName} - ${d.note}`, Number(d.amount), "", user]);
            logAudit(ss, user, "Thu Nợ", "Công Nợ", `Thu nợ KH ${pName}: ${d.amount}`);
          } else {
             sheetThuChi.appendRow([generateId(), new Date(d.date), `Trả nợ NCC: ${pName} - ${d.note}`, Number(d.amount), "", "", "", user]);
             logAudit(ss, user, "Trả Nợ", "Công Nợ", `Trả nợ NCC ${pName}: ${d.amount}`);
          }
        }
        return responseJson({ success: true });
      }
    }

    else if (module === 'khohang') {
      if (action === 'update_product') {
        const d = payload.data;
        const sheetTK = ss.getSheetByName("Tồn Kho");
        const match = getRowById(sheetTK, payload.id);
        if (match) {
          // Columns: ID (1), Mã SP (2), Tên (3), ĐVT (4), Giá Nhập (5), Giá Bán (6), Tồn (7)
          sheetTK.getRange(match.rowNum, 2, 1, 6).setValues([[
            d.code, d.name, d.unit, d.importPrice, d.price, d.stock
          ]]);
          logAudit(ss, user, "Cập nhật", "Kho Hàng", `Cập nhật Sản Phẩm: ${d.name}`);
          return responseJson({ success: true });
        }
        return responseJson({ error: 'Không tìm thấy sản phẩm' }, 404);
      }
    }

    return responseJson({ error: 'Action hoặc Module không hợp lệ' }, 400);
  } catch (error) {
    return responseJson({ error: error.message }, 500);
  }
}

function getPreviousBalance(ss, month, year) {
  const sheet = ss.getSheetByName("Thu Chi");
  if (!sheet) return 0;
  let totalIncome = 0;
  let totalExpense = 0;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    let row = values[i];
    if (!row[0]) continue;
    let rowDate = row[1] instanceof Date ? row[1] : new Date(row[1]);
    if (isNaN(rowDate)) continue;
    if (rowDate.getFullYear() < year || (rowDate.getFullYear() == year && rowDate.getMonth() + 1 < month)) {
      totalExpense += Number(row[3]) || 0;
      totalIncome += Number(row[5]) || 0;
    }
  }
  return totalIncome - totalExpense;
}

function responseJson(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Hàm gửi thông báo công nợ định kỳ (được trigger hàng ngày)
function checkAndSendDebtNotifications() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const now = new Date();
  const warningLimit = new Date();
  warningLimit.setDate(now.getDate() + 3); // Báo trước 3 ngày
  
  let msgs = [];
  
  // Kiểm tra Bán Hàng
  const bhSheet = ss.getSheetByName("Bán Hàng");
  if (bhSheet) {
    const bhData = bhSheet.getDataRange().getValues();
    for (let i = 1; i < bhData.length; i++) {
      let debt = Number(bhData[i][7]);
      let dueDate = bhData[i][10]; // Cột 11
      if (debt > 0 && dueDate && dueDate instanceof Date) {
        if (dueDate.getTime() <= warningLimit.getTime()) {
          let isOverdue = dueDate.getTime() < now.setHours(0,0,0,0);
          msgs.push(`- KH: ${bhData[i][3]} | Nợ: ${formatVND(debt)} | Hạn: ${dueDate.toISOString().split('T')[0]} ${isOverdue ? '(QUÁ HẠN)' : ''}`);
        }
      }
    }
  }

  // Kiểm tra Khách Hàng
  const khSheet = ss.getSheetByName("Khách Hàng");
  if (khSheet) {
    const khData = khSheet.getDataRange().getValues();
    for (let i = 1; i < khData.length; i++) {
      let debt = Number(khData[i][7]);
      let dueDate = khData[i][10]; // Cột 11
      if (debt > 0 && dueDate && dueDate instanceof Date) {
        if (dueDate.getTime() <= warningLimit.getTime()) {
          let isOverdue = dueDate.getTime() < now.setHours(0,0,0,0);
          msgs.push(`- KH (Ngoài HĐ): ${khData[i][2]} | Nợ: ${formatVND(debt)} | Hạn: ${dueDate.toISOString().split('T')[0]} ${isOverdue ? '(QUÁ HẠN)' : ''}`);
        }
      }
    }
  }

  if (msgs.length > 0) {
    let header = "🚨 <b>THÔNG BÁO CÔNG NỢ SẮP/ĐÃ ĐẾN HẠN</b> 🚨\n\n";
    sendTelegramMessage(header + msgs.join("\n"));
  }
}

function generateId() {
  return 'ID_' + new Date().getTime();
}

function doOptions(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT).setHeaders(headers);
}


// ---------------- FIREBASE SYNC ----------------
const FIREBASE_URL = 'https://appnguyenhoads-default-rtdb.asia-southeast1.firebasedatabase.app/';

function triggerFirebaseSync(ss, modules) {
  try {
    const requests = [];
    modules.forEach(module => {
      let result = {};
      if (module === 'banhang') {
        const sheet = ss.getSheetByName("Bán Hàng");
        const values = sheet.getDataRange().getValues();
        const data = [];
        for (let i = 1; i < values.length; i++) {
          let row = values[i];
          if (!row[0]) continue;
          let rowDate = row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1];
          data.push({
            id: row[0], date: rowDate, phone: row[2] || "", customerName: row[3] || "",
            items: JSON.parse(row[4] || "[]"), totalAmount: row[5] || 0,
            paidAmount: row[6] || 0, debt: row[7] || 0, note: row[8] || "", creator: row[9] || ""
          });
        }
        result = { data: data };
      }
      else if (module === 'nhapkho') {
        const sheet = ss.getSheetByName("Nhập Kho");
        const values = sheet.getDataRange().getValues();
        const data = [];
        for (let i = 1; i < values.length; i++) {
          let row = values[i];
          if (!row[0]) continue;
          let rowDate = row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1];
          data.push({
            id: row[0], date: rowDate, supplier: row[2] || "",
            items: JSON.parse(row[3] || "[]"), totalAmount: row[4] || 0,
            paidAmount: row[5] || 0, debt: row[6] || 0, note: row[7] || "", creator: row[8] || ""
          });
        }
        result = { data: data };
      }
      else if (module === 'khohang') {
        const sheetTonKho = ss.getSheetByName("Tồn Kho");
        const tkValues = sheetTonKho.getDataRange().getValues();
        const products = [];
        for (let i = 1; i < tkValues.length; i++) {
          let row = tkValues[i];
          if (!row[0]) continue;
          products.push({ id: row[0], code: row[1] || "", name: row[2] || "", unit: row[3] || "", importPrice: row[4] || 0, price: row[5] || 0, stock: row[6] || 0 });
        }

        const sheetLichSu = ss.getSheetByName("Lịch Sử Kho");
        const lsValues = sheetLichSu.getDataRange().getValues();
        const logs = [];
        for (let i = 1; i < lsValues.length; i++) {
          let row = lsValues[i];
          if (!row[0]) continue;
          logs.push({
            id: row[0], productId: row[1], productName: row[2],
            date: row[3] instanceof Date ? row[3].toISOString().split('T')[0] : row[3],
            type: row[4] || "export", quantity: row[5] || 0, note: row[6] || "", user: row[7] || ""
          });
        }
        result = { products: products, logs: logs };
      }
      else if (module === 'khachhang') {
        const sheet = ss.getSheetByName("Khách Hàng");
        const values = sheet.getDataRange().getValues();
        
        const bhSheet = ss.getSheetByName("Bán Hàng");
        const bhValues = bhSheet ? bhSheet.getDataRange().getValues() : [];
        const stats = {};
        for (let i = 1; i < bhValues.length; i++) {
          let row = bhValues[i];
          if (!row[0]) continue;
          let phone = String(row[2] || "").replace(/^'/, "");
          let totalAmount = Number(row[5]) || 0;
          let debt = Number(row[7]) || 0;
          if (!stats[phone]) stats[phone] = { spent: 0, debt: 0, count: 0 };
          stats[phone].spent += totalAmount;
          stats[phone].debt += debt;
          stats[phone].count += 1;
        }

        const data = [];
        for (let i = 1; i < values.length; i++) {
          let row = values[i];
          if (!row[0]) continue;
          let phone = String(row[1] || "").replace(/^'/, "");
          let stat = stats[phone] || { spent: 0, debt: 0, count: 0 };
          data.push({ 
            id: row[0], phone: phone, name: row[2] || "", 
            purchaseCount: stat.count, totalSpent: stat.spent, debt: row[7] || 0, note: row[4] || "",
            orders: row[5] || "", paid: row[6] || 0, acceptanceDate: row[8] || "", address: row[9] || ""
          });
        }
        result = { data: data };
      }
      else if (module === 'congno') {
        const bhSheet = ss.getSheetByName("Bán Hàng");
        const bhValues = bhSheet.getDataRange().getValues();
        const phaithu = [];
        for (let i = 1; i < bhValues.length; i++) {
          let row = bhValues[i];
          if (!row[0]) continue;
          let debt = Number(row[7]) || 0;
          if (debt > 0) {
            phaithu.push({
              id: row[0], date: row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1],
              phone: row[2], name: row[3], total: row[5], debt: debt,
              dueDate: row[10] instanceof Date ? row[10].toISOString().split('T')[0] : row[10],
              note: row[8] || ""
            });
          }
        }
        
        const khSheet = ss.getSheetByName("Khách Hàng");
        const khValues = khSheet.getDataRange().getValues();
        for (let i = 1; i < khValues.length; i++) {
          let row = khValues[i];
          if (!row[0]) continue;
          let debt = Number(row[7]) || 0;
          if (debt > 0) {
            phaithu.push({
              id: row[0], date: row[8] instanceof Date ? row[8].toISOString().split('T')[0] : row[8],
              phone: row[1], name: row[2], total: (Number(row[6])||0) + debt, debt: debt,
              dueDate: row[10] instanceof Date ? row[10].toISOString().split('T')[0] : row[10],
              note: row[4] || ""
            });
          }
        }

        const nkSheet = ss.getSheetByName("Nhập Kho");
        const nkValues = nkSheet.getDataRange().getValues();
        const phaitra = [];
        for (let i = 1; i < nkValues.length; i++) {
          let row = nkValues[i];
          if (!row[0]) continue;
          let debt = Number(row[6]) || 0;
          if (debt > 0) {
            phaitra.push({
              id: row[0], date: row[1] instanceof Date ? row[1].toISOString().split('T')[0] : row[1],
              phone: "", name: row[2], total: row[4], debt: debt
            });
          }
        }
        result = { phaithu: phaithu, phaitra: phaitra };
      }
      else if (module === 'thuchi') {
        const sheet = ss.getSheetByName("Thu Chi");
        const values = sheet.getDataRange().getValues();
        const data = [];
        for (let i = 1; i < values.length; i++) {
          let row = values[i];
          if (!row[0]) continue;
          let rowDate = row[1] instanceof Date ? row[1] : new Date(row[1]);
          if (isNaN(rowDate)) continue;
          data.push({
            id: row[0], date: rowDate.toISOString().split('T')[0],
            expenseContent: row[2] || "", expenseAmount: row[3] || 0,
            incomeContent: row[4] || "", incomeAmount: row[5] || 0,
            personName: row[6] || "", creatorName: row[7] || ""
          });
        }
        result = { data: data };
      }
      else if (module === 'users') {
        const sheetTK = ss.getSheetByName("Tài Khoản");
        if (sheetTK) {
          const tkData = sheetTK.getDataRange().getValues();
          const users = [];
          for (let i = 1; i < tkData.length; i++) {
            if (!tkData[i][0]) continue;
            let perms = [];
            try { perms = JSON.parse(tkData[i][5]); } catch(e) {}
            users.push({
              id: tkData[i][0],
              username: tkData[i][1],
              role: tkData[i][3],
              fullName: tkData[i][4],
              permissions: perms
            });
          }
          result = { data: users };
        }
      }

      if (Object.keys(result).length > 0) {
        requests.push({
          url: FIREBASE_URL + module + '.json',
          method: 'put',
          contentType: 'application/json',
          payload: JSON.stringify(result)
        });
      }
    });

    if (requests.length > 0) {
      UrlFetchApp.fetchAll(requests);
    }
  } catch (e) {
    Logger.log("Firebase sync error: " + e.message);
  }
}

// Chạy hàm này một lần duy nhất từ Apps Script Editor để đồng bộ toàn bộ dữ liệu cũ lên Firebase
function initialFirebaseSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  triggerFirebaseSync(ss, ['thuchi', 'banhang', 'nhapkho', 'khohang', 'khachhang', 'congno', 'users']);
  Logger.log("Đồng bộ Firebase thành công!");
}

// ---------------- TELEGRAM BOT ----------------
const TELEGRAM_BOT_TOKEN = '8709485898:AAFn2zJutybiMWhRkrBHimr2oOYmP19Kn0g';
const TELEGRAM_CHAT_ID = '-1004439454270';

function sendTelegramMessage(text) {
  try {
    const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    };
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log("Telegram Error: " + e.message);
  }
}

function formatVND(num) {
  if (!num) return '0 đ';
  return Number(num).toLocaleString('vi-VN') + ' đ';
}

function dailyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dateObj = new Date(todayStr);
  
  // 1. Thống kê Thu Chi
  let totalIncome = 0;
  let totalExpense = 0;
  let previousBalance = 0; 
  const tcSheet = ss.getSheetByName("Thu Chi");
  if (tcSheet) {
    const tcValues = tcSheet.getDataRange().getValues();
    for (let i = 1; i < tcValues.length; i++) {
      let row = tcValues[i];
      if (!row[0]) continue;
      let rowDate = row[1] instanceof Date ? row[1] : new Date(row[1]);
      if (isNaN(rowDate)) continue;
      
      let exp = Number(row[3]) || 0;
      let inc = Number(row[5]) || 0;
      
      if (rowDate.toISOString().split('T')[0] === todayStr) {
        totalExpense += exp;
        totalIncome += inc;
      } else if (rowDate < new Date(todayStr)) {
        previousBalance += inc - exp;
      }
    }
  }
  
  // 2. Thống kê Bán Hàng
  let salesCount = 0;
  let salesRevenue = 0;
  let salesDebt = 0;   
  const bhSheet = ss.getSheetByName("Bán Hàng");
  if (bhSheet) {
    const bhValues = bhSheet.getDataRange().getValues();
    for (let i = 1; i < bhValues.length; i++) {
      let row = bhValues[i];
      if (!row[0]) continue;
      let rowDate = row[1] instanceof Date ? row[1] : new Date(row[1]);
      if (isNaN(rowDate)) continue;
      
      if (rowDate.toISOString().split('T')[0] === todayStr) {
        salesCount++;
        salesRevenue += (Number(row[6]) || 0);
        salesDebt += (Number(row[7]) || 0);   
      }
    }
  }

  let finalBalance = previousBalance + totalIncome - totalExpense;

  let msg = "📊 <b>BÁO CÁO TỔNG KẾT NGÀY " + todayStr.split('-').reverse().join('/') + "</b>\n\n";
  msg += "📈 <b>HOẠT ĐỘNG THU / CHI</b>\n";
  msg += "- Dư đầu kỳ: " + formatVND(previousBalance) + "\n";
  msg += "- Tổng Thu trong ngày: <b>" + formatVND(totalIncome) + "</b>\n";
  msg += "- Tổng Chi trong ngày: <b>" + formatVND(totalExpense) + "</b>\n";
  msg += "- Dư cuối ngày (Hiện tại quỹ): <b>" + formatVND(finalBalance) + "</b>\n\n";
  
  msg += "🛒 <b>HOẠT ĐỘNG BÁN HÀNG</b>\n";
  msg += "- Số đơn hàng xuất ra: <b>" + salesCount + "</b> đơn\n";
  msg += "- Tiền thu từ khách: <b>" + formatVND(salesRevenue) + "</b>\n";
  msg += "- Công nợ phát sinh: <b>" + formatVND(salesDebt) + "</b>\n";

  sendTelegramMessage(msg);
}
