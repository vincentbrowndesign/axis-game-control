export type AxisCalibrationPointType =
  | "rim"
  | "left_floor"
  | "right_floor"
  | "paint_left"
  | "paint_right"
  | "free_throw"
  | "custom";

export type AxisCalibrationPoint = {
  id: string;
  type: AxisCalibrationPointType;
  x: number;
  y: number;
  label: string;
  createdAt: number;
};

export type AxisCalibrationState = {
  mode: "off" | "set_rim" | "set_floor" | "set_paint" | "custom";
  points: AxisCalibrationPoint[];
  rim?: AxisCalibrationPoint;
  floorLine?: [AxisCalibrationPoint, AxisCalibrationPoint];
  paintPoints: AxisCalibrationPoint[];
  updatedAt: number;
};
