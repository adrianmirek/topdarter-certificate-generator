export interface CertificateStatsInput {
  average_score?: number | null;
  high_finish?: number;
  best_leg?: number | string;
  score_140_count?: number;
  score_170_count?: number;
}

export interface CertificateAIPromptInput {
  display_name: string;
  tournament_name?: string;
  tournament_date?: string;
  rank?: number;
  certificate_code?: string;
  watermark_detection_image_url: string;
  watermark_image_url: string;
  stats: CertificateStatsInput;
}
