import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import api from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState("student");
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const handleUserTypeChange = (event, newType) => {
    if (newType !== null) {
      setUserType(newType);
      setFormData({ username: "", password: "" });
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // FormData for OAuth2PasswordRequestForm
    const data = new FormData();
    data.append("username", formData.username);
    data.append("password", formData.password);

    try {
      // 在URL中添加user_type查询参数
      const url = `/auth/token${userType ? `?user_type=${userType}` : ""}`;
      const response = await api.post(url, data, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const token = response.data.access_token;
      sessionStorage.setItem("token", token);

      // 从token中解码出真实的user_type，而不是使用前端选择的userType
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const actualUserType = payload.user_type;

        // 如果是学生，保存学号（用于某些场景）
        if (actualUserType === "student") {
          sessionStorage.setItem("studentId", payload.sub);
        }

        // 如果是管理员，跳转到管理员页面
        if (actualUserType === "admin") {
          navigate("/admin");
          return;
        }
      } catch (decodeError) {
        console.error("Error decoding token:", decodeError);
        // 如果解码失败，使用前端选择的userType作为后备判断
        if (userType === "student") {
          sessionStorage.setItem("studentId", formData.username);
        }
        // 如果选择的是管理员，跳转到管理员页面
        if (userType === "admin") {
          navigate("/admin");
          return;
        }
      }

      navigate("/");
    } catch (err) {
      setError("登录失败，请检查您的凭据。");
    }
  };

  const getUsernameLabel = () => {
    if (userType === "student") return "学号 (Student ID)";
    if (userType === "teacher") return "邮箱 (Email)";
    if (userType === "parent") return "电话 (Phone)";
    if (userType === "admin") return "用户名 (Username)";
    return "用户名";
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: "100%" }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            登录 AI Tutor
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
              <ToggleButtonGroup
                value={userType}
                exclusive
                onChange={handleUserTypeChange}
                aria-label="用户类型"
              >
                <ToggleButton value="student" aria-label="学生">
                  学生
                </ToggleButton>
                <ToggleButton value="teacher" aria-label="教师">
                  教师
                </ToggleButton>
                <ToggleButton value="parent" aria-label="家长">
                  家长
                </ToggleButton>
                <ToggleButton value="admin" aria-label="管理员">
                  管理员
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label={getUsernameLabel()}
              name="username"
              autoComplete="username"
              autoFocus
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密码 (Password)"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              登录
            </Button>
            <Box textAlign="center">
              <Link to="/register" style={{ textDecoration: "none" }}>
                {"还没有账号？立即注册"}
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
