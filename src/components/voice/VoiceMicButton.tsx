import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VoiceState } from "@/hooks/useVoiceOrder";

interface VoiceMicButtonProps {
  voiceState: VoiceState;
  onStart: () => void;
  onStop: () => void;
  size?: "sm" | "lg";
  micVolume?: number;
}

const VoiceMicButton = ({ voiceState, onStart, onStop, size = "sm" }: VoiceMicButtonProps) => {
  const isListening = voiceState === "listening";
  const isProcessing = voiceState === "processing";
  const isLarge = size === "lg";

  return (
    <div className="relative inline-flex items-center justify-center">
      {isListening && (
        <>
          <span className={cn(
            "absolute rounded-full bg-destructive/20 animate-pulse-ring",
            isLarge ? "h-20 w-20" : "h-14 w-14"
          )} />
          <span className={cn(
            "absolute rounded-full bg-destructive/10 animate-pulse-ring",
            isLarge ? "h-24 w-24" : "h-16 w-16"
          )} style={{ animationDelay: "0.5s" }} />
        </>
      )}
      <Button
        onClick={isListening ? onStop : onStart}
        disabled={isProcessing}
        className={cn(
          "relative rounded-full transition-all duration-300",
          isLarge ? "h-16 w-16" : "h-11 w-11",
          "p-0",
          isListening && "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg",
          isProcessing && "bg-muted text-muted-foreground cursor-wait",
          !isListening && !isProcessing && "gradient-accent text-accent-foreground shadow-button hover:opacity-90"
        )}
        title={isListening ? "Stop listening" : isProcessing ? "Processing..." : "Voice order"}
      >
        {isProcessing ? (
          <Loader2 size={isLarge ? 24 : 18} className="animate-spin" />
        ) : isListening ? (
          <MicOff size={isLarge ? 24 : 18} />
        ) : (
          <Mic size={isLarge ? 24 : 18} />
        )}
      </Button>
      {isListening && (
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-semibold text-destructive whitespace-nowrap animate-pulse">
          Listening…
        </span>
      )}
      {isProcessing && (
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground whitespace-nowrap">
          Processing…
        </span>
      )}
    </div>
  );
};

export default VoiceMicButton;
