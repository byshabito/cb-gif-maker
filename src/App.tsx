import { GifMakerShell } from "@/components/gif-maker-shell";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <TooltipProvider>
      <GifMakerShell />
    </TooltipProvider>
  );
}
