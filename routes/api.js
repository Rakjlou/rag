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
    console.log(`Listing documents for store: ${req.params.name}`);
    const documents = await googleAI.listDocuments(req.params.name);
    console.log(`Found ${documents.length} documents`);
    res.json({ success: true, documents });
  } catch (error) {
    console.error('Error listing documents for store:', req.params.name);
    console.error('Full error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stores/:name(*)/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const storeName = req.params.name;
    const displayName = req.body.displayName || req.file.originalname;

    const chunkingConfig = req.body.maxTokensPerChunk ? {
      maxTokensPerChunk: parseInt(req.body.maxTokensPerChunk),
      maxOverlapTokens: req.body.maxOverlapTokens ? parseInt(req.body.maxOverlapTokens) : undefined
    } : null;

    const customMetadata = req.body.customMetadata ? JSON.parse(req.body.customMetadata) : null;

    const result = await googleAI.uploadFileToStore(
      req.file.path,
      storeName,
      displayName,
      chunkingConfig,
      customMetadata
    );

    await fs.unlink(req.file.path);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error uploading file:', error);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stores/:name(*)/import', async (req, res) => {
  try {
    const { fileName, displayName, maxTokensPerChunk, maxOverlapTokens, customMetadata } = req.body;

    if (!fileName) {
      return res.status(400).json({ success: false, error: 'fileName is required' });
    }

    const storeName = req.params.name;

    const chunkingConfig = maxTokensPerChunk ? {
      maxTokensPerChunk: parseInt(maxTokensPerChunk),
      maxOverlapTokens: maxOverlapTokens ? parseInt(maxOverlapTokens) : undefined
    } : null;

    const result = await googleAI.importFileToStore(
      fileName,
      storeName,
      displayName,
      chunkingConfig,
      customMetadata
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
