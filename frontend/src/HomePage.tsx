import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Chip,
  Typography,
  Paper,
  Autocomplete,
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
  createTheme,
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Close as CloseIcon, 
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  ClearAll as ClearAllIcon,
  SearchOff as SearchOffIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridSortModel } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { staticDataService, LiveShow, SongAnalysis } from './services/staticDataService';
import LanguageSwitcher from './components/LanguageSwitcher';

interface SearchTag {
  id: number;
  label: string;
}

interface SavedShows {
  shows: SearchTag[];
  timestamp: number;
}

// 本地存储相关常量和函数
const STORAGE_KEY = 'nana-selected-shows';
const EXPIRY_DAYS = 7;

const saveSelectedShows = (shows: SearchTag[]) => {
  const data: SavedShows = {
    shows,
    timestamp: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const loadSelectedShows = (): { shows: SearchTag[]; isRestored: boolean } => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { shows: [], isRestored: false };
    
    const data: SavedShows = JSON.parse(saved);
    const isExpired = Date.now() - data.timestamp > EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    if (isExpired) {
      localStorage.removeItem(STORAGE_KEY);
      return { shows: [], isRestored: false };
    }
    
    return { shows: data.shows, isRestored: data.shows.length > 0 };
  } catch (error) {
    console.error('Failed to load saved shows:', error);
    return { shows: [], isRestored: false };
  }
};

const clearSavedShows = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  
  // 状态定义
  const [availableShows, setAvailableShows] = useState<LiveShow[]>([]);
  const [songAnalysis, setSongAnalysis] = useState<SongAnalysis[]>([]);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(true); // 默认黑暗模式
  
  // 自动完成相关状态
  const [searchText, setSearchText] = useState<string>('');
  const [selectedShows, setSelectedShows] = useState<SearchTag[]>([]);
  const [autoCompleteLoading, setAutoCompleteLoading] = useState<boolean>(false);
  
  // 恢复状态相关
  const [showRestoredMessage, setShowRestoredMessage] = useState<boolean>(false);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [isReverseAnalysis, setIsReverseAnalysis] = useState<boolean>(false);
  
  // 确认对话框状态
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // 初始化时加载保存的选择
  useEffect(() => {
    const { shows, isRestored } = loadSelectedShows();
    if (isRestored) {
      setSelectedShows(shows);
      setShowRestoredMessage(true);
    }
  }, []);

  // 创建主题
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: darkMode ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: darkMode ? '#f48fb1' : '#dc004e',
      },
      background: {
        default: darkMode ? '#0a0a0a' : '#fafafa',
        paper: darkMode ? '#1a1a1a' : '#ffffff',
      },
    },
    typography: {
      fontFamily: [
        'Inter',
        'Noto Sans SC',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
      h4: {
        fontWeight: 600,
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 500,
      },
    },
  });

  // 获取演出列表（自动完成用）
  const fetchShows = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setAvailableShows([]);
        return;
      }

      setAutoCompleteLoading(true);
      try {
        const shows = await staticDataService.searchShows(query);
        setAvailableShows(shows);
      } catch (err) {
        console.error('Failed to fetch shows:', err);
      } finally {
        setAutoCompleteLoading(false);
      }
    },
    []
  );

  // 防抖搜索
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchShows(searchText);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchText, fetchShows]);

  // 添加演出标签
  const handleAddShow = (show: LiveShow | null) => {
    if (show && !selectedShows.find(s => s.id === show.id)) {
      setSelectedShows(prev => [...prev, {
        id: show.id,
        label: show.performance_name
      }]);
      // 清空搜索框，方便下一次输入
      setSearchText('');
    }
  };

  // 移除演出标签
  const handleRemoveShow = (showId: number) => {
    setSelectedShows(prev => prev.filter(s => s.id !== showId));
  };

  // 显示清除确认对话框
  const handleClearAllClick = () => {
    setShowClearConfirm(true);
  };

  // 确认清除所有选择
  const handleClearAllConfirm = () => {
    setSelectedShows([]);
    clearSavedShows();
    setSongAnalysis([]);
    setCompletionRate(0);
    setHasAnalyzed(false);
    setIsReverseAnalysis(false);
    setShowClearConfirm(false);
  };

  // 取消清除
  const handleClearAllCancel = () => {
    setShowClearConfirm(false);
  };

  // 执行分析
  const handleAnalyze = async () => {
    if (selectedShows.length === 0) {
      setError(t('errors.noShows'));
      return;
    }

    setLoading(true);
    setError(null);
    setIsReverseAnalysis(false);

    // 重置排序为按次数降序
    setSortModel([{
      field: 'hit_count',
      sort: 'desc'
    }]);

    try {
      const showIds = selectedShows.map(s => s.id);
      const result = await staticDataService.analyzeSongs(showIds);

      setSongAnalysis(result.songs);
      setCompletionRate(result.completion_rate);
      setHasAnalyzed(true);
      
      // 只在分析成功后保存选择
      saveSelectedShows(selectedShows);
    } catch (err) {
      setError(t('errors.analysisFailed'));
      console.error('Analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 执行反向分析
  const handleReverseAnalyze = async () => {
    if (selectedShows.length === 0) {
      setError(t('errors.noShows'));
      return;
    }

    setLoading(true);
    setError(null);
    setIsReverseAnalysis(true);

    // 重置排序为按选出率降序
    setSortModel([{
      field: 'selection_rate',
      sort: 'desc'
    }]);

    try {
      const showIds = selectedShows.map(s => s.id);
      const result = await staticDataService.analyzeReverseSongs(showIds);

      setSongAnalysis(result.songs);
      setCompletionRate(result.completion_rate);
      setHasAnalyzed(true);
      
      // 只在分析成功后保存选择
      saveSelectedShows(selectedShows);
    } catch (err) {
      setError(t('errors.reverseAnalysisFailed'));
      console.error('Reverse analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 数据表格列定义
  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 60,
      type: 'number'
    },
    {
      field: 'song_name',
      headerName: t('table.songName'),
      width: 250,
      minWidth: 200
    },
    {
      field: 'hit_count',
      headerName: t('table.hitCount'),
      width: 80,
      type: 'number',
      sortable: true
    },
    {
      field: 'total_appearances',
      headerName: t('table.totalAppearances'),
      width: 100,
      type: 'number',
      sortable: true
    },
    {
      field: 'selection_rate',
      headerName: t('table.selectionRate'),
      width: 100,
      type: 'number',
      renderCell: (params: any) => {
        const rate = params.value || params.row?.selection_rate;
        
        if (rate == null || isNaN(Number(rate))) {
          return '0.0%';
        }
        const percentage = (Number(rate) * 100).toFixed(1);
        return `${percentage}%`;
      },
      sortable: true
    },
    {
      field: 'latest_performance',
      headerName: t('table.latestPerformance'),
      width: 400,
      minWidth: 300,
      flex: 1
    },
    {
      field: 'latest_venue',
      headerName: t('table.latestVenue'),
      width: 150,
      minWidth: 120
    }
  ];

  // 默认排序设置
  const [sortModel, setSortModel] = useState<GridSortModel>([
    {
      field: 'hit_count',
      sort: 'desc'
    }
  ]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* 顶部工具栏 */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          </Typography>
          
          <LanguageSwitcher />
          
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                color="default"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {darkMode ? <DarkModeIcon /> : <LightModeIcon />}
              </Box>
            }
            sx={{ ml: 2 }}
          />
        </Toolbar>
      </AppBar>

    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* 主标题 */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          
        </Typography>
        <Typography variant="h6" color="text.secondary">
          
        </Typography>
      </Box>

      {/* 搜索区域 */}
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 搜索框 */}
          <Autocomplete
            options={availableShows}
            getOptionLabel={(option) => option.performance_name}
            loading={autoCompleteLoading}
            value={null}
            inputValue={searchText}
            onInputChange={(_, newValue) => setSearchText(newValue)}
            onChange={(_, newValue) => handleAddShow(newValue)}
            clearOnBlur
            clearOnEscape
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('search.placeholder')}
                fullWidth
                variant="outlined"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: (
                    <>
                      {autoCompleteLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box key={key} {...otherProps} component="li">
                  <Box>
                    <Typography variant="body1" noWrap>
                      {option.performance_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.date} • {option.venue}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
            noOptionsText={t('search.noResults')}
          />

          {/* 已选择的演出标签 */}
          {selectedShows.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedShows.map((show) => (
                <Chip
                  key={show.id}
                  label={show.label}
                  onDelete={() => handleRemoveShow(show.id)}
                  deleteIcon={<CloseIcon />}
                  color="primary"
                  variant="outlined"
                  sx={{ 
                    maxWidth: '100%',
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '500px'
                    }
                  }}
                />
              ))}
            </Box>
          )}

          {/* 分析按钮 */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleAnalyze}
              disabled={selectedShows.length === 0 || loading}
              startIcon={loading && !isReverseAnalysis ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
              sx={{ minWidth: 120 }}
            >
              {loading && !isReverseAnalysis ? t('analysis.loading') : t('analysis.button')}
            </Button>
            
            <Button
              variant="contained"
              size="large"
              onClick={handleReverseAnalyze}
              disabled={selectedShows.length === 0 || loading}
              startIcon={loading && isReverseAnalysis ? <CircularProgress size={20} color="inherit" /> : <SearchOffIcon />}
              color="secondary"
              sx={{ minWidth: 120 }}
            >
              {loading && isReverseAnalysis ? t('analysis.loading') : t('analysis.reverse')}
            </Button>
            
            {/* 清除按钮（移动端友好） */}
            {selectedShows.length > 0 && (
              <Button
                variant="outlined"
                size="large"
                onClick={handleClearAllClick}
                startIcon={<ClearAllIcon />}
                color="inherit"
              >
                {t('search.clear')}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 恢复选择提示 */}
      <Snackbar
        open={showRestoredMessage}
        autoHideDuration={6000}
        onClose={() => setShowRestoredMessage(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowRestoredMessage(false)} 
          severity="info" 
          sx={{ width: '100%' }}
        >
          {t('search.restored')} ({selectedShows.length})
        </Alert>
      </Snackbar>

      {/* 结果区域 */}
      {songAnalysis.length > 0 && (
        <Paper elevation={3} sx={{ p: 3 }}>
          {/* 统计信息 */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5" component="h2">
                {isReverseAnalysis ? t('analysis.reverseResultTitle') : t('analysis.resultTitle')}
              </Typography>
              {hasAnalyzed && (
                <Typography variant="caption" color="text.secondary">
                  {isReverseAnalysis 
                    ? t('analysis.reverseSubtitle')
                    : t('analysis.subtitle')
                  }
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h6" color="primary">
                {isReverseAnalysis ? t('analysis.incompletionRate') : t('analysis.completionRate')}: {(completionRate * 100).toFixed(1)}% 
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isReverseAnalysis ? t('analysis.incompletionDescription') : t('analysis.completionDescription')} ({songAnalysis.length} / {Math.round(songAnalysis.length / completionRate)})
              </Typography>
            </Box>
          </Box>

          {/* 数据表格 */}
          <Box sx={{ width: '100%' }}>
            <DataGrid
              rows={songAnalysis}
              columns={columns}
              sortModel={sortModel}
              onSortModelChange={setSortModel}
              hideFooterPagination
              hideFooter
              disableRowSelectionOnClick
              autoHeight
              sx={{
                border: darkMode ? '1px solid #333' : '1px solid #e0e0e0',
                '& .MuiDataGrid-cell': {
                  borderRight: darkMode ? '1px solid #333' : '1px solid #e0e0e0',
                  padding: '8px 16px',
                },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: darkMode ? '#333' : '#f5f5f5',
                  borderBottom: darkMode ? '1px solid #333' : '1px solid #e0e0e0',
                  fontWeight: 'bold',
                },
                '& .MuiDataGrid-row': {
                  '&:hover': {
                    backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                  },
                  '&:nth-of-type(even)': {
                    backgroundColor: darkMode ? '#1a1a1a' : '#fafafa',
                  },
                },
                '& .MuiDataGrid-cell--textLeft': {
                  textAlign: 'left',
                },
                '& .MuiDataGrid-cell--textCenter': {
                  textAlign: 'center',
                },
                '& .MuiDataGrid-virtualScroller': {
                  backgroundColor: darkMode ? '#121212' : '#ffffff',
                },
              }}
            />
          </Box>
        </Paper>
      )}

      {/* 清除确认对话框 */}
      <Dialog
        open={showClearConfirm}
        onClose={handleClearAllCancel}
        aria-labelledby="clear-confirm-dialog-title"
        aria-describedby="clear-confirm-dialog-description"
      >
        <DialogTitle id="clear-confirm-dialog-title">
          {t('search.clearConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-confirm-dialog-description">
            {t('search.clearConfirmMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearAllCancel} color="primary">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleClearAllConfirm} color="error" autoFocus>
            {t('search.clearConfirmButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
    </ThemeProvider>
  );
};

export default HomePage;
