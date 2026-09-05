export interface Lead {
  id: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  source: string;
  score: number;
  tags: string[];
  notes?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED';
  cik?: string;
  filingDate?: string;
  filingType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  cik: string;
  name: string;
  ticker?: string;
  exchange?: string;
  industry?: string;
  description?: string;
  address?: string;
  website?: string;
  leads: Lead[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}