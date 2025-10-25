// State management
const state = {
  currentUser: null,
  customerChat: [],
  activeTab: 'instructions'
};

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
  await loadUserInfo();
  await loadInitialContent();
  setupEventListeners();
});

// Check session validity
async function checkSession() {
  try {
    const response = await fetch('/api/session-check');
    const data = await response.json();
    if (!data.valid) {
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Session check failed:', error);
    window.location.href = '/login';
  }
}

// Load user information
async function loadUserInfo() {
  try {
    const response = await fetch('/api/user');
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

    document.getElementById('instructionsEditor').value = data.instructions || '';
    document.getElementById('knowledgeBaseEditor').value = data.knowledgeBase || '';

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

  // Auto-resize textarea
  customerInput.addEventListener('input', () => autoResizeTextarea(customerInput));
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

  // Clear input
  input.value = '';
  input.style.height = 'auto';

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
