import { Demo } from '@/types';
import Link from 'next/link';
import Image from 'next/image';

interface DemoCardProps {
  demo: Demo;
}

export const DemoCard = ({ demo }: DemoCardProps) => {
  return (
    <Link href={`/demo/${demo.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4">
        <div className="aspect-square relative mb-4">
          {demo.iconPath ? (
            <Image
              src={demo.iconPath}
              alt={demo.name}
              fill
              className="object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-4xl text-gray-400">{demo.name[0]}</span>
            </div>
          )}
        </div>
        <h3 className="text-lg font-semibold mb-2">{demo.name}</h3>
        <p className="text-sm text-gray-600">
          {demo.assistants.length} assistant{demo.assistants.length !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  );
}; 