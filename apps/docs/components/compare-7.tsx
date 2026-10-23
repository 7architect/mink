import { cn } from '@/lib/utils';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface CompareRow {
  feature: string;
  primary: string;
  secondary: string;
  secondaryTooltip?: {
    title: string;
    description: string;
  };
}

export interface Compare7Props {
  heading?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  rows?: CompareRow[];
  className?: string;
}

export const Compare7 = ({
  heading = 'Compare',
  description = '',
  primaryLabel = 'Primary',
  secondaryLabel = 'Secondary',
  rows = [],
  className,
}: Compare7Props) => {
  return (
    <TooltipProvider>
      <section className={cn('py-32', className)}>
        <div className="container">
          <h2 className="mb-4 text-[30px] leading-[1.2] font-normal tracking-[-0.025em] md:text-[34px]">
            {heading}
          </h2>
          <p className="mb-8 max-w-xl text-muted-foreground">{description}</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table className="text-left">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-4 font-medium">Feature</TableHead>
                  <TableHead className="bg-muted px-6 py-4 font-medium text-foreground">
                    {primaryLabel}
                  </TableHead>
                  <TableHead className="px-6 py-4 font-medium text-muted-foreground">
                    {secondaryLabel}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-foreground">
                {rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="px-6 py-4 whitespace-normal">{row.feature}</TableCell>
                    <TableCell className="bg-muted px-6 py-4 whitespace-normal">
                      {row.primary}
                    </TableCell>
                    <TableCell className="relative px-6 py-4 whitespace-normal text-muted-foreground">
                      {row.secondaryTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-pointer underline decoration-dotted">
                              {row.secondary}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={8} className="max-w-xs">
                            <span className="mb-1 block font-semibold">
                              {row.secondaryTooltip.title}
                            </span>
                            {row.secondaryTooltip.description}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        row.secondary
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
};
