import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

/**
 * Developer links component that displays local development tools
 * Only visible in development mode
 */
export function DeveloperLinks() {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!isDevelopment) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Developer Tools</CardTitle>
        <CardDescription>
          Local development services running on your machine
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full justify-between"
            asChild
          >
            <Link
              href="http://127.0.0.1:54323"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Supabase Studio</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between"
            asChild
          >
            <Link
              href="http://127.0.0.1:54324"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Mailpit</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
