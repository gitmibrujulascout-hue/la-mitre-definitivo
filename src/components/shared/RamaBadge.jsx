import React from 'react';
import { Badge } from '@/components/ui/badge';
import { RAMA_CONFIG } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function RamaBadge({ rama, className }) {
  const config = RAMA_CONFIG[rama];
  if (!config) return <Badge variant="secondary">{rama}</Badge>;

  return (
    <Badge className={cn('border font-medium', config.badge, className)}>
      <span className={cn('w-2 h-2 rounded-full mr-1.5', config.dot)} />
      {rama}
    </Badge>
  );
}