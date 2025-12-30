
import React from 'react';
import { Container, ContainerFlow } from '../types';
import ContainerCell from './ContainerCell';

interface BayViewProps {
  bayNumber: number;
  containers: Container[];
  rowsPerBay: number;
  tiersPerBay: number;
  highlightedContainerIds: Set<string>;
  selectedVessels: string[];
  filterColors: string[];
  flowFilter: 'ALL' | ContainerFlow;
}

const BayView: React.FC<BayViewProps> = ({ bayNumber, containers, rowsPerBay, tiersPerBay, highlightedContainerIds, selectedVessels, filterColors, flowFilter }) => {
  const containerMap = new Map<string, Container>();
  containers.forEach(c => containerMap.set(`${c.row}-${c.tier}`, c));

  const rows = Array.from({ length: rowsPerBay }, (_, i) => i + 1);
  const tiers = Array.from({ length: tiersPerBay }, (_, i) => i + 1);
  const reversedTiers = [...tiers].reverse();
  
  // Use inline style for dynamic columns to support arbitrary rowsPerBay (e.g. 30, 40)
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${rowsPerBay}, minmax(0, 1fr))`,
    gap: '1px'
  };

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div style={gridStyle} className="bg-slate-400 border border-slate-400">
        {reversedTiers.map(tierNumber =>
          rows.map(rowNumber => {
            const container = containerMap.get(`${rowNumber}-${tierNumber}`);
            const isHighlighted = container ? highlightedContainerIds.has(container.id) : false;
            return (
              <ContainerCell 
                key={`${rowNumber}-${tierNumber}`} 
                container={container} 
                isHighlighted={isHighlighted}
                selectedVessels={selectedVessels}
                filterColors={filterColors}
                flowFilter={flowFilter}
              />
            );
          })
        )}
      </div>
      <div className="text-[10px] font-semibold mt-1 text-slate-600">{bayNumber.toString().padStart(2, '0')}</div>
    </div>
  );
};


interface YardRowViewProps {
  label: string;
  containers: Container[];
  totalBays: number;
  rowsPerBay: number;
  tiersPerBay: number;
  highlightedContainerIds: Set<string>;
  selectedVessels: string[];
  filterColors: string[];
  flowFilter: 'ALL' | ContainerFlow;
}

const YardRowView: React.FC<YardRowViewProps> = ({ label, containers, totalBays, rowsPerBay, tiersPerBay, highlightedContainerIds, selectedVessels, filterColors, flowFilter }) => {
  const bays = Array.from({ length: totalBays }, (_, i) => i * 2 + 1);

  const containersByBay = new Map<number, Container[]>();
  containers.forEach(c => {
    if (!containersByBay.has(c.bay)) {
      containersByBay.set(c.bay, []);
    }
    containersByBay.get(c.bay)!.push(c);
  });

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-slate-700 mb-4">{`Block ${label}`}</h2>
      <div className="flex space-x-1 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
        {bays.map(bayNumber => {
          return (
             <React.Fragment key={bayNumber}>
                <BayView
                  bayNumber={bayNumber}
                  containers={containersByBay.get(bayNumber) || []}
                  rowsPerBay={rowsPerBay}
                  tiersPerBay={tiersPerBay}
                  highlightedContainerIds={highlightedContainerIds}
                  selectedVessels={selectedVessels}
                  filterColors={filterColors}
                  flowFilter={flowFilter}
                />
             </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default YardRowView;
