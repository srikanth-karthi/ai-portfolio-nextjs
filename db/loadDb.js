import { CohereClient } from "cohere-ai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import "dotenv/config";
import sampleData from "./sample-data.json" with { type: "json" };

const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY
});
console.log("cohere", cohere);
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
    namespace: process.env.ASTRA_DB_NAMESPACE
});

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});

const createCollection = async () => {
    try {
        await db.createCollection("portfolio", {
            vector: {
                dimension: 4096, // Adjust dimension based on the Cohere model used
            }
        });
    } catch (error) {
        console.log("Collection Already Exists", error);
    }
};

const loadData = async () => {
    const collection = await db.collection("portfolio");
    for await (const { id, info, description } of sampleData) {
        // Ensure description is a string before passing it to the splitter
        const descriptionString = String(description);

        const chunks = await splitter.splitText(descriptionString);
        let i = 0;
        for await (const chunk of chunks) {
            // Use Cohere's embeddings API to generate embeddings for each chunk
            const { embeddings } = await cohere.embed({
                model: "embed-english-v2.0", // Use the appropriate model for embeddings
                texts: [chunk],
            });

            const res = await collection.insertOne({
                document_id: id,
                $vector: embeddings[0], // Assuming embeddings[0] is the first (and only) embedding
                info,
                description: chunk
            });

            i++;
        }
    }

    console.log("Data added");
};


createCollection().then(() => loadData());
