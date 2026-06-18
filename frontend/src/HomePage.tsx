import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AppBar,
  Box,
  Container,
  CssBaseline,
  GlobalStyles,
  IconButton,
  Snackbar,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  staticDataService,
  SongDetail,
  TourMatrix,
} from './services/staticDataService';
import LanguageSwitcher from './components/LanguageSwitcher';
import SelectPanel, { ShowGroup } from './components/SelectPanel';
import FloatingActionBar from './components/FloatingActionBar';
import {
  AnalysisMode,
  AnalysisSnapshot,
  SortDir,
  SortKey,
} from './components/AnalysisPanel';

const TourMatrixDrawer = React.lazy(() => import('./components/TourMatrixDrawer'));
const SongDetailModal = React.lazy(() => import('./components/SongDetailModal'));

const STORAGE_KEY = 'nana-selected-shows';
const THEME_STORAGE_KEY = 'nana-theme-mode';
const EXPIRY_DAYS = 7;
const STORAGE_DEBOUNCE_MS = 200;

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

const loadThemeMode = (): boolean => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light') return false;
  if (saved === 'dark') return true;
  // Default to light to match the editorial reference design.
  return false;
};

const saveThemeMode = (dark: boolean) => {
  localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();

  const [heardAnalysis, setHeardAnalysis] = useState<AnalysisSnapshot | null>(null);
  const [missedAnalysis, setMissedAnalysis] = useState<AnalysisSnapshot | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisExpanded, setAnalysisExpanded] = useState<boolean>(false);
  const [analysisTab, setAnalysisTab] = useState<AnalysisMode>('heard');
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(loadThemeMode);

  const [groupedShows, setGroupedShows] = useState<ShowGroup[]>([]);
  const [multiSelectLoading, setMultiSelectLoading] = useState<boolean>(false);
  const [selectedShowIds, setSelectedShowIds] = useState<Set<number>>(new Set());
  const [groupFilter, setGroupFilter] = useState<string>('');

  const [showRestoredMessage, setShowRestoredMessage] = useState<boolean>(false);
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

  // Theme-aware accents. Magenta is the brand mark in dark mode; light mode
  // swaps to indigo blue so the UI reads as a different surface. The "rare"
  // marker uses the opposite hue so it always stands out from the primary.
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
            // Bumped from 0.6/0.62 to meet WCAG AA on body backgrounds.
            secondary: darkMode ? 'rgba(255,255,255,0.72)' : 'rgba(17,17,17,0.66)',
          },
          divider: darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(17,17,17,0.09)',
        },
        shape: { borderRadius: 0 },
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
              root: { textTransform: 'none', borderRadius: 0, fontWeight: 500, letterSpacing: '0.02em' },
              sizeLarge: { paddingTop: 10, paddingBottom: 10 },
            },
          },
          MuiChip: { styleOverrides: { root: { borderRadius: 0, fontWeight: 500 } } },
          MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 0 } } },
        },
      }),
    [darkMode, accent, accentHover, accentActive],
  );

  const handleToggleShow = useCallback((showId: number, nextSelected: boolean) => {
    setSelectedShowIds((prev) => {
      const next = new Set(prev);
      if (nextSelected) next.add(showId);
      else next.delete(showId);
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((group: ShowGroup, nextSelected: boolean) => {
    setSelectedShowIds((prev) => {
      const next = new Set(prev);
      group.shows.forEach((show) => {
        if (nextSelected) next.add(show.id);
        else next.delete(show.id);
      });
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (selectAll: boolean) => {
      if (selectAll) {
        const all = new Set<number>();
        groupedShows.forEach((g) => g.shows.forEach((s) => all.add(s.id)));
        setSelectedShowIds(all);
      } else {
        setSelectedShowIds(new Set());
      }
    },
    [groupedShows],
  );

  const handleOpenTourMatrix = useCallback(async (group: ShowGroup) => {
    setTourDrawer({ open: true, group, matrix: null, loading: true });
    try {
      const matrix = await staticDataService.getTourMatrix(group.shows.map((s) => s.id));
      setTourDrawer((d) => ({ ...d, matrix, loading: false }));
    } catch (err) {
      console.error('Failed to load tour matrix:', err);
      setTourDrawer((d) => ({ ...d, loading: false }));
    }
  }, []);

  const handleCloseTourMatrix = useCallback(() => {
    setTourDrawer((d) => ({ ...d, open: false }));
  }, []);

  const handleOpenSongModal = useCallback(async (songId: number) => {
    setSongModal({ open: true, detail: null, loading: true });
    try {
      const detail = await staticDataService.getSongDetail(songId);
      setSongModal({ open: true, detail, loading: false });
    } catch (err) {
      console.error('Failed to load song detail:', err);
      setSongModal({ open: false, detail: null, loading: false });
    }
  }, []);

  const handleCloseSongModal = useCallback(() => {
    setSongModal((m) => ({ ...m, open: false }));
  }, []);

  const handleToggleSort = useCallback((key: SortKey) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return currentKey;
      }
      setSortDir(key === 'song_name' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const handleToggleExpanded = useCallback(() => {
    setAnalysisExpanded((open) => !open);
  }, []);

  const selectedCount = selectedShowIds.size;

  // Debounce localStorage writes so rapid toggles don't spam sync IO.
  const storageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selectedCount === 0) {
      if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
      return;
    }
    const ids = Array.from(selectedShowIds);
    if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
    storageTimerRef.current = setTimeout(() => {
      saveSelectedShowIds(ids);
    }, STORAGE_DEBOUNCE_MS);
    return () => {
      if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
    };
  }, [selectedShowIds, selectedCount]);

  useEffect(() => {
    if (selectedCount === 0) {
      setHeardAnalysis(null);
      setMissedAnalysis(null);
      setAnalysisLoading(false);
      setAnalysisExpanded(false);
      return;
    }

    const showIds = Array.from(selectedShowIds);
    let cancelled = false;
    setAnalysisLoading(true);

    Promise.all([
      staticDataService.analyzeSongs(showIds),
      staticDataService.analyzeReverseSongs(showIds),
    ])
      .then(([heard, missed]) => {
        if (cancelled) return;
        setHeardAnalysis({
          songs: heard.songs,
          completionRate: heard.completion_rate,
          totalSongs: heard.total_songs,
        });
        setMissedAnalysis({
          songs: missed.songs,
          completionRate: missed.completion_rate,
          totalSongs: missed.total_songs,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Analysis failed:', err);
        setError(t('errors.analysisFailed'));
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedShowIds, selectedCount, t]);

  useEffect(() => {
    setSortKey(analysisTab === 'heard' ? 'hit_count' : 'selection_rate');
    setSortDir('desc');
  }, [analysisTab]);

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
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0ms !important',
          },
        },
      }}
    />
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}

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
              aria-hidden
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
              aria-label={t('settings.darkMode')}
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

      <Container
        maxWidth="lg"
        sx={{
          pb: selectedCount > 0
            ? { xs: analysisExpanded ? 34 : 14, sm: analysisExpanded ? 40 : 12 }
            : 0,
        }}
      >
        <SelectPanel
          groupedShows={groupedShows}
          multiSelectLoading={multiSelectLoading}
          selectedShowIds={selectedShowIds}
          groupFilter={groupFilter}
          accent={accent}
          darkMode={darkMode}
          onGroupFilterChange={setGroupFilter}
          onToggleShow={handleToggleShow}
          onToggleGroup={handleToggleGroup}
          onSelectAll={handleSelectAll}
          onOpenTourMatrix={handleOpenTourMatrix}
        />

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 2, borderRadius: 0 }}
          >
            {error}
          </Alert>
        )}
      </Container>

      <FloatingActionBar
        selectedCount={selectedCount}
        heardAnalysis={heardAnalysis}
        missedAnalysis={missedAnalysis}
        analysisLoading={analysisLoading}
        analysisExpanded={analysisExpanded}
        onToggleExpanded={handleToggleExpanded}
        analysisTab={analysisTab}
        onAnalysisTabChange={setAnalysisTab}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={handleToggleSort}
        onOpenSong={handleOpenSongModal}
        accent={accent}
        darkMode={darkMode}
      />

      <Suspense fallback={null}>
        {tourDrawer.open && (
          <TourMatrixDrawer
            open={tourDrawer.open}
            group={tourDrawer.group}
            matrix={tourDrawer.matrix}
            loading={tourDrawer.loading}
            onClose={handleCloseTourMatrix}
            onOpenSong={handleOpenSongModal}
            accent={accent}
            rareAccent={rareAccent}
            darkMode={darkMode}
          />
        )}
        {songModal.open && (
          <SongDetailModal
            open={songModal.open}
            detail={songModal.detail}
            loading={songModal.loading}
            onClose={handleCloseSongModal}
            accent={accent}
          />
        )}
      </Suspense>

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
    </ThemeProvider>
  );
};

export default HomePage;
