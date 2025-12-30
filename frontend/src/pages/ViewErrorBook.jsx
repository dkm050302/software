import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Button, Paper, Grid, CircularProgress, 
  TextField, MenuItem, Select, FormControl, InputLabel, 
  OutlinedInput, Chip, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton,
  Card, CardContent, Divider, ButtonGroup, Tooltip, Checkbox
} from '@mui/material';
import { Save as SaveIcon, FormatBold, FormatItalic, FormatSize, Code, Delete as DeleteIcon } from '@mui/icons-material';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ViewErrorBook() {
  // Data State
  const [filterData, setFilterData] = useState([]);
  
  // Constants
  const ALL_OPTION = "__ALL__";

  // Filter State
  const [selectedSubject, setSelectedSubject] = useState(ALL_OPTION);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState([]);
  
  // Mistakes Data
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Selected Mistake for Edit
  const [selectedMistake, setSelectedMistake] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState([]);

  // Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/errors/filters');
        setFilterData(res.data);
      } catch (error) {
        console.error("Error fetching filter data:", error);
      }
    };
    fetchData();
  }, []);

  // Derived Options
  const availableSubjects = useMemo(() => {
    return [...new Set(filterData.map(item => item.subject).filter(Boolean))];
  }, [filterData]);
  
  const availableChapters = useMemo(() => {
    if (!selectedSubject || selectedSubject === ALL_OPTION) return [];
    return [...new Set(
      filterData
        .filter(item => item.subject === selectedSubject)
        .map(item => item.chapter)
        .filter(Boolean)
    )];
  }, [selectedSubject, filterData]);

  const availableKnowledgePoints = useMemo(() => {
    if (!selectedSubject || selectedSubject === ALL_OPTION || !selectedChapter || selectedChapter === ALL_OPTION) return [];
    return [...new Set(
      filterData
        .filter(item => item.subject === selectedSubject && item.chapter === selectedChapter)
        .map(item => item.knowledge_point)
        .filter(Boolean)
    )];
  }, [selectedSubject, selectedChapter, filterData]);

  // Handlers
  const handleSubjectChange = (e) => {
    const value = e.target.value;
    setSelectedSubject(value);
    if (value === ALL_OPTION) {
      setSelectedChapter('');
      setSelectedKnowledgePoints([]);
    } else {
      setSelectedChapter('');
      setSelectedKnowledgePoints([]);
    }
  };

  const handleChapterChange = (e) => {
    const value = e.target.value;
    setSelectedChapter(value);
    if (value === ALL_OPTION) {
      setSelectedKnowledgePoints([]);
    } else {
      setSelectedKnowledgePoints([]);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setSelectedMistake(null);
    try {
      const params = {};
      // Only add params if not "All" option
      if (selectedSubject && selectedSubject !== ALL_OPTION) {
        params.subject = selectedSubject;
      }
      if (selectedChapter && selectedChapter !== ALL_OPTION) {
        params.chapter = selectedChapter;
      }
      if (selectedKnowledgePoints.length > 0 && !selectedKnowledgePoints.includes(ALL_OPTION)) {
        // Send as JSON string or comma separated, backend handles both.
        // Using JSON string to be safe with commas in tags
        params.knowledge_points = JSON.stringify(selectedKnowledgePoints);
      }
      
      const res = await api.get('/errors/list', { params });
      setMistakes(res.data);
      setHasSearched(true);
    } catch (error) {
      console.error("Error searching mistakes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (mistake) => {
    if (selectedMistake?.id === mistake.id) {
      setSelectedMistake(null);
      setEditContent('');
      setEditNote('');
    } else {
      setSelectedMistake(mistake);
      setEditContent(mistake.content || '');
      setEditNote(mistake.note || '');
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelecteds = mistakes.map((n) => n.id);
      setSelectedIds(newSelecteds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (event, id) => {
    event.stopPropagation();
    const selectedIndex = selectedIds.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedIds, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedIds.slice(1));
    } else if (selectedIndex === selectedIds.length - 1) {
      newSelected = newSelected.concat(selectedIds.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedIds.slice(0, selectedIndex),
        selectedIds.slice(selectedIndex + 1),
      );
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    if (!selectedMistake) return;
    if (!window.confirm('Are you sure you want to delete this mistake?')) return;
    
    try {
      await api.delete(`/errors/${selectedMistake.id}`);
      setMistakes(mistakes.filter(m => m.id !== selectedMistake.id));
      setSelectedMistake(null);
      alert('Deleted successfully');
    } catch (error) {
      console.error("Error deleting mistake:", error);
      alert('Failed to delete');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} mistakes?`)) return;
    
    try {
      await api.post('/errors/batch-delete', { ids: selectedIds });
      setMistakes(mistakes.filter(m => !selectedIds.includes(m.id)));
      setSelectedIds([]);
      if (selectedMistake && selectedIds.includes(selectedMistake.id)) {
        setSelectedMistake(null);
      }
      alert('Batch delete successful');
    } catch (error) {
      console.error("Error batch deleting:", error);
      alert('Failed to batch delete');
    }
  };

  const handleSave = async () => {
    if (!selectedMistake) return;
    setSaving(true);
    try {
      const res = await api.put(`/errors/${selectedMistake.id}`, {
        content: editContent,
        note: editNote
      });
      
      // Update local state
      setMistakes(mistakes.map(m => m.id === selectedMistake.id ? res.data : m));
      setSelectedMistake(res.data);
      alert('Saved successfully!');
    } catch (error) {
      console.error("Error saving mistake:", error);
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const insertText = (elementId, value, setValue, before, after = '') => {
    const textarea = document.getElementById(elementId);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    const newText = text.substring(0, start) + before + text.substring(start, end) + after + text.substring(end);
    setValue(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        View Error Book
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Subject</InputLabel>
              <Select
                value={selectedSubject}
                label="Subject"
                onChange={handleSubjectChange}
              >
                <MenuItem value={ALL_OPTION}>
                  <em>All</em>
                </MenuItem>
                {availableSubjects.map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth disabled={!selectedSubject || selectedSubject === ALL_OPTION}>
              <InputLabel>Chapter</InputLabel>
              <Select
                value={selectedChapter}
                label="Chapter"
                onChange={handleChapterChange}
              >
                <MenuItem value={ALL_OPTION}>
                  <em>All</em>
                </MenuItem>
                {availableChapters.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth disabled={!selectedChapter || selectedChapter === ALL_OPTION}>
              <InputLabel>Knowledge Points</InputLabel>
              <Select
                multiple
                value={selectedKnowledgePoints}
                onChange={(e) => {
                  const value = e.target.value;
                  const newValue = typeof value === 'string' ? value.split(',') : value;
                  // If "All" is selected, clear other selections and only keep "All"
                  if (newValue.includes(ALL_OPTION)) {
                    setSelectedKnowledgePoints([ALL_OPTION]);
                  } else {
                    setSelectedKnowledgePoints(newValue);
                  }
                }}
                input={<OutlinedInput label="Knowledge Points" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      if (value === ALL_OPTION) {
                        return <Chip key={value} label="All" color="primary" />;
                      }
                      return <Chip key={value} label={value} />;
                    })}
                  </Box>
                )}
              >
                <MenuItem value={ALL_OPTION}>
                  <em>All</em>
                </MenuItem>
                {availableKnowledgePoints.map((kp) => (
                  <MenuItem key={kp} value={kp}>
                    {kp}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button 
              variant="contained" 
              fullWidth 
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Search"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Results Table */}
      {hasSearched && (
        <Paper sx={{ mb: 3 }}>
          {selectedIds.length > 0 && (
            <Box sx={{ p: 2, bgcolor: '#ffebee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" color="error">
                {selectedIds.length} selected
              </Typography>
              <Button 
                variant="contained" 
                color="error" 
                startIcon={<DeleteIcon />}
                onClick={handleBatchDelete}
              >
                Batch Delete
              </Button>
            </Box>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedIds.length > 0 && selectedIds.length < mistakes.length}
                      checked={mistakes.length > 0 && selectedIds.length === mistakes.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Content</TableCell>
                  <TableCell>Note</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mistakes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">No mistakes found.</TableCell>
                  </TableRow>
                ) : (
                  mistakes.map((mistake) => {
                    const isItemSelected = selectedIds.indexOf(mistake.id) !== -1;
                    return (
                      <TableRow 
                        key={mistake.id} 
                        hover 
                        onClick={() => handleRowClick(mistake)}
                        selected={selectedMistake?.id === mistake.id}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isItemSelected}
                            onClick={(event) => handleSelectOne(event, mistake.id)}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mistake.content}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mistake.note}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Detail/Edit View */}
      {selectedMistake && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Mistake Details
          </Typography>
          
          <Grid container spacing={3}>
            {/* Content Section */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1">Content</Typography>
                    <ButtonGroup size="small">
                      <Tooltip title="Bold"><IconButton onClick={() => insertText('content-editor', editContent, setEditContent, '**', '**')}><FormatBold /></IconButton></Tooltip>
                      <Tooltip title="Italic"><IconButton onClick={() => insertText('content-editor', editContent, setEditContent, '*', '*')}><FormatItalic /></IconButton></Tooltip>
                      <Tooltip title="Heading"><IconButton onClick={() => insertText('content-editor', editContent, setEditContent, '### ')}><FormatSize /></IconButton></Tooltip>
                      <Tooltip title="Inline Math"><IconButton onClick={() => insertText('content-editor', editContent, setEditContent, '$', '$')}><Code /></IconButton></Tooltip>
                      <Tooltip title="Block Math"><IconButton onClick={() => insertText('content-editor', editContent, setEditContent, '$$', '$$')}><Code /></IconButton></Tooltip>
                    </ButtonGroup>
                  </Box>
                  {selectedMistake.graph_1 && (() => {
                    // Handle both old format (uploads/mistakes/xxx.jpg) and new format (mistakes/xxx.jpg)
                    const imagePath = selectedMistake.graph_1.startsWith('uploads/') 
                      ? selectedMistake.graph_1.substring(8) 
                      : selectedMistake.graph_1;
                    return (
                      <Box sx={{ mb: 2 }}>
                        <img 
                          src={`/api/uploads/${imagePath}`} 
                          alt="Mistake" 
                          style={{ maxWidth: '100%', maxHeight: 300 }} 
                          onError={(e) => {
                            console.error('Failed to load image:', selectedMistake.graph_1);
                            console.error('Processed path:', imagePath);
                            console.error('Attempted URL:', e.target.src);
                            e.target.style.display = 'none';
                          }}
                        />
                      </Box>
                    );
                  })()}
                  <TextField
                    id="content-editor"
                    fullWidth
                    multiline
                    rows={8}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    label="Edit Content"
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="subtitle2" color="text.secondary">Preview:</Typography>
                  <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderRadius: 1, minHeight: 100, maxHeight: 300, overflow: 'auto' }}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {editContent}
                    </ReactMarkdown>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Note Section */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1">Note</Typography>
                    <ButtonGroup size="small">
                      <Tooltip title="Bold"><IconButton onClick={() => insertText('note-editor', editNote, setEditNote, '**', '**')}><FormatBold /></IconButton></Tooltip>
                      <Tooltip title="Italic"><IconButton onClick={() => insertText('note-editor', editNote, setEditNote, '*', '*')}><FormatItalic /></IconButton></Tooltip>
                      <Tooltip title="Heading"><IconButton onClick={() => insertText('note-editor', editNote, setEditNote, '### ')}><FormatSize /></IconButton></Tooltip>
                      <Tooltip title="Inline Math"><IconButton onClick={() => insertText('note-editor', editNote, setEditNote, '$', '$')}><Code /></IconButton></Tooltip>
                      <Tooltip title="Block Math"><IconButton onClick={() => insertText('note-editor', editNote, setEditNote, '$$', '$$')}><Code /></IconButton></Tooltip>
                    </ButtonGroup>
                  </Box>
                  {selectedMistake.graph_2 && (() => {
                    // Handle both old format (uploads/mistakes/xxx.jpg) and new format (mistakes/xxx.jpg)
                    const imagePath = selectedMistake.graph_2.startsWith('uploads/') 
                      ? selectedMistake.graph_2.substring(8) 
                      : selectedMistake.graph_2;
                    return (
                      <Box sx={{ mb: 2 }}>
                        <img 
                          src={`/api/uploads/${imagePath}`} 
                          alt="Analysis" 
                          style={{ maxWidth: '100%', maxHeight: 300 }} 
                          onError={(e) => {
                            console.error('Failed to load image:', selectedMistake.graph_2);
                            console.error('Processed path:', imagePath);
                            console.error('Attempted URL:', e.target.src);
                            e.target.style.display = 'none';
                          }}
                        />
                      </Box>
                    );
                  })()}
                  <TextField
                    id="note-editor"
                    fullWidth
                    multiline
                    rows={8}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    label="Edit Note"
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="subtitle2" color="text.secondary">Preview:</Typography>
                  <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderRadius: 1, minHeight: 100, maxHeight: 300, overflow: 'auto' }}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {editNote}
                    </ReactMarkdown>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button 
              variant="outlined" 
              color="error"
              startIcon={<DeleteIcon />} 
              onClick={handleDelete}
            >
              Delete Mistake
            </Button>
            <Button 
              variant="contained" 
              startIcon={<SaveIcon />} 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
