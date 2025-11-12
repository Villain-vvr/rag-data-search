import React from 'react';

interface DataItemCardProps {
  item: any;
}

export const DataItemCard: React.FC<DataItemCardProps> = ({ item }) => {
  // Attempt to find a title or name for the card header
  const title = item.name || item.title || item.app || item.id;
  const hasTitle = title && typeof title === 'string';

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 w-full flex flex-col items-start space-y-3 transform hover:scale-105 transition-transform duration-300">
      {hasTitle && (
         <h3 className="text-lg font-bold text-indigo-400">{title}</h3>
      )}
      <pre className="text-xs text-gray-300 bg-gray-900/50 p-3 rounded-md w-full overflow-x-auto">
        <code>{JSON.stringify(item, null, 2)}</code>
      </pre>
    </div>
  );
};
