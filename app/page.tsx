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
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);

  const mockMode = useMemo(() => agent?.mockMode ?? process.env.NEXT_PUBLIC_MOCK_MODE === "true", [agent]);
  const walletAddress = isConnected && address ? address : null;
  const realModePending = false;
  const chatReady = Boolean(agent && agent.status === "active" && agent.chatStatus === "ready");
  const chatDisabledMessage = agent?.chatStatus === "missing-chat-manager"
    ? "ChatManager is not configured yet."
    : agent?.chatStatus === "missing-relayer"
      ? "Server relayer is not configured yet."
      : undefined;

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
        setError("Something went wrong while loading Ritual Chat. Please try again.");
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
        setError("Something went wrong while loading Ritual Chat. Please try again.");
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
      setError("Connect your wallet first to start Ritual Chat.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingStep("Starting Ritual Chat...");
    try {
      const response = await fetch("/api/agent/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          walletAddress,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ritual Chat setup failed");

      window.localStorage.setItem(SESSION_STORAGE_KEY, data.session.id);
      setSessionId(data.session.id);
      setAgent(data.session);
      setMessages(data.messages ?? []);

      if (!data.session.mockMode && data.session.status !== "active") {
        setLoadingStep(null);
        setNotice(data.message ?? "Ritual Chat is ready.");
        return;
      }

      setLoadingStep(data.session.basicChatStatus === "active" ? "Ready to chat." : "Ready.");
      window.setTimeout(() => setLoadingStep(null), 900);
    } catch (err) {
      setLoadingStep(null);
      setError(err instanceof Error ? err.message : "Something went wrong while starting Ritual Chat. Please try again.");
    }
  }

  async function sendMessage(prompt: string) {
    if (!agent) return;
    if (isSubmittingTx) return;
    setIsSubmittingTx(true);
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
      console.error("Ritual chat transaction failed", err);
      setError(formatChatTransactionError(err));
    } finally {
      setIsSubmittingTx(false);
    }
  }

  async function pollTx(txHash?: string): Promise<"confirmed" | "failed" | "pending"> {
    if (!txHash) return "pending";
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      const response = await fetch(`/api/tx/status?hash=${encodeURIComponent(txHash)}`);
      if (!response.ok) continue;
      const data = await response.json();
      setMessages((current) => current.map((message) => (
        message.txHash === txHash
          ? {
              ...message,
              txStatus: data.status,
              content: data.assistantResponse && message.role === "assistant"
                ? data.assistantResponse
                : message.content,
            }
          : message
      )));
      if (data.status === "confirmed" || data.status === "failed") return data.status;
    }
    return "pending";
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
            {agent ? (
              <AgentStatusCard session={agent} />
            ) : null}
          </div>
          <ChatWindow
            disabled={!chatReady}
            disabledMessage={chatDisabledMessage}
            isSubmittingTx={isSubmittingTx}
            messages={messages}
            onSend={sendMessage}
          />
        </div>
      </div>
      <Footer />
    </main>
  );
}

function formatChatTransactionError(err: unknown) {
  const message = collectErrorText(err).toLowerCase();
  if (
    message.includes("replacement transaction underpriced")
    || message.includes("nonce too low")
    || message.includes("already known")
    || message.includes("transaction underpriced")
  ) {
    return "Your wallet has a stuck nonce or duplicate transaction. Clear activity/nonce data in your wallet, refresh, and try again.";
  }

  if (err instanceof Error) return err.message;
  return "Ritual LLM response failed. Please try again.";
}

function collectErrorText(err: unknown) {
  if (!err || typeof err !== "object") return String(err ?? "");

  const record = err as Record<string, unknown>;
  return [
    record.message,
    record.shortMessage,
    record.details,
    record.cause,
  ].map((value) => typeof value === "string" ? value : "")
    .join(" ");
}
