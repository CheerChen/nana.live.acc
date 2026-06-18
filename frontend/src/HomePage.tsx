import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Chip,
  Typography,
  Autocomplete,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  createTheme,
  ThemeProvider,
  CssBaseline,
  GlobalStyles,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  ClearAll as ClearAllIcon,
  SearchOff as SearchOffIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
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

interface ShowGroup {
  groupName: string;
  shows: LiveShow[];
}

type AppMode = 'search' | 'multiSelect';
type SortKey = 'hit_count' | 'total_appearances' | 'selection_rate' | 'song_name';
type SortDir = 'asc' | 'desc';

const STORAGE_KEY = 'nana-selected-shows';
const MODE_STORAGE_KEY = 'nana-app-mode';
const THEME_STORAGE_KEY = 'nana-theme-mode';
const EXPIRY_DAYS = 7;

const MAGENTA = '#E5004F';

const saveSelectedShows = (shows: SearchTag[]) => {
  const data: SavedShows = { shows, timestamp: Date.now() };
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

const clearSavedShows = () => localStorage.removeItem(STORAGE_KEY);

const saveAppMode = (mode: AppMode) => localStorage.setItem(MODE_STORAGE_KEY, mode);

const loadAppMode = (): AppMode => {
  const saved = localStorage.getItem(MODE_STORAGE_KEY);
  return saved === 'multiSelect' ? 'multiSelect' : 'search';
};

const loadThemeMode = (): boolean => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light') return false;
  if (saved === 'dark') return true;
  // Default: light, matching the editorial reference design
  return false;
};

const saveThemeMode = (dark: boolean) => {
  localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
};

const formatDate = (iso: string) => iso.replace(/-/g, '.');
const yearOf = (iso: string) => iso.slice(0, 4);

const HomePage: React.FC = () => {
  const { t } = useTranslation();

  const [availableShows, setAvailableShows] = useState<LiveShow[]>([]);
  const [songAnalysis, setSongAnalysis] = useState<SongAnalysis[]>([]);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [totalSongs, setTotalSongs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(loadThemeMode);

  const [appMode, setAppMode] = useState<AppMode>('search');

  const [searchText, setSearchText] = useState<string>('');
  const [selectedShows, setSelectedShows] = useState<SearchTag[]>([]);
  const [autoCompleteLoading, setAutoCompleteLoading] = useState<boolean>(false);

  const [groupedShows, setGroupedShows] = useState<ShowGroup[]>([]);
  const [multiSelectLoading, setMultiSelectLoading] = useState<boolean>(false);
  const [selectedShowIds, setSelectedShowIds] = useState<Set<number>>(new Set());
  const [groupFilter, setGroupFilter] = useState<string>('');

  const [showRestoredMessage, setShowRestoredMessage] = useState<boolean>(false);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [isReverseAnalysis, setIsReverseAnalysis] = useState<boolean>(false);

  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const [sortKey, setSortKey] = useState<SortKey>('hit_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const { shows, isRestored } = loadSelectedShows();
    const savedMode = loadAppMode();
    if (isRestored) {
      setSelectedShows(shows);
      setShowRestoredMessage(true);
      setSelectedShowIds(new Set(shows.map((s) => s.id)));
    }
    setAppMode(savedMode);
  }, []);

  const loadGroupedShows = useCallback(async () => {
    setMultiSelectLoading(true);
    try {
      const groups = await staticDataService.getGroupedShows();
      setGroupedShows(groups);
    } catch (err) {
      console.error('Failed to load grouped shows:', err);
      setError(t('errors.loadShowsFailed'));
    } finally {
      setMultiSelectLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (appMode === 'multiSelect' && groupedShows.length === 0) {
      loadGroupedShows();
    }
  }, [appMode, groupedShows.length, loadGroupedShows]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: { main: MAGENTA, contrastText: '#FFFFFF' },
          secondary: { main: darkMode ? '#F5F5F5' : '#111111' },
          background: {
            default: darkMode ? '#0E0E10' : '#FAFAFA',
            paper: darkMode ? '#16161A' : '#FFFFFF',
          },
          text: {
            primary: darkMode ? '#F5F5F5' : '#111111',
            secondary: darkMode ? 'rgba(255,255,255,0.62)' : 'rgba(17,17,17,0.6)',
          },
          divider: darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(17,17,17,0.09)',
        },
        shape: { borderRadius: 4 },
        typography: {
          fontFamily: [
            'Inter',
            '"Noto Sans JP"',
            '"Noto Sans SC"',
            '-apple-system',
            'BlinkMacSystemFont',
            'system-ui',
            'sans-serif',
          ].join(','),
          h1: { fontFamily: '"Shippori Mincho", "Noto Serif JP", serif', fontWeight: 600, letterSpacing: '-0.01em' },
          h2: { fontFamily: '"Shippori Mincho", "Noto Serif JP", serif', fontWeight: 600, letterSpacing: '-0.01em' },
          h3: { fontFamily: '"Shippori Mincho", "Noto Serif JP", serif', fontWeight: 600, letterSpacing: '-0.01em' },
          h4: { fontFamily: '"Shippori Mincho", "Noto Serif JP", serif', fontWeight: 600 },
          h5: { fontFamily: '"Shippori Mincho", "Noto Serif JP", serif', fontWeight: 600 },
          overline: { letterSpacing: '0.22em', fontWeight: 600, fontSize: 11 },
        },
        components: {
          MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
          MuiAppBar: { defaultProps: { elevation: 0, color: 'transparent' } },
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
              root: { textTransform: 'none', borderRadius: 4, fontWeight: 500, letterSpacing: '0.02em' },
              sizeLarge: { paddingTop: 10, paddingBottom: 10 },
            },
          },
          MuiChip: { styleOverrides: { root: { borderRadius: 4, fontWeight: 500 } } },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 4,
              },
            },
          },
        },
      }),
    [darkMode],
  );

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    saveAppMode(mode);
    setError(null);
    if (mode === 'multiSelect') {
      setSelectedShowIds(new Set(selectedShows.map((s) => s.id)));
    } else {
      syncMultiSelectToSearch();
    }
  };

  const syncMultiSelectToSearch = () => {
    const next: SearchTag[] = [];
    groupedShows.forEach((group) => {
      group.shows.forEach((show) => {
        if (selectedShowIds.has(show.id)) {
          next.push({ id: show.id, label: show.performance_name });
        }
      });
    });
    setSelectedShows(next);
  };

  const handleShowSelect = (showId: number, checked: boolean) => {
    const newSelected = new Set(selectedShowIds);
    if (checked) newSelected.add(showId);
    else newSelected.delete(showId);
    setSelectedShowIds(newSelected);
  };

  const handleGroupSelect = (group: ShowGroup, checked: boolean) => {
    const newSelected = new Set(selectedShowIds);
    group.shows.forEach((show) => {
      if (checked) newSelected.add(show.id);
      else newSelected.delete(show.id);
    });
    setSelectedShowIds(newSelected);
  };

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      const all = new Set<number>();
      groupedShows.forEach((g) => g.shows.forEach((s) => all.add(s.id)));
      setSelectedShowIds(all);
    } else {
      setSelectedShowIds(new Set());
    }
  };

  const fetchShows = useCallback(async (query: string) => {
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
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchShows(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText, fetchShows]);

  const handleAddShow = (show: LiveShow | null) => {
    if (show && !selectedShows.find((s) => s.id === show.id)) {
      setSelectedShows((prev) => [...prev, { id: show.id, label: show.performance_name }]);
      setSearchText('');
    }
  };

  const handleRemoveShow = (showId: number) =>
    setSelectedShows((prev) => prev.filter((s) => s.id !== showId));

  const handleClearAllConfirm = () => {
    setSelectedShows([]);
    setSelectedShowIds(new Set());
    clearSavedShows();
    setSongAnalysis([]);
    setCompletionRate(0);
    setHasAnalyzed(false);
    setIsReverseAnalysis(false);
    setShowClearConfirm(false);
  };

  const runAnalyze = async (reverse: boolean) => {
    const showIds =
      appMode === 'multiSelect' ? Array.from(selectedShowIds) : selectedShows.map((s) => s.id);
    if (showIds.length === 0) {
      setError(t('errors.noShows'));
      return;
    }
    setLoading(true);
    setError(null);
    setIsReverseAnalysis(reverse);
    setSortKey(reverse ? 'selection_rate' : 'hit_count');
    setSortDir('desc');

    try {
      const result = reverse
        ? await staticDataService.analyzeReverseSongs(showIds)
        : await staticDataService.analyzeSongs(showIds);

      setSongAnalysis(result.songs);
      setCompletionRate(result.completion_rate);
      setTotalSongs(result.total_songs);
      setHasAnalyzed(true);

      if (appMode === 'multiSelect') {
        const synced: SearchTag[] = [];
        groupedShows.forEach((g) =>
          g.shows.forEach((s) => {
            if (selectedShowIds.has(s.id)) synced.push({ id: s.id, label: s.performance_name });
          }),
        );
        setSelectedShows(synced);
        saveSelectedShows(synced);
      } else {
        saveSelectedShows(selectedShows);
      }

      // Scroll to the result after rendering completes
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      setError(t(reverse ? 'errors.reverseAnalysisFailed' : 'errors.analysisFailed'));
      console.error('Analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount =
    appMode === 'multiSelect' ? selectedShowIds.size : selectedShows.length;

  const filteredGroups = useMemo(() => {
    if (!groupFilter.trim()) return groupedShows;
    const q = groupFilter.toLowerCase();
    return groupedShows
      .map((g) => ({
        groupName: g.groupName,
        shows: g.shows.filter(
          (s) =>
            s.performance_name.toLowerCase().includes(q) ||
            s.venue.toLowerCase().includes(q) ||
            g.groupName.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.shows.length > 0);
  }, [groupedShows, groupFilter]);

  const sortedSongs = useMemo(() => {
    const copy = [...songAnalysis];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [songAnalysis, sortKey, sortDir]);

  const maxHit = useMemo(
    () => sortedSongs.reduce((m, s) => Math.max(m, s.hit_count || 0), 0),
    [sortedSongs],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'song_name' ? 'asc' : 'desc');
    }
  };

  const globalStyles = (
    <GlobalStyles
      styles={{
        body: {
          fontFeatureSettings: '"palt"',
          WebkitFontSmoothing: 'antialiased',
        },
        '::selection': {
          backgroundColor: MAGENTA,
          color: '#fff',
        },
      }}
    />
  );

  // ── render: header ─────────────────────────────────────────────
  const renderHeader = () => (
    <AppBar
      position="sticky"
      sx={{
        backdropFilter: 'saturate(180%) blur(12px)',
        backgroundColor: darkMode ? 'rgba(14,14,16,0.78)' : 'rgba(255,255,255,0.78)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexGrow: 1 }}>
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: 0,
              backgroundColor: MAGENTA,
              alignSelf: 'center',
              display: 'inline-block',
            }}
          />
          <Typography
            variant="body1"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.18em',
              fontSize: 13,
            }}
          >
            {t('app.brand')}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              letterSpacing: '0.18em',
              display: { xs: 'none', sm: 'inline' },
            }}
          >
            / {t('app.tagline')}
          </Typography>
        </Box>

        <LanguageSwitcher />

        <Tooltip title={t('settings.darkMode')}>
          <IconButton
            onClick={() => {
              const next = !darkMode;
              setDarkMode(next);
              saveThemeMode(next);
            }}
            color="inherit"
            size="small"
          >
            {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );

  // ── render: hero ──────────────────────────────────────────────
  const renderHero = () => (
    <Box
      sx={{
        py: { xs: 6, md: 10 },
        borderBottom: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ maxWidth: 760 }}>
          <Typography
            variant="overline"
            sx={{
              color: MAGENTA,
              display: 'block',
              mb: 2,
            }}
          >
            ◆ {t('app.tagline')}
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
              fontWeight: 600,
              fontSize: { xs: 32, sm: 44, md: 56 },
              lineHeight: 1.15,
              mb: 3,
              letterSpacing: '-0.01em',
            }}
          >
            {t('app.title')}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: 14, md: 16 },
              maxWidth: 560,
              lineHeight: 1.7,
            }}
          >
            {t('app.subtitle')}
          </Typography>
        </Box>
      </Container>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          right: -80,
          top: 0,
          bottom: 0,
          width: 360,
          background: `linear-gradient(135deg, ${MAGENTA}11, transparent 60%)`,
          pointerEvents: 'none',
          display: { xs: 'none', md: 'block' },
        }}
      />
    </Box>
  );

  // ── render: mode tabs ─────────────────────────────────────────
  const renderModeTabs = () => (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        position: 'sticky',
        top: 64,
        zIndex: 1,
        backdropFilter: 'saturate(180%) blur(12px)',
        backgroundColor: darkMode ? 'rgba(14,14,16,0.78)' : 'rgba(255,255,255,0.78)',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', gap: 4 }}>
          {(['search', 'multiSelect'] as AppMode[]).map((mode) => {
            const active = appMode === mode;
            return (
              <Box
                key={mode}
                onClick={() => handleModeChange(mode)}
                sx={{
                  position: 'relative',
                  py: 2,
                  cursor: 'pointer',
                  color: active ? 'text.primary' : 'text.secondary',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '0.04em',
                  transition: 'color 120ms ease',
                  '&:hover': { color: 'text.primary' },
                  '&::after': active
                    ? {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: -1,
                        height: 2,
                        backgroundColor: MAGENTA,
                      }
                    : undefined,
                }}
              >
                {t(`modes.${mode}`)}
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );

  // ── render: floating bottom action bar ────────────────────────
  // Renders only when at least one show is selected. Sits fixed above the
  // viewport bottom so users don't have to scroll past dozens of cards to
  // hit "Calculate".
  const renderFloatingActionBar = () => {
    if (selectedCount === 0) return null;
    return (
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'saturate(180%) blur(14px)',
          backgroundColor: darkMode ? 'rgba(14,14,16,0.86)' : 'rgba(255,255,255,0.88)',
          animation: 'nana-fab-in 220ms ease-out',
          '@keyframes nana-fab-in': {
            from: { transform: 'translateY(100%)', opacity: 0 },
            to: { transform: 'translateY(0)', opacity: 1 },
          },
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexGrow: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
                fontSize: { xs: 22, sm: 28 },
                fontWeight: 600,
                color: MAGENTA,
                fontFeatureSettings: '"tnum"',
                lineHeight: 1,
              }}
            >
              {selectedCount}
            </Typography>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {t('multiSelect.selectedCount', { count: selectedCount })}
            </Typography>
          </Box>
          <Button
            variant="text"
            size="small"
            onClick={() => setShowClearConfirm(true)}
            startIcon={<ClearAllIcon fontSize="small" />}
            sx={{ color: 'text.secondary' }}
          >
            {t('search.clear')}
          </Button>
          <Button
            variant="outlined"
            size="medium"
            onClick={() => runAnalyze(true)}
            disabled={loading}
            startIcon={
              loading && isReverseAnalysis ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <SearchOffIcon fontSize="small" />
              )
            }
            sx={{
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { borderColor: MAGENTA, color: MAGENTA },
            }}
          >
            {loading && isReverseAnalysis ? t('analysis.loading') : t('analysis.reverse')}
          </Button>
          <Button
            variant="contained"
            size="medium"
            onClick={() => runAnalyze(false)}
            disabled={loading}
            startIcon={
              loading && !isReverseAnalysis ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <SearchIcon fontSize="small" />
              )
            }
          >
            {loading && !isReverseAnalysis ? t('analysis.loading') : t('analysis.button')}
          </Button>
        </Container>
      </Box>
    );
  };

  // ── render: search panel ──────────────────────────────────────
  const renderSearchPanel = () => (
    <Box sx={{ py: 5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        ── {t('modes.search')}
      </Typography>

      <Autocomplete
        options={availableShows}
        getOptionLabel={(option) => option.performance_name}
        loading={autoCompleteLoading}
        value={null}
        inputValue={searchText}
        onInputChange={(_, v) => setSearchText(v)}
        onChange={(_, v) => handleAddShow(v)}
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
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />,
              endAdornment: (
                <>
                  {autoCompleteLoading ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
              sx: { fontSize: 18, py: 0.5 },
            }}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...other } = props as any;
          return (
            <Box key={key} {...other} component="li" sx={{ display: 'block !important', py: 1.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {option.performance_name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFeatureSettings: '"tnum"' }}>
                {formatDate(option.date)} · {option.venue}
              </Typography>
            </Box>
          );
        }}
        noOptionsText={t('search.noResults')}
      />

      {selectedShows.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3 }}>
          {selectedShows.map((show) => (
            <Chip
              key={show.id}
              label={show.label}
              onDelete={() => handleRemoveShow(show.id)}
              deleteIcon={<CloseIcon fontSize="small" />}
              variant="outlined"
              sx={{
                maxWidth: '100%',
                borderColor: 'divider',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 460,
                },
                '&:hover': { borderColor: MAGENTA },
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );

  // ── render: show card ─────────────────────────────────────────
  const renderShowCard = (show: LiveShow) => {
    const selected = selectedShowIds.has(show.id);
    return (
      <Box
        key={show.id}
        onClick={() => handleShowSelect(show.id, !selected)}
        sx={{
          position: 'relative',
          p: 2.5,
          cursor: 'pointer',
          border: '1px solid',
          borderColor: selected ? MAGENTA : 'divider',
          backgroundColor: 'background.paper',
          transition: 'border-color 140ms ease, transform 140ms ease',
          '&:hover': {
            borderColor: selected ? MAGENTA : 'text.primary',
            transform: 'translateY(-1px)',
          },
        }}
      >
        {selected && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: MAGENTA,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon sx={{ fontSize: 14 }} />
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25 }}>
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'Inter, monospace',
              fontFeatureSettings: '"tnum"',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'text.primary',
            }}
          >
            {formatDate(show.date)}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography
            variant="caption"
            sx={{
              color: MAGENTA,
              fontWeight: 600,
              letterSpacing: '0.14em',
              fontSize: 10,
            }}
          >
            {yearOf(show.date)}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            mb: 1,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {show.performance_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {show.venue}
        </Typography>
      </Box>
    );
  };

  // ── render: multi-select panel ────────────────────────────────
  const renderMultiSelectPanel = () => (
    <Box sx={{ py: 5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            ── {t('multiSelect.title')}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {filteredGroups.reduce((acc, g) => acc + g.shows.length, 0)} {t('multiSelect.showCount')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder={t('search.placeholder')}
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.secondary' }} fontSize="small" />,
            }}
            sx={{ minWidth: 220 }}
          />
          <Button
            variant="text"
            size="small"
            onClick={() => handleSelectAll(true)}
            sx={{ color: 'text.secondary' }}
          >
            {t('multiSelect.selectAll')}
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => handleSelectAll(false)}
            sx={{ color: 'text.secondary' }}
          >
            {t('multiSelect.deselectAll')}
          </Button>
        </Box>
      </Box>

      {multiSelectLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: MAGENTA }} />
        </Box>
      )}

      {!multiSelectLoading && filteredGroups.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          {t('multiSelect.noShows')}
        </Alert>
      )}

      {!multiSelectLoading &&
        filteredGroups.map((group) => {
          const groupSelectedCount = group.shows.filter((s) => selectedShowIds.has(s.id)).length;
          const allSelected = groupSelectedCount === group.shows.length;
          return (
            <Box key={group.groupName} sx={{ mb: 5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 2,
                  pb: 1.5,
                  mb: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
                    fontSize: 18,
                    fontWeight: 600,
                    flexGrow: 1,
                    minWidth: 0,
                  }}
                  noWrap
                >
                  {group.groupName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontFeatureSettings: '"tnum"',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {groupSelectedCount} / {group.shows.length}
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => handleGroupSelect(group, !allSelected)}
                  sx={{
                    color: allSelected ? MAGENTA : 'text.secondary',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    minWidth: 0,
                  }}
                >
                  {allSelected ? t('multiSelect.deselectAll') : t('multiSelect.selectAll')}
                </Button>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                    lg: 'repeat(4, 1fr)',
                  },
                  gap: 1.5,
                }}
              >
                {group.shows.map(renderShowCard)}
              </Box>
            </Box>
          );
        })}
    </Box>
  );

  // ── render: result panel ──────────────────────────────────────
  const renderResultPanel = () => {
    if (songAnalysis.length === 0) return null;
    const totalForRate = totalSongs || Math.round(songAnalysis.length / (completionRate || 1));
    return (
      <Box ref={resultRef} sx={{ pb: 8, scrollMarginTop: 120 }}>
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            pt: 5,
            pb: 4,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 3, md: 6 },
            alignItems: 'end',
          }}
        >
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              ── {isReverseAnalysis ? t('analysis.incompletionRate') : t('analysis.completionRate')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <Typography
                sx={{
                  fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
                  fontSize: { xs: 56, md: 88 },
                  fontWeight: 600,
                  lineHeight: 1,
                  color: MAGENTA,
                  fontFeatureSettings: '"tnum"',
                  letterSpacing: '-0.02em',
                }}
              >
                {(completionRate * 100).toFixed(1)}
              </Typography>
              <Typography sx={{ fontSize: 28, color: MAGENTA, fontWeight: 500 }}>%</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {isReverseAnalysis ? t('analysis.incompletionDescription') : t('analysis.completionDescription')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', py: 1 }}>
              <Typography variant="overline" color="text.secondary">
                {isReverseAnalysis ? t('analysis.reverseResultTitle') : t('analysis.resultTitle')}
              </Typography>
              <Typography
                sx={{
                  fontFeatureSettings: '"tnum"',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                {songAnalysis.length} / {totalForRate}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', py: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Shows analyzed
              </Typography>
              <Typography sx={{ fontFeatureSettings: '"tnum"', fontWeight: 600, fontSize: 15 }}>
                {selectedCount}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ pt: 1 }}>
              {hasAnalyzed && (isReverseAnalysis ? t('analysis.reverseSubtitle') : t('analysis.subtitle'))}
            </Typography>
          </Box>
        </Box>

        <TableContainer
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Table size={isMobile ? 'small' : 'medium'} sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ '& th': { border: 0, borderBottom: '1px solid', borderColor: 'divider' } }}>
                <TableCell sx={{ width: 56, color: 'text.secondary' }}>
                  <Typography variant="overline">#</Typography>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === 'song_name'}
                    direction={sortKey === 'song_name' ? sortDir : 'asc'}
                    onClick={() => toggleSort('song_name')}
                  >
                    <Typography variant="overline">{t('table.songName')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: { xs: 80, md: 140 } }}>
                  <TableSortLabel
                    active={sortKey === 'hit_count'}
                    direction={sortKey === 'hit_count' ? sortDir : 'desc'}
                    onClick={() => toggleSort('hit_count')}
                  >
                    <Typography variant="overline">{t('table.hitCount')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: { xs: 80, md: 120 }, display: { xs: 'none', sm: 'table-cell' } }}>
                  <TableSortLabel
                    active={sortKey === 'total_appearances'}
                    direction={sortKey === 'total_appearances' ? sortDir : 'desc'}
                    onClick={() => toggleSort('total_appearances')}
                  >
                    <Typography variant="overline">{t('table.totalAppearances')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: { xs: 80, md: 100 } }}>
                  <TableSortLabel
                    active={sortKey === 'selection_rate'}
                    direction={sortKey === 'selection_rate' ? sortDir : 'desc'}
                    onClick={() => toggleSort('selection_rate')}
                  >
                    <Typography variant="overline">{t('table.selectionRate')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ width: { md: '32%' }, display: { xs: 'none', md: 'table-cell' } }}>
                  <Typography variant="overline">{t('table.latestPerformance')}</Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSongs.map((row, idx) => {
                const rate = Number(row.selection_rate) || 0;
                const hit = row.hit_count || 0;
                const barWidth = maxHit > 0 ? (hit / maxHit) * 100 : 0;
                return (
                  <TableRow
                    key={row.id}
                    sx={{
                      '& td': { border: 0, borderBottom: '1px solid', borderColor: 'divider', py: 1.5 },
                      transition: 'background 120ms ease',
                      '&:hover': {
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      },
                    }}
                  >
                    <TableCell sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum"' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.song_name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5 }}
                        noWrap
                      >
                        {row.latest_performance}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                        <Box
                          sx={{
                            position: 'relative',
                            width: { xs: 24, md: 64 },
                            height: 2,
                            backgroundColor: 'divider',
                            display: { xs: 'none', md: 'block' },
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              width: `${barWidth}%`,
                              backgroundColor: MAGENTA,
                            }}
                          />
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFeatureSettings: '"tnum"',
                            fontWeight: 600,
                            minWidth: 28,
                            textAlign: 'right',
                          }}
                        >
                          {hit}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontFeatureSettings: '"tnum"',
                        color: 'text.secondary',
                        display: { xs: 'none', sm: 'table-cell' },
                      }}
                    >
                      {row.total_appearances}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontFeatureSettings: '"tnum"', color: 'text.secondary' }}
                    >
                      {(rate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="body2" noWrap>
                        {row.latest_performance}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {row.latest_venue}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}

      {renderHeader()}
      {renderHero()}
      {renderModeTabs()}

      <Container maxWidth="lg" sx={{ pb: selectedCount > 0 ? { xs: 14, sm: 12 } : 0 }}>
        {appMode === 'search' ? renderSearchPanel() : renderMultiSelectPanel()}

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 2, borderRadius: 0 }}
          >
            {error}
          </Alert>
        )}

        {renderResultPanel()}
      </Container>

      {renderFloatingActionBar()}

      <Snackbar
        open={showRestoredMessage}
        autoHideDuration={5000}
        onClose={() => setShowRestoredMessage(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          onClose={() => setShowRestoredMessage(false)}
          severity="info"
          sx={{ borderRadius: 0 }}
        >
          {t('search.restored')} ({selectedShows.length})
        </Alert>
      </Snackbar>

      <Dialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        PaperProps={{ sx: { borderRadius: 0, border: '1px solid', borderColor: 'divider' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Shippori Mincho", "Noto Serif JP", serif' }}>
          {t('search.clearConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('search.clearConfirmMessage')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearConfirm(false)} sx={{ color: 'text.secondary' }}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleClearAllConfirm} color="primary" autoFocus variant="contained">
            {t('search.clearConfirmButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default HomePage;
