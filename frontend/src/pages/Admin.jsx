import React, { useState, useEffect } from "react";
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  CircularProgress,
  TextField,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon, Download as DownloadIcon, Upload as UploadIcon } from "@mui/icons-material";
import api from "../services/api";

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Admin() {
  const [tabValue, setTabValue] = useState(0);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: "", // 'student', 'teacher', 'parent'
    id: null,
    name: "",
  });
  const [registerDialog, setRegisterDialog] = useState({
    open: false,
    type: "", // 'student', 'teacher'
  });
  const [registerFormData, setRegisterFormData] = useState({
    // 学生注册
    student_id: "",
    name: "",
    password: "",
    class_name: "",
    // 教师注册
    email: "",
    subject: "",
  });
  const [importDialog, setImportDialog] = useState({
    open: false,
    file: null,
    loading: false,
    result: null,
  });

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      if (tabValue === 0) {
        const response = await api.get("/admin/students");
        setStudents(response.data);
      } else if (tabValue === 1) {
        const response = await api.get("/admin/teachers");
        setTeachers(response.data);
      } else if (tabValue === 2) {
        const response = await api.get("/admin/parents");
        setParents(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (type, id, name) => {
    setDeleteDialog({
      open: true,
      type,
      id,
      name,
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      const { type, id } = deleteDialog;
      if (type === "student") {
        await api.delete(`/admin/students/${id}`);
        setStudents(students.filter((s) => s.student_id !== id));
      } else if (type === "teacher") {
        await api.delete(`/admin/teachers/${id}`);
        setTeachers(teachers.filter((t) => t.id !== id));
      } else if (type === "parent") {
        await api.delete(`/admin/parents/${id}`);
        setParents(parents.filter((p) => p.id !== id));
      }
      setDeleteDialog({ open: false, type: "", id: null, name: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "删除失败");
      setDeleteDialog({ open: false, type: "", id: null, name: "" });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, type: "", id: null, name: "" });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRegisterClick = (type) => {
    setRegisterDialog({ open: true, type });
    setRegisterFormData({
      student_id: "",
      name: "",
      password: "",
      class_name: "",
      email: "",
      subject: "",
    });
    setError("");
  };

  const handleRegisterClose = () => {
    setRegisterDialog({ open: false, type: "" });
    setRegisterFormData({
      student_id: "",
      name: "",
      password: "",
      class_name: "",
      email: "",
      subject: "",
    });
    setError("");
  };

  const handleRegisterSubmit = async () => {
    setError("");
    try {
      if (registerDialog.type === "student") {
        await api.post("/auth/register/student", {
          student_id: registerFormData.student_id,
          name: registerFormData.name,
          password: registerFormData.password,
          class_name: registerFormData.class_name,
        });
        handleRegisterClose();
        fetchData();
      } else if (registerDialog.type === "teacher") {
        await api.post("/auth/register/teacher", {
          email: registerFormData.email,
          password: registerFormData.password,
          class_name: registerFormData.class_name,
          subject: registerFormData.subject,
        });
        handleRegisterClose();
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.detail || "注册失败");
    }
  };

  const handleExportTemplate = async () => {
    try {
      const response = await api.get("/admin/export-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.detail || "导出模板失败");
    }
  };

  const handleImportFile = async () => {
    if (!importDialog.file) {
      setError("请选择文件");
      return;
    }

    setImportDialog({ ...importDialog, loading: true });
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", importDialog.file);

      const response = await api.post("/admin/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setImportDialog({
        open: true,
        file: importDialog.file,
        loading: false,
        result: response.data,
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "导入失败");
      setImportDialog({ ...importDialog, loading: false });
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h4" component="h1">
            管理员界面
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportTemplate}
              sx={{ mr: 1 }}
            >
              导出模板
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setImportDialog({ open: true, file: null, loading: false, result: null })}
            >
              导入
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Paper sx={{ width: "100%" }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="学生管理" />
            <Tab label="教师管理" />
            <Tab label="家长管理" />
          </Tabs>

          {/* 学生管理 */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6">学生列表</Typography>
              <Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleRegisterClick("student")}
                  sx={{ mr: 1 }}
                >
                  添加学生
                </Button>
                <Button variant="outlined" onClick={fetchData}>
                  刷新
                </Button>
              </Box>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>学号</TableCell>
                      <TableCell>姓名</TableCell>
                      <TableCell>班级</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      students.map((student) => (
                        <TableRow key={student.student_id}>
                          <TableCell>{student.student_id}</TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell>{student.class_name || "-"}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              color="error"
                              onClick={() =>
                                handleDeleteClick(
                                  "student",
                                  student.student_id,
                                  student.name
                                )
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* 教师管理 */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6">教师列表</Typography>
              <Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleRegisterClick("teacher")}
                  sx={{ mr: 1 }}
                >
                  添加教师
                </Button>
                <Button variant="outlined" onClick={fetchData}>
                  刷新
                </Button>
              </Box>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>邮箱</TableCell>
                      <TableCell>学科</TableCell>
                      <TableCell>班级</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teachers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      teachers.map((teacher) => (
                        <TableRow key={teacher.id}>
                          <TableCell>{teacher.id}</TableCell>
                          <TableCell>{teacher.email}</TableCell>
                          <TableCell>{teacher.subject || "-"}</TableCell>
                          <TableCell>{teacher.class_name || "-"}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              color="error"
                              onClick={() =>
                                handleDeleteClick("teacher", teacher.id, teacher.email)
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* 家长管理 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6">家长列表</Typography>
              <Button variant="outlined" onClick={fetchData}>
                刷新
              </Button>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>电话</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      parents.map((parent) => (
                        <TableRow key={parent.id}>
                          <TableCell>{parent.id}</TableCell>
                          <TableCell>{parent.phone}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              color="error"
                              onClick={() =>
                                handleDeleteClick("parent", parent.id, parent.phone)
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </Paper>
      </Box>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialog.open} onClose={handleDeleteCancel}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除{" "}
            {deleteDialog.type === "student"
              ? "学生"
              : deleteDialog.type === "teacher"
              ? "教师"
              : "家长"}{" "}
            <strong>{deleteDialog.name}</strong> 吗？此操作不可撤销。
            {deleteDialog.type === "student" &&
              " 删除学生将同时删除其所有关联数据（家长关系、教师关系、学习记录等）。"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>取消</Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 注册对话框 */}
      <Dialog open={registerDialog.open} onClose={handleRegisterClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {registerDialog.type === "student" ? "注册学生账号" : "注册教师账号"}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {registerDialog.type === "student" && (
            <>
              <TextField
                margin="normal"
                required
                fullWidth
                id="student_id"
                label="学号"
                name="student_id"
                autoFocus
                value={registerFormData.student_id}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    student_id: e.target.value,
                  })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                id="name"
                label="姓名"
                name="name"
                value={registerFormData.name}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    name: e.target.value,
                  })
                }
              />
              <TextField
                margin="normal"
                fullWidth
                id="class_name"
                label="班级"
                name="class_name"
                value={registerFormData.class_name}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    class_name: e.target.value,
                  })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="密码"
                type="password"
                id="password"
                value={registerFormData.password}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    password: e.target.value,
                  })
                }
              />
            </>
          )}
          {registerDialog.type === "teacher" && (
            <>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="邮箱"
                name="email"
                type="email"
                autoFocus
                value={registerFormData.email}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    email: e.target.value,
                  })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                id="subject"
                label="学科"
                name="subject"
                value={registerFormData.subject}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    subject: e.target.value,
                  })
                }
              />
              <TextField
                margin="normal"
                fullWidth
                id="class_name"
                label="班级（与学生的班级相同将自动绑定）"
                name="class_name"
                value={registerFormData.class_name}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    class_name: e.target.value,
                  })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="密码"
                type="password"
                id="password"
                value={registerFormData.password}
                onChange={(e) =>
                  setRegisterFormData({
                    ...registerFormData,
                    password: e.target.value,
                  })
                }
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRegisterClose}>取消</Button>
          <Button onClick={handleRegisterSubmit} variant="contained" autoFocus>
            注册
          </Button>
        </DialogActions>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialog.open} onClose={() => setImportDialog({ open: false, file: null, loading: false, result: null })} maxWidth="md" fullWidth>
        <DialogTitle>导入数据</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {importDialog.result && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>导入完成</Typography>
              <Typography variant="body2">
                学生：成功 {importDialog.result.results.students.success}，失败 {importDialog.result.results.students.failed}
              </Typography>
              <Typography variant="body2">
                教师：成功 {importDialog.result.results.teachers.success}，失败 {importDialog.result.results.teachers.failed}
              </Typography>
              <Typography variant="body2">
                家长：成功 {importDialog.result.results.parents.success}，失败 {importDialog.result.results.parents.failed}
              </Typography>
              {importDialog.result.results.students.errors.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="error">
                    学生错误：{importDialog.result.results.students.errors.slice(0, 5).join("; ")}
                    {importDialog.result.results.students.errors.length > 5 && "..."}
                  </Typography>
                </Box>
              )}
              {importDialog.result.results.teachers.errors.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="error">
                    教师错误：{importDialog.result.results.teachers.errors.slice(0, 5).join("; ")}
                    {importDialog.result.results.teachers.errors.length > 5 && "..."}
                  </Typography>
                </Box>
              )}
              {importDialog.result.results.parents.errors.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="error">
                    家长错误：{importDialog.result.results.parents.errors.slice(0, 5).join("; ")}
                    {importDialog.result.results.parents.errors.length > 5 && "..."}
                  </Typography>
                </Box>
              )}
            </Alert>
          )}
          <input
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            id="import-file-input"
            type="file"
            onChange={(e) => {
              setImportDialog({
                ...importDialog,
                file: e.target.files[0],
                result: null,
              });
            }}
          />
          <label htmlFor="import-file-input">
            <Button variant="outlined" component="span" fullWidth sx={{ mb: 2 }}>
              {importDialog.file ? importDialog.file.name : "选择Excel文件"}
            </Button>
          </label>
          <Typography variant="body2" color="text.secondary">
            请选择包含"学生"、"教师"、"家长"三个sheet的Excel文件
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog({ open: false, file: null, loading: false, result: null })}>
            {importDialog.result ? "关闭" : "取消"}
          </Button>
          {!importDialog.result && (
            <Button
              onClick={handleImportFile}
              variant="contained"
              disabled={!importDialog.file || importDialog.loading}
            >
              {importDialog.loading ? "导入中..." : "导入"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}

