import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export function CryptoWatchlistSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[288px] overflow-hidden">
        <Table aria-label="Loading watchlist">
          <TableBody>
            {Array.from({ length: 4 }, (_, index) => (
              <TableRow key={index} className="border-0">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="ml-auto w-fit space-y-2 text-right">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="ml-auto h-3 w-12" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
