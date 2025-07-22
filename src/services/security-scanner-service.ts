import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import winston from 'winston';
import { Task } from '../interfaces/task.interface';

const execAsync = promisify(exec);

export interface SecurityScanResult {
  id: string;
  taskId?: string;
  scanType: 'dependency' | 'code' | 'secrets' | 'container' | 'infrastructure';
  tool: string;
  timestamp: Date;
  duration: number;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  status: 'success' | 'failed' | 'partial';
  error?: string;
}

export interface SecurityFinding {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  package?: string;
  version?: string;
  fixedVersion?: string;
  cve?: string;
  cwe?: string;
  owasp?: string;
  remediation?: string;
  references?: string[];
}

export interface SecurityPolicy {
  blockOnCritical: boolean;
  blockOnHigh: boolean;
  allowedLicenses?: string[];
  bannedPackages?: string[];
  customRules?: SecurityRule[];
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  severity: SecurityFinding['severity'];
  message: string;
}

export interface ScannerConfig {
  enabled: boolean;
  tools: {
    npm?: boolean;
    snyk?: boolean;
    trivy?: boolean;
    semgrep?: boolean;
    gitleaks?: boolean;
    eslintSecurity?: boolean;
  };
  paths?: {
    include?: string[];
    exclude?: string[];
  };
  policy?: SecurityPolicy;
}

export class SecurityScannerService extends EventEmitter {
  private logger: winston.Logger;
  private scanResults: Map<string, SecurityScanResult> = new Map();
  private config: ScannerConfig;

  constructor(config?: Partial<ScannerConfig>) {
    super();
    
    this.config = {
      enabled: true,
      tools: {
        npm: true,
        trivy: true,
        semgrep: true,
        gitleaks: true,
        eslintSecurity: true,
        ...config?.tools
      },
      paths: config?.paths,
      policy: {
        blockOnCritical: true,
        blockOnHigh: false,
        ...config?.policy
      }
    };

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

  public async scanTask(task: Task, codePath: string): Promise<SecurityScanResult[]> {
    if (!this.config.enabled) {
      this.logger.info('Security scanning is disabled');
      return [];
    }

    this.logger.info(`Starting security scan for task ${task.id}`);
    const results: SecurityScanResult[] = [];

    // Run different types of scans in parallel
    const scanPromises: Promise<SecurityScanResult | null>[] = [];

    if (this.config.tools.npm) {
      scanPromises.push(this.runNpmAudit(codePath, task.id));
    }

    if (this.config.tools.trivy) {
      scanPromises.push(this.runTrivy(codePath, task.id));
    }

    if (this.config.tools.semgrep) {
      scanPromises.push(this.runSemgrep(codePath, task.id));
    }

    if (this.config.tools.gitleaks) {
      scanPromises.push(this.runGitleaks(codePath, task.id));
    }

    if (this.config.tools.eslintSecurity) {
      scanPromises.push(this.runESLintSecurity(codePath, task.id));
    }

    const scanResults = await Promise.all(scanPromises);
    
    for (const result of scanResults) {
      if (result) {
        results.push(result);
        this.scanResults.set(result.id, result);
        this.emit('scan:completed', result);
      }
    }

    // Check policy violations
    const violations = this.checkPolicyViolations(results);
    if (violations.length > 0) {
      this.emit('policy:violated', { task, violations });
    }

    return results;
  }

  private async runNpmAudit(codePath: string, taskId?: string): Promise<SecurityScanResult | null> {
    const startTime = Date.now();
    const result: SecurityScanResult = {
      id: `npm-${Date.now()}`,
      taskId,
      scanType: 'dependency',
      tool: 'npm-audit',
      timestamp: new Date(),
      duration: 0,
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      status: 'success'
    };

    try {
      // Check if package.json exists
      const packageJsonPath = path.join(codePath, 'package.json');
      await fs.access(packageJsonPath);

      // Run npm audit
      const { stdout } = await execAsync('npm audit --json', { cwd: codePath });
      const auditData = JSON.parse(stdout);

      // Parse vulnerabilities
      if (auditData.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities) as any) {
          const finding: SecurityFinding = {
            id: `npm-${pkg}-${vuln.via?.[0]?.source || Date.now()}`,
            type: 'dependency-vulnerability',
            severity: this.mapNpmSeverity(vuln.severity),
            title: `Vulnerability in ${pkg}`,
            description: vuln.via?.[0]?.title || 'Dependency vulnerability detected',
            package: pkg,
            version: vuln.range,
            fixedVersion: vuln.fixAvailable ? vuln.fixAvailable.version : undefined,
            cve: vuln.via?.[0]?.cve,
            remediation: vuln.fixAvailable ? `Update to version ${vuln.fixAvailable.version}` : 'No fix available',
            references: vuln.via?.[0]?.url ? [vuln.via[0].url] : []
          };

          result.findings.push(finding);
          result.summary[finding.severity]++;
        }
      }

      result.duration = Date.now() - startTime;
      this.logger.info(`NPM audit completed: ${result.findings.length} findings`);
      return result;

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'NPM audit failed';
      result.duration = Date.now() - startTime;
      this.logger.error('NPM audit failed:', error);
      return result;
    }
  }

  private async runTrivy(codePath: string, taskId?: string): Promise<SecurityScanResult | null> {
    const startTime = Date.now();
    const result: SecurityScanResult = {
      id: `trivy-${Date.now()}`,
      taskId,
      scanType: 'container',
      tool: 'trivy',
      timestamp: new Date(),
      duration: 0,
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      status: 'success'
    };

    try {
      // Check if trivy is installed
      await execAsync('which trivy');

      // Run trivy scan
      const { stdout } = await execAsync(
        `trivy fs --format json --severity CRITICAL,HIGH,MEDIUM,LOW ${codePath}`,
        { cwd: codePath, maxBuffer: 10 * 1024 * 1024 }
      );
      
      const trivyData = JSON.parse(stdout);

      // Parse results
      for (const target of trivyData.Results || []) {
        for (const vuln of target.Vulnerabilities || []) {
          const finding: SecurityFinding = {
            id: `trivy-${vuln.VulnerabilityID}-${vuln.PkgName}`,
            type: 'dependency-vulnerability',
            severity: this.mapTrivySeverity(vuln.Severity),
            title: vuln.Title || `${vuln.VulnerabilityID} in ${vuln.PkgName}`,
            description: vuln.Description || 'Vulnerability detected',
            package: vuln.PkgName,
            version: vuln.InstalledVersion,
            fixedVersion: vuln.FixedVersion,
            cve: vuln.VulnerabilityID,
            references: vuln.References || []
          };

          result.findings.push(finding);
          result.summary[finding.severity]++;
        }
      }

      result.duration = Date.now() - startTime;
      this.logger.info(`Trivy scan completed: ${result.findings.length} findings`);
      return result;

    } catch (error) {
      // Trivy might not be installed
      this.logger.warn('Trivy scan skipped:', error);
      return null;
    }
  }

  private async runSemgrep(codePath: string, taskId?: string): Promise<SecurityScanResult | null> {
    const startTime = Date.now();
    const result: SecurityScanResult = {
      id: `semgrep-${Date.now()}`,
      taskId,
      scanType: 'code',
      tool: 'semgrep',
      timestamp: new Date(),
      duration: 0,
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      status: 'success'
    };

    try {
      // Check if semgrep is installed
      await execAsync('which semgrep');

      // Run semgrep with security rules
      const { stdout } = await execAsync(
        `semgrep --config=auto --json --severity ERROR --severity WARNING --severity INFO ${codePath}`,
        { cwd: codePath, maxBuffer: 10 * 1024 * 1024 }
      );
      
      const semgrepData = JSON.parse(stdout);

      // Parse results
      for (const finding of semgrepData.results || []) {
        const securityFinding: SecurityFinding = {
          id: `semgrep-${finding.check_id}-${finding.path}-${finding.start.line}`,
          type: 'code-vulnerability',
          severity: this.mapSemgrepSeverity(finding.extra.severity),
          title: finding.extra.message || finding.check_id,
          description: finding.extra.metadata?.description || 'Security issue detected',
          file: finding.path,
          line: finding.start.line,
          column: finding.start.col,
          owasp: finding.extra.metadata?.owasp?.join(', '),
          cwe: finding.extra.metadata?.cwe?.join(', '),
          remediation: finding.extra.fix || finding.extra.metadata?.remediation,
          references: finding.extra.metadata?.references || []
        };

        result.findings.push(securityFinding);
        result.summary[securityFinding.severity]++;
      }

      result.duration = Date.now() - startTime;
      this.logger.info(`Semgrep scan completed: ${result.findings.length} findings`);
      return result;

    } catch (error) {
      // Semgrep might not be installed
      this.logger.warn('Semgrep scan skipped:', error);
      return null;
    }
  }

  private async runGitleaks(codePath: string, taskId?: string): Promise<SecurityScanResult | null> {
    const startTime = Date.now();
    const result: SecurityScanResult = {
      id: `gitleaks-${Date.now()}`,
      taskId,
      scanType: 'secrets',
      tool: 'gitleaks',
      timestamp: new Date(),
      duration: 0,
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      status: 'success'
    };

    try {
      // Check if gitleaks is installed
      await execAsync('which gitleaks');

      // Run gitleaks scan
      const { stdout } = await execAsync(
        `gitleaks detect --source ${codePath} --report-format json --exit-code 0`,
        { cwd: codePath, maxBuffer: 10 * 1024 * 1024 }
      );
      
      const leaks = stdout ? JSON.parse(stdout) : [];

      // Parse results
      for (const leak of leaks) {
        const finding: SecurityFinding = {
          id: `gitleaks-${leak.RuleID}-${leak.File}-${leak.StartLine}`,
          type: 'secret-exposure',
          severity: 'critical', // Secrets are always critical
          title: `${leak.Description} detected`,
          description: `Secret or sensitive information found: ${leak.RuleID}`,
          file: leak.File,
          line: leak.StartLine,
          remediation: 'Remove the secret from the code and rotate it immediately',
          references: ['https://github.com/zricethezav/gitleaks']
        };

        result.findings.push(finding);
        result.summary.critical++;
      }

      result.duration = Date.now() - startTime;
      this.logger.info(`Gitleaks scan completed: ${result.findings.length} findings`);
      return result;

    } catch (error) {
      // Gitleaks might not be installed
      this.logger.warn('Gitleaks scan skipped:', error);
      return null;
    }
  }

  private async runESLintSecurity(codePath: string, taskId?: string): Promise<SecurityScanResult | null> {
    const startTime = Date.now();
    const result: SecurityScanResult = {
      id: `eslint-${Date.now()}`,
      taskId,
      scanType: 'code',
      tool: 'eslint-security',
      timestamp: new Date(),
      duration: 0,
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      status: 'success'
    };

    try {
      // Check if eslint is available
      const eslintConfigPath = path.join(codePath, '.eslintrc.json');
      const hasEslint = await fs.access(eslintConfigPath).then(() => true).catch(() => false);
      
      if (!hasEslint) {
        // Create a temporary security-focused eslint config
        const securityConfig = {
          extends: ['plugin:security/recommended'],
          plugins: ['security'],
          rules: {
            'security/detect-object-injection': 'warn',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-unsafe-regex': 'error',
            'security/detect-buffer-noassert': 'error',
            'security/detect-child-process': 'warn',
            'security/detect-disable-mustache-escape': 'error',
            'security/detect-eval-with-expression': 'error',
            'security/detect-no-csrf-before-method-override': 'error',
            'security/detect-non-literal-fs-filename': 'warn',
            'security/detect-non-literal-require': 'warn',
            'security/detect-possible-timing-attacks': 'warn'
          }
        };
        
        await fs.writeFile(eslintConfigPath, JSON.stringify(securityConfig, null, 2));
      }

      // Run ESLint with security plugin
      const { stdout } = await execAsync(
        `npx eslint --format json --ext .js,.jsx,.ts,.tsx ${codePath}`,
        { cwd: codePath, maxBuffer: 10 * 1024 * 1024 }
      );
      
      const eslintResults = JSON.parse(stdout);

      // Parse results
      for (const file of eslintResults) {
        for (const message of file.messages || []) {
          if (message.ruleId?.includes('security')) {
            const finding: SecurityFinding = {
              id: `eslint-${message.ruleId}-${file.filePath}-${message.line}`,
              type: 'code-vulnerability',
              severity: this.mapESLintSeverity(message.severity),
              title: message.message,
              description: `Security rule violation: ${message.ruleId}`,
              file: file.filePath,
              line: message.line,
              column: message.column,
              remediation: 'Review and fix the security issue'
            };

            result.findings.push(finding);
            result.summary[finding.severity]++;
          }
        }
      }

      result.duration = Date.now() - startTime;
      this.logger.info(`ESLint security scan completed: ${result.findings.length} findings`);
      return result;

    } catch (error) {
      // ESLint might not be configured
      this.logger.warn('ESLint security scan skipped:', error);
      return null;
    }
  }

  private mapNpmSeverity(severity: string): SecurityFinding['severity'] {
    switch (severity.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate': return 'medium';
      case 'low': return 'low';
      default: return 'info';
    }
  }

  private mapTrivySeverity(severity: string): SecurityFinding['severity'] {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'info';
    }
  }

  private mapSemgrepSeverity(severity: string): SecurityFinding['severity'] {
    switch (severity.toUpperCase()) {
      case 'ERROR': return 'high';
      case 'WARNING': return 'medium';
      case 'INFO': return 'low';
      default: return 'info';
    }
  }

  private mapESLintSeverity(severity: number): SecurityFinding['severity'] {
    return severity === 2 ? 'medium' : 'low';
  }

  private checkPolicyViolations(results: SecurityScanResult[]): string[] {
    const violations: string[] = [];
    
    if (!this.config.policy) return violations;

    for (const result of results) {
      if (this.config.policy.blockOnCritical && result.summary.critical > 0) {
        violations.push(`Critical vulnerabilities found by ${result.tool}: ${result.summary.critical}`);
      }
      
      if (this.config.policy.blockOnHigh && result.summary.high > 0) {
        violations.push(`High vulnerabilities found by ${result.tool}: ${result.summary.high}`);
      }

      // Check for banned packages
      if (this.config.policy.bannedPackages) {
        for (const finding of result.findings) {
          if (finding.package && this.config.policy.bannedPackages.includes(finding.package)) {
            violations.push(`Banned package detected: ${finding.package}`);
          }
        }
      }
    }

    return violations;
  }

  public async generateSecurityReport(results: SecurityScanResult[]): Promise<string> {
    let report = '# Security Scan Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    report += '## Summary\n\n';
    const totalSummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    for (const result of results) {
      totalSummary.critical += result.summary.critical;
      totalSummary.high += result.summary.high;
      totalSummary.medium += result.summary.medium;
      totalSummary.low += result.summary.low;
      totalSummary.info += result.summary.info;
    }

    report += `- **Critical**: ${totalSummary.critical}\n`;
    report += `- **High**: ${totalSummary.high}\n`;
    report += `- **Medium**: ${totalSummary.medium}\n`;
    report += `- **Low**: ${totalSummary.low}\n`;
    report += `- **Info**: ${totalSummary.info}\n\n`;

    // Detailed findings by tool
    for (const result of results) {
      report += `## ${result.tool} Results\n\n`;
      
      if (result.findings.length === 0) {
        report += 'No issues found.\n\n';
        continue;
      }

      // Group by severity
      const bySeverity = result.findings.reduce((acc, finding) => {
        if (!acc[finding.severity]) acc[finding.severity] = [];
        acc[finding.severity].push(finding);
        return acc;
      }, {} as Record<string, SecurityFinding[]>);

      for (const [severity, findings] of Object.entries(bySeverity)) {
        report += `### ${severity.toUpperCase()}\n\n`;
        
        for (const finding of findings) {
          report += `**${finding.title}**\n`;
          report += `- ${finding.description}\n`;
          if (finding.file) report += `- File: ${finding.file}:${finding.line || 0}\n`;
          if (finding.package) report += `- Package: ${finding.package} ${finding.version || ''}\n`;
          if (finding.cve) report += `- CVE: ${finding.cve}\n`;
          if (finding.remediation) report += `- Remediation: ${finding.remediation}\n`;
          report += '\n';
        }
      }
    }

    return report;
  }

  public getScanResults(taskId?: string): SecurityScanResult[] {
    if (taskId) {
      return Array.from(this.scanResults.values()).filter(r => r.taskId === taskId);
    }
    return Array.from(this.scanResults.values());
  }

  public async runCustomRules(codePath: string, rules: SecurityRule[]): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    
    // Get all source files
    const files = await this.getSourceFiles(codePath);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      for (const rule of rules) {
        lines.forEach((line, index) => {
          if (rule.pattern.test(line)) {
            findings.push({
              id: `custom-${rule.id}-${file}-${index}`,
              type: 'custom-rule',
              severity: rule.severity,
              title: rule.name,
              description: rule.message,
              file,
              line: index + 1,
              remediation: rule.description
            });
          }
        });
      }
    }
    
    return findings;
  }

  private async getSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip common directories
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          files.push(...await this.getSourceFiles(fullPath));
        }
      } else if (entry.isFile()) {
        // Include common source file extensions
        if (/\.(js|jsx|ts|tsx|py|java|go|rb|php|cs)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }
}