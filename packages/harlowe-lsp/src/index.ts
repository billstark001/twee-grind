/**
 * Harlowe Language Server Protocol implementation
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

// Create connection for the server
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
});

// Document event handlers
documents.onDidOpen((e) => {
  connection.console.log(`Document opened: ${e.document.uri}`);
});

documents.onDidChangeContent((e) => {
  connection.console.log(`Document changed: ${e.document.uri}`);
});

documents.listen(connection);
connection.listen();

export { connection, documents };
