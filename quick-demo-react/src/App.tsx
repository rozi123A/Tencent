import { HashRouter, Routes, Route } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import HomePage from '@/pages/HomePage';
import InvitePage from '@/pages/InvitePage';
import AdminPage from '@/pages/AdminPage';
import ToastContainer from '@/components/Toast';
import './App.css';

export default function App() {
  return (
    <HashRouter>
      <NavBar />
      <ToastContainer />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </HashRouter>
  );
}
