
import React from 'react';
import { Container, ContainerFlow } from '../types';
import ContainerCell from './ContainerCell';
import { calculateTEU } from '../App';

interface HeapBlockViewProps {
  label: string;
  containers: Container[];
  capacity: number;
  highlightedContainerIds: Set<string>;
  selectedVessels: string[];
  filterColors: string[];
  flowFilter: 'ALL' | ContainerFlow;
}

const HeapBlockView: React.FC<HeapBlockViewProps> = ({ 
  label, 
  containers, 
  capacity,
  highlightedContainerIds, 
  selectedVessels, 
  filterColors, 
  flowFilter 
}) => {
  const sortedContainers = [...containers].sort((a, b) => a.id.localeCompare(b.id));

  const totalTEU = sortedContainers.reduce((sum, c) => sum + calculateTEU(c), 0);
  const utilization = capacity > 0 ? (totalTEU / capacity) * 100 : 0;
  
  let utilizationColor = 'text-green-600';
  if (utilization > 80) utilizationColor = 'text-orange-500';
  if (utilization > 95) utilizationColor = 'text-red-600';

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <div>
            <h2 className="text-xl font-bold text-slate-700">{`Zone ${label}`}</h2>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mt-1">Heap / Bãi Vùng</p>
        </div>
        <div className="text-right">
            <div className={`text-2xl font-mono font-black ${utilizationColor}`}>
                {utilization.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">
                {totalTEU} / {capacity} TEU
            </div>
        </div>
      </div>
      
      <div className="bg-slate-100 p-2 rounded-lg min-h-[100px]">
          {sortedContainers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm italic py-8">
                  No containers in this zone
              </div>
          ) : (
              <div className="flex flex-wrap gap-1 content-start">
                  {sortedContainers.map(container => {
                      const isHighlighted = highlightedContainerIds.has(container.id);
                      return (
                        <ContainerCell 
                            key={container.id} 
                            container={container} 
                            isHighlighted={isHighlighted}
                            selectedVessels={selectedVessels}
                            filterColors={filterColors}
                            flowFilter={flowFilter}
                        />
                      );
                  })}
              </div>
          )}
      </div>
    </div>
  );
};

export default HeapBlockView;
