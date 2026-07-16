# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a Chrome extension (Manifest V3) - no build commands needed. To develop:

1. Load the extension in Chrome:
   - Open Chrome → Extensions → Developer mode → "Load unpacked"
   - Select this directory
2. Test changes: Make code edits, then reload the extension in Chrome
3. Debug: Use Chrome DevTools console to see `[GDMD]` logs from content.js (gated by the `GDMD_DEBUG` const at the top of content.js)

## Architecture Overview

### Core Architecture
This is a Chrome extension that automatically detects and renders markdown files in Google Drive preview mode. The extension uses a sophisticated DOM polling mechanism to handle Google Drive's dynamic content loading.

### Key Components

**content.js** - Main content script injected into Google Drive pages (all frames)
- MutationObserver-based, no polling: a body-level observer watches for `[role="document"]` elements being added, and a per-element observer waits for the `<pre>` content / `aria-label` to be populated
- `extractMarkdownFileName(ariaLabel)` - Locale-independent detection: extracts the file name itself from the localized `aria-label` (en: `Displaying foo.md`, ja: `「foo.md」を表示しています`) — never keys on the verb
- `findLargestPre(docEl)` - Locates the preview body by structure (largest `<pre>` inside the document element), not by obfuscated class names
- Uses marked.js for markdown-to-HTML conversion and DOMPurify for sanitization

**background.js** - Service worker for extension lifecycle and settings management
- Manages chrome.storage.sync for user preferences
- Handles messages between popup and content scripts

**popup.js/popup.html** - Settings UI for enabling/disabling and theme selection

**styles/markdown.css** - GitHub-style markdown rendering with dark theme support

### Google Drive DOM Structure
The extension targets this DOM pattern that Google Drive injects (observed 2026-07):
```html
<div class="a-b-r-x" role="document" aria-label="「filename.md」を表示しています">
  <pre class="a-b-r-La"><!-- markdown content --></pre>
</div>
```

Two hard-won constraints drive the implementation:
- **The `aria-label` is localized.** English UIs say `Displaying filename.md`, Japanese UIs say `「filename.md」を表示しています`. Detection must extract the file name itself, never match on `Displaying`.
- **Class names are obfuscated and rotate.** `a-b-r-La` etc. are build-generated and differ across routes (`/drive/home` vs `/file/d/.../view`) and over time. The preview body is located structurally as the largest `<pre>` inside the `[role="document"]` element.

### Critical Implementation Details

**Timing**: Google Drive injects preview elements asynchronously after user interaction, and may set the `aria-label` or fill the `<pre>` after inserting the container. The extension is fully event-driven:
- A body-level MutationObserver detects `[role="document"]` elements being added
- A per-element MutationObserver (childList/characterData/`aria-label`) re-attempts rendering until content is present, and handles keyboard navigation between files (Drive reuses the same document element and swaps its children)
- Mutations originating inside the extension's own DOM (`.gdmd-*`) are ignored to avoid re-render loops

**State Management**: An already-rendered check (a `.gdmd-markdown-content` sibling of the `<pre>`) prevents double rendering; disabling the extension via the popup triggers full cleanup and restores the original `<pre>`.

**Frames**: The content script runs with `all_frames: true` so it still works if Drive hosts the preview inside a same-origin iframe.