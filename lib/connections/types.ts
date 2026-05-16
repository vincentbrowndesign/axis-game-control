export type MemoryConnectionType =
  | "same_player"
  | "same_warmup"
  | "repeated_rhythm"
  | "recurring_reset"
  | "recurring_cadence"
  | "repeated_structure"
  | "practice_to_game_transfer"
  | "same_practice_block"
  | "team_pattern"

export type MemoryConnection = {
  id: string
  fromMemoryId: string
  toMemoryId: string
  type: MemoryConnectionType
  confidence: number
  evidence: string[]
}
