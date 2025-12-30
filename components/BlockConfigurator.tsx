
import React, { useState } from 'react';
import { BlockConfig } from '../types';

interface BlockConfiguratorProps {
  blocks: BlockConfig[];
  onAddBlock: (newBlock: Omit<BlockConfig, 'isDefault'>) => void;
  onUpdateBlock: (updatedBlock: BlockConfig) => void;
  onRemoveBlock: (blockName: string) => void;
}

const BlockConfigurator: React.FC<BlockConfiguratorProps> = ({ blocks, onAddBlock, onUpdateBlock, onRemoveBlock }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [editingBlockName, setEditingBlockName] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  
  const [newBlock, setNewBlock] = useState({
    name: '',
    blockType: 'GRID' as 'GRID' | 'HEAP',
    totalBays: '35',
    rowsPerBay: '6',
    tiersPerBay: '6',
    capacity: '',
    group: 'GP',
    machineType: 'RS' as 'RTG' | 'RS',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewBlock(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (block: BlockConfig) => {
    setDeleteConfirmation(null);
    setNewBlock({
      name: block.name,
      blockType: block.blockType || 'GRID',
      totalBays: block.totalBays.toString(),
      rowsPerBay: block.rowsPerBay.toString(),
      tiersPerBay: block.tiersPerBay.toString(),
      capacity: block.capacity ? block.capacity.toString() : '',
      group: block.group || 'GP',
      machineType: block.machineType || 'RS',
    });
    setEditingBlockName(block.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = parseInt(newBlock.capacity, 10);
    const totalBays = parseInt(newBlock.totalBays, 10);
    const rowsPerBay = parseInt(newBlock.rowsPerBay, 10);
    const tiersPerBay = parseInt(newBlock.tiersPerBay, 10);

    if (!newBlock.name.trim()) return;

    const blockData = {
        name: editingBlockName ? editingBlockName : newBlock.name.trim().toUpperCase(),
        blockType: newBlock.blockType,
        totalBays: newBlock.blockType === 'GRID' ? totalBays : 0,
        rowsPerBay: newBlock.blockType === 'GRID' ? rowsPerBay : 0,
        tiersPerBay: newBlock.blockType === 'GRID' ? tiersPerBay : 0,
        capacity: capacity || 0,
        group: newBlock.group,
        machineType: newBlock.machineType,
    };

    if (editingBlockName) {
        const originalBlock = blocks.find(b => b.name === editingBlockName);
        if (originalBlock) {
             onUpdateBlock({ ...blockData, isDefault: originalBlock.isDefault });
        }
        setEditingBlockName(null);
    } else {
        onAddBlock(blockData);
    }
    setNewBlock({ name: '', blockType: 'GRID', totalBays: '35', rowsPerBay: '6', tiersPerBay: '6', capacity: '', group: 'GP', machineType: 'RS' });
  };

  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 mb-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-t-xl focus:outline-none"
      >
        <span>Yard Config</span>
        <svg className={`h-5 w-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form Side */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Add New Block/Zone</h3>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-slate-600">
                <input type="radio" name="blockType" value="GRID" checked={newBlock.blockType === 'GRID'} onChange={handleInputChange} />
                <span>Standard Grid</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-slate-600">
                <input type="radio" name="blockType" value="HEAP" checked={newBlock.blockType === 'HEAP'} onChange={handleInputChange} />
                <span>Heap / Zone</span>
              </label>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Name</label>
                  <input type="text" name="name" value={newBlock.name} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-1 ring-blue-500" placeholder="e.g. G2 or APR01" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Group</label>
                  <select name="group" value={newBlock.group} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md text-sm bg-white">
                    <option value="GP">GP (General)</option>
                    <option value="REEFER">REEFER</option>
                    <option value="RỖNG">RỖNG (EMPTY)</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Machine Type</label>
                  <select name="machineType" value={newBlock.machineType} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md text-sm bg-white">
                    <option value="RS">RS (Reach Stacker/Xe nâng)</option>
                    <option value="RTG">RTG</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Capacity</label>
                    {newBlock.blockType === 'GRID' && <span className="text-[8px] text-slate-400">Slots: {parseInt(newBlock.totalBays)*parseInt(newBlock.rowsPerBay)*parseInt(newBlock.tiersPerBay)}</span>}
                  </div>
                  <input type="text" name="capacity" value={newBlock.capacity} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="e.g. 676" />
                </div>
              </div>

              {newBlock.blockType === 'GRID' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Bays</label>
                    <input type="number" name="totalBays" value={newBlock.totalBays} onChange={handleInputChange} className="w-full px-2 py-1.5 border rounded text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Rows</label>
                    <input type="number" name="rowsPerBay" value={newBlock.rowsPerBay} onChange={handleInputChange} className="w-full px-2 py-1.5 border rounded text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Tiers</label>
                    <input type="number" name="tiersPerBay" value={newBlock.tiersPerBay} onChange={handleInputChange} className="w-full px-2 py-1.5 border rounded text-xs" />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-md hover:bg-blue-700 transition-colors text-xs uppercase tracking-widest">
                {editingBlockName ? 'Update' : 'Add'}
              </button>
            </form>
          </div>

          {/* List Side */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Current Blocks & Zones</h3>
            <div className="space-y-2 overflow-y-auto max-h-[250px] pr-2 scrollbar-thin">
              {blocks.map(block => (
                <div key={block.name} className="flex justify-between items-center p-3 rounded-md bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-800">{block.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {block.group} • {block.machineType}
                      <br />
                      {block.capacity} TEUs • {block.totalBays}B x {block.rowsPerBay}R x {block.tiersPerBay}T
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => handleEdit(block)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    </button>
                    <button onClick={() => onRemoveBlock(block.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockConfigurator;
