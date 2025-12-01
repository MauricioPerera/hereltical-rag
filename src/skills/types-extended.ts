/**
 * Skill Bank - Extended Types
 * 
 * Extensiones para Credentials y Sub-Agents
 */

import { EntityType, EdgeType } from './types.js';

// ============================================================================
// CREDENTIAL ENTITY
// ============================================================================

export interface Credential {
  id: string;
  name: string;
  type: 'credential';
  
  // Service metadata
  service: string;              // stripe, github, sendgrid, database
  credentialType: CredentialType;
  
  // Scope & Access Control
  allowedSkills: string[];      // Skills que pueden usar esta credential
  allowedTools?: string[];      // Tools que pueden usar (alternativo)
  allowedAgents?: string[];     // Agents que tienen acceso
  
  // Vault reference
  vaultPath: string;            // Referencia al vault (encrypted storage)
  vaultProvider: VaultProvider;
  
  // Security
  expiresAt?: string;           // ISO 8601 timestamp
  rotationPolicy?: RotationPolicy;
  lastRotatedAt?: string;
  
  // Audit
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
  createdBy?: string;           // User o agent que creo la credential
  
  // Metadata
  tags?: string[];
  notes?: string;
}

export type CredentialType = 
  | 'api_key'
  | 'oauth2_token'
  | 'jwt'
  | 'basic_auth'
  | 'bearer_token'
  | 'ssh_key'
  | 'database_password'
  | 'certificate';

export type VaultProvider =
  | 'file'              // File-based encrypted vault
  | 'os_keychain'       // macOS Keychain, Windows Credential Manager
  | 'hashicorp_vault'   // HashiCorp Vault
  | 'aws_secrets'       // AWS Secrets Manager
  | 'azure_keyvault'    // Azure Key Vault
  | 'pass';             // Unix password manager

export interface RotationPolicy {
  enabled: boolean;
  intervalDays: number;         // Rotar cada X dias
  notifyBeforeDays: number;     // Notificar X dias antes de expirar
  autoRotate: boolean;          // Rotar automaticamente o manual
}

// ============================================================================
// AGENT ENTITY
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  type: 'agent';
  
  // Capabilities
  specialization: string[];     // analytics, reporting, communication, etc
  availableSkills: string[];    // Skills que este agente puede ejecutar
  availableTools: string[];     // Tools directas (menos comun)
  
  // Communication
  protocol: AgentProtocol;
  endpoint: string;             // URL o address del agente
  authMethod?: AgentAuthMethod;
  
  // Trust & Security
  trustLevel: number;           // 0.0 - 1.0
  requiresCredentials: string[]; // Credentials necesarias para operar
  
  // Performance metrics
  avgResponseTime: number;      // ms
  successRate: number;          // 0.0 - 1.0
  totalExecutions: number;
  
  // Status
  status: AgentStatus;
  lastSeenAt: string;
  
  // Metadata
  version: string;
  createdAt: string;
  tags?: string[];
  description?: string;
}

export type AgentProtocol = 
  | 'http'
  | 'grpc'
  | 'websocket'
  | 'message_queue'
  | 'internal';           // Same process

export interface AgentAuthMethod {
  type: 'api_key' | 'jwt' | 'mutual_tls' | 'none';
  credentialId?: string;  // Credential used for auth
}

export type AgentStatus =
  | 'online'
  | 'offline'
  | 'busy'
  | 'degraded'
  | 'maintenance';

// ============================================================================
// EXTENDED EDGE TYPES
// ============================================================================

export type ExtendedEdgeType = EdgeType
  | 'REQUIRES_CREDENTIAL'    // Skill/Agent requires Credential
  | 'GRANTS_ACCESS'          // Credential grants access to Service
  | 'ALLOWED_FOR'            // Credential allowed for Skill/Agent
  | 'CAN_EXECUTE'            // Agent can execute Skill
  | 'DELEGATES_TO'           // Agent delegates to Agent
  | 'REQUESTS_FROM'          // Agent requests from Agent
  | 'BEST_HANDLED_BY'        // Skill best handled by Agent
  | 'HAS_ACCESS_TO';         // Agent has access to Credential

// ============================================================================
// CREDENTIAL OPERATIONS
// ============================================================================

export interface CredentialRequest {
  credentialId: string;
  requestedBy: string;         // Skill or Agent ID
  purpose: string;             // Why is it needed
  expiresIn?: number;          // Seconds, for temporary access
}

export interface CredentialResponse {
  success: boolean;
  value?: string;              // Decrypted credential value (temporary)
  expiresAt?: string;          // When this response expires
  error?: string;
  auditId: string;             // For audit trail
}

export interface CredentialAudit {
  id: string;
  credentialId: string;
  requestedBy: string;
  requestedAt: string;
  granted: boolean;
  reason?: string;             // Why granted or denied
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// AGENT OPERATIONS
// ============================================================================

export interface DelegationRequest {
  targetAgent: string;         // Agent ID to delegate to
  skill: string;               // Skill to execute
  input: Record<string, any>;
  timeout?: number;            // ms
  priority?: 'low' | 'normal' | 'high';
  callback?: string;           // URL for async callback
}

export interface DelegationResponse {
  success: boolean;
  output?: any;
  executionTime: number;       // ms
  agentId: string;
  error?: string;
  logs?: string[];
}

export interface AgentRequest {
  fromAgent: string;           // Requesting agent ID
  toAgent: string;             // Target agent ID
  requestType: 'data' | 'execute' | 'status';
  payload: any;
  timeout?: number;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  fromAgent: string;
  requestId: string;
}

// ============================================================================
// DISCOVERY WITH AGENTS & CREDENTIALS
// ============================================================================

export interface ExtendedDiscoveryResult {
  query: string;
  tools: any[];
  skills: any[];
  
  // New fields
  requiredCredentials?: CredentialInfo[];  // Credentials needed
  suggestedAgents?: AgentSuggestion[];     // Best agents for task
  
  suggestedFlow?: any;
  metadata: {
    timestamp: string;
    usedGraph: boolean;
    resultsCount: number;
  };
}

export interface CredentialInfo {
  id: string;
  name: string;
  service: string;
  available: boolean;          // Si está disponible para usar
  requiredBy: string[];        // Skills que la requieren
}

export interface AgentSuggestion {
  agent: Agent;
  relevance: number;           // 0-1
  reason: string;              // Why this agent is suggested
  skills: string[];            // Skills this agent can handle
  estimatedTime?: number;      // ms
}

// ============================================================================
// EXTENDED EXECUTION
// ============================================================================

export interface ExtendedExecuteParams {
  targetId: string;
  targetType: EntityType | 'agent';
  input: Record<string, any>;
  
  // Credential handling
  requestCredentials?: boolean;
  credentialOverrides?: Record<string, string>;
  
  // Agent handling
  preferredAgent?: string;     // Prefer specific agent
  allowDelegation?: boolean;   // Allow delegating to sub-agents
  
  options?: {
    timeout?: number;
    retries?: number;
    dryRun?: boolean;
  };
}

export interface ExtendedExecutionResult {
  success: boolean;
  output: any;
  
  // Extended info
  toolsUsed: string[];
  credentialsUsed?: string[];  // IDs of credentials used (not values!)
  agentsInvolved?: string[];   // Agents that participated
  
  logs?: any[];
  error?: any;
  metadata: {
    executionTime: number;
    timestamp: string;
    delegated?: boolean;
  };
}

// ============================================================================
// VAULT INTERFACE
// ============================================================================

export interface VaultInterface {
  // Store credential securely
  store(credentialId: string, value: string, options?: VaultStoreOptions): Promise<void>;
  
  // Retrieve credential (requires authorization)
  retrieve(credentialId: string, requestedBy: string): Promise<string>;
  
  // Update credential
  update(credentialId: string, newValue: string): Promise<void>;
  
  // Delete credential
  delete(credentialId: string): Promise<void>;
  
  // Check if credential exists
  exists(credentialId: string): Promise<boolean>;
  
  // Rotate credential
  rotate(credentialId: string, newValue: string): Promise<void>;
}

export interface VaultStoreOptions {
  encrypt?: boolean;           // Default: true
  expiresIn?: number;          // Seconds
  metadata?: Record<string, any>;
}

// ============================================================================
// AGENT REGISTRY
// ============================================================================

export interface AgentRegistry {
  // Register agent
  register(agent: Agent): Promise<void>;
  
  // Get agent by ID
  get(agentId: string): Promise<Agent | null>;
  
  // Find agents by capability
  findBySpecialization(specialization: string): Promise<Agent[]>;
  
  // Find best agent for skill
  findBestForSkill(skillId: string): Promise<Agent | null>;
  
  // Update agent status
  updateStatus(agentId: string, status: AgentStatus): Promise<void>;
  
  // Health check
  ping(agentId: string): Promise<boolean>;
}

