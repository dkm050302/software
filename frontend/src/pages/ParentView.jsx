import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import api from '../services/api';

export default function ParentView() {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await api.get('/parents/report');
        setReport(response.data.report);
      } catch (error) {
        console.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Parent Report</Typography>
      <Paper sx={{ p: 4 }}>
        {loading ? (
          <Box display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <>
            <Typography variant="h6" gutterBottom color="primary">
              Weekly Learning Summary
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {report}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}
