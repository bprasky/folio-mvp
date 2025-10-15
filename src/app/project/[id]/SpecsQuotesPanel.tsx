'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Upload, 
  Plus, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import VendorQuickActionsMenu from '@/components/vendor/VendorQuickActionsMenu';

interface Quote {
  id: string;
  vendorId: string;
  version: number;
  fileUrl?: string;
  fileName?: string;
  totalCents?: number;
  currency?: string;
  leadTimeDays?: number;
  termsShort?: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  expiresAt?: string;
  createdAt: string;
  supersedes?: {
    id: string;
    version: number;
  };
}

interface SpecsQuotesPanelProps {
  projectId: string;
  userId: string;
  userRole: string;
}

export default function SpecsQuotesPanel({ projectId, userId, userRole }: SpecsQuotesPanelProps) {
  const [quotes, setQuotes] = useState<Quote[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    roomId: '',
    selectionId: '',
    totalCents: '',
    currency: 'USD',
    leadTimeDays: '',
    termsShort: '',
    expiresAt: '',
    supersedesId: '',
    jsonPayload: '',
  });

  useEffect(() => {
    fetchQuotes();
  }, [projectId]);

  const fetchQuotes = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/quotes`);
      if (response.ok) {
        const { quotes } = await response.json();
        setQuotes(quotes);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast.error('Failed to load quotes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(quoteForm).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      const response = await fetch(`/api/projects/${projectId}/quotes`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success('Quote uploaded successfully!');
        fetchQuotes();
        setIsDialogOpen(false);
        setQuoteForm({
          roomId: '',
          selectionId: '',
          totalCents: '',
          currency: 'USD',
          leadTimeDays: '',
          termsShort: '',
          expiresAt: '',
          supersedesId: '',
          jsonPayload: '',
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading quote:', error);
      toast.error('Failed to upload quote');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStatusChange = async (quoteId: string, status: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/quotes/${quoteId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success('Quote status updated');
        fetchQuotes();
      } else {
        throw new Error('Status update failed');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'SENT':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'EXPIRED':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'SENT':
        return 'bg-blue-100 text-blue-800';
      case 'EXPIRED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quotes & Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Loading quotes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quotes & Specifications</CardTitle>
            <CardDescription>
              Manage quotes and specifications for this project
            </CardDescription>
          </div>
          {userRole === 'VENDOR' && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Attach Quote
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Attach Quote</DialogTitle>
                  <DialogDescription>
                    Upload a quote file or provide structured quote data.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="file" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file">File Upload</TabsTrigger>
                    <TabsTrigger value="structured">Structured</TabsTrigger>
                  </TabsList>
                  <TabsContent value="file" className="space-y-4">
                    <div>
                      <Label htmlFor="file">Quote File</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="structured" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="totalCents">Total (cents)</Label>
                        <Input
                          id="totalCents"
                          type="number"
                          value={quoteForm.totalCents}
                          onChange={(e) => setQuoteForm({ ...quoteForm, totalCents: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="currency">Currency</Label>
                        <Select
                          value={quoteForm.currency}
                          onValueChange={(value) => setQuoteForm({ ...quoteForm, currency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
                      <Input
                        id="leadTimeDays"
                        type="number"
                        value={quoteForm.leadTimeDays}
                        onChange={(e) => setQuoteForm({ ...quoteForm, leadTimeDays: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="termsShort">Terms</Label>
                      <Textarea
                        id="termsShort"
                        value={quoteForm.termsShort}
                        onChange={(e) => setQuoteForm({ ...quoteForm, termsShort: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiresAt">Expires At</Label>
                      <Input
                        id="expiresAt"
                        type="datetime-local"
                        value={quoteForm.expiresAt}
                        onChange={(e) => setQuoteForm({ ...quoteForm, expiresAt: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => {
                          // Handle structured quote submission
                          toast.info('Structured quote submission not implemented yet');
                        }}
                        disabled={isUploading}
                      >
                        Submit Quote
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No quotes available</p>
            <p className="text-sm text-gray-400">
              {userRole === 'VENDOR' ? 'Upload a quote to get started' : 'Vendors can attach quotes to this project'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {quotes.map((quoteChain, chainIndex) => (
              <div key={chainIndex} className="border rounded-lg p-4">
                <div className="space-y-4">
                  {quoteChain.map((quote, quoteIndex) => (
                    <div key={quote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(quote.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {quote.fileName || `Quote v${quote.version}`}
                            </span>
                            <Badge className={getStatusColor(quote.status)}>
                              {quote.status}
                            </Badge>
                            {quote.version > 1 && (
                              <Badge variant="outline">v{quote.version}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(quote.createdAt).toLocaleDateString()}
                            </span>
                            {quote.totalCents && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${(quote.totalCents / 100).toFixed(2)} {quote.currency}
                              </span>
                            )}
                            {quote.leadTimeDays && (
                              <span>Lead time: {quote.leadTimeDays} days</span>
                            )}
                            {quote.expiresAt && (
                              <span className="text-orange-600">
                                Expires: {new Date(quote.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {quote.fileUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={quote.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {quote.fileUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={quote.fileUrl} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {(userRole === 'VENDOR' && quote.vendorId === userId) && (
                          <VendorQuickActionsMenu
                            projectId={projectId}
                            vendorId={userId}
                          />
                        )}
                        {(userRole === 'DESIGNER' || userRole === 'ADMIN') && (
                          <div className="flex gap-1">
                            {quote.status === 'SENT' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStatusChange(quote.id, 'ACCEPTED')}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStatusChange(quote.id, 'REJECTED')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

