import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from "@mui/material";
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Delete as DeleteIcon
} from "@mui/icons-material";
import api from "../services/api";

export default function Syllabus() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Single Add State
  const [newChapter, setNewChapter] = useState("");
  const [newKnowledgePoint, setNewKnowledgePoint] = useState("");
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Filter State
  const [filterChapter, setFilterChapter] = useState("All");
  const [filterKnowledgePoint, setFilterKnowledgePoint] = useState("All");
  
  // Duplicate Warning
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async (refresh = false) => {
    setLoading(true);
    try {
      const response = await api.get(`/syllabus/tags?refresh=${refresh}`);
      setTags(response.data);
      // Reset filters if current selection no longer exists? Maybe keep them.
    } catch (error) {
      console.error("Error fetching tags:", error);
      alert("Failed to load tags.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (window.confirm("Refreshing will discard unsaved changes. Continue?")) {
      fetchTags(true);
    }
  };

  const handleSave = async () => {
    if (!window.confirm("This will overwrite the database with current list. Continue?")) return;
    
    setSaving(true);
    try {
      await api.post("/syllabus/tags/save", tags);
      alert("Saved successfully!");
      fetchTags(true); // Refresh to ensure sync
    } catch (error) {
      console.error("Error saving tags:", error);
      alert("Failed to save tags.");
    } finally {
      setSaving(false);
    }
  };

  const handleSingleAdd = () => {
    if (!newChapter.trim() || !newKnowledgePoint.trim()) {
      alert("Please fill in both Chapter and Knowledge Point");
      return;
    }
    
    // Check duplicate
    const exists = tags.some(
      t => t.chapter === newChapter.trim() && t.knowledge_point === newKnowledgePoint.trim()
    );
    
    if (exists) {
      alert("This tag already exists!");
      return;
    }
    
    const newTag = {
      id: `temp-${Date.now()}`, // Temp ID
      chapter: newChapter.trim(),
      knowledge_point: newKnowledgePoint.trim()
    };
    
    setTags([...tags, newTag]);
    setNewChapter("");
    setNewKnowledgePoint("");
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await api.post("/syllabus/import/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const importedTags = response.data;
      const newTags = [];
      const duplicates = [];
      
      importedTags.forEach(item => {
        // Check against current tags (including unsaved ones)
        const exists = tags.some(
          t => t.chapter === item.chapter && t.knowledge_point === item.knowledge_point
        ) || newTags.some(
          t => t.chapter === item.chapter && t.knowledge_point === item.knowledge_point
        );
        
        if (exists) {
          duplicates.push(`${item.chapter} - ${item.knowledge_point}`);
        } else {
          newTags.push({
            id: `temp-${Date.now()}-${Math.random()}`,
            chapter: item.chapter,
            knowledge_point: item.knowledge_point
          });
        }
      });
      
      if (duplicates.length > 0) {
        setDuplicateWarning(`Skipped ${duplicates.length} duplicates:\n${duplicates.slice(0, 5).join("\n")}${duplicates.length > 5 ? "\n..." : ""}`);
      } else {
        setDuplicateWarning(null);
      }
      
      if (newTags.length > 0) {
        setTags([...tags, ...newTags]);
        alert(`Imported ${newTags.length} tags.`);
      } else if (duplicates.length === 0) {
        alert("No tags found in file.");
      }
      
    } catch (error) {
      console.error("Error importing file:", error);
      alert(error.response?.data?.detail || "Import failed");
    }
    
    // Reset input
    event.target.value = null;
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected tags?`)) return;
    
    setTags(tags.filter(t => !selectedIds.includes(t.id)));
    setSelectedIds([]);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedIds(filteredTags.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Filtering Logic
  const uniqueChapters = ["All", ...new Set(tags.map(t => t.chapter))];
  const uniqueKnowledgePoints = ["All", ...new Set(tags.filter(t => filterChapter === "All" || t.chapter === filterChapter).map(t => t.knowledge_point))];

  const filteredTags = tags.filter(t => {
    const matchChapter = filterChapter === "All" || t.chapter === filterChapter;
    const matchPoint = filterKnowledgePoint === "All" || t.knowledge_point === filterKnowledgePoint;
    return matchChapter && matchPoint;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Knowledge Syllabus Manager</Typography>
      
      {/* Actions Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={handleRefresh}
            >
              Refresh (Discard Changes)
            </Button>
          </Grid>
          <Grid item>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />} 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Confirm & Save to DB"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Add Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Single Add */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Add Single Tag</Typography>
            <Box display="flex" gap={2} flexDirection="column">
              <TextField 
                label="Chapter" 
                value={newChapter} 
                onChange={(e) => setNewChapter(e.target.value)} 
                fullWidth 
              />
              <TextField 
                label="Knowledge Point" 
                value={newKnowledgePoint} 
                onChange={(e) => setNewKnowledgePoint(e.target.value)} 
                fullWidth 
              />
              <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={handleSingleAdd}
              >
                Add
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Batch Import */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Batch Import (Excel)</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload .xlsx file with headers: <strong>chapter</strong>, <strong>knowledge_point</strong>
            </Typography>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ height: 56 }}
            >
              Upload Excel File
              <input type="file" hidden onChange={handleFileUpload} accept=".xlsx, .xls" />
            </Button>
            {duplicateWarning && (
              <Alert severity="warning" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                {duplicateWarning}
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Display & Filter Section */}
      <Paper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
          <Box display="flex" gap={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter Chapter</InputLabel>
              <Select
                value={filterChapter}
                label="Filter Chapter"
                onChange={(e) => {
                  setFilterChapter(e.target.value);
                  setFilterKnowledgePoint("All"); // Reset point filter
                }}
              >
                {uniqueChapters.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter Point</InputLabel>
              <Select
                value={filterKnowledgePoint}
                label="Filter Point"
                onChange={(e) => setFilterKnowledgePoint(e.target.value)}
              >
                {uniqueKnowledgePoints.map(p => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          <Button 
            variant="contained" 
            color="error" 
            startIcon={<DeleteIcon />} 
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0}
          >
            Delete Selected ({selectedIds.length})
          </Button>
        </Box>

        <TableContainer sx={{ maxHeight: 500 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedIds.length > 0 && selectedIds.length < filteredTags.length}
                    checked={filteredTags.length > 0 && selectedIds.length === filteredTags.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Chapter</TableCell>
                <TableCell>Knowledge Point</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} align="center"><CircularProgress /></TableCell>
                </TableRow>
              ) : filteredTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">No tags found</TableCell>
                </TableRow>
              ) : (
                filteredTags.map((tag) => (
                  <TableRow key={tag.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.includes(tag.id)}
                        onChange={() => handleSelectOne(tag.id)}
                      />
                    </TableCell>
                    <TableCell>{tag.chapter}</TableCell>
                    <TableCell>{tag.knowledge_point}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
          Total: {tags.length} | Displayed: {filteredTags.length}
        </Typography>
      </Paper>
    </Box>
  );
}





