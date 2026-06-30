import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { TourMatrix } from '../services/staticDataService';
import { ShowGroup } from './SelectPanel';
import AnalysisPanel, {
  AnalysisMode,
  AnalysisSnapshot,
  SortDir,
  SortKey,
} from './AnalysisPanel';

export type RightPanelType = 'setlist' | 'analysis';

interface RightDrawerProps {
  open: boolean;
  type: RightPanelType | null;
  onClose: () => void;

  // Setlist props
  group: ShowGroup | null;
  matrix: TourMatrix | null;
  matrixLoading: boolean;

  // Analysis props
  heardAnalysis: AnalysisSnapshot | null;
  missedAnalysis: AnalysisSnapshot | null;
  analysisLoading: boolean;
  analysisTab: AnalysisMode;
  onAnalysisTabChange: (next: AnalysisMode) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;

  // Shared
  onOpenSong: (songId: number) => void;
  accent: string;
  rareAccent: string;
  darkMode: boolean;
}

const CROSSFADE_MS = 150;
const formatDate = (iso: string) => iso.replace(/-/g, '.');

const RightDrawer: React.FC<RightDrawerProps> = ({
  open,
  type,
  onClose,
  group,
  matrix,
  matrixLoading,
  heardAnalysis,
  missedAnalysis,
  analysisLoading,
  analysisTab,
  onAnalysisTabChange,
  sortKey,
  sortDir,
  onToggleSort,
  onOpenSong,
  accent,
  rareAccent,
  darkMode,
}) => {
  const { t } = useTranslation();

  // Single display-state object holds the crossfade animation state so we
  // avoid cascading setState calls and prop-derived useState.
  const [display, setDisplay] = useState<{
    displayedType: RightPanelType | null;
    bodyVisible: boolean;
    pendingType: RightPanelType | null;
  }>({
    displayedType: null,
    bodyVisible: true,
    pendingType: null,
  });

  // Track previous props to detect changes inline during render (no effect).
  // Refs are used instead of useState because these values are never shown.
  const prevOpenRef = useRef<boolean | null>(null);
  const prevTypeRef = useRef<RightPanelType | null | undefined>(undefined);

  if (open !== prevOpenRef.current || type !== prevTypeRef.current) {
    const wasFirstRender = prevTypeRef.current === undefined;
    prevOpenRef.current = open;
    prevTypeRef.current = type;
    if (wasFirstRender || !open) {
      // First render or drawer closed: sync silently so the next open is fresh.
      setDisplay({ displayedType: type, bodyVisible: true, pendingType: null });
    } else if (type !== display.displayedType && display.pendingType !== type) {
      // Type changed while open: start the crossfade.
      setDisplay((d) => ({ ...d, bodyVisible: false, pendingType: type }));
    }
  }

  // Timed crossfade: swap the displayed type after the fade-out duration.
  useEffect(() => {
    if (display.pendingType === null) return;
    const handle = setTimeout(() => {
      setDisplay((d) => ({
        displayedType: d.pendingType,
        bodyVisible: true,
        pendingType: null,
      }));
    }, CROSSFADE_MS);
    return () => clearTimeout(handle);
  }, [display.pendingType]);

  const headerLabel =
    display.displayedType === 'analysis'
      ? t('labels.analysisSection')
      : t('labels.tourSetlistSection');

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
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
          sx={{
            color: 'text.secondary',
            letterSpacing: '0.22em',
            flexGrow: 1,
            transition: `opacity ${CROSSFADE_MS}ms ease`,
            opacity: display.bodyVisible ? 1 : 0,
          }}
        >
          {headerLabel}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          opacity: display.bodyVisible ? 1 : 0,
          transition: `opacity ${CROSSFADE_MS}ms ease`,
        }}
      >
        {display.displayedType === 'analysis' && (
          <AnalysisBody
            heardAnalysis={heardAnalysis}
            missedAnalysis={missedAnalysis}
            analysisLoading={analysisLoading}
            analysisTab={analysisTab}
            onAnalysisTabChange={onAnalysisTabChange}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={onToggleSort}
            onOpenSong={onOpenSong}
            accent={accent}
            darkMode={darkMode}
          />
        )}
        {display.displayedType === 'setlist' && (
          <SetlistBody
            group={group}
            matrix={matrix}
            matrixLoading={matrixLoading}
            onOpenSong={onOpenSong}
            accent={accent}
            rareAccent={rareAccent}
            darkMode={darkMode}
          />
        )}
      </Box>
    </Drawer>
  );
};

// ── Setlist body ───────────────────────────────────────────────────

interface SetlistBodyProps {
  group: ShowGroup | null;
  matrix: TourMatrix | null;
  matrixLoading: boolean;
  onOpenSong: (songId: number) => void;
  accent: string;
  rareAccent: string;
  darkMode: boolean;
}

const SetlistBody: React.FC<SetlistBodyProps> = ({
  group,
  matrix,
  matrixLoading,
  onOpenSong,
  accent,
  rareAccent,
  darkMode,
}) => {
  const { t } = useTranslation();

  const showCount = matrix?.shows.length ?? 0;
  const colCellWidth = showCount > 15 ? 34 : 42;
  const gridTemplate = `minmax(180px, 240px) repeat(${showCount}, ${colCellWidth}px) 64px`;

  const renderSongRow = (song: NonNullable<TourMatrix['songs']>[number]) => {
    if (!matrix) return null;
    const isCore = song.hitCount === showCount;
    const isRare = showCount > 2 && song.hitCount === 1;
    const diamondColor = isRare ? rareAccent : accent;
    return (
      <Box
        key={song.id}
        role="row"
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
          role="gridcell"
          onClick={() => onOpenSong(song.id)}
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
            '&:focus-visible': {
              outline: `2px solid ${accent}`,
              outlineOffset: 2,
            },
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
              role="gridcell"
              aria-label={played ? `played, position ${pos}` : 'not played'}
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
          role="gridcell"
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
                '@media (prefers-reduced-motion: reduce)': {
                  animation: 'none',
                },
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
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
      {group && (
        <Box sx={{ mb: 4 }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: '"Shippori Mincho", serif',
              fontSize: { xs: 24, md: 34 },
              fontWeight: 600,
              lineHeight: 1.2,
              mb: 1.5,
            }}
          >
            {group.groupName}
          </Typography>
          {matrix && matrix.shows.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontFeatureSettings: '"tnum"' }}>
              {formatDate(matrix.shows[0].date)} —{' '}
              {formatDate(matrix.shows[matrix.shows.length - 1].date)}
              {'  ·  '}
              {t('labels.tourMeta', {
                count: matrix.shows.length,
                unique: matrix.songs.length,
              })}
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
          {t('tour.noSetlist')}
        </Alert>
      )}

      {!matrixLoading && matrix && matrix.songs.length > 0 && (
        <>
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
              <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.16em' }}>
                {t('labels.core')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box component="span" sx={{ color: accent, fontSize: 12, lineHeight: 1 }}>
                ◆
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.16em' }}>
                {t('labels.rotation')}
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
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
                }}
              >
                ◆
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.16em' }}>
                {t('labels.rare')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ overflowX: 'auto' }} role="grid" aria-label={group?.groupName}>
            <Box sx={{ display: 'inline-block', minWidth: '100%' }}>
              <Box
                role="row"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: gridTemplate,
                  alignItems: 'end',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  pb: 1,
                }}
              >
                <Typography role="columnheader" variant="overline" sx={{ color: 'text.secondary', pl: 0.5 }}>
                  {t('labels.songCol')}
                </Typography>
                {matrix.shows.map((show) => (
                  <Tooltip
                    key={show.id}
                    title={`${formatDate(show.date)} · ${show.venue}`}
                    placement="top"
                  >
                    <Typography
                      role="columnheader"
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
                      {show.date.slice(5).replace('-', '.')}
                    </Typography>
                  </Tooltip>
                ))}
                <Typography
                  role="columnheader"
                  variant="overline"
                  sx={{ color: 'text.secondary', textAlign: 'right', pr: 0.5 }}
                >
                  {t('labels.hitsFraction', { n: showCount })}
                </Typography>
              </Box>

              {matrix.songs.map((s) => renderSongRow(s))}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ── Analysis body ──────────────────────────────────────────────────

interface AnalysisBodyProps {
  heardAnalysis: AnalysisSnapshot | null;
  missedAnalysis: AnalysisSnapshot | null;
  analysisLoading: boolean;
  analysisTab: AnalysisMode;
  onAnalysisTabChange: (next: AnalysisMode) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
  onOpenSong: (songId: number) => void;
  accent: string;
  darkMode: boolean;
}

const AnalysisBody: React.FC<AnalysisBodyProps> = ({
  heardAnalysis,
  missedAnalysis,
  analysisLoading,
  analysisTab,
  onAnalysisTabChange,
  sortKey,
  sortDir,
  onToggleSort,
  onOpenSong,
  accent,
  darkMode,
}) => {
  const activeAnalysis = analysisTab === 'heard' ? heardAnalysis : missedAnalysis;

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 2, md: 3 }, pb: { xs: 3, md: 4 } }}>
      <AnalysisPanel
        analysisTab={analysisTab}
        onAnalysisTabChange={onAnalysisTabChange}
        activeAnalysis={activeAnalysis}
        analysisLoading={analysisLoading}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        onOpenSong={onOpenSong}
        accent={accent}
        darkMode={darkMode}
      />
    </Box>
  );
};

export default RightDrawer;
