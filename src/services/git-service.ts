import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import winston from 'winston';

const execAsync = promisify(exec);

export interface GitConfig {
  repoPath: string;
  author: {
    name: string;
    email: string;
  };
  autoCommit: boolean;
  commitPrefix?: string;
  branch?: string;
}

export interface CommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
}

export class GitService {
  private logger: winston.Logger;
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = config;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      // Check if repo exists
      await execAsync('git rev-parse --git-dir', { cwd: this.config.repoPath });
      this.logger.info('Git repository found');
    } catch (error) {
      // Initialize new repo
      this.logger.info('Initializing new git repository');
      await execAsync('git init', { cwd: this.config.repoPath });
      
      // Set author config
      await this.setAuthor(this.config.author.name, this.config.author.email);
    }

    // Ensure we're on the correct branch
    if (this.config.branch) {
      await this.checkoutBranch(this.config.branch);
    }
  }

  async setAuthor(name: string, email: string): Promise<void> {
    await execAsync(`git config user.name "${name}"`, { cwd: this.config.repoPath });
    await execAsync(`git config user.email "${email}"`, { cwd: this.config.repoPath });
  }

  async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync('git branch --show-current', { cwd: this.config.repoPath });
    return stdout.trim();
  }

  async checkoutBranch(branch: string, create: boolean = false): Promise<void> {
    try {
      const command = create ? `git checkout -b ${branch}` : `git checkout ${branch}`;
      await execAsync(command, { cwd: this.config.repoPath });
      this.logger.info(`Checked out branch: ${branch}`);
    } catch (error) {
      if (!create) {
        // Try creating the branch if checkout failed
        await this.checkoutBranch(branch, true);
      } else {
        throw error;
      }
    }
  }

  async getStatus(): Promise<{ 
    modified: string[], 
    added: string[], 
    deleted: string[], 
    untracked: string[] 
  }> {
    const { stdout } = await execAsync('git status --porcelain', { cwd: this.config.repoPath });
    
    const status = {
      modified: [] as string[],
      added: [] as string[],
      deleted: [] as string[],
      untracked: [] as string[]
    };

    stdout.split('\n').filter(line => line.trim()).forEach(line => {
      const statusCode = line.substring(0, 2);
      const filename = line.substring(3);

      if (statusCode === ' M' || statusCode === 'M ') status.modified.push(filename);
      else if (statusCode === 'A ') status.added.push(filename);
      else if (statusCode === 'D ') status.deleted.push(filename);
      else if (statusCode === '??') status.untracked.push(filename);
    });

    return status;
  }

  async addFiles(files: string[] | '*'): Promise<void> {
    const filesArg = files === '*' ? '.' : files.join(' ');
    await execAsync(`git add ${filesArg}`, { cwd: this.config.repoPath });
    this.logger.info(`Added files to staging: ${filesArg}`);
  }

  async commit(message: string, taskId?: string): Promise<CommitInfo> {
    const prefix = this.config.commitPrefix || '[AI-Task]';
    const fullMessage = taskId 
      ? `${prefix} ${message}\n\nTask ID: ${taskId}\nAutomated commit by Multi-Agent Orchestrator`
      : `${prefix} ${message}\n\nAutomated commit by Multi-Agent Orchestrator`;

    try {
      await execAsync(`git commit -m "${fullMessage}"`, { cwd: this.config.repoPath });
      
      // Get commit info
      const { stdout } = await execAsync('git log -1 --format="%H|%an|%ad|%s"', { 
        cwd: this.config.repoPath 
      });
      
      const [hash, author, date, msg] = stdout.trim().split('|');
      
      this.logger.info(`Created commit: ${hash}`);
      
      return {
        hash,
        author,
        date: new Date(date),
        message: msg
      };
    } catch (error: any) {
      if (error.message.includes('nothing to commit')) {
        throw new Error('No changes to commit');
      }
      throw error;
    }
  }

  async push(remote: string = 'origin', branch?: string): Promise<void> {
    const currentBranch = branch || await this.getCurrentBranch();
    await execAsync(`git push ${remote} ${currentBranch}`, { cwd: this.config.repoPath });
    this.logger.info(`Pushed to ${remote}/${currentBranch}`);
  }

  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    const currentBranch = branch || await this.getCurrentBranch();
    await execAsync(`git pull ${remote} ${currentBranch}`, { cwd: this.config.repoPath });
    this.logger.info(`Pulled from ${remote}/${currentBranch}`);
  }

  async getCommitHistory(limit: number = 10): Promise<CommitInfo[]> {
    const { stdout } = await execAsync(
      `git log -${limit} --format="%H|%an|%ad|%s"`, 
      { cwd: this.config.repoPath }
    );

    return stdout.trim().split('\n').filter(line => line).map(line => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date: new Date(date), message };
    });
  }

  async createBranch(branchName: string, baseBranch?: string): Promise<void> {
    if (baseBranch) {
      await this.checkoutBranch(baseBranch);
    }
    await execAsync(`git checkout -b ${branchName}`, { cwd: this.config.repoPath });
    this.logger.info(`Created and checked out new branch: ${branchName}`);
  }

  async getDiff(staged: boolean = false): Promise<string> {
    const command = staged ? 'git diff --cached' : 'git diff';
    const { stdout } = await execAsync(command, { cwd: this.config.repoPath });
    return stdout;
  }

  async stash(message?: string): Promise<void> {
    const command = message ? `git stash push -m "${message}"` : 'git stash';
    await execAsync(command, { cwd: this.config.repoPath });
    this.logger.info('Changes stashed');
  }

  async stashPop(): Promise<void> {
    await execAsync('git stash pop', { cwd: this.config.repoPath });
    this.logger.info('Stash applied and removed');
  }

  async autoCommitChanges(taskId: string, taskTitle: string): Promise<CommitInfo | null> {
    if (!this.config.autoCommit) return null;

    try {
      const status = await this.getStatus();
      const hasChanges = status.modified.length > 0 || 
                        status.added.length > 0 || 
                        status.deleted.length > 0 ||
                        status.untracked.length > 0;

      if (!hasChanges) {
        this.logger.info('No changes to commit');
        return null;
      }

      // Add all changes
      await this.addFiles('*');

      // Generate commit message
      const changesSummary = [];
      if (status.added.length > 0) changesSummary.push(`${status.added.length} files added`);
      if (status.modified.length > 0) changesSummary.push(`${status.modified.length} files modified`);
      if (status.deleted.length > 0) changesSummary.push(`${status.deleted.length} files deleted`);

      const commitMessage = `Complete task: ${taskTitle}\n\nChanges: ${changesSummary.join(', ')}`;

      // Commit
      return await this.commit(commitMessage, taskId);
    } catch (error) {
      this.logger.error('Auto-commit failed:', error);
      return null;
    }
  }

  async getFileHistory(filePath: string, limit: number = 10): Promise<CommitInfo[]> {
    const { stdout } = await execAsync(
      `git log -${limit} --format="%H|%an|%ad|%s" -- ${filePath}`, 
      { cwd: this.config.repoPath }
    );

    return stdout.trim().split('\n').filter(line => line).map(line => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date: new Date(date), message };
    });
  }

  async revertCommit(commitHash: string): Promise<void> {
    await execAsync(`git revert ${commitHash} --no-edit`, { cwd: this.config.repoPath });
    this.logger.info(`Reverted commit: ${commitHash}`);
  }

  async cherryPick(commitHash: string): Promise<void> {
    await execAsync(`git cherry-pick ${commitHash}`, { cwd: this.config.repoPath });
    this.logger.info(`Cherry-picked commit: ${commitHash}`);
  }
}