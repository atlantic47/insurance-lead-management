import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import axios from 'axios';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

@Injectable()
export class WhatsAppTokenService {
  private readonly logger = new Logger(WhatsAppTokenService.name);
  private cachedToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async getValidAccessToken(): Promise<string> {
    // Check if cached token is still valid
    if (this.cachedToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.cachedToken;
    }

    // Try to get token from database
    const dbToken = await this.getTokenFromDatabase();
    if (dbToken && dbToken.expiresAt && new Date() < dbToken.expiresAt) {
      this.cachedToken = dbToken.token;
      this.tokenExpiry = dbToken.expiresAt;
      return dbToken.token;
    }

    // Try to refresh the token
    const refreshedToken = await this.refreshAccessToken();
    if (refreshedToken) {
      return refreshedToken;
    }

    // Don't fallback to env token - throw error instead
    this.logger.error('❌ No valid token available');
    this.logger.warn('📝 Please generate a new User Access Token with WhatsApp permissions');
    this.logger.warn('🔧 Use POST /whatsapp/token/set to provide a valid token');
    throw new Error('No valid access token available. Please set a new token with proper WhatsApp permissions.');
  }

  private async refreshAccessToken(): Promise<string | null> {
    try {
      const appId = this.configService.get('FACEBOOK_APP_ID');
      const appSecret = this.configService.get('FACEBOOK_APP_SECRET');
      // Don't use env token - we need fresh tokens
      const currentToken = this.cachedToken;

      if (!appId || !appSecret) {
        this.logger.warn('Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET for token refresh');
        return null;
      }

      if (!currentToken) {
        this.logger.warn('No current token available for exchange');
        return null;
      }

      // Method 1: Try to extend the current token
      const extendUrl = `https://graph.facebook.com/oauth/access_token`;
      const extendResponse = await axios.get(extendUrl, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: currentToken,
        },
      });

      if (extendResponse.data.access_token) {
        const newToken = extendResponse.data.access_token;
        const expiresIn = extendResponse.data.expires_in || 60 * 24 * 60 * 60; // Default 60 days
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        await this.saveTokenToDatabase(newToken, expiresAt);
        
        this.cachedToken = newToken;
        this.tokenExpiry = expiresAt;
        
        this.logger.log('Successfully refreshed WhatsApp access token');
        return newToken;
      }
    } catch (error) {
      this.logger.error('Failed to refresh access token:', error.response?.data || error.message);
    }

    // Don't generate app tokens - they won't work for WhatsApp Business API
    this.logger.warn('App tokens are not suitable for WhatsApp Business API');
    this.logger.warn('Please use POST /whatsapp/token/set to provide a User Access Token');

    return null;
  }

  private async getTokenFromDatabase() {
    try {
      const tokenRecord = await this.prisma.aIConversation.findFirst({
        where: {
          type: 'WHATSAPP_TOKEN'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (tokenRecord && tokenRecord.metadata) {
        const metadata = tokenRecord.metadata as any;
        return {
          token: metadata.access_token,
          expiresAt: metadata.expires_at ? new Date(metadata.expires_at) : null,
        };
      }
    } catch (error) {
      this.logger.error('Error getting token from database:', error);
    }
    return null;
  }

  private async saveTokenToDatabase(token: string, expiresAt: Date) {
    try {
      await this.prisma.aIConversation.create({
      // @ts-ignore - tenantId added by Prisma middleware
        data: {
          type: 'WHATSAPP_TOKEN',
          input: 'Token refresh',
          output: 'Token saved',
          confidence: 1.0,
          metadata: {
            access_token: token,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString(),
            token_type: 'whatsapp_business_api'
          }
        }
      });
      this.logger.log('Saved new token to database');
    } catch (error) {
      this.logger.error('Error saving token to database:', error);
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get('https://graph.facebook.com/v18.0/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        params: {
          fields: 'id,name'
        }
      });

      if (response.status === 200 && response.data.id) {
        this.logger.log('Token validation successful');
        return true;
      }
    } catch (error) {
      this.logger.error('Token validation failed:', error.response?.data || error.message);
    }
    return false;
  }

  async getTokenInfo(): Promise<any> {
    try {
      const token = await this.getValidAccessToken();
      const response = await axios.get('https://graph.facebook.com/v18.0/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        params: {
          fields: 'id,name'
        }
      });

      return {
        valid: true,
        tokenInfo: response.data,
        expiresAt: this.tokenExpiry,
        source: this.cachedToken ? 'cached' : 'database'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.response?.data || error.message,
        expiresAt: this.tokenExpiry
      };
    }
  }

  // Method to manually set a new token (for when you get one from Facebook Console)
  async setNewToken(token: string, expiresInDays: number = 60): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    
    // Validate the token first
    const isValid = await this.validateToken(token);
    if (!isValid) {
      throw new Error('Invalid token provided');
    }

    await this.saveTokenToDatabase(token, expiresAt);
    this.cachedToken = token;
    this.tokenExpiry = expiresAt;
    
    this.logger.log(`New token set and saved, expires at: ${expiresAt.toISOString()}`);
  }
}