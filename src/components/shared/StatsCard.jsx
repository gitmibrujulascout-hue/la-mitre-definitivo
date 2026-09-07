import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatsCard({ title, value, subtitle, icon: Icon, iconColor }) {
  return (
    <Card className="relative overflow-hidden rounded-xl border border-forest/20 bg-forest-soft p-5 text-forest-deep shadow transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-forest-deep/70">{title}</p>
          <p className="text-2xl font-bold text-forest-deep">{value}</p>
          {subtitle && <p className="text-xs text-forest-deep/70">{subtitle}</p>}
        </div>
        {Icon &&
        <div className={cn('rounded-xl bg-primary/15 p-2.5', iconColor)}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        }
      </div>
    </Card>);

}
