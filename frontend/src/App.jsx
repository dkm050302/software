import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import NoteAssistant from "./pages/NoteAssistant";
import MapGeneration from "./pages/MapGeneration";
import ErrorBook from "./pages/ErrorBook";
import ViewErrorBook from "./pages/ViewErrorBook";
import ParentView from "./pages/ParentView";
import Admin from "./pages/Admin";
import Syllabus from "./pages/Syllabus";
import Profile from "./pages/Profile";
import StudentStatus from "./pages/StudentStatus";
import Login from "./pages/Login";
import Register from "./pages/Register";

// 检查token是否有效（未过期）
const isTokenValid = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // 转换为毫秒
    return Date.now() < exp;
  } catch (e) {
    return false;
  }
};
/* frontend/src/App.jsx */
import NoteManager from "./pages/NoteManager"; // ← 新增1：引入页面

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem("token");
  if (!token || !isTokenValid(token)) {
    // Token不存在或已过期，清除并跳转到登录页
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("studentId");
    return <Navigate to="/login" replace />;
  }
  return children;
};

// 从token中获取用户类型
const getUserTypeFromToken = () => {
  try {
    const token = sessionStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user_type;
  } catch (e) {
    return null;
  }
};

// Dashboard Route - 管理员自动重定向到管理员页面
const DashboardRoute = () => {
  const userType = getUserTypeFromToken();
  if (userType === "admin") {
    return <Navigate to="/admin" replace />;
  }
  return <Dashboard />;
};

// Admin Route Wrapper - 只有管理员才能访问
const AdminRoute = ({ children }) => {
  const token = sessionStorage.getItem("token");
  if (!token || !isTokenValid(token)) {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("studentId");
    return <Navigate to="/login" replace />;
  }
  const userType = getUserTypeFromToken();
  if (userType !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Teacher Route Wrapper - 只有教师才能访问
const TeacherRoute = ({ children }) => {
  const token = sessionStorage.getItem("token");
  if (!token || !isTokenValid(token)) {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("studentId");
    return <Navigate to="/login" replace />;
  }
  const userType = getUserTypeFromToken();
  if (userType !== "teacher") {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <Routes>
      {/* 公共页面 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* 受保护的主布局 */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="notes" element={<NoteAssistant />} />
        <Route path="maps" element={<MapGeneration />} />
        <Route path="errors" element={<ErrorBook />} />
        <Route path="errors/create" element={<ViewErrorBook />} />
        <Route path="errors/view" element={<ViewErrorBook />} />
        <Route path="notes-manager" element={<NoteManager />} />
        <Route path="parents" element={<ParentView />} />
        <Route
          path="syllabus"
          element={
            <TeacherRoute>
              <Syllabus />
            </TeacherRoute>
          }
        />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="student-status"
          element={
            <TeacherRoute>
              <StudentStatus />
            </TeacherRoute>
          }
        />
        <Route path="profile" element={<Profile />} />
      </Route>{" "}
      {/* 这里是真正的闭合 */}
    </Routes>
  );
}

export default App;
