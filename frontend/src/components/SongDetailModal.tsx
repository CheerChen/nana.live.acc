import React from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { SongDetail } from '../services/staticDataService';

type Translator = (key: string, opts?: Record<string, unknown>) => string;

const formatDate = (iso: string) => iso.replace(/-/g, '.');

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

interface SongDetailModalProps {
  open: boolean;
  detail: SongDetail | null;
  loading: boolean;
  onClose: () => void;
  accent: string;
}

const SongDetailModal: React.FC<SongDetailModalProps> = ({
  open,
  detail,
  loading,
  onClose,
  accent,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const maxYearCount = detail ? detail.timeline.reduce((m, x) => Math.max(m, x.count), 0) : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          {t('labels.songSection')}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: accent }} />
        </Box>
      )}

      {!loading && detail && (
        <Box sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 3, sm: 4 } }}>
          <Typography
            component="h2"
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
              { label: t('labels.kpiAllTime'), value: String(detail.all_time_plays) },
              { label: t('labels.kpiRate'), value: `${(detail.play_rate * 100).toFixed(1)}%` },
              {
                label: t('labels.kpiLatest'),
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

          {detail.timeline.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', letterSpacing: '0.22em', display: 'block', mb: 1.5 }}
              >
                {t('labels.timelineSection')}
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

          {detail.recent_appearances.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', letterSpacing: '0.22em', display: 'block', mb: 1.5 }}
              >
                {t('labels.recentSection')}
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
                  {t('labels.moreCount', {
                    n: detail.all_time_plays - detail.recent_appearances.length,
                  })}
                </Typography>
              )}
            </Box>
          )}

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
                  '&:focus-visible': { textDecoration: 'underline', outline: 'none' },
                }}
              >
                {t('labels.sourceLink')}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Dialog>
  );
};

export default SongDetailModal;
