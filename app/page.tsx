"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseAbi,
  parseEther,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useChainId, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { AgentSetupCard } from "@/components/AgentSetupCard";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { ChatWindow } from "@/components/ChatWindow";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { TestnetNotice } from "@/components/TestnetNotice";
import type { AgentSession, ChatMessage } from "@/lib/types";
import { ritualTestnet } from "@/lib/wagmi";

const SESSION_STORAGE_KEY = "ritual-chat-session-id";
const LEGACY_SESSION_WALLET_KEY = "ritual-chat-session-wallet-key";
const SESSION_WALLET_ENCRYPTED_KEY = "ritual-chat-session-wallet-encrypted-key";
const SESSION_WALLET_CRYPTO_KEY = "ritual-chat-local-crypto-key";
const RITUAL_WALLET_ADDRESS = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948";
// Ritual's GLM LLM path locks worst-case escrow by registered maxSeqLen,
// not by prompt size or maxCompletionTokens. Current docs quote ~0.31 RITUAL
// per in-flight GLM call, so require a small headroom buffer client-side.
const MIN_LLM_RITUAL_WALLET_ESCROW_WEI = parseEther("0.32");
const ritualWalletAbi = parseAbi([
  "function deposit(uint256 lockDuration) payable",
  "function withdraw(uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function lockUntil(address account) view returns (uint256)",
]);
const ritualPublicClient = createPublicClient({
  chain: ritualTestnet,
  transport: http(ritualTestnet.rpcUrls.default.http[0]),
});

interface WalletBalances {
  nativeWei: bigint;
  ritualWalletWei: bigint;
  ritualWalletLockUntil: bigint;
  currentBlock: bigint;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: walletPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasInjectedWallet, setHasInjectedWallet] = useState<boolean | null>(null);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [sessionWalletKey, setSessionWalletKey] = useState<Hex | null>(null);
  const [activeSender, setActiveSender] = useState<"wallet" | "session">("wallet");
  const [ritualWalletAmount, setRitualWalletAmount] = useState("0.35");
  const [sessionWalletAmount, setSessionWalletAmount] = useState("0.01");
  const [walletActionPending, setWalletActionPending] = useState(false);
  const [connectedBalances, setConnectedBalances] = useState<WalletBalances | null>(null);
  const [sessionBalances, setSessionBalances] = useState<WalletBalances | null>(null);

  const mockMode = useMemo(() => agent?.mockMode ?? process.env.NEXT_PUBLIC_MOCK_MODE === "true", [agent]);
  const walletAddress = isConnected && address ? address : null;
  const sessionWalletAddress = useMemo(() => (
    sessionWalletKey ? privateKeyToAccount(sessionWalletKey).address : null
  ), [sessionWalletKey]);
  const realModePending = false;
  const activeBalances = activeSender === "session" ? sessionBalances : connectedBalances;
  const activeSenderHasLlmEscrow = Boolean(activeBalances && isSenderReadyForLlm(activeBalances));
  const chatReady = Boolean(
    agent
      && agent.status === "active"
      && agent.chatStatus === "ready"
      && activeSenderHasLlmEscrow,
  );
  const chatDisabledMessage = getChatDisabledMessage(agent, activeSender, sessionWalletAddress, activeBalances);

  useEffect(() => {
    setHasInjectedWallet(typeof window !== "undefined" && "ethereum" in window);
    loadStoredSessionWallet()
      .then((storedSessionWallet) => {
        if (!storedSessionWallet) return;
        setSessionWalletKey(storedSessionWallet);
        setActiveSender("session");
      })
      .catch(() => {
        setError("Stored session wallet could not be loaded in this browser.");
      });
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
      setConnectedBalances(null);
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

  useEffect(() => {
    refreshWalletBalances();
    // Balances are intentionally refreshed when either wallet address changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, sessionWalletAddress]);

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

      if (data.requiresWalletSubmission && data.txRequest) {
        const txHash = await submitPreparedTransaction(data.txRequest);
        const assistantMessage: ChatMessage = {
          ...data.message,
          txHash,
        };
        setMessages((current) => [...current, assistantMessage]);
        pollTx(txHash);
      } else {
        setMessages((current) => [...current, data.message]);
        pollTx(data.message.txHash);
      }
    } catch (err) {
      console.error("Ritual chat transaction failed", err);
      setError(formatChatTransactionError(err));
    } finally {
      setIsSubmittingTx(false);
    }
  }

  async function submitPreparedTransaction(txRequest: { to: Address; data: Hex; value?: string }) {
    if (mockMode) return `0x${crypto.randomUUID().replace(/-/g, "").padEnd(64, "0")}` as Hash;
    if (activeSender === "session") {
      if (!sessionWalletKey) throw new Error("Generate a session wallet before using session chat.");
      const balances = await loadWalletBalances(privateKeyToAccount(sessionWalletKey).address);
      setSessionBalances(balances);
      assertSenderReadyForLlm(balances, "session wallet");
      const account = privateKeyToAccount(sessionWalletKey);
      const client = createWalletClient({
        account,
        chain: ritualTestnet,
        transport: http(ritualTestnet.rpcUrls.default.http[0]),
      });
      const gas = await estimateBufferedGas(account.address, txRequest);
      const fees = await getEip1559Fees();
      assertNativeGasBalance(balances.nativeWei, gas * fees.maxFeePerGas + BigInt(txRequest.value ?? "0"), "session wallet");
      return client.sendTransaction({
        to: txRequest.to,
        data: txRequest.data,
        value: BigInt(txRequest.value ?? "0"),
        gas,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
    }

    if (!walletClient) throw new Error("Connect your wallet before sending chat.");
    if (chainId !== ritualTestnet.id) {
      throw new Error("Wrong network. Switch MetaMask to Ritual Testnet before sending chat.");
    }
    const balances = await loadWalletBalances(walletClient.account.address);
    setConnectedBalances(balances);
    assertSenderReadyForLlm(balances, "connected wallet");
    const gas = await estimateBufferedGas(walletClient.account.address, txRequest);
    const fees = await getEip1559Fees();
    assertNativeGasBalance(balances.nativeWei, gas * fees.maxFeePerGas + BigInt(txRequest.value ?? "0"), "connected wallet");
    return walletClient.sendTransaction({
      to: txRequest.to,
      data: txRequest.data,
      value: BigInt(txRequest.value ?? "0"),
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
  }

  function generateSessionWallet() {
    const privateKey = sessionWalletKey ?? generatePrivateKey();
    storeEncryptedSessionWallet(privateKey)
      .then(() => {
        setSessionWalletKey(privateKey);
        setActiveSender("session");
        setNotice("Session wallet ready. It is encrypted and stored locally in this browser.");
      })
      .catch(() => {
        setError("Session wallet could not be stored in this browser.");
      });
  }

  async function fundSessionWallet() {
    if (!sessionWalletAddress) {
      setError("Generate a session wallet before funding it.");
      return;
    }
    if (!walletClient) {
      setError("Connect MetaMask before funding the session wallet.");
      return;
    }
    if (chainId !== ritualTestnet.id) {
      setError("Wrong network. Switch MetaMask to Ritual Testnet before funding.");
      return;
    }

    await runWalletAction("Funding was rejected or failed.", async () => {
      const txHash = await walletClient.sendTransaction({
        to: sessionWalletAddress,
        value: parseRitualAmount(sessionWalletAmount),
      });
      const status = await pollTx(txHash);
      if (status !== "confirmed") throw new Error("Funding transaction failed on-chain.");
      await refreshWalletBalances();
      setNotice(`Session wallet funded with ${sessionWalletAmount} RITUAL.`);
    });
  }

  async function withdrawSessionNativeToMetaMask() {
    if (!walletAddress) {
      setError("Connect MetaMask before withdrawing from the session wallet.");
      return;
    }
    const amount = parseRitualAmount(sessionWalletAmount);
    await runWalletAction("Session wallet withdrawal failed.", async () => {
      const txHash = await getSessionWalletClient().sendTransaction({
        to: walletAddress,
        value: amount,
      });
      const status = await pollTx(txHash);
      if (status !== "confirmed") throw new Error("Session wallet withdrawal failed on-chain.");
      await refreshWalletBalances();
      setNotice(`Withdrew ${sessionWalletAmount} RITUAL from session wallet to MetaMask.`);
    });
  }

  async function depositConnectedToRitualWallet() {
    await depositToRitualWallet("wallet", ritualWalletAmount);
  }

  async function depositSessionToRitualWallet() {
    await depositToRitualWallet("session", ritualWalletAmount);
  }

  async function withdrawConnectedFromRitualWallet() {
    await withdrawFromRitualWallet("wallet", ritualWalletAmount);
  }

  async function withdrawSessionFromRitualWallet() {
    await withdrawFromRitualWallet("session", ritualWalletAmount);
  }

  async function withdrawFromRitualWallet(sender: "wallet" | "session", amountText: string) {
    const amount = parseRitualAmount(amountText);
    await runWalletAction("RitualWallet withdrawal failed.", async () => {
      const txHash = sender === "session"
        ? await getSessionWalletClient().writeContract({
            address: RITUAL_WALLET_ADDRESS,
            abi: ritualWalletAbi,
            functionName: "withdraw",
            args: [amount],
          })
        : await getConnectedWalletClient().writeContract({
            address: RITUAL_WALLET_ADDRESS,
            abi: ritualWalletAbi,
            functionName: "withdraw",
            args: [amount],
          });
      const status = await pollTx(txHash);
      if (status !== "confirmed") throw new Error("RitualWallet withdrawal failed on-chain.");
      await refreshWalletBalances();
      setNotice(`Withdrew ${amountText || "0"} RITUAL from RitualWallet.`);
    });
  }

  async function depositToRitualWallet(sender: "wallet" | "session", amountText: string) {
    const amount = parseRitualAmount(amountText);
    await runWalletAction("RitualWallet deposit failed.", async () => {
      const txHash = sender === "session"
        ? await getSessionWalletClient().writeContract({
            address: RITUAL_WALLET_ADDRESS,
            abi: ritualWalletAbi,
            functionName: "deposit",
            args: [50_000n],
            value: amount,
          })
        : await getConnectedWalletClient().writeContract({
            address: RITUAL_WALLET_ADDRESS,
            abi: ritualWalletAbi,
            functionName: "deposit",
            args: [50_000n],
            value: amount,
          });
      const status = await pollTx(txHash);
      if (status !== "confirmed") throw new Error("RitualWallet deposit failed on-chain.");
      await refreshWalletBalances();
      setNotice(`Deposited ${amountText || "0"} RITUAL to RitualWallet.`);
    });
  }

  async function refreshWalletBalances() {
    const [connected, session] = await Promise.all([
      walletAddress ? loadWalletBalances(walletAddress).catch(() => null) : Promise.resolve(null),
      sessionWalletAddress ? loadWalletBalances(sessionWalletAddress).catch(() => null) : Promise.resolve(null),
    ]);
    setConnectedBalances(connected);
    setSessionBalances(session);
  }

  async function loadWalletBalances(account: Address): Promise<WalletBalances> {
    const [nativeWei, ritualWalletWei, ritualWalletLockUntil, currentBlock] = await Promise.all([
      ritualPublicClient.getBalance({ address: account }),
      ritualPublicClient.readContract({
        address: RITUAL_WALLET_ADDRESS,
        abi: ritualWalletAbi,
        functionName: "balanceOf",
        args: [account],
      }),
      ritualPublicClient.readContract({
        address: RITUAL_WALLET_ADDRESS,
        abi: ritualWalletAbi,
        functionName: "lockUntil",
        args: [account],
      }),
      ritualPublicClient.getBlockNumber(),
    ]);
    return { nativeWei, ritualWalletWei, ritualWalletLockUntil, currentBlock };
  }

  async function estimateBufferedGas(account: Address, txRequest: { to: Address; data: Hex; value?: string }) {
    const estimate = await ritualPublicClient.estimateGas({
      account,
      to: txRequest.to,
      data: txRequest.data,
      value: BigInt(txRequest.value ?? "0"),
    });
    return estimate + estimate / 5n + 25_000n;
  }

  async function getEip1559Fees() {
    const gasPrice = await ritualPublicClient.getGasPrice();
    const maxPriorityFeePerGas = gasPrice / 10n > 0n ? gasPrice / 10n : 1n;
    return {
      maxFeePerGas: gasPrice * 2n,
      maxPriorityFeePerGas,
    };
  }

  function assertSenderReadyForLlm(balances: WalletBalances, label: string) {
    if (balances.nativeWei <= 0n) {
      throw new Error(`The ${label} needs native Ritual testnet gas before chatting.`);
    }
    if (balances.ritualWalletWei <= 0n) {
      throw new Error(`The ${label} needs a RitualWallet deposit before chatting.`);
    }
    if (balances.ritualWalletWei < MIN_LLM_RITUAL_WALLET_ESCROW_WEI) {
      throw new Error(`The ${label} needs more RitualWallet balance for this LLM request. Required about ${formatBalance(MIN_LLM_RITUAL_WALLET_ESCROW_WEI)}, available ${formatBalance(balances.ritualWalletWei)}.`);
    }
    if (balances.ritualWalletLockUntil <= balances.currentBlock) {
      throw new Error(`The ${label} RitualWallet deposit is not locked. Deposit any amount before chatting.`);
    }
  }

  function assertNativeGasBalance(balance: bigint, required: bigint, label: string) {
    if (balance < required) {
      throw new Error(`The ${label} needs more native RITUAL for gas. Required about ${formatBalance(required)}, available ${formatBalance(balance)}.`);
    }
  }

  async function runWalletAction(fallbackError: string, action: () => Promise<void>) {
    if (walletActionPending) return;
    setError(null);
    setNotice(null);
    setWalletActionPending(true);
    try {
      await action();
    } catch (err) {
      console.error(fallbackError, err);
      setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setWalletActionPending(false);
    }
  }

  function getConnectedWalletClient() {
    if (!walletClient) throw new Error("Connect MetaMask before using RitualWallet.");
    if (chainId !== ritualTestnet.id) {
      throw new Error("Wrong network. Switch MetaMask to Ritual Testnet first.");
    }
    return walletClient;
  }

  function getSessionWalletClient() {
    if (!sessionWalletKey) throw new Error("Generate a session wallet first.");
    const account = privateKeyToAccount(sessionWalletKey);
    return createWalletClient({
      account,
      chain: ritualTestnet,
      transport: http(ritualTestnet.rpcUrls.default.http[0]),
    });
  }

  function parseRitualAmount(value: string) {
    if (!value || Number(value) <= 0) {
      throw new Error("Enter a positive RITUAL amount.");
    }
    return parseEther(value);
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
              <AgentStatusCard
                session={agent}
                sessionWalletAddress={sessionWalletAddress}
                activeSender={activeSender}
                activeSenderLabel={activeSender === "session" ? "Session Wallet" : "MetaMask"}
                ritualWalletAmount={ritualWalletAmount}
                sessionWalletAmount={sessionWalletAmount}
                connectedNativeBalance={formatBalance(connectedBalances?.nativeWei)}
                connectedRitualWalletBalance={formatBalance(connectedBalances?.ritualWalletWei)}
                connectedRitualWalletLock={formatLock(connectedBalances)}
                sessionNativeBalance={formatBalance(sessionBalances?.nativeWei)}
                sessionRitualWalletBalance={formatBalance(sessionBalances?.ritualWalletWei)}
                sessionRitualWalletLock={formatLock(sessionBalances)}
                ritualWalletAddress={RITUAL_WALLET_ADDRESS}
                actionPending={walletActionPending}
                onGenerateSessionWallet={generateSessionWallet}
                onUseConnectedWallet={() => setActiveSender("wallet")}
                onUseSessionWallet={() => setActiveSender("session")}
                onFundSessionWallet={fundSessionWallet}
                onWithdrawSessionNative={withdrawSessionNativeToMetaMask}
                onDepositConnected={depositConnectedToRitualWallet}
                onWithdrawConnected={withdrawConnectedFromRitualWallet}
                onDepositSession={depositSessionToRitualWallet}
                onWithdrawSession={withdrawSessionFromRitualWallet}
                onSessionAmountChange={setSessionWalletAmount}
                onRitualWalletAmountChange={setRitualWalletAmount}
              />
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

function formatBalance(value: bigint | undefined) {
  if (value === undefined) return "Loading";
  return `${Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 5 })} RITUAL`;
}

function formatLock(balances: WalletBalances | null) {
  if (!balances) return "Loading";
  return balances.ritualWalletLockUntil > balances.currentBlock
    ? `Locked until ${balances.ritualWalletLockUntil.toString()}`
    : "Not locked";
}

function isSenderReadyForLlm(balances: WalletBalances) {
  return balances.nativeWei > 0n
    && balances.ritualWalletWei >= MIN_LLM_RITUAL_WALLET_ESCROW_WEI
    && balances.ritualWalletLockUntil > balances.currentBlock;
}

function getChatDisabledMessage(
  agent: AgentSession | null,
  activeSender: "wallet" | "session",
  sessionWalletAddress: Address | null,
  balances: WalletBalances | null,
) {
  if (!agent) return undefined;
  if (agent.chatStatus === "missing-chat-manager") return "ChatManager is not configured yet.";
  if (activeSender === "session" && !sessionWalletAddress) return "Create a session wallet before using session chat.";
  if (!balances) return "Loading active sender balances.";
  if (balances.nativeWei <= 0n) return "The active chat sender needs native Ritual testnet gas before chatting.";
  if (balances.ritualWalletWei < MIN_LLM_RITUAL_WALLET_ESCROW_WEI) {
    return `Deposit at least ${formatBalance(MIN_LLM_RITUAL_WALLET_ESCROW_WEI)} in RitualWallet for the active sender before chatting.`;
  }
  if (balances.ritualWalletLockUntil <= balances.currentBlock) {
    return "The active chat sender RitualWallet deposit is not locked. Deposit before chatting.";
  }
  return undefined;
}

async function loadStoredSessionWallet() {
  const encrypted = window.localStorage.getItem(SESSION_WALLET_ENCRYPTED_KEY);
  if (encrypted) {
    return decryptLocalValue(encrypted) as Promise<Hex>;
  }

  const legacy = window.localStorage.getItem(LEGACY_SESSION_WALLET_KEY);
  if (legacy?.startsWith("0x")) {
    await storeEncryptedSessionWallet(legacy as Hex);
    window.localStorage.removeItem(LEGACY_SESSION_WALLET_KEY);
    return legacy as Hex;
  }

  return null;
}

async function storeEncryptedSessionWallet(privateKey: Hex) {
  const encrypted = await encryptLocalValue(privateKey);
  window.localStorage.setItem(SESSION_WALLET_ENCRYPTED_KEY, encrypted);
}

async function encryptLocalValue(value: string) {
  const key = await getLocalCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.stringify({
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  });
}

async function decryptLocalValue(payload: string) {
  const key = await getLocalCryptoKey();
  const parsed = JSON.parse(payload) as { iv: string; data: string };
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.data),
  );
  return new TextDecoder().decode(decrypted);
}

async function getLocalCryptoKey() {
  const stored = window.localStorage.getItem(SESSION_WALLET_CRYPTO_KEY);
  if (stored) {
    return crypto.subtle.importKey(
      "jwk",
      JSON.parse(stored) as JsonWebKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  window.localStorage.setItem(SESSION_WALLET_CRYPTO_KEY, JSON.stringify(jwk));
  return key;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function formatChatTransactionError(err: unknown) {
  const message = collectErrorText(err).toLowerCase();
  if (message.includes("insufficient wallet balance") || message.includes("ritualwallet deposit")) {
    const detail = extractRitualWalletBalanceDetail(message);
    return detail
      ? `The active chat sender needs more RitualWallet balance for this LLM request. ${detail}`
      : "The active chat sender needs more RitualWallet balance for this LLM request. Deposit more RITUAL, then try again.";
  }
  if (message.includes("insufficient funds for gas") || message.includes("exceeds the balance of the account")) {
    return "The active chat sender needs more native RITUAL for gas before chatting.";
  }
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

function extractRitualWalletBalanceDetail(message: string) {
  const match = message.match(/insufficient wallet balance:\s*(\d+)\s*<\s*required\s*(\d+)/i);
  if (!match) return null;
  const available = BigInt(match[1]);
  const required = BigInt(match[2]);
  return `Available ${formatBalance(available)}, required about ${formatBalance(required)}.`;
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
