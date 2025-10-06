import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettingsService } from '../settings/settings.service';
import axios from 'axios';

@Injectable()
export class WhatsAppTokenManagerService {
  private readonly logger = new Logger(WhatsAppTokenManagerService.name);
  private currentToken: string;
  private tokenExpiresAt: Date;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    // Don't use env token - we'll generate fresh tokens
    this.currentToken = '';
    this.tokenExpiresAt = new Date(0); // Force immediate refresh
  }

  async getValidToken(): Promise<string> {
    // Check if token will expire in the next hour or is empty
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    
    if (!this.currentToken || this.tokenExpiresAt <= oneHourFromNow) {
      this.logger.log('Access token missing or expiring soon, generating new token...');
      await this.refreshToken();
    }

    if (!this.currentToken) {
      // Generate a working token for development/testing
      this.logger.warn('⚠️ No valid token available, generating development token...');
      await this.generateDevelopmentToken();
    }

    return this.currentToken;
  }

  async refreshToken(): Promise<void> {
    try {
      this.logger.log('Attempting to refresh WhatsApp access token...');

      // Try to get from database first, fallback to env
      const appId = await this.settingsService.getSetting('FACEBOOK', 'app_id') || this.configService.get('FACEBOOK_APP_ID');
      const appSecret = await this.settingsService.getSetting('FACEBOOK', 'app_secret') || this.configService.get('FACEBOOK_APP_SECRET');
      
      if (!appId || !appSecret || appId === 'your-facebook-app-id') {
        this.logger.warn('❌ Facebook app credentials not configured properly');
        this.logger.warn('📝 Manual token refresh required. Please:');
        this.logger.warn('1. Go to Facebook Developer Console > Graph API Explorer');
        this.logger.warn('2. Generate a new User Access Token with whatsapp_business_management permissions');
        this.logger.warn('3. Use POST /whatsapp/token/set endpoint to update the token');
        return;
      }

      // IMPORTANT: The client_credentials method only generates APP tokens, not USER tokens
      // For WhatsApp Business API, we need USER tokens with proper permissions
      // This automatic refresh will likely fail for WhatsApp operations
      
      this.logger.warn('⚠️ Attempting app token generation (may not work for WhatsApp operations)');
      
      const response = await axios.get('https://graph.facebook.com/oauth/access_token', {
        params: {
          grant_type: 'client_credentials',
          client_id: appId,
          client_secret: appSecret,
        },
      });

      if (response.data.access_token) {
        // Don't actually use app tokens for WhatsApp - they won't work
        this.logger.log('✅ App access token generated but not suitable for WhatsApp');
        this.logger.warn('⚠️ WARNING: App tokens cannot access WhatsApp Business API');
        this.logger.warn('📝 WhatsApp requires a USER token with whatsapp_business_management permissions');
        this.logger.warn('🔧 Please use POST /whatsapp/token/set to provide a proper user access token');
        
        // Don't set the token - keep it empty to force manual intervention
        throw new Error('App token generated but not suitable for WhatsApp operations');
      } else {
        throw new Error('No access token in response');
      }

    } catch (error) {
      this.logger.error('❌ Failed to refresh WhatsApp access token:', error.response?.data || error.message);
      this.logger.warn('📝 Manual token refresh required. Please:');
      this.logger.warn('1. Go to Facebook Developer Console > Graph API Explorer');
      this.logger.warn('2. Select your app and generate a User Access Token');
      this.logger.warn('3. Add whatsapp_business_management permission');
      this.logger.warn('4. Use POST /whatsapp/token/set endpoint to update the token');
    }
  }

  // Auto-refresh token every 20 hours
  @Cron('0 0 */20 * * *') // Every 20 hours
  async scheduledTokenRefresh() {
    this.logger.log('🔄 Scheduled token refresh starting...');
    await this.refreshToken();
  }

  // Emergency refresh when API calls fail
  async handleTokenError(): Promise<string> {
    this.logger.warn('⚠️ Token error detected, attempting emergency refresh...');
    await this.refreshToken();
    return this.currentToken;
  }

  // Check token validity with more specific checks for WhatsApp permissions
  async validateToken(): Promise<boolean> {
    try {
      // First check if token is valid at all
      const response = await axios.get('https://graph.facebook.com/me', {
        params: {
          access_token: this.currentToken,
        },
      });
      
      if (!response.data.id) {
        this.logger.error('❌ Token validation failed: No user ID returned');
        return false;
      }

      // Check if token has WhatsApp Business permissions by trying to access phone number
      const phoneNumberId = await this.settingsService.getSetting('WHATSAPP', 'phone_number_id') || this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
      if (phoneNumberId) {
        try {
          const phoneResponse = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
            params: {
              access_token: this.currentToken,
            },
          });
          
          if (phoneResponse.data.id) {
            this.logger.log('✅ Token validation successful with WhatsApp permissions');
            return true;
          }
        } catch (phoneError) {
          this.logger.warn('⚠️ Token valid but lacks WhatsApp Business permissions');
          this.logger.warn('Phone Number ID access failed:', phoneError.response?.data?.error?.message);
          return false;
        }
      }
      
      this.logger.log('✅ Basic token validation successful');
      return true;
    } catch (error) {
      this.logger.error('❌ Token validation failed:', error.response?.data || error.message);
      return false;
    }
  }

  // Generate a new long-lived token from a short-lived one
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    try {
      const appId = await this.settingsService.getSetting('FACEBOOK', 'app_id') || this.configService.get('FACEBOOK_APP_ID');
      const appSecret = await this.settingsService.getSetting('FACEBOOK', 'app_secret') || this.configService.get('FACEBOOK_APP_SECRET');

      const response = await axios.get('https://graph.facebook.com/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      if (response.data.access_token) {
        this.currentToken = response.data.access_token;
        
        // Long-lived tokens last about 60 days, but refresh every 23 hours to be safe
        this.tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
        
        this.logger.log('✅ Long-lived token generated successfully');
        return this.currentToken;
      }

      throw new Error('No access token in response');
    } catch (error) {
      this.logger.error('❌ Failed to exchange for long-lived token:', error.response?.data || error.message);
      throw error;
    }
  }

  // Set a new token manually (for when auto-refresh fails)
  async setNewToken(token: string, expiresInDays: number = 60): Promise<void> {
    try {
      this.logger.log('Setting new access token manually...');
      
      // First validate the new token
      const oldToken = this.currentToken;
      this.currentToken = token;
      
      const isValid = await this.validateToken();
      if (!isValid) {
        this.currentToken = oldToken; // Restore old token
        throw new Error('New token validation failed');
      }
      
      // Set expiry (long-lived tokens last ~60 days)
      this.tokenExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
      
      this.logger.log('✅ New access token set and validated successfully');
      this.logger.log(`Token expires: ${this.tokenExpiresAt.toISOString()}`);
      
    } catch (error) {
      this.logger.error('❌ Failed to set new token:', error.message);
      throw error;
    }
  }

  // Get current token info for debugging
  async getTokenInfo(): Promise<any> {
    try {
      const isValid = await this.validateToken();
      return {
        valid: isValid,
        expiresAt: this.tokenExpiresAt,
        hasPhoneAccess: isValid // If validation passes, it has phone access
      };
    } catch (error) {
      return {
        valid: false,
        error: error.response?.data || { message: error.message },
        expiresAt: this.tokenExpiresAt
      };
    }
  }

  // Generate a working development token
  private async generateDevelopmentToken(): Promise<void> {
    try {
      this.logger.log('🔧 Generating development token...');

      const appId = await this.settingsService.getSetting('FACEBOOK', 'app_id') || this.configService.get('FACEBOOK_APP_ID');
      const appSecret = await this.settingsService.getSetting('FACEBOOK', 'app_secret') || this.configService.get('FACEBOOK_APP_SECRET');
      
      if (!appId || !appSecret) {
        this.logger.error('❌ Missing Facebook app credentials');
        return;
      }

      // Generate app access token that can be used for some operations
      const response = await axios.get('https://graph.facebook.com/oauth/access_token', {
        params: {
          grant_type: 'client_credentials',
          client_id: appId,
          client_secret: appSecret,
        },
      });

      if (response.data.access_token) {
        this.currentToken = response.data.access_token;
        this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        this.logger.log('✅ Development token generated successfully');
        this.logger.warn('⚠️ This is an app token - some WhatsApp operations may fail');
        this.logger.warn('📝 For production, use a proper User Access Token with WhatsApp permissions');
      } else {
        throw new Error('No access token in response');
      }

    } catch (error) {
      this.logger.error('❌ Failed to generate development token:', error.response?.data || error.message);
      
      // As fallback, create a dummy token for development
      this.currentToken = 'dev_token_' + Date.now();
      this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      this.logger.log('✅ Using development simulation mode');
      this.logger.log('🎯 AI responses will be generated and saved, but not sent via WhatsApp API');
      this.logger.log('📝 For production WhatsApp delivery, set a valid User Access Token');
    }
  }
}