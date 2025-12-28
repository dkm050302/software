import React, { useState, useEffect } from "react";
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  Snackbar,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import api from "../services/api";

export default function StudentStatus() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [teachingPlan, setTeachingPlan] = useState({
    student_status: null,
    teaching_plan: null,
    time: null,
  });
  const [generatingStatus, setGeneratingStatus] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success", // 'success' | 'error' | 'info' | 'warning'
  });

  useEffect(() => {
    fetchTeacherInfo();
    fetchTeachingPlan();
  }, []);

  const fetchTeacherInfo = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/teacher/student-status");
      // 只保存教师信息，不保存学生列表
      setTeacherInfo({
        teacher_subject: response.data.teacher_subject,
        teacher_class: response.data.teacher_class,
        student_count: response.data.students.length,
      });
    } catch (err) {
      setError(err.response?.data?.detail || "获取信息失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachingPlan = async () => {
    try {
      const response = await api.get("/teacher/teaching-plan");
      if (response.data) {
        setTeachingPlan(response.data);
        // 如果有内容，默认展开
        if (response.data.student_status) {
          setStatusExpanded(true);
        }
        if (response.data.teaching_plan) {
          setPlanExpanded(true);
        }
      }
    } catch (err) {
      console.error("获取教学方案失败:", err);
      // 如果获取失败，设置为空状态
      setTeachingPlan({
        student_status: null,
        teaching_plan: null,
        time: null,
      });
    }
  };

  const handleGenerateStudentStatus = async () => {
    setGeneratingStatus(true);
    setError("");
    try {
      const response = await api.post("/teacher/generate-student-status");
      setTeachingPlan((prev) => ({
        ...prev,
        student_status: response.data.student_status,
        time: new Date().toISOString(),
      }));
      setStatusExpanded(true);
      setSnackbar({
        open: true,
        message: "学生学习情况生成成功！",
        severity: "success",
      });
    } catch (err) {
      setError(err.response?.data?.detail || "生成学生学习情况失败");
    } finally {
      setGeneratingStatus(false);
    }
  };

  const handleGenerateTeachingPlan = async () => {
    setGeneratingPlan(true);
    setError("");
    try {
      const response = await api.post("/teacher/generate-teaching-plan");
      setTeachingPlan((prev) => ({
        ...prev,
        teaching_plan: response.data.teaching_plan,
        time: new Date().toISOString(),
      }));
      setPlanExpanded(true);
      setSnackbar({
        open: true,
        message: "教学方案生成成功！",
        severity: "success",
      });
    } catch (err) {
      setError(err.response?.data?.detail || "生成教学方案失败");
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleDeleteStudentStatus = async () => {
    if (!window.confirm("确定要删除学生学习情况吗？")) {
      return;
    }
    try {
      await api.delete("/teacher/student-status");
      setTeachingPlan((prev) => ({
        ...prev,
        student_status: null,
        teaching_plan: null, // 删除学生学习情况时，也删除教学方案
      }));
      setStatusExpanded(false);
      setPlanExpanded(false);
      setSnackbar({
        open: true,
        message: "删除成功！",
        severity: "success",
      });
    } catch (err) {
      setError(err.response?.data?.detail || "删除失败");
    }
  };

  const handleDeleteTeachingPlan = async () => {
    if (!window.confirm("确定要删除教学方案吗？")) {
      return;
    }
    try {
      await api.delete("/teacher/teaching-plan");
      setTeachingPlan((prev) => ({
        ...prev,
        teaching_plan: null,
      }));
      setPlanExpanded(false);
      setSnackbar({
        open: true,
        message: "删除成功！",
        severity: "success",
      });
    } catch (err) {
      setError(err.response?.data?.detail || "删除失败");
    }
  };


  // 格式化教学方案文本，将Markdown格式转换为加粗显示
  const formatTeachingPlan = (text) => {
    if (!text) return null;

    // 按行分割
    const lines = text.split('\n');
    const formattedElements = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // 匹配 # 标题格式（一级标题）
      if (trimmedLine.match(/^#\s+/)) {
        const title = trimmedLine.replace(/^#\s+/, '');
        formattedElements.push(
          <Typography key={`h1-${index}`} variant="h5" sx={{ mt: 2, mb: 1.5, fontWeight: 'bold' }}>
            {title}
          </Typography>
        );
      }
      // 匹配 ## 标题格式（二级标题）
      else if (trimmedLine.match(/^##\s+/)) {
        const title = trimmedLine.replace(/^##\s+/, '');
        formattedElements.push(
          <Typography key={`h2-${index}`} variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
            {title}
          </Typography>
        );
      }
      // 匹配 --- 分隔线
      else if (trimmedLine.match(/^---+$/)) {
        formattedElements.push(
          <Box key={`divider-${index}`} sx={{ my: 2, borderTop: '1px solid', borderColor: 'divider' }} />
        );
      }
      // 匹配 **标题** 格式（加粗标题，可能包含行内内容）
      else if (trimmedLine.includes('**')) {
        // 处理行内加粗和普通文本混合的情况
        const parts = trimmedLine.split(/(\*\*.*?\*\*)/g);
        const content = parts.map((part, partIndex) => {
          if (part.match(/^\*\*.*\*\*$/)) {
            const boldText = part.replace(/\*\*/g, '');
            return <strong key={`bold-${index}-${partIndex}`}>{boldText}</strong>;
          }
          return part;
        });
        formattedElements.push(
          <Typography key={`bold-line-${index}`} variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 'bold' }}>
            {content}
          </Typography>
        );
      }
      // 匹配 - 开头的列表项
      else if (trimmedLine.match(/^-\s+/)) {
        const content = trimmedLine.replace(/^-\s+/, '');
        formattedElements.push(
          <Typography key={`list-${index}`} variant="body2" sx={{ ml: 2, mb: 0.5 }}>
            • {content}
          </Typography>
        );
      }
      // 普通文本
      else if (trimmedLine) {
        formattedElements.push(
          <Typography key={`text-${index}`} variant="body1" sx={{ mb: 0.5 }}>
            {trimmedLine}
          </Typography>
        );
      }
      // 空行
      else {
        formattedElements.push(<Box key={`space-${index}`} sx={{ mb: 0.5 }} />);
      }
    });

    return formattedElements;
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        </Box>
      </Container>
    );
  }

  if (!teacherInfo) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h6">暂无数据</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          学生学习情况
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body1" color="text.secondary">
              学科：{teacherInfo.teacher_subject || "未设置"}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              班级：{teacherInfo.teacher_class || "未设置"}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              学生总数：{teacherInfo.student_count || 0}
            </Typography>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                onClick={handleGenerateStudentStatus}
                disabled={generatingStatus}
                startIcon={<RefreshIcon />}
              >
                {generatingStatus ? "生成中..." : "生成学生学习情况"}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleGenerateTeachingPlan}
                disabled={generatingPlan || !teachingPlan?.student_status}
                startIcon={<RefreshIcon />}
              >
                {generatingPlan ? "生成中..." : "生成相关教学方案"}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* 学生学习情况显示 */}
        {teachingPlan?.student_status && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">学生学习情况</Typography>
                <IconButton
                  color="error"
                  onClick={handleDeleteStudentStatus}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              <Accordion
                expanded={statusExpanded}
                onChange={(e, expanded) => setStatusExpanded(expanded)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" color="text.secondary">
                    点击展开查看详情
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                    {teachingPlan.student_status}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* 教学方案显示 */}
        {teachingPlan?.teaching_plan && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">教学方案</Typography>
                <IconButton
                  color="error"
                  onClick={handleDeleteTeachingPlan}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              <Accordion
                expanded={planExpanded}
                onChange={(e, expanded) => setPlanExpanded(expanded)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" color="text.secondary">
                    点击展开查看详情
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    {formatTeachingPlan(teachingPlan.teaching_plan)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* 成功提示Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
}

