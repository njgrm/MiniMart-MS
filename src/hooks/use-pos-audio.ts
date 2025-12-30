"use client";

import { useCallback, useRef, useEffect } from "react";

/**
 * Audio feedback hook for POS operations
 * Provides success beep and error buzz sounds for barcode scanning
 */
export function usePosAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext on first user interaction (required by browsers)
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
    };

    // Initialize on any user interaction
    document.addEventListener("click", initAudio, { once: true });
    document.addEventListener("keydown", initAudio, { once: true });

    return () => {
      document.removeEventListener("click", initAudio);
      document.removeEventListener("keydown", initAudio);
    };
  }, []);

  /**
   * Play a success beep sound (high-pitched, short)
   * Used when an item is successfully scanned/added
   */
  const playSuccessBeep = useCallback(() => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Success sound: High-pitched beep (880Hz - A5)
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.type = "sine";

      // Volume envelope: quick attack, quick decay
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (error) {
      console.warn("Failed to play success beep:", error);
    }
  }, []);

  /**
   * Play an error buzz sound (low-pitched, longer duration)
   * Used when a barcode is not found
   */
  const playErrorBuzz = useCallback(() => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Error sound: Low buzz (220Hz - A3), square wave for harsh tone
      oscillator.frequency.setValueAtTime(220, ctx.currentTime);
      oscillator.type = "square";

      // Volume envelope: two quick buzzes
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      // First buzz
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      // Second buzz
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.25);
    } catch (error) {
      console.warn("Failed to play error buzz:", error);
    }
  }, []);

  /**
   * Play a confirmation/complete sound (two-tone positive)
   * Used when a transaction is completed
   */
  const playConfirmSound = useCallback(() => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;

      // First tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.type = "sine";
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      // Second tone (higher)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      gain2.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.16);
      gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.35);
    } catch (error) {
      console.warn("Failed to play confirm sound:", error);
    }
  }, []);

  return {
    playSuccessBeep,
    playErrorBuzz,
    playConfirmSound,
  };
}
