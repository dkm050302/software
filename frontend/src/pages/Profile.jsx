import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import { Edit as EditIcon, Logout as LogoutIcon } from "@mui/icons-material";
import api from "../services/api";

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/auth/profile");
      setProfile(response.data);
      setEditFormData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "获取个人信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("studentId");
    navigate("/login");
  };

  const handleEditClick = () => {
    setEditFormData({ ...profile });
    setPasswordFormData({
      old_password: "",
      new_password: "",
      confirm_password: "",
    });
    setEditDialogOpen(true);
    setError("");
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditFormData({});
    setPasswordFormData({
      old_password: "",
      new_password: "",
      confirm_password: "",
    });
    setError("");
  };

  const handleEditSubmit = async () => {
    setEditLoading(true);
    setError("");
    
    // 验证密码修改（如果填写了密码字段）
    if (passwordFormData.new_password || passwordFormData.old_password || passwordFormData.confirm_password) {
      if (!passwordFormData.old_password) {
        setError("请输入旧密码");
        setEditLoading(false);
        return;
      }
      if (!passwordFormData.new_password) {
        setError("请输入新密码");
        setEditLoading(false);
        return;
      }
      if (passwordFormData.new_password !== passwordFormData.confirm_password) {
        setError("两次输入的密码不一致");
        setEditLoading(false);
        return;
      }
      if (passwordFormData.new_password.length < 6) {
        setError("密码长度至少6位");
        setEditLoading(false);
        return;
      }
    }
    
    try {
      // 根据用户类型构建更新数据（排除id属性）
      const updateData = {};
      if (profile.user_type === "student") {
        if (editFormData.name !== profile.name) {
          updateData.name = editFormData.name;
        }
        if (editFormData.class_name !== profile.class_name) {
          updateData.class_name = editFormData.class_name;
        }
      } else if (profile.user_type === "teacher") {
        if (editFormData.email !== profile.email) {
          updateData.email = editFormData.email;
        }
        if (editFormData.subject !== profile.subject) {
          updateData.subject = editFormData.subject;
        }
        if (editFormData.class_name !== profile.class_name) {
          updateData.class_name = editFormData.class_name;
        }
      } else if (profile.user_type === "parent") {
        if (editFormData.phone !== profile.phone) {
          updateData.phone = editFormData.phone;
        }
      } else if (profile.user_type === "admin") {
        if (editFormData.username !== profile.username) {
          updateData.username = editFormData.username;
        }
        if (editFormData.name !== profile.name) {
          updateData.name = editFormData.name;
        }
      }

      // 更新个人信息
      if (Object.keys(updateData).length > 0) {
        const response = await api.put("/auth/profile", updateData);
        setProfile(response.data);
      }
      
      // 修改密码（如果填写了密码字段）
      if (passwordFormData.new_password && passwordFormData.old_password) {
        await api.put("/auth/change-password", {
          old_password: passwordFormData.old_password,
          new_password: passwordFormData.new_password,
        });
      }
      
      handleEditClose();
      if (passwordFormData.new_password) {
        alert("信息更新成功，密码已修改");
      } else {
        alert("信息更新成功");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "更新失败");
    } finally {
      setEditLoading(false);
    }
  };

  const renderProfileFields = () => {
    if (!profile) return null;

    if (profile.user_type === "student") {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              学号
            </Typography>
            <Typography variant="h6">{profile.student_id}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              姓名
            </Typography>
            <Typography variant="h6">{profile.name || "-"}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              班级
            </Typography>
            <Typography variant="h6">{profile.class_name || "-"}</Typography>
          </Grid>
        </Grid>
      );
    } else if (profile.user_type === "teacher") {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              ID
            </Typography>
            <Typography variant="h6">{profile.id}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              邮箱
            </Typography>
            <Typography variant="h6">{profile.email || "-"}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              学科
            </Typography>
            <Typography variant="h6">{profile.subject || "-"}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              班级
            </Typography>
            <Typography variant="h6">{profile.class_name || "-"}</Typography>
          </Grid>
        </Grid>
      );
    } else if (profile.user_type === "parent") {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              ID
            </Typography>
            <Typography variant="h6">{profile.id}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              电话
            </Typography>
            <Typography variant="h6">{profile.phone || "-"}</Typography>
          </Grid>
        </Grid>
      );
    } else if (profile.user_type === "admin") {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              ID
            </Typography>
            <Typography variant="h6">{profile.id}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              用户名
            </Typography>
            <Typography variant="h6">{profile.username || "-"}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              姓名
            </Typography>
            <Typography variant="h6">{profile.name || "-"}</Typography>
          </Grid>
        </Grid>
      );
    }
  };

  const renderEditForm = () => {
    if (!profile) return null;

    if (profile.user_type === "student") {
      return (
        <>
          <TextField
            margin="normal"
            fullWidth
            id="name"
            label="姓名"
            name="name"
            value={editFormData.name || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, name: e.target.value })
            }
          />
          <TextField
            margin="normal"
            fullWidth
            id="class_name"
            label="班级"
            name="class_name"
            value={editFormData.class_name || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, class_name: e.target.value })
            }
          />
        </>
      );
    } else if (profile.user_type === "teacher") {
      return (
        <>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="邮箱"
            name="email"
            type="email"
            value={editFormData.email || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, email: e.target.value })
            }
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="subject"
            label="学科"
            name="subject"
            value={editFormData.subject || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, subject: e.target.value })
            }
          />
          <TextField
            margin="normal"
            fullWidth
            id="class_name"
            label="班级"
            name="class_name"
            value={editFormData.class_name || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, class_name: e.target.value })
            }
          />
        </>
      );
    } else if (profile.user_type === "parent") {
      return (
        <>
          <TextField
            margin="normal"
            required
            fullWidth
            id="phone"
            label="电话"
            name="phone"
            value={editFormData.phone || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, phone: e.target.value })
            }
          />
        </>
      );
    } else if (profile.user_type === "admin") {
      return (
        <>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="用户名"
            name="username"
            value={editFormData.username || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, username: e.target.value })
            }
          />
          <TextField
            margin="normal"
            fullWidth
            id="name"
            label="姓名"
            name="name"
            value={editFormData.name || ""}
            onChange={(e) =>
              setEditFormData({ ...editFormData, name: e.target.value })
            }
          />
        </>
      );
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          个人页面
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 3,
              }}
            >
              <Typography variant="h6">个人信息</Typography>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEditClick}
              >
                修改信息
              </Button>
            </Box>
            {renderProfileFields()}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6">账户操作</Typography>
              <Button
                variant="contained"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
              >
                登出
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>修改个人信息</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {renderEditForm()}
          
          {/* 密码修改部分 */}
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" gutterBottom>
              修改密码（可选）
            </Typography>
            <TextField
              margin="normal"
              fullWidth
              name="old_password"
              label="旧密码"
              type="password"
              id="old_password"
              value={passwordFormData.old_password}
              onChange={(e) =>
                setPasswordFormData({ ...passwordFormData, old_password: e.target.value })
              }
            />
            <TextField
              margin="normal"
              fullWidth
              name="new_password"
              label="新密码"
              type="password"
              id="new_password"
              value={passwordFormData.new_password}
              onChange={(e) =>
                setPasswordFormData({ ...passwordFormData, new_password: e.target.value })
              }
            />
            <TextField
              margin="normal"
              fullWidth
              name="confirm_password"
              label="确认新密码"
              type="password"
              id="confirm_password"
              value={passwordFormData.confirm_password}
              onChange={(e) =>
                setPasswordFormData({ ...passwordFormData, confirm_password: e.target.value })
              }
              error={passwordFormData.new_password !== passwordFormData.confirm_password && passwordFormData.confirm_password !== ""}
              helperText={
                passwordFormData.new_password !== passwordFormData.confirm_password && passwordFormData.confirm_password !== ""
                  ? "两次输入的密码不一致"
                  : passwordFormData.new_password && passwordFormData.new_password.length < 6
                  ? "密码长度至少6位"
                  : ""
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>取消</Button>
          <Button
            onClick={handleEditSubmit}
            variant="contained"
            disabled={editLoading}
          >
            {editLoading ? "保存中..." : "保存"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

