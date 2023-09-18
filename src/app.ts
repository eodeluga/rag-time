import dotenv from 'dotenv';
import fs from 'fs';
import * as rl from 'readline-sync'
import { ContextChatEngine } from "llamaindex";
import { DocumentIndexer } from "@@libs/DocumentIndexer";

dotenv.config();

// Index all files in docs directory
const ragFiles = await fs.promises.readdir('docs');
const documentIndexer = new DocumentIndexer(ragFiles.map((file) => `docs/${file}`));
const { index: vectorStoreIndex } = await documentIndexer.indexDocuments();

const retriever = vectorStoreIndex.asRetriever({ similarityTopK: 5 });
const chatEngine = new ContextChatEngine({
  retriever,
  systemPrompt: "You are Larry Sage, a helpful assistant at OneCall Insurance in the UK."
    + "You are here to advise the user on the insurance products that OneCall offers, "
    + "and to help them with any policy or legal questions they may have. "
    + "Lookup https://www.onecallinsurance.co.uk/faq to answer questions when necessary."
    + "Now please start by welcoming the customer and introducing yourself.",
})

//TODO: Save and retrieve chat history using ChatMessageBuffer object

// Can generate context using chatEngine.generateContext() method


console.log((await chatEngine.chat({ message: 'Start' })).response);
while (true) {
  const query = rl.question("\nQuery: ");
  chatEngine.chatHistory.addMessage({ role: 'user', content: query });
  const stream = await chatEngine.chat({ message: 'Please respond', stream: true });
  for await (const chunk of stream) {
    process.stdout.write(chunk.response);
  }
}
