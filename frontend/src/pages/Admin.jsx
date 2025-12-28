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
} from "@mui/material";
import { Delete as DeleteIcon } from "@mui/icons-material";
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

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          管理员界面
        </Typography>

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
                      <TableCell>邮箱</TableCell>
                      <TableCell>班级</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teachers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      teachers.map((teacher) => (
                        <TableRow key={teacher.id}>
                          <TableCell>{teacher.id}</TableCell>
                          <TableCell>{teacher.email}</TableCell>
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
    </Container>
  );
}

