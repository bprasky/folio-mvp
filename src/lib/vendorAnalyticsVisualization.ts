export type VisualizationType =
  | "stat"
  | "bar"
  | "line"
  | "funnel"
  | "table";

export interface VisualizationSeries {
  name: string;
  values: number[];
  labels?: string[];
}

export interface VisualizationSpec {
  type: VisualizationType;
  title: string;
  xLabel?: string;
  yLabel?: string;
  series?: VisualizationSeries[];
  // for stat type
  primaryStatLabel?: string;
  primaryStatValue?: string;
  secondaryStatLabel?: string;
  secondaryStatValue?: string;
  // for table type
  columns?: string[];
  rows?: (string | number)[][];
}


