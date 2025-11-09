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

  // Store for citation highlighting
  window.searchResult = result;

  // Parse markdown directly - no placeholders, no modifications!
  const answerHtml = marked.parse(result.text);

  // Display answer in main section
  resultsDiv.innerHTML = `
    <div class="search-result-content">
      <h3>Answer</h3>
      <div class="answer-text" id="answer-text">${answerHtml}</div>
    </div>
  `;

  // Now insert citation markers into the DOM
  if (result.groundingMetadata?.groundingSupports) {
    const answerDiv = document.getElementById('answer-text');

    // Process citations in reverse order to avoid position shifting
    const supports = [...result.groundingMetadata.groundingSupports].reverse();

    supports.forEach((support, reverseIdx) => {
      const i = supports.length - 1 - reverseIdx; // Original index
      const citedText = support.segment.text || '';
      const chunkIndices = support.groundingChunkIndices || [];

      if (citedText && chunkIndices.length > 0) {
        // Find and mark this text in the DOM
        insertCitationMarker(answerDiv, citedText, chunkIndices, i);
      }
    });
  }

  // Display citations in sidebar
  if (result.groundingMetadata?.groundingChunks && result.groundingMetadata?.groundingSupports) {
    let citationsHtml = '<div class="citations-list">';

    // Track which chunks are actually cited
    const citedChunkIndices = new Set();

    result.groundingMetadata.groundingSupports.forEach((support, i) => {
      const chunkIndices = support.groundingChunkIndices || [];

      // Get source documents for this citation
      const sources = chunkIndices.map(chunkIdx => {
        const chunk = result.groundingMetadata.groundingChunks[chunkIdx];
        if (chunk?.retrievedContext) {
          citedChunkIndices.add(chunkIdx); // Track this chunk as cited
          return {
            idx: chunkIdx,
            title: chunk.retrievedContext.title || 'Unknown',
            excerpt: chunk.retrievedContext.text || ''
          };
        }
        return null;
      }).filter(Boolean);

      if (sources.length > 0) {
        const sourceLabels = sources.map(s => `[${s.idx + 1}]`).join(' ');
        const sourceNames = sources.map(s => s.title).join(', ');

        // Show excerpt from the FIRST source document (not model's response text)
        const sourceExcerpt = sources[0].excerpt;
        const preview = sourceExcerpt.length > 200 ? sourceExcerpt.substring(0, 200) + '...' : sourceExcerpt;

        citationsHtml += `
          <div class="citation-item" data-citation="${i}"
               onmouseenter="highlightCitation(${i})"
               onmouseleave="clearHighlight()"
               onclick="scrollToSource(${sources[0].idx})">
            <div class="citation-header">
              <span class="citation-ref">${sourceLabels}</span>
              <span class="citation-doc">${escapeHtml(sourceNames)}</span>
            </div>
            <div class="citation-preview">"${escapeHtml(preview)}"</div>
          </div>
        `;
      }
    });
    citationsHtml += '</div>';

    // Add source documents section - ONLY show chunks that were actually cited
    citationsHtml += '<div class="sources-section"><h4>Source Documents</h4>';
    result.groundingMetadata.groundingChunks.forEach((chunk, i) => {
      // Skip chunks that weren't cited
      if (!citedChunkIndices.has(i)) return;

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

// Insert citation markers into the DOM by finding the cited text
function insertCitationMarker(container, citedText, chunkIndices, citationIdx) {
  // Normalize the search text (remove extra whitespace)
  const searchText = citedText.trim();
  if (!searchText) return;

  // Walk through all text nodes to find this text
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  // Build the full text content
  let fullText = textNodes.map(n => n.textContent).join('');

  // Find the text position (case-insensitive, ignore extra spaces)
  const normalizedFull = fullText.replace(/\s+/g, ' ');
  const normalizedSearch = searchText.replace(/\s+/g, ' ');
  const startPos = normalizedFull.indexOf(normalizedSearch);

  if (startPos === -1) {
    console.log('Could not find cited text:', searchText.substring(0, 50));
    return;
  }

  // Find the text node and offset where citation ends
  let currentPos = 0;
  let endPos = startPos + normalizedSearch.length;

  for (let i = 0; i < textNodes.length; i++) {
    const nodeText = textNodes[i].textContent;
    const normalizedNodeText = nodeText.replace(/\s+/g, ' ');
    const nodeLength = normalizedNodeText.length;
    const nodeEnd = currentPos + nodeLength;

    if (currentPos <= endPos && endPos <= nodeEnd) {
      // Found the node containing the end of citation
      // Insert marker after this text node
      const marker = document.createElement('span');
      marker.className = 'citation-markers';
      marker.setAttribute('data-citation', citationIdx);

      chunkIndices.forEach(idx => {
        const badge = document.createElement('span');
        badge.className = 'citation-marker';
        badge.textContent = idx + 1;
        badge.onclick = (e) => {
          e.stopPropagation();
          scrollToSource(idx);
        };
        marker.appendChild(badge);
      });

      // Insert after the text node
      const parent = textNodes[i].parentNode;
      if (parent && textNodes[i].nextSibling) {
        parent.insertBefore(marker, textNodes[i].nextSibling);
      } else if (parent) {
        parent.appendChild(marker);
      }

      // Wrap the cited text for highlighting
      wrapCitedText(textNodes, startPos, endPos, citationIdx);
      return;
    }

    currentPos = nodeEnd;
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

// Wrap cited text with a span for highlighting
function wrapCitedText(textNodes, startPos, endPos, citationIdx) {
  // This is complex to do across multiple nodes, so let's use a simpler approach
  // Just add a data attribute to track the citation for CSS-based highlighting
  // The cited text wrapper will be added during marker insertion
}

function highlightCitation(citationIdx) {
  // Clear previous highlights
  clearHighlight();

  // Highlight the citation markers
  const markers = document.querySelectorAll(`.citation-markers[data-citation="${citationIdx}"]`);
  markers.forEach(marker => marker.classList.add('highlighted'));
}

function clearHighlight() {
  // Remove all highlight classes from markers
  document.querySelectorAll('.citation-markers.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });
}

function scrollToSource(sourceIdx) {
  openSidebar();
  switchTab('citations');

  const sourceElement = document.getElementById(`source-${sourceIdx}`);
  if (sourceElement) {
    sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sourceElement.style.backgroundColor = 'var(--bg-light)';
    setTimeout(() => {
      sourceElement.style.backgroundColor = '';
    }, 2000);
  }
}

function clearAllHighlights() {
  clearHighlight();
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
