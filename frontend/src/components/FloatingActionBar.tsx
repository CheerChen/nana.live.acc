import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AnalysisSnapshot } from './AnalysisPanel';

interface FloatingActionBarProps {
  selectedCount: number;
  heardAnalysis: AnalysisSnapshot | null;
  missedAnalysis: AnalysisSnapshot | null;
  analysisLoading: boolean;
  analysisActive: boolean;
  onToggleAnalysis: () => void;
  accent: string;
  darkMode: boolean;
}

const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  selectedCount,
  heardAnalysis,
  missedAnalysis,
  analysisLoading,
  analysisActive,
  onToggleAnalysis,
  accent,
  darkMode,
}) => {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  const heardRate = heardAnalysis ? (heardAnalysis.completionRate * 100).toFixed(1) : '—';
  const missedRate = missedAnalysis ? (missedAnalysis.completionRate * 100).toFixed(1) : '—';

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
      <Container maxWidth="lg" sx={{ py: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
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

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1.5, sm: 2 },
              flexGrow: 1,
              minWidth: 0,
              flexWrap: 'wrap',
            }}
          >
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
          </Box>

          <Button
            variant={analysisActive ? 'contained' : 'outlined'}
            size="small"
            onClick={onToggleAnalysis}
            disabled={analysisLoading && !heardAnalysis && !missedAnalysis}
            sx={{
              flexShrink: 0,
              borderColor: accent,
              color: analysisActive ? '#fff' : accent,
              backgroundColor: analysisActive ? accent : 'transparent',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              px: 1.5,
              py: 0.5,
              whiteSpace: 'nowrap',
              '&:hover': {
                borderColor: accent,
                backgroundColor: analysisActive ? accent : `${accent}14`,
              },
              '&:focus-visible': {
                outline: `2px solid ${accent}`,
                outlineOffset: 2,
              },
            }}
          >
            {analysisActive ? t('labels.closeDetails') : t('labels.openDetails')}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default FloatingActionBar;
