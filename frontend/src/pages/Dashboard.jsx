import React, { useEffect, useState, useRef } from 'react';
import { 
  Grid, Paper, Typography, Box, CircularProgress, Button, 
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [reportData, setReportData] = useState({}); // Stores all loaded reports
  const [selectedSubject, setSelectedSubject] = useState('General');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [subjects, setSubjects] = useState(['General']);
  const reportRef = useRef(null);

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

  const handleRefresh = async () => {
    setAnalyzing(true);
    try {
      const res = await api.get('/dashboard/weekly-reports');
      setReportData(res.data || {});
    } catch (error) {
      console.error("Error refreshing reports:", error);
      alert('Failed to refresh reports.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!reportRef.current) return;
    
    setAnalyzing(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true, // Handle cross-origin images if any
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const ratio = pdfWidth / imgWidth;
      const pdfImgHeight = imgHeight * ratio;
      
      let heightLeft = pdfImgHeight;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
      heightLeft -= pdfHeight;
      
      // Add subsequent pages if content overflows
      while (heightLeft > 0) {
        position -= pdfHeight; // Move the image up for the next page
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
        heightLeft -= pdfHeight;
      }
      
      const pdfBlob = pdf.output('blob');
      
      // Upload to backend
      const formData = new FormData();
      formData.append('file', pdfBlob, 'report.pdf');
      
      const res = await api.post('/dashboard/upload-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      alert(`PDF generated and saved: ${res.data.filename}`);
      
      // Open in new tab
      const fileURL = URL.createObjectURL(pdfBlob);
      window.open(fileURL, '_blank');
      
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert('Failed to generate PDF.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Learning Dashboard</Typography>
      
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
            onClick={handleRefresh}
            disabled={analyzing}
          >
            Refresh
          </Button>

          <Button 
            variant="contained" 
            color="success" 
            onClick={handleGeneratePDF}
            disabled={analyzing}
          >
            Generate PDF
          </Button>
        </Box>

        <Paper variant="outlined" sx={{ p: 2, minHeight: 300, maxHeight: 600, overflow: 'auto', bgcolor: '#f5f5f5' }}>
            <div ref={reportRef} style={{ padding: '20px', backgroundColor: 'white' }}>
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
            </div>
        </Paper>
      </Paper>
    </Box>
  );
}
