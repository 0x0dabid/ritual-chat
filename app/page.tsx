"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentSetupCard } from "@/components/AgentSetupCard";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { ChatWindow } from "@/components/ChatWindow";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { TestnetNotice } from "@/components/TestnetNotice";
import type { AgentSession, ChatMessage } from "@/lib/types";

const SESSION_STORAGE_KEY = "ritual-chat-session-id";
const WALLET_STORAGE_KEY = "ritual-chat-wallet";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mockMode = useMemo(() => agent?.mockMode ?? false, [agent]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const storedWallet = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (storedWallet) setWalletAddress(storedWallet);
    if (!stored) return;

    setSessionId(stored);
    fetch(`/api/agent/status?sessionId=${encodeURIComponent(stored)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.session) return;
        setAgent(data.session);
        setMessages(data.messages ?? []);
      })
      .catch(() => {
        setError("Something went wrong while loading your Ritual agent. Please try again.");
      });
  }, []);

  async function connectWallet() {
    setError(null);
    if (!window.ethereum) {
      setError("No browser wallet found. You can start a public test session instead.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const first = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
      if (!first) throw new Error("Wallet connection failed. Please try again.");
      setWalletAddress(first);
      window.localStorage.setItem(WALLET_STORAGE_KEY, first);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed. Please try again.");
    }
  }

  async function createAgent(usePublicSession = false) {
    setError(null);
    setLoadingStep("Creating Ritual Smart Account...");
    try {
      const response = await fetch("/api/agent/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userWallet: usePublicSession ? null : walletAddress,
        }),
      });

      setLoadingStep("Creating Persistent Agent...");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Agent creation failed");

      setLoadingStep("Activating chat session...");
      window.localStorage.setItem(SESSION_STORAGE_KEY, data.session.id);
      setSessionId(data.session.id);
      setAgent(data.session);
      setMessages(data.messages ?? []);
      setLoadingStep("Ready to chat.");
      window.setTimeout(() => setLoadingStep(null), 900);
    } catch (err) {
      setLoadingStep(null);
      setError(err instanceof Error ? err.message : "Something went wrong while creating your Ritual agent. Please try again.");
    }
  }

  async function sendMessage(prompt: string) {
    if (!agent) return;
    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: agent.id,
      role: "user",
      content: prompt,
      txStatus: "confirmed",
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: agent.id, prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ritual LLM response failed");

      setMessages((current) => [...current, data.message]);
      pollTx(data.message.txHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ritual LLM response failed. Please try again.");
    }
  }

  async function pollTx(txHash?: string) {
    if (!txHash) return;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      const response = await fetch(`/api/tx/status?hash=${encodeURIComponent(txHash)}`);
      if (!response.ok) continue;
      const data = await response.json();
      setMessages((current) => current.map((message) => (
        message.txHash === txHash ? { ...message, txStatus: data.status } : message
      )));
      if (data.status === "confirmed" || data.status === "failed") return;
    }
  }

  return (
    <main className="min-h-screen bg-ritual-page text-ritual-text">
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Hero onCreate={createAgent} />
        <TestnetNotice mockMode={mockMode} />
        {error ? (
          <div className="rounded-lg border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <AgentSetupCard
              active={Boolean(agent)}
              loadingStep={loadingStep}
              walletAddress={walletAddress}
              onConnectWallet={connectWallet}
              onCreate={() => createAgent(false)}
              onPublicSession={() => createAgent(true)}
            />
            {agent ? <AgentStatusCard session={agent} /> : null}
          </div>
          <ChatWindow
            disabled={!agent}
            messages={messages}
            onSend={sendMessage}
          />
        </div>
      </div>
      <Footer />
    </main>
  );
}
