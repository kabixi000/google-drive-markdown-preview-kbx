document.addEventListener('DOMContentLoaded', async () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const themeSelect = document.getElementById('themeSelect');
  const status = document.getElementById('status');
  
  // Load current settings
  try {
    const response = await chrome.runtime.sendMessage({action: 'getSettings'});
    
    enabledToggle.checked = response.enabled !== false;
    themeSelect.value = response.theme || 'light';
    
    showStatus('Settings loaded', 'info');
  } catch (error) {
    showStatus('Error loading settings', 'error');
  }
  
  // Handle enabled toggle
  enabledToggle.addEventListener('change', async () => {
    const newSettings = {
      enabled: enabledToggle.checked,
      theme: themeSelect.value
    };
    
    try {
      await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: newSettings
      });
      
      showStatus(enabledToggle.checked ? 'Extension enabled' : 'Extension disabled', 'success');
    } catch (error) {
      showStatus('Error updating settings', 'error');
      // Revert toggle
      enabledToggle.checked = !enabledToggle.checked;
    }
  });
  
  // Handle theme change
  themeSelect.addEventListener('change', async () => {
    const newSettings = {
      enabled: enabledToggle.checked,
      theme: themeSelect.value
    };
    
    try {
      await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: newSettings
      });
      
      showStatus(`Theme changed to ${themeSelect.value}`, 'success');
    } catch (error) {
      showStatus('Error updating theme', 'error');
    }
  });
  
  // Check if we're on Google Drive
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const currentTab = tabs[0];
    if (!currentTab.url.includes('drive.google.com')) {
      showStatus('Open a Google Drive page to use this extension', 'info');
    }
  });
});

function showStatus(message, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    status.textContent = '';
    status.className = 'status';
  }, 3000);
}