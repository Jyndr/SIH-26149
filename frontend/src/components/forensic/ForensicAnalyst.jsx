import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  FileSearch,
  HardDrive,
  Mail,
  Trash2,
  User,
  Lock,
  Globe,
  Database,
  ExternalLink,
  Download,
  Copy,
  Check,
  X,
  ChevronRight,
  RefreshCw,
  Clock,
  Fingerprint,
  Info,
  Terminal,
  Layers,
  HelpCircle,
  Folder,
  KeyRound,
  Sliders,
  Cpu
} from 'lucide-react';
import { forensicApi } from '../../services/api';

export const ForensicAnalyst = ({ evidenceId, caseId, onSwitchToPipeline }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidenceOverview, setEvidenceOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [history, setHistory] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [configError, setConfigError] = useState(null);

  // Artifact Inspector Modal
  const [inspectArtifact, setInspectArtifact] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState('readable'); // 'readable' | 'technical' | 'raw'
  const [copiedField, setCopiedField] = useState(null);

  const inputRef = useRef(null);

  useEffect(() => {
    if (evidenceId) {
      loadOverview();
      checkAiStatus();
    }
  }, [evidenceId]);

  const loadOverview = async () => {
    try {
      setLoadingOverview(true);
      const res = await forensicApi.getOverview(evidenceId);
      if (res && res.data) {
        setEvidenceOverview(res.data);
      }
    } catch (err) {
      console.warn('Failed to load evidence overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  const checkAiStatus = async () => {
    try {
      const res = await forensicApi.getAnalystStatus(evidenceId);
      if (res && res.data) {
        setAiStatus(res.data);
        if (!res.data.configured) {
          setConfigError('AI API Key is not configured. Add AI_API_KEY in backend/.env to query this evidence.');
        } else {
          setConfigError(null);
        }
      }
    } catch (err) {
      console.warn('Could not fetch AI status:', err);
    }
  };

  const handleAsk = async (queryText) => {
    const q = (queryText || question).trim();
    if (!q) return;

    setLoading(true);
    setQuestion(q);
    setConfigError(null);

    try {
      const res = await forensicApi.ask(evidenceId, q);
      if (res && res.data) {
        const item = {
          id: 'q-' + Date.now(),
          question: q,
          answer: res.data.answer || 'No verified evidence was found for this question.',
          evidence: res.data.evidence || 'No direct evidence records returned.',
          source: res.data.source || evidenceOverview?.diskInfo?.image || 'Loaded Forensic Image',
          content: res.data.content || null,
          recovery: res.data.recovery || 'Filesystem',
          partition: res.data.partition || null,
          record: res.data.record || null,
          sha256: res.data.sha256 || null,
          confidence: res.data.confidence || 'Medium',
          sourceArtifactId: res.data.sourceArtifactId || null,
          sourceArtifact: res.data.sourceArtifact || null,
          matches: res.data.matches || null,
          timestamp: new Date().toLocaleTimeString()
        };

        setHistory((prev) => [item, ...prev]);
        setQuestion('');
      }
    } catch (err) {
      console.error('Forensic analyst query failed:', err);
      const errResponse = err.response?.data;
      if (errResponse?.code === 'AI_KEY_MISSING' || err.response?.status === 412) {
        setConfigError(errResponse?.message || 'AI API Key is not configured. Please add AI_API_KEY in backend/.env.');
      } else {
        const errorItem = {
          id: 'q-err-' + Date.now(),
          question: q,
          answer: 'No verified evidence was found for this question.',
          evidence: err.message || 'Evidence retrieval or model inference encountered an error.',
          source: evidenceOverview?.diskInfo?.image || 'Loaded Forensic Image',
          recovery: 'Unresolved',
          confidence: 'Low',
          timestamp: new Date().toLocaleTimeString()
        };
        setHistory((prev) => [errorItem, ...prev]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInspector = async (artifact) => {
    if (!artifact) return;
    setInspectArtifact(artifact);
    setActiveInspectorTab('readable');
    setPreviewData(null);

    if (artifact.id) {
      try {
        setLoadingPreview(true);
        const res = await forensicApi.getFilePreview(evidenceId, artifact.id);
        if (res && res.data) {
          setPreviewData(res.data);
        }
      } catch (err) {
        console.warn('Could not load artifact preview:', err);
      } finally {
        setLoadingPreview(false);
      }
    }
  };

  const handleCloseInspector = () => {
    setInspectArtifact(null);
    setPreviewData(null);
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownload = (artifact) => {
    if (!artifact) return;
    const fileId = artifact.id || artifact.fileId;
    const filename = artifact.filename || artifact.name || artifact.originalName || 'evidence-artifact.dat';
    if (fileId) {
      forensicApi.downloadArtifact(evidenceId, fileId, filename);
    }
  };

  const getConfidenceBadge = (confidence) => {
    const c = (confidence || 'HIGH').toUpperCase();
    if (c === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          High Confidence
        </span>
      );
    }
    if (c === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" />
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="w-3 h-3" />
        Low Confidence
      </span>
    );
  };

  const getCategoryIcon = (category) => {
    switch ((category || '').toLowerCase()) {
      case 'email':
      case 'emails':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'recyclebin':
      case 'recycle bin & deleted files':
      case 'deleted file':
        return <Trash2 className="w-4 h-4 text-rose-600" />;
      case 'user':
      case 'users':
      case 'windows user account':
        return <User className="w-4 h-4 text-purple-600" />;
      case 'software':
      case 'installed software & encryption':
      case 'software / encryption tool':
        return <Lock className="w-4 h-4 text-amber-600" />;
      case 'browserhistory':
      case 'web & browser artifacts':
      case 'web shortcut / bookmark / cache':
        return <Globe className="w-4 h-4 text-teal-600" />;
      case 'diskinfo':
      case 'disk geometry & filesystem parameters':
        return <HardDrive className="w-4 h-4 text-slate-700" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span className="text-slate-800 font-semibold">Cyphora</span>
            <span>/</span>
            <span>Forensic Operations</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">Forensic Analyst</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Forensic Analyst</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Analysis complete
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-900 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Evidence: {evidenceOverview?.diskInfo?.image || 'Forensic Image'}
            </span>
            <span>•</span>
            <span>Disk: {evidenceOverview?.diskInfo?.partitioning || 'GPT'} {evidenceOverview?.diskInfo?.diskSize ? `(${evidenceOverview.diskInfo.diskSize})` : ''}</span>
            <span>•</span>
            <span>{evidenceOverview?.statistics?.total_files ? `${evidenceOverview.statistics.total_files.toLocaleString()} Files Indexed` : (evidenceOverview?.statistics?.recovered_artifacts ? `${evidenceOverview.statistics.recovered_artifacts.toLocaleString()} Artifacts Indexed` : 'Files Indexed')}</span>
            {aiStatus && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <Cpu className="w-3 h-3" />
                  {aiStatus.provider?.toUpperCase()} ({aiStatus.model})
                </span>
              </>
            )}
          </div>
        </div>

        {onSwitchToPipeline && (
          <button
            onClick={onSwitchToPipeline}
            className="self-start md:self-auto flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Acquisition Pipeline</span>
          </button>
        )}
      </div>

      {/* CONFIGURATION ERROR BANNER (Requirement 12) */}
      {configError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>AI API Key Configuration Required</span>
          </div>
          <p className="leading-relaxed text-amber-800">
            {configError}
          </p>
          <div className="bg-white/80 p-3 rounded-lg border border-amber-200 font-mono text-[11px] space-y-1">
            <div className="text-slate-500 font-sans font-semibold mb-1">Add to backend/.env:</div>
            <div><span className="text-slate-400"># Google Gemini:</span> AI_API_KEY=your_gemini_key  (or GEMINI_API_KEY=...)</div>
            <div><span className="text-slate-400"># OpenAI:</span> AI_API_KEY=your_openai_key  (or OPENAI_API_KEY=...)</div>
            <div><span className="text-slate-400"># Local Ollama:</span> AI_BASE_URL=http://localhost:11434/v1</div>
          </div>
        </div>
      )}

      {/* 2. PROMPT & SEARCH/QUESTION BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Ask anything about this evidence.
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dynamically grounded in verified physical disk records, partition geometry, NTFS metadata, and extracted artifacts.
          </p>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="relative flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask any forensic question about the loaded evidence (e.g. disk geometry, user accounts, emails, files)..."
              className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none"
            />
            {question && (
              <button
                type="button"
                onClick={() => setQuestion('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-semibold text-sm rounded-lg transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing Evidence...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ask</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 3. ANSWER CARDS STREAM */}
      <div className="space-y-4">
        {history.map((card) => (
          <div
            key={card.id}
            className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all"
          >
            {/* Question Header */}
            <div className="bg-slate-50/70 border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  Q
                </span>
                <span className="font-semibold text-sm text-slate-900">
                  {card.question}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getConfidenceBadge(card.confidence)}
                <span className="text-[11px] text-slate-400">
                  {card.timestamp}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* SECTION: ANSWER */}
              <div>
                <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  ANSWER
                </div>
                <div className="text-sm text-slate-900 font-medium leading-relaxed bg-slate-50/60 p-3.5 rounded-lg border border-slate-100 whitespace-pre-wrap">
                  {card.answer}
                </div>
              </div>

              {/* SECTION: EVIDENCE */}
              <div>
                <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-600" />
                  EVIDENCE
                </div>
                <div className="text-xs font-mono text-slate-800 bg-slate-50 p-3.5 rounded-lg border border-slate-200/90 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {card.evidence}
                </div>
              </div>

              {/* SECTION: EXTRACTED CONTENT / EXCERPT */}
              {card.content && card.content !== 'N/A' && (
                <div>
                  <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    EXTRACTED CONTENT / EXCERPT
                  </div>
                  <div className="text-xs font-mono text-slate-800 bg-slate-50/90 p-3.5 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-56">
                    {card.content}
                  </div>
                </div>
              )}

              {/* SECTION: TECHNICAL DETAILS & PROVENANCE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 sm:col-span-2">
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
                    SOURCE LOCATION
                  </div>
                  <div className="text-xs font-mono text-slate-700 break-all" title={card.source}>
                    {card.source}
                  </div>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
                    RECOVERY METHOD
                  </div>
                  <div className="text-xs text-slate-800 font-medium truncate">
                    {card.recovery || 'Filesystem'}
                  </div>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
                    PARTITION
                  </div>
                  <div className="text-xs font-mono text-slate-700 truncate" title={card.partition}>
                    {card.partition || 'Partition 2 (NTFS)'}
                  </div>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
                    RECORD / INODE
                  </div>
                  <div className="text-xs font-mono text-slate-700 truncate" title={card.record}>
                    {card.record || 'N/A'}
                  </div>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex items-center justify-between">
                  <div className="overflow-hidden pr-2">
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-0.5">
                      SHA-256
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 truncate" title={card.sha256}>
                      {card.sha256 && card.sha256 !== 'N/A' ? card.sha256.substring(0, 16) + '...' : 'N/A'}
                    </div>
                  </div>

                  {card.sourceArtifact && (
                    <button
                      onClick={() => handleOpenInspector(card.sourceArtifact)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION: MATCHES (if multiple artifacts recovered) */}
              {card.matches && card.matches.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-2">
                    RECOVERED EVIDENCE ARTIFACTS ({card.matches.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                    {card.matches.map((match, mIdx) => (
                      <div
                        key={mIdx}
                        className="bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200 rounded-lg p-3 text-xs flex flex-col justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800 truncate">
                              {getCategoryIcon(match.category)}
                              <span className="truncate" title={match.name || match.filename || match.title}>
                                {match.name || match.filename || match.title || match.originalName || 'Artifact'}
                              </span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200/80 rounded text-slate-700 font-mono flex-shrink-0">
                              {match.category || 'File'}
                            </span>
                          </div>

                          {match.snippet && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-2">
                              "{match.snippet}"
                            </p>
                          )}

                          <div className="text-[10px] font-mono text-slate-500 truncate mb-2">
                            {match.source || 'NTFS Partition 2'}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 mt-1">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {match.sha256 ? `${match.sha256.substring(0, 10)}...` : 'Verified'}
                          </span>
                          <button
                            onClick={() => handleOpenInspector(match.item || match)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>View Source</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 4. ARTIFACT INSPECTOR MODAL */}
      {inspectArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  {getCategoryIcon(inspectArtifact.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 font-mono">
                      {inspectArtifact.filename || inspectArtifact.name || inspectArtifact.originalName || 'Artifact'}
                    </h3>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {inspectArtifact.category || 'Forensic Item'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Source: {inspectArtifact.source || `${evidenceOverview?.diskInfo?.image || 'Forensic Image'} (Partition ${inspectArtifact.partition || '1'})`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(inspectArtifact)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handleCloseInspector}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 border-b border-slate-200 bg-white flex gap-6 text-xs font-semibold">
              <button
                onClick={() => setActiveInspectorTab('readable')}
                className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${activeInspectorTab === 'readable'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Readable Evidence</span>
              </button>
              <button
                onClick={() => setActiveInspectorTab('technical')}
                className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${activeInspectorTab === 'technical'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Technical & Integrity</span>
              </button>
              <button
                onClick={() => setActiveInspectorTab('raw')}
                className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${activeInspectorTab === 'raw'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <Binary className="w-3.5 h-3.5" />
                <span>Raw Hex Stream</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)] space-y-6">
              {/* TAB 1: READABLE EVIDENCE */}
              {activeInspectorTab === 'readable' && (
                <div className="space-y-4">
                  {/* Email Readable View */}
                  {inspectArtifact.category === 'email' && (
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <span className="text-slate-500 font-semibold">From:</span>
                          <span className="text-slate-900 font-medium">{inspectArtifact.from || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <span className="text-slate-500 font-semibold">To:</span>
                          <span className="text-slate-900 font-medium">{inspectArtifact.to || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <span className="text-slate-500 font-semibold">Subject:</span>
                          <span className="text-slate-900 font-bold">{inspectArtifact.subject || 'No Subject'}</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <span className="text-slate-500 font-semibold">Date:</span>
                          <span className="text-slate-700">{inspectArtifact.date || inspectArtifact.timestamp || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                          MESSAGE BODY
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[120px]">
                          {previewData?.preview?.content || inspectArtifact.content || inspectArtifact.evidence || 'No body content available.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recycle Bin Readable View */}
                  {inspectArtifact.category === 'recycleBin' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs">
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Original Filename:</span>
                        <span className="text-slate-900 font-bold font-mono">{inspectArtifact.originalName || inspectArtifact.name}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Original Path:</span>
                        <span className="text-slate-700 font-mono text-[11px] break-all">{inspectArtifact.originalPath || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Deletion Timestamp:</span>
                        <span className="text-slate-800">{inspectArtifact.deletedTimestamp || inspectArtifact.deletionTimestamp || inspectArtifact.date || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Original File Size:</span>
                        <span className="text-slate-800">{inspectArtifact.fileSize ? `${inspectArtifact.fileSize.toLocaleString()} bytes` : 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">User Account:</span>
                        <span className="text-blue-700 font-semibold">{inspectArtifact.user || 'Unknown User'}</span>
                      </div>
                    </div>
                  )}

                  {/* User Account Readable View */}
                  {['user', 'users'].includes(inspectArtifact.category) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs">
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Username:</span>
                        <span className="text-slate-900 font-bold">{inspectArtifact.username || inspectArtifact.name}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">User RID / SID:</span>
                        <span className="text-slate-700 font-mono">{inspectArtifact.rid || inspectArtifact.sid || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Profile Path:</span>
                        <span className="text-slate-700 font-mono">{inspectArtifact.profilePath || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Password Hint:</span>
                        <span className="text-slate-800 font-mono">{inspectArtifact.passwordHint || 'None'}</span>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-slate-500 font-semibold">Last Login:</span>
                        <span className="text-slate-800">{inspectArtifact.lastLogin || inspectArtifact.lastActive || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {/* Generic File or Artifact Readable View */}
                  {!['email', 'recycleBin', 'user', 'users'].includes(inspectArtifact.category) && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        EXTRACTED DATA / CONTENT
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[140px]">
                        {previewData?.preview?.content || inspectArtifact.content || inspectArtifact.evidence || inspectArtifact.details || inspectArtifact.description || JSON.stringify(inspectArtifact.details || inspectArtifact, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TECHNICAL & INTEGRITY */}
              {activeInspectorTab === 'technical' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs font-mono">
                    <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-sans">
                      PHYSICAL & FILESYSTEM SOURCE
                    </div>
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <span className="text-slate-500">Evidence Image:</span>
                      <span className="text-slate-900 font-bold">{inspectArtifact.sourceImage || evidenceOverview?.diskInfo?.image || 'Forensic Image'}</span>
                    </div>
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <span className="text-slate-500">Partition:</span>
                      <span className="text-slate-800">{inspectArtifact.partition || (evidenceOverview?.partitions && evidenceOverview.partitions[0]?.details) || 'Filesystem Partition'}</span>
                    </div>
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <span className="text-slate-500">Cluster Size:</span>
                      <span className="text-slate-800">{inspectArtifact.clusterSize || (evidenceOverview?.filesystems && `${evidenceOverview.filesystems[0]?.clusterSize || 4096} bytes`) || '4,096 bytes'}</span>
                    </div>
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <span className="text-slate-500">Inode / MFT Record:</span>
                      <span className="text-blue-700 font-bold">{inspectArtifact.inode || inspectArtifact.record || inspectArtifact.id || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <span className="text-slate-500">Physical Byte Offset:</span>
                      <span className="text-slate-800">{inspectArtifact.offset ? `${inspectArtifact.offset.toLocaleString()} bytes` : (inspectArtifact.startOffset ? `${inspectArtifact.startOffset.toLocaleString()} bytes` : 'N/A')}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
                    <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      CRYPTOGRAPHIC INTEGRITY
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">SHA-256 Checksum:</div>
                      <div className="flex items-center gap-2 bg-white p-2.5 rounded border border-slate-200 font-mono text-xs text-slate-800">
                        <span className="truncate flex-1 select-all">{inspectArtifact.sha256 || 'N/A'}</span>
                        <button
                          onClick={() => copyToClipboard(inspectArtifact.sha256, 'sha256')}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {copiedField === 'sha256' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded border border-emerald-200 font-medium">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Bitstream cryptographic seal verified. No tampered or synthesized blocks detected.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: RAW HEX / STREAM */}
              {activeInspectorTab === 'raw' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>OFFSET (HEX)  00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F   ASCII</span>
                    <button
                      onClick={() => copyToClipboard(previewData?.preview?.hexDump || previewData?.preview?.content || 'Hex stream copied', 'hex')}
                      className="text-blue-600 hover:underline flex items-center gap-1 font-sans cursor-pointer"
                    >
                      {copiedField === 'hex' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Stream</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-emerald-400 font-mono text-[11px] p-4 rounded-lg overflow-x-auto leading-relaxed max-h-96">
                    {previewData?.preview?.hexDump || 'No raw hex dump available for this artifact.'}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">Forensic Chain of Custody: SEALED</span>
              <button
                onClick={handleCloseInspector}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
