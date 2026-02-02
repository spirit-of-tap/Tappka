"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MyReservations } from "./my-reservations";
import { AvailableCoworks } from "./available-coworks";
import type { ReservationWithDetails } from "@/lib/reservations/types";

interface ReservationsTabsProps {
  myReservations: ReservationWithDetails[];
  joinedCoworks: ReservationWithDetails[];
  availableCoworks: ReservationWithDetails[];
}

/**
 * Handles responsive layout: side-by-side on desktop, tabs on mobile
 */
export function ReservationsTabs({ 
  myReservations,
  joinedCoworks,
  availableCoworks 
}: ReservationsTabsProps) {
  return (
    <>
      {/* Desktop: Side-by-side layout (hidden on mobile) */}
      <div className="hidden md:grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Moje rezervace</CardTitle>
          </CardHeader>
          <CardContent>
            <MyReservations reservations={myReservations} joinedCoworks={joinedCoworks} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Otevřené coworky</CardTitle>
          </CardHeader>
          <CardContent>
            <AvailableCoworks coworks={availableCoworks} />
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Tabs (hidden on desktop) */}
      <Card className="md:hidden">
        <Tabs defaultValue="mine">
          <CardHeader>
            <TabsList className="w-full">
              <TabsTrigger value="mine" className="flex-1">
                Moje rezervace
              </TabsTrigger>
              <TabsTrigger value="coworks" className="flex-1">
                Otevřené coworky
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <CardContent>
            <TabsContent value="mine">
              <MyReservations reservations={myReservations} joinedCoworks={joinedCoworks} />
            </TabsContent>
            
            <TabsContent value="coworks">
              <AvailableCoworks coworks={availableCoworks} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </>
  );
}
