import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  'data-testid'?: string;
}

export function ChartCard({ title, subtitle, children, ...props }: ChartCardProps) {
  return (
    <Card className="bg-surface-canvas border-folio-border-strong" {...props}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-serif text-folio-text-primary">
          {title}
        </CardTitle>
        {subtitle && (
          <p className="text-sm text-folio-text-secondary">
            {subtitle}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}









