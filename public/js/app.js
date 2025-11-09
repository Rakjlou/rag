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
    const documents = data.store?.documents || data.documents;

    if (!documents || documents.length === 0) {
      container.innerHTML = '<p class="empty-state">No documents yet. Upload one to get started.</p>';
      return;
    }

    container.innerHTML = documents.map(doc => {
      const metadata = doc.customMetadata ? doc.customMetadata.map(m =>
        `<span class="metadata-tag">${escapeHtml(m.key)}: ${escapeHtml(m.stringValue || m.numericValue)}</span>`
      ).join('') : '';

      const fileSize = doc.sizeBytes ? (parseInt(doc.sizeBytes) / 1024).toFixed(1) + ' KB' : 'Unknown';
      const createDate = doc.createTime ? new Date(doc.createTime).toLocaleString() : 'Unknown';

      return `
        <div class="document-item" onclick="toggleDocumentDetails(this)">
          <div class="document-summary">
            <div class="document-main-info">
              <h4>${escapeHtml(doc.displayName || doc.name)}</h4>
              <span class="document-meta">${fileSize} • ${doc.mimeType || 'Unknown type'}</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteDocument('${escapeHtml(doc.name)}')">Delete</button>
          </div>
          <div class="document-details" style="display: none;">
            <div class="detail-row"><strong>Document ID:</strong> ${escapeHtml(doc.name)}</div>
            <div class="detail-row"><strong>Display Name:</strong> ${escapeHtml(doc.displayName || 'N/A')}</div>
            <div class="detail-row"><strong>Created:</strong> ${createDate}</div>
            <div class="detail-row"><strong>Size:</strong> ${fileSize}</div>
            <div class="detail-row"><strong>MIME Type:</strong> ${escapeHtml(doc.mimeType || 'Unknown')}</div>
            <div class="detail-row"><strong>State:</strong> ${escapeHtml(doc.state || 'Unknown')}</div>
            ${metadata ? `<div class="detail-row"><strong>Metadata:</strong><br>${metadata}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
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
  const citationsContainer = document.getElementById('citations-container');

  if (!result || !result.text) {
    resultsDiv.innerHTML = '<p class="empty-state">No results found</p>';
    citationsContainer.innerHTML = '<p class="empty-state">No citations available</p>';
    return;
  }

  // Store original text for reference
  window.searchResult = result;

  // Render answer with markdown and citation markers
  let textWithMarkers = result.text;

  // Insert citation markers if we have grounding supports
  if (result.groundingMetadata?.groundingSupports) {
    const supports = result.groundingMetadata.groundingSupports;
    const originalText = result.text;

    // First pass: calculate all positions and modifications based on original text
    const modifications = [];
    supports.forEach((support, idx) => {
      const startIndex = support.segment.startIndex;
      const endIndex = support.segment.endIndex;
      const chunkIndices = support.groundingChunkIndices || [];

      // Find next word boundary after endIndex in ORIGINAL text
      let insertPos = endIndex;
      while (insertPos < originalText.length) {
        const char = originalText[insertPos];
        if (char === ' ' || char === '\n' || char === '.' || char === ',' || char === ';' || char === ':' || char === '!' || char === '?') {
          break;
        }
        insertPos++;
      }

      modifications.push({
        start: startIndex,
        end: endIndex,
        insertPos: insertPos,
        citationIdx: idx,
        chunkIndices: chunkIndices
      });
    });

    // Sort by start position in reverse order
    modifications.sort((a, b) => b.start - a.start);

    // Second pass: apply modifications from end to beginning
    modifications.forEach(mod => {
      const citedText = textWithMarkers.slice(mod.start, mod.end);
      const wrappedText = `<span class="cited-text" data-citation="${mod.citationIdx}">${citedText}</span>`;
      const markers = mod.chunkIndices.map(idx =>
        `<span class="citation-marker" onclick="showCitation(${idx}, ${mod.citationIdx})">${idx + 1}</span>`
      ).join('');

      // Replace original segment with wrapped version and add markers at word boundary
      textWithMarkers =
        textWithMarkers.slice(0, mod.start) +
        wrappedText +
        textWithMarkers.slice(mod.end, mod.insertPos) +
        markers +
        textWithMarkers.slice(mod.insertPos);
    });
  }

  const answerHtml = marked.parse(textWithMarkers);

  // Display answer in main section
  resultsDiv.innerHTML = `
    <div class="search-result-content">
      <h3>Answer</h3>
      <div class="answer-text">${answerHtml}</div>
    </div>
  `;

  // Display citations in sidebar
  if (result.groundingMetadata?.groundingChunks) {
    let citationsHtml = '';

    // Add grounding supports with citation details
    if (result.groundingMetadata.groundingSupports) {
      citationsHtml += '<div class="citations-list">';
      result.groundingMetadata.groundingSupports.forEach((support, i) => {
        const chunkIndices = support.groundingChunkIndices || [];

        // For each chunk referenced, show its excerpt
        chunkIndices.forEach(chunkIdx => {
          const chunk = result.groundingMetadata.groundingChunks[chunkIdx];
          if (chunk && chunk.retrievedContext) {
            const excerpt = chunk.retrievedContext.text || '';
            const preview = excerpt.length > 300 ? excerpt.substring(0, 300) + '...' : excerpt;
            const docName = chunk.retrievedContext.title || 'Unknown';

            citationsHtml += `
              <div class="citation-item" id="citation-${i}" data-citation="${i}"
                   onmouseenter="highlightCitation(${i})"
                   onmouseleave="unhighlightCitation(${i})">
                <div class="citation-header">
                  <span class="citation-ref">[${chunkIdx + 1}]</span>
                  <span class="citation-doc">${escapeHtml(docName)}</span>
                </div>
                <div class="citation-excerpt">${escapeHtml(preview).replace(/\n/g, '<br>')}</div>
              </div>
            `;
          }
        });
      });
      citationsHtml += '</div>';
    }

    // Add source documents with full excerpts
    citationsHtml += '<div class="sources-section"><h4>Source Documents</h4>';
    result.groundingMetadata.groundingChunks.forEach((chunk, i) => {
      if (chunk.retrievedContext) {
        const text = chunk.retrievedContext.text || '';
        const preview = text.length > 500 ? text.substring(0, 500) + '...' : text;
        citationsHtml += `
          <div class="source-item" id="source-${i}">
            <div class="source-header">
              <strong>[${i + 1}] ${escapeHtml(chunk.retrievedContext.title)}</strong>
            </div>
            <details class="source-details">
              <summary>View full excerpt</summary>
              <div class="source-excerpt">${escapeHtml(preview).replace(/\n/g, '<br>')}</div>
            </details>
          </div>
        `;
      } else if (chunk.web) {
        citationsHtml += `
          <div class="source-item" id="source-${i}">
            <div class="source-header">
              <strong>[${i + 1}]</strong> <a href="${escapeHtml(chunk.web.uri)}" target="_blank">${escapeHtml(chunk.web.title || chunk.web.uri)}</a>
            </div>
          </div>
        `;
      }
    });
    citationsHtml += '</div>';

    citationsContainer.innerHTML = citationsHtml;

    // Open sidebar and switch to citations tab
    openSidebar();
    switchTab('citations');
  } else {
    citationsContainer.innerHTML = '<p class="empty-state">No citations available</p>';
  }
}

function toggleDocumentDetails(element) {
  const details = element.querySelector('.document-details');
  if (details) {
    details.style.display = details.style.display === 'none' ? 'block' : 'none';
    element.classList.toggle('expanded');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleIcon = document.getElementById('toggle-icon');

  sidebar.classList.toggle('collapsed');

  if (sidebar.classList.contains('collapsed')) {
    toggleIcon.textContent = '▶';
    clearAllHighlights();
  } else {
    toggleIcon.textContent = '◀';
  }
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleIcon = document.getElementById('toggle-icon');

  sidebar.classList.remove('collapsed');
  toggleIcon.textContent = '◀';
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

function showCitation(sourceIdx, citationIdx) {
  // Open sidebar and switch to citations tab
  openSidebar();
  switchTab('citations');

  // Highlight the citation text in the answer
  highlightCitation(citationIdx);

  // Scroll to the source
  const sourceElement = document.getElementById(`source-${sourceIdx}`);
  if (sourceElement) {
    sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sourceElement.style.backgroundColor = 'var(--bg-light)';
    setTimeout(() => {
      sourceElement.style.backgroundColor = '';
    }, 2000);
  }
}

function highlightCitation(citationIdx) {
  // Remove any existing highlights
  document.querySelectorAll('.cited-text.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });

  // Add highlight to the specific citation
  const citedText = document.querySelector(`.cited-text[data-citation="${citationIdx}"]`);
  if (citedText) {
    citedText.classList.add('highlighted');
  }
}

function unhighlightCitation(citationIdx) {
  const citedText = document.querySelector(`.cited-text[data-citation="${citationIdx}"]`);
  if (citedText) {
    citedText.classList.remove('highlighted');
  }
}

function clearAllHighlights() {
  document.querySelectorAll('.cited-text.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });
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
