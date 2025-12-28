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

export default function Register() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState("parent");
  const [formData, setFormData] = useState({
    // 家长
    phone: "",
    student_id_for_parent: "", // 家长注册时需要关联的学生学号
    password: "",
    // 管理员
    username: "",
    name: "",
  });
  const [error, setError] = useState("");

  const handleUserTypeChange = (event, newType) => {
    if (newType !== null) {
      setUserType(newType);
      setFormData({
        phone: "",
        student_id_for_parent: "",
        password: "",
        username: "",
        name: "",
      });
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      let endpoint = "";
      let data = {};

      if (userType === "parent") {
        endpoint = "/auth/register/parent";
        data = {
          phone: formData.phone,
          password: formData.password,
          student_id: formData.student_id_for_parent,
        };
      } else if (userType === "admin") {
        endpoint = "/auth/register/admin";
        data = {
          username: formData.username,
          password: formData.password,
          name: formData.name,
        };
      }

      await api.post(endpoint, data);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "注册失败。");
    }
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
            注册 AI Tutor
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
                <ToggleButton value="parent" aria-label="家长">
                  家长
                </ToggleButton>
                <ToggleButton value="admin" aria-label="管理员">
                  管理员
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* 家长注册表单 */}
            {userType === "parent" && (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="phone"
                  label="电话 (Phone)"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  autoFocus
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="student_id_for_parent"
                  label="关联学生学号 (Student ID)"
                  name="student_id_for_parent"
                  value={formData.student_id_for_parent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      student_id_for_parent: e.target.value,
                    })
                  }
                />
              </>
            )}

            {/* 管理员注册表单 */}
            {userType === "admin" && (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="username"
                  label="用户名 (Username)"
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
                  id="name"
                  label="姓名 (Name)"
                  name="name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </>
            )}

            {/* 密码字段（所有身份都需要） */}
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密码 (Password)"
              type="password"
              id="password"
              autoComplete="new-password"
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
              注册
            </Button>
            <Box textAlign="center">
              <Link to="/login" style={{ textDecoration: "none" }}>
                {"已有账号？立即登录"}
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
