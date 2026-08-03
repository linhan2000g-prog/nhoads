import React, { useState, useEffect } from 'react';
import { Package, PlusCircle, RefreshCw, Edit, X, Search, FileBarChart } from 'lucide-react';
import { formatMoney } from '../utils';
import { fetchData, postData } from '../api';
import ReportModal from './ReportModal';
import { format } from 'date-fns';

export default function KhoHang() {
  const [products, setProducts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState([{ productId: '', code: '', name: '', searchVal: '', unit: '', importPrice: 0, qty: 1 }]);
  const [paidAmount, setPaidAmount] = useState('');
  const [note, setNote] = useState('');

  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [filterSearch, setFilterSearch] = useState('');
  
  // Report Modal
  const [showReport, setShowReport] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchData('khohang');
      if (res.products) setProducts(res.products);
      if (res.logs) setLogs(res.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductSearch = (index: number, val: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], searchVal: val };
    
    const p = products.find(prod => `${prod.code} - ${prod.name}` === val || prod.code === val || prod.name === val);
    if (p) {
      newItems[index].productId = p.id;
      newItems[index].code = p.code;
      newItems[index].name = p.name;
      newItems[index].unit = p.unit;
      newItems[index].importPrice = p.importPrice;
      newItems[index].searchVal = `${p.code} - ${p.name}`;
    } else {
      newItems[index].productId = '';
      newItems[index].code = '';
      newItems[index].name = val; // Tự nhập tên SP mới nếu chưa có trong kho
    }
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const addItemRow = () => setItems([...items, { productId: '', code: '', name: '', searchVal: '', unit: '', importPrice: 0, qty: 1 }]);

  const currentTotalAmount = items.reduce((sum, item) => sum + (item.qty * item.importPrice), 0);
  const currentDebt = currentTotalAmount - (Number(paidAmount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(i => !i.name || i.qty <= 0 || i.importPrice < 0)) {
      alert("Vui lòng nhập đầy đủ thông tin sản phẩm hợp lệ!");
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        date, supplier, items, paidAmount: Number(paidAmount) || 0, note
      };
      await postData('nhapkho', 'add', { data: payload });
      alert("Tạo phiếu nhập hàng thành công!");
      setSupplier('');
      setItems([{ productId: '', code: '', name: '', searchVal: '', unit: '', importPrice: 0, qty: 1 }]);
      setPaidAmount('');
      setNote('');
      await loadData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await postData('khohang', 'update_product', { 
        id: editingProduct.id, 
        data: editingProduct 
      });
      alert("Cập nhật sản phẩm thành công!");
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert("Lỗi cập nhật: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${name}" không?`)) return;
    setLoading(true);
    try {
      await postData('khohang', 'delete_product', { id });
      alert("Xóa sản phẩm thành công!");
      await loadData();
    } catch (err: any) {
      alert("Lỗi xóa sản phẩm: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!filterSearch) return true;
    const lowerSearch = filterSearch.toLowerCase();
    return !!(p.name?.toLowerCase().includes(lowerSearch) || p.code?.toLowerCase().includes(lowerSearch));
  });

  return (
    <div className="module-container">
      <div className="header">
        <h1 className="title">Quản Lý Kho & Nhập Hàng</h1>
      </div>

      <div className="grid-50-50">
        
        {/* Form Section (Right side visually, so it's order 2) */}
        <div className="card form-card expense" style={{ order: 2 }}>
          <div className="card-header">
            <h2 className="card-title" style={{ margin: 0 }}>
              <Package size={20} style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
              LẬP PHIẾU NHẬP HÀNG
            </h2>
          </div>
          <div className="form-body">
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Ngày nhập</label>
                  <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                  <label className="form-label">Nhà Cung Cấp</label>
                  <input type="text" className="form-control" placeholder="Tên NCC..." value={supplier} onChange={(e) => setSupplier(e.target.value)} required />
                </div>
              </div>

              {/* Items List */}
              <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <label className="form-label">Chi tiết Hàng Nhập</label>
                {items.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 2 }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Tìm SP hoặc nhập mới..."
                        list={`import-product-list-${index}`}
                        value={item.searchVal !== undefined ? item.searchVal : item.name}
                        onChange={(e) => handleProductSearch(index, e.target.value)}
                        required
                      />
                      <datalist id={`import-product-list-${index}`}>
                        {products.map(p => <option key={p.id} value={`${p.code} - ${p.name}`} />)}
                      </datalist>
                      {!item.productId && item.searchVal && (
                        <small style={{ color: 'var(--primary-color)', display: 'block', marginTop: '4px' }}>
                          * SP mới sẽ được tự động thêm vào kho
                        </small>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="number" className="form-control" placeholder="Giá nhập" min="0" step="1000"
                        value={item.importPrice || ''} onChange={(e) => handleItemChange(index, 'importPrice', Number(e.target.value))} 
                        required
                      />
                    </div>
                    <div style={{ width: '80px' }}>
                      <input 
                        type="number" className="form-control" placeholder="SL" min="1" 
                        value={item.qty || ''} onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))} 
                        required
                      />
                    </div>
                    <div style={{ width: '100px', display: 'flex', alignItems: 'center', height: '38px', fontWeight: 'bold' }}>
                      {formatMoney(item.qty * item.importPrice)} đ
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={addItemRow}>
                  + Thêm hàng
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', fontSize: '1.1rem' }}>
                <strong>Tổng Cần Trả: <span style={{ color: 'var(--expense-color)' }}>{formatMoney(currentTotalAmount)} đ</span></strong>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Đã thanh toán (đ)</label>
                  <input 
                    type="number" className="form-control" min="0" step="1000"
                    value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Ghi chú</label>
                  <input type="text" className="form-control" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>

              {currentDebt > 0 && (
                <div style={{ marginBottom: '1rem', color: 'var(--expense-color)', fontWeight: 'bold' }}>
                  Ghi vào Công Nợ NCC: {formatMoney(currentDebt)} đ
                </div>
              )}

              <button type="submit" className="btn btn-expense" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                {loading ? <RefreshCw size={20} className="spinning" /> : <PlusCircle size={20} />}
                {loading ? 'Đang xử lý...' : 'HOÀN TẤT NHẬP KHO'}
              </button>
            </form>
          </div>
        </div>

        {/* Table Section */}
        <div className="card" style={{ overflow: 'hidden', order: 1 }}>
          <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Danh mục Tồn Kho</h2>
            
            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ flex: '1 1 300px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Tìm theo Mã SP hoặc Tên Sản Phẩm..." 
                  style={{ paddingLeft: '35px', marginBottom: 0 }}
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setShowReport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
                style={{ height: '42px' }}
              >
                <FileBarChart size={18} /> Báo cáo Lịch sử
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Mã SP</th>
                  <th>Tên Sản Phẩm</th>
                  <th>Giá Nhập</th>
                  <th>Giá Bán</th>
                  <th className="text-right">Tồn Kho</th>
                  <th className="text-center" style={{ width: '80px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && products.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{padding: '2rem'}}>Đang tải dữ liệu...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{padding: '2rem', color: 'var(--text-secondary)'}}>{products.length === 0 ? 'Kho trống.' : 'Không tìm thấy sản phẩm phù hợp.'}</td></tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 'bold' }}>{p.code}</td>
                      <td>{p.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatMoney(p.importPrice)} đ</td>
                      <td style={{ color: 'var(--primary-color)' }}>{formatMoney(p.price)} đ</td>
                      <td className="text-right" style={{ fontWeight: 'bold', color: p.stock <= 5 ? 'var(--expense-color)' : 'inherit' }}>
                        {p.stock} {p.unit}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="btn-icon" 
                            style={{color: 'var(--primary-color)'}} 
                            onClick={() => {
                              setEditingProduct({ ...p });
                              setIsModalOpen(true);
                            }} 
                            title="Sửa Sản Phẩm"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn-icon" 
                            style={{color: 'var(--expense-color)'}} 
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            title="Xóa Sản Phẩm"
                          >
                            <X size={16} />
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

      {/* Edit Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', margin: 0, padding: 0 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Sửa Sản Phẩm</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="card-body" style={{ padding: '1.5rem' }}>
              <form onSubmit={handleUpdateProduct}>
                <div className="form-group">
                  <label className="form-label">Mã Sản Phẩm</label>
                  <input type="text" className="form-control" value={editingProduct.code} onChange={(e) => setEditingProduct({...editingProduct, code: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên Sản Phẩm</label>
                  <input type="text" className="form-control" value={editingProduct.name} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Đơn Vị Tính</label>
                    <input type="text" className="form-control" value={editingProduct.unit} onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Tồn Kho Hiện Tại</label>
                    <input type="number" className="form-control" value={editingProduct.stock} onChange={(e) => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Giá Nhập</label>
                    <input type="number" className="form-control" value={editingProduct.importPrice} onChange={(e) => setEditingProduct({...editingProduct, importPrice: Number(e.target.value)})} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Giá Bán</label>
                    <input type="number" className="form-control" value={editingProduct.price} onChange={(e) => setEditingProduct({...editingProduct, price: Number(e.target.value)})} required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                    {loading ? 'Đang lưu...' : 'LƯU THAY ĐỔI'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1, backgroundColor: '#e2e8f0', color: '#1e293b' }} onClick={() => setIsModalOpen(false)} disabled={loading}>
                    HỦY
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ReportModal 
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title="Báo Cáo Lịch Sử Nhập/Xuất Kho"
        data={logs}
        dateField="date"
        filename="BaoCao_KhoHang"
        columns={[
          { header: 'Ngày', key: 'date', render: (row) => row.date ? format(new Date(row.date), 'dd/MM/yyyy') : '-' },
          { header: 'Loại', key: 'type', render: (row) => <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.type === 'import' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{row.type === 'import' ? 'NHẬP' : 'XUẤT'}</span> },
          { header: 'Mã SP', key: 'productId', render: (row) => row.productId || '-' },
          { header: 'Tên Sản Phẩm', key: 'productName', render: (row) => row.productName || '-' },
          { header: 'Số lượng', key: 'quantity', render: (row) => row.quantity || 0, align: 'center' },
          { header: 'Người tạo', key: 'user', render: (row) => row.user || '-' },
          { header: 'Ghi chú', key: 'note', render: (row) => row.note || '-' }
        ]}
      />
    </div>
  );
}
