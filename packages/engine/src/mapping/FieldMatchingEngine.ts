/**
 * FieldMatchingEngine
 * 
 * Reusable, integration-independent intelligent field-matching engine.
 * Automatically matches target fields (e.g. Google Sheets column headers, action inputs)
 * with available workflow fields (triggers, action outputs, system variables).
 * 
 * Matching Strategy:
 * 1. Exact & case-insensitive matching (Score: 100)
 * 2. Normalized matching: spaces, underscores, casing, camelCase (Score: 95)
 * 3. Path leaf & sub-path matching (Score: 90 - 95)
 * 4. Semantic alias dictionaries across core business concepts (Score: 85)
 * 5. Token overlap / Jaccard similarity (Score: 65 - 80)
 * 6. Sample values as supporting evidence (Boost: +5 - +10 only if base score >= 60)
 * 7. Ambiguity guard: Downgrades confidence to 'medium' if multiple candidates compete closely.
 */

export type FieldMatchConfidence = 'high' | 'medium' | 'low' | 'none';

export type MappingOrigin = 'auto' | 'suggested' | 'manual';

export interface TargetFieldDefinition {
  key: string;               // Canonical key / column header (e.g. "Customer Name", "email", "amount")
  label?: string;            // Human-readable label
  type?: string;             // 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | etc.
  required?: boolean;        // Whether the field is mandatory
  description?: string;      // Metadata or field description
}

export interface SourceFieldDefinition {
  id: string;                // e.g. "trigger.customer_name" or "trigger.leadId"
  rawExpression: string;     // e.g. "{{ trigger.customer_name }}"
  nodeKey?: string;          // e.g. "trigger"
  stepName?: string;         // e.g. "Manual Trigger"
  path: string;              // e.g. "customer_name" or "body.email"
  label: string;             // e.g. "Customer Name"
  type?: string;             // 'string' | 'number' | 'boolean' | 'object' | 'array'
  sampleValue?: any;         // e.g. "sarah.c@sky.net", 42
  description?: string;
  sourceCategory?: string;   // 'trigger' | 'action' | 'system'
}

export interface CandidateMatch {
  source: SourceFieldDefinition;
  score: number;
  confidence: FieldMatchConfidence;
  reason: string;
}

export interface FieldMatchResult {
  targetKey: string;
  matchedSource?: SourceFieldDefinition;
  score: number;
  confidence: FieldMatchConfidence;
  reason: string;
  isAmbiguous?: boolean;
  alternatives?: CandidateMatch[];
}

export interface FieldMappingEntry {
  targetKey: string;
  targetField?: TargetFieldDefinition;
  value: string;
  origin: MappingOrigin;
  confidence: FieldMatchConfidence;
  score: number;
  reason: string;
  matchedSource?: SourceFieldDefinition;
  suggestedSource?: SourceFieldDefinition;
  suggestedScore?: number;
  suggestedReason?: string;
  isAmbiguous?: boolean;
}

export interface AutoMapSummary {
  total: number;
  mapped: number;
  autoMapped: number;
  suggested: number;
  manual: number;
  unmapped: number;
  percentageMapped: number;
}

export interface MappingValidation {
  valid: boolean;
  missingRequired: string[];
  unmapped: string[];
  messages: string[];
}

export interface AutoMapResult {
  mappings: Record<string, string>;
  entries: FieldMappingEntry[];
  summary: AutoMapSummary;
  validation: MappingValidation;
}

// ============================================================================
// Semantic Alias Families
// ============================================================================

export const SEMANTIC_ALIAS_FAMILIES: Record<string, string[]> = {
  name: [
    'name', 'fullname', 'full_name', 'customer_name', 'customername',
    'client_name', 'clientname', 'user_name', 'username', 'contact_name',
    'contactname', 'lead_name', 'leadname', 'person_name', 'personname',
    'first_name', 'firstname', 'last_name', 'lastname', 'display_name',
    'displayname', 'creator_name', 'author_name', 'author'
  ],
  email: [
    'email', 'email_address', 'emailaddress', 'mail', 'e_mail', 'user_email',
    'useremail', 'customer_email', 'customeremail', 'contact_email',
    'contactemail', 'recipient_email', 'recipientemail', 'to_email', 'toemail',
    'sender_email', 'senderemail', 'from_email', 'fromemail', 'work_email',
    'respondent_email', 'respondentemail', 'respondent'
  ],
  phone: [
    'phone', 'telephone', 'mobile', 'cell', 'phone_number', 'phonenumber',
    'contact_phone', 'contactphone', 'mobile_phone', 'mobilephone', 'tel',
    'cellphone', 'cell_phone', 'whatsapp', 'call'
  ],
  company: [
    'company', 'organization', 'organisation', 'org', 'business',
    'company_name', 'companyname', 'org_name', 'orgname', 'firm',
    'enterprise', 'account_name', 'accountname', 'employer', 'agency'
  ],
  id: [
    'id', 'identifier', 'uuid', 'key', 'code', 'lead_id', 'leadid',
    'customer_id', 'customerid', 'user_id', 'userid', 'record_id',
    'recordid', 'order_id', 'orderid', 'account_id', 'accountid',
    'ticket_id', 'ticketid'
  ],
  date: [
    'date', 'created_at', 'createdat', 'created_date', 'createddate',
    'timestamp', 'datetime', 'date_time', 'time', 'due_date', 'duedate',
    'sent_at', 'sentat', 'received_at', 'receivedat', 'updated_at',
    'updatedat', 'event_date', 'eventdate', 'submission_date', 'submit_date',
    'start_date', 'end_date', 'submitted_at', 'submittedat', 'submission_time',
    'submissiontime', 'submission_timestamp', 'submittimestamp'
  ],
  amount: [
    'amount', 'price', 'cost', 'total', 'sum', 'value', 'fee', 'rate',
    'balance', 'revenue', 'budget', 'salary', 'payment', 'charge',
    'deal_value', 'dealvalue', 'invoice_amount', 'subtotal'
  ],
  status: [
    'status', 'state', 'stage', 'condition', 'phase', 'lead_status',
    'leadstatus', 'order_status', 'progress', 'outcome'
  ],
  message: [
    'message', 'notes', 'note', 'description', 'details', 'text', 'content',
    'comment', 'comments', 'summary', 'body', 'reason', 'feedback',
    'inquiry', 'payload_text', 'remarks'
  ],
  address: [
    'address', 'street', 'street_address', 'location', 'city', 'zip',
    'zipcode', 'zip_code', 'postal_code', 'postalcode', 'country',
    'state', 'province', 'region'
  ],
  title: [
    'title', 'subject', 'headline', 'topic', 'header', 'task_title',
    'ticket_title', 'role', 'job_title', 'jobtitle'
  ],
  score: [
    'score', 'rating', 'points', 'rank', 'grade', 'priority', 'confidence'
  ],
  url: [
    'url', 'link', 'website', 'web_link', 'weblink', 'web_view_link',
    'webviewlink', 'html_url', 'htmlurl', 'permalink', 'href'
  ]
};

// Build inverted lookup for O(1) semantic family search
const ALIAS_TO_FAMILY_MAP = new Map<string, string>();
for (const [family, aliases] of Object.entries(SEMANTIC_ALIAS_FAMILIES)) {
  for (const alias of aliases) {
    ALIAS_TO_FAMILY_MAP.set(alias.toLowerCase(), family);
  }
}

// ============================================================================
// Normalization & String Helpers
// ============================================================================

/**
 * Remove all non-alphanumeric characters and lowercase.
 * e.g. "Customer_Email-Address!" -> "customeremailaddress"
 */
export function compactNormalized(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize into space-separated lowercase words, splitting camelCase,
 * snake_case, kebab-case, and dot.notation.
 * e.g. "customerEmailAddress" -> "customer email address"
 * e.g. "body.user_info.first_name" -> "body user info first name"
 */
export function normalizeFieldName(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1 $2') // split camelCase
    .replace(/[\._\-]+/g, ' ')           // replace dots, underscores, dashes with space
    .replace(/[^a-zA-Z0-9\s]/g, ' ')     // replace other symbols with space
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Extract tokens from a field name.
 */
export function tokenizeFieldName(str: string): string[] {
  const norm = normalizeFieldName(str);
  if (!norm) return [];
  return norm.split(' ').filter(Boolean);
}

/**
 * Extract the last meaningful segment of a dot or slash path.
 * e.g. "body.customer.email" -> "email"
 * e.g. "trigger.leadId" -> "leadId"
 */
export function getPathLeaf(path: string): string {
  if (!path) return '';
  const parts = path.split(/[\.\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

/**
 * Calculate Jaccard token overlap between two sets of tokens.
 * Returns ratio from 0.0 to 1.0.
 */
export function calculateTokenOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount++;
  }
  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount > 0 ? intersectionCount / unionCount : 0;
}

/**
 * Determine the semantic family of a field name by testing tokens and compact representations.
 */
export function detectSemanticFamily(name: string): string | null {
  const compact = compactNormalized(name);
  if (ALIAS_TO_FAMILY_MAP.has(compact)) {
    return ALIAS_TO_FAMILY_MAP.get(compact)!;
  }

  // Check last path segment or leaf
  const leaf = compactNormalized(getPathLeaf(name));
  if (ALIAS_TO_FAMILY_MAP.has(leaf)) {
    return ALIAS_TO_FAMILY_MAP.get(leaf)!;
  }

  // Check each token
  const tokens = tokenizeFieldName(name);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (ALIAS_TO_FAMILY_MAP.has(t)) {
      return ALIAS_TO_FAMILY_MAP.get(t)!;
    }
  }

  return null;
}

// ============================================================================
// Sample Value Heuristics (Supporting Evidence ONLY)
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
const PHONE_REGEX = /^(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?[\d-.\s]{7,15}$/;

/**
 * Inspect sample value to check if it corroborates a candidate match.
 * ONLY provides a boost (+5 to +10) if base score is already >= 60.
 * NEVER creates a match from scratch.
 */
export function getSampleValueEvidenceBoost(
  targetKey: string,
  sampleValue: any,
  baseScore: number
): { boost: number; reason?: string } {
  if (baseScore < 60 || sampleValue === undefined || sampleValue === null) {
    return { boost: 0 };
  }

  const strVal = String(sampleValue).trim();
  if (!strVal) return { boost: 0 };

  const targetFamily = detectSemanticFamily(targetKey);
  const targetNorm = normalizeFieldName(targetKey);

  // 1. Email evidence
  if ((targetFamily === 'email' || targetNorm.includes('email')) && EMAIL_REGEX.test(strVal)) {
    return { boost: 10, reason: 'Sample value is a valid email address' };
  }

  // 2. Date / Time evidence
  if (
    (targetFamily === 'date' || targetNorm.includes('date') || targetNorm.includes('time')) &&
    (ISO_DATE_REGEX.test(strVal) || !isNaN(Date.parse(strVal)))
  ) {
    return { boost: 10, reason: 'Sample value is a valid date/timestamp' };
  }

  // 3. Amount / Score / Numeric evidence
  if (
    (targetFamily === 'amount' || targetFamily === 'score' || targetNorm.includes('number') || targetNorm.includes('count')) &&
    !isNaN(Number(strVal)) &&
    strVal !== ''
  ) {
    return { boost: 8, reason: 'Sample value is numeric' };
  }

  // 4. Phone evidence
  if (
    (targetFamily === 'phone' || targetNorm.includes('phone') || targetNorm.includes('mobile')) &&
    PHONE_REGEX.test(strVal)
  ) {
    return { boost: 8, reason: 'Sample value resembles a phone number' };
  }

  // 5. URL evidence
  if (
    (targetFamily === 'url' || targetNorm.includes('url') || targetNorm.includes('link')) &&
    URL_REGEX.test(strVal)
  ) {
    return { boost: 10, reason: 'Sample value is a valid URL' };
  }

  return { boost: 0 };
}

// ============================================================================
// Single Field Matcher
// ============================================================================

/**
 * Evaluate compatibility between a single target field and a candidate source field.
 */
export function scoreFieldMatch(
  target: TargetFieldDefinition,
  source: SourceFieldDefinition
): { score: number; reason: string } {
  const targetKey = target.key.trim();
  const sourcePath = source.path.trim();
  const sourceLabel = (source.label || '').trim();
  const sourceLeaf = getPathLeaf(sourcePath);

  // 1. Exact Match (Score 100)
  if (
    targetKey.toLowerCase() === sourcePath.toLowerCase() ||
    targetKey.toLowerCase() === sourceLeaf.toLowerCase() ||
    targetKey.toLowerCase() === sourceLabel.toLowerCase()
  ) {
    return { score: 100, reason: 'Exact name match' };
  }

  const compactTarget = compactNormalized(targetKey);
  const compactPath = compactNormalized(sourcePath);
  const compactLeaf = compactNormalized(sourceLeaf);
  const compactLabel = compactNormalized(sourceLabel);

  if (
    compactTarget === compactPath ||
    compactTarget === compactLeaf ||
    compactTarget === compactLabel
  ) {
    return { score: 98, reason: 'Exact normalized match' };
  }

  // 2. Normalized Word Match (Score 95)
  const normTarget = normalizeFieldName(targetKey);
  const normPath = normalizeFieldName(sourcePath);
  const normLeaf = normalizeFieldName(sourceLeaf);
  const normLabel = normalizeFieldName(sourceLabel);

  if (normTarget === normLeaf || normTarget === normLabel || normTarget === normPath) {
    return { score: 95, reason: 'Normalized word match' };
  }

  // 3. Semantic Alias Matching (Score 85 - 90)
  const targetFamily = detectSemanticFamily(targetKey);
  const sourceLeafFamily = detectSemanticFamily(sourceLeaf);
  const sourceLabelFamily = detectSemanticFamily(sourceLabel);
  const sourceFamily = sourceLeafFamily || sourceLabelFamily || detectSemanticFamily(sourcePath);

  if (targetFamily && sourceFamily && targetFamily === sourceFamily) {
    // Both belong to the same semantic concept (e.g. "Customer Name" and "name", or "Email Address" and "email")
    // If one contains the other as substring or tokens
    const targetTokens = tokenizeFieldName(targetKey);
    const sourceTokens = tokenizeFieldName(sourceLeaf || sourceLabel);
    const tokenOverlap = calculateTokenOverlap(targetTokens, sourceTokens);

    if (tokenOverlap > 0) {
      return { score: 88, reason: `Semantic alias match (${targetFamily}) with overlapping tokens` };
    }
    return { score: 85, reason: `Semantic alias match (${targetFamily})` };
  }

  // 4. Token Overlap & Substring Containment (Score 65 - 80)
  const targetTokens = tokenizeFieldName(targetKey);
  const sourceTokens = tokenizeFieldName(`${sourceLeaf} ${sourceLabel}`);

  if (targetTokens.length > 0 && sourceTokens.length > 0) {
    const overlap = calculateTokenOverlap(targetTokens, sourceTokens);

    // Check if one token set is entirely contained within the other
    const targetInSource = targetTokens.every((t) => sourceTokens.includes(t));
    const sourceInTarget = sourceTokens.every((t) => targetTokens.includes(t));

    if (targetInSource || sourceInTarget) {
      return { score: 78, reason: 'All key terms contained in target' };
    }

    if (overlap >= 0.5) {
      const score = Math.min(80, Math.round(65 + overlap * 15));
      return { score, reason: `High token similarity (${Math.round(overlap * 100)}%)` };
    }

    if (overlap >= 0.3) {
      const score = Math.min(64, Math.round(55 + overlap * 25));
      return { score, reason: `Moderate token similarity (${Math.round(overlap * 100)}%)` };
    }
  }

  // 5. Schema / Description Matching (Score 60 - 65)
  if (target.description && source.description) {
    const descOverlap = calculateTokenOverlap(
      tokenizeFieldName(target.description),
      tokenizeFieldName(source.description)
    );
    if (descOverlap >= 0.4) {
      return { score: 62, reason: 'Schema description similarity' };
    }
  }

  // 6. Low affinity fallback
  if (compactTarget.includes(compactLeaf) || compactLeaf.includes(compactTarget)) {
    if (compactTarget.length >= 4 && compactLeaf.length >= 4) {
      return { score: 55, reason: 'Partial substring similarity' };
    }
  }

  return { score: 0, reason: 'No structural match' };
}

/**
 * Match a single target field against a list of available source fields,
 * incorporating sample value evidence and detecting ambiguity.
 */
export function matchTargetField(
  target: TargetFieldDefinition,
  availableSources: SourceFieldDefinition[]
): FieldMatchResult {
  const candidates: CandidateMatch[] = [];

  for (const source of availableSources) {
    const base = scoreFieldMatch(target, source);
    let finalScore = base.score;
    let finalReason = base.reason;

    // Apply sample value evidence boost ONLY if base score >= 60
    if (finalScore >= 60 && source.sampleValue !== undefined && source.sampleValue !== null) {
      const { boost, reason: boostReason } = getSampleValueEvidenceBoost(
        target.key,
        source.sampleValue,
        finalScore
      );
      if (boost > 0) {
        finalScore = Math.min(98, finalScore + boost);
        finalReason += ` + ${boostReason}`;
      }
    }

    let confidence: FieldMatchConfidence = 'none';
    if (finalScore >= 80) confidence = 'high';
    else if (finalScore >= 60) confidence = 'medium';
    else if (finalScore >= 40) confidence = 'low';

    if (finalScore >= 40) {
      candidates.push({
        source,
        score: finalScore,
        confidence,
        reason: finalReason,
      });
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      targetKey: target.key,
      score: 0,
      confidence: 'none',
      reason: 'No matching upstream field found',
    };
  }

  const top = candidates[0];
  let isAmbiguous = false;
  let finalConfidence = top.confidence;

  // Ambiguity Detection: If second candidate is very close in score (delta < 8) and top score < 95
  if (candidates.length > 1) {
    const runnerUp = candidates[1];
    const delta = top.score - runnerUp.score;
    if (delta < 8 && top.score < 95) {
      isAmbiguous = true;
      // Downgrade confidence from 'high' to 'medium' so it is suggested for user approval
      if (finalConfidence === 'high') {
        finalConfidence = 'medium';
      }
    }
  }

  return {
    targetKey: target.key,
    matchedSource: top.source,
    score: top.score,
    confidence: finalConfidence,
    reason: isAmbiguous ? `Ambiguous candidates: ${top.reason}` : top.reason,
    isAmbiguous,
    alternatives: candidates.slice(1, 4),
  };
}

// ============================================================================
// Full Auto-Mapping Orchestrator
// ============================================================================

export interface AutoMapOptions {
  targets: (string | TargetFieldDefinition)[];
  sources: SourceFieldDefinition[];
  existingValues?: Record<string, any>;
  existingMeta?: Record<string, { origin?: MappingOrigin; value?: string; userEdited?: boolean }>;
  forceRemap?: boolean; // If true, remaps auto fields while preserving manual fields
}

/**
 * Execute intelligent field mapping for an entire set of target fields.
 * Strictly preserves any user-configured manual mappings.
 */
export function autoMapFields({
  targets,
  sources,
  existingValues = {},
  existingMeta = {},
  forceRemap = false,
}: AutoMapOptions): AutoMapResult {
  // Normalize target definitions
  const targetDefs: TargetFieldDefinition[] = targets.map((t) => {
    if (typeof t === 'string') {
      return { key: t, label: t };
    }
    return t;
  });

  const mappings: Record<string, string> = {};
  const entries: FieldMappingEntry[] = [];

  // Track which sources have been claimed by high-confidence mappings to avoid duplicate assignment
  const claimedSourceIds = new Set<string>();

  // Pass 1: Identify existing manual mappings that MUST be preserved
  for (const target of targetDefs) {
    const existingVal = existingValues[target.key];
    const meta = existingMeta[target.key];
    const hasValue = existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== '';
    const isManual = hasValue && (meta?.origin === 'manual' || (meta?.origin !== 'auto' && !forceRemap));

    if (isManual) {
      // Find source if it matches an expression
      const matched = sources.find((s) => s.rawExpression === String(existingVal).trim());
      if (matched) {
        claimedSourceIds.add(matched.id);
      }
    }
  }

  // Pass 2: Map each target field
  let autoMappedCount = 0;
  let manualCount = 0;
  let suggestedCount = 0;
  let unmappedCount = 0;

  for (const target of targetDefs) {
    const key = target.key;
    const existingVal = existingValues[key];
    const meta = existingMeta[key];
    const hasValue = existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== '';
    const isManual = hasValue && (meta?.origin === 'manual' || (meta?.origin !== 'auto' && !forceRemap));

    // Case A: Manually configured and preserved
    if (isManual) {
      const valStr = String(existingVal).trim();
      const matched = sources.find((s) => s.rawExpression === valStr);

      mappings[key] = valStr;
      manualCount++;

      entries.push({
        targetKey: key,
        targetField: target,
        value: valStr,
        origin: 'manual',
        confidence: 'high',
        score: 100,
        reason: 'User manual configuration',
        matchedSource: matched,
      });
      continue;
    }

    // Case B: Evaluate candidate sources (filtering out sources already claimed by manual mappings)
    const available = sources.filter((s) => !claimedSourceIds.has(s.id));
    const match = matchTargetField(target, available);

    // Case C: High Confidence -> Automatically Map
    if (match.confidence === 'high' && match.matchedSource) {
      const expr = match.matchedSource.rawExpression;
      mappings[key] = expr;
      claimedSourceIds.add(match.matchedSource.id);
      autoMappedCount++;

      entries.push({
        targetKey: key,
        targetField: target,
        value: expr,
        origin: 'auto',
        confidence: 'high',
        score: match.score,
        reason: match.reason,
        matchedSource: match.matchedSource,
        isAmbiguous: false,
      });
      continue;
    }

    // Case D: Medium Confidence -> Suggest for 1-Click User Approval
    if (match.confidence === 'medium' && match.matchedSource) {
      suggestedCount++;
      // Do NOT set in mappings dictionary yet (user must approve it)
      // If there was an existing auto-value from before, we can leave unassigned unless forceRemap is false
      if (!forceRemap && existingVal !== undefined && existingVal !== '') {
        mappings[key] = String(existingVal);
      }

      entries.push({
        targetKey: key,
        targetField: target,
        value: mappings[key] || '',
        origin: 'suggested',
        confidence: 'medium',
        score: match.score,
        reason: match.reason,
        suggestedSource: match.matchedSource,
        suggestedScore: match.score,
        suggestedReason: match.reason,
        isAmbiguous: match.isAmbiguous,
      });
      continue;
    }

    // Case E: Low or None -> Leave Unmapped
    unmappedCount++;
    if (!forceRemap && existingVal !== undefined && existingVal !== '') {
      mappings[key] = String(existingVal);
    }

    entries.push({
      targetKey: key,
      targetField: target,
      value: mappings[key] || '',
      origin: 'suggested',
      confidence: match.confidence,
      score: match.score,
      reason: match.reason,
      suggestedSource: match.confidence === 'low' ? match.matchedSource : undefined,
    });
  }

  // Summary statistics
  const total = targetDefs.length;
  const mapped = Object.keys(mappings).filter((k) => mappings[k] && mappings[k].trim() !== '').length;
  const percentageMapped = total > 0 ? Math.round((mapped / total) * 100) : 100;

  const summary: AutoMapSummary = {
    total,
    mapped,
    autoMapped: autoMappedCount,
    suggested: suggestedCount,
    manual: manualCount,
    unmapped: total - mapped,
    percentageMapped,
  };

  // Validation analysis
  const missingRequired: string[] = [];
  const unmappedKeys: string[] = [];
  const messages: string[] = [];

  for (const entry of entries) {
    const isPresent = entry.value && entry.value.trim() !== '';
    if (!isPresent) {
      unmappedKeys.push(entry.targetKey);
      if (entry.targetField?.required) {
        missingRequired.push(entry.targetKey);
      }
    }
  }

  let valid = true;
  if (missingRequired.length > 0) {
    valid = false;
    messages.push(`Required fields missing: ${missingRequired.join(', ')}`);
  }

  if (unmappedKeys.length > 0) {
    if (unmappedKeys.length === total) {
      messages.push('No fields have been mapped yet. Use Auto-Map or select fields manually.');
    } else {
      messages.push(`${unmappedKeys.length} column(s) unmapped (${unmappedKeys.slice(0, 3).join(', ')}${unmappedKeys.length > 3 ? '...' : ''}). They will be written as empty.`);
    }
  } else if (valid && total > 0) {
    messages.push(`All ${total} fields are mapped and ready.`);
  }

  const validation: MappingValidation = {
    valid,
    missingRequired,
    unmapped: unmappedKeys,
    messages,
  };

  return {
    mappings,
    entries,
    summary,
    validation,
  };
}
