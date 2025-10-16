import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface WidgetToken {
  tenantId: string;
  widgetId: string;
  domain?: string;
  expiresAt: number;
}

/**
 * WidgetAuthService - Handles authentication for AI widget
 *
 * CRITICAL SECURITY: Widgets are embedded on client sites and are public-facing.
 * We use signed tokens to verify the tenant context without exposing tenant IDs
 * in the public widget code.
 */
@Injectable()
export class WidgetAuthService {
  private readonly logger = new Logger(WidgetAuthService.name);
  private readonly secret: string;

  constructor(private configService: ConfigService) {
    this.secret = this.configService.get<string>('WIDGET_SECRET') || 'fallback-widget-secret-CHANGE-THIS';

    if (this.secret === 'fallback-widget-secret-CHANGE-THIS') {
      this.logger.warn('⚠️ WIDGET_SECRET not set! Using fallback secret. Set WIDGET_SECRET in .env for production!');
    }
  }

  /**
   * Generate a signed token for widget authentication
   * @param tenantId - The tenant ID that owns this widget
   * @param widgetId - Unique widget identifier
   * @param domain - Optional domain restriction
   * @param ttl - Time to live in seconds (default: 24 hours)
   */
  generateWidgetToken(
    tenantId: string,
    widgetId: string,
    domain?: string,
    ttl: number = 86400
  ): string {
    const payload: WidgetToken = {
      tenantId,
      widgetId,
      domain,
      expiresAt: Date.now() + (ttl * 1000),
    };

    const payloadStr = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadStr).toString('base64url');

    // Sign the payload
    const signature = this.signPayload(payloadBase64);

    // Return format: payload.signature
    return `${payloadBase64}.${signature}`;
  }

  /**
   * Verify and decode a widget token
   * @param token - The signed widget token
   * @param requestDomain - Optional domain to verify against token
   */
  verifyWidgetToken(token: string, requestDomain?: string): WidgetToken {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) {
        throw new Error('Invalid token format');
      }

      const [payloadBase64, signature] = parts;

      // Verify signature
      const expectedSignature = this.signPayload(payloadBase64);
      if (signature !== expectedSignature) {
        this.logger.error('🚨 WIDGET TOKEN: Invalid signature');
        throw new UnauthorizedException('Invalid widget token signature');
      }

      // Decode payload
      const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      const payload: WidgetToken = JSON.parse(payloadStr);

      // Check expiration
      if (payload.expiresAt < Date.now()) {
        this.logger.error('🚨 WIDGET TOKEN: Token expired');
        throw new UnauthorizedException('Widget token expired');
      }

      // Check domain restriction if specified
      if (payload.domain && requestDomain) {
        const tokenDomain = this.normalizeDomain(payload.domain);
        const reqDomain = this.normalizeDomain(requestDomain);

        if (tokenDomain !== reqDomain) {
          this.logger.error(
            `🚨 WIDGET TOKEN: Domain mismatch. Expected: ${tokenDomain}, Got: ${reqDomain}`
          );
          throw new UnauthorizedException('Widget token domain mismatch');
        }
      }

      this.logger.debug(`✅ Widget token verified for tenant: ${payload.tenantId}`);
      return payload;

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error verifying widget token:', error);
      throw new UnauthorizedException('Invalid widget token');
    }
  }

  /**
   * Generate a public widget configuration that includes the signed token
   * This is what gets embedded in the client's website
   */
  generateWidgetConfig(tenantId: string, widgetId: string, domain?: string) {
    const token = this.generateWidgetToken(tenantId, widgetId, domain);

    return {
      widgetId,
      token,
      apiUrl: this.configService.get<string>('API_URL') || 'http://localhost:3000',
      // DO NOT include tenantId here - it's verified via token
    };
  }

  /**
   * Sign a payload using HMAC-SHA256
   */
  private signPayload(payload: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }

  /**
   * Normalize domain for comparison
   */
  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }
}
