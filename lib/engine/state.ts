export function determineState(
  homeControl: number,
  awayControl: number
) {
  if (homeControl > 72) {
    return "HOME CONTROL";
  }

  if (awayControl > 72) {
    return "AWAY CONTROL";
  }

  if (Math.abs(homeControl - awayControl) < 10) {
    return "CONTROL CONTESTED";
  }

  return "CONTROL SHIFTING";
}