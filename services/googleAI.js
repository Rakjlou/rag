import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error('GOOGLE_AI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey });

export async function createStore(displayName) {
  const operation = await ai.fileSearchStores.create({
    config: { displayName }
  });
  return operation;
}

export async function listStores(pageSize = 100) {
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

export async function getStore(name) {
  return await ai.fileSearchStores.get({ name });
}

export async function deleteStore(name, force = true) {
  return await ai.fileSearchStores.delete({
    name,
    config: { force }
  });
}

export async function uploadFileToStore(filePath, storeName, displayName, chunkingConfig = null) {
  const config = { displayName };
  if (chunkingConfig) {
    config.chunkingConfig = chunkingConfig;
  }

  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: filePath,
    fileSearchStoreName: storeName,
    config
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    operation = await ai.operations.get({ operation });
  }

  return operation;
}

export async function listDocuments(storeName, pageSize = 100) {
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

export async function deleteDocument(name, force = true) {
  return await ai.fileSearchStores.documents.delete({
    name,
    config: { force }
  });
}

export async function search(query, storeNames, model = 'gemini-2.5-flash') {
  const response = await ai.models.generateContent({
    model,
    contents: query,
    config: {
      tools: [{
        fileSearch: {
          fileSearchStoreNames: storeNames
        }
      }]
    }
  });

  return {
    text: response.text,
    candidates: response.candidates,
    groundingMetadata: response.candidates?.[0]?.groundingMetadata
  };
}
