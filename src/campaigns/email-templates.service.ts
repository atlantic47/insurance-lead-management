import { Injectable } from '@nestjs/common';

export interface EmailTemplate {
  name: string;
  description: string;
  subject: string;
  htmlContent: string;
  previewImage?: string;
}

@Injectable()
export class EmailTemplatesService {
  /**
   * Get all predefined professional email templates
   */
  getPredefinedTemplates(): EmailTemplate[] {
    return [
      {
        name: 'Welcome Email - Professional',
        description: 'Clean professional welcome email for new leads',
        subject: 'Welcome to {companyName} - Your Insurance Partner',
        htmlContent: this.getWelcomeTemplate(),
      },
      {
        name: 'Policy Quote - Banking Style',
        description: 'Professional policy quote with pricing table',
        subject: 'Your Insurance Quote from {companyName}',
        htmlContent: this.getPolicyQuoteTemplate(),
      },
      {
        name: 'Follow-up - Modern',
        description: 'Modern follow-up email with call-to-action',
        subject: 'Following up on your insurance inquiry',
        htmlContent: this.getFollowUpTemplate(),
      },
      {
        name: 'Renewal Reminder - Corporate',
        description: 'Corporate-style policy renewal reminder',
        subject: 'Policy Renewal Reminder - Action Required',
        htmlContent: this.getRenewalTemplate(),
      },
      {
        name: 'Thank You - Elegant',
        description: 'Elegant thank you email for new customers',
        subject: 'Thank you for choosing {companyName}',
        htmlContent: this.getThankYouTemplate(),
      },
    ];
  }

  private getWelcomeTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Welcome to Our Family</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                Dear <strong>{firstName} {lastName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #555555;">
                Thank you for your interest in our insurance services. We're committed to providing you with comprehensive coverage and exceptional service.
              </p>

              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #555555;">
                Our team will review your requirements and get back to you within 24 hours with a personalized insurance plan tailored to your needs.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="border-collapse: collapse;">
                <tr>
                  <td style="border-radius: 4px; background-color: #667eea;">
                    <a href="#" style="display: inline-block; padding: 14px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      View Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                Best regards,<br>
                <strong>The Insurance Team</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getPolicyQuoteTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background-color: #1e3a8a; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600;">Your Insurance Quote</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                Dear <strong>{firstName} {lastName}</strong>,
              </p>

              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #555555;">
                Based on your requirements, we've prepared a customized insurance quote for you:
              </p>

              <!-- Pricing Table -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Coverage Type</th>
                    <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 12px; font-size: 14px; color: #555555; border-bottom: 1px solid #e5e7eb;">Basic Coverage</td>
                    <td style="padding: 12px; text-align: right; font-size: 14px; color: #555555; border-bottom: 1px solid #e5e7eb;">$XXX.XX/month</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px; font-size: 14px; color: #555555; border-bottom: 1px solid #e5e7eb;">Additional Benefits</td>
                    <td style="padding: 12px; text-align: right; font-size: 14px; color: #555555; border-bottom: 1px solid #e5e7eb;">$XXX.XX/month</td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 12px; font-size: 16px; font-weight: 600; color: #1e3a8a;">Total Monthly Premium</td>
                    <td style="padding: 12px; text-align: right; font-size: 16px; font-weight: 600; color: #1e3a8a;">$XXX.XX</td>
                  </tr>
                </tbody>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="border-collapse: collapse;">
                <tr>
                  <td style="border-radius: 4px; background-color: #1e3a8a;">
                    <a href="#" style="display: inline-block; padding: 14px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Accept Quote
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                Questions? Contact us at: <a href="mailto:support@insurance.com" style="color: #1e3a8a;">support@insurance.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                This quote is valid for 30 days from the date of issue.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getFollowUpTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600;">Following Up on Your Inquiry</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                Hi <strong>{firstName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #555555;">
                I wanted to follow up on your recent inquiry about our insurance services. Do you have any questions or need clarification on any of our offerings?
              </p>

              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #555555;">
                I'm here to help you find the perfect coverage that meets your needs and budget.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="border-collapse: collapse;">
                <tr>
                  <td style="border-radius: 4px; background-color: #0ea5e9;">
                    <a href="#" style="display: inline-block; padding: 14px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Schedule a Call
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 14px; color: #666666;">
                Best regards,<br>
                <strong>Your Insurance Agent</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getRenewalTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background-color: #dc2626; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600;">Policy Renewal Notice</h1>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="padding: 20px 40px; background-color: #fef3c7; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">
                ⚠️ Action Required: Your policy expires in 30 days
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                Dear <strong>{firstName} {lastName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #555555;">
                This is a reminder that your insurance policy is due for renewal. To ensure continuous coverage, please review and renew your policy before the expiration date.
              </p>

              <!-- Info Box -->
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;"><strong>Policy Number:</strong> {policyNumber}</p>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;"><strong>Expiration Date:</strong> {expirationDate}</p>
                <p style="margin: 0; font-size: 14px; color: #666666;"><strong>Renewal Premium:</strong> {renewalAmount}</p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="border-collapse: collapse;">
                <tr>
                  <td style="border-radius: 4px; background-color: #dc2626;">
                    <a href="#" style="display: inline-block; padding: 14px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Renew Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                Please renew before your policy expires to avoid any lapse in coverage.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getThankYouTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); text-align: center;">
              <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 32px; font-weight: 600;">Thank You!</h1>
              <p style="margin: 0; color: #ffffff; font-size: 16px; opacity: 0.9;">We appreciate your trust in us</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                Dear <strong>{firstName} {lastName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #555555;">
                Thank you for choosing us as your insurance partner. We're honored to have you as part of our family and look forward to serving you.
              </p>

              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #555555;">
                Your policy documents will be sent to you within 24 hours. If you have any questions, our team is always here to help.
              </p>

              <!-- Features -->
              <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 30px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #065f46;">What's Next?</p>
                <ul style="margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px; font-size: 14px; color: #374151;">Download your policy documents</li>
                  <li style="margin-bottom: 8px; font-size: 14px; color: #374151;">Set up your online account</li>
                  <li style="font-size: 14px; color: #374151;">Contact us for any questions</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="border-collapse: collapse;">
                <tr>
                  <td style="border-radius: 4px; background-color: #10b981;">
                    <a href="#" style="display: inline-block; padding: 14px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Access Your Account
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                Warm regards,<br>
                <strong>The {companyName} Team</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                We're here to protect what matters most to you.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Replace template variables with actual values
   */
  replaceVariables(htmlContent: string, variables: Record<string, string>): string {
    let result = htmlContent;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value || '');
    }

    return result;
  }
}
