/* frontend/src/pages/NoteAssistant.jsx */
import React, { useState } from 'react';
import {
  Box, Typography, Button, Paper, Grid, CircularProgress,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Description as DescriptionIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';

export default function NoteAssistant() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [fileType, setFileType] = useState('audio'); // audio | ppt | pdf | image
  const [showRaw, setShowRaw] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  /* 保存按钮回调 */
  const handleSave = async () => {
    if (!result) return;
    const payload = { ...result.structured_notes };
    const token = localStorage.getItem('token');
    try {
      await axios.post(
        '/api/notes/save-file',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('已保存到 data/notes/');
    } catch (e) {
      alert('保存失败：' + (e.response?.data?.detail || e.message));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    const endpoint =
      fileType === 'audio'  ? '/notes/upload-audio'
      : fileType === 'ppt'  ? '/notes/upload-ppt'
      : fileType === 'pdf'  ? '/notes/upload-pdf'
      : '/notes/upload-image';

    try {
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      alert('上传失败');
    } finally {
      setLoading(false);
    }
  };

  const accept =
    fileType === 'audio' ? 'audio/*'
    : fileType === 'ppt' ? '.pptx'
    : fileType === 'pdf' ? '.pdf'
    : 'image/*';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Note Assistant</Typography>

      {/* 永远显示的“我的笔记”入口 */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DescriptionIcon />}
          onClick={() => navigate('/notes-manager')}
        >
          My Notes
        </Button>
      </Box>

      {/* 文件类型切换 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <ToggleButtonGroup
          value={fileType}
          exclusive
          onChange={(_, v) => v && setFileType(v)}
        >
          <ToggleButton value="audio">Audio</ToggleButton>
          <ToggleButton value="ppt">PPT</ToggleButton>
          <ToggleButton value="pdf">PDF</ToggleButton>
          <ToggleButton value="image">Picture</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* 上传区 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Upload {fileType === 'audio' ? 'audio' : fileType === 'ppt' ? 'PPT' : fileType === 'pdf' ? 'PDF' : 'image'}
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
            Select a file
            <input type="file" hidden onChange={handleFileChange} accept={accept} />
          </Button>
          <Typography>{file ? file.name : 'Unselected file'}</Typography>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!file || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Processing'}
          </Button>
        </Box>
      </Paper>

      {/* 结果展示 – 仅保存按钮，不再放“我的笔记” */}
      {result && (
        <>
          <Box sx={{ mb: 2 }}>
            <Button variant="outlined" color="primary" onClick={handleSave}>
              Save to the notebook
            </Button>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={showRaw ? 6 : 12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  结构化笔记
                  <Button size="small" sx={{ ml: 2 }} onClick={() => setShowRaw(v => !v)}>
                    {showRaw ? '隐藏原文' : '显示原文'}
                  </Button>
                </Typography>

                <Typography variant="subtitle1" color="primary" gutterBottom>
                  {result.structured_notes.title}
                </Typography>

                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 2 }}>
                  {result.structured_notes.notes}
                </Typography>
              </Paper>
            </Grid>

            {showRaw && (
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>原始文本</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {result.transcript}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
}