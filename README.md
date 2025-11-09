# Google File Search Interface

A complete web interface to interact with Google's File Search API, built with Node.js.

## Features

- **Store Management**: Create, list, view, update, and delete file search stores
- **Document Upload**: Upload files (PDF, DOCX, code files, 100+ formats) with custom chunking config and metadata
- **File Import**: Import previously uploaded files into stores
- **Custom Metadata**: Tag documents with custom key-value pairs for filtering and context
- **Metadata Filtering**: Filter search results by document metadata
- **Natural Language Search**: Query documents using conversational language with AI-powered RAG
- **Citations**: View sources and grounding metadata for search results
- **RESTful API**: All features accessible via API endpoints
- **Web Interface**: Clean, responsive UI for easy interaction

## Prerequisites

- Node.js v20 or higher
- Google AI API key ([Get one here](https://aistudio.google.com/apikey))

## Installation

```bash
npm install
```

## Configuration

Set your Google AI API key as an environment variable:

```bash
export GOOGLE_AI_API_KEY=your_api_key_here
```

## Usage

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The server will run on `http://localhost:3000`

## API Endpoints

### Stores

- `GET /api/stores` - List all stores
- `POST /api/stores` - Create a new store
  - Body: `{ "displayName": "My Store" }`
- `GET /api/stores/:name` - Get store details
- `PATCH /api/stores/:name` - Update store display name
  - Body: `{ "displayName": "New Name" }`
- `DELETE /api/stores/:name` - Delete a store

### Documents

- `GET /api/stores/:name/documents` - List documents in store
- `POST /api/stores/:name/upload` - Upload file to store
  - Form data: `file`, optional: `displayName`, `customMetadata` (JSON string), `maxTokensPerChunk`, `maxOverlapTokens`
  - Example metadata: `{"author": "Isaac Asimov", "genre": "Sci-Fi", "year": "1950"}` (converted to API format automatically)
- `POST /api/stores/:name/import` - Import pre-uploaded file to store
  - Body: `{ "fileName": "files/xyz", "displayName": "...", "customMetadata": {...}, "maxTokensPerChunk": 512, "maxOverlapTokens": 50 }`
- `DELETE /api/documents/:name` - Delete a document

### Search

- `POST /api/search` - Search across stores
  - Body: `{ "query": "your question", "storeNames": ["store-name"], "model": "gemini-2.5-flash", "metadataFilter": "author=John Doe" }`
  - Metadata filter syntax: `key=value` (follows google.aip.dev/160 specification)

## Web Interface

- `/` - Home page with API documentation
- `/stores` - Manage stores
- `/stores/:name` - Store detail page with document upload and search

## Supported File Types

PDF, DOCX, XLSX, PPTX, TXT, HTML, Markdown, JSON, CSV, and 100+ code file formats.

Maximum file size: 100MB per document.

## Architecture

```
├── server.js           # Express server entry point
├── services/
│   └── googleAI.js    # Google AI SDK wrapper
├── middleware/
│   └── auth.js        # Auth middleware placeholder
├── routes/
│   ├── api.js         # API routes
│   └── web.js         # Web page routes
├── views/             # EJS templates
├── public/
│   ├── css/          # Stylesheets
│   └── js/           # Client-side JavaScript
```

## Pricing

- Storage: Free
- Indexing: $0.15 per 1 million tokens
- Query embeddings: Free
- Retrieved tokens: Standard context pricing

## License

MIT
