# Open Graph card (public/og.png)

1200×630, rendered once from `card.html` with the site's fonts (Google Fonts) so it looks the same everywhere. To update, edit `card.html` or retake the screenshots, then run:

    npx playwright screenshot --viewport-size=1200,630 --wait-for-timeout=2500 "file://$PWD/design/og/card.html" public/og.png
