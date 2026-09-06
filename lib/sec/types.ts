export interface SecCompany {
  cik: string;
  name: string;
  ticker?: string;
  exchange?: string;
  sic?: string;
  industry?: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  employees?: number;
  revenue?: number;
}

export interface SecFiling {
  accessionNo: string;
  type: string;
  url: string;
  date: string;
  periodEnd?: string;
  companyName?: string;
  cik?: string;
}

export interface SecExecutive {
  name: string;
  title: string;
  cik: string;
  source: string;
  email?: string;
  company?: string;
}