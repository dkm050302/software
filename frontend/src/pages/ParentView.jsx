import React, { useEffect, useState } from 'react';
import { 
  Grid, Paper, Typography, Box, CircularProgress, Button, 
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ParentView() {
  const [stats, setStats] = useState(null);
  const [reportData, setReportData] = useState({});
  const [selectedSubject, setSelectedSubject] = useState('General');
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState(['General']);
  const [studentIds, setStudentIds] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    fetchStudentIds();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      fetchData();
    }
  }, [selectedStudentId]);

  const fetchStudentIds = async () => {
    try {
      const response = await api.get('/parents/student-id');
      const ids = response.data.student_ids || [];
      setStudentIds(ids);
      if (ids.length > 0) {
        setSelectedStudentId(ids[0]);
      }
    } catch (error) {
      console.error('Error fetching student IDs:', error);
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!selectedStudentId) return;
    
    setLoading(true);
    try {
      const params = { student_id: selectedStudentId };
      const [statsRes, reportsRes, subjectsRes] = await Promise.all([
        api.get('/parents/dashboard/stats', { params }),
        api.get('/parents/dashboard/weekly-reports', { params }),
        api.get('/parents/dashboard/subjects', { params })
      ]);
      setStats(statsRes.data);
      setReportData(reportsRes.data || {});
      
      // Merge subjects from DB and reports
      const dbSubjects = subjectsRes.data.subjects || [];
      const ignoredKeys = ['start_date', 'end_date', 'content_latex', 'student_id', 'week_start', 'created_at'];
      const reportSubjects = reportsRes.data ? Object.keys(reportsRes.data).filter(key => !ignoredKeys.includes(key)) : [];
      
      const allSubjects = Array.from(new Set(['General', ...dbSubjects, ...reportSubjects]));
      setSubjects(allSubjects);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedStudentId) {
    return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  }

  if (studentIds.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Parent View</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>暂无关联的学生</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>学生学习情况</Typography>
      
      {/* Student Selection */}
      {studentIds.length > 1 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>选择学生</InputLabel>
            <Select
              value={selectedStudentId}
              label="选择学生"
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                setSelectedSubject('General');
                setReportData({});
              }}
            >
              {studentIds.map(sid => (
                <MenuItem key={sid} value={sid}>{sid}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : (
        <>
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="primary">本周错题数</Typography>
                <Typography variant="h3">{stats?.mistake_count || 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="primary">本周笔记数</Typography>
                <Typography variant="h3">{stats?.note_count || 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="primary">学习时长</Typography>
                <Typography variant="h3">{stats?.study_hours || 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="primary">学习进度</Typography>
                <Typography variant="h3">{stats?.progress || 0}%</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Report Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>周学习报告</Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>学科</InputLabel>
                <Select
                  value={selectedSubject}
                  label="学科"
                  onChange={(e) => setSelectedSubject(e.target.value)}
                >
                  {subjects.map(sub => (
                    <MenuItem key={sub} value={sub}>{sub}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, minHeight: 300, maxHeight: 600, overflow: 'auto', bgcolor: '#f5f5f5' }}>
              {reportData[selectedSubject] ? (
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                >
                  {reportData[selectedSubject]}
                </ReactMarkdown>
              ) : (
                <Typography color="textSecondary">
                  暂无 {selectedSubject} 学科的报告数据
                </Typography>
              )}
            </Paper>
          </Paper>
        </>
      )}
    </Box>
  );
}
