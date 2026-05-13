"use client"

import { create } from "zustand"

type SessionState = {
  playbackId: string | null
  currentTime: number
  isPlaying: boolean

  setPlaybackId: (id: string) => void
  setCurrentTime: (time: number) => void
  setPlaying: (playing: boolean) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  playbackId: null,
  currentTime: 0,
  isPlaying: false,

  setPlaybackId: (id) =>
    set({
      playbackId: id,
    }),

  setCurrentTime: (time) =>
    set({
      currentTime: time,
    }),

  setPlaying: (playing) =>
    set({
      isPlaying: playing,
    }),
}))