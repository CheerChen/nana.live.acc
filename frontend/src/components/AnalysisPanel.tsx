import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SongAnalysis } from '../services/staticDataService';

export type SortKey = 'hit_count' | 'total_appearances' | 'selection_rate' | 'song_name';
export type SortDir = 'asc' | 'desc';
export type AnalysisMode = 'heard' | 'missed';

export interface AnalysisSnapshot {
  songs: SongAnalysis[];
  completionRate: number;
  totalSongs: number;
}

interface AnalysisPanelProps {
  analysisTab: AnalysisMode;
  onAnalysisTabChange: (next: AnalysisMode) => void;
  activeAnalysis: AnalysisSnapshot | null;
  analysisLoading: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
  onOpenSong: (songId: number) => void;
  accent: string;
  darkMode: boolean;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysisTab,
  onAnalysisTabChange,
  activeAnalysis,
  analysisLoading,
  sortKey,
  sortDir,
  onToggleSort,
  onOpenSong,
  accent,
  darkMode,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const activeSongs = useMemo(() => activeAnalysis?.songs ?? [], [activeAnalysis]);
  const totalForRate = activeAnalysis?.totalSongs ?? 0;
  const rateValue = activeAnalysis ? (activeAnalysis.completionRate * 100).toFixed(1) : '—';

  const sortedSongs = useMemo(() => {
    const copy = [...activeSongs];
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
  }, [activeSongs, sortKey, sortDir]);

  const ANALYSIS_ROW_LIMIT = 50;
  const displayedSongs = useMemo(
    () => sortedSongs.slice(0, ANALYSIS_ROW_LIMIT),
    [sortedSongs],
  );
  const truncatedCount = sortedSongs.length - displayedSongs.length;

  const maxHit = useMemo(
    () => displayedSongs.reduce((m, s) => Math.max(m, s.hit_count || 0), 0),
    [displayedSongs],
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          pb: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px 1fr' },
          gap: { xs: 2, md: 4 },
          alignItems: 'end',
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography
              sx={{
                fontFamily: '"Shippori Mincho", serif',
                fontSize: { xs: 40, md: 52 },
                fontWeight: 600,
                lineHeight: 1,
                color: accent,
                fontFeatureSettings: '"tnum"',
                letterSpacing: '-0.02em',
              }}
            >
              {analysisLoading && !activeAnalysis ? t('common.loading') : rateValue}
            </Typography>
            {!analysisLoading && activeAnalysis && (
              <Typography sx={{ fontSize: 20, color: accent, fontWeight: 500 }}>%</Typography>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {analysisTab === 'heard'
              ? t('analysis.completionDescription')
              : t('analysis.incompletionDescription')}
          </Typography>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Tabs
            value={analysisTab}
            onChange={(_, next: AnalysisMode) => onAnalysisTabChange(next)}
            textColor="primary"
            indicatorColor="primary"
            variant="fullWidth"
            sx={{
              minHeight: 0,
              mb: 1,
              '& .MuiTab-root': {
                minHeight: 0,
                px: 1.5,
                py: 1,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.14em',
              },
            }}
          >
            <Tab value="heard" label={t('analysis.resultTitle')} />
            <Tab value="missed" label={t('analysis.reverseResultTitle')} />
          </Tabs>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px solid',
              borderColor: 'divider',
              py: 1,
            }}
          >
            <Typography variant="overline" color="text.secondary">
              {analysisTab === 'heard' ? t('analysis.resultTitle') : t('analysis.reverseResultTitle')}
            </Typography>
            <Typography sx={{ fontFeatureSettings: '"tnum"', fontWeight: 600, fontSize: 15 }}>
              {activeSongs.length} / {totalForRate}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1 }}>
            {analysisTab === 'heard' ? t('analysis.subtitle') : t('analysis.reverseSubtitle')}
          </Typography>
        </Box>
      </Box>

      {analysisLoading && !activeAnalysis && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress size={24} sx={{ color: accent }} />
        </Box>
      )}

      {!analysisLoading && activeAnalysis && activeSongs.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          {analysisTab === 'heard' ? t('analysis.subtitle') : t('analysis.reverseSubtitle')}
        </Alert>
      )}

      {activeAnalysis && activeSongs.length > 0 && (
        <TableContainer
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Table stickyHeader size={isMobile ? 'small' : 'medium'} sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ '& th': { border: 0, borderBottom: '1px solid', borderColor: 'divider' } }}>
                <TableCell sx={{ width: 56, color: 'text.secondary', backgroundColor: 'background.default' }}>
                  <Typography variant="overline">#</Typography>
                </TableCell>
                <TableCell sx={{ backgroundColor: 'background.default' }}>
                  <TableSortLabel
                    active={sortKey === 'song_name'}
                    direction={sortKey === 'song_name' ? sortDir : 'asc'}
                    onClick={() => onToggleSort('song_name')}
                  >
                    <Typography variant="overline">{t('table.songName')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: { xs: 80, md: 140 }, backgroundColor: 'background.default' }}>
                  <TableSortLabel
                    active={sortKey === 'hit_count'}
                    direction={sortKey === 'hit_count' ? sortDir : 'desc'}
                    onClick={() => onToggleSort('hit_count')}
                  >
                    <Typography variant="overline">{t('table.hitCount')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    width: { xs: 80, md: 120 },
                    display: { xs: 'none', sm: 'table-cell' },
                    backgroundColor: 'background.default',
                  }}
                >
                  <TableSortLabel
                    active={sortKey === 'total_appearances'}
                    direction={sortKey === 'total_appearances' ? sortDir : 'desc'}
                    onClick={() => onToggleSort('total_appearances')}
                  >
                    <Typography variant="overline">{t('table.totalAppearances')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: { xs: 80, md: 100 }, backgroundColor: 'background.default' }}>
                  <TableSortLabel
                    active={sortKey === 'selection_rate'}
                    direction={sortKey === 'selection_rate' ? sortDir : 'desc'}
                    onClick={() => onToggleSort('selection_rate')}
                  >
                    <Typography variant="overline">{t('table.selectionRate')}</Typography>
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    width: { md: '32%' },
                    display: { xs: 'none', md: 'table-cell' },
                    backgroundColor: 'background.default',
                  }}
                >
                  <Typography variant="overline">{t('table.latestPerformance')}</Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedSongs.map((row, idx) => {
                const rate = Number(row.selection_rate) || 0;
                const hit = row.hit_count || 0;
                const barWidth = maxHit > 0 ? (hit / maxHit) * 100 : 0;
                return (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => onOpenSong(row.id)}
                    sx={{
                      cursor: 'pointer',
                      '& td': { border: 0, borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
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
                    <TableCell align="right" sx={{ fontFeatureSettings: '"tnum"', color: 'text.secondary' }}>
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
          {truncatedCount > 0 && (
            <Typography
              sx={{
                mt: 1.5,
                px: 2,
                pb: 1,
                fontSize: 11,
                color: 'text.disabled',
                letterSpacing: '0.04em',
                display: 'block',
              }}
            >
              {t('labels.moreCount', { n: truncatedCount })}
            </Typography>
          )}
        </TableContainer>
      )}
    </Box>
  );
};

export default AnalysisPanel;
