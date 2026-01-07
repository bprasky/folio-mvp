import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  'data-testid'?: string;
}

export function ChartCard({ title, subtitle, children, ...props }: ChartCardProps) {
  return (
    <Card className="bg-white border-[#DAD2CA]" {...props}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-serif text-[#2B2B2B]">
          {title}
        </CardTitle>
        {subtitle && (
          <p className="text-sm text-[#8C8278]">
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









