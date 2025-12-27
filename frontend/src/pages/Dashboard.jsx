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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [reportData, setReportData] = useState({}); // Stores all loaded reports
  const [selectedSubject, setSelectedSubject] = useState('General');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [subjects, setSubjects] = useState(['General']);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, reportsRes, subjectsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/weekly-reports'),
        api.get('/dashboard/subjects')
      ]);
      setStats(statsRes.data);
      setReportData(reportsRes.data || {});
      
      // Merge subjects from DB and reports
      const dbSubjects = subjectsRes.data.subjects || [];
      // Filter out metadata keys that might be in the report JSON
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      // If selectedSubject is General, we send General.
      const res = await api.post('/dashboard/analyze-report', { subject: selectedSubject });
      
      // Update local state with new data
      setReportData(prev => ({ ...prev, ...res.data }));
      alert('Analysis complete!');
    } catch (error) {
      console.error("Error analyzing report:", error);
      alert('Failed to analyze report.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    // "Confirm button is only reading tip not analyzing, if corresponding subject has no report, then analyze"
    if (reportData[selectedSubject]) {
        // Already have it, do nothing (it's already displayed)
        return;
    }
    
    // If not present, trigger analysis
    await handleAnalyze();
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Learning Dashboard</Typography>
      
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">Mistakes This Week</Typography>
            <Typography variant="h3">{stats?.mistake_count || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">Notes This Week</Typography>
            <Typography variant="h3">{stats?.note_count || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">Study Hours</Typography>
            <Typography variant="h3">{stats?.study_hours || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">Progress</Typography>
            <Typography variant="h3">{stats?.progress || 0}%</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Report Section */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Weekly Learning Report</Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>subject</InputLabel>
            <Select
              value={selectedSubject}
              label="subject"
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {subjects.map(sub => (
                <MenuItem key={sub} value={sub}>{sub}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
          
          <Button 
            variant="outlined" 
            color="secondary" 
            onClick={handleConfirm}
            disabled={analyzing}
          >
            Confirm / View
          </Button>
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
                    No report available for {selectedSubject}. Click "Confirm" or "Analyze" to generate.
                </Typography>
            )}
        </Paper>
      </Paper>
    </Box>
  );
}
