import { Demo } from '@/types';
import { DemoCard } from './DemoCard';

interface DemoGridProps {
  demos: Demo[];
}

export const DemoGrid = ({ demos }: DemoGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {demos.map((demo) => (
        <DemoCard key={demo.id} demo={demo} />
      ))}
    </div>
  );
}; 