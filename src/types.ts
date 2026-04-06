export interface ScanInput {
  systemName:    string;
  description:   string;
  deployment:    string;
  dataTypes:     string[];
  decisionMaker: string;
  humanOverride: string;
  industry:      string;
}

export interface DimensionScores {
  transparency:    number;
  accountability:  number;
  dataGovernance:  number;
  humanOversight:  number;
  riskManagement:  number;
}

export interface EuGap {
  article:     string;
  description: string;
  severity:    string;
}

export interface NistGap {
  function:    string;
  subcategory: string;
  description: string;
}

export interface Control {
  action:   string;
  priority: 'Critical' | 'High' | 'Medium';
}

export interface ScanResult {
  riskTier:         string;
  riskRationale:    string;
  readinessScore:   number;
  scores:           DimensionScores;
  euGaps:           EuGap[];
  nistGaps:         NistGap[];
  controls:         Control[];
  executiveSummary: string;
}

export interface ScanResponse {
  success: boolean;
  result?: ScanResult;
  error?:  string;
}
