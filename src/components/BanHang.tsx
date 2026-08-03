import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Printer, Trash2, ShoppingCart, TrendingUp, UserCheck, RefreshCw, X, Edit, Search } from 'lucide-react';
import { fetchData, postData } from '../api';

// --- TYPES ---
interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  importPrice: number;
  stock: number;
}

interface Customer {
  id: string;
  phone: string;
  name: string;
  purchaseCount: number;
}

interface SaleItem {
  productId: string;
  code: string;
  name: string;
  searchVal?: string;
  qty: number;
  price: number;
  importPrice: number;
}

interface SaleRecord {
  id: string;
  date: string;
  phone: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  paidAmount: number;
  debt: number;
  note: string;
  dueDate?: string;
  creatorName?: string;
}

export default function BanHang() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Form State
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [phone, setPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [items, setItems] = useState<SaleItem[]>([{ productId: '', code: '', name: '', qty: 1, price: 0, importPrice: 0 }]);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [isPaidInFull, setIsPaidInFull] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  
  const [printRecord, setPrintRecord] = useState<SaleRecord | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [resSales, resCustomers, resProducts] = await Promise.all([
        fetchData('banhang'),
        fetchData('khachhang'),
        fetchData('khohang')
      ]);
      setSales(resSales.data || []);
      setCustomers(resCustomers.data || []);
      setProducts(resProducts.products || []); // products is inside resProducts.products
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu", error);
      alert("Lỗi tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }



  // Product Selection Handlers
  const handleProductSearch = (index: number, val: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], searchVal: val };
    
    const matched = products.find(p => `${p.code} - ${p.name}` === val);
    if (matched) {
      newItems[index].productId = matched.id;
      newItems[index].code = matched.code;
      newItems[index].name = matched.name;
      newItems[index].price = matched.price;
      newItems[index].importPrice = matched.importPrice || 0;
      newItems[index].searchVal = `${matched.code} - ${matched.name}`;
    } else {
      newItems[index].productId = '';
      newItems[index].name = val;
    }
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof SaleItem, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItemRow = () => setItems([...items, { productId: '', code: '', name: '', searchVal: '', qty: 1, price: 0, importPrice: 0 }]);
  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const currentTotalAmount = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const currentDebt = currentTotalAmount - (Number(paidAmount) || 0);

  useEffect(() => {
    if (isPaidInFull) {
      setPaidAmount(currentTotalAmount.toString());
    }
  }, [isPaidInFull, currentTotalAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !customerName || items.some(i => (!i.productId && !i.name && !i.searchVal) || i.qty <= 0)) {
      alert("Vui lòng điền đầy đủ thông tin khách hàng và sản phẩm hợp lệ.");
      return;
    }

    const payload = {
      date,
      phone,
      customerName,
      items,
      paidAmount: Number(paidAmount) || 0,
      note,
      dueDate: currentDebt > 0 ? dueDate : ''
    };

    setLoading(true);
    try {
      const action = editingId ? 'update' : 'add';
      const requestPayload: any = { data: payload };
      if (editingId) requestPayload.id = editingId;

      await postData('banhang', action, requestPayload);
      await loadAllData();
      
      // Reset form
      cancelEdit();
      alert(editingId ? "Cập nhật thành công!" : "Tạo phiếu bán hàng thành công!");
    } catch (error) {
      console.error("Lỗi thêm dữ liệu", error);
      alert("Có lỗi khi tạo phiếu bán hàng. Chi tiết: " + (error instanceof Error ? error.message : JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: SaleRecord) => {
    setEditingId(record.id);
    setDate(record.date.split('T')[0]);
    setPhone(record.phone);
    setCustomerName(record.customerName);
    
    const loadedItems = record.items.map(item => ({
      ...item,
      searchVal: `${item.code} - ${item.name}`
    }));
    setItems(loadedItems.length > 0 ? loadedItems : [{ productId: '', code: '', name: '', searchVal: '', qty: 1, price: 0, importPrice: 0 }]);
    setPaidAmount(record.paidAmount.toString());
    setIsPaidInFull(record.paidAmount >= record.totalAmount && record.totalAmount > 0);
    setNote(record.note || '');
    setDueDate(record.dueDate ? record.dueDate.split('T')[0] : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setPhone('');
    setCustomerName('');
    setItems([{ productId: '', code: '', name: '', searchVal: '', qty: 1, price: 0, importPrice: 0 }]);
    setPaidAmount('');
    setIsPaidInFull(false);
    setNote('');
    setDueDate('');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa phiếu này? Lưu ý: Việc xóa phiếu sẽ KHÔNG tự động cộng lại Tồn Kho.')) {
      setLoading(true);
      try {
        await postData('banhang', 'delete', { id });
        await loadAllData();
      } catch (error) {
        console.error("Lỗi khi xóa", error);
        alert("Có lỗi khi xóa dữ liệu.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrint = (record: SaleRecord) => {
    setPrintRecord(record);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const formatMoney = (val: number) => val.toLocaleString('vi-VN');

  // Thống kê
  const filteredSales = sales.filter(s => {
    let matchSearch = true;
    if (filterSearch) {
      const lowerSearch = filterSearch.toLowerCase();
      matchSearch = !!(s.customerName?.toLowerCase().includes(lowerSearch) || s.phone?.includes(filterSearch));
    }
    if (!matchSearch) return false;
    
    if (filterFromDate || filterToDate) {
      const saleDate = new Date(s.date);
      saleDate.setHours(0,0,0,0);
      
      if (filterFromDate) {
        const from = new Date(filterFromDate);
        from.setHours(0,0,0,0);
        if (saleDate < from) return false;
      }
      if (filterToDate) {
        const to = new Date(filterToDate);
        to.setHours(23,59,59,999);
        if (saleDate > to) return false;
      }
    }
    
    return true;
  });

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalItemsSold = filteredSales.reduce((sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + Number(item.qty), 0), 0);
  const totalDebt = filteredSales.reduce((sum, s) => sum + s.debt, 0);

  const formContent = (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label">Ngày xuất phiếu</label>
          <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Số điện thoại Khách</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Nhập SĐT..."
            list="customer-list"
            value={phone}
            onChange={(e) => {
              const val = e.target.value;
              setPhone(val);
              const matched = customers.find(c => c.phone === val);
              if (matched) setCustomerName(matched.name);
            }}
            required
          />
          <datalist id="customer-list">
            {customers.map(c => <option key={c.id} value={c.phone}>{c.name}</option>)}
          </datalist>
        </div>
        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label">
            Tên Khách Hàng
            {customers.find(c => c.phone === phone) && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--income-color)', fontWeight: 'normal' }}>
              (Khách quen - Đã mua {customers.find(c => c.phone === phone)?.purchaseCount} lần)
            </span>}
          </label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Tên khách hàng..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Items List */}
      <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <label className="form-label">Chi tiết Đơn Hàng</label>
        {items.map((item, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 3 }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Nhập mã, tên hoặc tự gõ hàng ngoài..."
                list={`product-list-${index}`}
                value={item.searchVal !== undefined ? item.searchVal : (item.code ? `${item.code} - ${item.name}` : item.name)}
                onChange={(e) => handleProductSearch(index, e.target.value)}
                required
                style={{ fontSize: '1.1rem', padding: '0.6rem' }}
              />
              <datalist id={`product-list-${index}`}>
                {products.map(p => (
                  <option key={p.id} value={`${p.code} - ${p.name}`}>Tồn: {p.stock}</option>
                ))}
              </datalist>
              {!item.productId && (item.searchVal || item.name) && (
                <small style={{ color: 'var(--income-color)', display: 'block', marginTop: '4px' }}>
                  * Hàng nhập ngoài (Không trừ Tồn kho)
                </small>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input 
                type="number" className="form-control" placeholder="Đơn giá" min="0" step="1000"
                value={item.price || ''} 
                onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))} 
                title="Đơn giá (Có thể sửa để chiết khấu)"
              />
            </div>
            <div style={{ width: '80px' }}>
              <input 
                type="number" className="form-control" placeholder="SL" min="1" 
                value={item.qty || ''} 
                onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))} 
              />
            </div>
            <div style={{ width: '100px', display: 'flex', alignItems: 'center', height: '38px', fontWeight: 'bold' }}>
              {formatMoney(item.qty * item.price)} đ
            </div>
            {items.length > 1 && (
              <button type="button" className="btn-icon" style={{ height: '38px', color: 'var(--expense-color)' }} onClick={() => removeItemRow(index)}>
                <X size={20} />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={addItemRow}>
          + Thêm sản phẩm
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', fontSize: '1.1rem' }}>
        <strong>Tổng Cộng: <span style={{ color: 'var(--primary-color)' }}>{formatMoney(currentTotalAmount)} đ</span></strong>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">Khách thanh toán (đ)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
              <input 
                type="checkbox" 
                checked={isPaidInFull} 
                onChange={(e) => setIsPaidInFull(e.target.checked)} 
              />
              Đã thanh toán hết
            </label>
          </div>
          <input 
            type="number" className="form-control" min="0" step="1000"
            value={paidAmount} onChange={(e) => {
              setPaidAmount(e.target.value);
              if (isPaidInFull) setIsPaidInFull(false);
            }}
            disabled={isPaidInFull}
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Ghi chú</label>
          <input type="text" className="form-control" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {currentDebt > 0 && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', background: '#fee2e2', padding: '1rem', borderRadius: '8px' }}>
          <div style={{ flex: 1, color: 'var(--expense-color)', fontSize: '1.1rem', fontWeight: 'bold' }}>
            Khách Nợ: {formatMoney(currentDebt)} đ
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label" style={{ color: 'var(--expense-color)' }}>Hạn thu tiền (Không bắt buộc)</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ borderColor: 'var(--expense-color)' }}
              value={dueDate} 
              onChange={(e) => setDueDate(e.target.value)} 
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
        <button type="submit" className="btn btn-income" style={{ flex: 1 }} disabled={loading}>
          {loading ? 'Đang xử lý...' : (editingId ? 'CẬP NHẬT PHIẾU BÁN HÀNG' : 'HOÀN TẤT & LƯU PHIẾU')}
        </button>
      </div>
    </form>
  );

  return (
    <div className="module-container">
      <div className="no-print">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
        <h2>Bán Hàng & Công Nợ</h2>
        <button className="btn btn-icon" onClick={loadAllData} title="Làm mới" disabled={loading}>
          <RefreshCw size={20} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card income">
          <div className="summary-title">
            <TrendingUp size={16} color="var(--income-color)" style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
            Doanh Số Bán Hàng
          </div>
          <div className="summary-amount income-text">{formatMoney(totalRevenue)} đ</div>
        </div>
        <div className="summary-card" style={{ borderTopColor: '#3b82f6' }}>
          <div className="summary-title">
            <ShoppingCart size={16} color="#3b82f6" style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
            Số Lượng Bán Ra
          </div>
          <div className="summary-amount" style={{ color: '#3b82f6' }}>{formatMoney(totalItemsSold)}</div>
        </div>
        <div className="summary-card expense">
          <div className="summary-title">
            <UserCheck size={16} color="var(--expense-color)" style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
            Tổng Công Nợ Khách
          </div>
          <div className="summary-amount expense-text">{formatMoney(totalDebt)} đ</div>
        </div>
      </div>

      <div className="grid-50-50">
        {/* Form Section */}
        <div className="card form-card income" style={{ order: 2 }}>
          <div className="card-header">
            <h2 className="card-title" style={{ margin: 0 }}>
              <ShoppingCart size={20} style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
              LẬP PHIẾU BÁN HÀNG
            </h2>
          </div>
          <div className="form-body">
            {!editingId && (
              <div style={{ marginTop: '1rem' }}>
                {formContent}
              </div>
            )}
          </div>
        </div>

        {/* Table Section */}
        <div className="card" style={{ overflow: 'hidden', order: 1 }}>
          <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Danh sách Đơn Bán Hàng</h2>
            
            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ flex: '1 1 300px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Tìm theo tên khách hàng hoặc SĐT..." 
                  style={{ paddingLeft: '35px', marginBottom: 0 }}
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b', whiteSpace: 'nowrap' }}>Từ ngày:</span>
                <input 
                  type="date" 
                  className="form-control" 
                  style={{ marginBottom: 0 }}
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                />
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b', whiteSpace: 'nowrap' }}>Đến ngày:</span>
                <input 
                  type="date" 
                  className="form-control" 
                  style={{ marginBottom: 0 }}
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Khách Hàng</th>
                  <th className="text-right">Tổng Tiền</th>
                  <th className="text-right">Đã Thu</th>
                  <th className="text-right">Còn Nợ</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && sales.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{padding: '2rem'}}>Đang tải dữ liệu...</td></tr>
                ) : filteredSales.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{padding: '2rem', color: 'var(--text-secondary)'}}>{sales.length === 0 ? 'Chưa có đơn bán hàng nào.' : 'Không tìm thấy đơn hàng phù hợp.'}</td></tr>
                ) : (
                  [...filteredSales].reverse().map((row) => (
                    <tr key={row.id}>
                      <td>{row.date ? format(new Date(row.date), 'dd/MM/yyyy') : ''}</td>
                      <td>
                        <div style={{ fontWeight: 'bold' }}>{row.customerName}</div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{row.phone}</div>
                      </td>
                      <td className="text-right" style={{ fontWeight: 'bold' }}>{formatMoney(row.totalAmount)}</td>
                      <td className="text-right" style={{ color: 'var(--primary-color)' }}>{formatMoney(row.paidAmount)}</td>
                      <td className="text-right" style={{ color: row.debt > 0 ? 'var(--expense-color)' : 'var(--income-color)', fontWeight: 'bold' }}>
                        {formatMoney(row.debt)}
                      </td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="btn-icon" onClick={() => handleEdit(row)} title="Sửa Phiếu" style={{color: 'var(--primary-color)'}}>
                            <Edit size={16} />
                          </button>
                          <button className="btn-icon" onClick={() => handlePrint(row)} title="In Phiếu">
                            <Printer size={16} />
                          </button>
                          <button className="btn-icon" style={{color: 'var(--expense-color)'}} onClick={() => handleDelete(row.id)} title="Xóa">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>

      {/* Hidden Print Template (A5) */}
      {printRecord && (
        <div id="printable-receipt">
          <div style={{ padding: '15px', fontFamily: 'Arial, sans-serif', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase' }}>Quảng Cáo Nguyễn Hồ</div>
                <div style={{ fontSize: '11px' }}>Địa chỉ: 67 đường 3/2. Phường Vườn Lài</div>
                <div style={{ fontSize: '11px' }}>SĐT: 0933735073 - 0912737074</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, fontSize: '20px' }}>PHIẾU XUẤT KHO</h1>
                <h2 style={{ margin: 0, fontSize: '13px' }}>(Kiêm Hoá Đơn Bán Hàng)</h2>
                <div style={{ fontSize: '11px', marginTop: '5px' }}>Ngày: {format(new Date(printRecord.date), 'dd/MM/yyyy')}</div>
              </div>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <div><strong>Khách hàng:</strong> {printRecord.customerName}</div>
              <div><strong>Điện thoại:</strong> {printRecord.phone}</div>
              {printRecord.note && <div><strong>Ghi chú:</strong> {printRecord.note}</div>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>STT</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Mã - Tên Hàng</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>SL</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>Đơn Giá</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>Thành Tiền</th>
                </tr>
              </thead>
              <tbody>
                {printRecord.items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{item.code} - {item.name}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatMoney(item.price)}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{formatMoney(item.qty * item.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontWeight: 'bold' }}>TỔNG CỘNG:</td>
                  <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>
                    {formatMoney(printRecord.totalAmount)} đ
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontStyle: 'italic' }}>Khách đã thanh toán:</td>
                  <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontStyle: 'italic' }}>
                    {formatMoney(printRecord.paidAmount)} đ
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontWeight: 'bold', color: 'red' }}>CÒN NỢ:</td>
                  <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatMoney(printRecord.debt)} đ
                  </td>
                </tr>
              </tfoot>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', textAlign: 'center' }}>
              <div style={{ width: '30%' }}>
                <strong>Người Nhận Hàng</strong>
                <div style={{ margin: '5px 0' }}><small>(Ký, ghi rõ họ tên)</small></div>
              </div>
              <div style={{ width: '30%' }}>
                <strong>Thủ Kho</strong>
                <div style={{ margin: '5px 0' }}><small>(Ký, ghi rõ họ tên)</small></div>
              </div>
              <div style={{ width: '30%' }}>
                <strong>Người Lập Phiếu</strong>
                <div style={{ margin: '5px 0' }}><small>(Ký, ghi rõ họ tên)</small></div>
                <div style={{ marginTop: '60px', fontWeight: 'bold' }}>{printRecord.creatorName || ''}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="card-title" style={{ margin: 0 }}>Cập nhật phiếu Bán Hàng</h2>
              <button className="btn-icon" onClick={cancelEdit}><X size={20}/></button>
            </div>
            <div className="modal-body">
              {formContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
