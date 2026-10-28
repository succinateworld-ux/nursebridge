import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, type Address } from "viem";
import { track, visit } from "./analytics";
import {
  Activity, ArrowDownWideNarrow, ArrowRight, BadgeCheck, BookOpen, BookMarked, Bookmark, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Coins, CreditCard, ExternalLink, FileQuestion, Filter, GraduationCap,
  HeartHandshake, Info, LayoutDashboard, LoaderCircle, LockKeyhole, Menu, MessageCircle, RotateCcw, Search,
  ShieldCheck, Shuffle, Sparkles, Target, Timer, Wallet, X, Zap
} from "lucide-react";
import { contentDisclaimer, lessons, questions, subjects, type Difficulty, type Lesson, type Question, type SubjectId } from "./content";
import { addAttempt, calculateScore, completeLesson, completedLessonsFor, loadProgress, saveProgress, saveStudyPlan, selectPathway, toggleQuestionBookmark, type LearnerProgress, type StudyPlan } from "./progress";
import { sortLessons, sortQuestions, type LibrarySort } from "./library";
import { examPathways, getPathway, type PathwayId } from "./pathways";
import { PathwaysPage, StudyPlanPage } from "./StudyPlanning";
import { getStudyPlanSummary, weakestTopics } from "./studyPlan";
import { countForPracticeMode, examQuestionChoices, practicePoolCount, previousIncorrectOption, resolveExamQuestionCount, selectPracticeQuestions, type PracticeMode } from "./practiceModes";
import { clearStoredStudySessions, loadStoredExam, loadStoredPractice, storeExamSession, storePracticeSession, type ExamSession, type PracticeSession } from "./studySession";

interface WalletProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (value: unknown) => void): void;
  removeListener?(event: string, listener: (value: unknown) => void): void;
}
declare global { interface Window { ethereum?: WalletProvider } }
interface AppConfig {
  network: string; chainId: number; networkName: string; token: Address; decimals: number; explorer: string;
  premiumAvailable: boolean; premiumPrice: string; premiumPayTo: Address | null;
  sponsorAvailable: boolean; sponsorPrice: string; sponsorPayTo: Address | null;
  persistence: string; authentication: string;
}
interface PremiumPackQuestion extends Omit<Question, "id" | "subject" | "examTags" | "learningObjective" | "contentType" | "pathwayIds" | "jurisdiction" | "verificationStatus"> {
  id: string; subject: string; difficulty: Difficulty; source: Question["source"];
}
interface PremiumPack { title: string; questions: PremiumPackQuestion[] }
interface Entitlement { active: boolean; expiresAt: string | null; package: string | null }
interface SponsorSummary { contributionCount: number; confirmedMUsdAtomic: string; pendingRequests: number; grantsIssued: number; allocationStatus: string; contributions: { hash: string; amount: string; verifiedAt: string; payTo: string }[] }
type View = "home" | "pathways" | "learn" | "lesson" | "practice" | "exam" | "study-plan" | "progress" | "sponsored" | "sponsor" | "premium" | "help" | "settings" | "not-found";
type Notice = { kind: "success" | "info" | "error"; message: string };
type Checkout = { id: string; purpose: "premium" | "sponsor"; payer: Address; checkoutUrl: string; status: "pending" | "verified" | "expired" | "failed"; hash?: string; expiresAt?: string };

const navItems: { id: View; label: string; icon: React.ReactNode; group: "study" | "support" }[] = [
  { id: "home", label: "Overview", icon: <LayoutDashboard size={17} />, group: "study" },
  { id: "pathways", label: "Exam pathways", icon: <GraduationCap size={17} />, group: "study" },
  { id: "learn", label: "Study library", icon: <BookOpen size={17} />, group: "study" },
  { id: "practice", label: "Practice questions", icon: <FileQuestion size={17} />, group: "study" },
  { id: "exam", label: "Mock exam", icon: <Timer size={17} />, group: "study" },
  { id: "study-plan", label: "Study plan", icon: <Target size={17} />, group: "study" },
  { id: "progress", label: "My progress", icon: <Activity size={17} />, group: "study" },
  { id: "sponsored", label: "Get sponsored", icon: <HeartHandshake size={17} />, group: "support" },
  { id: "sponsor", label: "Sponsor students", icon: <Coins size={17} />, group: "support" },
  { id: "premium", label: "Premium access", icon: <LockKeyhole size={17} />, group: "support" }
];
const subjectMap = new Map(subjects.map(subject => [subject.id, subject]));
const pathwayTileLabels: Record<PathwayId, string> = { "nmcn-rn": "NMCN · RN", "nmcn-rm": "NMCN · RM", "nmcn-rphn": "NMCN · RPHN", "nclex-rn": "NCLEX-RN", "nclex-pn": "NCLEX-PN" };
const pathwayTileIcons: Record<PathwayId, React.ReactNode> = {
  "nmcn-rn": <BookOpen size={17} />,
  "nmcn-rm": <HeartHandshake size={17} />,
  "nmcn-rphn": <Activity size={17} />,
  "nclex-rn": <ShieldCheck size={17} />,
  "nclex-pn": <FileQuestion size={17} />
};
const topicOptions = [...new Set([...lessons, ...questions].map(item => item.topic))].sort((a, b) => a.localeCompare(b));
const examOptions = [...new Set([...lessons, ...questions].flatMap(item => item.examTags))].sort((a, b) => a.localeCompare(b));
const explorerLink = (config: AppConfig | null, hash: string) => `${config?.explorer ?? "https://explorer.test.mezo.org"}/tx/${hash}`;
const compact = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const titleFor: Record<View, string> = { home: "Study dashboard", pathways: "Exam pathways", learn: "Study library", lesson: "Lesson", practice: "Practice questions", exam: "Mock exam", "study-plan": "Study plan", progress: "My progress", sponsored: "Get sponsored", sponsor: "Sponsor students", premium: "Premium access", help: "Help & guidance", settings: "Settings", "not-found": "Page not found" };
const viewIds = new Set<View>(["home", "pathways", "learn", "lesson", "practice", "exam", "study-plan", "progress", "sponsored", "sponsor", "premium", "help", "settings"]);

function routeFromHash(): View {
  const route = window.location.hash.replace(/^#\/?/, "") as View;
  return viewIds.has(route) ? route : route ? "not-found" : "home";
}
function subjectName(id: string) { return subjectMap.get(id as SubjectId)?.name ?? id; }
function makePremiumQuestions(pack: PremiumPack): Question[] {
  return pack.questions.map(question => ({ ...question, subject: "public-health" as SubjectId, examTags: ["General premium practice"], pathwayIds: [], jurisdiction: "General nursing education", verificationStatus: "source-linked-general" as const, learningObjective: "Apply the source-linked topic to a practice scenario.", contentType: "Practice question" as const }));
}
async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export default function App() {
  const [view, setView] = useState<View>(() => routeFromHash());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configState, setConfigState] = useState<"loading" | "ready" | "offline">("loading");
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [progress, setProgress] = useState<LearnerProgress>(() => loadProgress());
  useEffect(() => {
    const recordVisit = () => { if (document.visibilityState === "visible") visit(progress.selectedPathwayId); };
    recordVisit();
    const timer = window.setInterval(recordVisit, 60_000);
    document.addEventListener("visibilitychange", recordVisit);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", recordVisit); };
  }, [progress.selectedPathwayId]);
  const [lessonId, setLessonId] = useState<string>(lessons[0].id);
  const [selectedSubject, setSelectedSubject] = useState<SubjectId | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  const [contentFilter, setContentFilter] = useState<"all" | "lesson" | "question">("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [examFilter, setExamFilter] = useState("all");
  const [librarySort, setLibrarySort] = useState<LibrarySort>("curated");
  const [practice, setPractice] = useState<PracticeSession | null>(() => loadStoredPractice(questions));
  const [exam, setExam] = useState<ExamSession | null>(() => loadStoredExam(questions));
  const [examQuestionCount, setExamQuestionCount] = useState(5);
  const [examDuration, setExamDuration] = useState(15);
  const [entitlement, setEntitlement] = useState<Entitlement>({ active: false, expiresAt: null, package: null });
  const [premiumPack, setPremiumPack] = useState<PremiumPack | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accessAuthBusy, setAccessAuthBusy] = useState(false);
  const [sponsorSummary, setSponsorSummary] = useState<SponsorSummary | null>(null);
  const [sponsorSummaryError, setSponsorSummaryError] = useState("");
  const [sponsorRequest, setSponsorRequest] = useState<{ requestId: string; status: string; createdAt?: string } | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [practiceWasSaved, setPracticeWasSaved] = useState(false);
  const checkoutCloseButton = useRef<HTMLButtonElement>(null);
  const checkoutModal = useRef<HTMLElement>(null);
  const checkoutReturnFocus = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const skipHashGuardRef = useRef(false);
  const examSaved = useRef("");

  const showNotice = useCallback((message: string, kind: Notice["kind"] = "info") => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(current => current?.message === message ? null : current), 6000);
  }, []);
  const go = useCallback((next: View): boolean => {
    if (exam?.status === "active" && next !== "exam" && !window.confirm("Leave this mock exam? Your answers stay in a local draft so you can resume. They are added to progress only after submission.")) return false;
    setMobileNavOpen(false);
    setNotice(null);
    if (next === "not-found") { setView(next); return true; }
    if (window.location.hash !== `#${next}`) { skipHashGuardRef.current = true; window.location.hash = next; }
    setView(next);
    return true;
  }, [exam?.status]);
  const closeCheckout = useCallback(() => {
    setCheckout(null);
    window.requestAnimationFrame(() => checkoutReturnFocus.current?.focus());
  }, []);
  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash();
      if (skipHashGuardRef.current) { skipHashGuardRef.current = false; setView(next); setMobileNavOpen(false); return; }
      if (exam?.status === "active" && next !== "exam" && !window.confirm("Leave this mock exam? Your answers stay in a local draft so you can resume. They are added to progress only after submission.")) {
        window.history.forward();
        return;
      }
      setView(next); setMobileNavOpen(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [exam?.status]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const focusable = () => [...(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMobileNavOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus()); };
  }, [mobileNavOpen]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [view]);
  useEffect(() => { storePracticeSession(practice, questions); }, [practice]);
  useEffect(() => { storeExamSession(exam); }, [exam]);
  useEffect(() => {
    readJson<AppConfig>("/api/config").then(value => { setConfig(value); setConfigState("ready"); }).catch(() => setConfigState("offline"));
  }, []);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const accountsChanged = (value: unknown) => { setAccount((value as string[])[0] as Address || null); setAccessToken(null); setPremiumPack(null); };
    const chainChanged = (value: unknown) => setChainId(Number.parseInt(String(value), 16));
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    return () => { provider.removeListener?.("accountsChanged", accountsChanged); provider.removeListener?.("chainChanged", chainChanged); };
  }, []);
  useEffect(() => {
    if (view !== "sponsored") return;
    const key = readRequesterKey();
    if (key) readJson<{ requestId: string; status: string; createdAt: string }>("/api/sponsorship/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requesterKey: key }) }).then(setSponsorRequest).catch(() => setSponsorRequest(null));
  }, [view]);
  useEffect(() => {
    if (view !== "sponsor") return;
    readJson<SponsorSummary>("/api/sponsorship/summary").then(value => { setSponsorSummary(value); setSponsorSummaryError(""); }).catch(error => { setSponsorSummary(null); setSponsorSummaryError(error instanceof Error ? error.message : "Sponsor data is currently unavailable."); });
  }, [view, checkout?.status]);
  useEffect(() => {
    if (!account) { setEntitlement({ active: false, expiresAt: null, package: null }); setPremiumPack(null); return; }
    if (!accessToken) { setEntitlement({ active: false, expiresAt: null, package: null }); setPremiumPack(null); return; }
    readJson<Entitlement>("/api/entitlements", { headers: { Authorization: `Bearer ${accessToken}` } }).then(setEntitlement).catch(() => {
      setEntitlement({ active: false, expiresAt: null, package: null }); setPremiumPack(null); setAccessToken(null);
    });
  }, [account, accessToken]);
  useEffect(() => {
    if (view !== "premium" || !account || !entitlement.active || !accessToken) { setPremiumPack(null); return; }
    readJson<{ content: PremiumPack }>("/api/premium/content", { headers: { Authorization: `Bearer ${accessToken}` } }).then(result => setPremiumPack(result.content)).catch(error => { setAccessToken(null); showNotice(error instanceof Error ? error.message : "Premium review content is unavailable.", "error"); });
  }, [view, account, entitlement.active, accessToken, showNotice]);
  useEffect(() => {
    if (!checkout || checkout.status !== "pending" || !account) return;
    let stopped = false;
    const poll = window.setInterval(async () => {
      try {
        const latest = await readJson<{ status: Checkout["status"]; txHash?: string; expiresAt: string; entitlementExpiresAt?: string | null }>(`/api/payment-intents/${encodeURIComponent(checkout.id)}?wallet=${encodeURIComponent(checkout.payer)}`);
        if (stopped) return;
        if (latest.status !== "pending") {
          const entitlementExpiresAt = checkout.purpose === "premium" ? latest.entitlementExpiresAt ?? undefined : undefined;
          setCheckout(current => current?.id === checkout.id ? { ...current, status: latest.status, hash: latest.txHash, expiresAt: entitlementExpiresAt ?? latest.expiresAt } : current);
          if (latest.status === "verified" && checkout.purpose === "premium" && account.toLowerCase() === checkout.payer.toLowerCase() && entitlementExpiresAt) {
            setEntitlement({ active: true, expiresAt: entitlementExpiresAt, package: "30-day premium study access" });
          }
          if (latest.status === "verified") showNotice(checkout.purpose === "premium" ? "Mezo Testnet confirmed your payment. Premium access is active for 30 days." : "Mezo Testnet confirmed the contribution to the student access fund.", "success");
          else if (latest.status === "expired" || latest.status === "failed") showNotice("This payment did not grant access. You can start a new checkout when ready.", "error");
        }
      } catch { /* A temporary API interruption is retried while the checkout stays open. */ }
    }, 2500);
    return () => { stopped = true; window.clearInterval(poll); };
  }, [checkout, account, showNotice]);
  useEffect(() => {
    if (!checkout) return;
    checkoutCloseButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closeCheckout(); return; }
      if (event.key !== "Tab") return;
      const items = [...(checkoutModal.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], iframe, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !checkoutModal.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !checkoutModal.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checkout?.id, closeCheckout]);

  const updateProgress = (next: LearnerProgress) => {
    setProgress(next);
    if (!saveProgress(next)) showNotice("Progress could not be saved in this browser. Check your storage settings.", "error");
  };
  const recordQuestion = (question: Question, selected: string, pathwayId: PathwayId | null) => updateProgress(addAttempt(progress, { questionId: question.id, selectedOptionId: selected, subject: question.subject, topic: question.topic, correct: selected === question.correctOptionId, answeredAt: new Date().toISOString(), ...(pathwayId ? { pathwayId } : {}) }));

  async function connectWallet(): Promise<Address | null> {
    if (!window.ethereum) { showNotice("No EVM wallet is available. You can keep studying for free without one.", "info"); return null; }
    setBusy(true);
    try {
      const addresses = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const id = Number.parseInt(String(await window.ethereum.request({ method: "eth_chainId" })), 16);
      const address = addresses[0] as Address | undefined;
      if (!address) throw new Error("No wallet account was selected.");
      if (account && account.toLowerCase() !== address.toLowerCase()) { setAccessToken(null); setPremiumPack(null); }
      setAccount(address); setChainId(id);
      return address;
    } catch (error) {
      const rejected = (error as { code?: number })?.code === 4001;
      showNotice(rejected ? "Wallet connection was rejected. No payment was started; free study is still available." : error instanceof Error ? error.message : "Wallet connection failed. No payment was started.", "error");
      return null;
    }
    finally { setBusy(false); }
  }
  async function switchToTestnet(): Promise<boolean> {
    if (!window.ethereum) { showNotice("Connect an EVM wallet to use MUSD checkout. Free learning does not need a wallet."); return false; }
    setBusy(true);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7b7b" }] });
      setChainId(31611); return true;
    } catch (error) {
      if ((error as { code?: number })?.code === 4902) {
        try {
          await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7b7b", chainName: "Mezo Testnet", nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 }, rpcUrls: ["https://rpc.test.mezo.org"], blockExplorerUrls: ["https://explorer.test.mezo.org"] }] });
          setChainId(31611); return true;
        } catch (addError) {
          const rejected = (addError as { code?: number })?.code === 4001;
          showNotice(rejected ? "Adding Mezo Testnet was rejected. Checkout was not started." : addError instanceof Error ? addError.message : "Mezo Testnet could not be added. Checkout was not started.", "error");
          return false;
        }
      }
      const rejected = (error as { code?: number })?.code === 4001;
      showNotice(rejected ? "The network change was rejected. Checkout was not started." : error instanceof Error ? error.message : "Mezo Testnet could not be selected. Checkout was not started.", "error");
      return false;
    } finally { setBusy(false); }
  }
  async function beginCheckout(purpose: "premium" | "sponsor") {
    if (configState !== "ready" || !config) { showNotice("The payment service is unavailable right now. Free learning is still available.", "error"); return; }
    const available = purpose === "premium" ? config.premiumAvailable : config.sponsorAvailable;
    if (!available) { showNotice(purpose === "premium" ? "Premium checkout is not configured yet. No payment can be taken." : "The student fund address is not configured yet. No contribution can be taken.", "info"); return; }
    if (document.activeElement instanceof HTMLElement) checkoutReturnFocus.current = document.activeElement;
    let wallet = account;
    if (!wallet) wallet = await connectWallet();
    if (!wallet) return;
    let activeChain = chainId;
    if (activeChain === null && window.ethereum) {
      try { activeChain = Number.parseInt(String(await window.ethereum.request({ method: "eth_chainId" })), 16); setChainId(activeChain); } catch { activeChain = null; }
    }
    if (activeChain !== 31611 && !(await switchToTestnet())) return;
    setBusy(true);
    try {
      const result = await readJson<{ id: string; checkoutUrl: string }>("/api/payment-intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, payer: wallet }) });
      setCheckout({ id: result.id, purpose, payer: wallet, checkoutUrl: result.checkoutUrl, status: "pending" });
    } catch (error) { showNotice(error instanceof Error ? error.message : "A checkout could not be created.", "error"); }
    finally { setBusy(false); }
  }
  async function authorizePremiumContent() {
    let wallet = account;
    if (!wallet) wallet = await connectWallet();
    if (!wallet || !window.ethereum) return;
    let activeChain = chainId;
    if (activeChain === null) {
      try { activeChain = Number.parseInt(String(await window.ethereum.request({ method: "eth_chainId" })), 16); setChainId(activeChain); }
      catch { activeChain = null; }
    }
    if (activeChain !== 31611 && !(await switchToTestnet())) return;
    setAccessAuthBusy(true);
    try {
      const challenge = await readJson<{ id: string; message: string }>("/api/access-challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet }) });
      const signature = await window.ethereum.request({ method: "personal_sign", params: [challenge.message, wallet] }) as string;
      const session = await readJson<{ accessToken: string; entitlement: Entitlement }>("/api/access-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge.id, wallet, signature }) });
      setAccessToken(session.accessToken);
      setEntitlement(session.entitlement);
      showNotice(session.entitlement.active ? "Wallet control verified. Your server-checked premium content is loading." : "Wallet control verified. No active premium payment is attached to this wallet.", session.entitlement.active ? "success" : "info");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Wallet verification was cancelled or failed.", "info"); }
    finally { setAccessAuthBusy(false); }
  }
  function startPractice(subject?: SubjectId, sourceQuestions?: Question[], requestedMode?: PracticeMode) {
    const mode = requestedMode ?? (sourceQuestions || subject ? "topic" : "quick");
    const set = sourceQuestions
      ? sourceQuestions.filter(question => !subject || question.subject === subject).filter(question => question.pathwayIds.length === 0 || Boolean(progress.selectedPathwayId && question.pathwayIds.includes(progress.selectedPathwayId)))
      : selectPracticeQuestions({ bank: questions, mode, pathwayId: progress.selectedPathwayId, attempts: progress.attempts, bookmarkedIds: progress.bookmarkedQuestionIds, subject });
    if (!set.length) {
      const message = mode === "weak-topics" ? "Practise a few questions first. Weak-topic review appears after at least two attempts and lower accuracy." : mode === "bookmarked" ? "Bookmark a question to build your saved review list." : mode === "review-mistakes" ? "There are no saved incorrect answers for this pathway yet." : "There are no questions available for this selection yet.";
      go("practice");
      showNotice(message, "info");
      return;
    }
    const previousOption = mode === "review-mistakes" ? previousIncorrectOption(progress.attempts, set[0].id, progress.selectedPathwayId) : null;
    const selectedOptionId = previousOption && set[0].options.some(option => option.id === previousOption) ? previousOption : "";
    setPractice({ ids: set.map(question => question.id), index: 0, selectedOptionId, submitted: Boolean(selectedOptionId), questionSet: set, pathwayId: progress.selectedPathwayId, mode });
    setPracticeWasSaved(false);
    track("practice_started", progress.selectedPathwayId);
    go("practice");
  }
  function openLesson(lesson: Lesson) { setLessonId(lesson.id); go("lesson"); }
  async function submitSponsorshipRequest() {
    let key = readRequesterKey();
    if (!key) {
      try { key = window.crypto.randomUUID(); window.localStorage.setItem("nursebridge:sponsorship-request-key:v1", key); }
      catch { showNotice("This browser cannot securely save a private request key. Enable local storage and try again.", "error"); return; }
    }
    setBusy(true);
    try {
      const result = await readJson<{ requestId: string; status: string; createdAt: string; duplicate: boolean; message?: string }>("/api/sponsorship/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requesterKey: key }) });
      setSponsorRequest(result);
      showNotice(result.duplicate ? "Your existing request is still pending review." : "Your request was recorded as pending. It is not an approval or funded grant.", result.duplicate ? "info" : "success");
    } catch (error) { showNotice(error instanceof Error ? error.message : "Your request could not be submitted.", "error"); }
    finally { setBusy(false); }
  }

  const score = useMemo(() => calculateScore(progress.attempts, progress.selectedPathwayId ?? undefined), [progress.attempts, progress.selectedPathwayId]);
  const selectedPathway = getPathway(progress.selectedPathwayId);
  const activeLesson = lessons.find(item => item.id === lessonId) ?? lessons[0];
  function choosePathway(pathwayId: PathwayId) {
    track("pathway_selected", pathwayId);
    if (!go("home")) return;
    updateProgress(selectPathway(progress, pathwayId));
    showNotice((getPathway(pathwayId)?.name ?? "This pathway") + " is now selected. Your other pathway progress is preserved.", "success");
  }
  function savePlan(plan: StudyPlan) {
    if (!progress.selectedPathwayId) return;
    updateProgress(saveStudyPlan(progress, progress.selectedPathwayId, plan));
    showNotice("Your study plan was saved on this device.", "success");
  }
  const matchingLessons = lessons.filter(item => (selectedSubject === "all" || item.subject === selectedSubject) && (difficultyFilter === "all" || item.difficulty === difficultyFilter) && (contentFilter === "all" || contentFilter === "lesson") && (topicFilter === "all" || item.topic === topicFilter) && (examFilter === "all" || item.examTags.includes(examFilter)) && `${item.title} ${item.topic} ${subjectName(item.subject)} ${item.examTags.join(" ")}`.toLowerCase().includes(searchText.toLowerCase()));
  const matchingQuestions = questions.filter(item => (selectedSubject === "all" || item.subject === selectedSubject) && (difficultyFilter === "all" || item.difficulty === difficultyFilter) && (contentFilter === "all" || contentFilter === "question") && (topicFilter === "all" || item.topic === topicFilter) && (examFilter === "all" || item.examTags.includes(examFilter)) && `${item.stem} ${item.topic} ${subjectName(item.subject)} ${item.examTags.join(" ")}`.toLowerCase().includes(searchText.toLowerCase()));
  const filteredLessons = sortLessons(matchingLessons, librarySort);
  const filteredQuestions = sortQuestions(matchingQuestions, librarySort);
  const currentPracticeQuestion = practice?.questionSet[practice.index];

  const examBank = useMemo(() => questions.filter(question => question.pathwayIds.length === 0 || Boolean(progress.selectedPathwayId && question.pathwayIds.includes(progress.selectedPathwayId))), [progress.selectedPathwayId]);
  function startExam() {
    const resolvedCount = resolveExamQuestionCount(examQuestionCount, examBank.length);
    const mixed = [...examBank].sort(() => Math.random() - 0.5).slice(0, resolvedCount);
    if (!mixed.length) { showNotice("No questions are available for a mock session yet.", "info"); return; }
    examSaved.current = "";
    const deadlineAt = Date.now() + examDuration * 60_000;
    track("exam_started", progress.selectedPathwayId);
    setExam({ id: window.crypto.randomUUID(), status: "active", ids: mixed.map(item => item.id), index: 0, answers: {}, secondsLeft: examDuration * 60, durationMinutes: examDuration, deadlineAt, pathwayId: progress.selectedPathwayId });
  }
  const finishExam = useCallback((session: ExamSession) => {
    if (examSaved.current === session.id) return;
    examSaved.current = session.id;
    track("exam_completed", session.pathwayId);
    const selected = new Map(questions.map(question => [question.id, question]));
    let next = progress;
    for (const id of session.ids) {
      const question = selected.get(id);
      if (question && session.answers[id]) track("question_answered", session.pathwayId);
      if (question && session.answers[id]) next = addAttempt(next, { questionId: question.id, selectedOptionId: session.answers[id], subject: question.subject, topic: question.topic, correct: session.answers[id] === question.correctOptionId, answeredAt: new Date().toISOString(), ...(session.pathwayId ? { pathwayId: session.pathwayId } : {}) });
    }
    updateProgress(next);
    setExam(current => current?.id === session.id ? { ...current, status: "review" } : current);
    if (session.secondsLeft === 0) showNotice("Time is up. Your mock exam has been submitted for review.", "info");
  }, [progress, showNotice]);
  useEffect(() => {
    if (!exam || exam.status !== "active") return;
    if (exam.secondsLeft <= 0) { finishExam(exam); return; }
    const timer = window.setTimeout(() => setExam(current => current?.id === exam.id && current.status === "active" ? { ...current, secondsLeft: Math.max(0, Math.ceil((current.deadlineAt - Date.now()) / 1000)) } : current), 1000);
    return () => window.clearTimeout(timer);
  }, [exam, finishExam]);

  function submitPracticeAnswer() {
    if (!practice || !currentPracticeQuestion || !practice.selectedOptionId || practice.submitted) return;
    recordQuestion(currentPracticeQuestion, practice.selectedOptionId, practice.pathwayId);
    track("question_answered", practice.pathwayId);
    setPractice({ ...practice, submitted: true });
  }
  function nextPracticeQuestion() {
    if (!practice) return;
    if (practice.index >= practice.questionSet.length - 1) { track("practice_completed", practice.pathwayId); setPractice(null); setPracticeWasSaved(true); showNotice("You have completed this practice set. Your answers were saved on this device.", "success"); return; }
    const nextQuestion = practice.questionSet[practice.index + 1];
    const previousOption = practice.mode === "review-mistakes" ? previousIncorrectOption(progress.attempts, nextQuestion.id, practice.pathwayId) : null;
    const selectedOptionId = previousOption && nextQuestion.options.some(option => option.id === previousOption) ? previousOption : "";
    setPractice({ ...practice, index: practice.index + 1, selectedOptionId, submitted: Boolean(selectedOptionId) });
  }
  function markLessonDone(lesson: Lesson) {
    if (!completedLessonsFor(progress, progress.selectedPathwayId).includes(lesson.id)) track("lesson_completed", progress.selectedPathwayId);
    updateProgress(completeLesson(progress, lesson.id, progress.selectedPathwayId));
    showNotice("Lesson marked complete on this device.", "success");
  }
  function toggleBookmark(questionId: string) {
    const next = toggleQuestionBookmark(progress, questionId);
    updateProgress(next);
    showNotice(next.bookmarkedQuestionIds.includes(questionId) ? "Question saved to your bookmarks on this device." : "Question removed from bookmarks.", "success");
  }

  const walletLabel = account ? compact(account) : "Connect wallet";
  const walletOnTestnet = chainId === 31611;

  return <div className="app-shell">
    <aside ref={sidebarRef} id="mobile-primary-nav" className={"sidebar" + (mobileNavOpen ? " sidebar-open" : "")} aria-label="NurseBridge navigation" aria-hidden={!mobileNavOpen} inert={!mobileNavOpen || checkout ? true : undefined}>
      <div className="drawer-brand-row">
        <a href="#home" className="brand" onClick={event => { event.preventDefault(); go("home"); }} aria-label="NurseBridge home">
          <span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 28"><path d="M3 21V15C3 8.37 8.82 3 16 3s13 5.37 13 12v6M2 21h28M8 20v-6m8 6V9m8 11v-6" /></svg></span>
          <span className="brand-name">Nurse<span>Bridge</span><small>by Nurse Succinate</small></span>
        </a>
        <button className="drawer-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="guest-card"><span className="guest-avatar"><GraduationCap size={18} /></span><span><strong>Guest learner</strong><small>Learning is open to everyone</small></span></div>
      <div className="nav-label">YOUR LEARNING</div>
      <nav className="side-nav" aria-label="Study navigation">
        {navItems.filter(item => item.group === "study").map(item => <NavLink key={item.id} item={item} active={view === item.id || item.id === "learn" && view === "lesson"} go={go} />)}
      </nav>
      <div className="nav-label nav-label-spaced">ACCESS & SUPPORT</div>
      <nav className="side-nav" aria-label="Access and support navigation">
        {navItems.filter(item => item.group === "support").map(item => <NavLink key={item.id} item={item} active={view === item.id} go={go} />)}
      </nav>
      <div className="sidebar-bottom">
        <div className="network-mini"><span className="network-live-dot" /><span><strong>Mezo Testnet</strong><small>Optional MUSD checkout</small></span><span className="testnet-pill">TESTNET</span></div>
        <button className="sidebar-help" onClick={() => go("help")}><CircleHelp size={16} />Help & learning guidance<ChevronRight size={14} /></button>
        <button className="sidebar-profile" onClick={() => go("settings")}><span className="profile-avatar">N</span><span><strong>Guest learner</strong><small>Local-only progress</small></span><ChevronRight size={15} /></button>
      </div>
    </aside>
    {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} inert={checkout ? true : undefined} />}

    <main className="main-content" aria-label={titleFor[view]} inert={checkout || mobileNavOpen ? true : undefined}>
      <header className="topbar">
        <div className="topbar-brandline">
          <button ref={mobileMenuButtonRef} className="mobile-menu-button" onClick={() => setMobileNavOpen(value => !value)} aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} aria-controls="mobile-primary-nav"><Menu size={19} /></button>
          <a href="#home" className="brand topbar-brand" onClick={event => { event.preventDefault(); go("home"); }} aria-label="NurseBridge home">
            <span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 28"><path d="M3 21V15C3 8.37 8.82 3 16 3s13 5.37 13 12v6M2 21h28M8 20v-6m8 6V9m8 11v-6" /></svg></span>
            <span className="brand-name">Nurse<span>Bridge</span><small>by Nurse Succinate</small></span>
          </a>
        </div>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.filter(item => item.group === "study" && item.id !== "exam" && item.id !== "study-plan").map(item => <NavLink key={item.id} item={item} active={view === item.id || item.id === "learn" && view === "lesson"} go={go} />)}
        </nav>
        <div className="topbar-actions">
          <span className="free-access-tag"><CheckCircle2 size={14} />Free study is open</span>
          <details className={"topbar-access topbar-tools" + (["exam", "study-plan"].includes(view) ? " topbar-access-current" : "")} onKeyDown={event => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}>
            <summary>Study tools <ChevronDown size={13} /></summary>
            <div className="topbar-access-menu" aria-label="Study tools">
              <button onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); go("exam"); }}><Timer size={15} /><span><strong>Mock practice</strong><small>Start or resume a timed general set</small></span><ChevronRight size={14} /></button>
              <button onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); go("study-plan"); }}><Target size={15} /><span><strong>Study plan</strong><small>Set a private weekly question goal</small></span><ChevronRight size={14} /></button>
            </div>
          </details>
          <details className={"topbar-access" + (["premium", "sponsored", "sponsor"].includes(view) ? " topbar-access-current" : "")} onKeyDown={event => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}>
            <summary>Access <ChevronDown size={13} /></summary>
            <div className="topbar-access-menu" aria-label="Access and sponsorship routes">
              <button onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); go("premium"); }}><LockKeyhole size={15} /><span><strong>Premium access</strong><small>Review the package and Testnet checkout status</small></span><ChevronRight size={14} /></button>
              <button onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); go("sponsored"); }}><HeartHandshake size={15} /><span><strong>Get sponsored</strong><small>Submit or check a private request</small></span><ChevronRight size={14} /></button>
              <button onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); go("sponsor"); }}><Coins size={15} /><span><strong>Sponsor students</strong><small>See verified Testnet fund activity</small></span><ChevronRight size={14} /></button>
            </div>
          </details>
          {account ? <button className={"wallet-button " + (walletOnTestnet ? "wallet-ready" : "wallet-wrong-network")} onClick={() => go("premium")} title={walletOnTestnet ? "Wallet connected on Mezo Testnet" : "Wallet is on another network"}><span className="wallet-dot" />{walletLabel}<ChevronDown size={13} /></button> : <button className="wallet-button wallet-optional" onClick={() => void connectWallet()} disabled={busy}><Wallet size={15} />Connect wallet</button>}
        </div>
      </header>

      <div className="page-wrap route-view" key={view}>
        {notice && <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live="polite"><span className="notice-icon">{notice.kind === "success" ? <CheckCircle2 size={18} /> : notice.kind === "error" ? <Info size={18} /> : <Info size={18} />}</span><span>{notice.message}</span><button onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={16} /></button></div>}

        {view === "home" && <HomePage progress={progress} score={score} selectedPathway={selectedPathway} activeExam={exam?.status === "active"} activePractice={Boolean(practice)} config={config} configState={configState} go={go} startPractice={startPractice} openLesson={openLesson} selectSubject={setSelectedSubject} onChoosePathway={choosePathway} />}
        {view === "pathways" && <PathwaysPage selectedId={progress.selectedPathwayId} onSelect={choosePathway} onBrowse={() => go("learn")} />}
        {view === "learn" && <LibraryPage selectedSubject={selectedSubject} setSelectedSubject={setSelectedSubject} librarySort={librarySort} setLibrarySort={setLibrarySort} searchText={searchText} setSearchText={setSearchText} difficultyFilter={difficultyFilter} setDifficultyFilter={setDifficultyFilter} contentFilter={contentFilter} setContentFilter={setContentFilter} topicFilter={topicFilter} setTopicFilter={setTopicFilter} examFilter={examFilter} setExamFilter={setExamFilter} topicOptions={topicOptions} examOptions={examOptions} filteredLessons={filteredLessons} filteredQuestions={filteredQuestions} completedIds={completedLessonsFor(progress, progress.selectedPathwayId)} openLesson={openLesson} startPractice={startPractice} />}
        {view === "lesson" && <LessonPage lesson={activeLesson} done={completedLessonsFor(progress, progress.selectedPathwayId).includes(activeLesson.id)} go={go} startPractice={startPractice} markDone={() => markLessonDone(activeLesson)} />}
        {view === "practice" && <PracticePage session={practice} question={currentPracticeQuestion} wasSaved={practiceWasSaved} progress={progress} pathway={selectedPathway} availableCount={practicePoolCount(questions, progress.selectedPathwayId)} go={go} startPractice={startPractice} setSession={setPractice} submit={submitPracticeAnswer} next={nextPracticeQuestion} onToggleBookmark={toggleBookmark} />}
        {view === "exam" && <ExamPage exam={exam} pathway={selectedPathway} availableCount={examBank.length} questionCount={examQuestionCount} setQuestionCount={setExamQuestionCount} duration={examDuration} setDuration={setExamDuration} start={startExam} setExam={setExam} finish={finishExam} />}
        {view === "study-plan" && <StudyPlanPage pathway={selectedPathway} plan={selectedPathway ? progress.studyPlans[selectedPathway.id] : undefined} progress={progress} onSave={savePlan} onChoosePathway={() => go("pathways")} />}
        {view === "progress" && <ProgressPage progress={progress} score={score} selectedPathwayId={progress.selectedPathwayId} go={go} openLesson={openLesson} startPractice={startPractice} />}
        {view === "sponsored" && <SponsoredPage request={sponsorRequest} busy={busy} submit={submitSponsorshipRequest} />}
        {view === "sponsor" && <SponsorPage summary={sponsorSummary} error={sponsorSummaryError} config={config} onSponsor={() => void beginCheckout("sponsor")} go={go} />}
        {view === "premium" && <PremiumPage config={config} configState={configState} connected={Boolean(account)} entitlement={entitlement} premiumPack={premiumPack} busy={busy} authBusy={accessAuthBusy} hasAccessSession={Boolean(accessToken)} onAuthorize={() => void authorizePremiumContent()} onPurchase={() => void beginCheckout("premium")} startPractice={startPractice} go={go} />}
        {view === "help" && <HelpPage go={go} />}
        {view === "settings" && <SettingsPage progress={progress} account={account} onClear={() => { if (window.confirm("Clear this device's NurseBridge learning progress, study plans, bookmarks, and unfinished sessions? This cannot be undone.")) { const empty: LearnerProgress = { version: 3, selectedPathwayId: null, completedLessonIds: [], completedLessonsByPathway: {}, attempts: [], studyPlans: {}, bookmarkedQuestionIds: [] }; updateProgress(empty); setPractice(null); setExam(null); clearStoredStudySessions(); showNotice("Local learning progress was cleared.", "success"); } }} />}
        {view === "not-found" && <NotFoundPage go={go} />}

        <footer className="page-footer"><span>© 2026 NurseBridge by Nurse Succinate</span><span>Original learning practice · Not official examination content</span><button onClick={() => go("help")}>Help & guidance</button><button onClick={() => go("settings")}>Privacy & settings</button></footer>
      </div>
    </main>

    {checkout && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeCheckout(); }}>
      <section ref={checkoutModal} className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" aria-describedby="checkout-description">
        <header className="checkout-header"><div className="checkout-brand"><span className="brand-symbol small" aria-hidden="true"><svg viewBox="0 0 32 28"><path d="M3 21V15C3 8.37 8.82 3 16 3s13 5.37 13 12v6M2 21h28M8 20v-6m8 6V9m8 11v-6" /></svg></span><span>{checkout.purpose === "premium" ? "Premium access" : "Student access fund"}<small>Secure Mezo Testnet checkout</small></span></div><button ref={checkoutCloseButton} className="modal-close" onClick={closeCheckout} aria-label="Close checkout"><X size={19} /></button></header>
        <div className="checkout-body"><div className="checkout-intro"><span className="checkout-icon"><CreditCard size={19} /></span><div><h2 id="checkout-title">Review before you pay</h2><p id="checkout-description">Free learning never requires a wallet. This optional payment uses testnet MUSD.</p></div></div>
          <div className="checkout-details"><div><span>Payment purpose</span><strong>{checkout.purpose === "premium" ? "Premium Review Pack" : "Student access fund contribution"}</strong></div><div><span>Amount</span><strong>{checkout.purpose === "premium" ? config?.premiumPrice : config?.sponsorPrice} MUSD · one-time</strong></div>{checkout.purpose === "premium" && <div><span>Access duration</span><strong>30 days after verified payment</strong></div>}<div><span>Network & asset</span><strong>Mezo Testnet · MUSD</strong></div><div><span>Paying wallet</span><strong className="mono-text">{account ? compact(account) : "Wallet disconnected"}</strong></div></div>
          <div className="checkout-status" role="status" aria-live="polite">{checkout.status === "pending" ? <><LoaderCircle className="spin" size={17} /><span><strong>Awaiting wallet approval or confirmation</strong><small>Review the amount and network in the payment panel. If you approve, NurseBridge verifies the receipt independently; premium access starts only after verification. Rejecting the wallet prompt does not grant access.</small></span></> : checkout.status === "verified" ? <><CheckCircle2 size={18} /><span><strong>Payment verified on Mezo Testnet</strong><small>{checkout.purpose === "premium" ? `Your 30-day access is active${checkout.expiresAt ? ` until ${new Date(checkout.expiresAt).toLocaleDateString()}` : ""}.` : "The contribution is included in confirmed fund records."}</small></span></> : <><Info size={17} /><span><strong>{checkout.status === "expired" ? "Payment intent expired" : "Checkout not completed"}</strong><small>No access was granted. If you rejected the wallet request, no payment was authorized. You can close this window and try again.</small></span></>}</div>
          {checkout.status === "verified" && checkout.hash && <a className="transaction-link" href={explorerLink(config, checkout.hash)} target="_blank" rel="noreferrer">View verified transaction <ExternalLink size={14} /></a>}
          <div className="pay-frame-wrap"><iframe title="Mezo Testnet x402 payment interface" src={checkout.checkoutUrl} /></div>
          <p className="checkout-safety"><ShieldCheck size={14} /> NurseBridge never sees wallet keys or seed phrases. Closing checkout cannot cancel a transaction already submitted. Testnet tokens have no guaranteed real-world value.</p>
          <button className="checkout-cancel" onClick={closeCheckout}>{checkout.status === "verified" ? "Done" : "Close checkout"}</button>
        </div>
      </section>
    </div>}
  </div>;
}

function readRequesterKey(): string | null { try { return window.localStorage.getItem("nursebridge:sponsorship-request-key:v1"); } catch { return null; } }

function NavLink({ item, active, go }: { item: typeof navItems[number]; active: boolean; go: (view: View) => void }) {
  return <a className={`nav-item ${active ? "active" : ""}`} href={`#${item.id}`} onClick={event => { event.preventDefault(); go(item.id); }} aria-current={active ? "page" : undefined}>{item.icon}<span>{item.label}</span>{active && <i className="nav-current-dot" />}</a>;
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-rule" />{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</section>;
}

function HomePage({ progress, score, selectedPathway, activeExam, activePractice, config, configState, go, startPractice, openLesson, selectSubject, onChoosePathway }: { progress: LearnerProgress; score: ReturnType<typeof calculateScore>; selectedPathway: ReturnType<typeof getPathway>; activeExam: boolean; activePractice: boolean; config: AppConfig | null; configState: string; go: (view: View) => void; startPractice: (subject?: SubjectId) => void; openLesson: (lesson: Lesson) => void; selectSubject: (subject: SubjectId) => void; onChoosePathway: (id: PathwayId) => void }) {
  const completedIds = completedLessonsFor(progress, selectedPathway?.id);
  const nextLesson = lessons.find(item => !completedIds.includes(item.id)) ?? lessons[0];
  const currentAttempts = selectedPathway ? progress.attempts.filter(item => item.pathwayId === selectedPathway.id) : progress.attempts;
  const lastAttempt = currentAttempts[currentAttempts.length - 1];
  const plan = selectedPathway ? progress.studyPlans[selectedPathway.id] : undefined;
  const planSummary = selectedPathway ? getStudyPlanSummary(progress.attempts, selectedPathway.id, plan) : null;
  const weeklyGoal = planSummary?.weeklyQuestionGoal ?? 0;
  const weakTopic = selectedPathway ? weakestTopics(progress.attempts, selectedPathway.id, 1)[0] : undefined;
  const recommendedLesson = weakTopic ? lessons.find(lesson => lesson.topic.toLowerCase() === weakTopic.topic.toLowerCase()) : undefined;
  const continueLesson = recommendedLesson && weakTopic && weakTopic.accuracy < 100 ? recommendedLesson : nextLesson;
  const activeSessionView: View | null = activeExam ? "exam" : activePractice ? "practice" : null;
  const continueLabel = activeExam ? "Resume mock practice" : activePractice ? "Resume practice" : completedIds.includes(continueLesson.id) ? "Review lesson" : "Continue studying";
  const continueAction = () => activeSessionView ? go(activeSessionView) : openLesson(continueLesson);
  return <>
    {selectedPathway ? <div className="home-pathway-context"><span className="pathway-context-mark"><GraduationCap size={16} /></span><span><small>CURRENT EXAM PATHWAY</small><strong>{selectedPathway.name}</strong></span><span className="pathway-context-jurisdiction">{selectedPathway.jurisdiction}</span><button className="text-link" onClick={() => go("pathways")}>Change pathway <ChevronRight size={14} /></button></div> : <div className="home-pathway-context home-pathway-unselected"><span className="pathway-context-mark"><GraduationCap size={16} /></span><span><small>START WITH YOUR GOAL</small><strong>Choose an examination pathway</strong></span><span className="pathway-context-jurisdiction">Five routes</span><button className="text-link" onClick={() => go("pathways")}>Choose pathway <ArrowRight size={14} /></button></div>}

    <section className="home-stage" aria-labelledby="home-title">
      <div className="home-editorial">
        <span className="hero-kicker"><span className="hero-kicker-dot" /> NURSEBRIDGE BY NURSE SUCCINATE</span>
        <h1 id="home-title">Study smarter.<br /><em>Practise confidently.</em></h1>
        <p className="home-lede">Know what to improve next. Begin with original nursing practice material, build a steady routine, and keep learning free without a wallet.</p>
        <div className="hero-actions">
          <button className="button button-primary" onClick={continueAction}>{continueLabel} <ArrowRight size={16} /></button>
          <button className="button button-secondary" onClick={() => startPractice()}>Practise questions <FileQuestion size={15} /></button>
        </div>
        <div className="home-quick-links"><button onClick={() => go("exam")}>Take a mock exam <Timer size={14} /></button><button onClick={() => go("study-plan")}>Open study plan <CalendarDays size={14} /></button></div>
        <div className="home-assurance"><ShieldCheck size={15} /><span>{selectedPathway ? "Your progress is saved separately for this pathway on this device." : "Free study is open. Choose a pathway to begin saving exam-specific progress."}</span></div>
        <div className="home-library-facts" aria-label="Available learning content">
          <span><strong>{lessons.length.toString().padStart(2, "0")}</strong> short lessons</span><i />
          <span><strong>{questions.length.toString().padStart(2, "0")}</strong> original questions</span><i />
          <span><strong>{subjects.length.toString().padStart(2, "0")}</strong> subject areas</span>
        </div>
      </div>

      <div className="home-insight">
        <KnowledgeMap score={score} completedIds={completedIds} selectSubject={selectSubject} go={go} />
        <button className="featured-lesson" onClick={continueAction}>
          <span className="featured-lesson-top"><span>{activeExam ? "ACTIVE MOCK PRACTICE" : activePractice ? "UNFINISHED PRACTICE SET" : lastAttempt ? "LAST PRACTISED · " + (lastAttempt.correct ? "CORRECT" : "REVISIT") : "YOUR NEXT LESSON"}</span><span>{activeExam ? "RESUME" : activePractice ? "RESUME" : continueLesson.estimatedMinutes + " MIN"}</span></span>
          <span className="featured-lesson-title">{activeExam ? "Continue your timed session" : activePractice ? "Return to your question set" : continueLesson.title}</span>
          <span className="featured-lesson-copy">{activeExam || activePractice ? "Your unfinished session is saved locally on this device and will remain in progress until you submit or clear it." : weakTopic && recommendedLesson ? "Your saved answers suggest a review of " + weakTopic.topic + "." : continueLesson.sections[0]?.paragraphs[0]}</span>
          <span className="featured-lesson-bottom"><span>{activeExam ? "Timer keeps running while you are away" : activePractice ? "Progress saved on this device" : subjectName(continueLesson.subject) + " · " + continueLesson.difficulty}</span><span>{continueLabel} <ArrowRight size={14} /></span></span>
        </button>
      </div>
    </section>

    <section className="home-exam-routes" aria-labelledby="home-pathways-title">
      <header className="home-exam-routes-heading">
        <div><span className="section-overline">FIVE EXAM PATHWAYS</span><h2 id="home-pathways-title">Choose the route you’re working toward.</h2><p>Each tile opens a pathway with its own saved progress and original practice set.</p></div>
        <button className="text-link" onClick={() => go("pathways")}>Explore pathway details <ArrowRight size={14} /></button>
      </header>
      <div className="home-exam-track" role="group" aria-label="Available exam pathways" tabIndex={0}>
        {examPathways.map((pathway, index) => {
          const selected = selectedPathway?.id === pathway.id;
          const practiceCount = questions.filter(question => question.pathwayIds.includes(pathway.id)).length;
          return <button key={pathway.id} aria-pressed={selected} aria-label={`${pathwayTileLabels[pathway.id]}, ${pathway.jurisdiction}, ${practiceCount} original pathway practice questions${selected ? ", currently selected" : ""}`} className={`home-exam-tile ${selected ? "home-exam-tile-selected" : ""}`} onClick={() => onChoosePathway(pathway.id)}>
            <span className={`home-exam-tile-mark home-exam-tile-mark-${index}`}>{pathwayTileIcons[pathway.id]}</span><span className="home-exam-tile-index">0{index + 1}</span>
            <strong>{pathwayTileLabels[pathway.id]}</strong><small>{pathway.name}</small>
            <span className="home-exam-tile-bottom"><span>{practiceCount} pathway practice items</span><ArrowRight size={14} /></span>
            {selected && <span className="home-exam-selected"><Check size={11} />SELECTED</span>}
          </button>;
        })}
      </div>
      <p className="home-exam-note"><Info size={13} />Original practice items are not official exam questions or verified blueprint mappings.</p>
    </section>

    <section className="home-plan-strip" aria-label="Study plan preview">
      <div className="home-plan-intro"><span className="plan-progress-icon"><Target size={17} /></span><div><span className="section-overline">YOUR WEEKLY OBJECTIVE</span><h2>{selectedPathway ? plan ? planSummary?.answersToday + " of " + planSummary?.dailyQuestionTarget + " questions today" : "Set a question goal that fits your week" : "Choose a pathway to build a study plan"}</h2></div></div>
      {selectedPathway && plan && planSummary ? <div className="home-week-meter"><div><strong>{planSummary.answersThisWeek}</strong><span>of {weeklyGoal} this week</span></div><div className="plan-meter" role="img" aria-label={`${Math.min(100, Math.round(planSummary.answersThisWeek * 100 / weeklyGoal))}% of weekly question goal completed`}><span style={{ width: `${Math.min(100, Math.round(planSummary.answersThisWeek * 100 / weeklyGoal))}%` }} /></div></div> : <p className="home-plan-note">Only answers you submit count. NurseBridge does not invent study time or streaks.</p>}
      <button className="text-link" onClick={() => go(selectedPathway ? "study-plan" : "pathways")}>{selectedPathway ? "Adjust plan" : "Choose pathway"} <ArrowRight size={14} /></button>
    </section>

    <section className="home-subject-rail" aria-labelledby="subjects-title">
      <div className="home-section-head"><div><span className="section-overline">THE STUDY LIBRARY</span><h2 id="subjects-title">Build from the fundamentals.</h2></div><button className="text-link" onClick={() => go("learn")}>Browse all learning <ArrowRight size={14} /></button></div>
      <div className="subject-rail">{subjects.map((subject, index) => {
        const subjectLessons = lessons.filter(item => item.subject === subject.id);
        const subjectQuestions = questions.filter(item => item.subject === subject.id);
        return <button className="subject-rail-item" key={subject.id} onClick={() => { selectSubject(subject.id); go("learn"); }}>
          <span className="subject-rail-index">0{index + 1}</span><span className="subject-rail-body"><strong>{subject.name}</strong><small>{subject.description}</small><span>{subjectLessons.length} lessons <i /> {subjectQuestions.length} original questions</span></span><ArrowRight size={16} />
        </button>;
      })}</div>
    </section>

    <section className="access-paths" aria-labelledby="access-title">
      <div className="access-paths-heading"><span className="section-overline">ACCESS, ON YOUR TERMS</span><h2 id="access-title">Choose how you’d like to continue.</h2><p>Learning stays available whether or not you use a wallet.</p></div>
      <div className="access-path-list">
        <article className="access-path"><span className="access-path-number">01</span><div><h3>Study free</h3><p>Lessons, question practice, mock exams, and progress saved on this device.</p></div><button className="text-link" onClick={() => go("learn")}>Start learning <ArrowRight size={14} /></button></article>
        <article className="access-path"><span className="access-path-number">02</span><div><h3>Get sponsored</h3><p>Send a private request. It stays pending until a real reviewer takes action.</p></div><button className="text-link" onClick={() => go("sponsored")}>How support works <ArrowRight size={14} /></button></article>
        <article className="access-path"><span className="access-path-number">03</span><div><h3>Self-sponsor premium</h3><p>{configState !== "ready" ? "Checking whether Testnet checkout is available." : config?.premiumAvailable ? "30-day access · " + config.premiumPrice + " MUSD · Mezo Testnet." : "Checkout is unavailable until its Testnet configuration is complete."}</p></div><button className="text-link" onClick={() => go("premium")}>Review the package <ArrowRight size={14} /></button></article>
      </div>
      <div className="sponsor-route-link"><span>For schools, nurses, and community sponsors</span><button className="text-link" onClick={() => go("sponsor")}>View the study-access fund <ArrowRight size={14} /></button></div>
    </section>
    <p className="clinical-disclaimer"><Info size={14} />{contentDisclaimer}<span>Original practice material · not official examination content.</span></p>
  </>;
}

function KnowledgeMap({ score, completedIds, selectSubject, go }: { score: ReturnType<typeof calculateScore>; completedIds: string[]; selectSubject: (subject: SubjectId) => void; go: (view: View) => void }) {
  const completed = completedIds.length;
  return <section className="knowledge-map" aria-labelledby="knowledge-map-title">
    <header className="knowledge-map-header">
      <div><span className="section-overline">YOUR STUDY SPACE</span><h2 id="knowledge-map-title">Learning pathways</h2></div>
      <span className="local-data-tag"><span className="local-data-dot" />SAVED ON THIS DEVICE</span>
    </header>
    <div className="knowledge-map-canvas">
      <svg className="knowledge-map-lines" viewBox="0 0 520 250" preserveAspectRatio="none" aria-hidden="true">
        <path d="M112 66 C178 66 179 126 250 126 S333 64 407 64" />
        <path d="M112 186 C180 186 185 126 250 126 S335 186 407 186" />
        <path d="M112 66 C145 104 145 147 112 186" />
        <path d="M407 64 C375 103 375 147 407 186" />
        <circle cx="250" cy="126" r="4" />
      </svg>
      <div className="knowledge-map-nodes">
        {subjects.map((subject, index) => {
          const total = lessons.filter(item => item.subject === subject.id).length;
          const done = lessons.filter(item => item.subject === subject.id && completedIds.includes(item.id)).length;
          const ratio = total ? done / total : 0;
          const circumference = 75.4;
          return <button className="map-node" key={subject.id} onClick={() => { selectSubject(subject.id); go("learn"); }} aria-label={subject.name + ": " + done + " of " + total + " lessons complete. Browse this subject."}>
            <span className="map-node-copy"><small>0{index + 1} / PATHWAY</small><strong>{subject.name}</strong><span>{done} of {total} lessons</span></span>
            <svg className="map-node-progress" viewBox="0 0 30 30" role="img" aria-label={Math.round(ratio * 100) + " percent complete"}>
              <circle className="map-progress-track" cx="15" cy="15" r="12" />
              <circle className="map-progress-value" cx="15" cy="15" r="12" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} />
              <text x="15" y="18" textAnchor="middle">{done}</text>
            </svg>
          </button>;
        })}
      </div>
    </div>
    <footer className="knowledge-map-footer"><span>LESSONS MARKED COMPLETE</span><strong>{completed} <small>/ {lessons.length}</small></strong><span className="knowledge-answer-count">{score.answered ? score.answered + " answers in this view" : "Practice starts when you do"}</span><button onClick={() => go("progress")}>View progress <ArrowRight size={14} /></button></footer>
  </section>;
}
function LibraryPage(props: {
  selectedSubject: SubjectId | "all"; setSelectedSubject: (value: SubjectId | "all") => void; searchText: string; setSearchText: (value: string) => void;
  librarySort: LibrarySort; setLibrarySort: (value: LibrarySort) => void;
  difficultyFilter: Difficulty | "all"; setDifficultyFilter: (value: Difficulty | "all") => void; contentFilter: "all" | "lesson" | "question"; setContentFilter: (value: "all" | "lesson" | "question") => void;
  topicFilter: string; setTopicFilter: (value: string) => void; examFilter: string; setExamFilter: (value: string) => void; topicOptions: string[]; examOptions: string[];
  filteredLessons: Lesson[]; filteredQuestions: Question[]; completedIds: string[]; openLesson: (lesson: Lesson) => void; startPractice: (subject?: SubjectId, sourceQuestions?: Question[]) => void;
}) {
  const total = props.filteredLessons.length + props.filteredQuestions.length;
  return <><PageHeader eyebrow="STUDY LIBRARY" title="Find your next learning step." subtitle="Browse original, source-linked lessons and practice questions. Everything here is available without a wallet." action={<span className="free-content-badge"><CheckCircle2 size={14} />Free content</span>} />
    <section className="library-controls"><label className="search-box"><Search size={17} /><span className="sr-only">Search learning content</span><input type="search" aria-label="Search learning content" value={props.searchText} onChange={event => props.setSearchText(event.target.value)} onKeyDown={event => { if (event.key === "Escape") props.setSearchText(""); }} placeholder="Search topics, subjects, or study tags" />{props.searchText && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => props.setSearchText("")}><X size={14} /></button>}</label><label className="filter-control"><Filter size={15} /><span className="sr-only">Filter by subject</span><select value={props.selectedSubject} onChange={event => props.setSelectedSubject(event.target.value as SubjectId | "all")}><option value="all">All subjects</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="filter-control"><span className="sr-only">Filter by topic</span><select value={props.topicFilter} onChange={event => props.setTopicFilter(event.target.value)}><option value="all">All topics</option>{props.topicOptions.map(topic => <option key={topic}>{topic}</option>)}</select></label><label className="filter-control"><span className="sr-only">Filter by study tag</span><select value={props.examFilter} onChange={event => props.setExamFilter(event.target.value)}><option value="all">All content tags</option>{props.examOptions.map(exam => <option key={exam}>{exam}</option>)}</select></label><label className="filter-control"><span className="sr-only">Filter by difficulty</span><select value={props.difficultyFilter} onChange={event => props.setDifficultyFilter(event.target.value as Difficulty | "all")}><option value="all">All levels</option><option>Foundational</option><option>Applied</option><option>Advanced</option></select></label><label className="filter-control"><span className="sr-only">Filter by content type</span><select value={props.contentFilter} onChange={event => props.setContentFilter(event.target.value as "all" | "lesson" | "question")}><option value="all">All content</option><option value="lesson">Lessons</option><option value="question">Questions</option></select></label><label className="filter-control sort-control"><ArrowDownWideNarrow size={14} /><span className="sr-only">Sort learning content</span><select aria-label="Sort learning content" value={props.librarySort} onChange={event => props.setLibrarySort(event.target.value as LibrarySort)}><option value="curated">Curated order</option><option value="alphabetical">A to Z</option><option value="difficulty">Difficulty</option></select></label></section>
    <div className="library-result-count">{total} {total === 1 ? "learning item" : "learning items"} <span>·</span> Original practice content</div>
    {!total ? <EmptyState title="No learning items match those filters" body="Try a different search or clear one of the filters." action={<button className="button button-secondary" onClick={() => { props.setSearchText(""); props.setSelectedSubject("all"); props.setDifficultyFilter("all"); props.setContentFilter("all"); props.setTopicFilter("all"); props.setExamFilter("all"); }}>Clear filters</button>} /> : <>
      {(props.filteredLessons.length > 0) && props.contentFilter !== "question" && <><div className="subsection-title"><h2>Lessons</h2><span>{props.filteredLessons.length}</span></div><section className="library-grid">{props.filteredLessons.map(lesson => <button key={lesson.id} className="library-card" onClick={() => props.openLesson(lesson)}><div className="library-card-top"><span className={`subject-chip ${subjectMap.get(lesson.subject)?.color}`}>{subjectName(lesson.subject)}</span><span className="duration"><Clock3 size={12} />{lesson.estimatedMinutes} min</span></div><h3>{lesson.title}</h3><p>{lesson.learningObjectives[0]}</p><div className="library-card-bottom"><span>{lesson.difficulty}</span><span>{props.completedIds.includes(lesson.id) ? <><CheckCircle2 size={14} />Completed</> : <>Open lesson <ArrowRight size={14} /></>}</span></div></button>)}</section></>}
      {(props.filteredQuestions.length > 0) && props.contentFilter !== "lesson" && <><div className="subsection-title question-list-heading"><h2>Practice questions</h2><button className="text-link" onClick={() => props.startPractice(props.selectedSubject === "all" ? undefined : props.selectedSubject, props.filteredQuestions)}>Start this question set <ArrowRight size={14} /></button></div><section className="question-preview-grid">{props.filteredQuestions.map((question, index) => <article className="question-preview" key={question.id}><div className="question-preview-number">Q{String(index + 1).padStart(2, "0")}</div><div><span className="subject-name">{question.topic} · {question.difficulty}</span><p>{question.stem}</p><span className="question-tag-line">{question.examTags.join(" · ")}</span></div></article>)}</section></>}
    </>}
    <div className="source-note"><ShieldCheck size={15} /><span>Sources are linked on each lesson and question. Source check dates are included; clinical educator review is still needed before this material is used in a formal course.</span></div>
  </>;
}

function LessonPage({ lesson, done, go, startPractice, markDone }: { lesson: Lesson; done: boolean; go: (view: View) => void; startPractice: (subject?: SubjectId) => void; markDone: () => void }) {
  const subject = subjectMap.get(lesson.subject);
  return <><div className="back-row"><button className="text-link" onClick={() => go("learn")}><ChevronLeft size={15} />Back to study library</button><span className={`subject-chip ${subject?.color}`}>{subject?.name}</span></div><article className="lesson-article"><header className="lesson-hero"><div><span className="eyebrow"><span className="eyebrow-rule" />{subject?.name.toUpperCase()} · {lesson.difficulty.toUpperCase()}</span><h1>{lesson.title}</h1><p>{lesson.learningObjectives[0]}</p><div className="lesson-meta"><span><Clock3 size={14} />{lesson.estimatedMinutes} min read</span><span><BookMarked size={14} />{lesson.examTags.join(" · ")}</span></div></div><span className={`lesson-emblem ${subject?.color}`}><BookOpen size={27} /></span></header>
      <div className="lesson-body"><aside className="lesson-aside"><div className="lesson-aside-card"><span className="section-overline">LEARNING OBJECTIVES</span><ul>{lesson.learningObjectives.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul></div><div className="lesson-aside-card takeaway-card"><span className="section-overline">KEY TAKEAWAYS</span><ul>{lesson.takeaways.map(item => <li key={item}><span className="takeaway-bullet" />{item}</li>)}</ul></div></aside><div className="lesson-main">{lesson.sections.map(section => <section className="lesson-section" key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}<div className="reference-card"><span className="reference-icon"><ShieldCheck size={16} /></span><div><span className="section-overline">LEARNING REFERENCE</span><a href={lesson.source.url} target="_blank" rel="noreferrer">{lesson.source.title} <ExternalLink size={13} /></a><small>{lesson.source.publisher} · Source checked {new Date(`${lesson.source.sourceCheckedAt}T12:00:00Z`).toLocaleDateString()}</small></div></div><p className="lesson-disclaimer">This lesson is for education and revision. It does not replace clinical supervision, local protocols, or current course materials.</p><div className="lesson-actions"><button className={`button ${done ? "button-success" : "button-primary"}`} onClick={markDone}>{done ? <><CheckCircle2 size={16} />Completed on this device</> : <>Mark lesson complete <Check size={16} /></>}</button><button className="button button-secondary" onClick={() => startPractice(lesson.subject)}>Practice this subject <ArrowRight size={15} /></button></div></div></div>
    </article></>;
}

function PracticePage({ session, question, wasSaved, progress, pathway, availableCount, go, startPractice, setSession, submit, next, onToggleBookmark }: { session: PracticeSession | null; question: Question | undefined; wasSaved: boolean; progress: LearnerProgress; pathway: ReturnType<typeof getPathway>; availableCount: number; go: (view: View) => void; startPractice: (subject?: SubjectId, sourceQuestions?: Question[], mode?: PracticeMode) => void; setSession: React.Dispatch<React.SetStateAction<PracticeSession | null>>; submit: () => void; next: () => void; onToggleBookmark: (questionId: string) => void }) {
  if (!session || !question) {
    const modes: { id: PracticeMode; title: string; detail: string; icon: React.ReactNode }[] = [
      { id: "quick", title: "Quick practice", detail: "Five questions · immediate feedback", icon: <Zap size={17} /> },
      { id: "pathway", title: "Exam pathway", detail: pathway ? `${pathway.name} practice items` : "Choose a pathway to unlock its set", icon: <GraduationCap size={17} /> },
      { id: "daily", title: "Daily challenge", detail: "The same set for today on this device", icon: <CalendarDays size={17} /> },
      { id: "random", title: "Random practice", detail: "A varied set of up to ten", icon: <Shuffle size={17} /> },
      { id: "weak-topics", title: "Weak topics", detail: "Uses topics with at least two saved attempts below 60%", icon: <Target size={17} /> },
      { id: "bookmarked", title: "Bookmarked", detail: "Questions you saved on this device", icon: <Bookmark size={17} /> },
      { id: "review-mistakes", title: "Review mistakes", detail: "Previously incorrect questions in this pathway", icon: <RotateCcw size={17} /> }
    ];
    const modeCount = (mode: PracticeMode, subject?: SubjectId) => countForPracticeMode({ bank: questions, mode, pathwayId: progress.selectedPathwayId, attempts: progress.attempts, bookmarkedIds: progress.bookmarkedQuestionIds, subject });
    return <><PageHeader eyebrow="PRACTICE STUDIO" title="Build understanding one question at a time." subtitle={`Choose how to practise${pathway ? ` for ${pathway.name}` : ""}. ${pathway ? pathway.name : "Shared free study"} has ${availableCount} available question${availableCount === 1 ? "" : "s"}, including shared foundations.`} /><section className="practice-launch-section"><div className="practice-launch-head"><div><span className="section-overline">CHOOSE A PRACTICE MODE</span><h2>Start with the time and focus you have.</h2></div><span className="local-progress-badge"><ShieldCheck size={14} />Free · no wallet</span></div><div className="practice-mode-grid">{modes.map(mode => { const count = modeCount(mode.id); const displayCount = mode.id === "pathway" && !progress.selectedPathwayId ? 0 : count; const unavailable = displayCount === 0; return <button key={mode.id} className="practice-mode-tile" onClick={() => startPractice(undefined, undefined, mode.id)} disabled={unavailable} aria-describedby={`mode-${mode.id}-count`}><span className="practice-mode-icon">{mode.icon}</span><span className="practice-mode-copy"><strong>{mode.title}</strong><small>{mode.detail}</small></span><span className="practice-mode-count" id={`mode-${mode.id}-count`}>{displayCount}<small>{displayCount === 1 ? "question" : "questions"}</small></span><ChevronRight size={15} /></button>; })}</div></section><section className="practice-subject-list practice-subject-browser"><div><span className="section-overline">PRACTISE BY SUBJECT</span><p>Question counts reflect your selected pathway and current bank.</p></div>{subjects.map(subject => { const count = modeCount("topic", subject.id); return <button key={subject.id} className="practice-subject-option" onClick={() => startPractice(subject.id, undefined, "topic")} disabled={!count}><span className={`subject-mini-icon ${subject.color}`}>{subject.id === "mental-health" ? <MessageCircle size={16} /> : subject.id === "public-health" || subject.id === "community-health" ? <Activity size={16} /> : subject.id === "nursing-fundamentals" ? <ShieldCheck size={16} /> : <GraduationCap size={16} />}</span><span><strong>{subject.name}</strong><small>{count} {count === 1 ? "question" : "questions"}</small></span><ChevronRight size={16} /></button>; })}</section>{wasSaved && <div className="inline-success practice-saved-note"><CheckCircle2 size={15} />Your last practice set was saved on this device. Continue from the overview.</div>}<p className="practice-note"><Info size={14} />Questions are original educational practice. None are official examination items or clinically reviewed. Your activity is stored in this browser only.</p></>;
  }
  const correct = session.selectedOptionId === question.correctOptionId;
  const bookmarked = progress.bookmarkedQuestionIds.includes(question.id);
  const modeLabels: Record<PracticeMode, string> = { quick: "Quick practice", topic: "Topic practice", pathway: "Pathway practice", daily: "Daily challenge", random: "Random practice", "weak-topics": "Weak topics", bookmarked: "Bookmarked review", "review-mistakes": "Review mistakes" };
  return <><div className="back-row"><span className="eyebrow"><span className="eyebrow-rule" />{modeLabels[session.mode].toUpperCase()} · {session.pathwayId ? getPathway(session.pathwayId)?.name : "FREE STUDY"}</span><button className="text-link" onClick={() => { if (window.confirm("Leave this practice set? Your current answer and question position stay saved on this device so you can resume from the overview.")) go("home"); }}>Leave & resume later <X size={14} /></button></div><section className="practice-layout"><div className="practice-progress-bar" role="img" aria-label={`Question ${session.index + 1} of ${session.questionSet.length}`}><span style={{ width: `${((session.index + 1) / session.questionSet.length) * 100}%` }} /></div><div className="practice-meta"><span>Question {session.index + 1} of {session.questionSet.length}</span><span>{subjectName(question.subject)} · {question.difficulty}</span></div><article className="question-card"><div className="question-card-top"><span className="question-type"><FileQuestion size={14} />{question.topic}</span><button className={`question-bookmark ${bookmarked ? "is-bookmarked" : ""}`} aria-pressed={bookmarked} onClick={() => onToggleBookmark(question.id)}><Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />{bookmarked ? "Saved" : "Save question"}</button></div><h1>{question.stem}</h1><fieldset className="answer-options" disabled={session.submitted}><legend className="sr-only">Select your answer</legend>{question.options.map((option, index) => <label key={option.id} className={`answer-option ${session.selectedOptionId === option.id ? "selected" : ""} ${session.submitted && option.id === question.correctOptionId ? "answer-correct" : ""} ${session.submitted && session.selectedOptionId === option.id && !correct ? "answer-incorrect" : ""}`}><input type="radio" name={`answer-${question.id}`} value={option.id} checked={session.selectedOptionId === option.id} onChange={() => setSession({ ...session, selectedOptionId: option.id })} /><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option.text}</span>{session.submitted && option.id === question.correctOptionId && <CheckCircle2 className="answer-mark" size={17} />}</label>)}</fieldset>
        {session.submitted && <div className={`answer-explanation ${correct ? "explanation-correct" : "explanation-incorrect"}`} role="status" aria-live="polite"><div className="explanation-heading">{correct ? <><CheckCircle2 size={17} />Correct — keep going</> : <><Info size={17} />Review this concept</>}</div><p>{question.explanation}</p><div className="learning-point"><strong>Learning point</strong><span>{question.learningPoint}</span></div><ul>{question.options.filter(option => option.id !== question.correctOptionId).map(option => <li key={option.id}><strong>{String.fromCharCode(65 + question.options.findIndex(item => item.id === option.id))}.</strong> {question.distractorExplanations[option.id]}</li>)}</ul><a href={question.source.url} target="_blank" rel="noreferrer">Read source: {question.source.title} <ExternalLink size={12} /></a></div>}
        <div className="question-source-meta"><span>{question.contentStatus === "source-checked" ? "Reference source checked" : question.contentStatus.replaceAll("-", " ")}</span><span>Reference checked {question.lastReviewedAt ?? "date not recorded"}</span><span>Not an official exam item · not clinically reviewed</span></div>
        <div className="question-controls">{session.submitted ? <>{session.mode === "review-mistakes" && <button className="button button-secondary" onClick={() => setSession({ ...session, selectedOptionId: "", submitted: false })}>Try this question again <RotateCcw size={14} /></button>}<button className="button button-primary" onClick={next}>{session.index === session.questionSet.length - 1 ? "Finish review" : "Next question"}<ArrowRight size={15} /></button></> : <button className="button button-primary" onClick={submit} disabled={!session.selectedOptionId}>Check answer <Check size={15} /></button>}<button className="button button-quiet" onClick={() => go("learn")}>Browse lessons <BookOpen size={15} /></button></div>
      </article></section><p className="practice-note"><Info size={14} />Use current clinical guidance and supervision for real care. This practice item is not a clinical decision tool.</p></>;
}

function ExamPage({ exam, pathway, availableCount, questionCount, setQuestionCount, duration, setDuration, start, setExam, finish }: { exam: ExamSession | null; pathway: ReturnType<typeof getPathway>; availableCount: number; questionCount: number; setQuestionCount: (value: number) => void; duration: number; setDuration: (value: number) => void; start: () => void; setExam: React.Dispatch<React.SetStateAction<ExamSession | null>>; finish: (exam: ExamSession) => void }) {
  const countOptions = examQuestionChoices(availableCount);
  const displayedQuestionCount = resolveExamQuestionCount(questionCount, availableCount);
  if (!exam) return <><PageHeader eyebrow="MOCK EXAM PRACTICE" title="A focused session, built from your available bank." subtitle={pathway ? `Study context: ${pathway.name}. The session combines shared foundations with this pathway's original practice items; it is not mapped to the official blueprint.` : "Set a short timer, answer original shared practice questions, then review every rationale. This is not an official examination."} /><section className="exam-setup-layout"><article className="exam-setup-card"><span className="exam-setup-icon"><Timer size={22} /></span><span className="section-overline">PATHWAY PRACTICE · NOT BLUEPRINT MAPPED</span><h2>Make time for a focused review</h2><p>The selected bank has {availableCount} available original questions. Choose a set size and timer. Unanswered questions do not count as submitted progress.</p>{availableCount ? <><label className="form-field"><span>Question count</span><select value={displayedQuestionCount} onChange={event => setQuestionCount(Number(event.target.value))}>{countOptions.map(count => <option key={count} value={count}>{count} questions</option>)}</select></label><label className="form-field"><span>Time limit</span><select value={duration} onChange={event => setDuration(Number(event.target.value))}><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={20}>20 minutes</option></select></label><button className="button button-primary button-wide" onClick={start}>Start mock practice <ArrowRight size={15} /></button></> : <EmptyState title="No questions available" body="Choose an examination pathway or return to free study while this bank is expanded." action={null} />}<small className="muted-small">Original practice items · no official exam questions · no clinical review claim.</small></article><aside className="exam-guidance"><div className="guidance-icon"><ShieldCheck size={20} /></div><h3>Before you begin</h3><ul><li><Check size={14} />Move between questions with the question map.</li><li><Check size={14} />Explanations appear after submission.</li><li><Check size={14} />Your answers are recorded on this device and pathway.</li><li><Check size={14} />A score is practice feedback, not an exam prediction.</li></ul></aside></section></>;
  const examQuestions = exam.ids.map(id => questions.find(item => item.id === id)).filter((item): item is Question => Boolean(item));
  const current = examQuestions[exam.index];
  const points = examQuestions.filter(item => exam.answers[item.id] === item.correctOptionId).length;
  if (exam.status === "review") return <><PageHeader eyebrow="GENERAL PRACTICE REVIEW" title="Review your practice session." subtitle={`Study context: ${getPathway(exam.pathwayId)?.name ?? "General nursing study"}. This set is not mapped to an official exam blueprint.`} /><section className="exam-result-banner"><div className="result-score"><span>{examQuestions.length ? Math.round(points * 100 / examQuestions.length) : 0}<small>%</small></span><small>{points} of {examQuestions.length} correct</small></div><div><span className="section-overline">SESSION COMPLETE</span><h2>A useful step in your revision.</h2><p>Your results were added to progress on this device under this study context. Review each rationale below.</p></div><button className="button button-secondary" onClick={() => setExam(null)}>New session <RotateCcw size={15} /></button></section><div className="exam-review-list">{examQuestions.map((item, index) => { const selected = exam.answers[item.id]; const gotIt = selected === item.correctOptionId; return <article key={item.id} className="exam-review-item"><header><span>QUESTION {index + 1} · {item.topic}</span><span className={gotIt ? "review-correct" : "review-needs-work"}>{gotIt ? <><CheckCircle2 size={14} />Correct</> : <><Info size={14} />Review</>}</span></header><h3>{item.stem}</h3><p><strong>Your answer:</strong> {item.options.find(option => option.id === selected)?.text ?? "No answer selected"}</p><p><strong>Correct answer:</strong> {item.options.find(option => option.id === item.correctOptionId)?.text}</p><div className="review-explanation">{item.explanation}</div><a href={item.source.url} target="_blank" rel="noreferrer">Source: {item.source.title} <ExternalLink size={12} /></a></article>; })}</div></>;
  if (!current) return <EmptyState title="The exam session could not be loaded" body="Return to the setup and start another session." action={<button className="button button-primary" onClick={() => setExam(null)}>Back to setup</button>} />;
  const minutes = Math.floor(exam.secondsLeft / 60); const seconds = exam.secondsLeft % 60;
  return <><section className="exam-active-header"><div><span className="eyebrow"><span className="eyebrow-rule" />TIMED PRACTICE SESSION IN PROGRESS</span><h1>Stay with the question in front of you.</h1><p className="exam-path-context">Study context: {getPathway(exam.pathwayId)?.name ?? "General nursing study"} · original practice, not blueprint mapped</p></div><div className={`exam-clock ${exam.secondsLeft < 60 ? "clock-warning" : ""}`} aria-label={`${minutes} minutes ${seconds} seconds remaining`}><Timer size={18} /><span>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span><small>remaining</small></div></section><div className="exam-workspace"><aside className="exam-question-map"><span className="section-overline">QUESTION MAP</span><div className="exam-number-grid">{examQuestions.map((_, index) => <button key={index} className={`${exam.index === index ? "current" : ""} ${exam.answers[examQuestions[index].id] ? "answered" : ""}`} onClick={() => setExam({ ...exam, index })} aria-label={`Go to question ${index + 1}${exam.answers[examQuestions[index].id] ? ", answered" : ", unanswered"}`}>{index + 1}</button>)}</div><div className="exam-map-legend"><span><i className="legend-current" />Current</span><span><i className="legend-answered" />Answered</span></div><button className="button button-secondary button-wide" onClick={() => { if (window.confirm("Submit this practice session for review? Your answers will be saved on this device.")) finish(exam); }}>Finish session <Check size={15} /></button></aside><article className="exam-question-card"><div className="exam-question-top"><span>QUESTION {exam.index + 1} OF {examQuestions.length}</span><span>{subjectName(current.subject)} · {current.difficulty}</span></div><h2>{current.stem}</h2><fieldset className="answer-options"><legend className="sr-only">Select your answer</legend>{current.options.map((option, index) => <label key={option.id} className={`answer-option ${exam.answers[current.id] === option.id ? "selected" : ""}`}><input type="radio" name={`exam-${current.id}`} value={option.id} checked={exam.answers[current.id] === option.id} onChange={() => setExam({ ...exam, answers: { ...exam.answers, [current.id]: option.id } })} /><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option.text}</span></label>)}</fieldset><div className="exam-question-controls"><button className="button button-quiet" onClick={() => setExam({ ...exam, index: Math.max(0, exam.index - 1) })} disabled={exam.index === 0}><ChevronLeft size={15} />Previous</button>{exam.index < examQuestions.length - 1 ? <button className="button button-primary" onClick={() => setExam({ ...exam, index: exam.index + 1 })}>Next question <ChevronRight size={15} /></button> : <button className="button button-primary" onClick={() => { if (window.confirm("Submit this practice session for review? Your answers will be saved on this device.")) finish(exam); }}>Submit for review <Check size={15} /></button>}</div></article></div></>;
}

function ProgressPage({ progress, score, selectedPathwayId, go, openLesson, startPractice }: { progress: LearnerProgress; score: ReturnType<typeof calculateScore>; selectedPathwayId: PathwayId | null; go: (view: View) => void; openLesson: (lesson: Lesson) => void; startPractice: (subject?: SubjectId, sourceQuestions?: Question[], mode?: PracticeMode) => void }) {
  const attempts = selectedPathwayId ? progress.attempts.filter(attempt => attempt.pathwayId === selectedPathwayId) : progress.attempts;
  const completedIds = completedLessonsFor(progress, selectedPathwayId);
  const selectedName = getPathway(selectedPathwayId)?.name;
  const byTopic = new Map<string, { total: number; correct: number }>();
  for (const attempt of attempts) {
    const value = byTopic.get(attempt.topic) ?? { total: 0, correct: 0 };
    value.total++;
    value.correct += Number(attempt.correct);
    byTopic.set(attempt.topic, value);
  }
  const topics = [...byTopic.entries()].sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);
  const suggested = topics[0]
    ? lessons.find(lesson => lesson.topic.toLowerCase() === topics[0][0].toLowerCase())
    : lessons.find(lesson => !completedIds.includes(lesson.id));

  return <>
    <PageHeader eyebrow="YOUR STUDY RECORD" title="Progress that belongs to you." subtitle={selectedName ? `A private, device-local record for ${selectedName}. New answers and lesson completions are grouped under this pathway.` : "A private, device-local view of lessons completed and practice you have submitted. No account is required."} action={<span className="local-progress-badge"><ShieldCheck size={14} />On this device</span>} />
    <section className="progress-summary">
      <article><span className="progress-stat-icon mint"><BookMarked size={18} /></span><span className="section-overline">LESSONS COMPLETED</span><strong>{completedIds.length}<small> / {lessons.length}</small></strong><p>Marked complete by you{selectedPathwayId ? " in this pathway" : " across study"}</p></article>
      <article><span className="progress-stat-icon lavender"><FileQuestion size={18} /></span><span className="section-overline">QUESTIONS SUBMITTED</span><strong>{score.answered}</strong><p>Across practice and mock exams</p></article>
      <article><span className="progress-stat-icon peach"><Target size={18} /></span><span className="section-overline">PRACTICE ACCURACY</span><strong>{score.answered ? score.percent + "%" : "—"}</strong><p>{score.answered ? score.correct + " correct responses" : "Complete practice to begin"}</p></article>
      <article><span className="progress-stat-icon mint"><Bookmark size={18} /></span><span className="section-overline">SAVED QUESTIONS</span><strong>{progress.bookmarkedQuestionIds.length}</strong><p><button className="text-link" onClick={() => startPractice(undefined, undefined, "bookmarked")} disabled={!progress.bookmarkedQuestionIds.length}>Review bookmarks <ArrowRight size={13} /></button></p></article>
    </section>
    <ProgressTimeline attempts={attempts} go={go} />
    <section className="progress-detail-grid">
      <article className="progress-panel">
        <div className="panel-heading"><div><span className="section-overline">REVISION SIGNALS</span><h2>Topics to revisit</h2></div><span className="panel-heading-icon"><Activity size={16} /></span></div>
        {topics.length ? <div className="topic-performance-list">{topics.map(([topic, value]) => <div className="topic-performance" key={topic}><span><strong>{topic}</strong><small>{value.correct} of {value.total} correct</small></span><div className="topic-meter" role="img" aria-label={Math.round(value.correct * 100 / value.total) + " percent correct"}><i style={{ width: value.correct * 100 / value.total + "%" }} /></div><span className="topic-percent">{Math.round(value.correct * 100 / value.total)}%</span></div>)}</div> : <EmptyState compact title="Your study history starts here" body="Submit a practice answer or mock exam to see a revision signal." action={<button className="text-link" onClick={() => go("practice")}>Start a question <ArrowRight size={14} /></button>} />}
      </article>
      <aside className="progress-panel suggested-panel"><span className="section-overline">A NEXT STEP</span><h2>{suggested ? "Review one useful topic" : "You have explored every lesson"}</h2><p>{suggested ? suggested.title : "Keep practising with the question bank to build more topic-level feedback."}</p>{suggested && <><span className="suggested-subject">{subjectName(suggested.subject)} · {suggested.estimatedMinutes} min</span><button className="button button-primary button-wide" onClick={() => openLesson(suggested)}>Open suggested lesson <ArrowRight size={14} /></button></>}</aside>
    </section>
    <RecentActivity attempts={attempts} />
    {selectedPathwayId && progress.attempts.some(attempt => !attempt.pathwayId) && <p className="progress-legacy-note">Earlier general answers are preserved but are not included in this pathway's score.</p>}
    <section className="completed-lessons"><div className="section-row"><div><div className="section-overline">LESSON CHECKLIST</div><h2>Your completed lessons</h2></div><button className="text-link" onClick={() => go("learn")}>Find more lessons <ArrowRight size={14} /></button></div>{lessons.map(lesson => <button className="completed-lesson-row" key={lesson.id} onClick={() => openLesson(lesson)}><span className={completedIds.includes(lesson.id) ? "complete-check checked" : "complete-check"}>{completedIds.includes(lesson.id) && <Check size={13} />}</span><span><strong>{lesson.title}</strong><small>{subjectName(lesson.subject)}</small></span><ChevronRight size={15} /></button>)}</section>
    <p className="local-data-note"><ShieldCheck size={14} />Progress stays in this browser's local storage. It is not synced to a NurseBridge account or sent to the server.</p>
  </>;
}

function ProgressTimeline({ attempts, go }: { attempts: LearnerProgress["attempts"]; go: (view: View) => void }) {
  const recent = attempts.slice(-12);
  const plotted = recent.map((attempt, index) => ({
    ...attempt,
    x: recent.length === 1 ? 260 : 28 + index * (464 / (recent.length - 1)),
    y: attempt.correct ? 34 : 96
  }));
  const points = plotted.map(point => point.x + "," + point.y).join(" ");
  return <section className="progress-trend" aria-labelledby="progress-trend-title">
    <header className="progress-trend-header"><div><span className="section-overline">ANSWER SEQUENCE</span><h2 id="progress-trend-title">Practice, one response at a time.</h2></div><span className="trend-count">{recent.length ? "LAST " + recent.length + " ANSWERS" : "NO ANSWERS YET"}</span></header>
    {plotted.length ? <>
      <div className="trend-plot">
        <div className="trend-axis-labels" aria-hidden="true"><span>Correct</span><span>Review</span></div>
        <svg viewBox="0 0 520 132" role="img" aria-labelledby="trend-svg-title trend-svg-desc">
          <title id="trend-svg-title">Recent submitted practice answers</title>
          <desc id="trend-svg-desc">One dot per saved answer, ordered from earlier to most recent. Higher dots are correct; lower dots need review.</desc>
          <line className="trend-guide" x1="22" y1="34" x2="498" y2="34" />
          <line className="trend-guide" x1="22" y1="96" x2="498" y2="96" />
          {plotted.length > 1 && <polyline className="trend-connector" points={points} />}
          {plotted.map((point, index) => <circle key={point.questionId + point.answeredAt + index} className={point.correct ? "trend-point is-correct" : "trend-point needs-review"} cx={point.x} cy={point.y} r="5" tabIndex={0} aria-label={"Answer " + (index + 1) + ": " + (point.correct ? "correct" : "review") + ", " + point.topic + ", " + new Date(point.answeredAt).toLocaleString()}><title>{point.correct ? "Correct" : "Review"} · {point.topic} · {new Date(point.answeredAt).toLocaleDateString()}</title></circle>)}
        </svg>
      </div>
      <footer className="trend-chart-footer"><span>EARLIER</span><span>Each point is a response saved on this device</span><span>MOST RECENT</span></footer>
    </> : <div className="trend-empty"><span className="trend-empty-mark"><Activity size={18} /></span><div><strong>Your practice timeline starts with your first answer.</strong><p>No sample results are shown. Start a free question set to create your private learning record.</p></div><button className="button button-secondary" onClick={() => go("practice")}>Start practice <ArrowRight size={14} /></button></div>}
  </section>;
}
function RecentActivity({ attempts }: { attempts: LearnerProgress["attempts"] }) {
  const recent = attempts.slice(-5).reverse();
  return <section className="recent-activity" aria-labelledby="recent-activity-title"><div className="section-overline">ON THIS DEVICE</div><h2 id="recent-activity-title">Recent practice</h2>{recent.length ? <div className="recent-activity-list">{recent.map((attempt, index) => { const question = questions.find(item => item.id === attempt.questionId); const timestamp = Date.parse(attempt.answeredAt); const selectedText = question?.options.find(option => option.id === attempt.selectedOptionId)?.text; return <article className="recent-activity-row" key={`${attempt.questionId}-${attempt.answeredAt}-${index}`}><span className={`recent-activity-mark ${attempt.correct ? "" : "review"}`}>{attempt.correct ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}</span><span><strong>{attempt.topic}</strong><small>{attempt.correct ? "Correct answer" : "Review this topic"}{question ? ` · ${question.examTags[0]}` : " · Practice question"}</small>{attempt.selectedOptionId && <small className="saved-answer-line">Your choice: {selectedText ?? "Saved answer from an older content set"}</small>}</span><time dateTime={attempt.answeredAt}>{Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString() : "Date unavailable"}</time></article>; })}</div> : <p className="muted-small">Your recent answers will appear here after you complete a practice question or mock exam.</p>}</section>;
}
function SponsoredPage({ request, busy, submit }: { request: { requestId: string; status: string; createdAt?: string } | null; busy: boolean; submit: () => void }) {
  return <><PageHeader eyebrow="STUDY SUPPORT" title="Request support for your learning." subtitle="A private, low-friction way to ask for study access. You can learn for free while a request is pending." /><section className="sponsored-layout"><article className="sponsored-intro-card"><span className="sponsored-heart"><HeartHandshake size={22} /></span><span className="section-overline">GET SPONSORED</span><h2>Support should feel respectful and clear.</h2><p>Submit a private request for premium study access. NurseBridge records only a random request key and status. We do not ask for your name, contact details, financial documents, or personal circumstances in this demo.</p><div className="sponsored-steps"><div><span>1</span><p><strong>Send a request</strong><small>A private browser key prevents duplicate pending requests.</small></p></div><div><span>2</span><p><strong>Wait for review</strong><small>Every request stays pending until a real reviewer approves it.</small></p></div><div><span>3</span><p><strong>Access after a grant</strong><small>No access is activated just because a request was submitted.</small></p></div></div>{request ? <div className="request-status-card"><span className="request-status-icon"><Clock3 size={17} /></span><span><strong>Request status: {request.status}</strong><small>Reference {compact(request.requestId)} · submitted {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "on this browser"}</small><small>This demo does not have an authenticated reviewer; no grant can be approved here yet.</small></span><span className="pending-status-pill">PENDING</span></div> : <button className="button button-primary" onClick={submit} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <HeartHandshake size={16} />}Submit private request <ArrowRight size={15} /></button>}<p className="private-request-note"><LockKeyhole size={13} />Keep this browser's local storage to view your request status again. Clearing it removes your private request key.</p></article><aside className="sponsored-aside"><div className="sponsored-aside-icon"><BookOpen size={19} /></div><span className="section-overline">WHILE YOU WAIT</span><h3>Keep learning for free</h3><p>All starter lessons and the full free practice bank remain open with or without sponsorship.</p><button className="button button-secondary button-wide" onClick={() => { window.location.hash = "learn"; }}>Explore free lessons <ArrowRight size={14} /></button><div className="aside-divider" /><span className="section-overline">CURRENT STATUS</span><div className="no-grant-callout"><Info size={15} /><span>No sponsored grants are currently available in this demo.</span></div></aside></section></>;
}

function SponsorPage({ summary, error, config, onSponsor, go }: { summary: SponsorSummary | null; error: string; config: AppConfig | null; onSponsor: () => void; go: (view: View) => void }) {
  const confirmedAmount = summary && config ? formatUnits(BigInt(summary.confirmedMUsdAtomic), config.decimals) : null;
  return <><PageHeader eyebrow="FUND LEARNING ACCESS" title="Help make room for another learner." subtitle="Contributions go to a separately configured Testnet MUSD fund wallet. All amounts shown are backed by verified Testnet receipts." /><section className="sponsor-overview-grid"><article className="fund-total-card"><span className="fund-total-icon"><Coins size={20} /></span><span className="section-overline">CONFIRMED TESTNET CONTRIBUTIONS</span><strong>{confirmedAmount ?? "—"}{confirmedAmount !== null && <small> MUSD</small>}</strong><p>{summary ? `${summary.contributionCount} verified ${summary.contributionCount === 1 ? "contribution" : "contributions"} in this server record` : error || "Loading verified fund activity…"}</p><div className="fund-status-line"><span className="network-live-dot" />Only server-verified transactions are included</div></article><article className="sponsor-impact-card"><span className="section-overline">HOW CONTRIBUTIONS ARE HANDLED</span><div className="allocation-row"><span className="allocation-icon"><ShieldCheck size={16} /></span><span><strong>Fund address is explicit</strong><small>A distinct recipient is configured for student fund contributions.</small></span></div><div className="allocation-row"><span className="allocation-icon"><BadgeCheck size={16} /></span><span><strong>Receipts are checked</strong><small>Chain, MUSD token, payer, recipient, and exact amount are verified.</small></span></div><div className="allocation-row"><span className="allocation-icon"><Info size={16} /></span><span><strong>Grants are not automatic</strong><small>This demo has no protected review or allocation process yet.</small></span></div></article></section><section className="sponsor-action-panel"><div><span className="eyebrow"><span className="eyebrow-rule" />OPTIONAL TESTNET CONTRIBUTION</span><h2>Support the access fund with MUSD.</h2><p>{config?.sponsorAvailable ? `A confirmed contribution of ${config.sponsorPrice} MUSD will be sent to the configured Testnet fund wallet.` : "This payment route is unavailable until a sponsor fund Testnet address is configured. No contribution can be taken yet."} Testnet tokens have no guaranteed real-world value.</p></div><button className="button button-primary" onClick={onSponsor} disabled={!config?.sponsorAvailable}> {config?.sponsorAvailable ? <><Wallet size={16} />Contribute {config.sponsorPrice} MUSD</> : <><LockKeyhole size={16} />Contribution unavailable</>}<ArrowRight size={15} /></button></section><div className="grant-transparency"><div className="grant-zero"><span>{summary ? summary.grantsIssued : "—"}</span><small>Grants issued in this demo</small></div><div><h3>{summary?.allocationStatus ?? (error ? "Verified grant information is unavailable." : "Loading verified grant information…")}</h3><p>Contributions are not shown as student support until a real grant is assigned and recorded. No student information or application details appear on this page.</p><button className="text-link" onClick={() => go("sponsored")}>Read about requesting support <ArrowRight size={14} /></button></div></div>{summary?.contributions?.length ? <section className="contribution-section"><div className="section-row"><div><div className="section-overline">VERIFIED TRANSACTION REFERENCES</div><h2>Recent contributions</h2></div><span className="confirmed-pill"><Check size={12} />On-chain verified</span></div><div className="contribution-list">{summary.contributions.map(item => <a key={item.hash} className="contribution-row" href={explorerLink(config, item.hash)} target="_blank" rel="noreferrer"><span className="contribution-icon"><Coins size={15} /></span><span><strong>{formatUnits(BigInt(item.amount), config?.decimals ?? 18)} MUSD</strong><small>{compact(item.hash)} · {new Date(item.verifiedAt).toLocaleString()}</small></span><ExternalLink size={14} /></a>)}</div></section> : <div className="empty-fund"><span><Coins size={19} /></span><strong>{summary ? "No verified contributions yet" : "Verified fund data unavailable"}</strong><small>{summary ? "The contribution list will appear after a real Testnet payment is verified." : error || "Refresh this page when the API is reachable."}</small></div>}<p className="local-data-note"><ShieldCheck size={14} />Public fund totals contain only verified transactions. Private sponsorship requests are never listed here.</p></>;
}

function PremiumPage({ config, configState, connected, entitlement, premiumPack, busy, authBusy, hasAccessSession, onAuthorize, onPurchase, startPractice, go }: { config: AppConfig | null; configState: string; connected: boolean; entitlement: Entitlement; premiumPack: PremiumPack | null; busy: boolean; authBusy: boolean; hasAccessSession: boolean; onAuthorize: () => void; onPurchase: () => void; startPractice: (subject?: SubjectId, sourceQuestions?: Question[]) => void; go: (view: View) => void }) {
  const premiumQuestions = premiumPack ? makePremiumQuestions(premiumPack) : [];
  const paymentAvailability = configState === "loading"
    ? { state: "checking", message: "Checking the Mezo Testnet payment service…" }
    : configState === "offline"
      ? { state: "unavailable", message: "The payment service could not be reached. No payment can be made right now; free lessons and practice remain available." }
      : !config?.premiumAvailable
        ? { state: "unavailable", message: "Checkout is disabled because the server has no PAY_TO merchant receiving address configured for Mezo Testnet. The operator must set an address they control in the server environment and restart it. No payment can be taken until then." }
        : null;
  return <>
    <PageHeader eyebrow="OPTIONAL PAID ACCESS" title="Go deeper when you are ready." subtitle="Premium study is optional. Free lessons and practice remain available without a wallet or payment." action={<span className="testnet-pill"><span className="network-live-dot" />MEZO TESTNET</span>} />
    <section className="premium-product-grid">
      <article className="premium-package-card">
        <div className="premium-package-top"><span className="premium-package-icon"><Sparkles size={21} /></span><span className="premium-label">30-DAY ACCESS</span></div>
        <span className="section-overline">PREMIUM REVIEW PACK</span><h2>Applied practice for public health nursing</h2>
        <p>Unlock a source-linked case review set, with detailed rationales and secure server-side access checks.</p>
        <div className="premium-duration" aria-label="Access duration: 30 days"><span>ACCESS DURATION</span><strong>30 days</strong><p>Your access starts after your payment is verified on Mezo Testnet.</p></div>
        <ul className="package-includes"><li><Check size={15} />Three applied public-health nursing review questions</li><li><Check size={15} />Detailed rationales for each question</li><li><Check size={15} />Source links for further reading</li><li><Check size={15} />Access tied to the paying wallet</li></ul>
        <div className="package-price"><strong>{config?.premiumPrice ?? "—"}<small> MUSD</small></strong><span>Mezo Testnet · one-time payment</span></div>
        {entitlement.active ? <div className="active-entitlement"><CheckCircle2 size={17} /><span><strong>Premium access is active</strong><small>Expires {entitlement.expiresAt ? new Date(entitlement.expiresAt).toLocaleString() : "as shown by the server"}</small></span></div> : <button className="button button-primary button-wide" onClick={onPurchase} disabled={!config?.premiumAvailable || configState !== "ready" || busy}>{busy ? <LoaderCircle className="spin" size={16} /> : config?.premiumAvailable ? <Wallet size={16} /> : <LockKeyhole size={16} />}{configState === "loading" ? "Checking payment service" : config?.premiumAvailable ? connected ? "Review & pay with MUSD" : "Connect wallet to continue" : "Payment unavailable"}<ArrowRight size={15} /></button>}
        {paymentAvailability && <div className={`payment-availability payment-availability-${paymentAvailability.state}`} role="status" aria-live="polite">{paymentAvailability.message}</div>}
        <p className="package-note"><ShieldCheck size={13} />Payment activates access only after server-side verification of a successful Testnet receipt.</p>
      </article>
      <aside className="premium-side-panel">
        <div className="premium-side-icon"><ShieldCheck size={20} /></div><span className="section-overline">BEFORE YOU PAY</span><h3>Know exactly what you are buying.</h3>
        <div className="premium-fact"><span>01</span><p><strong>Price</strong><small>{config?.premiumPrice ?? "Unavailable"} MUSD, shown again in checkout.</small></p></div>
        <div className="premium-fact"><span>02</span><p><strong>Access begins after verification</strong><small>The 30-day period starts only when the server confirms a successful Mezo Testnet receipt.</small></p></div>
        <div className="premium-fact"><span>03</span><p><strong>Network</strong><small>Mezo Testnet only. Test tokens have no guaranteed real value.</small></p></div>
        <div className="premium-fact"><span>04</span><p><strong>Cancellation</strong><small>There is no recurring subscription. A submitted blockchain payment cannot be cancelled by NurseBridge.</small></p></div>
        <button className="text-link" onClick={() => go("help")}>Payment help & privacy <ArrowRight size={14} /></button>
      </aside>
    </section>
    {entitlement.active && <section className="premium-unlocked-panel">
      <div className="premium-unlocked-heading"><span className="active-access-badge"><CheckCircle2 size={14} />VERIFIED ACCESS</span><div><span className="section-overline">YOUR REVIEW CONTENT</span><h2>{premiumPack?.title ?? "Applied community health review"}</h2></div></div>
      {premiumPack ? <><div className="premium-question-cards">{premiumQuestions.map((question, index) => <article key={question.id}><span>QUESTION {String(index + 1).padStart(2, "0")}</span><h3>{question.topic}</h3><p>{question.stem}</p><small>{question.difficulty} · Source-linked rationale</small></article>)}</div><button className="button button-primary" onClick={() => startPractice(undefined, premiumQuestions)}>Review premium questions <ArrowRight size={15} /></button></> : hasAccessSession ? <div className="loading-inline"><LoaderCircle className="spin" size={16} />Loading content from the protected server endpoint…</div> : <div className="premium-auth-box"><span className="premium-auth-icon"><ShieldCheck size={17} /></span><div><strong>Verify wallet control to open your content</strong><p>This one-time signature does not authorize a payment or transaction. It creates a short-lived access session for your verified entitlement.</p></div><button className="button button-secondary" onClick={onAuthorize} disabled={authBusy}>{authBusy ? <LoaderCircle className="spin" size={15} /> : <Wallet size={15} />} {authBusy ? "Verifying…" : "Verify wallet & open pack"}</button></div>}
    </section>}
    <div className="premium-free-reminder"><BookOpen size={17} /><span><strong>Not ready to self-sponsor?</strong><small>Start learning free, or request sponsorship. No payment is required to continue your studies.</small></span><button className="text-link" onClick={() => go("learn")}>Study free <ArrowRight size={14} /></button></div>
  </>;
}

function HelpPage({ go }: { go: (view: View) => void }) {
  return <><PageHeader eyebrow="HELP & GUIDANCE" title="Clear answers for your next step." subtitle="Learn how NurseBridge content, progress, sponsorship and Mezo Testnet payments work." /><section className="help-content"><article className="help-callout"><span className="help-callout-icon"><Info size={18} /></span><div><strong>Educational use only</strong><p>{contentDisclaimer}</p></div></article><details className="faq-item"><summary>Can I use NurseBridge without a wallet?<ChevronDown size={16} /></summary><p>Yes. Lessons, the free question bank, mock exams and device-local progress work in guest mode. A wallet is only requested when you choose to make an optional Testnet payment.</p></details><details className="faq-item"><summary>Are these official RPHN, NMCN or NCLEX questions?<ChevronDown size={16} /></summary><p>No. The questions are original practice material with source links. They are not official past questions, do not predict exam content and cannot guarantee a result.</p></details><details className="faq-item"><summary>What happens when I request sponsorship?<ChevronDown size={16} /></summary><p>The demo records a private request as pending and prevents duplicate pending requests from the same browser key. Submission is not approval or a grant. There is no authenticated reviewer in this iteration, so sponsorship cannot yet be approved or assigned inside NurseBridge.</p></details><details className="faq-item"><summary>How does the MUSD payment work?<ChevronDown size={16} /></summary><p>Optional checkout runs only on Mezo Testnet. The x402 facilitator requests a wallet authorization; the server then checks the Testnet receipt for the exact MUSD token, network, payer, recipient and amount. Access is not activated from a browser success message. Testnet tokens have no guaranteed real-world value.</p></details><details className="faq-item"><summary>Can I cancel a payment or request a refund?<ChevronDown size={16} /></summary><p>NurseBridge has no recurring subscriptions. A blockchain payment that has settled cannot be cancelled by the app. No refunds are automated in this demo; do not pay until the price, Testnet label, recipient and package are clear. Testnet assets are not real-funds payments.</p></details><details className="faq-item"><summary>Where is my study progress stored?<ChevronDown size={16} /></summary><p>Guest learning progress is stored in this browser's local storage. It is not synced to an account or sent to the server. You can clear it from Settings.</p></details><details className="faq-item"><summary>Privacy overview<ChevronDown size={16} /></summary><p>Free progress stays in this browser. If you request sponsorship, a random lookup key stays in browser storage and only its hash and request status are stored on the server. A payment intent and verified transaction record include the public wallet address, amount, recipient and transaction hash. NurseBridge does not collect wallet credentials, patient information or personal financial circumstances.</p></details><details className="faq-item"><summary>Terms for this demo<ChevronDown size={16} /></summary><p>Use NurseBridge as a study aid. Content is original practice material, not clinical advice, official examination content, or a guarantee of results. Do not enter patient-identifiable information. Optional payments and sponsor contributions use Mezo Testnet MUSD only; testnet assets have no guaranteed value. There is no recurring subscription or automated refund process. A settled blockchain transaction cannot be cancelled by the app.</p></details><div className="help-links"><a href="https://testnet.mezo.org/docs/developers/getting-started/musd-payments-x402/x402-quickstart/" target="_blank" rel="noreferrer"><Coins size={16} /><span><strong>Mezo x402 Testnet quickstart</strong><small>Official network and MUSD payment guidance</small></span><ExternalLink size={14} /></a><a href="https://www.who.int/publications/i/item/9789240084278" target="_blank" rel="noreferrer"><BookOpen size={16} /><span><strong>WHO mhGAP guideline</strong><small>Evidence-informed mental health resources</small></span><ExternalLink size={14} /></a><a href="https://nmcn.gov.ng/education.html" target="_blank" rel="noreferrer"><GraduationCap size={16} /><span><strong>Nursing and Midwifery Council of Nigeria</strong><small>Official education information</small></span><ExternalLink size={14} /></a></div><button className="button button-secondary" onClick={() => go("learn")}>Go to free study library <ArrowRight size={15} /></button></section></>;
}

function SettingsPage({ progress, account, onClear }: { progress: LearnerProgress; account: Address | null; onClear: () => void }) {
  return <><PageHeader eyebrow="GUEST SETTINGS" title="Your data stays in your hands." subtitle="NurseBridge does not require an account for free study. Review the data used in this browser and connected wallet." /><section className="settings-card"><div className="settings-row"><span className="settings-icon"><GraduationCap size={18} /></span><span><strong>Learning mode</strong><small>Guest learner. No login or profile is configured.</small></span><span className="settings-value-pill">GUEST</span></div><div className="settings-row"><span className="settings-icon"><Activity size={18} /></span><span><strong>Study progress</strong><small>{progress.completedLessonIds.length} completed lessons · {progress.attempts.length} submitted answers stored locally in this browser.</small></span><span className="settings-value-pill">LOCAL</span></div><div className="settings-row"><span className="settings-icon"><Wallet size={18} /></span><span><strong>Connected wallet</strong><small>{account ? `${compact(account)} · Only used for optional Testnet checkout.` : "No wallet connected. You can continue learning for free."}</small></span><span className="settings-value-pill">OPTIONAL</span></div><div className="settings-row"><span className="settings-icon"><LockKeyhole size={18} /></span><span><strong>Sponsorship request key</strong><small>A random browser key is stored locally only if you submit a sponsorship request. No name or financial details are collected.</small></span><span className="settings-value-pill">PRIVATE</span></div><div className="settings-row settings-danger-row"><span className="settings-icon"><X size={18} /></span><span><strong>Clear local progress</strong><small>Remove completed lessons and practice history from this browser.</small></span><button className="button button-danger-quiet" onClick={onClear}>Clear data</button></div></section><p className="settings-privacy-note"><ShieldCheck size={15} />Payment intents, verified payment references and pseudonymous sponsorship request statuses are stored by the local server in its data directory. Configure a protected persistent volume before hosting outside local development.</p></>;
}

function NotFoundPage({ go }: { go: (view: View) => void }) { return <EmptyState title="We could not find that page" body="The link may be out of date. Your learning is still here." action={<button className="button button-primary" onClick={() => go("home")}>Return to NurseBridge <ArrowRight size={15} /></button>} />; }

function EmptyState({ title, body, action, compact = false }: { title: string; body: string; action?: React.ReactNode; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "empty-state-compact" : ""}`}><span className="empty-state-icon"><BookOpen size={18} /></span><strong>{title}</strong><p>{body}</p>{action}</div>;
}

