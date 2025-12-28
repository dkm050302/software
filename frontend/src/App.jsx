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
import Login from "./pages/Login";
import Register from "./pages/Register";
/* frontend/src/App.jsx */
import NoteManager from './pages/NoteManager';   // ← 新增1：引入页面

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// 从token中获取用户类型
const getUserTypeFromToken = () => {
  try {
    const token = localStorage.getItem("token");
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
  const token = localStorage.getItem("token");
  if (!token) {
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
  const token = localStorage.getItem("token");
  if (!token) {
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
      <Route path="/login"    element={<Login />} />
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
        <Route path="notes"        element={<NoteAssistant />} />
        <Route path="maps"         element={<MapGeneration />} />
        <Route path="errors"       element={<ErrorBook />} />
        <Route path="errors/create" element={<ViewErrorBook />} />
        <Route path="errors/view"   element={<ViewErrorBook />} />
        <Route path="notes-manager" element={<NoteManager />} />
        <Route path="parents"       element={<ParentView />} />
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
      </Route>   {/* 这里是真正的闭合 */}
    </Routes>
  );
}

export default App;