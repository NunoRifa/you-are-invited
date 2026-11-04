module.exports = {
  content: ['./apps/api/private-pages/yt-wedding/index.html', './apps/api/private-pages/yt-wedding/assets/js/*.js'],
  theme: {
    extend: {
      colors: {
        'yt-bg': 'var(--yt-bg)', 'yt-card': 'var(--yt-card)', 'yt-text': 'var(--yt-ink)',
        'yt-gray': 'var(--yt-gray)', 'yt-border': 'var(--yt-border)',
        'yt-blue': 'var(--yt-accent-2)', 'yt-red': 'var(--yt-accent)',
        'yt-gradient-1': 'var(--yt-gradient-1)', 'yt-gradient-2': 'var(--yt-gradient-2)',
        'yt-gradient-3': 'var(--yt-gradient-3)', 'yt-gradient-4': 'var(--yt-gradient-4)',
        'yt-gradient-5': 'var(--yt-gradient-5)',
      },
      fontFamily: { sans: ['Roboto', 'Arial', 'sans-serif'] },
    },
  },
};
