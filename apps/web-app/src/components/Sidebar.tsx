import { tables } from '@battleship/schema/schema';
import { useClientDocument } from '@livestore/react';
import type React from 'react';
import { useMemo } from 'react';
import { cn } from '../lib/utils';

export interface FileSystemItem {
  id: string;
  name: string;
  type: 'folder' | 'document';
  path: string;
  children?: FileSystemItem[];
}

// Mock data for demonstration
const mockFileSystem: FileSystemItem[] = [
  {
    id: 'folder-1',
    name: 'Game Configs',
    type: 'folder',
    path: '/game-configs',
    children: [
      {
        id: 'doc-1',
        name: 'grid-settings.json',
        type: 'document',
        path: '/game-configs/grid-settings.json',
      },
      {
        id: 'doc-2',
        name: 'ship-types.json',
        type: 'document',
        path: '/game-configs/ship-types.json',
      },
    ],
  },
  {
    id: 'folder-2',
    name: 'Game History',
    type: 'folder',
    path: '/game-history',
    children: [
      {
        id: 'doc-3',
        name: 'game-001.log',
        type: 'document',
        path: '/game-history/game-001.log',
      },
      {
        id: 'doc-4',
        name: 'game-002.log',
        type: 'document',
        path: '/game-history/game-002.log',
      },
    ],
  },
  {
    id: 'doc-5',
    name: 'README.md',
    type: 'document',
    path: '/README.md',
  },
];

interface SidebarItemProps {
  item: FileSystemItem;
  level: number;
  selectedItem?: { id: string; type: 'folder' | 'document'; name: string; path?: string };
  onSelect: (item: FileSystemItem) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, level, selectedItem, onSelect }) => {
  const isSelected = selectedItem?.id === item.id;
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          isSelected && 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100',
          level > 0 && 'ml-4'
        )}
        onClick={() => onSelect(item)}
      >
        <div className="flex items-center gap-1">
          {item.type === 'folder' ? (
            <span className="text-yellow-600">📁</span>
          ) : (
            <span className="text-gray-600">📄</span>
          )}
          <span className="text-sm font-medium truncate">{item.name}</span>
        </div>
      </div>
      
      {hasChildren && (
        <div className="ml-2">
          {item.children?.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              level={level + 1}
              selectedItem={selectedItem}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const [uiState, setUiState] = useClientDocument(tables.uiState);
  const { selectedItem } = uiState;

  const handleItemSelect = (item: FileSystemItem) => {
    setUiState({
      selectedItem: {
        id: item.id,
        type: item.type,
        name: item.name,
        path: item.path,
      },
    });
  };

  const flattenedItems = useMemo(() => {
    const flatten = (items: FileSystemItem[], level = 0): Array<FileSystemItem & { level: number }> => {
      return items.reduce((acc, item) => {
        acc.push({ ...item, level });
        if (item.children) {
          acc.push(...flatten(item.children, level + 1));
        }
        return acc;
      }, [] as Array<FileSystemItem & { level: number }>);
    };
    return flatten(mockFileSystem);
  }, []);

  return (
    <div className="w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Explorer</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {mockFileSystem.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              level={0}
              selectedItem={selectedItem}
              onSelect={handleItemSelect}
            />
          ))}
        </div>
      </div>
      
      {selectedItem && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400">Selected:</div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {selectedItem.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
            {selectedItem.path || `${selectedItem.type}: ${selectedItem.id}`}
          </div>
        </div>
      )}
    </div>
  );
};