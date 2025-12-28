/* frontend/src/pages/MapGeneration.jsx */
import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Select, MenuItem, FormControl,
  InputLabel, Stack, Alert, Dialog, DialogTitle, DialogContent,
  List, ListItem, ListItemText, IconButton, DialogActions
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import mermaid from 'mermaid';
import api from '../services/api';
import html2canvas from 'html2canvas';

mermaid.initialize({ startOnLoad: true, theme: 'base' });

function safeText(str) {
  return str
    .replace(/"/g, '＂').replace(/'/g, '＇').replace(/#/g, '＃')
    .replace(/:/g, '：').replace(/\(/g, '（').replace(/\)/g, '）')
    .replace(/\[/g, '［').replace(/\]/g, '］');
}

export default function MapGeneration() {
  const [content, setContent] = useState('');
  const [template, setTemplate] = useState('default');
  const [loading, setLoading] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');
  const [imgSrc, setImgSrc] = useState('');
  const [error, setError] = useState('');
  const svgRef = useRef(null);

  const [fileName, setFileName] = useState('');
  const [openList, setOpenList] = useState(false);
  const [savedFiles, setSavedFiles] = useState([]);

  /* delete states */
  const [delOpen, setDelOpen] = useState(false);
  const [delFile, setDelFile] = useState('');

  const MAX_CHARS = 2500;

  /* generate */
  const handleGenerate = async () => {
    if (!content) return;
    if (content.length > MAX_CHARS) {
      alert(`Text too long (${content.length}), please split to ≤2500 chars`);
      return;
    }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/maps/generate', { content, template });
      setMermaidCode(safeText(data.mermaid_source));
      setImgSrc('');
    } catch (e) {
      const msg = e.response?.data?.detail || e.message;
      setError(msg); alert(`Generation failed:\n${msg}`);
    } finally { setLoading(false); }
  };

  /* render mermaid */
  useEffect(() => {
    if (!mermaidCode) return;
    const container = svgRef.current;
    if (!container) return;
    container.innerHTML = mermaidCode;
    mermaid.run({ nodes: [container] }).catch(err => setError('Mermaid render failed: ' + err.message));
  }, [mermaidCode]);

  /* export PNG */
  const exportPNG = async () => {
    if (!svgRef.current) return;
    const canvas = await html2canvas(svgRef.current, { backgroundColor: '#fff', scale: 2 });
    const link = document.createElement('a');
    link.download = 'mindmap.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  /* save */
  const handleSaveMap = async () => {
    if (!fileName.trim()) { alert('Please enter a file name'); return; }
    const studentId = localStorage.getItem('studentId');
    const safeName = `${studentId}_${fileName.trim()}.mmd`;
    try {
      await api.post('/maps/save', { svgCode: mermaidCode, fileName: safeName });
      alert('Saved'); setFileName('');
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.detail || e.message));
    }
  };

  /* list */
  const handleListMaps = async () => {
    try {
      const { data } = await api.get('/maps/list');
      setSavedFiles(data.files || []); setOpenList(true);
    } catch (e) {
      alert('Failed to load list: ' + (e.response?.data?.detail || e.message));
    }
  };

  /* load */
  const handleLoadMap = async (f) => {
    try {
      if (f.endsWith('.png')) {
        const { data: blob } = await api.get(`/maps/content/${encodeURIComponent(f)}`, { responseType: 'blob' });
        const objUrl = URL.createObjectURL(blob);
        setImgSrc(objUrl);
        if (imgSrc && imgSrc.startsWith('blob:')) URL.revokeObjectURL(imgSrc);
        setMermaidCode('');
      } else {
        const { data } = await api.get(`/maps/content/${encodeURIComponent(f)}`);
        setMermaidCode(data.content); setImgSrc('');
      }
      setOpenList(false);
    } catch (e) {
      alert('Load failed: ' + (e.response?.data?.detail || e.message));
    }
  };

  /* delete */
  const handleDeleteMap = async () => {
    try {
      await api.delete('/maps/delete', { params: { file_name: delFile } });
      const { data } = await api.get('/maps/list');
      setSavedFiles(data.files || []);
    } catch (e) {
      alert('Delete failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setDelOpen(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Mind Map Assistant</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <TextField label="Paste notes/keywords" multiline rows={5} fullWidth
            value={content} onChange={e => setContent(e.target.value)} />
          <FormControl sx={{ width: 220 }}>
            <InputLabel>Template</InputLabel>
            <Select value={template} onChange={e => setTemplate(e.target.value)}>
              <MenuItem value="default">Mind Map</MenuItem>
              <MenuItem value="timeline">Timeline</MenuItem>
              <MenuItem value="compare">Comparison</MenuItem>
              <MenuItem value="layer">Hierarchy</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" onClick={handleGenerate} disabled={loading || !content}>
              {loading ? 'Generating…' : 'Generate'}
            </Button>
            <Button variant="outlined" onClick={handleListMaps}>My Mind Maps</Button>
          </Stack>

          {(mermaidCode || imgSrc) && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              {mermaidCode && <Button onClick={exportPNG}>Export PNG</Button>}
              <TextField placeholder="File name (no extension)" size="small"
                value={fileName} onChange={e => setFileName(e.target.value)} />
              <Button variant="outlined" onClick={handleSaveMap}>Save Map</Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {mermaidCode && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Preview</Typography>
          <Box sx={{ overflow: 'auto' }}>
            <div ref={svgRef} className="mermaid" style={{ minHeight: 200 }} />
          </Box>
        </Paper>
      )}

      {imgSrc && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Image Preview</Typography>
          <img src={imgSrc} alt="mindmap" style={{ maxWidth: '100%' }} />
        </Paper>
      )}

      {/* My Mind Maps dialog */}
      <Dialog open={openList} onClose={() => setOpenList(false)} maxWidth="xs" fullWidth>
        <DialogTitle>My Mind Maps</DialogTitle>
        <DialogContent>
          {savedFiles.length === 0 && <Typography sx={{ py: 2 }}>No saves yet</Typography>}
          <List>
            {savedFiles.map(f => (
              <ListItem key={f}
                secondaryAction={
                  <IconButton edge="end" color="error"
                    onClick={() => { setDelFile(f); setDelOpen(true); }}>
                    <DeleteIcon />
                  </IconButton>
                }>
                <ListItemText primary={f} onClick={() => handleLoadMap(f)} sx={{ cursor: 'pointer' }} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <Dialog open={delOpen} onClose={() => setDelOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>Permanently delete "{delFile}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteMap} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}