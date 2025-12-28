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
  const [userType, setUserType] = useState("student");
  const [formData, setFormData] = useState({
    // 学生
    student_id: "",
    name: "",
    password: "",
    class_name: "",
    // 教师
    email: "",
    // 家长
    phone: "",
    student_id_for_parent: "", // 家长注册时需要关联的学生学号
  });
  const [error, setError] = useState("");

  const handleUserTypeChange = (event, newType) => {
    if (newType !== null) {
      setUserType(newType);
      setFormData({
        student_id: "",
        name: "",
        password: "",
        class_name: "",
        email: "",
        phone: "",
        student_id_for_parent: "",
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

      if (userType === "student") {
        endpoint = "/auth/register/student";
        data = {
          student_id: formData.student_id,
          name: formData.name,
          password: formData.password,
          class_name: formData.class_name,
        };
      } else if (userType === "teacher") {
        endpoint = "/auth/register/teacher";
        data = {
          email: formData.email,
          password: formData.password,
          class_name: formData.class_name,
        };
      } else if (userType === "parent") {
        endpoint = "/auth/register/parent";
        data = {
          phone: formData.phone,
          password: formData.password,
          student_id: formData.student_id_for_parent,
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

            {/* 学生注册表单 */}
            {userType === "student" && (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="student_id"
                  label="学号 (Student ID)"
                  name="student_id"
                  autoComplete="username"
                  autoFocus
                  value={formData.student_id}
                  onChange={(e) =>
                    setFormData({ ...formData, student_id: e.target.value })
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
                <TextField
                  margin="normal"
                  fullWidth
                  id="class_name"
                  label="班级 (Class)"
                  name="class_name"
                  value={formData.class_name}
                  onChange={(e) =>
                    setFormData({ ...formData, class_name: e.target.value })
                  }
                />
              </>
            )}

            {/* 教师注册表单 */}
            {userType === "teacher" && (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="邮箱 (Email)"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                <TextField
                  margin="normal"
                  fullWidth
                  id="class_name"
                  label="班级 (Class) - 与学生的班级相同将自动绑定"
                  name="class_name"
                  value={formData.class_name}
                  onChange={(e) =>
                    setFormData({ ...formData, class_name: e.target.value })
                  }
                />
              </>
            )}

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
