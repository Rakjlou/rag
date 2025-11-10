import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error('GOOGLE_AI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Polls a Google AI operation until completion
 * @param {Object} operation - Initial operation object
 * @param {number} intervalMs - Polling interval in milliseconds
 * @returns {Promise<Object>} Completed operation
 */
async function pollUntilDone(operation, intervalMs = 1000) {
  let current = operation;
  while (!current.done) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    current = await ai.operations.get({ operation: current });
  }
  return current;
}

/**
 * Creates a new file search store in Google AI
 * @param {string} displayName - Human-readable name for the store
 * @returns {Promise<Object>} Created store object with name and metadata
 * @throws {Error} If API key is missing or request fails
 */
export async function createStore(displayName) {
  const operation = await ai.fileSearchStores.create({
    config: { displayName }
  });
  return operation;
}

/**
 * Lists all file search stores with pagination
 * @param {number} [pageSize=20] - Number of stores per page
 * @returns {Promise<Array<Object>>} Array of all stores
 */
export async function listStores(pageSize = 20) {
  const stores = [];
  const pager = await ai.fileSearchStores.list({
    config: { pageSize }
  });

  let page = pager.page;
  while (true) {
    for (const store of page) {
      stores.push(store);
    }
    if (!pager.hasNextPage()) break;
    page = await pager.nextPage();
  }

  return stores;
}

/**
 * Retrieves a specific store by name
 * @param {string} name - Store name (format: fileSearchStores/*)
 * @returns {Promise<Object>} Store object
 */
export async function getStore(name) {
  return await ai.fileSearchStores.get({ name });
}

/**
 * Deletes a file search store
 * @param {string} name - Store name
 * @param {boolean} [force=true] - Force delete even if store contains documents
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteStore(name, force = true) {
  return await ai.fileSearchStores.delete({
    name,
    config: { force }
  });
}

/**
 * Uploads a file to a store and polls until indexing completes
 *
 * This is a long-running operation that:
 * 1. Uploads the file with metadata and chunking config
 * 2. Polls every 1 second until indexing completes
 * 3. Returns the completed operation with document details
 *
 * @param {string} filePath - Local file path to upload
 * @param {string} storeName - Target store name (format: fileSearchStores/*)
 * @param {string} displayName - Display name for the document
 * @param {string} mimeType - MIME type of the file
 * @param {Object} [chunkingConfig] - Optional chunking configuration with max_tokens_per_chunk
 * @param {Array} [customMetadata] - Optional metadata array of {key, stringValue} objects
 * @returns {Promise<Object>} Completed upload operation with document details
 * @throws {Error} If upload fails or times out
 */
export async function uploadFileToStore(filePath, storeName, displayName, mimeType, chunkingConfig = null, customMetadata = null) {
  const config = { displayName };

  if (mimeType) {
    config.mimeType = mimeType;
  }

  if (chunkingConfig) {
    config.chunkingConfig = chunkingConfig;
  }
  if (customMetadata) {
    config.customMetadata = customMetadata;
  }

  const operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: filePath,
    fileSearchStoreName: storeName,
    config
  });

  return await pollUntilDone(operation);
}

/**
 * Lists all documents in a store with pagination
 * @param {string} storeName - Store name
 * @param {number} [pageSize=20] - Number of documents per page
 * @returns {Promise<Array<Object>>} Array of all documents in the store
 */
export async function listDocuments(storeName, pageSize = 20) {
  const documents = [];
  const pager = await ai.fileSearchStores.documents.list({
    parent: storeName,
    config: { pageSize }
  });

  let page = pager.page;
  while (true) {
    for (const doc of page) {
      documents.push(doc);
    }
    if (!pager.hasNextPage()) break;
    page = await pager.nextPage();
  }

  return documents;
}

/**
 * Deletes a document from a store
 * @param {string} name - Document name (format: fileSearchStores/*/documents/*)
 * @param {boolean} [force=true] - Force deletion
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteDocument(name, force = true) {
  return await ai.fileSearchStores.documents.delete({
    name,
    config: { force }
  });
}

/**
 * Updates a store's display name
 * @param {string} name - Store name
 * @param {string} displayName - New display name
 * @returns {Promise<Object>} Updated store object
 */
export async function updateStore(name, displayName) {
  return await ai.fileSearchStores.update({
    name,
    config: { displayName }
  });
}

/**
 * Imports a previously uploaded file into a store and polls until complete
 *
 * Similar to uploadFileToStore but for files already in Google AI storage
 *
 * @param {string} fileName - Name of file to import
 * @param {string} storeName - Target store name
 * @param {string} [displayName] - Optional display name for the document
 * @param {Object} [chunkingConfig] - Optional chunking configuration
 * @param {Array} [customMetadata] - Optional metadata array
 * @returns {Promise<Object>} Completed import operation
 */
export async function importFileToStore(fileName, storeName, displayName = null, chunkingConfig = null, customMetadata = null) {
  const config = {};
  if (displayName) {
    config.displayName = displayName;
  }
  if (chunkingConfig) {
    config.chunkingConfig = chunkingConfig;
  }
  if (customMetadata) {
    config.customMetadata = customMetadata;
  }

  const operation = await ai.fileSearchStores.importFile({
    fileName,
    fileSearchStoreName: storeName,
    config
  });

  return await pollUntilDone(operation);
}

/**
 * Performs AI-powered search across file search stores
 *
 * Uses Google's Gemini model with file search tool to query documents
 * and return answers with grounding metadata for citations
 *
 * @param {string} query - Natural language search query
 * @param {Array<string>} storeNames - Array of store names to search
 * @param {string} [model='gemini-2.5-flash'] - Gemini model to use
 * @param {string} [metadataFilter] - Optional metadata filter (google.aip.dev/160 format)
 * @returns {Promise<Object>} Search result with text, candidates, and grounding metadata
 */
export async function search(query, storeNames, model = 'gemini-2.5-flash', metadataFilter = null) {
  const fileSearchConfig = {
    fileSearchStoreNames: storeNames
  };

  if (metadataFilter) {
    fileSearchConfig.metadataFilter = metadataFilter;
  }

  const response = await ai.models.generateContent({
    model,
    contents: query,
    config: {
      tools: [{
        fileSearch: fileSearchConfig
      }]
    }
  });

  return {
    text: response.text,
    candidates: response.candidates,
    groundingMetadata: response.candidates?.[0]?.groundingMetadata
  };
}
