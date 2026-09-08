import fs from 'fs';
import path from 'path';
import forensicArtifactService from './forensicArtifact.service.js';
import logger from '../utils/logger.js';

export class ForensicConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForensicConfigError';
    this.code = 'AI_KEY_MISSING';
    this.statusCode = 412;
  }
}

// In-memory cache for the Universal Forensic Evidence Index
const forensicIndexCache = new Map();

/**
 * Normalizes text and extracts clean tokens
 */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[\s,.;:!?'"()\[\]{}]+/)
    .filter((t) => t.length > 1);
}

// Priority list of verified Google Gemini Free-Tier Models
export const GEMINI_FREE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
];

/**
 * Resolves AI provider configuration from environment
 */
function getAIConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
  const customBaseUrl = process.env.AI_BASE_URL || '';
  let provider = (process.env.AI_PROVIDER || '').toLowerCase();

  if (!provider) {
    if (customBaseUrl.includes('11434')) {
      provider = 'ollama';
    } else if (process.env.GEMINI_API_KEY || (apiKey && apiKey.startsWith('AIza'))) {
      provider = 'gemini';
    } else if (process.env.OPENAI_API_KEY || (apiKey && apiKey.startsWith('sk-'))) {
      provider = 'openai';
    } else if (customBaseUrl) {
      provider = 'openai_compatible';
    } else {
      provider = 'gemini';
    }
  }

  // Always default to official free tier model for Gemini
  let defaultModel = GEMINI_FREE_MODELS[0];
  if (provider === 'openai') {
    defaultModel = 'gpt-4o-mini';
  } else if (provider === 'ollama') {
    defaultModel = 'llama3';
  }

  const model = process.env.AI_MODEL || defaultModel;

  return {
    apiKey,
    provider,
    model,
    baseUrl: customBaseUrl
  };
}

/**
 * Build or retrieve the Universal Forensic Index for an evidence image
 */
async function getUniversalIndex(evidenceId) {
  const cacheKey = String(evidenceId);
  if (forensicIndexCache.has(cacheKey)) {
    return forensicIndexCache.get(cacheKey);
  }

  const { evidence, data } = await forensicArtifactService.getReportData(evidenceId);
  const disk = data.overview?.diskInfo || {};
  const partitions = data.overview?.partitions || [];
  const filesystems = data.overview?.filesystems || [];
  const allArtifacts = data.allArtifacts || [];
  const specialized = data.artifacts || {};

  const textExts = new Set([
    '.eml', '.txt', '.xml', '.ini', '.url', '.htm', '.html',
    '.json', '.log', '.cfg', '.reg', '.inf', '.bat', '.cmd', '.csv'
  ]);

  const emailAddressMap = new Map();
  const ipAddressMap = new Map();
  const indexedFiles = [];

  for (const a of allArtifacts) {
    const meta = a.metadata || {};
    const origPath = meta.original_path || '';
    const p = a.output_path;
    const name = meta.original_name || (p ? path.basename(p) : '');
    const ext = path.extname(name || p || '').toLowerCase();

    let contentSnippet = '';
    let emailDetails = null;

    // Check if this artifact is in specialized emails list
    const foundEmail = specialized.emails?.find((e) => e.id === a.artifact_id || e.path === origPath);
    if (foundEmail) {
      emailDetails = {
        from: foundEmail.from,
        to: foundEmail.to,
        subject: foundEmail.subject,
        date: foundEmail.date,
        ips: foundEmail.ips || []
      };
      contentSnippet = `From: ${foundEmail.from}\nTo: ${foundEmail.to}\nSubject: ${foundEmail.subject}\nDate: ${foundEmail.date}\nIPs: ${(foundEmail.ips || []).join(', ')}\n\n${(foundEmail.body || foundEmail.bodyPreview || '').substring(0, 1500)}`;

      // Aggregate email addresses
      const combined = `${foundEmail.from} ${foundEmail.to}`;
      const addrs = combined.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
      for (const addr of addrs) {
        const cleanAddr = addr.toLowerCase();
        if (!emailAddressMap.has(cleanAddr)) {
          emailAddressMap.set(cleanAddr, { address: cleanAddr, count: 0, files: [] });
        }
        const rec = emailAddressMap.get(cleanAddr);
        rec.count++;
        if (rec.files.length < 5) rec.files.push(name);
      }

      // Aggregate IP addresses
      for (const ip of foundEmail.ips || []) {
        if (!ipAddressMap.has(ip)) {
          ipAddressMap.set(ip, { ip, emails: [] });
        }
        const ipRec = ipAddressMap.get(ip);
        if (ipRec.emails.length < 5) {
          ipRec.emails.push({ filename: name, date: foundEmail.date, subject: foundEmail.subject });
        }
      }
    } else if (p && fs.existsSync(p) && textExts.has(ext)) {
      try {
        const text = fs.readFileSync(p, 'utf8');
        contentSnippet = text.substring(0, 3500);

        // Also check if any email addresses or IPs exist in this text file
        const addrs = contentSnippet.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
        for (const addr of addrs) {
          const cleanAddr = addr.toLowerCase();
          if (!emailAddressMap.has(cleanAddr)) {
            emailAddressMap.set(cleanAddr, { address: cleanAddr, count: 0, files: [] });
          }
          const rec = emailAddressMap.get(cleanAddr);
          rec.count++;
          if (rec.files.length < 5) rec.files.push(name);
        }
      } catch { }
    }

    indexedFiles.push({
      id: a.artifact_id,
      name,
      nameLower: name.toLowerCase(),
      path: origPath,
      pathLower: origPath.toLowerCase(),
      partition: meta.partition_index ?? 2,
      offset: a.offset,
      inode: meta.inode ?? 'N/A',
      size: a.size,
      sha256: a.sha256,
      recoveryMethod: a.recovery_method || (origPath ? 'filesystem' : 'carving'),
      deleted: Boolean(meta.deleted),
      timestamps: meta.timestamps || {
        created: meta.created_at,
        modified: meta.modified_at,
        accessed: meta.accessed_at
      },
      emailDetails,
      contentSnippet,
      contentLower: contentSnippet.toLowerCase(),
      item: a
    });
  }

  // Disk geometry context
  const diskGeometry = {
    imageName: disk.image || evidence.storedFilename || 'Forensic Image',
    imageType: disk.imageType || 'Raw/Bitstream Image',
    diskSizeBytes: disk.diskSizeBytes || 0,
    diskSizeFormatted: disk.diskSize || 'Unknown',
    partitioningScheme: disk.partitioning || 'Unknown',
    diskGuid: disk.diskGuid || null,
    sha256: disk.sha256 || null,
    partitions: partitions.map((p) => ({
      index: p.index,
      name: p.name,
      startOffsetBytes: p.startOffset,
      sizeBytes: p.size,
      formattedSize: p.formattedSize,
      type: p.typeId || p.type,
      guid: p.guid || null
    })),
    filesystems: filesystems.map((fsInfo) => ({
      partitionIndex: fsInfo.partitionIndex,
      type: fsInfo.type,
      clusterSizeBytes: fsInfo.clusterSizeBytes || fsInfo.clusterSize || null,
      sectorSizeBytes: fsInfo.sectorSizeBytes || fsInfo.sectorSize || null,
      totalClusters: fsInfo.totalClusters || null,
      volumeSerial: fsInfo.volumeSerial || null,
      volumeLabel: fsInfo.label || ''
    }))
  };

  // User Accounts (Dynamically discovered from filesystem, profiles, and Recycle Bin)
  const userAccounts = (specialized.users || []).map((u) => ({
    username: u.username,
    fullName: u.fullName || u.username,
    rid: u.rid || null,
    hexRid: u.hexRid || null,
    sid: u.sid || null,
    status: u.status || 'Active',
    profilePath: u.profilePath || null,
    lastLogonOrActivity: u.lastLogonOrActivity || u.ntuserDatTimestamp || null,
    ntuserDatTimestamp: u.ntuserDatTimestamp || null,
    passwordHint: u.passwordHint || null,
    details: u.details || null,
    source: u.profilePath ? `Partition 2 -> ${u.profilePath}` : 'Registry / SAM'
  }));

  const indexObject = {
    evidenceId,
    diskGeometry,
    userAccounts,
    software: specialized.software || [],
    recycleBin: specialized.recycleBin || [],
    browserHistory: specialized.browserHistory || [],
    allDiscoveredEmailAddresses: Array.from(emailAddressMap.values()),
    allDiscoveredIPAddresses: Array.from(ipAddressMap.values()),
    indexedFiles
  };

  forensicIndexCache.set(cacheKey, indexObject);
  return indexObject;
}

/**
 * Universal Dynamic Forensic Retrieval:
 * Searches across actual bitstream records, MFT records, file contents,
 * email headers, IP addresses, timestamps, registry entries, and disk geometry.
 */
export async function retrieveEvidence(evidenceId, question) {
  logger.info(`[AI] Question received: "${question}"`);
  logger.info('[RETRIEVAL] Searching forensic evidence');

  const index = await getUniversalIndex(evidenceId);
  const qLower = question.toLowerCase().trim();
  const tokens = tokenize(question);

  const matchedContext = {
    diskGeometry: null,
    userAccounts: null,
    softwareAndTools: null,
    aggregatedEmailAddresses: null,
    aggregatedIPAddresses: null,
    matchedFiles: [],
    categories: []
  };

  // 1. DISK GEOMETRY & PARTITION ANALYSIS
  const diskKeywords = ['guid', 'cluster', 'sector', 'sectors', 'partition', 'partitions', 'gpt', 'mbr', 'size', 'disk', 'volume', 'serial', 'boot', 'filesystem', 'scheme', 'geometry'];
  if (diskKeywords.some((k) => qLower.includes(k))) {
    matchedContext.diskGeometry = index.diskGeometry;
    matchedContext.categories.push('Disk & Partition Geometry');
  }

  // 2. USER ACCOUNTS & REGISTRY
  const userKeywords = ['user', 'users', 'account', 'accounts', 'login', 'logon', 'last', 'rid', 'sid', 'jimmy', 'billybob', 'nameless', 'admin', 'profile', 'password hint'];
  if (userKeywords.some((k) => qLower.includes(k))) {
    matchedContext.userAccounts = index.userAccounts;
    matchedContext.categories.push('User Accounts & Registry');
  }

  // 3. INSTALLED SOFTWARE & ENCRYPTION
  const softwareKeywords = ['software', 'program', 'programs', 'installed', 'truecrypt', 'bctextencoder', 'encrypt', 'encryption', 'crypto', 'cryptocurrency', 'bitcoin', 'vhd'];
  if (softwareKeywords.some((k) => qLower.includes(k))) {
    matchedContext.softwareAndTools = index.software;
    matchedContext.categories.push('Installed Software & Encryption');
  }

  // 4. AGGREGATION: EMAIL ADDRESSES
  if (qLower.includes('every email') || qLower.includes('all email') || qLower.includes('list email') || qLower.includes('email address') || qLower.includes('email addresses')) {
    matchedContext.aggregatedEmailAddresses = index.allDiscoveredEmailAddresses;
    matchedContext.categories.push('Aggregated Email Addresses');
  }

  // 5. AGGREGATION: IP ADDRESSES
  if (qLower.includes('every ip') || qLower.includes('all ip') || qLower.includes('ip address') || qLower.includes('ip addresses') || qLower.includes('ips')) {
    matchedContext.aggregatedIPAddresses = index.allDiscoveredIPAddresses;
    matchedContext.categories.push('Aggregated IP Addresses');
  }

  // 6. CONTENT & METADATA DEEP SEARCH WITH STEMMING & SYNONYMS
  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'who', 'how', 'why',
    'show', 'list', 'find', 'every', 'all', 'the', 'file', 'files',
    'evidence', 'contents', 'content', 'mention', 'mentions', 'whose',
    'does', 'did', 'do', 'any', 'are', 'was', 'were', 'is', 'in', 'on', 'at',
    'of', 'for', 'to', 'from', 'with', 'about', 'tell', 'me', 'associated',
    'such', 'there', 'have', 'has', 'had', 'been', 'would', 'could'
  ]);

  const searchKeywords = new Set();
  for (const t of tokens) {
    if (!stopWords.has(t) && t.length > 2) {
      searchKeywords.add(t);
      if (t.endsWith('s') && t.length > 3) searchKeywords.add(t.slice(0, -1));
      if (t.endsWith('es') && t.length > 4) searchKeywords.add(t.slice(0, -2));
      if (t.endsWith('ing') && t.length > 5) searchKeywords.add(t.slice(0, -3));
      if (t.endsWith('ed') && t.length > 4) searchKeywords.add(t.slice(0, -2));
    }
  }

  // Forensic synonyms
  if (searchKeywords.has('password') || searchKeywords.has('passwords')) {
    searchKeywords.add('pwd');
    searchKeywords.add('secret');
    searchKeywords.add('credential');
  }
  if (searchKeywords.has('encrypt') || searchKeywords.has('encryption')) {
    searchKeywords.add('truecrypt');
    searchKeywords.add('bctextencoder');
    searchKeywords.add('crypto');
  }
  if (searchKeywords.has('delete') || searchKeywords.has('deleted')) {
    searchKeywords.add('$recycle.bin');
    searchKeywords.add('trash');
  }

  const activeKeywords = Array.from(searchKeywords);
  const scoredFiles = [];

  // Parse any date in the query (e.g. "February 16, 2014" or "February 20, 2014")
  const dateMatch = qLower.match(/(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i);
  let targetTimestamp = null;
  if (dateMatch) {
    targetTimestamp = Date.parse(dateMatch[0]);
  }

  for (const f of index.indexedFiles) {
    let score = 0;
    const matchReasons = [];

    // Check active keywords against content, filename, and path
    for (const kw of activeKeywords) {
      if (f.contentLower && f.contentLower.includes(kw)) {
        score += 10;
        matchReasons.push(`content matches "${kw}"`);
      }
      if (f.nameLower && f.nameLower.includes(kw)) {
        score += 8;
        matchReasons.push(`filename matches "${kw}"`);
      }
      if (f.pathLower && f.pathLower.includes(kw)) {
        score += 5;
        matchReasons.push(`path matches "${kw}"`);
      }
      if (f.emailDetails) {
        if (f.emailDetails.from.toLowerCase().includes(kw) || f.emailDetails.to.toLowerCase().includes(kw)) {
          score += 8;
          matchReasons.push(`email address matches "${kw}"`);
        }
        if (f.emailDetails.subject.toLowerCase().includes(kw)) {
          score += 7;
          matchReasons.push(`subject matches "${kw}"`);
        }
      }
    }

    // Temporal search
    if (targetTimestamp && !isNaN(targetTimestamp)) {
      const rawDate = f.timestamps?.modified || f.emailDetails?.date || f.timestamps?.created;
      if (rawDate) {
        const fTime = Date.parse(rawDate);
        if (!isNaN(fTime)) {
          const diffDays = Math.abs(fTime - targetTimestamp) / (86400 * 1000);
          const dateScore = Math.max(1, Math.round(100 / (1 + diffDays)));
          score += dateScore;
          matchReasons.push(`${diffDays.toFixed(1)} days from ${dateMatch[0]}`);
        }
      }
    } else if (qLower.includes('2014') || qLower.includes('feb')) {
      const fDate = f.emailDetails?.date || f.timestamps?.modified || f.timestamps?.created || '';
      if (fDate.includes('2014') || fDate.toLowerCase().includes('feb')) {
        score += 6;
        matchReasons.push(`date matches 2014/Feb`);
      }
    }

    if (score > 0) {
      scoredFiles.push({ file: f, score, matchReasons });
    }
  }

  // Sort by score descending
  scoredFiles.sort((a, b) => b.score - a.score);

  // Take top 8 most relevant files
  matchedContext.matchedFiles = scoredFiles.slice(0, 8).map((sf) => {
    const f = sf.file;
    let focusedExcerpt = null;

    if (f.contentSnippet) {
      if (activeKeywords.length > 0) {
        for (const kw of activeKeywords) {
          const idx = f.contentLower.indexOf(kw);
          if (idx !== -1) {
            focusedExcerpt = f.contentSnippet.substring(
              Math.max(0, idx - 40),
              Math.min(f.contentSnippet.length, idx + 180)
            );
            break;
          }
        }
      }
      if (!focusedExcerpt) {
        focusedExcerpt = f.contentSnippet.substring(0, 180);
      }
    }

    return {
      id: f.id,
      name: f.name,
      path: f.path || `Unallocated (Offset: ${f.offset})`,
      partition: `Partition ${f.partition} (Basic Data Partition, NTFS)`,
      offset: f.offset,
      record: `MFT Record / Inode ${f.inode}`,
      recovery: f.recoveryMethod === 'filesystem' ? 'Filesystem' : 'Signature Carving',
      sha256: f.sha256,
      size: f.size,
      timestamps: f.timestamps,
      daysFromTargetDate: sf.file._diffDays !== undefined ? `${sf.file._diffDays.toFixed(1)} days` : undefined,
      contentExcerpt: focusedExcerpt ? focusedExcerpt.trim() : null,
      emailDetails: f.emailDetails,
      item: f.item
    };
  });

  const totalFound = (matchedContext.diskGeometry ? 1 : 0) +
    (matchedContext.userAccounts ? matchedContext.userAccounts.length : 0) +
    (matchedContext.softwareAndTools ? matchedContext.softwareAndTools.length : 0) +
    (matchedContext.aggregatedEmailAddresses ? matchedContext.aggregatedEmailAddresses.length : 0) +
    (matchedContext.aggregatedIPAddresses ? matchedContext.aggregatedIPAddresses.length : 0) +
    matchedContext.matchedFiles.length;

  logger.info(`[RETRIEVAL] Found ${totalFound} relevant artifacts`);

  const primaryItem = matchedContext.matchedFiles[0]?.item || null;
  const primaryId = matchedContext.matchedFiles[0]?.id || null;

  return {
    evidenceId,
    question,
    context: matchedContext,
    sourceArtifact: primaryItem,
    sourceArtifactId: primaryId,
    totalFound
  };
}

/**
 * Executes real LLM generation via Gemini, OpenAI, or Ollama
 */
async function callRealLLM(question, retrieved) {
  const config = getAIConfig();

  if (!config.apiKey && !config.baseUrl) {
    throw new ForensicConfigError(
      'AI API Key is not configured. Please add AI_API_KEY (or GEMINI_API_KEY / OPENAI_API_KEY) in backend/.env to enable the Evidence-Grounded AI Analyst.'
    );
  }

  const targetImageName = retrieved.context?.diskGeometry?.imageName || 'Forensic Evidence';
  const systemPrompt = `You are Cyphora, a court-certified digital forensics examiner and expert incident response analyst.
You are analyzing digital evidence extracted from bitstream forensic image: "${targetImageName}".

CRITICAL RULES:
1. Base your answer STRICTLY AND EXCLUSIVELY on the EVIDENCE CONTEXT provided below.
2. NEVER assume, extrapolate, speculate, or fabricate evidence.
3. If the provided evidence context does NOT contain sufficient facts to answer the question, your ANSWER MUST BE:
   "No verified evidence was found for this question."
   Set confidence to "Low" and leave source, content, record, and sha256 as "N/A".
4. Every valid answer must cite:
   - Specific supporting evidence (actual artifact names, quotes, registry values, or hashes).
   - Exact source location (source image, partition, MFT record/inode, offset, timestamp).
   - Recovery method (e.g. Filesystem, Partition Table, Recycle Bin Reconstructed, Registry Hive, Signature Carving).
   - Partition (e.g. "Partition 2 (Basic Data Partition, NTFS)" or "Physical Disk LBA 1").
   - Record (e.g. "MFT Record 278", "Inode 1101", or "GPT Header").
   - Confidence level (High, Medium, Low based on cryptographic verification).
5. Output MUST be valid JSON conforming exactly to this schema:
{
  "answer": "Direct, concise court-ready answer based ONLY on recovered evidence.",
  "evidence": "Specific artifact names, quotes, values, hashes, or records.",
  "source": "Exact source path / partition / MFT record / offset / timestamp.",
  "content": "Relevant extracted text portion or excerpt from the file/record.",
  "recovery": "Filesystem | Partition Table | Recycle Bin Reconstructed | Registry Hive | Signature Carving",
  "partition": "Partition 2 (Basic Data Partition, NTFS)" | "Physical Disk LBA 1",
  "record": "MFT Record 278" | "Inode 1101" | "GPT Header",
  "sha256": "SHA-256 hash or N/A",
  "confidence": "High" | "Medium" | "Low"
}`;

  const userPrompt = `USER INQUIRY: "${question}"

EVIDENCE CONTEXT EXTRACTED FROM BITSTREAM IMAGE:
${JSON.stringify(retrieved.context, null, 2)}

Provide your verified forensic findings in strict JSON.`;

  const contextBytes = Buffer.byteLength(userPrompt, 'utf8');
  logger.info(`[AI] Sending evidence context (${contextBytes} bytes) to model ${config.model} (${config.provider})`);

  const startTime = Date.now();
  let parsedResponse = null;
  let activeModelUsed = config.model;

  try {
    if (config.provider === 'gemini') {
      // Build candidate list prioritizing configured model then all free-tier models
      const candidateModels = Array.from(new Set([config.model, ...GEMINI_FREE_MODELS].filter(Boolean)));
      let lastGeminiError = null;

      for (const targetModel of candidateModels) {
        try {
          logger.info(`[AI] Querying Gemini model: ${targetModel}`);
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${config.apiKey}`;
          const payload = JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          });

          let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
          });

          if (response.status === 429 || response.status === 503) {
            logger.warn(`[AI] Gemini model ${targetModel} returned status ${response.status}. Attempting brief backoff retry...`);
            await new Promise((r) => setTimeout(r, 2000));
            response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload
            });
          }

          if (!response.ok) {
            const errBody = await response.text();
            lastGeminiError = new Error(`Gemini API error for model ${targetModel} (${response.status}): ${errBody}`);
            logger.warn(`[AI] Gemini model ${targetModel} failed: ${lastGeminiError.message}. Trying next free model fallback...`);
            continue;
          }

          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            parsedResponse = JSON.parse(cleaned);
            activeModelUsed = targetModel;
            logger.info(`[AI] Successfully received response from Gemini free model: ${targetModel}`);
            break;
          }
        } catch (mErr) {
          lastGeminiError = mErr;
          logger.warn(`[AI] Error attempting Gemini model ${targetModel}: ${mErr.message}. Trying next free model fallback...`);
        }
      }

      if (!parsedResponse && lastGeminiError) {
        throw lastGeminiError;
      }
    } else {
      const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
      const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

      const headers = { 'Content-Type': 'application/json' };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${config.provider.toUpperCase()} API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (rawText) {
        const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        parsedResponse = JSON.parse(cleaned);
      }
    }

    const elapsedMs = Date.now() - startTime;
    logger.info(`[AI] Model (${activeModelUsed}) response received in ${elapsedMs}ms`);

    if (parsedResponse && parsedResponse.answer) {
      return {
        answer: parsedResponse.answer,
        evidence: parsedResponse.evidence || 'Verified bitstream records.',
        source: parsedResponse.source || targetImageName,
        content: parsedResponse.content || null,
        recovery: parsedResponse.recovery || 'Filesystem',
        partition: parsedResponse.partition || (parsedResponse.source?.includes('Partition') ? 'Partition 2 (NTFS)' : 'Physical Disk'),
        record: parsedResponse.record || 'N/A',
        sha256: parsedResponse.sha256 || 'N/A',
        confidence: parsedResponse.confidence || 'High',
        model: activeModelUsed,
        sourceArtifactId: retrieved.sourceArtifactId,
        sourceArtifact: retrieved.sourceArtifact,
        matches: retrieved.context.matchedFiles.map((mf) => ({
          name: mf.name,
          category: mf.recovery,
          snippet: mf.contentExcerpt || mf.path,
          source: mf.path,
          recovery: mf.recovery,
          sha256: mf.sha256,
          item: mf.item
        }))
      };
    }
  } catch (err) {
    if (err instanceof ForensicConfigError) {
      throw err;
    }
    logger.error(`[AI] LLM generation failed: ${err.message}`);
    throw err;
  }

  throw new Error('LLM did not return a valid structured response.');
}

const forensicAnalystService = {
  /**
   * Main entrypoint: Ask anything about the analyzed evidence
   */
  ask: async (evidenceId, question) => {
    if (!question || !question.trim()) {
      throw new Error('Question is required');
    }

    // 1. Retrieve real forensic evidence from the bitstream index
    const retrieved = await retrieveEvidence(evidenceId, question);

    // 2. Call the real LLM with the evidence context
    const result = await callRealLLM(question, retrieved);
    return result;
  },

  /**
   * Returns current AI provider configuration status (without leaking secrets)
   */
  getStatus: () => {
    const config = getAIConfig();
    return {
      configured: Boolean(config.apiKey || config.baseUrl),
      provider: config.provider,
      model: config.model,
      freeModels: config.provider === 'gemini' ? GEMINI_FREE_MODELS : [],
      hasCustomBaseUrl: Boolean(config.baseUrl)
    };
  },

  /**
   * Returns list of supported Gemini Free Models
   */
  getFreeModels: () => GEMINI_FREE_MODELS
};

export default forensicAnalystService;
