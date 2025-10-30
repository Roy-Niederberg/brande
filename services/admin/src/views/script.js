// State management
const state = {
  currentUser: null,
  customerChat: [],
  activeTab: 'instructions'
};

// Detect text direction based on content
function detectTextDirection(text) {
  const hebrewPattern = /[\u0590-\u05FF]/g;
  const hebrewChars = (text.match(hebrewPattern) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return hebrewChars / totalChars > 0.3 ? 'rtl' : 'ltr';
}

// Apply auto-direction to element
function applyAutoDirection(element) {
  const text = element.value || element.textContent || '';
  if (text.trim()) {
    element.dir = detectTextDirection(text);
  }
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserInfo();
  await loadInitialContent();
  setupEventListeners();
});

// Load user information
async function loadUserInfo() {
  try {
    const response = await fetch('/api/user');
    if (response.status === 401) { // Unauthorized
      window.location.href = '/login';
    }
    if (response.status === 403) { // Forbidden
      window.location.href = '/';
    }
    const user = await response.json();
    state.currentUser = user;

    document.getElementById('userName').textContent = user.name || user.email;
    if (user.picture) {
      document.getElementById('userAvatar').src = user.picture;
    }
  } catch (error) {
    console.error('Failed to load user info:', error);
  }
}

// Load initial content from response-engine
async function loadInitialContent() {
  try {
    const response = await fetch('/api/initial-content');
    const data = await response.json();

    const instructionsEl = document.getElementById('instructionsEditor');
    const knowledgeBaseEl = document.getElementById('knowledgeBaseEditor');

    instructionsEl.value = data.instructions || '';
    knowledgeBaseEl.value = data.knowledgeBase || '';

    applyAutoDirection(instructionsEl);
    applyAutoDirection(knowledgeBaseEl);

    if (data.error) {
      console.warn('Could not fetch initial content:', data.error);
    }
  } catch (error) {
    console.error('Failed to load initial content:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Tab switching for left panel
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Auto-direction for textareas
  const instructionsEl = document.getElementById('instructionsEditor');
  const knowledgeBaseEl = document.getElementById('knowledgeBaseEditor');
  instructionsEl.addEventListener('input', () => applyAutoDirection(instructionsEl));
  knowledgeBaseEl.addEventListener('input', () => applyAutoDirection(knowledgeBaseEl));

  // Instructions edit button
  const editBtn = document.getElementById('instructions-edit-btn');
  editBtn.addEventListener('click', () => toggleInstructionsEdit());
  instructionsEl.addEventListener('blur', () => saveInstructionsOnBlur());

  // Knowledge base edit button
  const kbEditBtn = document.getElementById('knowledge-base-edit-btn');
  kbEditBtn.addEventListener('click', () => toggleKnowledgeBaseEdit());
  knowledgeBaseEl.addEventListener('blur', () => saveKnowledgeBaseOnBlur());

  // Customer chat
  const customerInput = document.getElementById('customer-input');
  const customerSend = document.getElementById('customer-send');

  customerSend.addEventListener('click', () => sendCustomerMessage());
  customerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCustomerMessage();
    }
  });

  // Auto-resize and auto-direction for chat input
  customerInput.addEventListener('input', () => {
    autoResizeTextarea(customerInput);
    applyAutoDirection(customerInput);
  });

  // Mobile keyboard handling
  customerInput.addEventListener('focus', () => {
    setTimeout(() => {
      customerInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  });
}

// Switch left panel tabs
function switchTab(tabName) {
  state.activeTab = tabName;

  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update content
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabName}-tab`);
  });
}

// Auto-resize textarea
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
}

// Send customer message
async function sendCustomerMessage() {
  const input = document.getElementById('customer-input');
  const message = input.value.trim();

  if (!message) return;

  // Add user message to chat
  addMessage('user', message);
  state.customerChat.push({ sender: 'user', text: message });

  // Clear input and reset to LTR
  input.value = '';
  input.style.height = 'auto';
  input.dir = 'ltr';

  // Show loading
  const loadingEl = document.getElementById('customer-loading');
  const sendBtn = document.getElementById('customer-send');
  loadingEl.style.display = 'flex';
  sendBtn.disabled = true;

  console.log(JSON.stringify({ chatHistory: state.customerChat }))
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatHistory: state.customerChat })
    });

    const data = await response.json();

    // Add assistant response
    const isError = data.isError === true;
    addMessage('assistant', data.response, isError);
    state.customerChat.push({ sender: 'assistant', text: data.response });

  } catch (error) {
    console.error('Customer chat error:', error);
    addMessage('assistant', 'ERROR: Failed to send message', true);
  } finally {
    loadingEl.style.display = 'none';
    sendBtn.disabled = false;
  }
}

// Add message to chat
function addMessage(sender, text, isError = false) {
  const messagesContainer = document.getElementById('customer-messages');

  // Remove welcome message if present
  const welcomeMsg = messagesContainer.querySelector('.welcome-message');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }

  // Create message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}${isError ? ' error' : ''}`;

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';

  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';
  textDiv.textContent = text;
  textDiv.dir = detectTextDirection(text);

  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = formatTime(new Date());

  bubbleDiv.appendChild(textDiv);
  bubbleDiv.appendChild(timeDiv);
  messageDiv.appendChild(bubbleDiv);
  messagesContainer.appendChild(messageDiv);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Toggle instructions edit mode
function toggleInstructionsEdit() {
  const instructionsEl = document.getElementById('instructionsEditor');
  const editBtn = document.getElementById('instructions-edit-btn');

  if (instructionsEl.readOnly) {
    instructionsEl.readOnly = false;
    instructionsEl.focus();
    editBtn.textContent = 'Editing...';
    editBtn.classList.add('editing');
  } else {
    instructionsEl.readOnly = true;
    editBtn.textContent = 'Edit';
    editBtn.classList.remove('editing');
  }
}

// Save instructions when textarea loses focus
async function saveInstructionsOnBlur() {
  const instructionsEl = document.getElementById('instructionsEditor');
  const editBtn = document.getElementById('instructions-edit-btn');

  if (!instructionsEl.readOnly) {
    instructionsEl.readOnly = true;
    editBtn.textContent = 'Edit';
    editBtn.classList.remove('editing');

    try {
      const response = await fetch('/api/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructionsEl.value })
      });

      if (response.ok) {
        showUpdateIndicator('instructions', 'Saved successfully');
      } else {
        showUpdateIndicator('instructions', 'Failed to save');
      }
    } catch (error) {
      console.error('Failed to save instructions:', error);
      showUpdateIndicator('instructions', 'Failed to save');
    }
  }
}

// Toggle knowledge base edit mode
function toggleKnowledgeBaseEdit() {
  const knowledgeBaseEl = document.getElementById('knowledgeBaseEditor');
  const editBtn = document.getElementById('knowledge-base-edit-btn');

  if (knowledgeBaseEl.readOnly) {
    knowledgeBaseEl.readOnly = false;
    knowledgeBaseEl.focus();
    editBtn.textContent = 'Editing...';
    editBtn.classList.add('editing');
  } else {
    knowledgeBaseEl.readOnly = true;
    editBtn.textContent = 'Edit';
    editBtn.classList.remove('editing');
  }
}

// Save knowledge base when textarea loses focus
async function saveKnowledgeBaseOnBlur() {
  const knowledgeBaseEl = document.getElementById('knowledgeBaseEditor');
  const editBtn = document.getElementById('knowledge-base-edit-btn');

  if (!knowledgeBaseEl.readOnly) {
    knowledgeBaseEl.readOnly = true;
    editBtn.textContent = 'Edit';
    editBtn.classList.remove('editing');

    try {
      const response = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBase: knowledgeBaseEl.value })
      });

      if (response.ok) {
        showUpdateIndicator('knowledge-base', 'Saved successfully');
      } else {
        showUpdateIndicator('knowledge-base', 'Failed to save');
      }
    } catch (error) {
      console.error('Failed to save knowledge base:', error);
      showUpdateIndicator('knowledge-base', 'Failed to save');
    }
  }
}

// Show update indicator
function showUpdateIndicator(type, message) {
  const indicator = document.getElementById(`${type}-indicator`);
  indicator.textContent = message;
  indicator.className = 'update-indicator success';

  setTimeout(() => {
    indicator.textContent = '';
    indicator.className = 'update-indicator';
  }, 3000);
}

// Format time
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
