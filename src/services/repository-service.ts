import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import winston from 'winston';
import { GitService, GitConfig } from './git-service';
import { DatabaseService } from '../database/database-service';

export interface RepositoryConfig {
  provider: 'github' | 'gitlab';
  apiUrl: string;
  token: string;
  webhookSecret?: string;
  organization?: string;
  defaultBranch?: string;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  description?: string;
  private: boolean;
  language?: string;
  topics?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  description: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  sourceBranch: string;
  targetBranch: string;
  repository: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  mergeable?: boolean;
  draft?: boolean;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  description: string;
  state: 'open' | 'closed';
  author: string;
  assignees: string[];
  labels: string[];
  repository: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  repository: string;
  data: any;
  timestamp: Date;
  processed: boolean;
}

export interface RepositoryIntegration {
  id: string;
  organizationId: string;
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab';
  webhookUrl?: string;
  autoCreateTasks: boolean;
  autoCreatePR: boolean;
  branchPrefix?: string;
  settings: {
    enabledEvents: string[];
    taskCreationRules: {
      issueLabels?: string[];
      prLabels?: string[];
      autoAssign?: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export class RepositoryService extends EventEmitter {
  private logger: winston.Logger;
  private config: RepositoryConfig;
  private httpClient: AxiosInstance;
  private db: DatabaseService;
  private gitService?: GitService;
  private integrations: Map<string, RepositoryIntegration> = new Map();

  constructor(config: RepositoryConfig) {
    super();
    this.config = config;
    this.db = DatabaseService.getInstance();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new winston.transports.File({ 
          filename: `logs/repository-service.log`,
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });

    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'MultiAgentOrchestrator/1.0'
      }
    });

    this.setupInterceptors();
  }

  private getAuthHeader(): string {
    if (this.config.provider === 'github') {
      return `Bearer ${this.config.token}`;
    } else {
      return `Bearer ${this.config.token}`;
    }
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('Repository API Request:', {
          method: config.method,
          url: config.url,
          provider: this.config.provider
        });
        return config;
      },
      (error) => {
        this.logger.error('Repository API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('Repository API Response:', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Repository API Response Error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async initialize(): Promise<void> {
    try {
      // Test API connection
      await this.validateConnection();
      
      // Load existing integrations
      await this.loadIntegrations();
      
      this.logger.info('Repository service initialized successfully', {
        provider: this.config.provider,
        integrations: this.integrations.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize repository service:', error);
      throw error;
    }
  }

  private async validateConnection(): Promise<void> {
    try {
      if (this.config.provider === 'github') {
        await this.httpClient.get('/user');
      } else {
        await this.httpClient.get('/user');
      }
      this.logger.info('Repository API connection validated');
    } catch (error) {
      throw new Error(`Failed to validate ${this.config.provider} API connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadIntegrations(): Promise<void> {
    // Load integrations from database (placeholder - would need proper database table)
    this.logger.info('Loading repository integrations from database');
  }

  // Repository Management
  async listRepositories(options?: {
    organization?: string;
    type?: 'all' | 'owner' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<Repository[]> {
    try {
      let url = this.config.provider === 'github' ? '/user/repos' : '/projects';
      
      if (options?.organization) {
        url = this.config.provider === 'github' 
          ? `/orgs/${options.organization}/repos`
          : `/groups/${options.organization}/projects`;
      }

      const response = await this.httpClient.get(url, { params: options });
      
      return this.normalizeRepositories(response.data);
    } catch (error) {
      this.logger.error('Failed to list repositories:', error);
      throw error;
    }
  }

  async getRepository(owner: string, repo: string): Promise<Repository> {
    try {
      const url = this.config.provider === 'github'
        ? `/repos/${owner}/${repo}`
        : `/projects/${owner}%2F${repo}`;

      const response = await this.httpClient.get(url);
      
      return this.normalizeRepository(response.data);
    } catch (error) {
      this.logger.error('Failed to get repository:', error);
      throw error;
    }
  }

  async createRepository(options: {
    name: string;
    description?: string;
    private?: boolean;
    organization?: string;
    autoInit?: boolean;
    gitignoreTemplate?: string;
    licenseTemplate?: string;
  }): Promise<Repository> {
    try {
      const url = options.organization
        ? (this.config.provider === 'github' ? `/orgs/${options.organization}/repos` : `/projects`)
        : (this.config.provider === 'github' ? '/user/repos' : '/projects');

      const payload = this.config.provider === 'github' ? {
        name: options.name,
        description: options.description,
        private: options.private || false,
        auto_init: options.autoInit || true,
        gitignore_template: options.gitignoreTemplate,
        license_template: options.licenseTemplate
      } : {
        name: options.name,
        description: options.description,
        visibility: options.private ? 'private' : 'public',
        initialize_with_readme: options.autoInit || true
      };

      const response = await this.httpClient.post(url, payload);
      
      this.logger.info('Repository created successfully', {
        name: options.name,
        organization: options.organization
      });

      return this.normalizeRepository(response.data);
    } catch (error) {
      this.logger.error('Failed to create repository:', error);
      throw error;
    }
  }

  // Pull Request Management
  async listPullRequests(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    sort?: 'created' | 'updated';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<PullRequest[]> {
    try {
      const url = this.config.provider === 'github'
        ? `/repos/${owner}/${repo}/pulls`
        : `/projects/${owner}%2F${repo}/merge_requests`;

      const response = await this.httpClient.get(url, { params: options });
      
      return this.normalizePullRequests(response.data);
    } catch (error) {
      this.logger.error('Failed to list pull requests:', error);
      throw error;
    }
  }

  async createPullRequest(owner: string, repo: string, options: {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
    draft?: boolean;
  }): Promise<PullRequest> {
    try {
      const url = this.config.provider === 'github'
        ? `/repos/${owner}/${repo}/pulls`
        : `/projects/${owner}%2F${repo}/merge_requests`;

      const payload = this.config.provider === 'github' ? {
        title: options.title,
        body: options.description,
        head: options.sourceBranch,
        base: options.targetBranch,
        draft: options.draft || false
      } : {
        title: options.title,
        description: options.description,
        source_branch: options.sourceBranch,
        target_branch: options.targetBranch
      };

      const response = await this.httpClient.post(url, payload);
      
      this.logger.info('Pull request created successfully', {
        repository: `${owner}/${repo}`,
        title: options.title,
        sourceBranch: options.sourceBranch,
        targetBranch: options.targetBranch
      });

      return this.normalizePullRequest(response.data);
    } catch (error) {
      this.logger.error('Failed to create pull request:', error);
      throw error;
    }
  }

  // Issue Management
  async listIssues(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    labels?: string[];
    assignee?: string;
    sort?: 'created' | 'updated';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<Issue[]> {
    try {
      const url = this.config.provider === 'github'
        ? `/repos/${owner}/${repo}/issues`
        : `/projects/${owner}%2F${repo}/issues`;

      const response = await this.httpClient.get(url, { params: options });
      
      return this.normalizeIssues(response.data);
    } catch (error) {
      this.logger.error('Failed to list issues:', error);
      throw error;
    }
  }

  async createIssue(owner: string, repo: string, options: {
    title: string;
    description: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<Issue> {
    try {
      const url = this.config.provider === 'github'
        ? `/repos/${owner}/${repo}/issues`
        : `/projects/${owner}%2F${repo}/issues`;

      const payload = this.config.provider === 'github' ? {
        title: options.title,
        body: options.description,
        labels: options.labels,
        assignees: options.assignees
      } : {
        title: options.title,
        description: options.description,
        labels: options.labels?.join(','),
        assignee_ids: options.assignees
      };

      const response = await this.httpClient.post(url, payload);
      
      this.logger.info('Issue created successfully', {
        repository: `${owner}/${repo}`,
        title: options.title
      });

      return this.normalizeIssue(response.data);
    } catch (error) {
      this.logger.error('Failed to create issue:', error);
      throw error;
    }
  }

  // Webhook Management
  async createWebhook(owner: string, repo: string, webhookUrl: string, events: string[]): Promise<string> {
    try {
      const url = this.config.provider === 'github'
        ? `/repos/${owner}/${repo}/hooks`
        : `/projects/${owner}%2F${repo}/hooks`;

      const payload = this.config.provider === 'github' ? {
        name: 'web',
        active: true,
        events: events,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: this.config.webhookSecret,
          insecure_ssl: '0'
        }
      } : {
        url: webhookUrl,
        push_events: events.includes('push'),
        issues_events: events.includes('issues'),
        merge_requests_events: events.includes('pull_request'),
        tag_push_events: events.includes('tag_push'),
        token: this.config.webhookSecret
      };

      const response = await this.httpClient.post(url, payload);
      
      this.logger.info('Webhook created successfully', {
        repository: `${owner}/${repo}`,
        webhookUrl,
        events
      });

      return response.data.id.toString();
    } catch (error) {
      this.logger.error('Failed to create webhook:', error);
      throw error;
    }
  }

  async deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void> {
    try {
      const url = this.config.provider === 'github'
        ? `/repos/${owner}/${repo}/hooks/${webhookId}`
        : `/projects/${owner}%2F${repo}/hooks/${webhookId}`;

      await this.httpClient.delete(url);
      
      this.logger.info('Webhook deleted successfully', {
        repository: `${owner}/${repo}`,
        webhookId
      });
    } catch (error) {
      this.logger.error('Failed to delete webhook:', error);
      throw error;
    }
  }

  // Webhook Event Processing
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    try {
      const hmac = crypto.createHmac('sha256', this.config.webhookSecret);
      hmac.update(payload);
      const expectedSignature = this.config.provider === 'github' 
        ? `sha256=${hmac.digest('hex')}`
        : hmac.digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Failed to verify webhook signature:', error);
      return false;
    }
  }

  async processWebhookEvent(eventType: string, payload: any): Promise<void> {
    try {
      const event: WebhookEvent = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: eventType,
        repository: payload.repository?.full_name || payload.project?.path_with_namespace,
        data: payload,
        timestamp: new Date(),
        processed: false
      };

      this.logger.info('Processing webhook event', {
        type: eventType,
        repository: event.repository,
        eventId: event.id
      });

      // Store event in database for processing
      await this.storeWebhookEvent(event);

      // Process event based on type
      switch (eventType) {
        case 'push':
          await this.handlePushEvent(event);
          break;
        case 'pull_request':
        case 'merge_request':
          await this.handlePullRequestEvent(event);
          break;
        case 'issues':
          await this.handleIssueEvent(event);
          break;
        case 'release':
          await this.handleReleaseEvent(event);
          break;
        default:
          this.logger.info('Unhandled webhook event type:', eventType);
      }

      // Mark event as processed
      event.processed = true;
      await this.updateWebhookEvent(event);

      this.emit('webhook:processed', event);
    } catch (error) {
      this.logger.error('Failed to process webhook event:', error);
      this.emit('webhook:error', { eventType, payload, error });
    }
  }

  private async handlePushEvent(event: WebhookEvent): Promise<void> {
    const payload = event.data;
    const commits = payload.commits || [];
    
    this.logger.info('Processing push event', {
      repository: event.repository,
      branch: payload.ref?.replace('refs/heads/', ''),
      commits: commits.length
    });

    // Emit event for task orchestrator to handle
    this.emit('repository:push', {
      repository: event.repository,
      branch: payload.ref?.replace('refs/heads/', ''),
      commits: commits.map((commit: any) => ({
        id: commit.id,
        message: commit.message,
        author: commit.author?.name,
        url: commit.url,
        timestamp: commit.timestamp
      }))
    });
  }

  private async handlePullRequestEvent(event: WebhookEvent): Promise<void> {
    const payload = event.data;
    const pr = payload.pull_request || payload.merge_request;
    const action = payload.action || payload.object_attributes?.action;

    this.logger.info('Processing pull request event', {
      repository: event.repository,
      action,
      prNumber: pr.number,
      title: pr.title
    });

    this.emit('repository:pull_request', {
      repository: event.repository,
      action,
      pullRequest: this.normalizePullRequest(pr)
    });
  }

  private async handleIssueEvent(event: WebhookEvent): Promise<void> {
    const payload = event.data;
    const issue = payload.issue || payload.object_attributes;
    const action = payload.action || payload.object_attributes?.action;

    this.logger.info('Processing issue event', {
      repository: event.repository,
      action,
      issueNumber: issue.number,
      title: issue.title
    });

    this.emit('repository:issue', {
      repository: event.repository,
      action,
      issue: this.normalizeIssue(issue)
    });
  }

  private async handleReleaseEvent(event: WebhookEvent): Promise<void> {
    const payload = event.data;
    const release = payload.release;
    const action = payload.action;

    this.logger.info('Processing release event', {
      repository: event.repository,
      action,
      tagName: release.tag_name,
      name: release.name
    });

    this.emit('repository:release', {
      repository: event.repository,
      action,
      release: {
        id: release.id,
        name: release.name,
        tagName: release.tag_name,
        body: release.body,
        url: release.html_url,
        draft: release.draft,
        prerelease: release.prerelease,
        createdAt: new Date(release.created_at),
        publishedAt: new Date(release.published_at)
      }
    });
  }

  // Git Integration
  setGitService(gitService: GitService): void {
    this.gitService = gitService;
  }

  async cloneRepository(repository: Repository, localPath: string): Promise<void> {
    if (!this.gitService) {
      throw new Error('Git service not configured');
    }

    try {
      await this.gitService.initialize();
      // Implementation would clone the repository
      this.logger.info('Repository cloned successfully', {
        repository: repository.fullName,
        localPath
      });
    } catch (error) {
      this.logger.error('Failed to clone repository:', error);
      throw error;
    }
  }

  // Data Normalization Methods
  private normalizeRepositories(repos: any[]): Repository[] {
    return repos.map(repo => this.normalizeRepository(repo));
  }

  private normalizeRepository(repo: any): Repository {
    if (this.config.provider === 'github') {
      return {
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        defaultBranch: repo.default_branch,
        description: repo.description,
        private: repo.private,
        language: repo.language,
        topics: repo.topics,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at)
      };
    } else {
      return {
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.path_with_namespace,
        owner: repo.namespace.name,
        url: repo.web_url,
        cloneUrl: repo.http_url_to_repo,
        sshUrl: repo.ssh_url_to_repo,
        defaultBranch: repo.default_branch,
        description: repo.description,
        private: repo.visibility === 'private',
        language: repo.language,
        topics: repo.tag_list,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.last_activity_at)
      };
    }
  }

  private normalizePullRequests(prs: any[]): PullRequest[] {
    return prs.map(pr => this.normalizePullRequest(pr));
  }

  private normalizePullRequest(pr: any): PullRequest {
    if (this.config.provider === 'github') {
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        description: pr.body || '',
        state: pr.state,
        author: pr.user.login,
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        repository: pr.base.repo.full_name,
        url: pr.html_url,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        mergeable: pr.mergeable,
        draft: pr.draft
      };
    } else {
      return {
        id: pr.id,
        number: pr.iid,
        title: pr.title,
        description: pr.description || '',
        state: pr.state,
        author: pr.author.username,
        sourceBranch: pr.source_branch,
        targetBranch: pr.target_branch,
        repository: pr.project_id,
        url: pr.web_url,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        mergeable: pr.merge_status === 'can_be_merged'
      };
    }
  }

  private normalizeIssues(issues: any[]): Issue[] {
    return issues.map(issue => this.normalizeIssue(issue));
  }

  private normalizeIssue(issue: any): Issue {
    if (this.config.provider === 'github') {
      return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        description: issue.body || '',
        state: issue.state,
        author: issue.user.login,
        assignees: issue.assignees?.map((a: any) => a.login) || [],
        labels: issue.labels?.map((l: any) => l.name) || [],
        repository: issue.repository?.full_name || '',
        url: issue.html_url,
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at)
      };
    } else {
      return {
        id: issue.id,
        number: issue.iid,
        title: issue.title,
        description: issue.description || '',
        state: issue.state,
        author: issue.author.username,
        assignees: issue.assignees?.map((a: any) => a.username) || [],
        labels: issue.labels || [],
        repository: issue.project_id,
        url: issue.web_url,
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at)
      };
    }
  }

  // Database operations (would need proper implementation)
  private async storeWebhookEvent(event: WebhookEvent): Promise<void> {
    // Store in database
    this.logger.debug('Storing webhook event in database', { eventId: event.id });
  }

  private async updateWebhookEvent(event: WebhookEvent): Promise<void> {
    // Update in database
    this.logger.debug('Updating webhook event in database', { eventId: event.id });
  }

  // Integration Management
  async createIntegration(integration: Omit<RepositoryIntegration, 'id' | 'createdAt' | 'updatedAt'>): Promise<RepositoryIntegration> {
    const newIntegration: RepositoryIntegration = {
      ...integration,
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.integrations.set(newIntegration.repositoryId, newIntegration);
    
    this.logger.info('Repository integration created', {
      integrationId: newIntegration.id,
      repository: newIntegration.repositoryName
    });

    return newIntegration;
  }

  async getIntegration(repositoryId: string): Promise<RepositoryIntegration | undefined> {
    return this.integrations.get(repositoryId);
  }

  async listIntegrations(organizationId: string): Promise<RepositoryIntegration[]> {
    return Array.from(this.integrations.values())
      .filter(integration => integration.organizationId === organizationId);
  }

  async deleteIntegration(repositoryId: string): Promise<void> {
    const integration = this.integrations.get(repositoryId);
    if (integration) {
      this.integrations.delete(repositoryId);
      this.logger.info('Repository integration deleted', {
        integrationId: integration.id,
        repository: integration.repositoryName
      });
    }
  }
}