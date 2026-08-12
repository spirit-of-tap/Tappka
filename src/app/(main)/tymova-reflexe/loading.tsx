import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner className="size-8 text-muted-foreground" />
    </div>
  );
}
