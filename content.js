class GoogleDriveMarkdownPreview {
  constructor() {
    this.isEnabled = true;
    this.originalContent = null;
    this.renderedContent = null;
    this.toggleButton = null;
    this.isRendered = false;
    this.observer = null;
    
    this.init();
  }
  
  async init() {
    await this.loadSettings();
    this.setupObserver();
  }
  
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['enabled']);
      this.isEnabled = result.enabled !== false; // default to true
    } catch (error) {
      this.isEnabled = true;
    }
  }
  
  setupObserver() {
    document.addEventListener('dblclick', (event) => {
      const target = event.target;
      
      let element = target;
      let isFileElement = false;
      for (let i = 0; i < 5 && element; i++) {
        const elementText = element.textContent || '';
        const ariaLabel = element.getAttribute('aria-label') || '';
        const title = element.getAttribute('title') || '';
        
        if (elementText.includes('.md') || ariaLabel.includes('.md') || title.includes('.md')) {
          isFileElement = true;
          break;
        }
        element = element.parentElement;
      }
      
      if (!isFileElement && window.location.href.includes('drive.google.com')) {
        setTimeout(() => this.waitForPreviewElements(), 100);
      } else if (isFileElement) {
        this.waitForPreviewElements();
      }
    });
    
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl && currentUrl.includes('/file/d/')) {
        lastUrl = currentUrl;
        this.waitForPreviewElements();
      }
    });
    
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.observer = urlObserver;
  }
  
  waitForPreviewElements() {
    let attempts = 0;
    const maxAttempts = 15;
    
    const checkForElements = () => {
      attempts++;
      
      const documentElement = document.querySelector('[role="document"][aria-label*="Displaying"]');
      const contentElement = document.querySelector('.a-b-r-La');
      
      if (documentElement && contentElement && contentElement.textContent?.trim()) {
        this.checkForMarkdownPreview();
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkForElements, 400);
      } else {
        this.checkForMarkdownPreview();
      }
    };
    
    checkForElements();
  }
  
  checkForMarkdownPreview() {
    if (!this.isEnabled) {
      return;
    }
    
    // Reset state for new file
    this.cleanup();
    this.isRendered = false;
    this.originalContent = null;
    this.renderedContent = null;
    this.toggleButton = null;
    
    // Check if we're in a Google Drive preview mode
    const url = window.location.href;
    
    if (!url.includes('drive.google.com')) {
      return;
    }
    
    // Look for markdown file indicators - try multiple approaches
    let fileName = '';
    
    const documentElements = document.querySelectorAll('[role="document"][aria-label*="Displaying"]');
    
    for (const element of documentElements) {
      const ariaLabel = element.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/Displaying\s+([^\/\s]+\.md)/i);
      if (match) {
        fileName = match[1];
        break;
      }
    }
    
    if (!fileName) {
      const ariaLabelElements = document.querySelectorAll('[aria-label*=".md"]');
      
      for (const element of ariaLabelElements) {
        const ariaLabel = element.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([^\/\s]+\.md)/i);
        if (match) {
          fileName = match[1];
          break;
        }
      }
    }
    
    if (!fileName && url.includes('/file/d/')) {
      
      const fileNameSelectors = [
        '[data-target="doc-title"] input',
        '[title*=".md"]',
        '.ndfHFb-c4YZDc-title',
        '.ndfHFb-c4YZDc-Wrql6b-title',
        '[role="heading"]'
      ];
      
      for (const selector of fileNameSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.value || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '';
          if (text.toLowerCase().includes('.md')) {
            fileName = text.trim();
            break;
          }
        }
      }
    }
    
    
    // Method 2: Check document title input (legacy)
    if (!fileName) {
      const titleElement = document.querySelector('[data-target="doc-title"] input');
      if (titleElement) {
        fileName = titleElement.value || '';
      }
    }
    
    // Method 3: Check page title
    if (!fileName) {
      fileName = document.title;
    }
    
    // Method 4: Check for .md in URL
    const urlMatch = url.match(/([^/]+\.md)/);
    if (urlMatch) {
      fileName = urlMatch[1];
    }
    
    // Method 5: Check for README.md in folder view
    // Google Drive automatically displays README.md files in folder views
    if (!fileName && url.includes('/folders/')) {
      // Look for README.md indicators in the DOM
      const readmeIndicators = document.querySelectorAll('[title*="README.md"], [aria-label*="README.md"], [data-tooltip*="README.md"]');
      if (readmeIndicators.length > 0) {
        fileName = 'README.md';
      } else {
        // Also check for any visible text that might indicate a README
        const allText = document.body.textContent || '';
        if (allText.includes('README.md') && this.findPreviewContent()) {
          fileName = 'README.md';
        }
      }
    }
    
    // Method 6: Check if the document title looks like a markdown heading
    // Google Drive often shows the first line of content as the page title
    if (!fileName.toLowerCase().includes('.md') && url.includes('/file/d/')) {
      const title = document.title;
      // Check if title looks like it could be from a markdown file
      // (Google Drive strips the # but shows the heading text)
      const potentialContent = this.findPreviewContent();
      if (potentialContent) {
        const text = potentialContent.textContent || '';
        // If we find the title text in content with markdown patterns around it
        if (title && title !== 'Google Drive' && (
            text.includes(`# ${title}`) || 
            text.includes(`## ${title}`) ||
            text.includes('# ') || text.includes('## ') || text.includes('```') || 
            text.includes('**') || text.includes('- ') || text.includes('* ')
          )) {
          fileName = 'markdown-file.md'; // Force detection
        }
      } else {
        // Even without content, if title looks like a heading and we're in file preview
        if (title && title !== 'Google Drive' && !title.includes(' - Google Drive') && 
            title.length > 3 && title.length < 100) {
          fileName = 'markdown-file.md'; // Force detection based on title pattern
        }
      }
    }
    
    if (!fileName.toLowerCase().includes('.md')) {
      return;
    }
    
    
    // Find the preview content area that matches the detected filename
    const previewContent = this.findPreviewContent(fileName);
    if (previewContent) {
      this.processMarkdownContent(previewContent);
    } else {
    }
  }
  
  findPreviewContent(fileName) {
    
    // First, find the specific document element for this filename
    let targetDocumentElement = null;
    const documentElements = document.querySelectorAll('[role="document"][aria-label*="Displaying"]');
    
    for (const element of documentElements) {
      const ariaLabel = element.getAttribute('aria-label') || '';
      if (ariaLabel.includes(fileName)) {
        targetDocumentElement = element;
        break;
      }
    }
    
    if (targetDocumentElement) {
      // Look for content within this specific document element
      const contentElement = targetDocumentElement.querySelector('.a-b-r-La');
      if (contentElement) {
        const text = contentElement.textContent?.trim();
        if (text && text.length > 0) {
          return contentElement;
        }
      }
    }
    
    // Fallback to original logic if specific matching fails
    const selectors = [
      // Google Drive preview specific selectors (based on actual DOM)
      '.a-b-r-La',  // The specific class for preview content
      '[role="document"] pre',
      '[aria-label*="Displaying"] pre',
      // Modern Google Drive selectors
      '[role="main"] pre',
      '[role="main"] .ndfHFb-c4YZDc',
      '.ndfHFb-c4YZDc-Wrql6b',
      '.ndfHFb-c4YZDc-cYSp0e', 
      '.ndfHFb-c4YZDc-PLDbbf',
      '[data-target="doc"] pre',
      '[data-target="doc"]',
      // Generic fallbacks
      'pre',
      '.content pre',
      '#drive_main-content pre',
      // Text content divs
      '[role="main"] div[style*="white-space: pre"]',
      '[role="main"] div[style*="font-family: monospace"]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && text.length > 0) {
          return element;
        }
      }
    }
    
    return null;
  }
  
  processMarkdownContent(contentElement) {
    // Check if this element has already been processed
    if (contentElement.parentNode.querySelector('.gdmd-markdown-content')) {
      return;
    }
    
    this.originalContent = contentElement.textContent;
    
    
    if (!this.originalContent.trim()) {
      return;
    }
    
    // Render markdown to HTML
    try {
      this.renderedContent = marked.parse(this.originalContent, {
        gfm: true,
        breaks: true,
        sanitize: false,
        highlight: function(code, language) {
          return code; // Basic highlighting placeholder
        }
      });
      
      
      this.replaceContent(contentElement);
      this.addToggleButton(contentElement);
      this.isRendered = true;
      
      
    } catch (error) {
      // Error rendering markdown, fail silently
    }
  }
  
  replaceContent(contentElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gdmd-markdown-content';
    wrapper.innerHTML = this.renderedContent;
    
    // Hide original content but keep it for toggling
    contentElement.style.display = 'none';
    
    // Insert rendered content after the original
    contentElement.parentNode.insertBefore(wrapper, contentElement.nextSibling);
  }
  
  addToggleButton(contentElement) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'gdmd-toggle-container';
    
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'gdmd-toggle-button';
    this.toggleButton.textContent = 'Show Raw';
    this.toggleButton.title = 'Toggle between rendered and raw markdown';
    
    this.toggleButton.addEventListener('click', () => {
      this.toggleView(contentElement);
    });
    
    buttonContainer.appendChild(this.toggleButton);
    
    // Insert toggle button before the content
    contentElement.parentNode.insertBefore(buttonContainer, contentElement);
  }
  
  toggleView(contentElement) {
    const renderedElement = contentElement.nextSibling;
    
    if (contentElement.style.display === 'none') {
      // Show raw markdown
      contentElement.style.display = 'block';
      if (renderedElement) {
        renderedElement.style.display = 'none';
      }
      this.toggleButton.textContent = 'Show Rendered';
    } else {
      // Show rendered markdown
      contentElement.style.display = 'none';
      if (renderedElement) {
        renderedElement.style.display = 'block';
      }
      this.toggleButton.textContent = 'Show Raw';
    }
  }
  
  cleanup() {
    // Clean up any existing rendered content
    const existingToggleContainers = document.querySelectorAll('.gdmd-toggle-container');
    const existingMarkdownContent = document.querySelectorAll('.gdmd-markdown-content');
    
    existingToggleContainers.forEach(container => container.remove());
    existingMarkdownContent.forEach(content => content.remove());
    
    // Restore any hidden original content
    const hiddenElements = document.querySelectorAll('pre[style*="display: none"], .a-b-r-La[style*="display: none"]');
    hiddenElements.forEach(element => {
      element.style.display = '';
    });
  }
}

// Initialize the extension when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new GoogleDriveMarkdownPreview();
  });
} else {
  new GoogleDriveMarkdownPreview();
}

// Listen for settings changes
chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
  if (request.action === 'settingsChanged') {
    location.reload();
  }
});