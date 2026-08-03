import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Printer, 
  Trash2, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Edit,
  Search,
  X,
  FileBarChart
} from 'lucide-react';
import { fetchData, postData } from '../api';
import ReportModal from './ReportModal';

// --- TYPES ---
interface RecordData {
  id: string;
  date: string;
  expenseContent: string;
  expenseAmount: number;
  incomeContent: string;
  incomeAmount: number;
  personName?: string;
  creatorName?: string;
}



export default function ThuChi() {
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<RecordData[]>([]);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Form State
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [content, setContent] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [personName, setPersonName] = useState<string>('');
  const [creatorName, setCreatorName] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Print State
  const [printRecord, setPrintRecord] = useState<RecordData | null>(null);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  
  // Report Modal
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    loadData(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  async function loadData(month: number, year: number) {
    setLoading(true);
    try {
      const result = await fetchData('thuchi', { month, year });
      setData(result.data || []);
      setPreviousBalance(result.previousBalance || 0);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu", error);
      alert("Lỗi tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const filteredData = data.filter(item => {
    if (!filterSearch) return true;
    const s = filterSearch.toLowerCase();
    return (
      item.expenseContent?.toLowerCase().includes(s) ||
      item.incomeContent?.toLowerCase().includes(s) ||
      item.personName?.toLowerCase().includes(s) ||
      item.creatorName?.toLowerCase().includes(s)
    );
  });

  const totalIncome = filteredData.reduce((sum, item) => sum + (Number(item.incomeAmount) || 0), 0);
  const totalExpense = filteredData.reduce((sum, item) => sum + (Number(item.expenseAmount) || 0), 0);
  const finalBalance = previousBalance + totalIncome - totalExpense;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !amount) return;

    const newRecord = {
      date,
      expenseContent: type === 'expense' ? content : '',
      expenseAmount: type === 'expense' ? Number(amount) : 0,
      incomeContent: type === 'income' ? content : '',
      incomeAmount: type === 'income' ? Number(amount) : 0,
      personName,
      creatorName
    };

    setLoading(true);
    try {
      const action = editingId ? 'update' : 'add';
      const payload: any = { data: newRecord };
      if (editingId) payload.id = editingId;
      
      await postData('thuchi', action, payload);
      await loadData(currentMonth, currentYear);
      cancelEdit();
      alert(editingId ? "Cập nhật thành công!" : "Thêm mới thành công!");
    } catch (error) {
      console.error("Lỗi thêm/sửa dữ liệu", error);
      alert("Có lỗi khi thêm/sửa dữ liệu. Chi tiết: " + (error instanceof Error ? error.message : JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: RecordData) => {
    setEditingId(record.id);
    setType(record.expenseAmount > 0 ? 'expense' : 'income');
    setDate(record.date.split('T')[0]);
    setPersonName(record.personName || '');
    setAmount(record.expenseAmount > 0 ? record.expenseAmount.toString() : record.incomeAmount.toString());
    setContent(record.expenseAmount > 0 ? record.expenseContent : record.incomeContent);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setContent('');
    setAmount('');
    setPersonName('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa dòng này?')) {
      setLoading(true);
      try {
        await postData('thuchi', 'delete', { id });
        await loadData(currentMonth, currentYear);
      } catch (error) {
        console.error("Lỗi khi xóa", error);
        alert("Có lỗi khi xóa dữ liệu.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrint = (record: RecordData) => {
    setPrintRecord(record);
    setTimeout(() => {
      window.print();
      // Optional: clear print record after print dialog closes
      // but window.print is blocking in some browsers, so we can just leave it or clear on focus
    }, 100);
  };

  const formatMoney = (val: number) => {
    if (!val) return '';
    return val.toLocaleString('vi-VN');
  };

  const formContent = (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Ngày chứng từ</label>
        <input 
          type="date" 
          className="form-control" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Người {type === 'expense' ? 'nhận tiền' : 'nộp tiền'}</label>
        <input 
          type="text" 
          className="form-control" 
          placeholder={`Nhập tên người ${type === 'expense' ? 'nhận' : 'nộp'}...`}
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Nội dung {type === 'expense' ? 'Chi' : 'Thu'}</label>
        <input 
          type="text" 
          className="form-control" 
          placeholder={`Nhập lý do ${type === 'expense' ? 'chi tiền' : 'thu tiền'}...`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Số tiền (VNĐ)</label>
        <input 
          type="number" 
          className="form-control" 
          placeholder="0"
          min="0"
          step="1000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Người lập phiếu</label>
        <input 
          type="text" 
          className="form-control" 
          placeholder="Nhập tên người lập phiếu..."
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
        />
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button type="submit" className={`btn ${type === 'expense' ? 'btn-expense' : 'btn-income'}`} disabled={loading} style={{ flex: 1 }}>
          {loading ? 'Đang xử lý...' : (editingId ? 'Cập Nhật Phiếu' : `Thêm Khoản ${type === 'expense' ? 'Chi' : 'Thu'}`)}
        </button>
      </div>
    </form>
  );

  return (
    <div className="module-container">
      <div className="no-print">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Quản Lý Thu Chi</h2>
          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(Number(e.target.value))}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem', fontWeight: 'bold' }}
          >
            {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map(year => (
              <option key={year} value={year}>Năm {year}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-icon" onClick={() => loadData(currentMonth, currentYear)} title="Làm mới">
          <RefreshCw size={20} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Month Selector */}
      <div className="month-selector">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
          <button 
            key={month}
            className={`month-btn ${currentMonth === month ? 'active' : ''}`}
            onClick={() => setCurrentMonth(month)}
          >
            Tháng {month}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card balance">
          <div className="summary-title">
            <Wallet size={16} style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
            Dư đầu kỳ
          </div>
          <div className="summary-amount">{formatMoney(previousBalance)} đ</div>
        </div>
        <div className="summary-card income">
          <div className="summary-title">
            <TrendingUp size={16} color="var(--income-color)" style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
            Tổng Thu
          </div>
          <div className="summary-amount income-text">{formatMoney(totalIncome)} đ</div>
        </div>
        <div className="summary-card expense">
          <div className="summary-title">
            <TrendingDown size={16} color="var(--expense-color)" style={{display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom'}}/>
            Tổng Chi
          </div>
          <div className="summary-amount expense-text">{formatMoney(totalExpense)} đ</div>
        </div>
        <div className="summary-card balance" style={{ borderTopColor: finalBalance < 0 ? 'var(--expense-color)' : 'var(--primary-color)' }}>
          <div className="summary-title">CÒN LẠI (DƯ CUỐI KỲ)</div>
          <div className="summary-amount" style={{ color: finalBalance < 0 ? 'var(--expense-color)' : 'inherit' }}>
            {formatMoney(finalBalance)} đ
          </div>
        </div>
      </div>

      <div className="grid-50-50">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Lịch sử Thu Chi</h2>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', alignItems: 'center' }}>
              <div style={{ flex: '1 1 300px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Tìm theo nội dung, người nhận/nộp..." 
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
                <FileBarChart size={18} /> Xuất báo cáo
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Nội dung Chi</th>
                  <th className="text-right">Số tiền Chi</th>
                  <th>Nội dung Thu</th>
                  <th className="text-right">Số tiền Thu</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{padding: '2rem'}}>Đang tải dữ liệu...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{padding: '2rem', color: 'var(--text-secondary)'}}>{data.length === 0 ? 'Chưa có dữ liệu.' : 'Không tìm thấy giao dịch phù hợp.'}</td></tr>
                ) : (
                  [...filteredData].reverse().map((row) => (
                    <tr key={row.id}>
                      <td>{row.date ? format(new Date(row.date), 'dd/MM') : ''}</td>
                      <td>{row.expenseContent}</td>
                      <td className="text-right amount-expense">{formatMoney(row.expenseAmount)}</td>
                      <td>{row.incomeContent}</td>
                      <td className="text-right amount-income">{formatMoney(row.incomeAmount)}</td>
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

        {/* Form Section */}
        <div className={`card form-card ${type}`}>
          <div className="card-header" style={{ padding: 0 }}>
            <div className="form-tabs">
              <button type="button" className={`tab-btn expense ${type === 'expense' ? 'active' : ''}`} onClick={() => setType('expense')}><TrendingDown size={20} /> LẬP PHIẾU CHI</button>
              <button type="button" className={`tab-btn income ${type === 'income' ? 'active' : ''}`} onClick={() => setType('income')}><TrendingUp size={20} /> LẬP PHIẾU THU</button>
            </div>
          </div>
          <div className="form-body">
            {!editingId && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Tạo phiếu mới</h3>
                {formContent}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {editingId && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="card-title" style={{ margin: 0 }}>Cập nhật phiếu Thu/Chi</h2>
              <button className="btn-icon" onClick={cancelEdit}><X size={20}/></button>
            </div>
            <div className="modal-body">
              {formContent}
            </div>
          </div>
        </div>
      )}

      {printRecord && (
        <div id="printable-receipt">
          <div style={{ padding: '15px', fontFamily: 'Arial, sans-serif', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '8px' }}>
            <div style={{ width: '65%', fontSize: '12px', lineHeight: '1.3' }}>
              <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px' }}>Quảng Cáo Nguyễn Hồ</div>
              <div>Địa chỉ: 67 đường 3/2. Phường Vườn Lài</div>
              <div>SĐT: 0933735073 - 0912737074</div>
            </div>
            <div style={{ width: '35%', textAlign: 'right', fontSize: '12px' }}>
              <strong>Số phiếu: {printRecord.id || '................'}</strong>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h1 style={{ margin: '0', fontSize: '18px', textTransform: 'uppercase' }}>
              PHIẾU {printRecord.incomeAmount > 0 ? 'THU' : 'CHI'}
            </h1>
            <p style={{ margin: '3px 0 0 0', fontStyle: 'italic', fontSize: '12px' }}>Ngày: {format(new Date(printRecord.date), 'dd/MM/yyyy')}</p>
          </div>
          
          <table style={{ width: '100%', marginBottom: '10px', fontSize: '13px', lineHeight: '1.5' }}>
            <tbody>
              <tr>
                <td style={{ width: '130px', fontWeight: 'bold', padding: '5px 0' }}>
                  Người {printRecord.incomeAmount > 0 ? 'nộp tiền' : 'nhận tiền'}:
                </td>
                <td style={{ borderBottom: '1px dotted #ccc', padding: '5px 0' }}>
                  {printRecord.personName || '\u00A0'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '5px 0' }}>Lý do {printRecord.incomeAmount > 0 ? 'thu' : 'chi'}:</td>
                <td style={{ borderBottom: '1px dotted #ccc', padding: '5px 0' }}>
                  {printRecord.incomeAmount > 0 ? printRecord.incomeContent : printRecord.expenseContent}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '5px 0' }}>Số tiền:</td>
                <td style={{ borderBottom: '1px dotted #ccc', fontWeight: 'bold', fontSize: '15px', padding: '5px 0' }}>
                  {formatMoney(printRecord.incomeAmount > 0 ? printRecord.incomeAmount : printRecord.expenseAmount)} VNĐ
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '5px 0' }}>Kèm theo:</td>
                <td style={{ borderBottom: '1px dotted #ccc', padding: '5px 0' }}>
                  0 chứng từ gốc.
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', textAlign: 'center', fontSize: '12px', pageBreakInside: 'avoid' }}>
            <div style={{ width: '30%' }}>
              <strong>Người Lập Phiếu</strong>
              <div style={{ margin: '3px 0' }}><small>(Ký, họ tên)</small></div>
              <div style={{ marginTop: '40px', fontWeight: 'bold' }}>
                {printRecord.creatorName || ''}
              </div>
            </div>
            <div style={{ width: '30%' }}>
              <strong>Người Giao</strong>
              <div style={{ margin: '3px 0' }}><small>(Ký, họ tên)</small></div>
            </div>
            <div style={{ width: '30%' }}>
              <strong>Người Nhận</strong>
              <div style={{ margin: '3px 0' }}><small>(Ký, họ tên)</small></div>
              <div style={{ marginTop: '40px', fontWeight: 'bold' }}>
                {printRecord.personName || ''}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      <ReportModal 
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title="Báo Cáo Sổ Thu Chi"
        data={data}
        dateField="date"
        filename="BaoCao_ThuChi"
        columns={[
          { header: 'Ngày', key: 'date', render: (row) => format(new Date(row.date), 'dd/MM/yyyy') },
          { header: 'Nội dung Thu', key: 'incomeContent', render: (row) => row.incomeContent || '-' },
          { header: 'Số tiền Thu', exportValue: (row) => row.incomeAmount, render: (row) => <span className="text-green-600 font-medium">{row.incomeAmount > 0 ? formatMoney(row.incomeAmount) : '-'}</span>, align: 'right' },
          { header: 'Nội dung Chi', key: 'expenseContent', render: (row) => row.expenseContent || '-' },
          { header: 'Số tiền Chi', exportValue: (row) => row.expenseAmount, render: (row) => <span className="text-red-600 font-medium">{row.expenseAmount > 0 ? formatMoney(row.expenseAmount) : '-'}</span>, align: 'right' },
          { header: 'Người Giao/Nhận', key: 'personName', render: (row) => row.personName || '-' },
          { header: 'Người lập', key: 'creatorName', render: (row) => row.creatorName || '-' }
        ]}
        totals={(filteredData) => {
          const tIncome = filteredData.reduce((sum, item) => sum + (item.incomeAmount || 0), 0);
          const tExpense = filteredData.reduce((sum, item) => sum + (item.expenseAmount || 0), 0);
          return (
            <tr>
              <td colSpan={3} className="px-6 py-4 text-right text-green-700">Tổng Thu: {formatMoney(tIncome)}</td>
              <td colSpan={2} className="px-6 py-4 text-right text-red-700">Tổng Chi: {formatMoney(tExpense)}</td>
              <td colSpan={3}></td>
            </tr>
          );
        }}
      />
    </div>
  );
}
