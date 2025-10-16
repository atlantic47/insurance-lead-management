import { IsString, IsOptional, IsObject } from 'class-validator';

export class SetupCredentialsDto {
  @IsObject()
  @IsOptional()
  facebook?: {
    appId: string;
    accessToken: string;
    webhookVerifyToken: string;
  };

  @IsObject()
  @IsOptional()
  whatsapp?: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
    webhookVerifyToken: string;
  };

  @IsObject()
  @IsOptional()
  email?: {
    provider: 'sendgrid' | 'smtp';
    sendgridApiKey?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    fromEmail?: string;
    fromName?: string;
  };

  @IsObject()
  @IsOptional()
  flutterwave?: {
    publicKey: string;
    secretKey: string;
    encryptionKey: string;
  };
}
