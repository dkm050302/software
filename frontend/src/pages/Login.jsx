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
      const response = await api.post("/auth/token", data, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("userType", userType);
      // 如果是学生，保存学号
      if (userType === "student") {
        localStorage.setItem("studentId", formData.username);
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
