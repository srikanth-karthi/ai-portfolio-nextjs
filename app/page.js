"use client";

import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  let speechSynthesisInstance = window.speechSynthesis;

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const readAloud = (text) => {
    if ("speechSynthesis" in window) {
      // Stop any ongoing speech
      if (speechSynthesisInstance.speaking) {
        speechSynthesisInstance.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN"; // Set to Indian English
      utterance.pitch = 1.5; // Normal pitch
      utterance.rate = 1.5 // Normal speed

      // Select an Indian male voice
      const voices = speechSynthesisInstance.getVoices();
      const indianMaleVoice = voices.find(
        (voice) => voice.lang === "en-IN" && voice.name.toLowerCase().includes("male")
      );

      if (indianMaleVoice) {
        utterance.voice = indianMaleVoice;
      }

      speechSynthesisInstance.speak(utterance);
    } else {
      console.warn("Text-to-speech is not supported in this browser.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage = { role: "user", content: input };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, newMessage] }),
      });

      const data = await res.json();
      const botMessage = { role: "srikanth", content: data.content };

      setMessages((prevMessages) => [...prevMessages, botMessage]);
      readAloud(data.content); // Read aloud the bot's response
    } catch (error) {
      console.error("Error fetching response:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const noMessages = messages.length === 0;

  return (
    <main>
      <Image
        layout="fill"
        src="/back.jpeg"
        alt="RoadsideCoder Banner"
        objectFit="cover"
      />
      <div className="absolute px-4 w-full h-screen flex flex-col gap-5 items-center bottom-5">
        <h1 className="text-4xl font-Kanit md:text-5xl font-bold text-white mt-10">
          Srikanth&rsquo;s AI Portfolio
        </h1>

        <section className="w-full flex-1 flex flex-col overflow-y-scroll">
          {noMessages ? (
            <p className="text-center text-xl">Ask me Anything</p>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={`message-${index}`}
                  className={`rounded-3xl ${
                    message.role === "user"
                      ? "rounded-br-none bg-blue-500 ml-auto"
                      : "rounded-bl-none bg-orange-700"
                  } m-2 p-2 px-4 w-[70%] md:w-[80%] mt-4 text-gray-200`}
                >
                  <b>{message.role === "user" ? "User:" : "Srikanth:"}</b>{" "}
                  {message.content}
                </div>
              ))}

              {isLoading && <span className="ml-auto">Thinking... 🤔</span>}
            </>
          )}
        </section>

        <form className="w-full flex gap-2" onSubmit={handleSubmit}>
          <input
            onChange={handleInputChange}
            value={input}
            type="text"
            placeholder="What's your hometown?"
            className="py-3 px-5 flex-1 rounded text-black text-2xl border-2 border-gray-50 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded text-xl px-5 cursor-pointer focus:outline-none disabled:bg-blue-400"
          >
            Submit
          </button>
        </form>
      </div>
    </main>
  );
}
