import { spawn, ChildProcess } from 'child_process';
import { BaseAgentImplementation } from './base-agent';
import { AgentConfig, AgentRequest } from '../interfaces/agent.interface';
import { Readable, Writable } from 'stream';

export abstract class CLIAgent extends BaseAgentImplementation {
  protected process: ChildProcess | null = null;
  protected stdin: Writable | null = null;
  protected stdout: Readable | null = null;
  protected stderr: Readable | null = null;
  protected outputBuffer: string = '';
  protected errorBuffer: string = '';
  
  protected abstract getCommand(): string;
  protected abstract getArgs(): string[];
  protected abstract getEnv(): NodeJS.ProcessEnv;

  protected async onInitialize(): Promise<void> {
    const command = this.getCommand();
    const args = this.getArgs();
    const env = { ...process.env, ...this.getEnv() };

    this.logger.info(`Starting CLI process: ${command} ${args.join(' ')}`);

    this.process = spawn(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.stdin = this.process.stdin;
    this.stdout = this.process.stdout;
    this.stderr = this.process.stderr;

    if (this.stdout) {
      this.stdout.on('data', (data) => {
        this.outputBuffer += data.toString();
        this.logger.debug('CLI output:', data.toString());
      });
    }

    if (this.stderr) {
      this.stderr.on('data', (data) => {
        this.errorBuffer += data.toString();
        this.logger.error('CLI error:', data.toString());
      });
    }

    this.process.on('error', (error) => {
      this.logger.error('CLI process error:', error);
      this.status.state = 'error';
    });

    this.process.on('exit', (code, signal) => {
      this.logger.info(`CLI process exited with code ${code}, signal ${signal}`);
      if (code !== 0 && this.status.state !== 'offline') {
        this.status.state = 'error';
      }
    });

    await this.waitForReady();
  }

  protected async waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.logger.info('CLI agent ready');
        resolve();
      }, 2000);
    });
  }

  protected async onExecute(request: AgentRequest): Promise<any> {
    if (!this.process || !this.stdin) {
      throw new Error('CLI process not initialized');
    }

    this.outputBuffer = '';
    this.errorBuffer = '';

    const input = this.formatInput(request);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('CLI command timeout'));
      }, request.timeout || 60000);

      const checkOutput = setInterval(() => {
        const output = this.parseOutput(this.outputBuffer);
        if (output !== null) {
          clearInterval(checkOutput);
          clearTimeout(timeout);
          
          if (this.errorBuffer) {
            this.logger.warn('CLI errors during execution:', this.errorBuffer);
          }
          
          resolve(output);
        }
      }, 100);

      this.stdin!.write(input + '\n');
    });
  }

  protected abstract formatInput(request: AgentRequest): string;
  protected abstract parseOutput(output: string): any | null;

  protected async onShutdown(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process!.kill('SIGKILL');
          resolve();
        }, 5000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
      this.stdin = null;
      this.stdout = null;
      this.stderr = null;
    }
  }
}