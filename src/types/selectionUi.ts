export type SelectionUiMeta = {
  displaySize?: 'auto'|'large'|'medium'|'small';
  featured?: boolean;
  dimensions?: { 
    widthIn?: number; 
    depthIn?: number; 
    heightIn?: number; 
  };
  slotKey?: string; // allow redundancy with column if you prefer everything in uiMeta
};

