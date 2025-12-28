/* frontend/src/pages/NoteManager.jsx  –– draggable split-pane */
import React, { useEffect, useState, useRef } from 'react';
import {
  Container, Typography, List, ListItem, ListItemText, ListItemButton, ListItemIcon,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  CircularProgress, Paper, Box, Slider, Divider
} from '@mui/material';
import { Description as DescriptionIcon, Delete as DeleteIcon } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css';
import api from '../services/api';

export default function NoteManager() {
  /* ---------- state ---------- */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [fn, setFn] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [fontSize, setFontSize] = useState(1.4);
  const [splitPos, setSplitPos] = useState(50);               // left width %
  const [dragging, setDragging] = useState(false);

  /* ---------- delete ---------- */
  const [delOpen, setDelOpen] = useState(false);
  const [delFile, setDelFile] = useState('');

  const containerRef = useRef(null);   // for mouse coord

  /* ---------- list ---------- */
  const loadList = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notes/my-notes');
      setRows(data);
    } catch (e) {
      alert('Failed to load list: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadList(); }, []);

  /* ---------- open editor ---------- */
  const handleOpen = async (filename) => {
    try {
      const { data } = await api.get('/notes/content?filename=' + encodeURIComponent(filename));
      setFn(filename); setTitle(data.title); setNotes(data.notes); setOpen(true);
    } catch (e) {
      alert('Failed to load note: ' + (e.response?.data?.detail || e.message));
    }
  };

  /* ---------- save ---------- */
  const handleSave = async () => {
    try {
      const { data } = await api.put('/notes/update', { old_filename: fn, new_title: title, new_notes: notes });
      alert('Saved! New file: ' + data.new_filename);
      setOpen(false); loadList();
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.detail || e.message));
    }
  };

  /* ---------- delete ---------- */
  const handleDelete = async () => {
    try {
      await api.delete('/notes/delete', { params: { filename: delFile } });
      setRows(rows.filter(r => r.filename !== delFile));
    } catch (e) {
      alert('Delete failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setDelOpen(false);
    }
  };

  /* ---------- drag split ---------- */
  const onMouseMove = (e) => {
    if (!dragging) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(80, Math.max(20, (x / rect.width) * 100));
    setSplitPos(pct);
  };
  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [dragging]);

  /* ---------- render ---------- */
  return (
    <Container maxWidth="md" sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom>My Notes</Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>No notes yet</Paper>
      ) : (
        <Paper>
          <List>
            {rows.map(r => (
              <ListItem key={r.filename} disablePadding
                secondaryAction={
                  <IconButton edge="end" color="error"
                    onClick={() => { setDelFile(r.filename); setDelOpen(true); }}>
                    <DeleteIcon />
                  </IconButton>
                }>
                <ListItemButton onClick={() => handleOpen(r.filename)}>
                  <ListItemIcon><DescriptionIcon /></ListItemIcon>
                  <ListItemText primary={r.title} secondary={r.filename} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* delete confirm */}
      <Dialog open={delOpen} onClose={() => setDelOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>Permanently delete "{rows.find(i => i.filename === delFile)?.title}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* editor with draggable split */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xl" fullWidth fullScreen>
        <DialogTitle>
          Edit Note
          <Button size="small" sx={{ float: 'right' }} onClick={() => setOpen(false)}>Close</Button>
        </DialogTitle>

        <Box sx={{ px: 3, pt: 1, pb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2">Font size</Typography>
          <Slider value={fontSize} onChange={(_, v) => setFontSize(v)} min={1} max={2.5} step={0.1}
            valueLabelDisplay="auto" sx={{ width: 200 }} />
          <Typography variant="body2">{fontSize.toFixed(1)} rem</Typography>
        </Box>

        <DialogContent sx={{ p: 0, height: '100%' }}>
          <TextField label="Title" fullWidth margin="dense" value={title}
            onChange={e => setTitle(e.target.value)} sx={{ px: 3, pt: 2 }} />

          <Box ref={containerRef} sx={{ height: 'calc(100% - 120px)', display: 'flex', position: 'relative' }}>
            {/* Left - Editor */}
            <Box sx={{ width: `${splitPos}%`, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <TextField
                label="Content (edit)" fullWidth multiline rows={30} value={notes}
                onChange={e => setNotes(e.target.value)}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-input': { fontSize: `${fontSize}rem`, lineHeight: 1.8 }
                }}
              />
            </Box>

            {/* Draggable Divider */}
            <Divider
              orientation="vertical"
              flexItem
              sx={{ cursor: 'col-resize', width: 4, borderRightWidth: 2 }}
              onMouseDown={() => setDragging(true)}
            />

            {/* Right - Preview */}
            <Box sx={{ flex: 1, height: '100%', p: 2 }}>
              <Paper variant="outlined" sx={{ height: '100%', overflow: 'auto', p: 3 }}>
                <Box
                  className="markdown-body"
                  sx={{ '& *': { fontSize: `${fontSize}rem !important`, lineHeight: '1.8 !important' } }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
                </Box>
              </Paper>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}