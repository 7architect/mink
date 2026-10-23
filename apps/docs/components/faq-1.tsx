import { cn } from '@/lib/utils';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface Faq1Props {
  heading?: string;
  items?: FaqItem[];
  className?: string;
}

export const Faq1 = ({
  heading = 'Frequently asked questions',
  items = [],
  className,
}: Faq1Props) => {
  return (
    <section className={cn('py-16', className)}>
      <div className="w-full">
        <h2 className="mb-6 md:mb-10 text-[30px] leading-[1.2] font-normal tracking-[-0.025em] md:text-[34px]">
          {heading}
        </h2>
        <Accordion type="single" collapsible>
          {items.map((item, index) => (
            <AccordionItem key={item.id} value={`item-${String(index)}`} className="mink-faq-item">
              <AccordionTrigger className="font-medium hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
