import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Grid, CircularProgress, Card, CardContent, Chip } from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import api from '../services/api';

export default function ErrorBook() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/errors/upload-problem', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
    } catch (error) {
      console.error('Error uploading problem:', error);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Error Book Manager</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Upload Problem Image</Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            component="label"
            variant="outlined"
            startIcon={<CloudUploadIcon />}
          >
            Select Image
            <input type="file" hidden onChange={handleFileChange} accept="image/*" />
          </Button>
          <Typography>{file ? file.name : 'No file selected'}</Typography>
          <Button 
            variant="contained" 
            onClick={handleUpload} 
            disabled={!file || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Analyze'}
          </Button>
        </Box>
      </Paper>

      {result && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Extracted Text (OCR)</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                {result.text}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>AI Analysis</Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip label={result.analysis.topic} color="primary" sx={{ mr: 1 }} />
                  <Chip label={result.analysis.difficulty} color="secondary" />
                </Box>
                
                <Typography variant="subtitle2" gutterBottom>Explanation:</Typography>
                <Typography variant="body2" paragraph>
                  {result.analysis.explanation}
                </Typography>

                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle2" gutterBottom>Similar Question:</Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  {result.analysis.similar_question}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
