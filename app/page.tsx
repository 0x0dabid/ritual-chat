"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { AgentSetupCard } from "@/components/AgentSetupCard";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { ChatWindow } from "@/components/ChatWindow";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { TestnetNotice } from "@/components/TestnetNotice";
import type { AgentSession, ChatMessage } from "@/lib/types";

const SESSION_STORAGE_KEY = "ritual-chat-session-id";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: walletPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasInjectedWallet, setHasInjectedWallet] = useState<boolean | null>(null);

  const mockMode = useMemo(() => agent?.mockMode ?? process.env.NEXT_PUBLIC_MOCK_MODE !== "false", [agent]);
  const walletAddress = isConnected && address ? address : null;
  const realModePending = Boolean(agent && !agent.mockMode && agent.status !== "active");

  useEffect(() => {
    setHasInjectedWallet(typeof window !== "undefined" && "ethereum" in window);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
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

  useEffect(() => {
    if (!walletAddress) {
      setAgent(null);
      setMessages([]);
      return;
    }

    fetch(`/api/agent/status?walletAddress=${encodeURIComponent(walletAddress)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.session) {
          setAgent(null);
          setMessages([]);
          return;
        }

        window.localStorage.setItem(SESSION_STORAGE_KEY, data.session.id);
        setSessionId(data.session.id);
        setAgent(data.session);
        setMessages(data.messages ?? []);
      })
      .catch(() => {
        setError("Something went wrong while loading your Ritual agent. Please try again.");
      });
  }, [walletAddress]);

  async function connectWallet() {
    setError(null);
    setNotice(null);
    try {
      if (hasInjectedWallet === false) {
        throw new Error("No injected wallet detected. Please install MetaMask or open in a browser with an EVM wallet.");
      }

      const injected = connectors[0];
      if (!injected) {
        throw new Error("No injected wallet detected. Please install MetaMask or open in a browser with an EVM wallet.");
      }
      await connectAsync({ connector: injected });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed. Please try again.");
    }
  }

  async function createAgent() {
    if (!walletAddress) {
      setError("Connect your wallet first to create your Ritual Smart Account.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingStep("Creating Ritual Smart Account...");
    try {
      const response = await fetch("/api/agent/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          walletAddress,
        }),
      });

      setLoadingStep("Creating Persistent Agent...");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Agent creation failed");

      window.localStorage.setItem(SESSION_STORAGE_KEY, data.session.id);
      setSessionId(data.session.id);
      setAgent(data.session);
      setMessages(data.messages ?? []);

      if (!data.session.mockMode && data.session.status !== "active") {
        setLoadingStep(null);
        setNotice(data.message ?? "Smart Account loaded successfully. Persistent Agent integration is pending.");
        return;
      }

      setLoadingStep("Activating chat session...");
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
        <Hero onCreate={createAgent} disabled={!walletAddress || Boolean(agent)} />
        <TestnetNotice mockMode={mockMode} />
        {error ? (
          <div className="rounded-lg border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-ritual-green/25 bg-ritual-card px-4 py-3 text-sm text-ritual-green">
            {notice}
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <AgentSetupCard
              active={agent?.status === "active"}
              realModePending={realModePending}
              loadingStep={loadingStep}
              walletAddress={walletAddress}
              walletPending={walletPending}
              noInjectedWallet={hasInjectedWallet === false}
              onConnectWallet={connectWallet}
              onDisconnectWallet={() => disconnect()}
              onCreate={createAgent}
            />
            {realModePending ? (
              <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Next step: Persistent Agent integration</h2>
                <p className="mt-2 text-sm leading-6 text-black/68">
                  Your smart account is live on Ritual Testnet. The next milestone is wiring this smart account into Ritual&apos;s PersistentAgentFactory so it can own a real Persistent Agent.
                </p>
              </section>
            ) : null}
            {agent ? <AgentStatusCard session={agent} /> : null}
          </div>
          <ChatWindow
            disabled={!agent || agent.status !== "active"}
            messages={messages}
            onSend={sendMessage}
          />
        </div>
      </div>
      <Footer />
    </main>
  );
}
