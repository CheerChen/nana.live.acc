import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  GridView as GridViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { LiveShow } from '../services/staticDataService';
import ShowCard from './ShowCard';

export interface ShowGroup {
  groupName: string;
  shows: LiveShow[];
}

interface SelectPanelProps {
  groupedShows: ShowGroup[];
  multiSelectLoading: boolean;
  selectedShowIds: Set<number>;
  groupFilter: string;
  accent: string;
  darkMode: boolean;
  onGroupFilterChange: (value: string) => void;
  onToggleShow: (showId: number, nextSelected: boolean) => void;
  onToggleGroup: (group: ShowGroup, nextSelected: boolean) => void;
  onSelectAll: (selectAll: boolean) => void;
  onOpenTourMatrix: (group: ShowGroup) => void;
}

const SelectPanel: React.FC<SelectPanelProps> = ({
  groupedShows,
  multiSelectLoading,
  selectedShowIds,
  groupFilter,
  accent,
  darkMode,
  onGroupFilterChange,
  onToggleShow,
  onToggleGroup,
  onSelectAll,
  onOpenTourMatrix,
}) => {
  const { t } = useTranslation();

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

  const hasFilter = groupFilter.trim().length > 0;
  const showCount = filteredGroups.reduce((acc, g) => acc + g.shows.length, 0);

  return (
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
            {showCount} {t('multiSelect.showCount')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder={t('search.placeholder')}
            value={groupFilter}
            onChange={(e) => onGroupFilterChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.secondary' }} fontSize="small" />,
              endAdornment: hasFilter ? (
                <IconButton
                  size="small"
                  onClick={() => onGroupFilterChange('')}
                  aria-label={t('search.clear')}
                  sx={{ mr: -0.5 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              ) : null,
            }}
            sx={{ minWidth: { xs: '100%', sm: 260 } }}
          />
          <Button
            variant="text"
            size="small"
            onClick={() => onSelectAll(true)}
            sx={{ color: 'text.secondary' }}
          >
            {t('multiSelect.selectAll')}
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => onSelectAll(false)}
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
          {hasFilter ? t('multiSelect.noMatches') : t('multiSelect.noShows')}
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
                    onClick={() => onOpenTourMatrix(group)}
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
                        backgroundColor: `${accent}24`,
                      },
                    }}
                  >
                    {t('labels.showSetlistButton')}
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
                  onClick={() => onToggleGroup(group, !allSelected)}
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
                {group.shows.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    selected={selectedShowIds.has(show.id)}
                    accent={accent}
                    onToggle={onToggleShow}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
    </Box>
  );
};

export default SelectPanel;
