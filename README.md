# Google Drive Markdown Preview

A Chrome extension that renders markdown files in Google Drive's preview mode, replacing the raw text with GitHub-style formatted HTML.

[日本語版 README はこちら](README.ja.md)

## Features

- **Automatic detection**: renders `.md` / `.markdown` files as soon as they are opened in the Drive preview
- **Toggle view**: a "Show Raw" button switches between the rendered HTML and the original text
- **GitHub-style styling**: clean, readable formatting with an optional dark theme (selected in the popup)
- **Navigation aware**: re-renders when you move between files inside the preview (keyboard navigation)
- **Local processing only**: parsing and sanitizing happen entirely in your browser; the extension makes no network requests

## Installation

This extension is not published to the Chrome Web Store. Install it manually:

1. Download or clone this repository
2. Open `chrome://extensions/` (or your Chromium browser's equivalent)
3. Enable "Developer mode"
4. Click "Load unpacked" and select the repository directory

Note: extensions with the same name exist on the Chrome Web Store, but they are unrelated to this repository. If one of them is installed, disable it to avoid double rendering.

## Usage

1. Open Google Drive
2. Double-click a `.md` file to open it in preview mode
3. The raw text is replaced with rendered HTML automatically
4. Use the "Show Raw" button above the content to switch between views
5. Click the extension icon in the toolbar for settings

## Supported markdown

Parsing is done by [marked](https://github.com/markedjs/marked) v4.3.0 with GFM enabled:

- Headers (H1–H6)
- Text formatting: bold, italic, strikethrough
- Ordered and unordered lists with nesting
- Links and images
- Inline code and fenced code blocks (styled, but not syntax-highlighted)
- Tables
- Blockquotes
- Horizontal rules

## Settings

Click the extension icon in your toolbar to access:

- **Enable/Disable**: toggle the extension on/off (disabling restores the original raw view)
- **Theme**: light or dark rendering theme
- **Status**: whether you are on a Google Drive page

## How it works

- A MutationObserver watches the page for Drive's preview element (`[role="document"]`) being added
- The file name is extracted from the element's localized `aria-label` (en: `Displaying foo.md`, ja: `「foo.md」を表示しています`), so detection works on every UI language
- The preview body is located structurally (the largest `<pre>` inside the preview element), because Drive's class names are obfuscated and rotate over time
- The generated HTML is sanitized with [DOMPurify](https://github.com/cure53/DOMPurify) v3.2.6 before insertion
- The content script runs in all frames (`all_frames: true`), so it keeps working if Drive hosts the preview in a same-origin iframe

For development setup and architecture details, see [CLAUDE.md](CLAUDE.md).

## Permissions and privacy

- Host access is limited to `https://drive.google.com/*`
- `storage` holds the two settings (enabled, theme); `activeTab` is used by the popup to show page status
- No data is collected, stored elsewhere, or transmitted; marked and DOMPurify are bundled locally under `lib/`

## Browser compatibility

Any Chromium-based browser that supports Manifest V3 (Chrome 88+, Edge, Brave, Vivaldi, …). Developed and tested on Vivaldi.

## Troubleshooting

**Nothing is rendered?**

- Check that the extension is enabled, both in the popup and in `chrome://extensions/`
- Reload the Google Drive tab
- Disable any same-name extension installed from the Chrome Web Store

**Debugging**

- Set `GDMD_DEBUG = true` at the top of `content.js`, reload the extension, and watch for `[GDMD]` logs in the DevTools console of the Drive tab

## Changelog

### Version 1.2.0

- Locale-independent detection: works on non-English Google Drive UIs (e.g. Japanese `「foo.md」を表示しています`) by extracting the file name from the aria-label instead of matching the English word "Displaying"
- Event-driven detection via MutationObserver (no more polling / fixed timeouts)
- Structural content lookup (largest `<pre>` in the document element) instead of obfuscated class names
- HTML output sanitized with DOMPurify
- Content script now runs in all frames (`all_frames: true`)
- Popup theme setting now actually applies (dark theme via `.gdmd-dark` class)

### Version 1.1.0

- Production-ready release
- Optimized performance and polling mechanism
- Enhanced multi-file support
- Improved reliability and error handling

### Version 1.0.0

- Initial release
- Basic markdown detection and rendering
- Toggle between raw and formatted views
- Settings popup interface

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
