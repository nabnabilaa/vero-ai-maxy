export type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  showMap?: boolean;
  mapQuery?: string;
  isVoice?: boolean;
  imageUrl?: string;
  showWhatsApp?: boolean;
  whatsAppText?: string;
  showWebsite?: boolean;
  websiteLink?: string;
  websiteText?: string;
  suggestions?: string[];
};

export type AgentData = {
  id: string;
  name: string;
  role: string;
  tone: string;
  language: string;
  instructions: string;
  goal: string;
  industry: string;
  voice_type?: string;
  quick_actions?: string;
};

export type IndustryColors = {
  primary: string;
  gradient: string;
  bg: string;
  accent: string;
};

export type PlaceResult = {
  name: string;
  lat: number;
  lon: number;
  type: string;
  address?: string;
};
