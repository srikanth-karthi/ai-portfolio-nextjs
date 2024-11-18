import { CohereClientV2 } from "cohere-ai";
import { DataAPIClient } from "@datastax/astra-db-ts";

const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY,
});

const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
  namespace: process.env.ASTRA_DB_NAMESPACE,
});

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages?.length - 1]?.content;
    let docContext = "";

    const { embeddings } = await cohere.embed({
      model: "embed-english-v2.0",
      embeddingTypes: ['float'],
      texts: [latestMessage],
    });

    const collection = db.collection("portfolio");
    const cursor = collection.find(null, {
      sort: {
        $vector: embeddings.float[0],
      },
      limit: 1,
    });

    const documents = await cursor.toArray();
    
    documents.forEach(doc => {
      if (doc.vector && Array.isArray(doc.vector)) {
        console.log("Document vector dimension:", doc.vector.length);
      }
    });

    docContext = `
      START CONTEXT
      ${documents?.map((doc) => doc.description).join("\n")}
      END CONTEXT
    `;

    const ragPrompt = [
      {
        role: "system",
        content: `
          You are an AI assistant answering questions as Srikanth in his Portfolio App. 
          Format responses using markdown where applicable.
          ${docContext}
          If the answer is not provided in the context, the AI assistant will say, 
          "I'am sorry, I do not know the answer".
        `,
      },
    ];
    // console.log("POST ~ ragPrompt:", ragPrompt);

    // const response = await cohere.chat({
    //   model: "command", 
    //   messages: [...ragPrompt, ...[messages[messages.length - 1]]],
    // });

    const groqPrompt = [...ragPrompt, { role: "user", content: latestMessage }];
    console.log("POST ~ groqPrompt:", groqPrompt);

    // Step 5: Send Request to Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Groq model to use
        messages: groqPrompt,
      }),
    });

    const jsonResponse = await response.json();
   const  generatedMessage = jsonResponse.choices[0].message.content;
    console.log("POST ~ jsonResponse:", generatedMessage);

    return Response.json({
      role: "Srikanth",
      content: generatedMessage,
    });

  } catch (e) {
    console.error(e);
    throw e;
  }
}
