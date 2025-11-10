import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import * as googleAI from '../services/googleAI.js';

const router = express.Router();

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }
});

/**
 * Builds chunking configuration object from request parameters
 * @param {number} [maxTokensPerChunk] - Max tokens per chunk
 * @param {number} [maxOverlapTokens] - Overlap tokens between chunks
 * @returns {Object|null} Chunking config or null if no params provided
 */
function buildChunkingConfig(maxTokensPerChunk, maxOverlapTokens) {
  if (!maxTokensPerChunk) return null;

  return {
    white_space_config: {
      max_tokens_per_chunk: parseInt(maxTokensPerChunk),
      max_overlap_tokens: maxOverlapTokens ? parseInt(maxOverlapTokens) : undefined
    }
  };
}

/**
 * Parses custom metadata from request body
 * Accepts JSON string or object, converts to Google API format
 * @param {string|Object} metadata - Metadata as JSON string or object
 * @returns {Array|null} Array of {key, stringValue} objects or null
 */
function parseCustomMetadata(metadata) {
  if (!metadata) return null;

  try {
    const obj = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return Object.entries(obj).map(([key, value]) => ({
      key,
      stringValue: String(value)
    }));
  } catch (error) {
    throw new Error(`Invalid metadata format: ${error.message}`);
  }
}

router.get('/stores', async (req, res) => {
  try {
    const stores = await googleAI.listStores();
    res.json({ success: true, stores });
  } catch (error) {
    console.error('Error listing stores:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stores', async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName) {
      return res.status(400).json({ success: false, error: 'displayName is required' });
    }
    const store = await googleAI.createStore(displayName);
    res.json({ success: true, store });
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stores/:name(*)', async (req, res) => {
  try {
    const store = await googleAI.getStore(req.params.name);
    res.json({ success: true, store });
  } catch (error) {
    console.error('Error getting store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/stores/:name(*)', async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName) {
      return res.status(400).json({ success: false, error: 'displayName is required' });
    }
    const store = await googleAI.updateStore(req.params.name, displayName);
    res.json({ success: true, store });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/stores/:name(*)', async (req, res) => {
  try {
    await googleAI.deleteStore(req.params.name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stores/:name(*)/documents', async (req, res) => {
  try {
    const documents = await googleAI.listDocuments(req.params.name);
    res.json({ success: true, documents });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stores/:name(*)/upload', upload.single('file'), async (req, res) => {
  let tempFile = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    tempFile = req.file.path;
    const storeName = req.params.name;
    const displayName = req.body.displayName || req.file.originalname;

    const chunkingConfig = buildChunkingConfig(
      req.body.maxTokensPerChunk,
      req.body.maxOverlapTokens
    );

    const customMetadata = parseCustomMetadata(req.body.customMetadata);

    const result = await googleAI.uploadFileToStore(
      req.file.path,
      storeName,
      displayName,
      req.file.mimetype,
      chunkingConfig,
      customMetadata
    );

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Always clean up temp file
    if (tempFile) {
      await fs.unlink(tempFile).catch(err =>
        console.error('Failed to clean up temp file:', err)
      );
    }
  }
});

router.post('/stores/:name(*)/import', async (req, res) => {
  try {
    const { fileName, displayName, maxTokensPerChunk, maxOverlapTokens, customMetadata } = req.body;

    if (!fileName) {
      return res.status(400).json({ success: false, error: 'fileName is required' });
    }

    const storeName = req.params.name;

    const chunkingConfig = buildChunkingConfig(maxTokensPerChunk, maxOverlapTokens);
    const parsedMetadata = parseCustomMetadata(customMetadata);

    const result = await googleAI.importFileToStore(
      fileName,
      storeName,
      displayName,
      chunkingConfig,
      parsedMetadata
    );

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error importing file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/documents/:name(*)', async (req, res) => {
  try {
    await googleAI.deleteDocument(req.params.name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { query, storeNames, model, metadataFilter } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    if (!storeNames || !Array.isArray(storeNames) || storeNames.length === 0) {
      return res.status(400).json({ success: false, error: 'storeNames array is required' });
    }

    const result = await googleAI.search(query, storeNames, model, metadataFilter);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
