# Axis Vision Acceptance Bugfix

Axis Vision should pass the first user acceptance loop: open Vision, see why player lock works or fails, flip camera, save evidence in Debug, export evidence, and use Log/Review without mock content.

## Detection Test

1. Open `/vision`.
2. Tap `Start Vision`.
3. Stand one person in frame.
4. Product mode should show one clean P1/player box.
5. If Product mode still says `Player searching`, switch to Debug.
6. Confirm Debug shows:
   - raw detection count
   - mapped player count
   - candidate player count
   - stable player count
   - last rejected reason
   - detector response summary
   - capture, detector, and rendered sizes

If raw detections exist but stable player count is zero, the last rejected reason should explain why.

## Camera Flip Test

1. Start Vision on a phone or iPad with front and back cameras.
2. Tap the camera flip icon.
3. The current video tracks should stop and the opposite camera should open.
4. Detection should resume after the flip.
5. If only one camera is available, Debug should show `Only one camera found`.

## Save Evidence Test

1. Start Vision.
2. Switch to Debug.
3. Tap `Save Test Frame`.
4. Add one or more quick quality labels.
5. Open `/measure/review`.
6. The saved frame should appear with image preview, object count, labels, review actions, and delete.

Saved evidence should include stabilized objects and raw detections when available.

## JSON Export Test

1. Open `/measure/review`.
2. Save at least one evidence frame first.
3. Tap `Export JSON`.
4. The browser should download `axis-measure-evidence-YYYY-MM-DD.json`.
5. If download is blocked, tap `Copy JSON`.
6. The page should show `Download started` or `Copied`.

## Log And Review Test

1. Open `/axis`.
2. Choose `Log`.
3. Confirm the form says:
   - `Log Work`
   - `Save what matters without needing the camera.`
   - `Today's work`
   - `Player or group`
   - `What changed?`
   - `Save Memory`
4. Choose `Review`.
5. If no memory exists, Review should show:
   - `No memory yet.`
   - `Use Vision or Log to save the first one.`
6. Review should not show stale mock cards unless they were actually saved by the user.
