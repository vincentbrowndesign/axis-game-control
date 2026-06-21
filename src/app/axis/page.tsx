import { AxisShell } from "../../components/axis/AxisShell";
import { axisCapabilities, axisNavigationItems } from "../../lib/axis/capabilities";
import { AXIS_UI_V2_ENABLED } from "../../lib/axis/client";
import {
  axisActivityItems,
  axisProjectStatus,
  axisRecentOutputs,
  axisRunSteps,
  axisSuggestedCommands,
} from "../../lib/axis/mock-data";

export default function AxisPage() {
  return (
    <AxisShell
      activity={axisActivityItems}
      capabilities={axisCapabilities}
      navigation={axisNavigationItems}
      outputs={axisRecentOutputs}
      projectStatus={axisProjectStatus}
      runSteps={axisRunSteps}
      suggestions={axisSuggestedCommands}
      uiV2Enabled={AXIS_UI_V2_ENABLED}
    />
  );
}
