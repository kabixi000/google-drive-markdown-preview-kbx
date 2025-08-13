# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a Chrome extension (Manifest V3) - no build commands needed. To develop:

1. Load the extension in Chrome:
   - Open Chrome → Extensions → Developer mode → "Load unpacked"
   - Select this directory
2. Test changes: Make code edits, then reload the extension in Chrome
3. Debug: Use Chrome DevTools console to see `[GDMD]` logs from content.js

## Architecture Overview

### Core Architecture
This is a Chrome extension that automatically detects and renders markdown files in Google Drive preview mode. The extension uses a sophisticated DOM polling mechanism to handle Google Drive's dynamic content loading.

### Key Components

**content.js** - Main content script injected into Google Drive pages
- `GoogleDriveMarkdownPreview` class handles the entire lifecycle
- `waitForPreviewElements()` - Critical polling mechanism that waits for Google Drive to inject preview DOM elements
- `checkForMarkdownPreview()` - Detects markdown files by checking `[role="document"][aria-label*="Displaying"]` elements
- `findPreviewContent(fileName)` - Locates the specific `.a-b-r-La` element containing markdown content
- Uses marked.js library for markdown-to-HTML conversion

**background.js** - Service worker for extension lifecycle and settings management
- Manages chrome.storage.sync for user preferences
- Handles messages between popup and content scripts

**popup.js/popup.html** - Settings UI for enabling/disabling and theme selection

**styles/markdown.css** - GitHub-style markdown rendering with dark theme support

### Google Drive DOM Structure
The extension targets this specific DOM pattern that Google Drive injects:
```html
<div class="a-b-r-x" role="document" aria-label="Displaying filename.md">
  <pre class="a-b-r-La"><!-- markdown content --></pre>
</div>
```

### Critical Implementation Details

**Timing Challenges**: Google Drive injects preview elements asynchronously after user interaction. The extension uses a polling mechanism (`waitForPreviewElements()`) that:
- Checks every 500ms for up to 10 seconds
- Waits for both the document container AND the content element
- Handles multiple files being opened in sequence

**State Management**: Each file opening triggers complete cleanup and reset to handle:
- Multiple file previews in same session  
- Reopening the same file
- Switching between different files

**File Detection**: Uses multiple methods to identify markdown files:
1. `aria-label="Displaying filename.md"` pattern (primary)
2. URL patterns with `/file/d/` 
3. Content-based detection for markdown patterns

The extension works in both folder view (`/folders/`) and direct file view (`/file/d/`) URLs, as Google Drive can inject previews in either context.