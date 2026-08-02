import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, Save, Edit2, Trash2, FileBarChart } from 'lucide-react';
import { formatMoney } from '../utils';
import { fetchData, postData } from '../api';
import ReportModal from './ReportModal';
import { format } from 'date-fns';

export default function KhachHang() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerForm, setCustomerForm] = useState({ 
    id: '', name: '', phone: '', note: '', orders: '', 
    totalValue: '', paid: '', debt: '', acceptanceDate: '', address: '', dueDate: '' 
  });
  const [errorMsg, setErrorMsg] = useState('');
  
  // Report Modal
  const [showReport, setShowReport] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchData('khachhang').then(res => {
      if (res.data) setCustomers(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return !!(c.name?.toLowerCase().includes(lowerSearch) || c.phone?.includes(searchTerm));
  });



  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setCustomerForm({ 
      id: '', name: '', phone: '', note: '', orders: '', 
      totalValue: '', paid: '', debt: '', acceptanceDate: '', address: '', dueDate: '' 
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEditModal = (c: any) => {
    setIsEditMode(true);
    setCustomerForm({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      note: c.note || '',
      orders: c.orders || '',
      totalValue: String((Number(c.paid) || 0) + (Number(c.debt) || 0)),
      paid: c.paid || '',
      debt: c.debt || '',
      acceptanceDate: c.acceptanceDate ? c.acceptanceDate.split('T')[0] : '',
      address: c.address || '',
      dueDate: c.dueDate ? c.dueDate.split('T')[0] : ''
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.phone) {
      setErrorMsg('Vui lòng nhập tên và số điện thoại!');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const action = isEditMode ? 'edit' : 'add';
      const res = await postData('khachhang', action, customerForm);
      if (res.success) {
        setShowModal(false);
        loadData(); // Tải lại danh sách
      } else {
        setErrorMsg(res.error || 'Có lỗi xảy ra khi lưu khách hàng.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa khách hàng "${name}"?`)) {
      setLoading(true);
      try {
        const res = await postData('khachhang', 'delete', { id });
        if (res.success) {
          loadData();
        } else {
          alert(res.error || 'Có lỗi xảy ra khi xóa.');
          setLoading(false);
        }
      } catch (err) {
        alert('Lỗi kết nối!');
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Quản Lý Khách Hàng (CRM)</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">Danh sách Khách Hàng</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all text-sm"
                placeholder="Tìm theo tên hoặc SĐT..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm"
            >
              <UserPlus size={18} /> Thêm khách hàng
            </button>
            <button 
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm"
            >
              <FileBarChart size={18} /> Xuất báo cáo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Khách Hàng</th>
                <th className="px-6 py-4">Số điện thoại</th>
                <th className="px-6 py-4">Địa chỉ</th>
                <th className="px-6 py-4">Đơn đặt hàng</th>
                <th className="px-6 py-4 text-right">Tổng giá trị</th>
                <th className="px-6 py-4 text-right">Đã tạm ứng</th>
                <th className="px-6 py-4 text-right">Còn lại</th>
                <th className="px-6 py-4">Ngày nghiệm thu</th>
                <th className="px-6 py-4 text-center">Số lần mua</th>
                <th className="px-6 py-4">Ghi chú</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && customers.length === 0 ? (
                <tr><td colSpan={11} className="px-6 py-8 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={11} className="px-6 py-8 text-center text-slate-500">Không tìm thấy khách hàng nào.</td></tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800">{c.name}</td>
                    <td className="px-6 py-4">{c.phone}</td>
                    <td className="px-6 py-4 max-w-[200px] truncate" title={c.address}>{c.address || '-'}</td>
                    <td className="px-6 py-4 max-w-[250px] truncate" title={c.orders}>{c.orders || '-'}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800">{formatMoney((Number(c.paid) || 0) + (Number(c.bhPaid) || 0) + (Number(c.debt) || 0) + (Number(c.bhDebt) || 0))}</td>
                    <td className="px-6 py-4 text-right font-medium text-green-600">{formatMoney((Number(c.paid) || 0) + (Number(c.bhPaid) || 0))}</td>
                    <td className="px-6 py-4 text-right font-medium text-red-600">{formatMoney((Number(c.debt) || 0) + (Number(c.bhDebt) || 0))}</td>
                    <td className="px-6 py-4">{c.acceptanceDate ? new Date(c.acceptanceDate).toLocaleDateString('vi-VN') : '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 w-8 h-8 rounded-full font-medium">
                        {c.purchaseCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate" title={c.note}>{c.note || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => handleOpenEditModal(c)}
                          className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors inline-flex"
                          title="Sửa thông tin"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCustomer(c.id, c.name)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                          title="Xóa khách hàng"
                        >
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

      {/* Modal Thêm/Sửa Khách Hàng */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {isEditMode ? (
                  <><Edit2 size={20} className="text-sky-500" /> Sửa Khách Hàng</>
                ) : (
                  <><UserPlus size={20} className="text-sky-500" /> Tạo Khách Hàng Mới</>
                )}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitCustomer} className="p-6 space-y-4">
              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                  {errorMsg}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên khách hàng <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  placeholder="Nhập tên khách hàng..."
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  placeholder="Nhập số điện thoại..."
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({...customerForm, phone: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Địa chỉ</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  placeholder="Nhập địa chỉ..."
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Đơn đặt hàng</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  placeholder="Nhập thông tin đơn đặt hàng..."
                  value={customerForm.orders}
                  onChange={(e) => setCustomerForm({...customerForm, orders: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tổng Giá trị</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                    placeholder="0"
                    value={customerForm.totalValue ? formatMoney(Number(customerForm.totalValue)) : ''}
                    onChange={(e) => {
                      const total = e.target.value.replace(/\D/g, '');
                      const debt = Number(total) - Number(customerForm.paid || 0);
                      setCustomerForm({...customerForm, totalValue: total, debt: String(debt)});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Đã tạm ứng</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                    placeholder="0"
                    value={customerForm.paid ? formatMoney(Number(customerForm.paid)) : ''}
                    onChange={(e) => {
                      const paid = e.target.value.replace(/\D/g, '');
                      const debt = Number(customerForm.totalValue || 0) - Number(paid);
                      setCustomerForm({...customerForm, paid: paid, debt: String(debt)});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Còn lại</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-red-600 font-bold"
                    placeholder="0"
                    value={customerForm.debt ? formatMoney(Number(customerForm.debt)) : ''}
                    readOnly
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ngày nghiệm thu</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                    value={customerForm.acceptanceDate}
                    onChange={(e) => setCustomerForm({...customerForm, acceptanceDate: e.target.value})}
                  />
                </div>
                {Number(customerForm.debt) > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-1.5">Hạn thu tiền</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                      value={customerForm.dueDate}
                      onChange={(e) => setCustomerForm({...customerForm, dueDate: e.target.value})}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ghi chú (Tùy chọn)</label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all resize-none"
                  placeholder="Thông tin thêm về khách hàng..."
                  rows={3}
                  value={customerForm.note}
                  onChange={(e) => setCustomerForm({...customerForm, note: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-sky-500/20"
                >
                  {isSubmitting ? 'Đang lưu...' : <><Save size={18} /> {isEditMode ? 'Cập Nhật' : 'Lưu Khách Hàng'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportModal 
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title="Báo Cáo Khách Hàng Nghiệm Thu"
        data={customers}
        dateField="acceptanceDate"
        filename="BaoCao_KhachHang"
        columns={[
          { header: 'Khách Hàng', key: 'name', render: (row) => row.name || '-' },
          { header: 'Số điện thoại', key: 'phone', render: (row) => row.phone || '-' },
          { header: 'Địa chỉ', key: 'address', render: (row) => row.address || '-' },
          { header: 'Đơn đặt hàng', key: 'orders', render: (row) => row.orders || '-' },
          { header: 'Tổng Giá trị', exportValue: (row) => (Number(row.paid) || 0) + (Number(row.debt) || 0), render: (row) => <span className="font-medium text-slate-800">{formatMoney((Number(row.paid) || 0) + (Number(row.debt) || 0))}</span>, align: 'right' },
          { header: 'Đã tạm ứng', exportValue: (row) => row.paid, render: (row) => <span className="text-green-600 font-medium">{formatMoney(row.paid || 0)}</span>, align: 'right' },
          { header: 'Còn lại', exportValue: (row) => row.debt, render: (row) => <span className="text-red-600 font-bold">{formatMoney(row.debt || 0)}</span>, align: 'right' },
          { header: 'Ngày nghiệm thu', key: 'acceptanceDate', render: (row) => row.acceptanceDate ? format(new Date(row.acceptanceDate), 'dd/MM/yyyy') : '-' },
          { header: 'Ghi chú', key: 'note', render: (row) => row.note || '-' }
        ]}
        totals={(filteredData) => {
          const tTotal = filteredData.reduce((sum, item) => sum + ((Number(item.paid) || 0) + (Number(item.debt) || 0)), 0);
          const tPaid = filteredData.reduce((sum, item) => sum + (Number(item.paid) || 0), 0);
          const tDebt = filteredData.reduce((sum, item) => sum + (Number(item.debt) || 0), 0);
          return (
            <tr>
              <td colSpan={4} className="px-6 py-4 text-right font-bold text-slate-800">TỔNG CỘNG:</td>
              <td className="px-6 py-4 text-right font-bold text-slate-800">{formatMoney(tTotal)}</td>
              <td className="px-6 py-4 text-right text-green-700">{formatMoney(tPaid)}</td>
              <td className="px-6 py-4 text-right text-red-700">{formatMoney(tDebt)}</td>
              <td colSpan={2}></td>
            </tr>
          );
        }}
      />
    </div>
  );
}
