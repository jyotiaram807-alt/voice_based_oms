import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { VoiceParseResult, Product } from "@/types";
import { Minus, Plus, Check, RefreshCw, AlertTriangle } from "lucide-react";

interface VoiceFallbackModalProps {
  open: boolean;
  onClose: () => void;
  rawTranscript: string;
  parseResult: VoiceParseResult | null;
  products: Product[];
  onConfirmItems: (items: { productId: string; quantity: number }[]) => void;
  onReprocess: (transcript: string) => void;
  errorMessage?: string;
}

const VoiceFallbackModal = ({
  open,
  onClose,
  rawTranscript,
  parseResult,
  products,
  onConfirmItems,
  onReprocess,
  errorMessage,
}: VoiceFallbackModalProps) => {
  const [editedTranscript, setEditedTranscript] = useState(rawTranscript);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    parseResult?.parsed.forEach((p) => {
      map[p.productId] = p.quantity;
    });
    return map;
  });

  const handleConfirm = () => {
    const items = Object.entries(itemQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    onConfirmItems(items);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Review Voice Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">What we heard:</label>
            <Textarea
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReprocess(editedTranscript)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-process
            </Button>
          </div>

          {parseResult && parseResult.parsed.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Matched items:</label>
              <div className="space-y-2">
                {parseResult.parsed.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <div key={item.productId} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product?.name || item.productName}</p>
                        <Badge variant={item.confidence >= 0.7 ? "default" : "secondary"} className="text-[10px] mt-1">
                          {Math.round(item.confidence * 100)}% match
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setItemQuantities((prev) => ({
                            ...prev,
                            [item.productId]: Math.max(0, (prev[item.productId] || 1) - 1),
                          }))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-semibold w-6 text-center">
                          {itemQuantities[item.productId] || 0}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setItemQuantities((prev) => ({
                            ...prev,
                            [item.productId]: (prev[item.productId] || 0) + 1,
                          }))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {parseResult?.unmatchedSegments && parseResult.unmatchedSegments.length > 0 && (
            <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning-foreground">
              <p className="font-medium mb-1">Could not match:</p>
              <p className="text-muted-foreground">{parseResult.unmatchedSegments.join(", ")}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={Object.values(itemQuantities).every((q) => q === 0)} className="gap-1.5">
            <Check className="h-4 w-4" />
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceFallbackModal;
