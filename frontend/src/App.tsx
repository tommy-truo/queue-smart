import { Navigate, Route, Routes } from 'react-router'
import Login from './pages/auth/Login.tsx'
import Register from './pages/auth/Register.tsx'
import UserDashboard from './pages/user/UserDashboard.tsx'
import JoinQueue from './pages/user/JoinQueue.tsx'
import QueueStatus from './pages/user/QueueStatus.tsx'
import History from './pages/user/History.tsx'
import AdminDashboard from './pages/admin/AdminDashboard.tsx'
import ServiceManagement from './pages/admin/ServiceManagement.tsx'
import QueueManagement from './pages/admin/QueueManagement.tsx'
import EmployeeQueue from './pages/employee/EmployeeQueue.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<UserDashboard />} />
      <Route path="/join" element={<JoinQueue />} />
      <Route path="/status" element={<QueueStatus />} />
      <Route path="/history" element={<History />} />

      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/services" element={<ServiceManagement />} />
      <Route path="/admin/queue" element={<QueueManagement />} />

      <Route path="/employee" element={<EmployeeQueue />} />
    </Routes>
  )
}
