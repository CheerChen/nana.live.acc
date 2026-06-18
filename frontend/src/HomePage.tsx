import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
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
  Drawer,
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
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  ClearAll as ClearAllIcon,
  SearchOff as SearchOffIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  GridView as GridViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  staticDataService,
  LiveShow,
  SongAnalysis,
  TourMatrix,
  SongDetail,
} from './services/staticDataService';
import LanguageSwitcher from './components/LanguageSwitcher';

interface ShowGroup {
  groupName: string;
  shows: LiveShow[];
}

type SortKey = 'hit_count' | 'total_appearances' | 'selection_rate' | 'song_name';
type SortDir = 'asc' | 'desc';

const STORAGE_KEY = 'nana-selected-shows';
const THEME_STORAGE_KEY = 'nana-theme-mode';
const EXPIRY_DAYS = 7;

// Brand magenta — primary accent in dark mode, "super rare" accent in light mode.
const MAGENTA = '#E5004F';
const MAGENTA_HOVER = '#F2336F';
const MAGENTA_ACTIVE = '#B8003F';
// Light-mode primary blue (user-supplied).
const BLUE = '#306eff';
const BLUE_HOVER = '#4a80ff';
const BLUE_ACTIVE = '#175cff';
// Sky cyan used for "super rare" marker in dark mode (kept distinct from magenta).
const SKY_BLUE = '#1FA9FF';

const saveSelectedShowIds = (ids: number[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids, timestamp: Date.now() }));
};

const loadSelectedShowIds = (): { ids: number[]; isRestored: boolean } => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ids: [], isRestored: false };

    const data: any = JSON.parse(saved);
    const isExpired = Date.now() - (data.timestamp ?? 0) > EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (isExpired) {
      localStorage.removeItem(STORAGE_KEY);
      return { ids: [], isRestored: false };
    }

    // New format
    if (Array.isArray(data.ids)) {
      const ids = data.ids.filter((n: unknown): n is number => typeof n === 'number');
      return { ids, isRestored: ids.length > 0 };
    }
    // Legacy format: { shows: [{id, label}], timestamp }
    if (Array.isArray(data.shows)) {
      const ids = data.shows
        .map((s: any) => s?.id)
        .filter((n: unknown): n is number => typeof n === 'number');
      return { ids, isRestored: ids.length > 0 };
    }
    return { ids: [], isRestored: false };
  } catch (error) {
    console.error('Failed to load saved shows:', error);
    return { ids: [], isRestored: false };
  }
};

const clearSavedShows = () => localStorage.removeItem(STORAGE_KEY);

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

type Translator = (key: string, opts?: Record<string, unknown>) => string;

/** Locale-aware relative-time text for the latest performance. */
const formatElapsed = (iso: string, t: Translator, now: Date = new Date()): string => {
  const then = new Date(iso + 'T00:00:00');
  if (Number.isNaN(then.getTime())) return '—';
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days < 0) return t('relative.future');
  if (days === 0) return t('relative.today');
  if (days < 14) return t('relative.daysAgo', { n: days });
  if (days < 60) return t('relative.weeksAgo', { n: Math.floor(days / 7) });
  let y = now.getFullYear() - then.getFullYear();
  let m = now.getMonth() - then.getMonth();
  if (now.getDate() < then.getDate()) m -= 1;
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  if (y === 0) return t('relative.monthsAgo', { n: m });
  if (m === 0) return t('relative.yearsAgo', { n: y });
  return t('relative.yearsMonthsAgo', { y, m });
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();

  const [songAnalysis, setSongAnalysis] = useState<SongAnalysis[]>([]);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [totalSongs, setTotalSongs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(loadThemeMode);

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

  const [tourDrawer, setTourDrawer] = useState<{
    open: boolean;
    group: ShowGroup | null;
    matrix: TourMatrix | null;
    loading: boolean;
  }>({ open: false, group: null, matrix: null, loading: false });

  const [songModal, setSongModal] = useState<{
    open: boolean;
    detail: SongDetail | null;
    loading: boolean;
  }>({ open: false, detail: null, loading: false });

  const resultRef = useRef<HTMLDivElement | null>(null);

  // Theme-aware accent colors. Magenta stays as the brand mark in dark mode;
  // light mode swaps to indigo blue so the UI feels different from a
  // dark-mode screenshot at first glance. The "super rare" marker uses the
  // opposite of the primary so it always stands out in either mode.
  const accent = darkMode ? MAGENTA : BLUE;
  const accentHover = darkMode ? MAGENTA_HOVER : BLUE_HOVER;
  const accentActive = darkMode ? MAGENTA_ACTIVE : BLUE_ACTIVE;
  const rareAccent = darkMode ? SKY_BLUE : MAGENTA;

  useEffect(() => {
    const { ids, isRestored } = loadSelectedShowIds();
    if (isRestored) {
      setSelectedShowIds(new Set(ids));
      setShowRestoredMessage(true);
    }
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
    if (groupedShows.length === 0) loadGroupedShows();
  }, [groupedShows.length, loadGroupedShows]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: accent,
            light: accentHover,
            dark: accentActive,
            contrastText: '#FFFFFF',
          },
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
    [darkMode, accent, accentHover, accentActive],
  );

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const handleOpenTourMatrix = async (group: ShowGroup) => {
    setTourDrawer({ open: true, group, matrix: null, loading: true });
    try {
      const matrix = await staticDataService.getTourMatrix(group.shows.map((s) => s.id));
      setTourDrawer((d) => ({ ...d, matrix, loading: false }));
    } catch (err) {
      console.error('Failed to load tour matrix:', err);
      setTourDrawer((d) => ({ ...d, loading: false }));
    }
  };

  const handleCloseTourMatrix = () => {
    setTourDrawer((d) => ({ ...d, open: false }));
  };

  const handleOpenSongModal = async (songId: number) => {
    setSongModal({ open: true, detail: null, loading: true });
    try {
      const detail = await staticDataService.getSongDetail(songId);
      setSongModal({ open: true, detail, loading: false });
    } catch (err) {
      console.error('Failed to load song detail:', err);
      setSongModal({ open: false, detail: null, loading: false });
    }
  };

  const handleCloseSongModal = () => {
    setSongModal((m) => ({ ...m, open: false }));
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

  const handleClearAllConfirm = () => {
    setSelectedShowIds(new Set());
    clearSavedShows();
    setSongAnalysis([]);
    setCompletionRate(0);
    setHasAnalyzed(false);
    setIsReverseAnalysis(false);
    setShowClearConfirm(false);
  };

  const runAnalyze = async (reverse: boolean) => {
    const showIds = Array.from(selectedShowIds);
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

      saveSelectedShowIds(showIds);

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

  const selectedCount = selectedShowIds.size;

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
          backgroundColor: accent,
          color: '#fff',
        },
        '@keyframes nana-rare-pulse': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.35, transform: 'scale(0.85)' },
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
              backgroundColor: accent,
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
            / {t('app.headerTagline')}
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
              color: accent,
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
              whiteSpace: 'pre-line',
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
          background: `linear-gradient(135deg, ${accent}11, transparent 60%)`,
          pointerEvents: 'none',
          display: { xs: 'none', md: 'block' },
        }}
      />
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
                color: accent,
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
              '&:hover': { borderColor: accent, color: accent },
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

  // ── render: tour matrix drawer ────────────────────────────────
  const renderTourMatrixDrawer = () => {
    const { open, group, matrix, loading: matrixLoading } = tourDrawer;

    const showCount = matrix?.shows.length ?? 0;
    const colCellWidth = showCount > 15 ? 34 : 42;
    const gridTemplate = `minmax(180px, 240px) repeat(${showCount}, ${colCellWidth}px) 64px`;

    const renderShortDate = (iso: string) => iso.slice(5).replace('-', '.');

    const renderSongRow = (song: NonNullable<TourMatrix['songs']>[number]) => {
      if (!matrix) return null;
      const isCore = song.hitCount === showCount;
      const isRare = showCount > 2 && song.hitCount === 1;
      const diamondColor = isRare ? rareAccent : accent;
      return (
        <Box
          key={song.id}
          sx={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 36,
            '&:hover': {
              backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            },
          }}
        >
          <Typography
            component="button"
            type="button"
            onClick={() => handleOpenSongModal(song.id)}
            sx={{
              appearance: 'none',
              background: 'none',
              border: 'none',
              p: 0,
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 13,
              fontWeight: 500,
              pr: 1.5,
              pl: 0.5,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'color 120ms ease',
              '&:hover': { color: accent },
            }}
            title={song.name}
          >
            {song.name}
          </Typography>
          {matrix.shows.map((show) => {
            const pos = song.cells[show.id];
            const played = pos !== undefined;
            return (
              <Box
                key={show.id}
                sx={{
                  textAlign: 'center',
                  fontFamily: 'Inter, monospace',
                  fontFeatureSettings: '"tnum"',
                  fontSize: 11,
                  py: 1,
                  color: played ? 'text.primary' : 'text.disabled',
                  backgroundColor: played ? (darkMode ? `${accent}2e` : `${accent}1a`) : 'transparent',
                }}
              >
                {played ? String(pos).padStart(2, '0') : '·'}
              </Box>
            );
          })}
          <Box
            sx={{
              textAlign: 'right',
              pr: 0.5,
              pl: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFeatureSettings: '"tnum"',
                fontWeight: 600,
                color: isCore ? 'text.secondary' : 'text.primary',
              }}
            >
              {song.hitCount}/{showCount}
            </Typography>
            <Box
              component="span"
              sx={{
                color: isCore ? 'text.disabled' : diamondColor,
                fontSize: 11,
                lineHeight: 1,
                display: 'inline-block',
                ...(isRare && {
                  animation: 'nana-rare-pulse 1.4s ease-in-out infinite',
                }),
              }}
              aria-hidden
            >
              ◆
            </Box>
          </Box>
        </Box>
      );
    };

    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={handleCloseTourMatrix}
        PaperProps={{
          sx: {
            width: { xs: '100%', md: 920, lg: 1040 },
            backgroundColor: 'background.default',
            backgroundImage: 'none',
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            backdropFilter: 'saturate(180%) blur(12px)',
            backgroundColor: darkMode ? 'rgba(14,14,16,0.88)' : 'rgba(255,255,255,0.88)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: { xs: 2, md: 4 },
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: '0.22em', flexGrow: 1 }}
          >
            ── TOUR SETLIST
          </Typography>
          <IconButton onClick={handleCloseTourMatrix} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
          {group && (
            <Box sx={{ mb: 4 }}>
              <Typography
                sx={{
                  fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
                  fontSize: { xs: 24, md: 34 },
                  fontWeight: 600,
                  lineHeight: 1.2,
                  mb: 1.5,
                }}
              >
                {group.groupName}
              </Typography>
              {matrix && matrix.shows.length > 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontFeatureSettings: '"tnum"' }}
                >
                  {formatDate(matrix.shows[0].date)} — {formatDate(matrix.shows[matrix.shows.length - 1].date)}
                  {'  ·  '}{matrix.shows.length} shows
                  {'  ·  '}{matrix.songs.length} unique songs
                </Typography>
              )}
            </Box>
          )}

          {matrixLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: accent }} />
            </Box>
          )}

          {!matrixLoading && matrix && matrix.songs.length === 0 && (
            <Alert severity="info" sx={{ borderRadius: 0 }}>
              No setlist data recorded for this tour yet.
            </Alert>
          )}

          {!matrixLoading && matrix && matrix.songs.length > 0 && (
            <>
              {/* legend */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  flexWrap: 'wrap',
                  pb: 2,
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box component="span" sx={{ color: 'text.disabled', fontSize: 12, lineHeight: 1 }}>
                    ◆
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', letterSpacing: '0.16em' }}
                  >
                    CORE
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box component="span" sx={{ color: accent, fontSize: 12, lineHeight: 1 }}>
                    ◆
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', letterSpacing: '0.16em' }}
                  >
                    ROTATION
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    component="span"
                    sx={{
                      color: rareAccent,
                      fontSize: 12,
                      lineHeight: 1,
                      display: 'inline-block',
                      animation: 'nana-rare-pulse 1.4s ease-in-out infinite',
                    }}
                  >
                    ◆
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', letterSpacing: '0.16em' }}
                  >
                    RARE
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ overflowX: 'auto' }}>
                <Box sx={{ display: 'inline-block', minWidth: '100%' }}>
                  {/* table header */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: gridTemplate,
                    alignItems: 'end',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    pb: 1,
                  }}
                >
                  <Typography variant="overline" sx={{ color: 'text.secondary', pl: 0.5 }}>
                    SONG
                  </Typography>
                  {matrix.shows.map((show) => (
                    <Tooltip
                      key={show.id}
                      title={`${formatDate(show.date)} · ${show.venue}`}
                      placement="top"
                    >
                      <Typography
                        sx={{
                          textAlign: 'center',
                          color: 'text.secondary',
                          fontFeatureSettings: '"tnum"',
                          fontSize: 10,
                          letterSpacing: 0,
                          cursor: 'default',
                          userSelect: 'none',
                        }}
                      >
                        {renderShortDate(show.date)}
                      </Typography>
                    </Tooltip>
                  ))}
                  <Typography
                    variant="overline"
                    sx={{ color: 'text.secondary', textAlign: 'right', pr: 0.5 }}
                  >
                    ×/{showCount}
                  </Typography>
                </Box>

                  {matrix.songs.map((s) => renderSongRow(s))}
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Drawer>
    );
  };

  // ── render: song detail modal ─────────────────────────────────
  const renderSongModal = () => {
    const { open, detail, loading: songLoading } = songModal;
    const maxYearCount = detail
      ? detail.timeline.reduce((m, x) => Math.max(m, x.count), 0)
      : 0;

    return (
      <Dialog
        open={open}
        onClose={handleCloseSongModal}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: 0,
            backgroundImage: 'none',
            border: { xs: 'none', sm: '1px solid' },
            borderColor: 'divider',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: { xs: 2.5, sm: 3 },
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: '0.22em', flexGrow: 1 }}
          >
            ── SONG
          </Typography>
          <IconButton size="small" onClick={handleCloseSongModal}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {songLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: accent }} />
          </Box>
        )}

        {!songLoading && detail && (
          <Box sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 3, sm: 4 } }}>
            {/* Hero */}
            <Typography
              sx={{
                fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
                fontSize: { xs: 24, sm: 30 },
                fontWeight: 600,
                lineHeight: 1.25,
                mb: { xs: 3, sm: 4 },
                wordBreak: 'break-word',
              }}
            >
              {detail.song.name}
            </Typography>

            {/* KPI grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: { xs: 2, sm: 1.5 },
                pb: 3,
                mb: 4,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              {[
                { label: 'All-time', value: String(detail.all_time_plays) },
                { label: 'Rate', value: `${(detail.play_rate * 100).toFixed(1)}%` },
                {
                  label: 'Latest',
                  value: detail.latest_show ? formatElapsed(detail.latest_show.date, t) : '—',
                },
              ].map((kpi) => (
                <Box key={kpi.label}>
                  <Typography
                    variant="overline"
                    sx={{ color: 'text.secondary', letterSpacing: '0.16em', fontSize: 10 }}
                  >
                    {kpi.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
                      fontSize: { xs: 20, sm: 26 },
                      fontWeight: 600,
                      lineHeight: 1.1,
                      fontFeatureSettings: '"tnum"',
                      mt: 0.25,
                      wordBreak: 'keep-all',
                    }}
                  >
                    {kpi.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Timeline */}
            {detail.timeline.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'text.secondary', letterSpacing: '0.22em', display: 'block', mb: 1.5 }}
                >
                  ── TIMELINE
                </Typography>
                <Box>
                  {detail.timeline.map(({ year, count }) => (
                    <Box
                      key={year}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '52px 1fr 32px',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.5,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: 'text.secondary',
                          fontFeatureSettings: '"tnum"',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {year}
                      </Typography>
                      <Box
                        sx={{
                          height: 6,
                          width: `${maxYearCount > 0 ? (count / maxYearCount) * 100 : 0}%`,
                          backgroundColor: accent,
                          opacity: 0.8,
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontWeight: 600,
                          fontFeatureSettings: '"tnum"',
                          textAlign: 'right',
                        }}
                      >
                        {count}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Recent appearances */}
            {detail.recent_appearances.length > 0 && (
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: 'text.secondary', letterSpacing: '0.22em', display: 'block', mb: 1.5 }}
                >
                  ── RECENT
                </Typography>
                {detail.recent_appearances.map((show) => (
                  <Box
                    key={show.id}
                    sx={{
                      display: 'flex',
                      gap: 2,
                      alignItems: 'baseline',
                      py: 1.25,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-of-type': { borderBottom: 'none' },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontFeatureSettings: '"tnum"',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        minWidth: 76,
                      }}
                    >
                      {formatDate(show.date)}
                    </Typography>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>
                        {show.performance_name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
                        {show.venue}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {detail.all_time_plays > detail.recent_appearances.length && (
                  <Typography
                    sx={{
                      mt: 1.5,
                      fontSize: 11,
                      color: 'text.disabled',
                      letterSpacing: '0.04em',
                    }}
                  >
                    + {detail.all_time_plays - detail.recent_appearances.length} more
                  </Typography>
                )}
              </Box>
            )}

            {/* External link */}
            {detail.song.song_url && (
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box
                  component="a"
                  href={detail.song.song_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontSize: 11,
                    color: accent,
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  ↗ SOURCE
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Dialog>
    );
  };

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
          borderColor: selected ? accent : 'divider',
          backgroundColor: 'background.paper',
          transition: 'border-color 140ms ease, transform 140ms ease',
          '&:hover': {
            borderColor: selected ? accent : 'text.primary',
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
              backgroundColor: accent,
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

  // ── render: select panel ──────────────────────────────────────
  const renderSelectPanel = () => (
    <Box sx={{ pt: 4, pb: 2 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 64,
          zIndex: 1,
          mx: { xs: -2, sm: -3 },
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'saturate(180%) blur(12px)',
          backgroundColor: darkMode ? 'rgba(14,14,16,0.86)' : 'rgba(255,255,255,0.88)',
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            ── {t('multiSelect.title')}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
              fontSize: 22,
              fontWeight: 600,
              fontFeatureSettings: '"tnum"',
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
            sx={{ minWidth: { xs: '100%', sm: 260 } }}
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
          <CircularProgress sx={{ color: accent }} />
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
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexGrow: 1,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
                      fontSize: 18,
                      fontWeight: 600,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.groupName}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleOpenTourMatrix(group)}
                    startIcon={<GridViewIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      flexShrink: 0,
                      color: accent,
                      borderColor: accent,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.16em',
                      px: 1.25,
                      py: 0.25,
                      minWidth: 0,
                      '&:hover': {
                        borderColor: accent,
                        backgroundColor: darkMode
                          ? 'rgba(229,0,79,0.14)'
                          : 'rgba(229,0,79,0.08)',
                      },
                    }}
                  >
                    SHOW SETLIST
                  </Button>
                </Box>
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
                    color: allSelected ? accent : 'text.secondary',
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
                  color: accent,
                  fontFeatureSettings: '"tnum"',
                  letterSpacing: '-0.02em',
                }}
              >
                {(completionRate * 100).toFixed(1)}
              </Typography>
              <Typography sx={{ fontSize: 28, color: accent, fontWeight: 500 }}>%</Typography>
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
                    hover
                    onClick={() => handleOpenSongModal(row.id)}
                    sx={{
                      cursor: 'pointer',
                      '& td': { border: 0, borderBottom: '1px solid', borderColor: 'divider', py: 1.5 },
                      transition: 'background 120ms ease',
                      '&:hover': {
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      },
                      '&:hover .song-name': { color: accent },
                    }}
                  >
                    <TableCell sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum"' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        className="song-name"
                        sx={{ fontWeight: 500, transition: 'color 120ms ease' }}
                      >
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
                              backgroundColor: accent,
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

      <Container maxWidth="lg" sx={{ pb: selectedCount > 0 ? { xs: 14, sm: 12 } : 0 }}>
        {renderSelectPanel()}

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
      {renderTourMatrixDrawer()}
      {renderSongModal()}

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
          {t('search.restored')} ({selectedShowIds.size})
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
