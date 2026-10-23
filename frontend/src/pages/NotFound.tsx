import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold text-foreground">404</h1>
      <p className="text-muted-foreground">頁面不存在</p>
      <Button asChild variant="outline">
        <Link to="/">返回任務監控</Link>
      </Button>
    </div>
  );
}
