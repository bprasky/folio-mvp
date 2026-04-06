'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecommendedInvite } from "@/lib/mock/eventAnalytics";
import { UserPlus, Mail } from "lucide-react";
import { FocusContext } from "@/lib/suggestions/types";

interface RecommendedInvitesProps {
  invites: RecommendedInvite[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function RecommendedInvites({ invites, onHover }: RecommendedInvitesProps) {
  return (
    <Card className="bg-white border-folio-border-strong">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-folio-text-primary">
          Recommended Invites
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invites.map((invite, index) => (
            <div 
              key={invite.id} 
              className="flex items-start justify-between p-4 bg-surface-elevated rounded-lg cursor-pointer hover:bg-[#F0EDE8] transition-colors"
              data-testid={`invite-${index}`}
              onMouseEnter={() => onHover?.({
                type: 'designer', // Treat invites as designers for suggestion purposes
                key: invite.id,
                data: invite
              })}
              onMouseLeave={() => onHover?.(null)}
            >
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 bg-[#8C8278] rounded-full flex items-center justify-center text-white font-semibold text-xs">
                    {invite.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="font-medium text-folio-text-primary text-sm">
                    {invite.name}
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className="text-xs bg-[#8C8278]/10 text-folio-text-secondary border-[#8C8278]/20"
                >
                  {invite.reason}
                </Badge>
              </div>
              
              <div className="flex flex-col space-y-2 ml-4">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs border-folio-border-strong"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Invite
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs border-folio-border-strong"
                >
                  <Mail className="w-3 h-3 mr-1" />
                  Message
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
