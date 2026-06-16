// Integration adapters — mock implementations for local dev; swap for production providers

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, string>;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ success: boolean; error?: string }>;
}

export class MockEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    if (process.env.MOCK_EMAIL_ENABLED === "true") {
      // Production: replace with Microsoft Graph / Outlook shared mailbox
      return { success: true };
    }
    return { success: false, error: "Email not configured" };
  }
}

export interface DocumentFolder {
  name: string;
  path: string;
}

export interface DocumentRepositoryProvider {
  provisionFolders(driveId: string, folders: DocumentFolder[]): Promise<void>;
}

export class MockDocumentRepositoryProvider implements DocumentRepositoryProvider {
  async provisionFolders(_driveId: string, _folders: DocumentFolder[]) {
    // Future: SharePoint integration
  }
}

export interface BIExportProvider {
  exportReport(reportType: string, data: unknown): Promise<string>;
}

export class MockBIExportProvider implements BIExportProvider {
  async exportReport(reportType: string, _data: unknown) {
    return `mock-export-${reportType}-${Date.now()}.csv`;
  }
}

export interface HRISProvider {
  getTenure(employeeId: string): Promise<number>;
  getEmployee(employeeId: string): Promise<{ name: string; email: string; managerEmail: string } | null>;
}

export class MockHRISProvider implements HRISProvider {
  async getTenure(employeeId: string) {
    const num = parseInt(employeeId.replace(/\D/g, ""), 10) || 100;
    return (num % 200) + 30;
  }
  async getEmployee(employeeId: string) {
    return { name: `Employee ${employeeId}`, email: `${employeeId.toLowerCase()}@company.com`, managerEmail: "manager@company.com" };
  }
}

export interface LMSProvider {
  getTrainingStatus(employeeId: string, track: string): Promise<boolean>;
}

export class MockLMSProvider implements LMSProvider {
  async getTrainingStatus(employeeId: string, _track: string) {
    const num = parseInt(employeeId.replace(/\D/g, ""), 10) || 0;
    return num % 3 !== 0;
  }
}

export interface VoucherVendorProvider {
  validateCode(vendor: string, code: string): Promise<boolean>;
}

export class MockVoucherVendorProvider implements VoucherVendorProvider {
  async validateCode(_vendor: string, _code: string) {
    return true;
  }
}

export const emailProvider = new MockEmailProvider();
export const documentRepository = new MockDocumentRepositoryProvider();
export const biExport = new MockBIExportProvider();
export const hris = new MockHRISProvider();
export const lms = new MockLMSProvider();
export const voucherVendor = new MockVoucherVendorProvider();
