import { Document, VectorStoreIndex, storageContextFromDefaults } from 'llamaindex';
import { nanoid } from 'nanoid';
import path from 'path';

type VectorStoreIndexStorage = {
  index: VectorStoreIndex;
  persistDir: string;
}
  

export class DocumentIndexer {
    
  private documentPaths: string[];
  private persistDir: string;
  
  constructor(documentPaths: string[], persistDir?: string) {
    this.documentPaths = documentPaths;
    this.persistDir = !persistDir ? `.data/${nanoid()}` : persistDir;
  }

  private async loadDocumentData() {
    const documents = this.documentPaths.map(async (docPath) => {
      const filepath = path.parse(docPath);
      const ext = filepath.ext.toLowerCase();
      
      switch (ext) {
        case ".txt":
          return new (await import("llamaindex")).TextFileReader().loadData(docPath);
        case ".pdf":
          return new (await import("llamaindex")).PDFReader().loadData(docPath);
        case ".csv":
          return new (await import("llamaindex")).PapaCSVReader().loadData(docPath);
        case ".docx":
          return new (await import("llamaindex")).DocxReader().loadData(docPath);
        case ".html":
          return new (await import("llamaindex")).HTMLReader().loadData(docPath);
        case ".md":
          return new (await import("llamaindex")).MarkdownReader().loadData(docPath);
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }
    })
    return Promise.all(documents)
  }

  async indexDocuments(): Promise<VectorStoreIndexStorage>  {
    const documentsData = await this.loadDocumentData();
    const documents = documentsData.map(([document]) => new Document(document));
    const index = await VectorStoreIndex.fromDocuments(documents, {
      storageContext: await storageContextFromDefaults({
        persistDir: this.persistDir,
      }),
    });
    
    return {
      index,
      persistDir: this.persistDir,
    }
  }
}
