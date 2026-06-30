import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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

// ── Analysis reducer ───────────────────────────────────────────────
// Groups all analysis-related state so one logical update does not fan
// out into separate setState calls and extra renders.
interface AnalysisState {
  heard: AnalysisSnapshot | null;
  missed: AnalysisSnapshot | null;
  loading: boolean;
  tab: AnalysisMode;
  error: string | null;
  showRestoredMessage: boolean;
}

type AnalysisAction =
  | { type: 'SET_TAB'; tab: AnalysisMode }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_SUCCESS'; heard: AnalysisSnapshot; missed: AnalysisSnapshot }
  | { type: 'ANALYSIS_ERROR'; error: string }
  | { type: 'CLEAR_ANALYSIS' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'DISMISS_RESTORED' };

const initialAnalysisState: AnalysisState = {
  heard: null,
  missed: null,
  loading: false,
  tab: 'heard',
  error: null,
  showRestoredMessage: false,
};

function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, tab: action.tab };
    case 'START_ANALYSIS':
      return { ...state, loading: true };
    case 'ANALYSIS_SUCCESS':
      return {
        ...state,
        heard: action.heard,
        missed: action.missed,
        loading: false,
        error: null,
      };
    case 'ANALYSIS_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'CLEAR_ANALYSIS':
      return { ...state, heard: null, missed: null, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'DISMISS_RESTORED':
      return { ...state, showRestoredMessage: false };
    default:
      return state;
  }
}

// ── Theme hook ─────────────────────────────────────────────────────
function useAppTheme(darkMode: boolean, accent: string, accentHover: string, accentActive: string) {
  return useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: { main: accent, light: accentHover, dark: accentActive, contrastText: '#FFFFFF' },
          secondary: { main: darkMode ? '#F5F5F5' : '#111111' },
          background: { default: darkMode ? '#0E0E10' : '#FAFAFA', paper: darkMode ? '#16161A' : '#FFFFFF' },
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
}

// ── App header ─────────────────────────────────────────────────────
interface AppHeaderProps {
  darkMode: boolean;
  accent: string;
  onToggleDarkMode: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ darkMode, accent, onToggleDarkMode }) => {
  const { t } = useTranslation();
  return (
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
          <Typography variant="body1" sx={{ fontWeight: 700, letterSpacing: '0.18em', fontSize: 13 }}>
            {t('app.brand')}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', letterSpacing: '0.18em', display: { xs: 'none', sm: 'inline' } }}
          >
            / {t('app.headerTagline')}
          </Typography>
        </Box>
        <LanguageSwitcher />
        <Tooltip title={t('settings.darkMode')}>
          <IconButton aria-label={t('settings.darkMode')} onClick={onToggleDarkMode} color="inherit" size="small">
            {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};

// ── Hero section ───────────────────────────────────────────────────
const HeroSection: React.FC<{ accent: string }> = ({ accent }) => {
  const { t } = useTranslation();
  return (
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
            sx={{ color: 'text.secondary', fontSize: { xs: 14, md: 16 }, maxWidth: 560, lineHeight: 1.7 }}
          >
            {t('app.subtitle')}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

// ── State hook ─────────────────────────────────────────────────────
// Encapsulates all state, effects, and handlers so the HomePage component
// stays small and focused on layout.
function useHomePageState() {
  const { t } = useTranslation();

  const [analysisState, analysisDispatch] = useReducer(analysisReducer, undefined, () => ({
    ...initialAnalysisState,
    showRestoredMessage: loadSelectedShowIds().isRestored,
  }));
  const [darkMode, setDarkMode] = useState<boolean>(loadThemeMode);
  const [showsState, setShowsState] = useState<{ shows: ShowGroup[]; loading: boolean; error: string | null }>({
    shows: [],
    loading: true,
    error: null,
  });
  const [selectedShowIds, setSelectedShowIds] = useState<Set<number>>(
    () => new Set(loadSelectedShowIds().ids),
  );
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [sortState, setSortState] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'hit_count',
    dir: 'desc',
  });
  const [drawers, setDrawers] = useState<{
    rightPanel: {
      open: boolean;
      type: RightPanelType | null;
      group: ShowGroup | null;
      matrix: TourMatrix | null;
      matrixLoading: boolean;
    };
    songModal: { open: boolean; detail: SongDetail | null; loading: boolean };
  }>({
    rightPanel: { open: false, type: null, group: null, matrix: null, matrixLoading: false },
    songModal: { open: false, detail: null, loading: false },
  });

  const setRightPanel = useCallback(
    (updater: (prev: typeof drawers.rightPanel) => typeof drawers.rightPanel) =>
      setDrawers((d) => ({ ...d, rightPanel: updater(d.rightPanel) })),
    [],
  );
  const setSongModal = useCallback(
    (updater: (prev: typeof drawers.songModal) => typeof drawers.songModal) =>
      setDrawers((d) => ({ ...d, songModal: updater(d.songModal) })),
    [],
  );

  // Theme-aware accents. Dark-mode magenta is the brightened palette that
  // passes WCAG AA; light mode uses indigo blue. The "rare" marker uses the
  // opposite hue so it always stands out from the primary.
  const accent = darkMode ? MAGENTA_DARK : BLUE;
  const accentHover = darkMode ? MAGENTA_DARK_HOVER : BLUE_HOVER;
  const accentActive = darkMode ? MAGENTA_DARK_ACTIVE : BLUE_ACTIVE;
  const rareAccent = darkMode ? SKY_BLUE : MAGENTA;

  // Load grouped shows once on mount. A ref guard prevents re-fetching when
  // the `t` dependency changes (language switch). Loading starts as `true`
  // in the initial state so the effect only needs to set state on completion.
  const didLoadShowsRef = useRef(false);
  useEffect(() => {
    if (didLoadShowsRef.current) return;
    didLoadShowsRef.current = true;
    let cancelled = false;
    staticDataService
      .getGroupedShows()
      .then((groups) => {
        if (!cancelled) setShowsState({ shows: groups, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load grouped shows:', err);
        setShowsState((s) => ({ ...s, loading: false, error: t('errors.loadShowsFailed') }));
      });
    return () => { cancelled = true; };
  }, [t]);

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
        showsState.shows.forEach((g) => g.shows.forEach((s) => all.add(s.id)));
        setSelectedShowIds(all);
      } else {
        setSelectedShowIds(new Set());
      }
    },
    [showsState.shows],
  );

  const handleOpenTourMatrix = useCallback(async (group: ShowGroup) => {
    setRightPanel(() => ({
      open: true,
      type: 'setlist' as const,
      group,
      matrix: null,
      matrixLoading: true,
    }));
    try {
      const matrix = await staticDataService.getTourMatrix(group.shows.map((s) => s.id));
      setRightPanel((d) => ({ ...d, matrix, matrixLoading: false }));
    } catch (err) {
      console.error('Failed to load tour matrix:', err);
      setRightPanel((d) => ({ ...d, matrixLoading: false }));
    }
  }, [setRightPanel]);

  const handleToggleAnalysis = useCallback(() => {
    setRightPanel((d) => {
      if (d.open && d.type === 'analysis') return { ...d, open: false };
      return { ...d, open: true, type: 'analysis' };
    });
  }, [setRightPanel]);

  const handleCloseRightPanel = useCallback(() => {
    setRightPanel((d) => ({ ...d, open: false }));
  }, [setRightPanel]);

  const handleOpenSongModal = useCallback(async (songId: number) => {
    setSongModal(() => ({ open: true, detail: null, loading: true }));
    try {
      const detail = await staticDataService.getSongDetail(songId);
      setSongModal(() => ({ open: true, detail, loading: false }));
    } catch (err) {
      console.error('Failed to load song detail:', err);
      setSongModal(() => ({ open: false, detail: null, loading: false }));
    }
  }, [setSongModal]);

  const handleCloseSongModal = useCallback(() => {
    setSongModal((m) => ({ ...m, open: false }));
  }, [setSongModal]);

  const handleToggleSort = useCallback((key: SortKey) => {
    setSortState((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: key === 'song_name' ? 'asc' : 'desc' };
    });
  }, []);

  const selectedCount = selectedShowIds.size;

  // Close the analysis drawer inline when selection becomes empty.
  const prevSelectedCountRef = useRef(selectedCount);
  if (selectedCount !== prevSelectedCountRef.current) {
    prevSelectedCountRef.current = selectedCount;
    if (selectedCount === 0) {
      setRightPanel((d) => (d.type === 'analysis' ? { ...d, open: false } : d));
    }
  }

  // Reset sort defaults inline when the analysis tab changes.
  const prevAnalysisTabRef = useRef(analysisState.tab);
  if (analysisState.tab !== prevAnalysisTabRef.current) {
    prevAnalysisTabRef.current = analysisState.tab;
    setSortState({
      key: analysisState.tab === 'heard' ? 'hit_count' : 'selection_rate',
      dir: 'desc',
    });
  }

  // Debounce localStorage writes so rapid toggles don't spam sync IO.
  const storageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selectedCount === 0) {
      if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
      return;
    }
    const ids = Array.from(selectedShowIds);
    if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
    storageTimerRef.current = setTimeout(() => saveSelectedShowIds(ids), STORAGE_DEBOUNCE_MS);
    return () => { if (storageTimerRef.current) clearTimeout(storageTimerRef.current); };
  }, [selectedShowIds, selectedCount]);

  useEffect(() => {
    if (selectedShowIds.size === 0) {
      analysisDispatch({ type: 'CLEAR_ANALYSIS' });
      return;
    }
    const showIds = Array.from(selectedShowIds);
    let cancelled = false;
    analysisDispatch({ type: 'START_ANALYSIS' });
    Promise.all([
      staticDataService.analyzeSongs(showIds),
      staticDataService.analyzeReverseSongs(showIds),
    ])
      .then(([heard, missed]) => {
        if (cancelled) return;
        analysisDispatch({
          type: 'ANALYSIS_SUCCESS',
          heard: { songs: heard.songs, completionRate: heard.completion_rate, totalSongs: heard.total_songs },
          missed: { songs: missed.songs, completionRate: missed.completion_rate, totalSongs: missed.total_songs },
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Analysis failed:', err);
        analysisDispatch({ type: 'ANALYSIS_ERROR', error: t('errors.analysisFailed') });
      });
    return () => { cancelled = true; };
  }, [selectedShowIds, t]);

  return {
    t, analysisState, analysisDispatch, darkMode, setDarkMode,
    showsState, setShowsState, selectedShowIds, groupFilter, setGroupFilter,
    sortState, drawers, accent, accentHover, accentActive, rareAccent,
    selectedCount,
    handleToggleShow, handleToggleGroup, handleSelectAll,
    handleOpenTourMatrix, handleToggleAnalysis, handleCloseRightPanel,
    handleOpenSongModal, handleCloseSongModal, handleToggleSort,
  };
}

// ── HomePage component ─────────────────────────────────────────────
const HomePage: React.FC = () => {
  const {
    t, analysisState, analysisDispatch, darkMode, setDarkMode,
    showsState, setShowsState, selectedShowIds, groupFilter, setGroupFilter,
    sortState, drawers, accent, accentHover, accentActive, rareAccent,
    selectedCount, handleToggleShow, handleToggleGroup, handleSelectAll,
    handleOpenTourMatrix, handleToggleAnalysis, handleCloseRightPanel,
    handleOpenSongModal, handleCloseSongModal, handleToggleSort,
  } = useHomePageState();

  const theme = useAppTheme(darkMode, accent, accentHover, accentActive);

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

      <AppHeader
        darkMode={darkMode}
        accent={accent}
        onToggleDarkMode={() => {
          const next = !darkMode;
          setDarkMode(next);
          saveThemeMode(next);
        }}
      />

      <HeroSection accent={accent} />

      <Container
        component="main"
        maxWidth="lg"
        sx={{ pb: selectedCount > 0 ? { xs: 14, sm: 12 } : 0 }}
      >
        <SelectPanel
          groupedShows={showsState.shows}
          multiSelectLoading={showsState.loading}
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

        {(analysisState.error || showsState.error) && (
          <Alert
            severity="error"
            onClose={() => {
              if (analysisState.error) analysisDispatch({ type: 'CLEAR_ERROR' });
              if (showsState.error) setShowsState((s) => ({ ...s, error: null }));
            }}
            sx={{ mb: 2, borderRadius: 0 }}
          >
            {analysisState.error || showsState.error}
          </Alert>
        )}
      </Container>

      <FloatingActionBar
        selectedCount={selectedCount}
        heardAnalysis={analysisState.heard}
        missedAnalysis={analysisState.missed}
        analysisLoading={analysisState.loading}
        analysisActive={drawers.rightPanel.open && drawers.rightPanel.type === 'analysis'}
        onToggleAnalysis={handleToggleAnalysis}
        accent={accent}
        darkMode={darkMode}
      />

      {/* Two Suspense boundaries so loading SongDetailModal's chunk
          doesn't unmount the right drawer mid-interaction. */}
      <Suspense fallback={null}>
        {(drawers.rightPanel.open || drawers.rightPanel.type !== null) && (
          <RightDrawer
            open={drawers.rightPanel.open}
            type={drawers.rightPanel.type}
            onClose={handleCloseRightPanel}
            group={drawers.rightPanel.group}
            matrix={drawers.rightPanel.matrix}
            matrixLoading={drawers.rightPanel.matrixLoading}
            heardAnalysis={analysisState.heard}
            missedAnalysis={analysisState.missed}
            analysisLoading={analysisState.loading}
            analysisTab={analysisState.tab}
            onAnalysisTabChange={(tab) => analysisDispatch({ type: 'SET_TAB', tab })}
            sortKey={sortState.key}
            sortDir={sortState.dir}
            onToggleSort={handleToggleSort}
            onOpenSong={handleOpenSongModal}
            accent={accent}
            rareAccent={rareAccent}
            darkMode={darkMode}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {drawers.songModal.open && (
          <SongDetailModal
            open={drawers.songModal.open}
            detail={drawers.songModal.detail}
            loading={drawers.songModal.loading}
            onClose={handleCloseSongModal}
            accent={accent}
          />
        )}
      </Suspense>

      <Snackbar
        open={analysisState.showRestoredMessage}
        autoHideDuration={5000}
        onClose={() => analysisDispatch({ type: 'DISMISS_RESTORED' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          onClose={() => analysisDispatch({ type: 'DISMISS_RESTORED' })}
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
