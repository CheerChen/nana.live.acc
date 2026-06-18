import React from 'react';
import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'ja', label: 'JA' },
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中' },
];

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const current = i18n.language?.slice(0, 2) || 'en';

  return (
    <Box
      role="group"
      aria-label="language"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        fontSize: 12,
        letterSpacing: '0.16em',
        fontWeight: 600,
      }}
    >
      {languages.map((lang, idx) => {
        const active = current === lang.code;
        return (
          <React.Fragment key={lang.code}>
            {idx > 0 && (
              <Box
                aria-hidden
                sx={{
                  width: '1px',
                  height: 10,
                  backgroundColor: 'divider',
                }}
              />
            )}
            <Box
              component="button"
              type="button"
              onClick={() => i18n.changeLanguage(lang.code)}
              aria-pressed={active}
              aria-label={`Switch language to ${lang.code.toUpperCase()}`}
              sx={{
                appearance: 'none',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                letterSpacing: 'inherit',
                color: active ? theme.palette.primary.main : 'text.secondary',
                transition: 'color 120ms ease',
                outline: 'none',
                '&:hover': { color: active ? theme.palette.primary.main : 'text.primary' },
                '&:focus-visible': {
                  color: theme.palette.primary.main,
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                },
              }}
            >
              {lang.label}
            </Box>
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default LanguageSwitcher;
