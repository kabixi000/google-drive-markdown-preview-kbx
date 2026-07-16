const GDMD_DEBUG = false;

function gdmdLog(...args) {
  if (GDMD_DEBUG) {
    console.log('[GDMD]', ...args);
  }
}

// ---------------------------------------------------------------------------
// Locale-independent markdown file detection
//
// Google Drive sets a *localized* aria-label on the preview's
// [role="document"] element:
//   en: 'Displaying DevInstall.md'
//   ja: '「DevInstall.md」を表示しています'
// Never key on the verb ("Displaying") — extract the file name itself.
// ---------------------------------------------------------------------------
function extractMarkdownFileName(ariaLabel) {
  const patterns = [
    // en: file name after "Displaying", up to end of label
    /Displaying\s+(.+\.(?:md|markdown))\s*$/i,
    // ja and other locales that quote the file name (「」『』 or ASCII quotes)
    /[「『"']([^「」『』"']+\.(?:md|markdown))[」』"']/i,
    // last resort: any bare token ending in .md, bounded so that e.g.
    // "notes.md.pdf" does not match
    /([^\s「」『』"']+\.(?:md|markdown))(?=[\s」』"'。、]|$)/i
  ];

  for (const pattern of patterns) {
    const match = ariaLabel.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

const state = {
  enabled: true,
  theme: 'light',
  docObservers: new Map()
};

function isOwnElement(node) {
  return Boolean(
    node.classList?.contains('gdmd-markdown-content') ||
    node.classList?.contains('gdmd-toggle-container')
  );
}

// True if node is, or is contained within, one of our injected elements.
// Text nodes have no .closest(), so walk up manually.
function isInsideOwnDom(node) {
  let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (element) {
    if (isOwnElement(element)) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

// Match by structure rather than class: Drive uses different obfuscated
// class names on different routes (a-b-r-La today, others tomorrow) and
// rotates them over time. The preview body is reliably the largest <pre>
// inside the document element.
function findLargestPre(docEl) {
  const candidates = Array.from(docEl.querySelectorAll('pre')).filter((pre) => {
    return !isInsideOwnDom(pre);
  });
  return candidates.reduce((largest, pre) => {
    const length = pre.textContent?.trim().length || 0;
    const largestLength = largest?.textContent?.trim().length || 0;
    return length > largestLength ? pre : largest;
  }, null);
}

function findRenderedSibling(preEl) {
  const siblings = preEl.parentNode ? Array.from(preEl.parentNode.children) : [];
  return siblings.find((el) => {
    return el.classList?.contains('gdmd-markdown-content');
  });
}

function addToggleButton(preEl) {
  const container = document.createElement('div');
  container.className = 'gdmd-toggle-container';

  const button = document.createElement('button');
  button.className = 'gdmd-toggle-button';
  button.textContent = 'Show Raw';
  button.title = 'Toggle between rendered and raw markdown';

  button.addEventListener('click', () => {
    const rendered = findRenderedSibling(preEl);
    if (preEl.style.display === 'none') {
      preEl.style.display = 'block';
      if (rendered) {
        rendered.style.display = 'none';
      }
      button.textContent = 'Show Rendered';
    } else {
      preEl.style.display = 'none';
      if (rendered) {
        rendered.style.display = 'block';
      }
      button.textContent = 'Show Raw';
    }
  });

  container.appendChild(button);
  preEl.parentNode.insertBefore(container, preEl);
}

function renderMarkdown(preEl, fileName) {
  const rawText = preEl.textContent || '';
  if (!rawText.trim()) {
    gdmdLog('render: empty content, skipping');
    return;
  }

  const rawHtml = marked.parse(rawText, { gfm: true, breaks: true });
  const safeHtml = DOMPurify.sanitize(rawHtml);

  const wrapper = document.createElement('div');
  wrapper.className = 'gdmd-markdown-content';
  if (state.theme === 'dark') {
    wrapper.classList.add('gdmd-dark');
  }
  wrapper.innerHTML = safeHtml;

  preEl.style.display = 'none';
  preEl.parentNode.insertBefore(wrapper, preEl.nextSibling);
  addToggleButton(preEl);
  gdmdLog(`render: SUCCESS "${fileName}" (${rawText.length} chars)`);
}

function tryRenderDoc(docEl) {
  if (!state.enabled) {
    return;
  }

  const ariaLabel = docEl.getAttribute('aria-label') || '';
  const fileName = extractMarkdownFileName(ariaLabel);
  if (!fileName) {
    return;
  }

  const pre = findLargestPre(docEl);
  if (!pre || !(pre.textContent || '').trim()) {
    gdmdLog(`detect: <pre> not ready for "${fileName}"`);
    return;
  }

  // Already rendered? The user may have toggled to "Show Raw" (making the
  // <pre> visible again) — we still must not re-render.
  if (findRenderedSibling(pre)) {
    return;
  }

  gdmdLog(`detect: rendering "${fileName}"`);
  try {
    renderMarkdown(pre, fileName);
  } catch (error) {
    gdmdLog('render: ERROR —', error);
  }
}

// Persistent observer on a document element. Fires when Drive first
// populates the <pre>, sets the aria-label after insertion, or swaps
// children on keyboard navigation between files.
function watchDocElement(docEl) {
  if (state.docObservers.has(docEl)) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    if (!state.enabled) {
      return;
    }
    // Mutations inside our own DOM (e.g. toggle button text changes) must
    // not trigger re-renders.
    const hasExternalChange = mutations.some((mutation) => {
      if (isInsideOwnDom(mutation.target)) {
        return false;
      }
      const addedExternal = Array.from(mutation.addedNodes).some((node) => {
        return node.nodeType === Node.ELEMENT_NODE && !isOwnElement(node);
      });
      return (
        addedExternal ||
        mutation.type === 'characterData' ||
        mutation.type === 'attributes' ||
        mutation.removedNodes.length > 0
      );
    });
    if (!hasExternalChange) {
      return;
    }
    tryRenderDoc(docEl);
  });

  observer.observe(docEl, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label']
  });
  state.docObservers.set(docEl, observer);
  gdmdLog('observer: watching document element:', docEl.getAttribute('aria-label') || '(no label yet)');
}

function handleDocumentElement(docEl) {
  tryRenderDoc(docEl);
  watchDocElement(docEl);
}

function scanExistingDocuments() {
  document.querySelectorAll('[role="document"]').forEach((docEl) => {
    handleDocumentElement(docEl);
  });
}

// Primary detection: observe the whole page for [role="document"] elements
// being added. This catches every way Drive opens a preview — double-click,
// keyboard nav, SPA navigation — with no polling and no timeouts. The .md
// check happens later in tryRenderDoc; aria-label may be set after insertion.
function setupBodyObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!state.enabled) {
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE || isOwnElement(node)) {
          continue;
        }
        const docs = node.getAttribute?.('role') === 'document'
          ? [node]
          : Array.from(node.querySelectorAll?.('[role="document"]') || []);
        for (const docEl of docs) {
          handleDocumentElement(docEl);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function cleanup() {
  state.docObservers.forEach((observer) => {
    observer.disconnect();
  });
  state.docObservers.clear();

  document.querySelectorAll('.gdmd-toggle-container, .gdmd-markdown-content').forEach((el) => {
    el.remove();
  });
  document.querySelectorAll('pre[style*="display: none"]').forEach((el) => {
    el.style.display = '';
  });
}

function setupMessageListener() {
  chrome.runtime?.onMessage?.addListener((request) => {
    if (request.action === 'settingsChanged') {
      state.enabled = request.settings?.enabled !== false;
      state.theme = request.settings?.theme || 'light';
      gdmdLog(`settings changed: enabled=${state.enabled}, theme=${state.theme}`);
      document.querySelectorAll('.gdmd-markdown-content').forEach((el) => {
        el.classList.toggle('gdmd-dark', state.theme === 'dark');
      });
      if (state.enabled) {
        scanExistingDocuments();
      } else {
        cleanup();
      }
    }
  });
}

async function init() {
  try {
    const result = await chrome.storage.sync.get(['enabled', 'theme']);
    state.enabled = result.enabled !== false;
    state.theme = result.theme || 'light';
  } catch (error) {
    // storage unavailable — keep defaults
  }
  setupMessageListener();
  setupBodyObserver();
  scanExistingDocuments();
  gdmdLog(`init: ready, enabled=${state.enabled}, theme=${state.theme}, frame=${window === window.top ? 'top' : 'iframe'}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
