import React from 'react';
import { Box, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { LiveShow } from '../services/staticDataService';

interface ShowCardProps {
  show: LiveShow;
  selected: boolean;
  accent: string;
  onToggle: (showId: number, nextSelected: boolean) => void;
}

const formatDate = (iso: string) => iso.replace(/-/g, '.');

const ShowCard: React.FC<ShowCardProps> = ({ show, selected, accent, onToggle }) => {
  const handleClick = () => onToggle(show.id, !selected);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onToggle(show.id, !selected);
    }
  };

  return (
    <Box
      role="checkbox"
      aria-checked={selected}
      aria-label={`${formatDate(show.date)} · ${show.performance_name}`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'relative',
        p: 2.5,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? accent : 'divider',
        backgroundColor: 'background.paper',
        transition: 'border-color 140ms ease',
        outline: 'none',
        '&:hover': {
          borderColor: selected ? accent : 'text.primary',
        },
        '&:focus-visible': {
          borderColor: accent,
          boxShadow: `0 0 0 2px ${accent}40`,
        },
      }}
    >
      {selected && (
        <Box
          aria-hidden
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

export default React.memo(ShowCard);
