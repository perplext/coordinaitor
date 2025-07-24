import axios from 'axios';
import winston from 'winston';
import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { Task, Project } from '../interfaces/task.interface';
import { Agent } from '../interfaces/agent.interface';

export interface NotificationConfig {
  slack?: {
    webhookUrl: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
  };
  teams?: {
    webhookUrl: string;
  };
  email?: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    to: string[];
  };
}

export interface NotificationEvent {
  type: 'task:completed' | 'task:failed' | 'project:completed' | 'agent:error' | 'workflow:completed' | 'workflow:failed';
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  data?: any;
  timestamp: Date;
}

export class NotificationService {
  private logger: winston.Logger;
  private config: NotificationConfig;
  private emailTransporter?: Transporter;

  constructor(config: NotificationConfig) {
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

    // Initialize email transporter if config provided
    if (this.config.email?.smtp) {
      this.emailTransporter = nodemailer.createTransport({
        host: this.config.email.smtp.host,
        port: this.config.email.smtp.port,
        secure: this.config.email.smtp.secure,
        auth: {
          user: this.config.email.smtp.auth.user,
          pass: this.config.email.smtp.auth.pass
        }
      });

      // Verify email configuration
      this.emailTransporter.verify().then(() => {
        this.logger.info('Email notification service configured successfully');
      }).catch((error) => {
        this.logger.error('Email configuration error:', error);
        this.emailTransporter = undefined;
      });
    }
  }

  public async notify(event: NotificationEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.slack) {
      promises.push(this.sendSlackNotification(event));
    }

    if (this.config.teams) {
      promises.push(this.sendTeamsNotification(event));
    }

    if (this.config.email) {
      promises.push(this.sendEmailNotification(event));
    }

    await Promise.allSettled(promises);
  }

  private async sendSlackNotification(event: NotificationEvent): Promise<void> {
    if (!this.config.slack) return;

    const color = this.getSlackColor(event.level);
    const emoji = this.getSlackEmoji(event.type);

    const payload = {
      channel: this.config.slack.channel,
      username: this.config.slack.username || 'Multi-Agent Orchestrator',
      icon_emoji: this.config.slack.iconEmoji || ':robot_face:',
      attachments: [
        {
          color,
          fallback: `${emoji} ${event.title}`,
          title: `${emoji} ${event.title}`,
          text: event.message,
          fields: this.getSlackFields(event),
          footer: 'Multi-Agent Orchestrator',
          ts: Math.floor(event.timestamp.getTime() / 1000)
        }
      ]
    };

    try {
      await axios.post(this.config.slack.webhookUrl, payload);
      this.logger.info('Slack notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Slack notification:', error);
    }
  }

  private async sendTeamsNotification(event: NotificationEvent): Promise<void> {
    if (!this.config.teams) return;

    const color = this.getTeamsColor(event.level);
    const emoji = this.getSlackEmoji(event.type);

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: color,
      summary: event.title,
      sections: [
        {
          activityTitle: `${emoji} ${event.title}`,
          activitySubtitle: new Date(event.timestamp).toLocaleString(),
          text: event.message,
          facts: this.getTeamsFacts(event)
        }
      ]
    };

    try {
      await axios.post(this.config.teams.webhookUrl, payload);
      this.logger.info('Teams notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Teams notification:', error);
    }
  }

  private async sendEmailNotification(event: NotificationEvent): Promise<void> {
    if (!this.emailTransporter || !this.config.email?.defaultRecipients) {
      this.logger.warn('Email notification skipped: No transporter or recipients configured');
      return;
    }

    try {
      const subject = this.getEmailSubject(event);
      const html = this.getEmailHtml(event);
      const recipients = this.config.email.defaultRecipients.join(', ');

      await this.emailTransporter.sendMail({
        from: this.config.email.from || 'Multi-Agent Orchestrator <noreply@orchestrator.com>',
        to: recipients,
        subject: subject,
        html: html,
        text: this.getEmailText(event) // Plain text fallback
      });

      this.logger.info(`Email notification sent to ${recipients}`);
    } catch (error) {
      this.logger.error('Failed to send email notification:', error);
      throw error;
    }
  }

  private getEmailSubject(event: NotificationEvent): string {
    const levelEmoji = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };

    return `${levelEmoji[event.level]} ${event.type.toUpperCase()}: ${event.title}`;
  }

  private getEmailHtml(event: NotificationEvent): string {
    const levelColor = {
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      info: '#17a2b8'
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${levelColor[event.level]}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0;">${event.title}</h2>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
          <p style="color: #495057; margin: 10px 0;">${event.message}</p>
          ${event.details ? `
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin-top: 15px;">
              <h3 style="margin-top: 0; color: #495057;">Details:</h3>
              <pre style="white-space: pre-wrap; color: #212529;">${JSON.stringify(event.details, null, 2)}</pre>
            </div>
          ` : ''}
          ${event.data ? `
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin-top: 15px;">
              <h3 style="margin-top: 0; color: #495057;">Additional Data:</h3>
              <pre style="white-space: pre-wrap; color: #212529;">${JSON.stringify(event.data, null, 2)}</pre>
            </div>
          ` : ''}
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 12px; margin: 0;">
            Sent at ${new Date(event.timestamp).toLocaleString()} by Multi-Agent Orchestrator
          </p>
        </div>
      </div>
    `;
  }

  private getEmailText(event: NotificationEvent): string {
    let text = `${event.level.toUpperCase()}: ${event.title}\n\n${event.message}\n`;
    
    if (event.details) {
      text += `\nDetails:\n${JSON.stringify(event.details, null, 2)}\n`;
    }
    
    if (event.data) {
      text += `\nAdditional Data:\n${JSON.stringify(event.data, null, 2)}\n`;
    }
    
    text += `\n---\nSent at ${new Date(event.timestamp).toLocaleString()}`;
    
    return text;
  }

  private getSlackColor(level: NotificationEvent['level']): string {
    switch (level) {
      case 'success':
        return 'good';
      case 'warning':
        return 'warning';
      case 'error':
        return 'danger';
      default:
        return '#36a64f';
    }
  }

  private getTeamsColor(level: NotificationEvent['level']): string {
    switch (level) {
      case 'success':
        return '00FF00';
      case 'warning':
        return 'FFA500';
      case 'error':
        return 'FF0000';
      default:
        return '0078D4';
    }
  }

  private getSlackEmoji(type: NotificationEvent['type']): string {
    switch (type) {
      case 'task:completed':
        return '✅';
      case 'task:failed':
        return '❌';
      case 'project:completed':
        return '🎉';
      case 'agent:error':
        return '🚨';
      case 'workflow:completed':
        return '🔄';
      case 'workflow:failed':
        return '⚠️';
      default:
        return '📢';
    }
  }

  private getSlackFields(event: NotificationEvent): any[] {
    const fields = [];

    if (event.data) {
      if (event.data.task) {
        fields.push(
          { title: 'Task ID', value: event.data.task.id, short: true },
          { title: 'Priority', value: event.data.task.priority, short: true }
        );
      }

      if (event.data.agent) {
        fields.push(
          { title: 'Agent', value: event.data.agent.name, short: true },
          { title: 'Provider', value: event.data.agent.provider, short: true }
        );
      }

      if (event.data.duration) {
        fields.push({
          title: 'Duration',
          value: `${(event.data.duration / 1000).toFixed(1)}s`,
          short: true
        });
      }

      if (event.data.error) {
        fields.push({
          title: 'Error',
          value: event.data.error,
          short: false
        });
      }
    }

    return fields;
  }

  private getTeamsFacts(event: NotificationEvent): any[] {
    const facts = [];

    if (event.data) {
      if (event.data.task) {
        facts.push(
          { name: 'Task ID', value: event.data.task.id },
          { name: 'Priority', value: event.data.task.priority }
        );
      }

      if (event.data.agent) {
        facts.push(
          { name: 'Agent', value: event.data.agent.name },
          { name: 'Provider', value: event.data.agent.provider }
        );
      }

      if (event.data.duration) {
        facts.push({
          name: 'Duration',
          value: `${(event.data.duration / 1000).toFixed(1)}s`
        });
      }

      if (event.data.error) {
        facts.push({
          name: 'Error',
          value: event.data.error
        });
      }
    }

    return facts;
  }

  // Helper methods for common notifications
  public async notifyTaskCompleted(task: Task, agent?: any, duration?: number): Promise<void> {
    await this.notify({
      type: 'task:completed',
      title: 'Task Completed',
      message: `Task "${task.title}" has been completed successfully.`,
      level: 'success',
      data: { task, agent, duration },
      timestamp: new Date()
    });
  }

  public async notifyTaskFailed(task: Task, error: string, agent?: any): Promise<void> {
    await this.notify({
      type: 'task:failed',
      title: 'Task Failed',
      message: `Task "${task.title}" has failed: ${error}`,
      level: 'error',
      data: { task, error, agent },
      timestamp: new Date()
    });
  }

  public async notifyProjectCompleted(project: Project, stats?: any): Promise<void> {
    await this.notify({
      type: 'project:completed',
      title: 'Project Completed',
      message: `Project "${project.name}" has been completed successfully.`,
      level: 'success',
      data: { project, stats },
      timestamp: new Date()
    });
  }

  public async notifyAgentError(agent: any, error: string): Promise<void> {
    await this.notify({
      type: 'agent:error',
      title: 'Agent Error',
      message: `Agent "${agent.name}" encountered an error: ${error}`,
      level: 'error',
      data: { agent, error },
      timestamp: new Date()
    });
  }

  public async notifyWorkflowCompleted(workflow: any, execution: any): Promise<void> {
    await this.notify({
      type: 'workflow:completed',
      title: 'Workflow Completed',
      message: `Workflow "${workflow.name}" has completed successfully.`,
      level: 'success',
      data: { workflow, execution },
      timestamp: new Date()
    });
  }

  public async notifyWorkflowFailed(workflow: any, execution: any, error: string): Promise<void> {
    await this.notify({
      type: 'workflow:failed',
      title: 'Workflow Failed',
      message: `Workflow "${workflow.name}" has failed: ${error}`,
      level: 'error',
      data: { workflow, execution, error },
      timestamp: new Date()
    });
  }

  public async notifyApprovalRequired(params: {
    approvalRequest: any;
    approverId: string;
  }): Promise<void> {
    const { approvalRequest, approverId } = params;
    await this.notify({
      type: 'approval:required',
      title: 'Approval Required',
      message: `Your approval is required for "${approvalRequest.stepName}" in workflow "${approvalRequest.workflowName}"`,
      level: 'warning',
      data: { approvalRequest, approverId },
      timestamp: new Date(),
      metadata: {
        approvalId: approvalRequest.id,
        workflowExecutionId: approvalRequest.workflowExecutionId,
        description: approvalRequest.description
      }
    });
  }

  public async notifyApprovalResolved(params: {
    approvalRequest: any;
    resolution: 'approved' | 'rejected' | 'expired';
  }): Promise<void> {
    const { approvalRequest, resolution } = params;
    const level = resolution === 'approved' ? 'success' : 'warning';
    const title = `Approval ${resolution.charAt(0).toUpperCase() + resolution.slice(1)}`;
    
    await this.notify({
      type: 'approval:resolved',
      title,
      message: `Approval for "${approvalRequest.stepName}" has been ${resolution}`,
      level,
      data: { approvalRequest, resolution },
      timestamp: new Date()
    });
  }
}