import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Paper, Grid, CircularProgress, Card, CardContent, 
  Chip, Divider, TextField, ButtonGroup, IconButton, Tooltip, Dialog, DialogContent,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, FormatBold, FormatItalic, FormatSize, Code, Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ErrorBook() {
  // Data State
  const [studentInfo, setStudentInfo] = useState(null);
  const [knowledgeTags, setKnowledgeTags] = useState([]);
  
  // Selection State
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState([]);
  const [customKnowledgePoint, setCustomKnowledgePoint] = useState('');
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [title, setTitle] = useState('');
  
  // File State
  const [file, setFile] = useState(null); // graph_1 (Mistake Image)
  const [previewUrl, setPreviewUrl] = useState(null);
  const [studentFile, setStudentFile] = useState(null); // graph_2 (Analysis/Solution Image)
  const [studentPreviewUrl, setStudentPreviewUrl] = useState(null);

  // Content State
  const [ocrText, setOcrText] = useState(''); // content
  const [editableAnalysis, setEditableAnalysis] = useState(''); // note
  
  // Loading State
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Image Zoom State
  const [zoomImage, setZoomImage] = useState(null);

  // Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infoRes, tagsRes] = await Promise.all([
          api.get('/auth/student/info'),
          api.get('/errors/knowledge-tags')
        ]);
        setStudentInfo(infoRes.data);
        setKnowledgeTags(tagsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
    // Poll for knowledge tags updates every 1 minute
    const intervalId = setInterval(async () => {
      try {
        const tagsRes = await api.get('/errors/knowledge-tags');
        setKnowledgeTags(tagsRes.data);
      } catch (error) {
        console.error("Error polling knowledge tags:", error);
      }
    }, 60000);

    return () => clearInterval(intervalId);  }, []);

  // Derived Options - Remove duplicates from subjects
  const availableSubjects = React.useMemo(() => {
    if (!studentInfo?.teachers) return [];
    const subjects = studentInfo.teachers.map(t => t.subject).filter(Boolean);
    return [...new Set(subjects)]; // Remove duplicates
  }, [studentInfo]);
  
  const availableChapters = React.useMemo(() => {
    if (!selectedSubject || !studentInfo) return [];
    
    // Find ALL teachers for the selected subject
    // This handles cases where a student might have multiple teachers for a subject
    const matchingTeachers = studentInfo.teachers.filter(t => t.subject === selectedSubject);
    if (matchingTeachers.length === 0) return [];
    
    const teacherIds = matchingTeachers.map(t => Number(t.id));
    
    // Filter tags by teacher IDs and subject
    const tags = knowledgeTags.filter(t => 
      t.subject === selectedSubject && 
      teacherIds.includes(Number(t.teacher_id))
    );
    
    // Extract unique chapters
    return [...new Set(tags.map(t => t.chapter).filter(Boolean))];
  }, [selectedSubject, studentInfo, knowledgeTags]);

  const availableKnowledgePoints = React.useMemo(() => {
    if (!selectedSubject || !selectedChapter || !studentInfo) return [];
    
    const matchingTeachers = studentInfo.teachers.filter(t => t.subject === selectedSubject);
    if (matchingTeachers.length === 0) return [];
    
    const teacherIds = matchingTeachers.map(t => Number(t.id));
    
    const tags = knowledgeTags.filter(t => 
      t.subject === selectedSubject && 
      t.chapter === selectedChapter &&
      teacherIds.includes(Number(t.teacher_id))
    );
    return [...new Set(tags.map(t => t.knowledge_point).filter(Boolean))];
  }, [selectedSubject, selectedChapter, studentInfo, knowledgeTags]);

  // Handlers
  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
    setSelectedChapter('');
    setSelectedKnowledgePoints([]);
    setIsOtherSelected(false);
    setCustomKnowledgePoint('');
  };

  const handleChapterChange = (e) => {
    setSelectedChapter(e.target.value);
    setSelectedKnowledgePoints([]);
    setIsOtherSelected(false);
    setCustomKnowledgePoint('');
  };

  const handleKnowledgePointChange = (event) => {
    const {
      target: { value },
    } = event;
    
    const selectedValues = typeof value === 'string' ? value.split(',') : value;
    
    // Check if "Other" is selected
    const otherIndex = selectedValues.indexOf('__OTHER__');
    const hasOther = otherIndex !== -1;
    
    setIsOtherSelected(hasOther);
    
    // Filter out __OTHER__ from the main selection list to keep it clean, 
    // or keep it to show the chip. Let's keep it but handle display.
    setSelectedKnowledgePoints(selectedValues);
  };

  const performOCR = async (selectedFile) => {
    setOcrLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await api.post('/errors/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setOcrText(response.data.text);
    } catch (error) {
      console.error('Error performing OCR:', error);
      alert('OCR failed. Please try again.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      performOCR(selectedFile);
    }
  };

  const handleStudentFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setStudentFile(selectedFile);
      setStudentPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleAnalyze = async () => {
    if (!ocrText) return;
    setLoading(true);
    try {
      const response = await api.post('/errors/analyze', { text: ocrText });
      // Initialize editable analysis with the result
      setEditableAnalysis(response.data.analysis.explanation || response.data.analysis);
    } catch (error) {
      console.error('Error analyzing problem:', error);
      alert('Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!file || !selectedSubject) {
      alert("Please select a subject and upload a mistake image.");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append('subject', selectedSubject);
    formData.append('chapter', selectedChapter);
    formData.append('title', title);
    
    // Combine standard points and custom point
    let finalKnowledgePoints = selectedKnowledgePoints.filter(kp => kp !== '__OTHER__');
    if (isOtherSelected && customKnowledgePoint.trim()) {
      finalKnowledgePoints.push(customKnowledgePoint.trim());
    }
    
    formData.append('knowledge_point', JSON.stringify(finalKnowledgePoints));
    formData.append('content', ocrText);
    formData.append('note', editableAnalysis);
    formData.append('date', new Date().toISOString());
    formData.append('graph_1', file);
    if (studentFile) {
      formData.append('graph_2', studentFile);
    }

    try {
      await api.post('/errors/mistakes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert("Mistake saved successfully!");
      // Reset form?
    } catch (error) {
      console.error("Error saving mistake:", error);
      alert("Failed to save mistake.");
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
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold', color: '#1a237e' }}>
        智能错题本
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column: Inputs */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>1. 题目信息</Typography>
            
            {/* Selectors */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="标题 (Title)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="若不填，将自动使用知识点作为标题"
                  helperText="可选：为这道错题起个名字"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>学科 (Subject)</InputLabel>
                  <Select
                    value={selectedSubject}
                    label="学科 (Subject)"
                    onChange={handleSubjectChange}
                  >
                    {availableSubjects.map((sub) => (
                      <MenuItem key={sub} value={sub}>{sub}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth disabled={!selectedSubject}>
                  <InputLabel>章节 (Chapter)</InputLabel>
                  <Select
                    value={selectedChapter}
                    label="章节 (Chapter)"
                    onChange={handleChapterChange}
                  >
                    {availableChapters.map((chap) => (
                      <MenuItem key={chap} value={chap}>{chap}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth disabled={!selectedChapter}>
                  <InputLabel>知识点 (Knowledge Points)</InputLabel>
                  <Select
                    multiple
                    value={selectedKnowledgePoints}
                    onChange={handleKnowledgePointChange}
                    input={<OutlinedInput label="知识点 (Knowledge Points)" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          if (value === '__OTHER__') return <Chip key={value} label="其他 (Other)" color="primary" variant="outlined" />;
                          return <Chip key={value} label={value} />;
                        })}
                      </Box>
                    )}
                  >
                    {availableKnowledgePoints.map((kp) => (
                      <MenuItem key={kp} value={kp}>{kp}</MenuItem>
                    ))}
                    <MenuItem value="__OTHER__" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                      + 其他 (Other)
                    </MenuItem>
                  </Select>
                </FormControl>
                {isOtherSelected && (
                  <TextField
                    fullWidth
                    size="small"
                    label="请输入自定义知识点"
                    value={customKnowledgePoint}
                    onChange={(e) => setCustomKnowledgePoint(e.target.value)}
                    sx={{ mt: 2 }}
                    placeholder="例如：自定义考点A"
                  />
                )}
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Image Uploads */}
            <Box sx={{ mb: 3 }}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="mistake-file-upload"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="mistake-file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  sx={{ mb: 2, height: 56 }}
                >
                  上传错题图片 (必填)
                </Button>
              </label>
              {previewUrl && (
                <Box 
                  sx={{ 
                    mt: 2, 
                    border: '1px dashed #ccc', 
                    borderRadius: 1, 
                    p: 1,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.9 }
                  }}
                  onClick={() => setZoomImage(previewUrl)}
                >
                  <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} />
                </Box>
              )}
            </Box>

            <Box sx={{ mb: 3 }}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="analysis-file-upload"
                type="file"
                onChange={handleStudentFileChange}
              />
              <label htmlFor="analysis-file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  sx={{ mb: 2, height: 56 }}
                >
                  上传解析图片 (选填)
                </Button>
              </label>
              {studentPreviewUrl && (
                <Box 
                  sx={{ 
                    mt: 2, 
                    border: '1px dashed #ccc', 
                    borderRadius: 1, 
                    p: 1,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.9 }
                  }}
                  onClick={() => setZoomImage(studentPreviewUrl)}
                >
                  <img src={studentPreviewUrl} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} />
                </Box>
              )}
            </Box>
          </Paper>

          <Paper elevation={3} sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">2. 识别结果 (OCR)</Typography>
              <ButtonGroup size="small">
                <Tooltip title="Bold"><IconButton onClick={() => insertText('ocr-editor', ocrText, setOcrText, '**', '**')}><FormatBold /></IconButton></Tooltip>
                <Tooltip title="Italic"><IconButton onClick={() => insertText('ocr-editor', ocrText, setOcrText, '*', '*')}><FormatItalic /></IconButton></Tooltip>
                <Tooltip title="Heading"><IconButton onClick={() => insertText('ocr-editor', ocrText, setOcrText, '### ')}><FormatSize /></IconButton></Tooltip>
                <Tooltip title="Inline Math"><IconButton onClick={() => insertText('ocr-editor', ocrText, setOcrText, '$', '$')}><Code /></IconButton></Tooltip>
                <Tooltip title="Block Math"><IconButton onClick={() => insertText('ocr-editor', ocrText, setOcrText, '$$', '$$')}><Code /></IconButton></Tooltip>
              </ButtonGroup>
            </Box>
            {ocrLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TextField
                  id="ocr-editor"
                  fullWidth
                  multiline
                  rows={6}
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  placeholder="OCR识别的文本将显示在这里..."
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>预览:</Typography>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, minHeight: 100, maxHeight: 300, overflow: 'auto' }}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {ocrText || '(预览区域)'}
                  </ReactMarkdown>
                </Box>
              </>
            )}
            <Button
              variant="contained"
              fullWidth
              onClick={handleAnalyze}
              disabled={!ocrText || loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'AI 分析题目'}
            </Button>
          </Paper>
        </Grid>

        {/* Right Column: Analysis & Save */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">3. 智能解析 (Note)</Typography>
              <ButtonGroup size="small">
                <Tooltip title="Bold"><IconButton onClick={() => insertText('analysis-editor', editableAnalysis, setEditableAnalysis, '**', '**')}><FormatBold /></IconButton></Tooltip>
                <Tooltip title="Italic"><IconButton onClick={() => insertText('analysis-editor', editableAnalysis, setEditableAnalysis, '*', '*')}><FormatItalic /></IconButton></Tooltip>
                <Tooltip title="Heading"><IconButton onClick={() => insertText('analysis-editor', editableAnalysis, setEditableAnalysis, '### ')}><FormatSize /></IconButton></Tooltip>
                <Tooltip title="Inline Math"><IconButton onClick={() => insertText('analysis-editor', editableAnalysis, setEditableAnalysis, '$', '$')}><Code /></IconButton></Tooltip>
                <Tooltip title="Block Math"><IconButton onClick={() => insertText('analysis-editor', editableAnalysis, setEditableAnalysis, '$$', '$$')}><Code /></IconButton></Tooltip>
              </ButtonGroup>
            </Box>
            
            <TextField
              id="analysis-editor"
              fullWidth
              multiline
              rows={15}
              value={editableAnalysis}
              onChange={(e) => setEditableAnalysis(e.target.value)}
              placeholder="AI生成的解析将显示在这里，支持Markdown和LaTeX..."
              variant="outlined"
              sx={{ mb: 2, flexGrow: 1 }}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.secondary' }}>
              预览:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, minHeight: 100, bgcolor: '#f8f9fa', maxHeight: 300, overflow: 'auto' }}>
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {editableAnalysis}
              </ReactMarkdown>
            </Paper>

            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ mt: 3 }}
            >
              {saving ? '保存中...' : '保存到错题本'}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Image Zoom Dialog */}
      <Dialog
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0, position: 'relative', bgcolor: 'black', display: 'flex', justifyContent: 'center' }}>
          <IconButton
            onClick={() => setZoomImage(null)}
            sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
          <img 
            src={zoomImage} 
            alt="Zoomed" 
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} 
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

