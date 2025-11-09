const API_BASE = '/api';

async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (error) {
    showError(error.message);
    throw error;
  }
}

function showError(message) {
  alert(`Error: ${message}`);
}

function showSuccess(message) {
  const existing = document.querySelector('.success-message');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'success-message';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

if (window.location.pathname === '/stores') {
  document.addEventListener('DOMContentLoaded', loadStores);

  document.getElementById('create-store-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const displayName = formData.get('displayName');

    try {
      await apiCall('/stores', {
        method: 'POST',
        body: JSON.stringify({ displayName })
      });
      hideCreateStoreModal();
      e.target.reset();
      showSuccess('Store created successfully');
      loadStores();
    } catch (error) {
    }
  });
}

async function loadStores() {
  const container = document.getElementById('stores-container');
  try {
    const data = await apiCall('/stores');
    const stores = data.stores;

    if (stores.length === 0) {
      container.innerHTML = '<p class="empty-state">No stores found. Create one to get started.</p>';
      return;
    }

    container.innerHTML = stores.map(store => `
      <div class="store-card">
        <h3>${escapeHtml(store.displayName || 'Unnamed Store')}</h3>
        <p class="store-name">${escapeHtml(store.name)}</p>
        <div class="store-actions">
          <a href="/stores/${encodeURIComponent(store.name)}" class="btn btn-primary">Open</a>
          <button class="btn btn-danger" onclick="deleteStore('${escapeHtml(store.name)}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p class="error-state">Failed to load stores</p>';
  }
}

async function deleteStore(name) {
  if (!confirm('Are you sure you want to delete this store? This will delete all documents in it.')) {
    return;
  }

  try {
    await apiCall(`/stores/${encodeURIComponent(name)}`, { method: 'DELETE' });
    showSuccess('Store deleted successfully');
    loadStores();
  } catch (error) {
  }
}

function showCreateStoreModal() {
  document.getElementById('create-store-modal').classList.add('show');
}

function hideCreateStoreModal() {
  document.getElementById('create-store-modal').classList.remove('show');
}

if (typeof STORE_NAME !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadStoreDetails();
    loadDocuments();
  });

  document.getElementById('upload-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const progressDiv = document.getElementById('upload-progress');
    progressDiv.textContent = 'Uploading and indexing file...';

    try {
      const response = await fetch(`${API_BASE}/stores/${encodeURIComponent(STORE_NAME)}/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      hideUploadModal();
      e.target.reset();
      progressDiv.textContent = '';

      const docName = data.result?.response?.documentName || 'Document uploaded';
      showSuccess(`File uploaded and indexed successfully: ${docName}`);
      loadDocuments();
    } catch (error) {
      progressDiv.textContent = '';
      showError(error.message);
    }
  });

  document.getElementById('search-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const query = formData.get('query');
    const metadataFilter = formData.get('metadataFilter');

    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<div class="loading">Searching...</div>';

    try {
      const searchPayload = {
        query,
        storeNames: [STORE_NAME]
      };

      if (metadataFilter && metadataFilter.trim()) {
        searchPayload.metadataFilter = metadataFilter.trim();
      }

      const data = await apiCall('/search', {
        method: 'POST',
        body: JSON.stringify(searchPayload)
      });

      displaySearchResults(data.result);
    } catch (error) {
      resultsDiv.innerHTML = '<p class="error-state">Search failed</p>';
    }
  });

  document.getElementById('rename-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const displayName = formData.get('displayName');

    try {
      await apiCall(`/stores/${encodeURIComponent(STORE_NAME)}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName })
      });

      hideRenameModal();
      e.target.reset();
      showSuccess('Store renamed successfully');
      loadStoreDetails();
    } catch (error) {
    }
  });
}

async function loadStoreDetails() {
  try {
    const data = await apiCall(`/stores/${encodeURIComponent(STORE_NAME)}`);
    const store = data.store;
    document.getElementById('store-title').textContent = store.displayName || 'Unnamed Store';
  } catch (error) {
    document.getElementById('store-title').textContent = 'Store not found';
  }
}

async function loadDocuments() {
  const container = document.getElementById('documents-container');
  try {
    const data = await apiCall(`/stores/${encodeURIComponent(STORE_NAME)}/documents`);
    const documents = data.documents;

    if (!documents || documents.length === 0) {
      container.innerHTML = '<p class="empty-state">No documents yet. Upload one to get started.</p>';
      return;
    }

    container.innerHTML = documents.map(doc => `
      <div class="document-item">
        <div class="document-info">
          <h4>${escapeHtml(doc.displayName || doc.name)}</h4>
          <p class="document-name">${escapeHtml(doc.name)}</p>
        </div>
        <button class="btn btn-danger" onclick="deleteDocument('${escapeHtml(doc.name)}')">Delete</button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Frontend error loading documents:', error);
    container.innerHTML = '<p class="error-state">Failed to load documents</p>';
  }
}

async function deleteDocument(name) {
  if (!confirm('Are you sure you want to delete this document?')) {
    return;
  }

  try {
    await apiCall(`/documents/${encodeURIComponent(name)}`, { method: 'DELETE' });
    showSuccess('Document deleted successfully');
    loadDocuments();
  } catch (error) {
  }
}

function displaySearchResults(result) {
  const resultsDiv = document.getElementById('search-results');

  if (!result || !result.text) {
    resultsDiv.innerHTML = '<p class="empty-state">No results found</p>';
    return;
  }

  let html = `<div class="search-result-content">
    <h3>Answer</h3>
    <div class="answer-text">${escapeHtml(result.text).replace(/\n/g, '<br>')}</div>
  `;

  if (result.groundingMetadata?.groundingChunks) {
    html += `
      <h3>Sources</h3>
      <div class="sources-list">
        ${result.groundingMetadata.groundingChunks.map((chunk, i) => `
          <div class="source-item">
            <strong>Source ${i + 1}:</strong>
            ${chunk.web?.uri ? `<a href="${escapeHtml(chunk.web.uri)}" target="_blank">${escapeHtml(chunk.web.title || chunk.web.uri)}</a>` :
              escapeHtml(chunk.retrievedContext?.title || 'Document chunk')}
          </div>
        `).join('')}
      </div>
    `;
  }

  html += '</div>';
  resultsDiv.innerHTML = html;
}

function showUploadModal() {
  document.getElementById('upload-modal').classList.add('show');
}

function hideUploadModal() {
  document.getElementById('upload-modal').classList.remove('show');
  document.getElementById('upload-progress').textContent = '';
}

function showRenameModal() {
  document.getElementById('rename-modal').classList.add('show');
}

function hideRenameModal() {
  document.getElementById('rename-modal').classList.remove('show');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
  }
});
