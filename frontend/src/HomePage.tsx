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

const RightDrawer = React.lazy(() =>
  import(/* webpackPrefetch: true */ './components/RightDrawer'),
);
const SongDetailModal = React.lazy(() =>
  import(/* webpackPrefetch: true */ './components/SongDetailModal'),
);

type RightPanelType = 'setlist' | 'analysis';

const STORAGE_KEY = 'nana-selected-shows';
const THEME_STORAGE_KEY = 'nana-theme-mode';
const EXPIRY_DAYS = 7;
const STORAGE_DEBOUNCE_MS = 200;

// Brand magenta — used as the "super rare" marker on light backgrounds where
// it clears WCAG AA contrast. Same hex also lives in the favicon theme color.
const MAGENTA = '#E5004F';
// Dark-mode magenta palette — bumped up so the accent passes 4.5:1 contrast
// on the #0E0E10 background. The legacy brand hex is retained as the active
// pressed state so the brand DNA still shows on user interaction.
const MAGENTA_DARK = '#FF2068';
const MAGENTA_DARK_HOVER = '#FF4D87';
const MAGENTA_DARK_ACTIVE = '#E5004F';
// Light-mode primary blue. Base shifted darker to clear WCAG AA on the
// #fafafa background; the previous #306eff lives on as the hover state.
const BLUE = '#175cff';
const BLUE_HOVER = '#306eff';
const BLUE_ACTIVE = '#0036C9';
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

  // Unified right-side drawer state. Both "tour setlist" and "analysis" share
  // the same drawer surface; toggling between them crossfades the body.
  const [rightPanel, setRightPanel] = useState<{
    open: boolean;
    type: RightPanelType | null;
    group: ShowGroup | null;
    matrix: TourMatrix | null;
    matrixLoading: boolean;
  }>({ open: false, type: null, group: null, matrix: null, matrixLoading: false });

  const [songModal, setSongModal] = useState<{
    open: boolean;
    detail: SongDetail | null;
    loading: boolean;
  }>({ open: false, detail: null, loading: false });

  // Theme-aware accents. Dark-mode magenta is the brightened palette that
  // passes WCAG AA; light mode uses indigo blue. The "rare" marker uses the
  // opposite hue so it always stands out from the primary.
  const accent = darkMode ? MAGENTA_DARK : BLUE;
  const accentHover = darkMode ? MAGENTA_DARK_HOVER : BLUE_HOVER;
  const accentActive = darkMode ? MAGENTA_DARK_ACTIVE : BLUE_ACTIVE;
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
            '-apple-system',
            'BlinkMacSystemFont',
            'system-ui',
            'sans-serif',
          ].join(','),
          h1: { fontFamily: '"Shippori Mincho", serif', fontWeight: 600, letterSpacing: '-0.01em' },
          h2: { fontFamily: '"Shippori Mincho", serif', fontWeight: 600, letterSpacing: '-0.01em' },
          h3: { fontFamily: '"Shippori Mincho", serif', fontWeight: 600, letterSpacing: '-0.01em' },
          h4: { fontFamily: '"Shippori Mincho", serif', fontWeight: 600 },
          h5: { fontFamily: '"Shippori Mincho", serif', fontWeight: 600 },
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
    setRightPanel({
      open: true,
      type: 'setlist',
      group,
      matrix: null,
      matrixLoading: true,
    });
    try {
      const matrix = await staticDataService.getTourMatrix(group.shows.map((s) => s.id));
      setRightPanel((d) => ({ ...d, matrix, matrixLoading: false }));
    } catch (err) {
      console.error('Failed to load tour matrix:', err);
      setRightPanel((d) => ({ ...d, matrixLoading: false }));
    }
  }, []);

  const handleToggleAnalysis = useCallback(() => {
    setRightPanel((d) => {
      if (d.open && d.type === 'analysis') {
        return { ...d, open: false };
      }
      return { ...d, open: true, type: 'analysis' };
    });
  }, []);

  const handleCloseRightPanel = useCallback(() => {
    setRightPanel((d) => ({ ...d, open: false }));
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
      // Close the right drawer if it was showing analysis for a now-empty selection.
      setRightPanel((d) => (d.type === 'analysis' ? { ...d, open: false } : d));
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

  // Editorial atmosphere: two extra-soft radial accent washes anchored at
  // opposite corners, plus a faint paper-grain SVG tiled across the page.
  // Dark mode drops the grain (the gradients alone provide enough texture).
  const grainSvg =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.07 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

  const bodyBackgroundImage = darkMode
    ? [
        `radial-gradient(ellipse 70% 55% at 85% 5%, ${accent}1F, transparent 60%)`,
        `radial-gradient(ellipse 60% 50% at 8% 92%, ${rareAccent}14, transparent 65%)`,
      ].join(', ')
    : [
        `radial-gradient(ellipse 70% 55% at 85% 5%, ${accent}14, transparent 60%)`,
        `radial-gradient(ellipse 60% 50% at 8% 92%, ${rareAccent}0F, transparent 65%)`,
        grainSvg,
      ].join(', ');

  const globalStyles = (
    <GlobalStyles
      styles={{
        body: {
          fontFeatureSettings: '"palt"',
          WebkitFontSmoothing: 'antialiased',
          minHeight: '100vh',
          backgroundImage: bodyBackgroundImage,
          backgroundAttachment: darkMode ? 'fixed, fixed' : 'fixed, fixed, fixed',
          backgroundRepeat: darkMode ? 'no-repeat, no-repeat' : 'no-repeat, no-repeat, repeat',
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
                boxShadow: `0 0 8px ${accent}80`,
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
                textShadow: `0 0 12px ${accent}33`,
              }}
            >
              ◆ {t('app.tagline')}
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontFamily: '"Shippori Mincho", serif',
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
      </Box>

      <Container
        component="main"
        maxWidth="lg"
        sx={{ pb: selectedCount > 0 ? { xs: 14, sm: 12 } : 0 }}
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
        analysisActive={rightPanel.open && rightPanel.type === 'analysis'}
        onToggleAnalysis={handleToggleAnalysis}
        accent={accent}
        darkMode={darkMode}
      />

      {/* Two Suspense boundaries so loading SongDetailModal's chunk
          doesn't unmount the right drawer mid-interaction. */}
      <Suspense fallback={null}>
        {(rightPanel.open || rightPanel.type !== null) && (
          <RightDrawer
            open={rightPanel.open}
            type={rightPanel.type}
            onClose={handleCloseRightPanel}
            group={rightPanel.group}
            matrix={rightPanel.matrix}
            matrixLoading={rightPanel.matrixLoading}
            heardAnalysis={heardAnalysis}
            missedAnalysis={missedAnalysis}
            analysisLoading={analysisLoading}
            analysisTab={analysisTab}
            onAnalysisTabChange={setAnalysisTab}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={handleToggleSort}
            onOpenSong={handleOpenSongModal}
            accent={accent}
            rareAccent={rareAccent}
            darkMode={darkMode}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
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
