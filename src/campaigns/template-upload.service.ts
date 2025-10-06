import { Injectable, BadRequestException } from '@nestjs/common';
import AdmZip = require('adm-zip');
import * as path from 'path';

@Injectable()
export class TemplateUploadService {
  /**
   * Process uploaded HTML file
   */
  async processHtmlFile(file: Express.Multer.File): Promise<{ htmlContent: string; plainText: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const allowedMimes = ['text/html', 'application/zip', 'application/x-zip-compressed'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only HTML and ZIP files are allowed');
    }

    // If it's a ZIP file, extract and process
    if (file.mimetype.includes('zip')) {
      return this.processZipFile(file);
    }

    // Process single HTML file
    const htmlContent = file.buffer.toString('utf-8');
    const plainText = this.extractPlainText(htmlContent);

    return { htmlContent, plainText };
  }

  /**
   * Process ZIP file containing HTML templates
   */
  private async processZipFile(file: Express.Multer.File): Promise<{ htmlContent: string; plainText: string }> {
    try {
      const zip = new AdmZip(file.buffer);
      const zipEntries = zip.getEntries();

      // Find the main HTML file (index.html or first .html file)
      let mainHtmlEntry = zipEntries.find(entry =>
        entry.entryName.toLowerCase() === 'index.html' ||
        entry.entryName.toLowerCase().endsWith('/index.html')
      );

      if (!mainHtmlEntry) {
        mainHtmlEntry = zipEntries.find(entry =>
          entry.entryName.toLowerCase().endsWith('.html') && !entry.isDirectory
        );
      }

      if (!mainHtmlEntry) {
        throw new BadRequestException('No HTML file found in ZIP archive');
      }

      // Extract HTML content
      const htmlContent = mainHtmlEntry.getData().toString('utf-8');

      // Process inline images and CSS
      const processedHtml = this.inlineAssets(htmlContent, zip, path.dirname(mainHtmlEntry.entryName));
      const plainText = this.extractPlainText(processedHtml);

      return { htmlContent: processedHtml, plainText };
    } catch (error) {
      throw new BadRequestException(`Failed to process ZIP file: ${error.message}`);
    }
  }

  /**
   * Inline CSS and convert images to base64
   */
  private inlineAssets(html: string, zip: AdmZip, basePath: string): string {
    let processedHtml = html;

    // Process CSS links
    const cssRegex = /<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi;
    processedHtml = processedHtml.replace(cssRegex, (match, cssPath) => {
      try {
        const fullPath = this.resolvePath(basePath, cssPath);
        const cssEntry = zip.getEntry(fullPath);

        if (cssEntry) {
          const cssContent = cssEntry.getData().toString('utf-8');
          return `<style>${cssContent}</style>`;
        }
      } catch (error) {
        console.warn(`Could not inline CSS: ${cssPath}`);
      }
      return match;
    });

    // Process images - convert to base64
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    processedHtml = processedHtml.replace(imgRegex, (match, imgPath) => {
      try {
        // Skip external URLs
        if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
          return match;
        }

        const fullPath = this.resolvePath(basePath, imgPath);
        const imgEntry = zip.getEntry(fullPath);

        if (imgEntry) {
          const imgBuffer = imgEntry.getData();
          const ext = path.extname(imgPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
          };

          const mimeType = mimeTypes[ext] || 'image/png';
          const base64 = imgBuffer.toString('base64');

          return match.replace(imgPath, `data:${mimeType};base64,${base64}`);
        }
      } catch (error) {
        console.warn(`Could not inline image: ${imgPath}`);
      }
      return match;
    });

    return processedHtml;
  }

  /**
   * Resolve relative paths in ZIP file
   */
  private resolvePath(basePath: string, relativePath: string): string {
    // Remove leading ./
    relativePath = relativePath.replace(/^\.\//, '');

    // If basePath is empty or root, just return the relative path
    if (!basePath || basePath === '.' || basePath === '/') {
      return relativePath;
    }

    // Join paths and normalize
    const joined = path.join(basePath, relativePath);
    // Convert Windows paths to ZIP paths (forward slashes)
    return joined.replace(/\\/g, '/');
  }

  /**
   * Extract plain text from HTML for preview
   */
  private extractPlainText(html: string): string {
    // Remove scripts and styles
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Limit to first 500 characters for preview
    return text.substring(0, 500);
  }

  /**
   * Validate HTML content
   */
  validateHtmlContent(html: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for basic HTML structure
    if (!html.includes('<html') && !html.includes('<HTML')) {
      errors.push('Missing <html> tag');
    }

    // Check for body tag
    if (!html.includes('<body') && !html.includes('<BODY')) {
      errors.push('Missing <body> tag');
    }

    // Warn about external resources (but don't fail)
    const externalResources = [
      ...html.match(/<link[^>]+href=["']https?:\/\/[^"']+["']/gi) || [],
      ...html.match(/<script[^>]+src=["']https?:\/\/[^"']+["']/gi) || [],
    ];

    if (externalResources.length > 0) {
      console.warn('Warning: Template contains external resources that may not load in all email clients');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
