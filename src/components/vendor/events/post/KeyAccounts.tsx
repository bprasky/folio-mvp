'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, UserCheck } from "lucide-react";
import type { FirmInfluence } from "@/lib/mock/eventPost";
import { formatCurrency, formatCompactNumber } from "@/lib/format";

interface KeyAccountsProps {
  firms: FirmInfluence[];
}

export function KeyAccounts({ firms }: KeyAccountsProps) {
  // Separate new and reactivated accounts
  const newAccounts = firms.filter(f => f.isNew);
  const reactivatedAccounts = firms.filter(f => f.reactivated);
  const existingAccounts = firms.filter(f => !f.isNew && !f.reactivated);

  return (
    <div className="space-y-6">
      {/* Top Firms by Influence */}
      <Card className="bg-white border-[#DAD2CA]">
        <CardHeader>
          <CardTitle className="text-lg font-serif text-[#2B2B2B] flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#8C8278]" />
            <span>Key Accounts & Influence</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {firms.slice(0, 5).map((firm, index) => (
              <div key={firm.firm} className="flex items-center justify-between p-4 bg-[#F7F4F1] rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm font-medium text-[#8C8278] w-6">
                      #{index + 1}
                    </span>
                    <h4 className="font-medium text-[#2B2B2B]">{firm.firm}</h4>
                    <div className="flex space-x-2">
                      {firm.isNew && (
                        <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                          New
                        </Badge>
                      )}
                      {firm.reactivated && (
                        <Badge className="text-xs bg-[var(--accent)]/10 text-blue-800 border-[var(--accent)]/20">
                          Reactivated
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm text-[#8C8278] ml-9">
                    <div className="flex items-center space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{firm.contacts.length} contacts</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{firm.projects} projects</span>
                    </div>
                    <span className="font-medium text-[#2B2B2B]">
                      {formatCurrency(firm.valueUsd, 'USD', true)}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="text-xs">
                    Schedule Review
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    Assign Rep
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* New Accounts */}
        <Card className="bg-white border-[#DAD2CA]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-[#2B2B2B]">New Accounts</h4>
                <p className="text-sm text-[#8C8278]">
                  {newAccounts.length} acquired this event
                </p>
              </div>
            </div>
            {newAccounts.length > 0 ? (
              <div className="space-y-2">
                {newAccounts.map((account) => (
                  <div key={account.firm} className="flex items-center justify-between">
                    <span className="text-sm text-[#2B2B2B]">{account.firm}</span>
                    <span className="text-xs text-[#8C8278]">
                      {formatCurrency(account.valueUsd, 'USD', true)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#8C8278]">No new accounts this event</p>
            )}
          </CardContent>
        </Card>

        {/* Reactivated Accounts */}
        <Card className="bg-white border-[#DAD2CA]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-full flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div>
                <h4 className="font-medium text-[#2B2B2B]">Reactivated Accounts</h4>
                <p className="text-sm text-[#8C8278]">
                  {reactivatedAccounts.length} dormant accounts
                </p>
              </div>
            </div>
            {reactivatedAccounts.length > 0 ? (
              <div className="space-y-2">
                {reactivatedAccounts.map((account) => (
                  <div key={account.firm} className="flex items-center justify-between">
                    <span className="text-sm text-[#2B2B2B]">{account.firm}</span>
                    <span className="text-xs text-[#8C8278]">
                      {formatCurrency(account.valueUsd, 'USD', true)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#8C8278]">No reactivated accounts this event</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}









