import { AxisShell } from "../../components/axis/AxisShell";
import { axisCapabilities, axisNavigationItems } from "../../lib/axis/capabilities";
import { AXIS_UI_V2_ENABLED } from "../../lib/axis/client";
import { axisRecentOutputs, axisSuggestedCommands } from "../../lib/axis/mock-data";

export default function AxisPage() {
  return (
    <AxisShell
      capabilities={axisCapabilities}
      navigation={axisNavigationItems}
      outputs={axisRecentOutputs}
      suggestions={axisSuggestedCommands}
      uiV2Enabled={AXIS_UI_V2_ENABLED}
    />
  );
}
