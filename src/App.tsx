import { Shell } from "@/components/shell";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <TooltipProvider>
      <Shell />
    </TooltipProvider>
  );
}
