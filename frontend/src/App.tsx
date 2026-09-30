import { Navigate, Route, Routes } from 'react-router'
import { homePath, useAuth } from './auth/AuthContext.ts'
import RequireGuest from './auth/RequireGuest.tsx'
import RequireRole from './auth/RequireRole.tsx'
import Layout from './components/Layout.tsx'
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

function Home() {
  const { role } = useAuth()
  return <Navigate to={role ? homePath[role] : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<RequireRole role="user" />}>
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/join" element={<JoinQueue />} />
          <Route path="/status" element={<QueueStatus />} />
          <Route path="/history" element={<History />} />
        </Route>

        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/services" element={<ServiceManagement />} />
          <Route path="/admin/queue" element={<QueueManagement />} />
        </Route>

        <Route element={<RequireRole role="employee" />}>
          <Route path="/employee" element={<EmployeeQueue />} />
        </Route>
      </Route>
    </Routes>
  )
}
