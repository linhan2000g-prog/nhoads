import React, { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw, Search, FileBarChart, CalendarDays } from 'lucide-react';
import { formatMoney } from '../utils';
import { fetchData, postData } from '../api';
import ReportModal from './ReportModal';
import { format } from 'date-fns';

export default function CongNo() {
  const [activeTab, setActiveTab] = useState<'phaithu' | 'phaitra'>('phaithu');
  const [debts, setDebts] = useState<any[]>([]);
  const [debtsTra, setDebtsTra] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [payModal, setPayModal] = useState<{isOpen: boolean, data: any, type: 'thu'|'tra'}>({ isOpen: false, data: null, type: 'thu' });
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  // Edit Date Modal
  const [editDateModal, setEditDateModal] = useState<{isOpen: boolean, data: any, newDate: string}>({ isOpen: false, data: null, newDate: '' });

  // Report Modal
  const [showReport, setShowReport] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchData('congno');
      if (res.phaithu) setDebts(res.phaithu);
      if (res.phaitra) setDebtsTra(res.phaitra);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);



  const handleOpenPayModal = (data: any, type: 'thu'|'tra') => {
    setPayModal({ isOpen: true, data, type });
    setPayAmount(data.debt.toString());
    setPayNote(type === 'thu' ? `Thu nợ khách ${data.name}` : `Trả nợ NCC ${data.name}`);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await postData('congno', 'pay_debt', {
        data: {
          id: payModal.data.id,
          type: payModal.type,
          amount: Number(payAmount),
          note: payNote,
          date: new Date().toISOString()
        }
      });
      setPayModal({ isOpen: false, data: null, type: 'thu' });
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi thanh toán!");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDueDate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await postData('congno', 'updateDueDate', {
        data: {
          id: editDateModal.data.id,
          newDueDate: editDateModal.newDate
        }
      });
      setEditDateModal({ isOpen: false, data: null, newDate: '' });
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi cập nhật ngày!");
    } finally {
      setLoading(false);
    }
  };

  const rawCurrentData = activeTab === 'phaithu' ? debts : debtsTra;

  const currentData = rawCurrentData.filter(row => {
    let matchSearch = true;
    if (filterSearch) {
      const lowerSearch = filterSearch.toLowerCase();
      matchSearch = !!(row.name?.toLowerCase().includes(lowerSearch) || row.phone?.includes(filterSearch));
    }
    if (!matchSearch) return false;
    
    if (filterFromDate || filterToDate) {
      // row.date format is usually YYYY-MM-DD from backend
      const rowDate = new Date(row.date);
      rowDate.setHours(0,0,0,0);
      
      if (filterFromDate) {
        const from = new Date(filterFromDate);
        from.setHours(0,0,0,0);
        if (rowDate < from) return false;
      }
      if (filterToDate) {
        const to = new Date(filterToDate);
        to.setHours(23,59,59,999);
        if (rowDate > to) return false;
      }
    }
    return true;
  });

  const totalPhaiThu = debts.filter(row => currentData.includes(row) || activeTab === 'phaitra').reduce((sum, d) => sum + d.debt, 0);
  const totalPhaiTra = debtsTra.filter(row => currentData.includes(row) || activeTab === 'phaithu').reduce((sum, d) => sum + d.debt, 0);

  return (
    <div className="module-container">
      <div className="header">
        <h1 className="title">Quản Lý Công Nợ</h1>
      </div>

      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        <div className="summary-card income" onClick={() => setActiveTab('phaithu')} style={{ cursor: 'pointer', border: activeTab === 'phaithu' ? '2px solid var(--income-color)' : '' }}>
          <div className="summary-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Khách Nợ (Phải Thu)
          </div>
          <div className="summary-amount income-text">{formatMoney(totalPhaiThu)} đ</div>
        </div>
        <div className="summary-card expense" onClick={() => setActiveTab('phaitra')} style={{ cursor: 'pointer', border: activeTab === 'phaitra' ? '2px solid var(--expense-color)' : '' }}>
          <div className="summary-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Nợ Nhà Cung Cấp (Phải Trả)
          </div>
          <div className="summary-amount expense-text">{formatMoney(totalPhaiTra)} đ</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            {activeTab === 'phaithu' ? 'Danh sách Khách Hàng còn nợ' : 'Danh sách Nhà Cung Cấp đang nợ'}
          </h2>
          
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Tìm theo tên hoặc SĐT..." 
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
            <button 
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
              style={{ height: '42px' }}
            >
              <FileBarChart size={18} /> Xuất báo cáo
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Ngày lập phiếu</th>
                <th>Đối tác</th>
                <th className="text-right">Tổng Tiền Đơn</th>
                <th className="text-right">Còn Nợ</th>
                {activeTab === 'phaithu' && <th className="text-center">Hạn thu tiền</th>}
                <th className="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && currentData.length === 0 ? (
                <tr><td colSpan={activeTab === 'phaithu' ? 6 : 5} className="text-center" style={{padding: '2rem'}}>Đang tải dữ liệu...</td></tr>
              ) : currentData.length === 0 ? (
                <tr><td colSpan={activeTab === 'phaithu' ? 6 : 5} className="text-center" style={{padding: '2rem', color: 'var(--text-secondary)'}}>{rawCurrentData.length === 0 ? 'Không có công nợ nào.' : 'Không tìm thấy kết quả phù hợp.'}</td></tr>
              ) : (
                currentData.map((row) => {
                  let isDue = false;
                  if (activeTab === 'phaithu' && row.dueDate) {
                    const d = new Date(row.dueDate);
                    const limit = new Date();
                    limit.setDate(limit.getDate() + 3);
                    if (d.getTime() <= limit.getTime()) {
                      isDue = true;
                    }
                  }
                  return (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>
                        <div style={{ fontWeight: 'bold' }}>{row.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{row.phone}</div>
                        {row.note && <div style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '2px', fontStyle: 'italic' }}>Ghi chú: {row.note}</div>}
                      </td>
                      <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{formatMoney(row.total)}</td>
                      <td className="text-right" style={{ color: activeTab === 'phaithu' ? 'var(--expense-color)' : 'var(--income-color)', fontWeight: 'bold' }}>
                        {formatMoney(row.debt)}
                      </td>
                      {activeTab === 'phaithu' && (
                        <td className="text-center">
                          {row.dueDate ? (
                            <span style={{ 
                              color: isDue ? 'white' : 'inherit', 
                              backgroundColor: isDue ? 'var(--expense-color)' : 'transparent',
                              padding: isDue ? '4px 8px' : '0',
                              borderRadius: isDue ? '4px' : '0',
                              fontWeight: isDue ? 'bold' : 'normal',
                              display: 'inline-block'
                            }}>
                              {format(new Date(row.dueDate), 'dd/MM/yyyy')}
                              {isDue && <div style={{ fontSize: '0.75rem' }}>{new Date(row.dueDate).getTime() < new Date().setHours(0,0,0,0) ? 'Đã quá hạn' : 'Sắp đến hạn'}</div>}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                      )}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {activeTab === 'phaithu' && (
                            <button 
                              className="btn bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200" 
                              style={{ padding: '0.4rem', fontSize: '0.9rem' }} 
                              onClick={() => setEditDateModal({ isOpen: true, data: row, newDate: row.dueDate || '' })}
                              title="Chỉnh sửa hạn thu tiền"
                            >
                              <CalendarDays size={18} />
                            </button>
                          )}
                          <button className={activeTab === 'phaithu' ? "btn btn-income" : "btn btn-expense"} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={() => handleOpenPayModal(row, activeTab === 'phaithu' ? 'thu' : 'tra')}>
                            {activeTab === 'phaithu' ? 'Thu Nợ' : 'Trả Nợ'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thanh toán nợ */}
      {payModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
            <div className="card-header">
              <h2 className="card-title">{payModal.type === 'thu' ? 'Ghi nhận Thu Nợ' : 'Ghi nhận Trả Nợ'}</h2>
            </div>
            <div className="form-body">
              <form onSubmit={handlePay}>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Đối tác:</strong> {payModal.data.name}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>{payModal.type === 'thu' ? 'Khách còn nợ:' : 'Mình đang nợ:'}</strong> <span style={{ color: payModal.type === 'thu' ? 'var(--expense-color)' : 'var(--income-color)', fontWeight: 'bold' }}>{formatMoney(payModal.data.debt)} đ</span>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Số tiền {payModal.type === 'thu' ? 'thu' : 'trả'}</label>
                  <input type="number" className="form-control" min="0" max={payModal.data.debt} required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú / Diễn giải</label>
                  <input type="text" className="form-control" required value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn" style={{ flex: 1, backgroundColor: '#e2e8f0' }} onClick={() => setPayModal({ isOpen: false, data: null, type: 'thu' })}>
                    Hủy
                  </button>
                  <button type="submit" className={payModal.type === 'thu' ? "btn btn-income" : "btn btn-expense"} style={{ flex: 1 }} disabled={loading}>
                    {loading ? <RefreshCw size={18} className="spinning" /> : <CheckCircle size={18} />} Xác nhận
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cập nhật ngày */}
      {editDateModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
            <div className="card-header">
              <h2 className="card-title">Chỉnh sửa Hạn thu tiền</h2>
            </div>
            <div className="form-body">
              <form onSubmit={handleUpdateDueDate}>
                <div className="form-group">
                  <label>Khách hàng</label>
                  <input type="text" className="form-control" value={editDateModal.data?.name || ''} disabled />
                </div>
                <div className="form-group">
                  <label>Hạn thu tiền mới</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={editDateModal.newDate} 
                    onChange={e => setEditDateModal({...editDateModal, newDate: e.target.value})} 
                  />
                  <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>Để trống nếu muốn xóa hạn thu tiền.</small>
                </div>
                <div className="flex gap-2 justify-end" style={{ marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditDateModal({ isOpen: false, data: null, newDate: '' })}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
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
        title={`Báo Cáo Công Nợ - ${activeTab === 'phaithu' ? 'Khách Hàng' : 'Nhà Cung Cấp'}`}
        data={rawCurrentData}
        dateField="date"
        filename={`BaoCao_CongNo_${activeTab}`}
        columns={[
          { header: activeTab === 'phaithu' ? 'Tên Khách' : 'Tên NCC', key: 'name', render: (row) => row.name || '-' },
          { header: 'Số điện thoại', key: 'phone', render: (row) => row.phone || '-' },
          { header: 'Ngày', key: 'date', render: (row) => row.date ? format(new Date(row.date), 'dd/MM/yyyy') : '-' },
          { header: 'Tổng Tiền', exportValue: (row) => row.totalAmount, render: (row) => <span className="font-semibold text-slate-800">{formatMoney(row.totalAmount || 0)}</span>, align: 'right' },
          { header: 'Đã Thanh Toán', exportValue: (row) => row.paid, render: (row) => <span className="text-green-600 font-medium">{formatMoney(row.paid || 0)}</span>, align: 'right' },
          { header: 'Còn Nợ', exportValue: (row) => row.debt, render: (row) => <span className="text-red-600 font-bold">{formatMoney(row.debt || 0)}</span>, align: 'right' }
        ]}
        totals={(filteredData) => {
          const tAmount = filteredData.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
          const tPaid = filteredData.reduce((sum, item) => sum + (item.paid || 0), 0);
          const tDebt = filteredData.reduce((sum, item) => sum + (item.debt || 0), 0);
          return (
            <tr>
              <td colSpan={4} className="px-6 py-4 text-right text-slate-800">Tổng Tiền: {formatMoney(tAmount)}</td>
              <td className="px-6 py-4 text-right text-green-700">Đã Thanh Toán: {formatMoney(tPaid)}</td>
              <td className="px-6 py-4 text-right text-red-700">Tổng Nợ: {formatMoney(tDebt)}</td>
            </tr>
          );
        }}
      />
    </div>
  );
}
