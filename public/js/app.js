/**
 * Client-side application logic
 * Handles API communication, store/document/search management, and citation display
 */

// Constants
const API_BASE = '/api';
const CITATION_PREVIEW_LENGTH = 150;
const SUCCESS_MESSAGE_DURATION = 3000;

// Client-side error boundaries
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  showError('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showError('An unexpected error occurred. Please try again.');
});

/**
 * Makes an API call with error handling
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} API response data
 */
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

/**
 * Shows a success message notification
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
  const existing = document.querySelector('.success-message');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'success-message';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), SUCCESS_MESSAGE_DURATION);
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
      showEmptyState(container, 'No stores found. Create one to get started.');
      return;
    }

    const storeElements = stores.map(store => createStoreCard(store));
    replaceChildren(container, ...storeElements);
  } catch (error) {
    showErrorState(container, 'Failed to load stores');
  }
}

/**
 * Creates a store card element using template
 * @param {Object} store - Store data
 * @returns {DocumentFragment} Store card element
 */
function createStoreCard(store) {
  const template = new TemplateEngine('store-card-template');

  return template.create(store, {
    '.store-title': (el) => {
      el.textContent = store.displayName || 'Unnamed Store';
    },
    '.store-name': (el) => {
      el.textContent = store.name;
    },
    '.open-btn': (el) => {
      el.href = `/stores/${encodeURIComponent(store.name)}`;
    },
    '.delete-btn': (el) => {
      el.addEventListener('click', () => deleteStore(store.name));
    }
  });
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
      showEmptyState(container, 'No documents yet. Upload one to get started.');
      return;
    }

    const documentElements = documents.map(doc => createDocumentItem(doc));
    replaceChildren(container, ...documentElements);
  } catch (error) {
    console.error('Frontend error loading documents:', error);
    showErrorState(container, 'Failed to load documents');
  }
}

/**
 * Creates a document item element using template
 * @param {Object} doc - Document data
 * @returns {DocumentFragment} Document item element
 */
function createDocumentItem(doc) {
  const template = new TemplateEngine('document-item-template');
  const fileSize = doc.sizeBytes ? (parseInt(doc.sizeBytes) / 1024).toFixed(1) + ' KB' : 'Unknown';
  const createDate = doc.createTime ? new Date(doc.createTime).toLocaleString() : 'Unknown';

  return template.create(doc, {
    '.document-item': (el) => {
      el.addEventListener('click', function() {
        toggleDocumentDetails(this);
      });
    },
    '.doc-title': (el) => {
      el.textContent = doc.displayName || doc.name;
    },
    '.document-meta': (el) => {
      el.textContent = `${fileSize} • ${doc.mimeType || 'Unknown type'}`;
    },
    '.delete-btn': (el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDocument(doc.name);
      });
    },
    '.doc-id': (el) => {
      el.textContent = doc.name;
    },
    '.doc-display-name': (el) => {
      el.textContent = doc.displayName || 'N/A';
    },
    '.doc-created': (el) => {
      el.textContent = createDate;
    },
    '.doc-size': (el) => {
      el.textContent = fileSize;
    },
    '.doc-mime': (el) => {
      el.textContent = doc.mimeType || 'Unknown';
    },
    '.doc-state': (el) => {
      el.textContent = doc.state || 'Unknown';
    },
    '.metadata-row': (el) => {
      if (doc.customMetadata && doc.customMetadata.length > 0) {
        el.style.display = 'block';
        const tagsContainer = el.querySelector('.metadata-tags');
        const tags = doc.customMetadata.map(m => createMetadataTag(m));
        replaceChildren(tagsContainer, ...tags);
      }
    }
  });
}

/**
 * Creates a metadata tag element
 * @param {Object} metadata - Metadata object with key and value
 * @returns {DocumentFragment} Metadata tag element
 */
function createMetadataTag(metadata) {
  const template = new TemplateEngine('metadata-tag-template');

  return template.create(metadata, {
    '.metadata-tag': (el) => {
      el.textContent = `${metadata.key}: ${metadata.stringValue || metadata.numericValue}`;
    }
  });
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

/**
 * Creates a citation item element
 * @param {Object} data - Citation data
 * @returns {Node} Citation item element
 */
function createCitationItem(data) {
  if (data.type === 'web') {
    const template = new TemplateEngine('citation-web-item-template');

    const fragment = template.create(data, {
      '.citation-item': (el) => {
        el.id = `display-source-${data.displayIdx}`;
        el.dataset.originalIdx = data.originalIdx;
        el.addEventListener('mouseenter', () => handleSourceHover(data.originalIdx));
        el.addEventListener('mouseleave', () => handleSourceLeave(data.originalIdx));
        el.addEventListener('click', (e) => handleSourceClick(e, data.originalIdx));
      },
      '.citation-ref': (el) => {
        el.textContent = `[${data.displayIdx + 1}]`;
      },
      '.citation-doc': (el) => {
        el.textContent = data.title;
        el.href = data.uri;
      }
    });

    return fragment.firstElementChild || fragment;
  } else {
    // Document citation
    const template = new TemplateEngine('citation-item-template');
    const preview = data.excerpt.length > CITATION_PREVIEW_LENGTH
      ? data.excerpt.substring(0, CITATION_PREVIEW_LENGTH) + '...'
      : data.excerpt;

    const fragment = template.create(data, {
      '.citation-item': (el) => {
        el.id = `display-source-${data.displayIdx}`;
        el.dataset.originalIdx = data.originalIdx;
        el.addEventListener('mouseenter', () => handleSourceHover(data.originalIdx));
        el.addEventListener('mouseleave', () => handleSourceLeave(data.originalIdx));
        el.addEventListener('click', (e) => handleSourceClick(e, data.originalIdx));
      },
      '.citation-ref': (el) => {
        el.textContent = `[${data.displayIdx + 1}]`;
      },
      '.citation-doc': (el) => {
        el.textContent = data.title;
      },
      '.citation-details': (el) => {
        el.id = `details-source-${data.displayIdx}`;
      },
      '.citation-preview': (el) => {
        el.textContent = preview;
      },
      '.citation-full-text': (el) => {
        el.textContent = data.excerpt;
        el.style.whiteSpace = 'pre-wrap';
      }
    });

    return fragment.firstElementChild || fragment;
  }
}

function displaySearchResults(result) {
  const resultsDiv = document.getElementById('search-results');
  const citationsContainer = document.getElementById('citations-container');

  if (!result || !result.text) {
    showEmptyState(resultsDiv, 'No results found');
    showEmptyState(citationsContainer, 'No citations available');
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
  const rawAnswerHtml = marked.parse(answerText);

  // Sanitize the markdown output with DOMPurify
  const sanitizedAnswerHtml = DOMPurify.sanitize(rawAnswerHtml, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'class', 'data-citation', 'data-citation-idx'],
    KEEP_CONTENT: true
  });

  // Display answer in main section using safe DOM manipulation
  const resultContent = createElement('div', { className: 'search-result-content' });
  const heading = createElement('h3', {}, 'Answer');
  const answerDiv = createElement('div', { className: 'answer-text', id: 'answer-text' });
  answerDiv.innerHTML = sanitizedAnswerHtml;

  resultContent.appendChild(heading);
  resultContent.appendChild(answerDiv);
  replaceChildren(resultsDiv, resultContent);

  // Attach event listeners to citation markers
  attachCitationMarkerListeners();

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
    const citationsList = createElement('div', { className: 'citations-list' });

    let sourceDisplayIdx = 0;
    result.groundingMetadata.groundingChunks.forEach((chunk, originalIdx) => {
      // Skip chunks that weren't cited
      if (!citedChunkIndices.has(originalIdx)) return;

      if (chunk.retrievedContext) {
        const citationElement = createCitationItem({
          displayIdx: sourceDisplayIdx,
          originalIdx,
          title: chunk.retrievedContext.title || 'Unknown',
          excerpt: chunk.retrievedContext.text || '',
          type: 'document'
        });
        citationsList.appendChild(citationElement);
        sourceDisplayIdx++;
      } else if (chunk.web) {
        const citationElement = createCitationItem({
          displayIdx: sourceDisplayIdx,
          originalIdx,
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
          type: 'web'
        });
        citationsList.appendChild(citationElement);
        sourceDisplayIdx++;
      }
    });

    replaceChildren(citationsContainer, citationsList);

    // Open sidebar and switch to citations tab
    openSidebar();
    switchTab('citations');
  } else {
    citationsContainer.innerHTML = '<p class="empty-state">No citations available</p>';
  }
}

/**
 * Attaches event listeners to citation markers after rendering
 */
function attachCitationMarkerListeners() {
  const markers = document.querySelectorAll('.citation-marker');

  markers.forEach(marker => {
    const citationIdx = parseInt(marker.dataset.citationIdx);

    marker.addEventListener('mouseenter', () => handleMarkerHover(citationIdx));
    marker.addEventListener('mouseleave', () => handleMarkerLeave(citationIdx));
    marker.addEventListener('click', (e) => handleMarkerClick(e, citationIdx));
  });
}

/**
 * Insert citation markers into the TEXT before rendering (new simple approach)
 * @param {string} text - The answer text before markdown rendering
 * @param {Array} groundingSupports - Citation segments from API
 * @param {Map} chunkIndexToDisplayIndex - Maps chunk indices to display numbers
 * @returns {string} Text with citation markers inserted
 */
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
    // Create marker HTML with data attributes (no inline handlers)
    const badges = mod.displayIndices
      .map(idx => `<span class="citation-marker" data-citation-idx="${mod.citationIdx}">${escapeHtml(String(idx + 1))}</span>`)
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
    closeAllDetails();
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
  // Redirect to new system with default options
  highlightCitationAndSource(citationIdx, { expand: false, scroll: false });
}

function highlightCitationBySource(chunkIdx) {
  // Redirect to new system with default options
  highlightSourceAndCitations(chunkIdx, { expand: false, scroll: false });
}

function clearHighlight() {
  // Redirect to new system
  clearAllCitationHighlights();
}

// === MARKER-DRIVEN INTERACTION HANDLERS ===

function handleMarkerHover(citationIdx) {
  // Only respond to hover if not in sticky mode
  if (window.citationState?.stickyMode) return;

  // Hover: highlight only, no scroll, no expand
  highlightCitationAndSource(citationIdx, { expand: false, scroll: false });
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
    closeAllDetails();
    clearAllCitationHighlights();
    return;
  }

  // Close all previous details before switching
  closeAllDetails();

  // Set sticky mode
  window.citationState.stickyMode = 'marker';
  window.citationState.stickyCitationIdx = citationIdx;
  window.citationState.stickySourceIdx = null;

  // Click: highlight + scroll to sidebar + expand
  highlightCitationAndSource(citationIdx, { expand: true, scroll: true, scrollTarget: 'sidebar' });
}

// === SOURCE-DRIVEN INTERACTION HANDLERS ===

function handleSourceHover(originalIdx) {
  // Only respond to hover if not in sticky mode
  if (window.citationState?.stickyMode) return;

  // Hover: highlight only, no scroll, no expand
  highlightSourceAndCitations(originalIdx, { expand: false, scroll: false });
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
    closeAllDetails();
    clearAllCitationHighlights();
    return;
  }

  // Close all previous details before switching
  closeAllDetails();

  // Set sticky mode
  window.citationState.stickyMode = 'source';
  window.citationState.stickySourceIdx = originalIdx;
  window.citationState.stickyCitationIdx = null;

  // Click: highlight + scroll to answer + expand
  highlightSourceAndCitations(originalIdx, { expand: true, scroll: true, scrollTarget: 'answer' });
}

// === HIGHLIGHT FUNCTIONS ===

function highlightCitationAndSource(citationIdx, options = {}) {
  // Default options: for backward compatibility
  const { expand = false, scroll = false, scrollTarget = 'sidebar' } = options;

  clearAllCitationHighlights();

  // Highlight the citation markers and cited text
  const markers = document.querySelectorAll(`.citation-markers[data-citation="${citationIdx}"]`);
  markers.forEach(marker => marker.classList.add('highlighted'));

  const citedTexts = document.querySelectorAll(`.cited-text[data-citation="${citationIdx}"]`);
  citedTexts.forEach(text => text.classList.add('highlighted'));

  // Get the source chunks for this citation
  const displayIndices = window.citationToDisplayIndices?.get(citationIdx) || [];

  if (displayIndices.length > 0 && scrollTarget === 'sidebar') {
    // Open sidebar and switch to citations
    openSidebar();
    switchTab('citations');

    // Highlight and expand sources
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

        // Scroll to the first one only if scroll is enabled
        if (scroll && index === 0) {
          sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }
}

function highlightSourceAndCitations(originalIdx, options = {}) {
  // Default options: for backward compatibility
  const { expand = false, scroll = false, scrollTarget = 'answer' } = options;

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

    // Open sidebar if we're scrolling to it
    if (scrollTarget === 'sidebar') {
      openSidebar();
      switchTab('citations');
      if (scroll) {
        sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
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

  // Scroll to first cited text in answer if requested
  if (scroll && scrollTarget === 'answer' && citationIndices.length > 0) {
    const firstCitationIdx = citationIndices[0];
    const firstCitedText = document.querySelector(`.cited-text[data-citation="${firstCitationIdx}"]`);
    if (firstCitedText) {
      firstCitedText.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
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

function closeAllDetails() {
  // Close all <details> elements in the citations list
  document.querySelectorAll('.citation-details').forEach(details => {
    details.open = false;
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
      closeAllDetails();
      clearAllCitationHighlights();
    }
  }
});
