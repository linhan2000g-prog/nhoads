import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ThuChi from './components/ThuChi';
import BanHang from './components/BanHang';
import KhoHang from './components/KhoHang';
import CongNo from './components/CongNo';
import KhachHang from './components/KhachHang';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/layout/MainLayout';
import QuanLyTaiKhoan from './components/QuanLyTaiKhoan';

interface User {
  username: string;
  role: string;
  fullName: string;
  permissions?: string[];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem('erp_user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setUser(parsed);
      } catch (e) {}
    }
    setIsInitializing(false);

    // Prevent scrolling from changing number inputs
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (document.activeElement === target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        target.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('erp_user');
    localStorage.removeItem('app_secret');
    localStorage.removeItem('firebase_secret');
    setUser(null);
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  if (isInitializing) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50">Đang tải...</div>;
  }

  // Define default route based on role
  const getDefaultRoute = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/';
    if (user.permissions && user.permissions.length > 0) return `/${user.permissions[0]}`;
    const uname = user.username?.toLowerCase();
    if (uname === 'nv_03' || uname === 'thuchi') return '/thuchi';
    return '/banhang';
  };

  const hasAccess = (permId: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.permissions && user.permissions.includes(permId)) return true;
    
    // Legacy support
    const uname = user.username?.toLowerCase();
    if ((uname === 'nv_02' || uname === 'kho') && ['banhang', 'nhapkho', 'khachhang'].includes(permId)) return true;
    if ((uname === 'nv_03' || uname === 'thuchi') && ['thuchi', 'congno', 'khachhang'].includes(permId)) return true;
    
    return false;
  };

  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to={getDefaultRoute()} replace /> : <Login onLoginSuccess={handleLoginSuccess} />} 
          />
          
          <Route path="/" element={user ? <MainLayout user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
            <Route index element={
              user?.role === 'admin' ? <Dashboard /> : <Navigate to={getDefaultRoute()} replace />
            } />
            <Route path="thuchi" element={
              hasAccess('thuchi') ? <ThuChi /> : <Navigate to={getDefaultRoute()} replace />
            } />
            <Route path="banhang" element={
              hasAccess('banhang') ? <BanHang /> : <Navigate to={getDefaultRoute()} replace />
            } />
            <Route path="nhapkho" element={
              hasAccess('nhapkho') ? <KhoHang /> : <Navigate to={getDefaultRoute()} replace />
            } />
            <Route path="congno" element={
              hasAccess('congno') ? <CongNo /> : <Navigate to={getDefaultRoute()} replace />
            } />
            <Route path="khachhang" element={
              hasAccess('khachhang') ? <KhachHang /> : <Navigate to={getDefaultRoute()} replace />
            } />
            <Route path="taikhoan" element={
              user?.role === 'admin' ? <QuanLyTaiKhoan /> : <Navigate to={getDefaultRoute()} replace />
            } />
            <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
