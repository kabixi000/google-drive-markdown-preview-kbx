chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      enabled: true,
      theme: 'light'
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getSettings':
      chrome.storage.sync.get(['enabled', 'theme'], (result) => {
        sendResponse(result);
      });
      return true; // Keep message channel open for async response
      
    case 'updateSettings':
      chrome.storage.sync.set(request.settings, () => {
        // Notify content scripts of settings change
        chrome.tabs.query({url: "https://drive.google.com/*"}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'settingsChanged',
              settings: request.settings
            }).catch(() => {
              // Tab might not have content script loaded, ignore error
            });
          });
        });
        sendResponse({success: true});
      });
      return true;
      
    default:
      sendResponse({error: 'Unknown action'});
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will be handled by the popup, but we can add fallback behavior here
  if (tab.url.includes('drive.google.com')) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'toggleExtension'
    }).catch(() => {
      // Content script not loaded, ignore
    });
  }
});