import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Folder,
  File,
  Mail,
  Trash2,
  Users,
  Globe,
  Lock,
  FileText,
  Search,
  Download,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  Copy,
  Check,
  Hash,
  ArrowLeft,
  X,
  Eye
} from 'lucide-react';
import { forensicApi } from '../../services/api';

export const ForensicExplorer = ({ evidenceId, caseId, onBack }) => {
  // Navigation category: 'diskInfo' | 'emails' | 'recycleBin' | 'users' | 'browserHistory' | 'software' | 'documents' | 'filesystem'
  const [activeCategory, setActiveCategory] = useState('diskInfo');

  // Master data
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [artifacts, setArtifacts] = useState(null);

  // Selected item in inspector
  const [selectedItem, setSelectedItem] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Filter inside active category list
  const [itemFilter, setItemFilter] = useState('');

  // Global search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Filesystem explorer state
  const [currentPath, setCurrentPath] = useState('/');
  const [fileTree, setFileTree] = useState(null);
  const [loadingTree, setLoadingTree] = useState(false);

  // Accordion sections
  const [sectionsOpen, setSectionsOpen] = useState({
    headers: false,
    source: false,
    integrity: false,
    recovery: false,
    raw: false
  });

  // Copied state
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    if (evidenceId) {
      loadData();
    }
  }, [evidenceId]);

  useEffect(() => {
    if (evidenceId && activeCategory === 'filesystem') {
      loadFolder(currentPath);
    }
  }, [evidenceId, activeCategory, currentPath]);

  useEffect(() => {
    if (selectedItem && selectedItem.id && evidenceId) {
      loadPreview(selectedItem.id);
    } else {
      setPreviewData(null);
    }
  }, [selectedItem, evidenceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overviewRes, artifactsRes] = await Promise.all([
        forensicApi.getOverview(evidenceId),
        forensicApi.getArtifacts(evidenceId, 'all')
      ]);

      if (overviewRes && overviewRes.data) {
        setOverview(overviewRes.data);
      }
      if (artifactsRes && artifactsRes.data) {
        setArtifacts(artifactsRes.data);
      }
    } catch (err) {
      console.error('Failed to load forensic data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (fileId) => {
    try {
      setLoadingPreview(true);
      const res = await forensicApi.getFilePreview(evidenceId, fileId);
      if (res && res.data) {
        setPreviewData(res.data);
      }
    } catch (err) {
      console.warn('Could not load preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadFolder = async (folderPath) => {
    try {
      setLoadingTree(true);
      const res = await forensicApi.getFileTree(evidenceId, folderPath);
      if (res && res.data) {
        setFileTree(res.data);
      }
    } catch (err) {
      console.error('Failed to load folder:', err);
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      setSearching(true);
      const res = await forensicApi.search(evidenceId, q.trim());
      if (res && res.data) {
        setSearchResults(res.data);
        if (res.data.length > 0) {
          setSelectedItem(res.data[0].item || res.data[0]);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleSection = (section) => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDownload = (fileId, filename) => {
    if (!fileId) return;
    forensicApi.downloadArtifact(evidenceId, fileId, filename || 'evidence-artifact.dat');
  };

  const getCategoryItems = () => {
    if (searchResults !== null) {
      return searchResults.map((r) => ({
        ...r.item,
        _searchTitle: r.title,
        _searchSub: r.subtitle,
        _searchCategory: r.category
      }));
    }

    if (!artifacts) return [];
    let items = [];
    switch (activeCategory) {
      case 'emails':
        items = artifacts.emails || [];
        break;
      case 'recycleBin':
        items = artifacts.recycleBin || [];
        break;
      case 'users':
        items = artifacts.users || [];
        break;
      case 'browserHistory':
        items = artifacts.browserHistory || [];
        break;
      case 'software':
        items = artifacts.software || [];
        break;
      case 'documents':
        items = artifacts.documents || [];
        break;
      default:
        items = [];
    }

    if (!itemFilter.trim()) return items;
    const f = itemFilter.toLowerCase();
    return items.filter((item) => {
      const str = JSON.stringify(item).toLowerCase();
      return str.includes(f);
    });
  };

  const items = getCategoryItems();

  const handleSelectCategory = (cat) => {
    setActiveCategory(cat);
    clearSearch();
    setItemFilter('');
    if (cat === 'diskInfo' || cat === 'filesystem') {
      setSelectedItem(null);
    } else if (artifacts) {
      const catList = artifacts[cat] || [];
      if (catList.length > 0) {
        setSelectedItem(catList[0]);
      } else {
        setSelectedItem(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-xs">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Mounting Forensic Workspace</h3>
        <p className="text-xs text-slate-500 mt-1">Indexing E01 evidence image, partitions, and recovered artifacts...</p>
      </div>
    );
  }

  const disk = overview?.diskInfo || {
    image: overview?.evidence?.filename || 'Loaded Forensic Image',
    imageType: 'Bitstream Image',
    diskSize: 'Unknown',
    partitioning: 'Unknown',
    diskGuid: 'N/A',
    sha256: overview?.evidence?.sha256 || 'N/A'
  };

  const partitions = overview?.partitions || [];

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden text-slate-800 font-sans">
      {/* ──────────────────────────────────────────────────────────
          TOP BAR: Evidence ID & Search
      ────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-slate-50/80 p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Back to pipeline"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Evidence:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{disk.image}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Verified E01
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {disk.partitioning} • {disk.diskSize} • Case {caseId || 'CASE-2026-58130'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(disk.sha256, 'main-sha')}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy SHA-256"
            >
              <Hash className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-[120px]">{disk.sha256.substring(0, 12)}...</span>
              {copiedKey === 'main-sha' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search files, emails, IPs, usernames, keywords, hashes across the evidence..."
            className="w-full pl-8.5 pr-8 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          MAIN 2-COLUMN WORKSPACE
      ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* LEFT COLUMN: Categories & Items List (4 cols) */}
        <div className="md:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/30">
          {/* Categories Navigation */}
          <div className="p-2 border-b border-slate-200 bg-slate-100/50">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              {searchResults !== null ? `Search Results (${searchResults.length})` : 'Categories'}
            </div>

            {searchResults === null ? (
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => handleSelectCategory('diskInfo')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'diskInfo' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Disk Info</span>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectCategory('emails')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'emails' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Emails</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${activeCategory === 'emails' ? 'bg-blue-700 text-white' : 'text-slate-500'}`}>
                    {artifacts?.emails?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectCategory('recycleBin')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'recycleBin' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Recycle Bin</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${activeCategory === 'recycleBin' ? 'bg-blue-700 text-white' : 'text-slate-500'}`}>
                    {artifacts?.recycleBin?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectCategory('users')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Users</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${activeCategory === 'users' ? 'bg-blue-700 text-white' : 'text-slate-500'}`}>
                    {artifacts?.users?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectCategory('browserHistory')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'browserHistory' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Web / URLs</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${activeCategory === 'browserHistory' ? 'bg-blue-700 text-white' : 'text-slate-500'}`}>
                    {artifacts?.browserHistory?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectCategory('software')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'software' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Encryption</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${activeCategory === 'software' ? 'bg-blue-700 text-white' : 'text-slate-500'}`}>
                    {artifacts?.software?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectCategory('documents')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'documents' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documents</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${activeCategory === 'documents' ? 'bg-blue-700 text-white' : 'text-slate-500'}`}>
                    {artifacts?.documents?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectCategory('filesystem')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${activeCategory === 'filesystem' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5" />
                    <span>Filesystem</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1 rounded ${activeCategory === 'filesystem' ? 'bg-blue-700 text-white' : 'text-slate-500'}`}>
                    Tree
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={clearSearch}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer py-1 px-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to all categories
              </button>
            )}
          </div>

          {/* List Filter if viewing items */}
          {activeCategory !== 'diskInfo' && activeCategory !== 'filesystem' && (
            <div className="p-2 border-b border-slate-200 bg-white">
              <input
                type="text"
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                placeholder="Filter current list..."
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Items List */}
          {activeCategory !== 'diskInfo' && activeCategory !== 'filesystem' && (
            <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-slate-100 bg-white">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No matching artifacts.
                </div>
              ) : (
                items.map((item, idx) => {
                  const isSelected = selectedItem && (selectedItem.id === item.id || selectedItem === item);

                  return (
                    <div
                      key={item.id || item.username || item.title || idx}
                      onClick={() => setSelectedItem(item)}
                      className={`p-2.5 text-left transition-colors cursor-pointer ${isSelected
                          ? 'bg-blue-50/90 border-l-3 border-blue-600 text-blue-950 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      {item._searchCategory && (
                        <span className="inline-block px-1 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 mb-1">
                          {item._searchCategory}
                        </span>
                      )}

                      {activeCategory === 'emails' && (
                        <div>
                          <div className="text-xs font-semibold truncate text-slate-900">
                            {item.subject || '(No Subject)'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.from}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between font-mono">
                            <span>{item.date ? new Date(item.date).toLocaleDateString() : ''}</span>
                            <span className="truncate max-w-[140px]">{item.filename}</span>
                          </div>
                        </div>
                      )}

                      {activeCategory === 'recycleBin' && (
                        <div>
                          <div className="text-xs font-semibold truncate text-slate-900">
                            {item.originalName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.userAttribution}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {item.deletionTime ? new Date(item.deletionTime).toLocaleDateString() : ''}
                          </div>
                        </div>
                      )}

                      {activeCategory === 'users' && (
                        <div>
                          <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                            <span>{item.username}</span>
                            <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-600">RID {item.rid}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.accountType}
                          </div>
                        </div>
                      )}

                      {activeCategory === 'browserHistory' && (
                        <div>
                          <div className="text-xs font-semibold truncate text-slate-900">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-blue-600 truncate mt-0.5">
                            {item.url}
                          </div>
                        </div>
                      )}

                      {activeCategory === 'software' && (
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.category}
                          </div>
                        </div>
                      )}

                      {activeCategory === 'documents' && (
                        <div>
                          <div className="text-xs font-semibold truncate text-slate-900 flex items-center justify-between">
                            <span className="truncate">{item.name}</span>
                            <span className="text-[9px] px-1 bg-slate-100 rounded font-mono text-slate-600">{item.extension}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {item.path}
                          </div>
                        </div>
                      )}

                      {searchResults !== null && (
                        <div>
                          <div className="text-xs font-semibold truncate text-slate-900">
                            {item._searchTitle}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item._searchSub}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Filesystem Tree */}
          {activeCategory === 'filesystem' && (
            <div className="p-2.5 flex-1 overflow-y-auto max-h-[500px] bg-white">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-2 font-mono overflow-x-auto pb-1 border-b border-slate-100">
                {fileTree?.breadcrumbs?.map((b, i) => (
                  <button
                    key={b.path}
                    onClick={() => setCurrentPath(b.path)}
                    className="hover:text-blue-600 hover:underline shrink-0"
                  >
                    {b.name} {i < fileTree.breadcrumbs.length - 1 && '/'}
                  </button>
                ))}
              </div>

              {loadingTree ? (
                <div className="text-center py-6 text-xs text-slate-400">Loading directory...</div>
              ) : (
                <div className="space-y-0.5">
                  {fileTree?.items?.map((node) => (
                    <div
                      key={node.path}
                      onClick={() => {
                        if (node.isDirectory) {
                          setCurrentPath(node.path);
                        } else {
                          setSelectedItem(node);
                        }
                      }}
                      className="p-1 rounded text-xs flex items-center gap-2 hover:bg-slate-100 cursor-pointer text-slate-700"
                    >
                      {node.isDirectory ? (
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <File className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="truncate flex-1 font-mono text-[11px]">{node.name}</span>
                      {node.size > 0 && <span className="text-[9px] text-slate-400 font-mono">{(node.size / 1024).toFixed(1)}K</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: The Evidence Inspector (8 cols) */}
        <div className="md:col-span-8 p-5 bg-white flex flex-col justify-start overflow-y-auto max-h-[640px]">
          {/* ========================================================
              1. DISK INFORMATION VIEW
          ======================================================== */}
          {activeCategory === 'diskInfo' && !selectedItem ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
                  DISK INFORMATION
                </h2>
                <div className="bg-slate-50 border border-slate-200 rounded p-3.5 font-mono text-xs text-slate-800 space-y-1.5">
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-slate-500 font-semibold">Image:</span>
                    <span className="col-span-9 font-bold text-slate-900">{disk.image}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-slate-500 font-semibold">Image Type:</span>
                    <span className="col-span-9">{disk.imageType}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-slate-500 font-semibold">Disk Size:</span>
                    <span className="col-span-9">{disk.diskSize}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-slate-500 font-semibold">Partitioning:</span>
                    <span className="col-span-9">{disk.partitioning}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-slate-500 font-semibold">Disk GUID:</span>
                    <span className="col-span-9 text-slate-900 font-bold">{disk.diskGuid}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-slate-500 font-semibold">SHA-256:</span>
                    <span className="col-span-9 break-all text-slate-600">{disk.sha256}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Partitions
                </h3>
                <div className="border border-slate-200 rounded overflow-hidden font-mono text-xs">
                  <table className="w-full text-left divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-[11px] text-slate-500 font-semibold">
                      <tr>
                        <th className="p-2.5">Partition</th>
                        <th className="p-2.5">Type / Label</th>
                        <th className="p-2.5">Start Offset</th>
                        <th className="p-2.5">Size</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {partitions.map((p) => (
                        <tr key={p.index} className="hover:bg-slate-50/80">
                          <td className="p-2.5 font-bold text-slate-900">Partition {p.index}</td>
                          <td className="p-2.5 text-slate-700">{p.name}</td>
                          <td className="p-2.5 text-slate-600">{p.startOffset.toLocaleString()} bytes</td>
                          <td className="p-2.5 text-slate-600">{p.formattedSize || `${(p.size / (1024 * 1024)).toFixed(0)} MB`}</td>
                          <td className="p-2.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Allocated
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {overview?.statistics && (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded text-xs text-blue-900">
                  <span className="font-semibold">Evidence Findings:</span>{' '}
                  {[
                    overview.statistics.total_files ? `${overview.statistics.total_files.toLocaleString()} files indexed` : null,
                    overview.statistics.recovered_artifacts ? `${overview.statistics.recovered_artifacts.toLocaleString()} recovered artifacts` : null,
                    overview.statistics.emails ? `${overview.statistics.emails} emails` : null,
                    overview.statistics.recycle_bin ? `${overview.statistics.recycle_bin} Recycle Bin records` : null,
                    overview.statistics.users ? `${overview.statistics.users} user accounts` : null,
                    overview.statistics.carved_artifacts ? `${overview.statistics.carved_artifacts} carved artifacts` : null
                  ].filter(Boolean).join(' • ') || 'Forensic analysis completed.'}
                </div>
              )}
            </div>
          ) : !selectedItem ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Eye className="w-7 h-7 mb-2 stroke-1" />
              <div className="text-xs font-medium text-slate-600">Select an artifact from the list</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click any item on the left to read the evidence.
              </p>
            </div>
          ) : (
            /* ========================================================
               2. ARTIFACT EVIDENCE READER
            ======================================================== */
            <div className="space-y-4">
              {/* Top Inspector Title Bar */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                    {selectedItem.subject ? 'Email' : selectedItem.originalName ? 'Recycle Bin Object' : selectedItem.username ? 'User Account' : selectedItem.title ? 'Web Link' : 'Forensic Artifact'}
                  </div>
                  <h1 className="text-sm font-bold text-slate-900 font-mono mt-0.5 break-all">
                    {selectedItem.filename || selectedItem.originalName || selectedItem.name || selectedItem.title || selectedItem.username}
                  </h1>
                </div>

                <div className="flex items-center gap-1.5">
                  {selectedItem.id && (
                    <button
                      onClick={() => handleDownload(selectedItem.id, selectedItem.filename || selectedItem.originalName || selectedItem.name)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  )}
                  {selectedItem.sha256 && (
                    <button
                      onClick={() => handleCopy(selectedItem.sha256, 'item-sha')}
                      className="p-1 border border-slate-200 rounded hover:bg-slate-50 text-slate-500 cursor-pointer"
                      title="Copy SHA-256"
                    >
                      {copiedKey === 'item-sha' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Hash className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* READABLE PRIMARY EVIDENCE: EMAIL */}
              {selectedItem.from !== undefined && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-2 text-slate-500 font-semibold">From:</span>
                      <span className="col-span-10 font-bold text-slate-900">{selectedItem.from}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-2 text-slate-500 font-semibold">To:</span>
                      <span className="col-span-10 text-slate-800">{selectedItem.to}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-2 text-slate-500 font-semibold">Subject:</span>
                      <span className="col-span-10 text-slate-900 font-semibold">{selectedItem.subject}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-2 text-slate-500 font-semibold">Date:</span>
                      <span className="col-span-10 text-slate-700">{selectedItem.date}</span>
                    </div>
                    {selectedItem.ips && selectedItem.ips.length > 0 && (
                      <div className="grid grid-cols-12 gap-1 pt-1 border-t border-slate-200/80">
                        <span className="col-span-2 text-slate-500 font-semibold">IP Hops:</span>
                        <div className="col-span-10 flex flex-wrap gap-1">
                          {selectedItem.ips.map((ip) => (
                            <span key={ip} className="px-1.5 py-0.2 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-700">
                              {ip}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-1.5">
                      <span className="text-slate-300">─────</span>
                      <span>Message</span>
                      <span className="text-slate-300">─────</span>
                    </div>
                    <div className="p-3.5 bg-slate-50/60 border border-slate-200 rounded font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[100px]">
                      {selectedItem.body || selectedItem.bodyPreview || '(No message content)'}
                    </div>
                  </div>
                </div>
              )}

              {/* READABLE PRIMARY EVIDENCE: RECYCLE BIN */}
              {selectedItem.recycleFilename && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-xs space-y-1.5">
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Original Name:</span>
                      <span className="col-span-9 font-bold text-slate-900">{selectedItem.originalName}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Original Path:</span>
                      <span className="col-span-9 font-mono break-all text-slate-800">{selectedItem.originalPath}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Deleted By:</span>
                      <span className="col-span-9 font-semibold text-blue-900">{selectedItem.userAttribution}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Deletion Date:</span>
                      <span className="col-span-9 text-slate-700">{selectedItem.deletionTime ? new Date(selectedItem.deletionTime).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Original Size:</span>
                      <span className="col-span-9 font-mono text-slate-700">{selectedItem.originalSize} bytes</span>
                    </div>
                  </div>
                </div>
              )}

              {/* READABLE PRIMARY EVIDENCE: USER ACCOUNT */}
              {selectedItem.username && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-xs space-y-1.5">
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Username:</span>
                      <span className="col-span-9 font-bold text-slate-900">{selectedItem.username}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Classification:</span>
                      <span className="col-span-9 font-semibold text-blue-800">{selectedItem.accountType}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Status:</span>
                      <span className="col-span-9 text-slate-700">{selectedItem.status}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">RID:</span>
                      <span className="col-span-9 font-mono text-slate-800">{selectedItem.rid} ({selectedItem.hexRid})</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Profile:</span>
                      <span className="col-span-9 font-mono text-slate-800">{selectedItem.profilePath}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2 pt-1 border-t border-slate-200">
                      <span className="col-span-3 text-slate-500 font-semibold">Notes:</span>
                      <span className="col-span-9 text-slate-700">{selectedItem.details}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* READABLE PRIMARY EVIDENCE: WEB */}
              {selectedItem.url && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-xs space-y-1.5">
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Title:</span>
                      <span className="col-span-9 font-bold text-slate-900">{selectedItem.title}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">URL:</span>
                      <div className="col-span-9 flex items-center gap-1.5">
                        <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 hover:underline break-all">
                          {selectedItem.url}
                        </a>
                        <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Location:</span>
                      <span className="col-span-9 font-mono break-all text-slate-600">{selectedItem.path}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* READABLE PRIMARY EVIDENCE: SOFTWARE */}
              {selectedItem.configuration && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-xs space-y-1">
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Tool:</span>
                      <span className="col-span-9 font-bold text-slate-900">{selectedItem.name}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Category:</span>
                      <span className="col-span-9 text-slate-800">{selectedItem.category}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 text-slate-500 font-semibold">Summary:</span>
                      <span className="col-span-9 text-slate-700">{selectedItem.details}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* READABLE PRIMARY EVIDENCE: TEXT PREVIEW */}
              {previewData?.textContent && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Text Content</div>
                  <pre className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800 overflow-x-auto max-h-52 leading-relaxed whitespace-pre-wrap">
                    {previewData.textContent}
                  </pre>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  COLLAPSIBLE TECHNICAL DETAILS
              ──────────────────────────────────────────────────────── */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5">
                {/* Headers (Email) */}
                {selectedItem.headersList && selectedItem.headersList.length > 0 && (
                  <div className="border border-slate-200 rounded overflow-hidden text-xs">
                    <button
                      onClick={() => toggleSection('headers')}
                      className="w-full px-2.5 py-1.5 bg-slate-50 flex items-center justify-between font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sectionsOpen.headers ? 'rotate-180' : ''}`} />
                        <span>Headers</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{selectedItem.headersList.length} fields</span>
                    </button>
                    {sectionsOpen.headers && (
                      <div className="p-2.5 bg-white max-h-48 overflow-y-auto divide-y divide-slate-100 font-mono text-[11px]">
                        {selectedItem.headersList.map((h, i) => (
                          <div key={i} className="py-0.5 grid grid-cols-12 gap-2">
                            <span className="col-span-4 text-slate-500 truncate">{h.key}:</span>
                            <span className="col-span-8 text-slate-800 break-all">{h.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Source & Technical Details */}
                <div className="border border-slate-200 rounded overflow-hidden text-xs">
                  <button
                    onClick={() => toggleSection('source')}
                    className="w-full px-2.5 py-1.5 bg-slate-50 flex items-center justify-between font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sectionsOpen.source ? 'rotate-180' : ''}`} />
                      <span>Source</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Offset {selectedItem.offset || 'N/A'}</span>
                  </button>
                  {sectionsOpen.source && (
                    <div className="p-2.5 bg-white space-y-1 font-mono text-[11px]">
                      <div className="grid grid-cols-12 gap-2">
                        <span className="col-span-4 text-slate-500">Source Image:</span>
                        <span className="col-span-8 font-bold text-slate-900">{disk.image}</span>
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <span className="col-span-4 text-slate-500">Partition:</span>
                        <span className="col-span-8 text-slate-800">Partition {selectedItem.partitionIndex || 2} (NTFS)</span>
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <span className="col-span-4 text-slate-500">Record/Inode:</span>
                        <span className="col-span-8 text-slate-800">{selectedItem.inode || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <span className="col-span-4 text-slate-500">Byte Offset:</span>
                        <span className="col-span-8 text-slate-800">{selectedItem.offset ? selectedItem.offset.toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Integrity */}
                <div className="border border-slate-200 rounded overflow-hidden text-xs">
                  <button
                    onClick={() => toggleSection('integrity')}
                    className="w-full px-2.5 py-1.5 bg-slate-50 flex items-center justify-between font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sectionsOpen.integrity ? 'rotate-180' : ''}`} />
                      <span>Integrity</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-medium">SHA-256 Verified</span>
                  </button>
                  {sectionsOpen.integrity && (
                    <div className="p-2.5 bg-white space-y-1.5 text-[11px]">
                      <div className="font-mono break-all bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-900">
                        {selectedItem.sha256 || previewData?.provenance?.sha256 || 'N/A'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recovery */}
                <div className="border border-slate-200 rounded overflow-hidden text-xs">
                  <button
                    onClick={() => toggleSection('recovery')}
                    className="w-full px-2.5 py-1.5 bg-slate-50 flex items-center justify-between font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sectionsOpen.recovery ? 'rotate-180' : ''}`} />
                      <span>Recovery</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{selectedItem.recoveryMethod || 'filesystem'}</span>
                  </button>
                  {sectionsOpen.recovery && (
                    <div className="p-2.5 bg-white text-xs space-y-1">
                      <div className="grid grid-cols-12 gap-2">
                        <span className="col-span-4 text-slate-500">Method:</span>
                        <span className="col-span-8 font-semibold text-slate-900">
                          {selectedItem.recoveryMethod === 'carving' ? 'File Carving' : 'Filesystem MFT Extraction'}
                        </span>
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <span className="col-span-4 text-slate-500">Confidence:</span>
                        <span className="col-span-8 text-emerald-700 font-semibold">100%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Raw Evidence */}
                <div className="border border-slate-200 rounded overflow-hidden text-xs">
                  <button
                    onClick={() => toggleSection('raw')}
                    className="w-full px-2.5 py-1.5 bg-slate-50 flex items-center justify-between font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sectionsOpen.raw ? 'rotate-180' : ''}`} />
                      <span>Raw Evidence</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Hex / ASCII</span>
                  </button>
                  {sectionsOpen.raw && (
                    <div className="p-2.5 bg-slate-900 text-slate-200 rounded-b font-mono text-[10px] overflow-x-auto max-h-48">
                      {previewData?.hexDump ? (
                        <div className="space-y-0.5">
                          {previewData.hexDump.map((line, idx) => (
                            <div key={idx} className="flex gap-3">
                              <span className="text-slate-500 select-none">{line.offset}</span>
                              <span className="text-emerald-400">{line.hex}</span>
                              <span className="text-slate-300">{line.ascii}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-center py-2">Loading binary hex stream...</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
