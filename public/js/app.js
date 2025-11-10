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

  // State management for sticky highlights (click vs hover)
  window.citationState = {
    stickyMode: null, // 'marker' or 'source'
    stickyCitationIdx: null,
    stickySourceIdx: null
  };

  // NEW APPROACH: Insert citation markers in the TEXT before rendering markdown
  let answerText = result.text;

  if (result.groundingMetadata?.groundingSupports) {
    // Create mapping for display indices
    const citedChunkIndices = new Set();
    result.groundingMetadata.groundingSupports.forEach(support => {
      support.groundingChunkIndices?.forEach(idx => citedChunkIndices.add(idx));
    });

    const chunkIndexToDisplayIndex = new Map();
    let displayIdx = 0;
    result.groundingMetadata.groundingChunks.forEach((chunk, originalIdx) => {
      if (citedChunkIndices.has(originalIdx)) {
        chunkIndexToDisplayIndex.set(originalIdx, displayIdx);
        displayIdx++;
      }
    });

    // Process citations and insert markers in the text
    answerText = insertCitationMarkersInText(
      answerText,
      result.groundingMetadata.groundingSupports,
      chunkIndexToDisplayIndex
    );
  }

  // Now render the markdown with markers already inserted
  const answerHtml = marked.parse(answerText);

  // Display answer in main section
  resultsDiv.innerHTML = `
    <div class="search-result-content">
      <h3>Answer</h3>
      <div class="answer-text" id="answer-text">${answerHtml}</div>
    </div>
  `;

  // Display citations in sidebar - Wikipedia style (one entry per unique source)
  if (result.groundingMetadata?.groundingChunks && result.groundingMetadata?.groundingSupports) {
    // First, collect all cited chunks and assign them sequential numbers
    const citedChunkIndices = new Set();
    result.groundingMetadata.groundingSupports.forEach(support => {
      support.groundingChunkIndices?.forEach(idx => citedChunkIndices.add(idx));
    });

    // Create a mapping from original chunk index to display index (Wikipedia-style numbering)
    const chunkIndexToDisplayIndex = new Map();
    let displayIdx = 0;
    result.groundingMetadata.groundingChunks.forEach((chunk, originalIdx) => {
      if (citedChunkIndices.has(originalIdx)) {
        chunkIndexToDisplayIndex.set(originalIdx, displayIdx);
        displayIdx++;
      }
    });

    // Build bidirectional mappings for highlighting
    window.chunkToCitations = new Map(); // originalChunkIdx → [citationIdx, ...]
    window.citationToChunks = new Map(); // citationIdx → [originalChunkIdx, ...]
    window.citationToDisplayIndices = new Map(); // citationIdx → [displayIdx, ...]
    window.originalToDisplayIndex = new Map(); // originalChunkIdx → displayIdx

    result.groundingMetadata.groundingSupports.forEach((support, citationIdx) => {
      const chunkIndices = support.groundingChunkIndices || [];
      window.citationToChunks.set(citationIdx, chunkIndices);

      const displayIndices = chunkIndices
        .map(idx => chunkIndexToDisplayIndex.get(idx))
        .filter(idx => idx !== undefined);
      window.citationToDisplayIndices.set(citationIdx, displayIndices);

      chunkIndices.forEach(chunkIdx => {
        if (!window.chunkToCitations.has(chunkIdx)) {
          window.chunkToCitations.set(chunkIdx, []);
        }
        window.chunkToCitations.get(chunkIdx).push(citationIdx);
      });
    });

    // Store original to display index mapping
    chunkIndexToDisplayIndex.forEach((displayIdx, originalIdx) => {
      window.originalToDisplayIndex.set(originalIdx, displayIdx);
    });

    // Build citations list - one entry per unique source chunk with expandable full text
    let citationsHtml = '<div class="citations-list">';

    let sourceDisplayIdx = 0;
    result.groundingMetadata.groundingChunks.forEach((chunk, originalIdx) => {
      // Skip chunks that weren't cited
      if (!citedChunkIndices.has(originalIdx)) return;

      if (chunk.retrievedContext) {
        const excerpt = chunk.retrievedContext.text || '';
        const preview = excerpt.length > 150 ? excerpt.substring(0, 150) + '...' : excerpt;
        const title = chunk.retrievedContext.title || 'Unknown';

        citationsHtml += `
          <div class="citation-item" id="display-source-${sourceDisplayIdx}" data-original-idx="${originalIdx}"
               onmouseenter="handleSourceHover(${originalIdx})"
               onmouseleave="handleSourceLeave(${originalIdx})"
               onclick="handleSourceClick(event, ${originalIdx})">
            <div class="citation-header">
              <span class="citation-ref">[${sourceDisplayIdx + 1}]</span>
              <span class="citation-doc">${escapeHtml(title)}</span>
            </div>
            <details class="citation-details" id="details-source-${sourceDisplayIdx}">
              <summary class="citation-preview">${escapeHtml(preview)}</summary>
              <div class="citation-full-text">${escapeHtml(excerpt).replace(/\n/g, '<br>')}</div>
            </details>
          </div>
        `;
        sourceDisplayIdx++;
      } else if (chunk.web) {
        citationsHtml += `
          <div class="citation-item" id="display-source-${sourceDisplayIdx}" data-original-idx="${originalIdx}"
               onmouseenter="handleSourceHover(${originalIdx})"
               onmouseleave="handleSourceLeave(${originalIdx})"
               onclick="handleSourceClick(event, ${originalIdx})">
            <div class="citation-header">
              <span class="citation-ref">[${sourceDisplayIdx + 1}]</span>
              <a href="${escapeHtml(chunk.web.uri)}" target="_blank" class="citation-doc">${escapeHtml(chunk.web.title || chunk.web.uri)}</a>
            </div>
          </div>
        `;
        sourceDisplayIdx++;
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

// Insert citation markers into the TEXT before rendering (new simple approach)
function insertCitationMarkersInText(text, groundingSupports, chunkIndexToDisplayIndex) {
  // Collect all citation modifications (wrapping + markers) with their positions
  const modifications = [];

  groundingSupports.forEach((support, citationIdx) => {
    const citedText = support.segment.text?.trim() || '';
    const chunkIndices = support.groundingChunkIndices || [];

    if (!citedText || chunkIndices.length === 0) return;

    // Convert to display indices
    const displayIndices = chunkIndices
      .map(idx => chunkIndexToDisplayIndex.get(idx))
      .filter(idx => idx !== undefined);

    if (displayIndices.length === 0) return;

    // Find the cited text in the source text
    const result = findCitedTextPositionAndLength(text, citedText);

    if (result.position !== -1) {
      // Find the end of the word/sentence containing the cited text
      const insertPos = findWordBoundaryAfter(text, result.position + result.length);

      modifications.push({
        startPos: result.position,
        endPos: result.position + result.length,
        markerPos: insertPos,
        citationIdx,
        displayIndices
      });
    }
  });

  // Sort modifications by position (descending) to modify from end to start
  modifications.sort((a, b) => b.startPos - a.startPos);

  // Apply modifications from end to start (to preserve positions)
  let modifiedText = text;
  modifications.forEach(mod => {
    // Create marker HTML with hover and click handlers
    const badges = mod.displayIndices
      .map(idx => `<span class="citation-marker" onmouseenter="handleMarkerHover(${mod.citationIdx})" onmouseleave="handleMarkerLeave(${mod.citationIdx})" onclick="handleMarkerClick(event, ${mod.citationIdx})">${idx + 1}</span>`)
      .join('');
    const marker = `<span class="citation-markers" data-citation="${mod.citationIdx}">${badges}</span>`;

    // Extract all the text parts (do this before any modifications)
    const beforeCitation = modifiedText.slice(0, mod.startPos);
    const citedTextContent = modifiedText.slice(mod.startPos, mod.endPos);
    const betweenCitedAndMarker = modifiedText.slice(mod.endPos, mod.markerPos);
    const afterMarker = modifiedText.slice(mod.markerPos);

    // Wrap the cited text
    const wrappedCitedText = `<span class="cited-text" data-citation="${mod.citationIdx}">${citedTextContent}</span>`;

    // Reconstruct: before + wrapped citation + between + marker + after
    modifiedText = beforeCitation + wrappedCitedText + betweenCitedAndMarker + marker + afterMarker;
  });

  return modifiedText;
}

// Find cited text in source text, handling markdown syntax
// Returns { position, length } where length is the actual matched text length in source
function findCitedTextPositionAndLength(text, citedText) {
  // First try exact match
  let pos = text.indexOf(citedText);
  if (pos !== -1) return { position: pos, length: citedText.length };

  // Try without markdown formatting
  const cleanCitedText = citedText
    .replace(/\*\*/g, '')      // Remove bold
    .replace(/\*/g, '')        // Remove italic
    .replace(/#{1,6}\s/g, '')  // Remove headings
    .replace(/`/g, '')         // Remove code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')  // Remove links
    .trim();

  // Search for the clean version in the text
  pos = text.indexOf(cleanCitedText);
  if (pos !== -1) return { position: pos, length: cleanCitedText.length };

  // Try case-insensitive
  const lowerText = text.toLowerCase();
  const lowerCited = cleanCitedText.toLowerCase();
  pos = lowerText.indexOf(lowerCited);

  if (pos !== -1) {
    // Return the actual length in the source text (may differ from cited text due to case)
    return { position: pos, length: cleanCitedText.length };
  }

  return { position: -1, length: 0 };
}

// Find the next word boundary after a position (space, punctuation, or end of text)
// This ensures citation markers appear AFTER complete words, not in the middle
function findWordBoundaryAfter(text, startPos) {
  // If we're already at a word boundary (whitespace, punctuation, or end), use this position
  if (startPos >= text.length || /[\s.,;:!?)\]]/.test(text[startPos])) {
    return startPos;
  }

  // We're in the middle of a word - find the end of THIS word only
  while (startPos < text.length && /\w/.test(text[startPos])) {
    startPos++;
  }

  return startPos;
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
    // Clear sticky state when collapsing sidebar
    if (window.citationState) {
      window.citationState.stickyMode = null;
      window.citationState.stickyCitationIdx = null;
      window.citationState.stickySourceIdx = null;
    }
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

// === LEGACY FUNCTIONS (for backward compatibility) ===

function highlightCitation(citationIdx) {
  // Redirect to new system
  highlightCitationAndSource(citationIdx, false);
}

function highlightCitationBySource(chunkIdx) {
  // Redirect to new system
  highlightSourceAndCitations(chunkIdx, false);
}

function clearHighlight() {
  // Redirect to new system
  clearAllCitationHighlights();
}

// === MARKER-DRIVEN INTERACTION HANDLERS ===

function handleMarkerHover(citationIdx) {
  // Only respond to hover if not in sticky mode
  if (window.citationState?.stickyMode) return;

  highlightCitationAndSource(citationIdx, false);
}

function handleMarkerLeave(citationIdx) {
  // Only clear on leave if not in sticky mode
  if (window.citationState?.stickyMode) return;

  clearAllCitationHighlights();
}

function handleMarkerClick(event, citationIdx) {
  event.stopPropagation();

  // If clicking the same marker, toggle off sticky mode
  if (window.citationState?.stickyMode === 'marker' &&
      window.citationState?.stickyCitationIdx === citationIdx) {
    window.citationState.stickyMode = null;
    window.citationState.stickyCitationIdx = null;
    clearAllCitationHighlights();
    return;
  }

  // Set sticky mode
  window.citationState.stickyMode = 'marker';
  window.citationState.stickyCitationIdx = citationIdx;
  window.citationState.stickySourceIdx = null;

  highlightCitationAndSource(citationIdx, true);
}

// === SOURCE-DRIVEN INTERACTION HANDLERS ===

function handleSourceHover(originalIdx) {
  // Only respond to hover if not in sticky mode
  if (window.citationState?.stickyMode) return;

  highlightSourceAndCitations(originalIdx, false);
}

function handleSourceLeave(originalIdx) {
  // Only clear on leave if not in sticky mode
  if (window.citationState?.stickyMode) return;

  clearAllCitationHighlights();
}

function handleSourceClick(event, originalIdx) {
  // Don't interfere with link clicks or detail toggles
  if (event.target.tagName === 'A' || event.target.tagName === 'SUMMARY') {
    return;
  }

  event.stopPropagation();

  // If clicking the same source, toggle off sticky mode
  if (window.citationState?.stickyMode === 'source' &&
      window.citationState?.stickySourceIdx === originalIdx) {
    window.citationState.stickyMode = null;
    window.citationState.stickySourceIdx = null;
    clearAllCitationHighlights();
    return;
  }

  // Set sticky mode
  window.citationState.stickyMode = 'source';
  window.citationState.stickySourceIdx = originalIdx;
  window.citationState.stickyCitationIdx = null;

  highlightSourceAndCitations(originalIdx, true);
}

// === HIGHLIGHT FUNCTIONS ===

function highlightCitationAndSource(citationIdx, expand) {
  clearAllCitationHighlights();

  // Highlight the citation markers and cited text
  const markers = document.querySelectorAll(`.citation-markers[data-citation="${citationIdx}"]`);
  markers.forEach(marker => marker.classList.add('highlighted'));

  const citedTexts = document.querySelectorAll(`.cited-text[data-citation="${citationIdx}"]`);
  citedTexts.forEach(text => text.classList.add('highlighted'));

  // Get the source chunks for this citation
  const displayIndices = window.citationToDisplayIndices?.get(citationIdx) || [];

  if (displayIndices.length > 0) {
    // Open sidebar and switch to citations
    openSidebar();
    switchTab('citations');

    // Highlight and scroll to sources
    displayIndices.forEach((displayIdx, index) => {
      const sourceElement = document.getElementById(`display-source-${displayIdx}`);
      if (sourceElement) {
        sourceElement.classList.add('highlighted');

        // Expand details if requested
        if (expand) {
          const details = document.getElementById(`details-source-${displayIdx}`);
          if (details) {
            details.open = true;
          }
        }

        // Scroll to the first one
        if (index === 0) {
          sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }
}

function highlightSourceAndCitations(originalIdx, expand) {
  clearAllCitationHighlights();

  const displayIdx = window.originalToDisplayIndex?.get(originalIdx);

  // Highlight the source
  const sourceElement = document.getElementById(`display-source-${displayIdx}`);
  if (sourceElement) {
    sourceElement.classList.add('highlighted');

    // Expand details if requested
    if (expand) {
      const details = document.getElementById(`details-source-${displayIdx}`);
      if (details) {
        details.open = true;
      }
    }

    // Scroll to source
    openSidebar();
    switchTab('citations');
    sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Find all citations that reference this source
  const citationIndices = window.chunkToCitations?.get(originalIdx) || [];

  // Highlight all related markers and cited texts
  citationIndices.forEach(citationIdx => {
    const markers = document.querySelectorAll(`.citation-markers[data-citation="${citationIdx}"]`);
    markers.forEach(marker => marker.classList.add('highlighted'));

    const citedTexts = document.querySelectorAll(`.cited-text[data-citation="${citationIdx}"]`);
    citedTexts.forEach(text => text.classList.add('highlighted'));
  });
}

function clearAllCitationHighlights() {
  // Remove all highlight classes from markers
  document.querySelectorAll('.citation-markers.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });

  // Remove all highlight classes from cited text
  document.querySelectorAll('.cited-text.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });

  // Remove all highlight classes from sources
  document.querySelectorAll('.citation-item.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });
}

function scrollToDisplaySource(displayIdx) {
  openSidebar();
  switchTab('citations');

  const sourceElement = document.getElementById(`display-source-${displayIdx}`);
  if (sourceElement) {
    sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sourceElement.style.backgroundColor = 'var(--bg-light)';
    setTimeout(() => {
      sourceElement.style.backgroundColor = '';
    }, 2000);
  }
}

// Keep old function for backward compatibility
function scrollToSource(sourceIdx) {
  scrollToDisplaySource(sourceIdx);
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

  // Clear sticky citation highlighting when clicking outside
  if (window.citationState?.stickyMode) {
    // Check if click is on a citation-related element
    const isClickOnCitation = e.target.closest('.citation-marker') ||
                              e.target.closest('.citation-markers') ||
                              e.target.closest('.citation-item') ||
                              e.target.closest('.cited-text');

    if (!isClickOnCitation) {
      window.citationState.stickyMode = null;
      window.citationState.stickyCitationIdx = null;
      window.citationState.stickySourceIdx = null;
      clearAllCitationHighlights();
    }
  }
});
