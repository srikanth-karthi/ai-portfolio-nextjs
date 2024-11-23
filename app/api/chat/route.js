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
    console.log("POST ~ embeddings:", embeddings);

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
          You are an AI assistant for Srikanth's Portfolio App. Your goal is to provide **short, sweet, and to-the-point** answers based on the context of his portfolio. After answering, provide the follow-up question in a **separate variable** so it can be rendered on the front end.
    
        **Instructions:**
        1. Keep answers **concise** and **engaging**.
        2. If the information is missing from the context, reply with: "I’m sorry, I do not know the answer."
        3. Use **minimal markdown** for emphasis, but avoid unnecessary formatting.
        4. Maintain a **friendly, professional** tone.
        5. After answering, provide **one relevant follow-up question** in a separate variable.
    
        **Context Guidelines:**
        - You have access to Srikanth's Portfolio App context, which includes all details about his professional background, education, skills, key projects, internships, certifications, volunteer work, and contact information.
        - Avoid making assumptions or generating information outside the provided context.
        - Respond with the **most relevant** and **shortest form** of information possible.
    
        **Question:** 
        {{latestMessage}} 
    
        **Context:**
        START CONTEXT
        Iam Srikanth Karthikeyan, a highly skilled full-stack developer, cloud engineer, and migration specialist, currently employed as an Associate Software Engineer at Presidio. In this role, I focus on designing and developing scalable web applications while automating cloud infrastructure using modern technologies and frameworks. My expertise spans both front-end and back-end development, where I utilize HTML, CSS, JavaScript, and frameworks like React and Angular to create dynamic, responsive web applications. On the back-end, I am proficient in technologies such as Node.js, Express.js, MongoDB, MySQL, and Java, which allow me to build and maintain highly efficient and scalable server-side systems. My experience extends to cloud technologies, specifically AWS and Azure, where I contribute to cloud migration projects, ensuring optimal performance, scalability, and cost-efficiency. I also specialize in automating infrastructure with Terraform, streamlining cloud deployments to enhance operational efficiency. At Presidio, I work with cross-functional teams to build and manage infrastructure, collaborate on backend system design, and troubleshoot technical challenges to ensure high-quality, seamless cloud transitions.
    
        I earned my BE in Electronics and Communication Engineering from Sri Krishna College of Technology, Coimbatore (2020–2024), graduating with a CGPA of 8.37. Prior to that, I completed my Higher Secondary Certificate (HSC) from Thamarai Matric Higher Secondary School, Erode (2018–2020), where I scored 81.6%, and my Secondary School Leaving Certificate (SSLC) from the same school (2017–2018) with a score of 89.2%. My technical skill set also includes system administration with Linux, .NET Web APIs for secure API development, and experience in developing and optimizing enterprise applications in both cloud and on-premise environments. I have worked on several key projects, including Uzhavan House, a comprehensive agricultural e-commerce platform designed to enable secure login, manage product inventories, and facilitate seller interactions; the Online Compiler, an intuitive platform enabling users to write, compile, and execute code in multiple programming languages directly from their browser; and the Language Translator, a web application that offers real-time translation services between various languages.
    
        During my internship at Kanavu Startup Village, I worked as an SEO Intern, optimizing web content for better search engine rankings, and as a Backend Engineer, focusing on building backend systems for an enterprise construction management application. In addition, I gained hands-on experience during my time at Presidio, from April to September 2024, working with technologies like ASP.NET, Microsoft Azure, SQL Server, Docker, REST APIs, and Python, where I contributed to the development, optimization, and management of scalable backend systems and cloud infrastructure. Beyond work, I am committed to volunteerism, having served as an NSS Volunteer at Thamarai Matric Higher Secondary School, where I participated in various community service programs. I also regularly donate blood at Ramakrishna Hospital and worked as the Social Media Coordinator for the Chithiram Club at my college, managing social media campaigns to increase community engagement.
    
        I hold certifications that reflect my commitment to continuous learning, including Effective Writing through NPTEL, Ethics in Engineering, Cloud and Virtualization from IT Academy, Introduction to Cybersecurity from Cisco, and Cloud Foundations from AWS Academy. I am passionate about sharing knowledge through my writing, contributing articles on topics like simplifying identity management with Azure and AWS, the curious use of lava lamps by Cloudflare for encryption, and breaking down complex system design concepts like CAP, BASE, and KISS. For further professional engagement, you can reach me via email at srikanthkarthi2003@gmail.com, or connect with me on LinkedIn at linkedin.com/in/srikanth-karthikeyan. Additionally, my work can be found on GitHub at github.com/srikanth-karthi, and I have a portfolio available at dev-srikanth-portfolio.netlify.app. I am also active on Facebook, Instagram, and Medium, and my coding profiles can be viewed on LeetCode and HackerRank.
    
        This version includes all aspects of your professional background, education, skills, key projects, internships, certifications, volunteer work, and contact information in a more elaborate format, providing a detailed narrative of your career and personal engagements.
        END CONTEXT
        `,
      },
    ];
    
    
    

    const responses = await cohere.chat({
      model: "command", 
      messages: [...ragPrompt, ...[messages[messages.length - 1]]],
    });
    console.log("POST ~ responses:", responses.message.content[0]);

    const groqPrompt = [...ragPrompt, { role: "user", content: latestMessage }];

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

    return Response.json({
      role: "Srikanth",
      content: [generatedMessage],
    });

  } catch (e) {
    console.error(e);
    throw e;
  }
}
