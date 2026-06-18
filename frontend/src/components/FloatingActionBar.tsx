import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import AnalysisPanel, {
  AnalysisMode,
  AnalysisSnapshot,
  SortDir,
  SortKey,
} from './AnalysisPanel';

interface FloatingActionBarProps {
  selectedCount: number;
  heardAnalysis: AnalysisSnapshot | null;
  missedAnalysis: AnalysisSnapshot | null;
  analysisLoading: boolean;
  analysisExpanded: boolean;
  onToggleExpanded: () => void;
  analysisTab: AnalysisMode;
  onAnalysisTabChange: (next: AnalysisMode) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
  onOpenSong: (songId: number) => void;
  accent: string;
  darkMode: boolean;
}

const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  selectedCount,
  heardAnalysis,
  missedAnalysis,
  analysisLoading,
  analysisExpanded,
  onToggleExpanded,
  analysisTab,
  onAnalysisTabChange,
  sortKey,
  sortDir,
  onToggleSort,
  onOpenSong,
  accent,
  darkMode,
}) => {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  const heardRate = heardAnalysis ? (heardAnalysis.completionRate * 100).toFixed(1) : '—';
  const missedRate = missedAnalysis ? (missedAnalysis.completionRate * 100).toFixed(1) : '—';

  const activeAnalysis = analysisTab === 'heard' ? heardAnalysis : missedAnalysis;

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
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: 'column', py: 1.5 }}>
        <Box sx={{ width: '100%', position: 'relative' }}>
          <Box
            component="button"
            type="button"
            onClick={onToggleExpanded}
            disabled={analysisLoading && !heardAnalysis && !missedAnalysis}
            aria-expanded={analysisExpanded}
            sx={{
              width: '100%',
              appearance: 'none',
              border: 'none',
              background: analysisExpanded
                ? darkMode
                  ? 'rgba(255,255,255,0.04)'
                  : `${accent}0a`
                : 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
              p: 0,
              borderRadius: 1,
              transition: 'background-color 180ms ease',
              '&:disabled': { cursor: 'progress', opacity: 0.6 },
              '&:hover:not(:disabled)': {
                background: darkMode ? 'rgba(255,255,255,0.03)' : `${accent}08`,
              },
              '&:focus-visible': {
                outline: `2px solid ${accent}`,
                outlineOffset: 2,
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1.5, sm: 2 },
                flexWrap: 'wrap',
                px: 0.5,
                py: 0.75,
                position: 'relative',
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

              {[
                { label: t('analysis.completionRate'), value: heardRate },
                { label: t('analysis.incompletionRate'), value: missedRate },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    minWidth: { xs: 104, sm: 124 },
                    borderLeft: { xs: 'none', sm: '1px solid' },
                    borderColor: 'divider',
                    pl: { xs: 0, sm: 2 },
                  }}
                >
                  <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block' }}>
                    ── {item.label}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                    <Typography
                      sx={{
                        fontFeatureSettings: '"tnum"',
                        fontWeight: 600,
                        color: 'text.primary',
                      }}
                    >
                      {analysisLoading ? t('common.loading') : item.value}
                    </Typography>
                    {!analysisLoading && item.value !== '—' && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        %
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}

              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -10,
                  transform: analysisExpanded
                    ? 'translateX(-50%) rotate(180deg)'
                    : 'translateX(-50%) rotate(0deg)',
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  color: accent,
                  backgroundColor: darkMode ? `${accent}1f` : `${accent}14`,
                  border: '1px solid',
                  borderColor: darkMode ? `${accent}55` : `${accent}33`,
                  boxShadow: darkMode
                    ? '0 6px 18px rgba(0,0,0,0.28)'
                    : `0 6px 18px ${accent}2e`,
                  transition: 'transform 220ms ease, background-color 180ms ease, box-shadow 180ms ease',
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                  },
                }}
              >
                <ExpandMoreIcon fontSize="small" />
              </Box>
            </Box>
          </Box>
        </Box>

        {analysisExpanded && (
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
        )}
      </Container>
    </Box>
  );
};

export default FloatingActionBar;
